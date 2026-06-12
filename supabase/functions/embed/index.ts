import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

/**
 * embed — internal edge function
 *
 * Called exclusively by the pg_net trigger after INSERT/UPDATE on software.
 * Reads the software row, concatenates text fields + tema name, generates a
 * gte-small embedding, and writes it back using the service role key.
 *
 * Auth surface: anon Bearer (trigger uses anon key as transport; the function
 * uses SUPABASE_SERVICE_ROLE_KEY internally to write). No CORS needed.
 */
Deno.serve(async (req: Request) => {
  try {
    const { id } = await req.json() as { id: string };

    if (!id) {
      return new Response(JSON.stringify({ error: 'Missing id' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Fetch software row
    const { data: row, error: rowErr } = await supabase
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
      const { data: tema } = await supabase
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
    const { error: updateErr } = await supabase
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
