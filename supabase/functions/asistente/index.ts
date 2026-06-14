import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

/**
 * asistente — IA-dex conversational assistant edge function.
 *
 * 1. Parse request: { pregunta, historial?, pagina? }
 * 2. Load a compact grounding context (software + temas + SI taxonomy) from the DB
 * 3. Call Gemini (primary → fallback model, then one retry pass with 600ms backoff)
 *    to answer as a didactic AI tutor in Rioplatense Spanish, returning { respuesta, fuentes[] }
 * 4. Return the answer (degrades to a friendly transient-fail message on full exhaustion)
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

// Dedicated key for the assistant so its traffic doesn't eat the buscar EF's
// quota. Falls back to the shared GEMINI_API_KEY if the dedicated secret isn't set.
const GEMINI_API_KEY =
  Deno.env.get('GEMINI_API_KEY_ASISTENTE') ?? Deno.env.get('GEMINI_API_KEY') ?? '';
const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.5-flash-lite';
const GEMINI_FALLBACK_MODEL = Deno.env.get('GEMINI_FALLBACK_MODEL') ?? 'gemini-2.0-flash-lite';
// Per-attempt timeout. Two passes × 2 models + 600ms backoff must stay under ~10s
// so the frontend 12s service timeout is never hit.
const GEMINI_TIMEOUT_MS = 4000;
const RETRY_BACKOFF_MS = 600;

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
interface CriterioCtx {
  id: string;
  nombre: string;
  descripcion: string | null;
  orden: number;
}
interface ClasifCtx {
  nombre: string;
  en_que_consiste: string | null;
  ejemplos: string | null;
  criterio_id: string;
  orden: number;
}

// Build a compact grounding string the model can cite from.
function buildContexto(
  software: SoftwareCtx[],
  temas: TemaCtx[],
  criterios: CriterioCtx[],
  clasificaciones: ClasifCtx[],
): string {
  const temaNombre = new Map(temas.map((t) => [t.id, t.nombre]));

  // Catalog tools section
  const toolLines = software.map((s) => {
    const tema = temaNombre.get(s.tema_id) ?? '—';
    const obj = (s.objetivo ?? '').slice(0, 140);
    return `- ${s.nombre} (tema: ${tema})${obj ? `: ${obj}` : ''}`;
  });

  // SI taxonomy section — grouped by criterio (axis)
  const clasifByCriterio = new Map<string, ClasifCtx[]>();
  for (const c of clasificaciones) {
    if (!clasifByCriterio.has(c.criterio_id)) clasifByCriterio.set(c.criterio_id, []);
    clasifByCriterio.get(c.criterio_id)!.push(c);
  }

  const taxLines: string[] = [];
  for (const criterio of criterios) {
    const cats = (clasifByCriterio.get(criterio.id) ?? []).sort((a, b) => a.orden - b.orden);
    if (cats.length === 0) continue;
    taxLines.push(`Eje "${criterio.nombre}":`);
    for (const cat of cats) {
      const desc = (cat.en_que_consiste ?? '').slice(0, 160);
      taxLines.push(`  • ${cat.nombre}${desc ? ` — ${desc}` : ''}`);
    }
  }

  return [
    `Temas del curso: ${temas.map((t) => t.nombre).join(', ')}.`,
    '',
    'Clasificaciones de IA por eje:',
    taxLines.join('\n'),
    '',
    'Herramientas del catálogo:',
    toolLines.join('\n'),
  ].join('\n');
}

async function ask(req: AsistenteRequest, contexto: string): Promise<AsistenteResult | null> {
  const historial = (req.historial ?? [])
    .slice(-6)
    .map((m) => `${m.role === 'user' ? 'Usuario' : 'Asistente'}: ${m.text}`)
    .join('\n');

  const prompt = `Sos el asistente de IA-dex, una guía educativa de inteligencia artificial para estudiantes de un curso de Sistemas Inteligentes. Respondé en español rioplatense (voseo), claro, breve y didáctico.

Usá el material del curso que sigue (temas, clasificaciones de IA por eje, y herramientas del catálogo) como BASE para explicar conceptos de IA (qué es, tipos, clasificaciones, formas de aprendizaje, etc.) y para recomendar herramientas. Si te preguntan algo de IA que no está explícito en el material, explicalo igual con tu conocimiento general de IA, de forma didáctica — pero NO inventes herramientas que no estén en el catálogo. Si te pasan el contexto de una página (pagina), usalo para responder sobre lo que el usuario está viendo. Cuando menciones herramientas, clasificaciones o temas del catálogo, poné sus nombres EXACTOS en "fuentes".

${contexto}

${req.pagina ? `Contexto de la página actual del usuario:\n${req.pagina}\n` : ''}${historial ? `Conversación previa:\n${historial}\n` : ''}
Pregunta del usuario: "${req.pregunta}"

Devolvé un JSON con esta estructura exacta:
- respuesta: tu respuesta en español rioplatense (string)
- fuentes: array de nombres EXACTOS de herramientas, clasificaciones o temas del catálogo que mencionaste (puede ser vacío)`;

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

  const models = [GEMINI_MODEL, GEMINI_FALLBACK_MODEL];

  // Pass 1: try each model once.
  for (const model of models) {
    const out = await tryModel(model);
    if (out !== null) return out;
  }

  // Pass 2: both failed (likely transient 429). Wait briefly then try once more.
  await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS));
  for (const model of models) {
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

    const [swRes, temasRes, criteriosRes, clasificacionesRes] = await Promise.all([
      supabase.from('software').select('nombre, objetivo, tema_id'),
      supabase.from('temas').select('id, nombre').order('orden'),
      supabase.from('criterios_si').select('id, nombre, descripcion, orden').order('orden'),
      supabase.from('clasificaciones_si').select('nombre, en_que_consiste, ejemplos, criterio_id, orden').order('orden'),
    ]);

    const software = (swRes.data ?? []) as SoftwareCtx[];
    const temas = (temasRes.data ?? []) as TemaCtx[];
    const criterios = (criteriosRes.data ?? []) as CriterioCtx[];
    const clasificaciones = (clasificacionesRes.data ?? []) as ClasifCtx[];
    const contexto = buildContexto(software, temas, criterios, clasificaciones);

    const result = await ask(body, contexto);

    const payload: AsistenteResult =
      result ?? {
        respuesta:
          'Uy, estoy con mucha demanda en este momento 😅. Probá de nuevo en unos segundos.',
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
