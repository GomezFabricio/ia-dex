# IA-dex — Informe Técnico del Sistema

**Proyecto:** Catálogo navegable de software de Inteligencia Artificial
**Cátedra:** Sistemas Inteligentes
**Equipo:** Avila Poletti · Cano Alejandro · Gomez Fabricio
**Producción:** https://ia-dex-nine.vercel.app

---

## 1. Visión general

IA-dex es una aplicación web que cataloga herramientas de Inteligencia Artificial organizadas según los ejes temáticos de la materia. Sobre ese catálogo se construyen las funcionalidades requeridas por el PRD: búsqueda multicriterio, búsqueda por voz, valoraciones, foro de discusión, estadísticas de uso y recomendaciones. Como diferencial técnico, el sistema implementa **búsqueda semántica híbrida con procesamiento de lenguaje natural**: el usuario puede escribir (o dictar) consultas en lenguaje coloquial como *"herramientas gratuitas de visión por computadora del 2022"* y el sistema extrae automáticamente los filtros estructurados y ordena los resultados por relevancia semántica.

---

## 2. Arquitectura general

El sistema sigue una arquitectura **serverless de tres capas**: un frontend SPA, una capa de funciones de borde (Edge Functions) para la lógica que requiere secretos, y PostgreSQL como motor de datos, búsqueda y analítica.

```
┌─────────────────────────────────────────────────────────────┐
│  FRONTEND (Vercel)                                          │
│  React 19 + Vite + Tailwind v4 — SPA con React Router 7     │
│  páginas → hooks → servicios → cliente supabase-js tipado   │
└───────────────┬─────────────────────────┬───────────────────┘
                │ PostgREST / Auth         │ functions.invoke
┌───────────────▼─────────────┐ ┌─────────▼───────────────────┐
│  SUPABASE — PostgreSQL      │ │  EDGE FUNCTIONS (Deno)      │
│  tablas + RLS               │ │  buscar: pipeline de        │
│  vistas de estadísticas     │◄┤    búsqueda híbrida + NLP   │
│  RPC buscar_hibrido         │ │  embed: indexador de        │
│  pgvector + FTS español     │ │    embeddings (interno)     │
│  trigger pg_net ────────────┼─►                             │
└─────────────────────────────┘ └─────────┬───────────────────┘
                                          │ HTTPS
                                ┌─────────▼───────────────────┐
                                │  SERVICIOS EXTERNOS         │
                                │  Gemini (intención NLP)     │
                                │  gte-small (embeddings,     │
                                │    local en Supabase)       │
                                │  Brevo (SMTP transaccional) │
                                │  Google OAuth               │
                                └─────────────────────────────┘
```

Principios rectores:

- **El esquema de la base es la única fuente de verdad**: los tipos TypeScript se regeneran desde el esquema real (`npm run gen:types`), nunca se escriben a mano.
- **Los secretos nunca tocan el navegador**: la clave de Gemini y la service-role key viven exclusivamente en las Edge Functions; el frontend solo conoce la clave anónima pública.
- **Degradación elegante en cada eslabón**: cada dependencia externa (Gemini, Edge Function, micrófono) tiene un camino de fallback que mantiene la aplicación funcional.

---

## 3. Stack tecnológico

| Capa | Tecnología | Rol |
|---|---|---|
| UI | React 19 + TypeScript estricto | Componentes funcionales con hooks |
| Build | Vite 8 | Dev server y bundling |
| Estilos | Tailwind CSS v4 | Design system propio vía tokens `@theme` en CSS (modo claro/oscuro) |
| Routing | React Router 7 (`createBrowserRouter`) | SPA con 12 rutas |
| Backend | Supabase (PostgreSQL + PostgREST + Auth + Edge Functions) | Datos, autenticación y lógica de servidor |
| Búsqueda vectorial | pgvector (índice HNSW, 384 dimensiones) | Pierna semántica de la búsqueda |
| Búsqueda léxica | tsvector + GIN, configuración `spanish` | Pierna full-text con stemming en español |
| NLP | Google Gemini (`gemini-2.5-flash-lite`, fallback `2.0-flash-lite`) | Extracción de intención de la consulta |
| Embeddings | `gte-small` vía `Supabase.ai.Session` | Vectorización local, sin servicio externo |
| Voz | Web Speech API (nativa del navegador) | Transcripción es-AR sin dependencias |
| Email | Brevo (SMTP transaccional) | Confirmación de cuenta y recuperación de contraseña |
| Hosting | Vercel (SPA con rewrite a `index.html`) | Despliegue continuo desde `main` |

