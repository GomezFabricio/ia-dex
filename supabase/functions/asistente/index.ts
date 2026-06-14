import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

/**
 * asistente — IA-dex conversational assistant edge function.
 *
 * 1. Parse request: { pregunta, historial?, pagina? }
 * 2. Load a compact catalogue context (software + temas) for grounding
 * 3. Call Gemini (primary → fallback model) to answer in Rioplatense Spanish,
 *    grounded in the catalogue, returning { respuesta, fuentes[] }
 * 4. Return the answer (degrades to a friendly message on Gemini failure)
 *
 * Auth: public (anon key); CORS: wildcard. Mirrors the buscar EF patterns
 * (inlined CORS, primary/fallback Gemini models, per-attempt timeout).
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function handleOptions(req: Request): Response | null {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  return null;
}

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';
const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.5-flash-lite';
const GEMINI_FALLBACK_MODEL = Deno.env.get('GEMINI_FALLBACK_MODEL') ?? 'gemini-2.0-flash-lite';
const GEMINI_TIMEOUT_MS = 8000;

interface HistMsg {
  role: 'user' | 'assistant';
  text: string;
}

interface AsistenteRequest {
  pregunta: string;
  historial?: HistMsg[];
  pagina?: string;
}

interface AsistenteResult {
  respuesta: string;
  fuentes: string[];
}

interface SoftwareCtx {
  nombre: string;
  objetivo: string | null;
  tema_id: string;
}
interface TemaCtx {
  id: string;
  nombre: string;
}

// Build a compact grounding string the model can cite from.
function buildContexto(software: SoftwareCtx[], temas: TemaCtx[]): string {
  const temaNombre = new Map(temas.map((t) => [t.id, t.nombre]));
  const lines = software.map((s) => {
    const tema = temaNombre.get(s.tema_id) ?? '—';
    const obj = (s.objetivo ?? '').slice(0, 140);
    return `- ${s.nombre} (tema: ${tema})${obj ? `: ${obj}` : ''}`;
  });
  return `Temas del curso: ${temas.map((t) => t.nombre).join(', ')}.\n\nHerramientas del catálogo:\n${lines.join('\n')}`;
}

async function ask(req: AsistenteRequest, contexto: string): Promise<AsistenteResult | null> {
  const historial = (req.historial ?? [])
    .slice(-6)
    .map((m) => `${m.role === 'user' ? 'Usuario' : 'Asistente'}: ${m.text}`)
    .join('\n');

  const prompt = `Sos el asistente de IA-dex, un índice de software de inteligencia artificial catalogado por temas del curso. Respondé en español rioplatense (voseo), de forma clara, breve y didáctica. Basate SOLO en el catálogo que sigue; si algo no está en el catálogo, decílo y sugerí lo más cercano. Cuando recomiendes herramientas o temas del catálogo, listá sus nombres exactos en "fuentes".

${contexto}

${req.pagina ? `Contexto de la página actual del usuario:\n${req.pagina}\n` : ''}${historial ? `Conversación previa:\n${historial}\n` : ''}
Pregunta del usuario: "${req.pregunta}"

Devolvé un JSON con esta estructura exacta:
- respuesta: tu respuesta en español rioplatense (string)
- fuentes: array de nombres EXACTOS de herramientas o temas del catálogo que mencionaste (puede ser vacío)`;

  const schema = {
    type: 'object',
    properties: {
      respuesta: { type: 'string' },
      fuentes: { type: 'array', items: { type: 'string' } },
    },
    required: ['respuesta'],
  };

  const tryModel = async (model: string): Promise<AsistenteResult | null> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
      const res = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', responseSchema: schema, temperature: 0.4 },
        }),
      });
      clearTimeout(timer);
      if (!res.ok) {
        console.error(`Gemini [${model}] error: ${res.status} ${await res.text()}`);
        return null;
      }
      const data = await res.json();
      const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      try {
        const parsed = JSON.parse(raw) as Partial<AsistenteResult>;
        if (!parsed.respuesta) return null;
        return { respuesta: parsed.respuesta, fuentes: Array.isArray(parsed.fuentes) ? parsed.fuentes : [] };
      } catch (parseErr) {
        console.error(`Gemini [${model}] JSON parse failed:`, parseErr instanceof Error ? parseErr.message : String(parseErr));
        return null;
      }
    } catch (err) {
      clearTimeout(timer);
      console.error(`Gemini [${model}] failed:`, err instanceof Error ? err.message : String(err));
      return null;
    }
  };

  for (const model of [GEMINI_MODEL, GEMINI_FALLBACK_MODEL]) {
    const out = await tryModel(model);
    if (out !== null) return out;
  }
  return null;
}

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    const body = (await req.json()) as AsistenteRequest;
    const pregunta = (body.pregunta ?? '').trim();
    if (pregunta === '') {
      return new Response(JSON.stringify({ error: 'pregunta requerida' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!);

    const [swRes, temasRes] = await Promise.all([
      supabase.from('software').select('nombre, objetivo, tema_id'),
      supabase.from('temas').select('id, nombre').order('orden'),
    ]);

    const software = (swRes.data ?? []) as SoftwareCtx[];
    const temas = (temasRes.data ?? []) as TemaCtx[];
    const contexto = buildContexto(software, temas);

    const result = await ask(body, contexto);

    const payload: AsistenteResult =
      result ?? {
        respuesta:
          'Perdoná, ahora mismo no puedo procesar la consulta. Probá de nuevo en un momento.',
        fuentes: [],
      };

    return new Response(JSON.stringify(payload), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('asistente error:', err instanceof Error ? err.message : String(err));
    return new Response(JSON.stringify({ error: 'internal_error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
