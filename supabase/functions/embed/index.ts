import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

/**
 * embed — internal edge function
 *
 * Called exclusively by the pg_net trigger after INSERT/UPDATE on software.
 * Reads the software row, concatenates text fields + tema name, generates a
 * gte-small embedding, and writes it back using the service role key.
 *
 * Auth: pre-shared secret via x-embed-secret header (set by the trigger, read
 *       from Vault). The function fetches the expected secret once at module
 *       level via get_embed_secret() RPC (service role only). Requests without
 *       the correct secret are rejected with 401.
 *
 * JWT verification is disabled (verify_jwt: false) because the trigger passes
 * an anon bearer for transport — real auth is the x-embed-secret header.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Service-role client for privileged operations (secret fetch + row write)
const serviceClient = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

// Fetch the embed shared secret once at module level and cache it.
// If the RPC fails the promise rejects — requests will fall through to the
// 401 path because cachedSecret will remain null.
let cachedSecret: string | null = null;
const secretPromise: Promise<void> = (async () => {
  const { data, error } = await serviceClient.rpc('get_embed_secret');
  if (error) {
    console.error('embed: failed to fetch embed_shared_secret:', error.message);
  } else {
    cachedSecret = data as string | null;
  }
})();

Deno.serve(async (req: Request) => {
  // Ensure the module-level secret fetch has settled before handling any request
  await secretPromise;

  // ── Authentication: compare x-embed-secret header ───────────────────────
  const incomingSecret = req.headers.get('x-embed-secret');
  if (!incomingSecret || !cachedSecret || incomingSecret !== cachedSecret) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { id } = await req.json() as { id: string };

    if (!id) {
      return new Response(JSON.stringify({ error: 'Missing id' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // ── Validate id is a UUID ─────────────────────────────────────────────
    if (!UUID_RE.test(id)) {
      return new Response(JSON.stringify({ error: 'Invalid id format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Fetch software row
    const { data: row, error: rowErr } = await serviceClient
      .from('software')
      .select('id, nombre, objetivo, descripcion_corta, tema_id')
      .eq('id', id)
      .single();

    if (rowErr || !row) {
      return new Response(
        JSON.stringify({ error: rowErr?.message ?? 'Row not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Fetch tema name for richer embedding
    let temaNombre = '';
    if (row.tema_id) {
      const { data: tema } = await serviceClient
        .from('temas')
        .select('nombre')
        .eq('id', row.tema_id)
        .single();
      temaNombre = tema?.nombre ?? '';
    }

    // Build text to embed
    const text = [row.nombre, row.objetivo, row.descripcion_corta, temaNombre]
      .filter(Boolean)
      .join(' ');

    // Generate embedding via Supabase built-in gte-small model
    const session = new Supabase.ai.Session('gte-small');
    const embeddingRaw = await session.run(text, {
      mean_pool: true,
      normalize: true,
    });

    // Convert to plain number[] for the vector column
    const embedding = Array.from(embeddingRaw as Float32Array);

    // Write embedding back to the row
    const { error: updateErr } = await serviceClient
      .from('software')
      .update({ embedding: JSON.stringify(embedding) })
      .eq('id', id);

    if (updateErr) {
      return new Response(JSON.stringify({ error: updateErr.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
});