---

## 4. Modelo de datos

### 4.1 Tablas

- **`temas`** — eje temático 1 (7 unidades de la materia): `slug`, `nombre`, `descripcion`, `orden`.
- **`clasificaciones_si`** — eje 2, clasificaciones de sistemas inteligentes: `slug`, `nombre`, `en_que_consiste`, `imagen_url`, `ejemplos`, `enlaces` (jsonb).
- **`software`** — entidad central del catálogo: `nombre`, `objetivo`, `descripcion_corta`, `url_acceso`, `licencia`, `anio_lanzamiento`, `autor_referencia`, `video_url`, `imagen_url`; FK obligatoria a `temas` y opcional a `clasificaciones_si`. Incluye dos columnas de índice de búsqueda:
  - `embedding vector(384)` — embedding semántico generado automáticamente (ver §6.4).
  - `fts tsvector` — columna **generada** (`GENERATED ALWAYS AS ... STORED`) que tokeniza nombre + objetivo + descripción con stemming español; Postgres la mantiene sin intervención.
- **`valoraciones`** — puntajes 1–5 **polimórficos**: `contenido_tipo` (`software` | `tema` | `clasificacion_si`) + `contenido_id`, con clave de upsert `(user_id, contenido_tipo, contenido_id)` — un voto por usuario por contenido, editable.
- **`temas_foro`** y **`mensajes_foro`** — hilos y respuestas del foro, con `ON DELETE CASCADE` de hilo a respuestas.
- **`eventos`** — log de analítica de solo-inserción: `tipo` (`vista` | `busqueda` | `click_enlace`), `metadata` jsonb, `user_id` opcional (admite anónimos).

### 4.2 Vistas de estadísticas

- `v_software_populares` — agrega eventos `vista` por software.
- `v_software_rating` — agrega promedio y cantidad de valoraciones.

Ambas con `security_invoker = on`, de modo que respetan las políticas RLS del consultante.

### 4.3 Seguridad a nivel de fila (RLS)

- Catálogo (`temas`, `clasificaciones_si`, `software`): lectura pública.
- `valoraciones`, `temas_foro`, `mensajes_foro`: escritura solo del propio usuario (`auth.uid() = user_id`); el borrado en el foro queda restringido al autor.
- `eventos`: inserción pública (permite analítica anónima), sin lectura directa por clientes.
- Defensa en profundidad: los servicios de frontend verifican sesión antes de escribir (`'Requiere sesión'`), y la base vuelve a verificar con RLS. Un cliente malicioso que saltee la UI choca igualmente contra la política de la base.

---

## 5. Funcionalidades

### 5.1 Catálogo navegable
`/catalogo` lista los 7 temas; `/catalogo/:temaSlug` muestra el software de cada tema; `/software/:id` presenta la ficha completa (banner, chips de licencia y año, descripción, video embebido de YouTube, datos de referencia, valoración y recomendaciones). Cada visita a una ficha registra un evento `vista` (con guarda anti-duplicación para StrictMode).

### 5.2 Clasificaciones de sistemas inteligentes
`/clasificaciones` y su detalle cubren el segundo eje: en qué consiste cada clasificación, ejemplos, imagen y enlaces de referencia, también valorables con estrellas.

### 5.3 Búsqueda multicriterio, semántica y por voz
Detallada en §6. Formulario con texto libre, tema, licencia y rango de años; entrada por voz con visualización de actividad; resultados con ranking híbrido.

### 5.4 Valoraciones
Componente `StarRating` montado en fichas de software, temas y clasificaciones. Muestra el promedio y el voto propio; el voto exige sesión mediante el patrón *action-gate* (`useRequireAuth`): el usuario anónimo puede navegar todo y solo se le pide login en el momento de la acción.

### 5.5 Foro
Listado de hilos (`/foro`), creación de hilos y respuestas con sesión, vista de hilo completo (`/foro/:id`) y borrado restringido al autor (garantizado por RLS, no solo por UI).

