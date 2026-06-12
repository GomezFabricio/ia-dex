import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

/**
 * buscar — public search pipeline edge function
 *
 * 1. Parse request: { texto, filtros? }
 * 2. Gemini intent extraction (2 s timeout, degrades gracefully on failure)
 * 3. Merge manual filtros (manual always wins over extracted)
 * 4. Embed texto_semantico via gte-small
 * 5. Call buscar_hibrido RPC
 * 6. Return { resultados, filtros_aplicados, intent_usado }
 *
 * Auth: public (anon key); CORS: wildcard.
 *
 * Note: cors.ts is intentionally inlined here because the MCP deploy bundler
 * cannot resolve relative paths outside the function directory (../_shared/).
 * The _shared/cors.ts file remains canonical for local Supabase CLI use.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function handleOptions(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  return null;
}

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';
// gemini-2.5-flash-lite is the current Flash-Lite class id.
// Fall back to gemini-2.0-flash-lite if the primary id returns model-not-found.
const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.5-flash-lite';
const GEMINI_TIMEOUT_MS = 2000;

interface Filtros {
  tema_id?: string;
  licencia?: string;
  anio_desde?: number;
  anio_hasta?: number;
}

interface BusquedaRequest {
  texto: string;
  filtros?: Filtros;
}

interface IntentResult {
  anio_desde?: number;
  anio_hasta?: number;
  licencia?: string;
  tema_nombre?: string;
  texto_semantico: string;
}

interface Tema {
  id: string;
  nombre: string;
}

async function extractIntent(
  texto: string,
  temas: Tema[],
): Promise<{ intent: IntentResult; success: boolean }> {
  const temaNombres = temas.map((t) => t.nombre);

  const prompt = `Analiza la siguiente consulta en español sobre software de IA y extrae filtros estructurados.

Consulta: "${texto}"

Temas disponibles (solo usa uno de estos valores exactos o null): ${JSON.stringify(temaNombres)}

Devuelve un JSON con exactamente esta estructura:
- anio_desde: número de año (ej: 2022) o null
- anio_hasta: número de año o null
- licencia: "free", "freemium", "paid" o null (interpreta "gratis"/"gratuito" como "free", "pago"/"premium" como "paid")
- tema_nombre: uno de los valores exactos del array de temas o null
- texto_semantico: el texto restante para búsqueda semántica (siempre requerido, puede ser el texto completo)`;

  const schema = {
    type: 'object',
    properties: {
      anio_desde: { type: 'number', nullable: true },
      anio_hasta: { type: 'number', nullable: true },
      licencia: {
        type: 'string',
        enum: ['free', 'freemium', 'paid', null],
        nullable: true,
      },
      tema_nombre: {
        type: 'string',
        enum: [...temaNombres, null],
        nullable: true,
      },
      texto_semantico: { type: 'string' },
    },
    required: ['texto_semantico'],
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  try {
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
    const res = await fetch(geminiUrl, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: schema,
          temperature: 0,
        },
      }),
    });

    clearTimeout(timer);

    if (!res.ok) {
      console.error(`Gemini error: ${res.status} ${await res.text()}`);
      return { intent: { texto_semantico: texto }, success: false };
    }

    const data = await res.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    let parsed: IntentResult;
    try {
      parsed = JSON.parse(raw);
    } catch (parseErr) {
      console.error(
        'Gemini JSON parse failed. Raw response:',
        raw,
        'Error:',
        parseErr instanceof Error ? parseErr.message : String(parseErr),
      );
      return { intent: { texto_semantico: texto }, success: false };
    }

    return {
      intent: {
        ...parsed,
        texto_semantico: parsed.texto_semantico || texto,
      },
      success: true,
    };
  } catch (err) {
    clearTimeout(timer);
    const reason = err instanceof Error ? err.message : String(err);
    console.error(`Gemini extraction failed: ${reason}`);
    return { intent: { texto_semantico: texto }, success: false };
  }
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    const body = (await req.json()) as BusquedaRequest;
    const texto = (body.texto ?? '').trim();
    const manualFiltros: Filtros = body.filtros ?? {};

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
    );

    let intentUsado = false;
    let extractedFiltros: Filtros = {};
    let textoSemantico = texto;

    // ── Gemini intent extraction (only when texto is non-empty) ──────────────
    if (texto) {
      const { data: temas } = await supabase
        .from('temas')
        .select('id, nombre');

      const temaList: Tema[] = temas ?? [];
      const { intent, success } = await extractIntent(texto, temaList);

      intentUsado = success;
      textoSemantico = intent.texto_semantico || texto;

      if (success) {
        // Map tema_nombre → tema_id
        let temaId: string | undefined;
        if (intent.tema_nombre) {
          const match = temaList.find(
            (t) => t.nombre === intent.tema_nombre,
          );
          temaId = match?.id;
        }

        extractedFiltros = {
          tema_id: temaId,
          licencia: intent.licencia ?? undefined,
          anio_desde: intent.anio_desde ?? undefined,
          anio_hasta: intent.anio_hasta ?? undefined,
        };
      }
    }

    // ── Merge filters: manual wins over extracted ────────────────────────────
    const filtrosAplicados: Filtros = {
      tema_id: manualFiltros.tema_id ?? extractedFiltros.tema_id,
      licencia: manualFiltros.licencia ?? extractedFiltros.licencia,
      anio_desde: manualFiltros.anio_desde ?? extractedFiltros.anio_desde,
      anio_hasta: manualFiltros.anio_hasta ?? extractedFiltros.anio_hasta,
    };

    // ── Embed texto_semantico via gte-small ──────────────────────────────────
    const session = new Supabase.ai.Session('gte-small');
    const embeddingRaw = await session.run(textoSemantico || texto || ' ', {
      mean_pool: true,
      normalize: true,
    });
    const queryEmbedding = Array.from(embeddingRaw as Float32Array);

    // ── Call hybrid RPC ──────────────────────────────────────────────────────
    // match_threshold 0.82: empirically tuned for gte-small on this Spanish corpus.
    // Irrelevant queries (e.g. off-topic text) peak at ~0.80; relevant AI-tool
    // queries start at 0.82+. Explicit here so it documents the tuned value.
    const { data: resultados, error: rpcErr } = await supabase.rpc(
      'buscar_hibrido',
      {
        query_text: textoSemantico || texto,
        query_embedding: queryEmbedding,
        p_tema_id: filtrosAplicados.tema_id ?? null,
        p_licencia: filtrosAplicados.licencia ?? null,
        p_anio_desde: filtrosAplicados.anio_desde ?? null,
        p_anio_hasta: filtrosAplicados.anio_hasta ?? null,
        match_threshold: 0.82,
      },
    );

    if (rpcErr) {
      console.error('RPC error:', rpcErr.message);
      return new Response(
        JSON.stringify({ error: 'Search unavailable' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({
        resultados: resultados ?? [],
        filtros_aplicados: filtrosAplicados,
        intent_usado: intentUsado,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('buscar unhandled error:', msg);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