### 5.6 Estadísticas y recomendaciones
`/estadisticas` presenta dos rankings top-10: software más visto (de `v_software_populares`) y mejor valorado (de `v_software_rating`). Las recomendaciones (página de inicio y fichas) usan una heurística de popularidad por tema: software del mismo tema ordenado por vistas, excluyendo el ítem actual, con fallback alfabético en frío.

---

## 6. Búsqueda inteligente (detalle técnico)

### 6.1 Pipeline de consulta

```
Usuario (texto o voz)
  └─ useBusqueda.buscar()
       ├─ texto vacío → softwareService.buscar() (ilike/eq directo)
       └─ texto presente → Edge Function `buscar`:
            1. Gemini extrae intención     → filtros estructurados
            2. gte-small vectoriza         → embedding de la consulta
            3. RPC buscar_hibrido          → fusión vectorial + léxica
            └─ ante CUALQUIER error → fallback transparente a ilike
```

### 6.2 Extracción de intención (NLP)

La Edge Function `buscar` envía la consulta a Gemini con **salida estructurada** (`responseSchema`): el modelo devuelve `{anio_desde, anio_hasta, licencia, tema_nombre, texto_semantico}`. Los nombres de temas se inyectan en el prompt como enum cerrado, y el mapeo nombre→id se hace en el servidor — el modelo nunca genera UUIDs (riesgo de alucinación eliminado por diseño). El prompt instruye además el mapeo de sinónimos de área ("fotos", "visión", "chatbots") al tema más cercano.

Resiliencia: timeout de 2,5 s por intento y reintento con un **modelo de fallback** (`gemini-2.0-flash-lite`), dado que las cuotas del nivel gratuito son por modelo. Si ambos fallan, la consulta completa pasa como texto semántico y la búsqueda continúa sin filtros extraídos: el NLP es un potenciador, nunca un punto único de falla.

Los filtros manuales del formulario siempre ganan sobre los extraídos (restricciones duras). En el frontend, una búsqueda con texto nuevo limpia los filtros previos antes de ejecutarse, evitando que la intención de una consulta anterior contamine la siguiente; reenviar el mismo texto conserva los ajustes manuales.

### 6.3 Búsqueda híbrida en PostgreSQL

La RPC `buscar_hibrido` ejecuta dos piernas con los filtros duros aplicados en ambas:

- **Vectorial**: similitud coseno (`1 - (embedding <=> consulta)`) sobre el índice HNSW, con doble corte:
  - piso absoluto `match_threshold = 0.82` (separa el dominio del ruido externo), y
  - **corte adaptativo** `adaptive_margin = 0.04`: solo pasan resultados a menos de 0,04 del mejor hit de *esa* consulta. Este corte relativo resuelve el problema de que, en un corpus homogéneo (todo es software de IA), un umbral absoluto no discrimina dentro del dominio. Medido en producción: la consulta *"software de procesamiento de imágenes"* pasó de devolver 9 resultados con cola irrelevante a 4 herramientas de visión.
- **Léxica**: `websearch_to_tsquery('spanish', ...)` contra la columna `fts`, rankeada con `ts_rank_cd` — aporta precisión léxica con stemming ("generadores" encuentra "generador").

Los dos rankings se fusionan con **Reciprocal Rank Fusion**: `score = 1/(50 + rank_vectorial) + 1/(50 + rank_léxico)`. Un resultado que rankea bien en ambas piernas supera a uno que solo destaca en una. Todos los parámetros (umbral, margen, k de RRF, límite) son argumentos de la RPC con defaults, ajustables por SQL sin redesplegar nada.

### 6.4 Indexado automático de embeddings

Un trigger `AFTER INSERT OR UPDATE` sobre `software` dispara, vía la extensión `pg_net` (HTTP asíncrono desde la base), una llamada a la Edge Function interna `embed`, que recalcula el embedding del registro (nombre + objetivo + descripción + nombre del tema) con `gte-small` y lo persiste con la service-role key. El índice semántico nunca queda desactualizado y no requiere intervención manual. Las URL y credenciales que usa el trigger se leen de **Vault** (almacén cifrado de Postgres); `embed` autentica a su llamador con un secreto pre-compartido (`x-embed-secret`) y rechaza cualquier otra invocación con 401.

### 6.5 Búsqueda por voz

`useVoz` envuelve la Web Speech API nativa (`SpeechRecognition`, idioma `es-AR`): la transcripción entra al mismo pipeline que el texto tipeado. La UI muestra un overlay modal centrado durante la escucha:

- **Escritorio**: visualización de ondas en `<canvas>` alimentada por la amplitud real del micrófono (`getUserMedia` + `AnalyserNode` + `requestAnimationFrame`).
- **Móvil (Android)**: el micrófono es de captura exclusiva — un segundo consumidor dejaría sordo al reconocedor. Se detecta el caso y las barras se animan con los **eventos de actividad de habla** del propio reconocedor (`soundstart`/`speechend`), que no tocan el stream de audio.

El botón de micrófono solo se muestra cuando el navegador soporta la API (detección de características, con aviso en caso contrario). Todos los recursos de audio (tracks, AudioContext, animación) se liberan en cada cierre del overlay.

---

## 7. Autenticación y seguridad

### 7.1 Métodos de acceso

- **Email y contraseña** con **confirmación de correo obligatoria**: el registro no crea sesión hasta que el usuario confirma desde el enlace recibido. El mensaje post-registro es neutro y no revela si una cuenta ya existía (mitigación de enumeración de usuarios).
- **Google OAuth** (`signInWithOAuth`): redirección completa a Google; la sesión retorna por URL y la captura el `AuthContext` vía `onAuthStateChange`. El cliente OAuth se configura en Google Cloud Console con redirect URI hacia el callback de Supabase.
- **Recuperación de contraseña**: modo dedicado en `/login` que envía el enlace (`resetPasswordForEmail`), y página `/restablecer` que consume la sesión temporal de recuperación y fija la nueva contraseña (`updateUser`). Enlaces vencidos o visitas directas reciben un aviso amable en lugar de un error.

### 7.2 Correo transaccional

El servicio de correo integrado de Supabase está limitado a desarrollo, por lo que el envío se delega por **SMTP propio a Brevo** (nivel gratuito, 300 correos/día) con remitente verificado. Las plantillas (confirmación y recuperación) están personalizadas en español. Los límites de tasa quedaron configurados en Supabase (30 correos/hora, intervalo mínimo de 60 s por usuario) y la UI traduce los códigos de error de límite a mensajes accionables.

### 7.3 Gestión de sesión en el frontend

`AuthProvider` hidrata la sesión de forma segura ante el doble montaje de StrictMode (suscripción a `onAuthStateChange` + `getSession()` de respaldo, con una única transición de `loading`). El usuario se deriva siempre de la sesión — una sola fuente de verdad. `RequireAuthProvider` implementa el gate de acciones: las funcionalidades de lectura son públicas y la sesión se exige recién al ejecutar acciones de escritura.

### 7.4 Superficies de confianza

| Componente | Credencial | Alcance |
|---|---|---|
| Frontend | anon key (pública) | Lectura del catálogo, RPC de búsqueda, auth |
| EF `buscar` | anon key + `GEMINI_API_KEY` | Pipeline de búsqueda; nunca posee la service-role key |
| EF `embed` | service-role key + secreto compartido | Única pieza con escritura privilegiada; invocable solo por el trigger |
| Trigger SQL | secretos en Vault | Sin credenciales hardcodeadas en migraciones |

---

## 8. Infraestructura y despliegue

- **Vercel** sirve el SPA con despliegue continuo desde `main`; un único rewrite (`/(.*) → /index.html`) habilita el routing del lado del cliente.
- **Supabase** aloja base, auth y las dos Edge Functions (desplegadas con `supabase functions deploy`).
- **Migraciones** versionadas en `db/*.sql` con prefijo de fecha y orden (`2026-06-12_001_...`), aplicadas sobre el proyecto productivo.
- **Calidad**: TypeScript estricto, ESLint (incluidas reglas de hooks de React) y build de verificación (`tsc -b && vite build`) antes de cada push. Convención de commits convencionales con alcance por módulo.

---

## 9. Decisiones de diseño relevantes

| Decisión | Alternativa descartada | Justificación |
|---|---|---|
| Búsqueda híbrida (vector + FTS + RRF) | Solo vectorial o solo léxica | La pierna semántica entiende sinónimos pero es difusa; la léxica es precisa pero literal. La fusión RRF toma lo mejor de ambas. |
| Corte adaptativo relativo al mejor hit | Subir el umbral absoluto | En un corpus homogéneo el umbral absoluto no separa relevante de "mismo rubro"; la distancia al techo de cada consulta sí. |
| Gemini devuelve `tema_nombre` de un enum | Gemini devuelve `tema_id` | Elimina por diseño la alucinación de UUIDs; el mapeo a id ocurre en el servidor contra datos reales. |
| Dos Edge Functions separadas | Una función con parámetro de modo | Superficies de autenticación distintas: `buscar` es pública y jamás debe poseer la service-role key que `embed` necesita. |
| `gte-small` local en Supabase | API de embeddings externa | Latencia ~50 ms, costo cero y sin nueva dependencia externa; la calidad para el corpus en español se validó empíricamente y se compensó con el umbral ajustado. |
| SMTP propio (Brevo) + lógica de Supabase Auth | Backend propio de verificación de correo | La lógica de tokens de verificación es código de seguridad ya resuelto y auditado; el único cuello de botella era el envío, que es configuración. |
| Valoraciones polimórficas en una tabla | Una tabla de votos por tipo de contenido | Un solo componente `StarRating` y un solo servicio cubren los tres tipos de contenido. |
| Tipos generados desde el esquema | Tipos TypeScript manuales | El esquema real es la única fuente de verdad; elimina la deriva entre base y frontend. |

---

## 10. Limitaciones conocidas

- **Cuotas del nivel gratuito de Gemini**: la extracción de intención puede fallar de forma intermitente (límites por minuto y por día). Mitigado con el modelo de fallback y la degradación a búsqueda semántica pura; la solución definitiva es un plan pago.
- **Remitente de correo @gmail.com**: sin dominio propio, algún correo puede caer en spam. Tolerable para el volumen del proyecto; la solución es un dominio autenticado.
- **`gte-small` es un modelo centrado en inglés**: las similitudes en español se concentran en un rango alto, lo que motivó el umbral 0,82 y el corte adaptativo. Un modelo multilingüe mejoraría la separación a costa de abandonar la inferencia local gratuita.
- **Búsqueda por voz solo en navegadores con Web Speech API** (Chrome/Edge); en el resto se informa la limitación y la búsqueda por texto cubre la funcionalidad.
- **Reconocimiento de lenguaje de señas**: fuera del alcance implementado; el enfoque técnico (MediaPipe + TensorFlow.js) queda documentado como extensión futura.

---

## 11. Trazabilidad con el PRD

| Ítem PRD | Estado | Evidencia |
|---|---|---|
| 1 — Catálogo navegable ≥50% del temario, con nombre, objetivo, enlace, licencia, año y autor | ✅ | 7 temas (~58% del temario); ficha completa en `/software/:id` |
| 2 — Descripción breve y video por software | ✅ | `descripcion_corta` + `VideoEmbed` (YouTube) |
| 3 — Búsqueda por texto, tema, licencia y año | ✅ | `/buscar` multicriterio (ampliada con ranking semántico) |
| 4 — Búsqueda por voz | ✅ | Web Speech API es-AR con overlay de actividad; señas documentado fuera de alcance |
| 5a — Clasificaciones de SI con imagen, descripción, ejemplos y enlaces | ✅ | `/clasificaciones` y detalle |
| 5b — Valoraciones 1–5 | ✅ | `StarRating` polimórfico en software, temas y clasificaciones |
| 5c — Foro | ✅ | Hilos, respuestas y borrado del autor con RLS |
| 5d — Estadísticas y recomendaciones | ✅ | Rankings de vistas y valoraciones; recomendaciones por tema |
| Extra — Búsqueda semántica híbrida con NLP | ✅ | pgvector + FTS + RRF + Gemini (no requerido por el PRD) |
| Extra — Autenticación completa | ✅ | Google OAuth, confirmación de correo y recuperación de contraseña vía SMTP propio |
