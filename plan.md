# Plan de mejoras ia-dex

Análisis e implementación de las 5 mejoras propuestas. Cada sección incluye: análisis del estado actual,
decisiones de diseño, pasos de implementación, archivos afectados y riesgos.

**Orden recomendado de implementación**: 1 → 2 → 5 → 4 → 3.
El seed (1) alimenta todo lo demás; relacionados (2) depende de que los embeddings del nuevo corpus existan;
el rol admin (5) crea infraestructura (perfiles/RLS) que no existe hoy; el roadmap (4) es mayormente frontend;
el asistente (3) es el más complejo y reutiliza piezas de 1 y 2.

> **Estado de revisión (verificado contra el código):** el plan es sólido — casi todas las afirmaciones de
> "Estado actual" dan exactas. Antes de implementar, atender los puntos marcados **LANDMINE / (verificado) /
> (corrección)** en las mejoras 1, 3 y 5, los **gaps transversales** del final (testing, rollback,
> observabilidad) y la **deuda del código ya mergeado**. El orden 5 → 4 ya secuencia bien `AuthContext`.

---

## 1. Nuevo seed: SI y software con material conocido en la cultura hispana

### Estado actual
- Pipeline existente e idempotente: `db/seed-content.json` (7 temas, 9 clasificaciones_si, 23 software)
  → `node db/seed-to-sql.mjs` → `db/seed.sql` (inserts con guarda `where not exists`).
- Los 23 software tienen `video_url`, **todos videos en inglés** (ej. Stockfish → video en inglés).
- El trigger `software_embed_trigger` re-embebe automáticamente cualquier fila insertada o cuyo
  `nombre/objetivo/descripcion_corta/tema_id` cambie — el nuevo seed se indexa solo, sin pasos extra.

### Diseño
- **Mantener** la estructura académica (temas y clasificaciones_si): es el esqueleto del sitio y del roadmap (punto 4).
- **Curar el contenido de software**: reemplazar videos por equivalentes en español (canales como Dot CSV,
  Platzi, codigofacilito, NateGentile, universidades hispanas) y priorizar herramientas con presencia real
  en la comunidad hispana (ChatGPT, Gemini, Copilot, Canva Magic Studio, HeyGen, ElevenLabs, Suno, Perplexity,
  Midjourney/Leonardo, NotebookLM, Whisper, etc.), manteniendo cobertura de los 7 temas.
- **Problema de idempotencia**: la guarda actual `where not exists (nombre)` no actualiza filas existentes.
  Para poder corregir contenido ya sembrado, agregar columna `slug text unique` a `software` y cambiar el
  generador a `insert ... on conflict (slug) do update set ...`.

### Pasos
1. Migración `db/2026-06-XX_software_slug.sql`, en **orden estricto** para evitar colisiones:
   (a) `alter table software add column slug text;` (nullable);
   (b) backfill con la **misma** función de slugificación que emite el generador — **fuente única de verdad**:
       definir el `slug` en `seed-content.json`, o derivarlo idéntico en la migración y en `seed-to-sql.mjs`
       (cuidar acentos y nombres como "Gymnasium (ex OpenAI Gym)" / "YOLO (Ultralytics)");
   (c) recién entonces `add constraint software_slug_key unique (slug)` y `not null`.
   Antes de cambiar el guard a `on conflict (slug)`, verificar que los slugs backfilleados de las 23 filas
   coinciden **exactamente** con los que emite el generador. Si difieren, el `on conflict` no matchea e intenta
   INSERTs duplicados que abortan contra el UNIQUE. (Hoy `software` keya por `nombre`, no tiene `slug`.)
2. Reescribir `db/seed-content.json`: por cada software, `video_url` en español verificado (existencia y
   embebible), descripciones en español neutro, y ampliar el corpus (~35–40 entradas) con herramientas
   conocidas en la cultura hispana. Mantener campos: `tema_slug`, `clasificacion_slug`, `nombre`, `objetivo`,
   `descripcion_corta`, `url_acceso`, `licencia`, `anio_lanzamiento`, `autor_referencia`, `video_url`, `imagen_url`.
3. Actualizar `db/seed-to-sql.mjs` a upsert por slug; regenerar `db/seed.sql`; aplicar.
4. Verificar re-embedding: `select count(*) from software where embedding is null` debe llegar a 0
   (el trigger dispara las llamadas async a la EF `embed`).
5. **Re-validar la calibración de búsqueda**: `match_threshold = 0.82` y `adaptive_margin = 0.04` fueron
   ajustados empíricamente sobre las 23 filas originales. Con un corpus mayor, repetir las pruebas de
   consultas relevantes/irrelevantes y re-ajustar.
   **Corrección (verificado):** hoy `match_threshold` está **hardcodeado** en la EF
   (`supabase/functions/buscar/index.ts:258`) y pisa el default de la RPC en cada llamada → cambiar el default
   en la DB **no tiene efecto sin redeployar la EF**. Solo `adaptive_margin` (que la EF nunca pasa) viaja con
   el default de la base. **Prerrequisito de este paso:** sacar el literal del `index.ts` (o leerlo de un env
   var) para que el tuning sea realmente sin redeploy.

### Archivos
`db/seed-content.json`, `db/seed-to-sql.mjs`, `db/seed.sql`, nueva migración SQL.

### Riesgos
- Videos de YouTube pueden tener embed deshabilitado → verificar cada uno con la página de detalle.
- Crecer el corpus desplaza el "techo de ruido" del umbral vectorial → mitigado en paso 5.

---

## 2. Mejorar diseño + apartado de "Relacionados" en cada software

### Estado actual
- `SoftwareDetallePage` ya muestra una sección "Recomendaciones" (`useRecomendaciones`): software del
  **mismo tema** ordenado por popularidad — no es relación semántica, y nunca cruza temas.
- La columna `embedding vector(384)` ya existe y está poblada: relacionados semánticos salen "gratis".

### Diseño
- **Nueva RPC `software_relacionados(p_software_id uuid, p_limit int default 5)`**: ordena el resto del
  catálogo por similitud de coseno contra el embedding de la fila dada (`order by embedding <=> (select
  embedding from software where id = p_software_id)`), excluye la propia fila y filas sin embedding,
  `security invoker`, retorna las mismas columnas que `buscar_hibrido` (sin `embedding`/`fts`).
- **Fallback**: si la fila aún no tiene embedding (ventana async del trigger), caer a la consulta por
  tema actual (`useRecomendaciones` ya la implementa).
- **UI**: reemplazar/renombrar la sección "Recomendaciones" por "Relacionados" usando la RPC semántica;
  conservar "Populares del tema" como sección secundaria opcional.
- **Mejoras de diseño** (alcance acotado, mismo lenguaje visual):
  - Chips clicables de tema y clasificación en la ficha (hoy no se muestra a qué tema pertenece).
  - Cards de relacionados con motivo de relación ("Mismo tema" / "Similar").
  - Breadcrumb `Catálogo → Tema → Software` en vez del back-link plano.

### Pasos
1. Migración con la RPC `software_relacionados` + grant a `anon, authenticated`.
2. `softwareService.relacionados(id)` + hook `useRelacionados(id)` (patrón reducer D1 existente).
3. Integrar sección en `SoftwareDetallePage` con fallback a `useRecomendaciones`.
4. Chips de tema/clasificación + breadcrumb. Software lleva `tema_id`/`clasificacion_si_id` (UUID), no slug:
   **no hace falta servicio nuevo** — resolver el nombre client-side con `useTemas()` (7 filas) y
   `useClasificaciones()` (9 filas) + `.find()`.
5. Regenerar `database.types.ts`.

### Archivos
Nueva migración SQL, `src/services/softwareService.ts`, `src/hooks/useRelacionados.ts` (nuevo),
`src/pages/SoftwareDetallePage.tsx`, `src/components/software/SoftwareCard.tsx`, `src/types/database.types.ts`.

### Riesgos
- Con corpus pequeño todo es "algo similar" → aplicar el mismo patrón de corte adaptativo de
  `buscar_hibrido` (margen sobre la mejor similitud) dentro de la RPC. Excluir la **propia fila antes** de
  calcular `best_similarity`, y si la RPC vuelve vacía caer a `useRecomendaciones`. Usar `<=>` con la opclass
  `vector_cosine_ops` ya configurada (mismo operador que `buscar_hibrido`).

---

## 3. Asistente virtual con voz (RAG sobre la base de datos)

### Estado actual
- STT ya resuelto: `useVoz` (Web Speech API SpeechRecognition, es).
- Retrieval ya resuelto: RPC `buscar_hibrido` (vector + FTS + filtros).
- Generación: patrón Gemini con modelo fallback y timeout ya probado en la EF `buscar`.
- Falta: TTS (salida por voz), una EF de generación **conversacional** con contexto, y el **globo
  flotante** UI.

### Diseño
- **Nueva Edge Function `asistente`** (pública, CORS **acotado a orígenes conocidos**, no wildcard), un solo
  endpoint **conversacional** (sin modos):
  1. Request: `{ pregunta: string, historial?: { rol, texto }[], contexto: { ruta: string, tema_id?: string,
     software_id?: string, clasificacion_id?: string } }`. El `historial` son las últimas 2-3 vueltas.
  2. **Grounding por contexto (siempre):** si `contexto` trae una entidad, traer esa ficha **directo por id**
     e incluirla como contexto primario — así la pregunta queda **anclada a la página actual**. ("Resumime
     esta página" es solo una pregunta cuya respuesta ya está toda en ese contexto, sin caso especial.)
  3. **Retrieval (se ensancha al catálogo):** embeber `pregunta` con `gte-small` (la EF llama a `embed`, igual
     que `buscar`) y pasar el `vector(384)` a `buscar_hibrido` (que **ya acepta `query_embedding` precomputado**,
     verificado) con `match_limit = 5`. Así, si la respuesta no está en la página, trae lo relevante de todo
     ia-dex (ej. alternativas a la herramienta de la ficha).
  4. **Resolver `tema_id` → nombre antes del prompt**: `buscar_hibrido` devuelve `tema_id` (UUID), no el
     nombre. Resolver con un lookup cacheable de `temas` para no pasarle UUIDs crudos a Gemini.
  5. **Augmented generation**: prompt a Gemini Flash-Lite con el fallback de modelo ya usado en `buscar`:
     "Eres el asistente de ia-dex. Prioriza la ficha de esta página; si la respuesta no está ahí, usa los
     resultados relacionados. Si no está en ningún contexto, dilo. Español, 2-4 frases para leer en voz alta."
     + ficha de contexto + fichas recuperadas (nombre, objetivo, descripción, **tema por nombre**, licencia,
     año) + `historial` corto para resolver referencias ("ese", "el segundo").
  6. Response: `{ respuesta: string, fuentes: { id, nombre }[] }` — fuentes como links.
  7. Degradación: si Gemini falla en ambos modelos → devolver las fuentes con un mensaje fijo, nunca error duro.
- **Cuota separada (decisión):** el asistente usa su **propia** `GEMINI_API_KEY_ASISTENTE`, distinta de la de
  `buscar`. Así el abuso del endpoint público no puede **drenar la cuota de la búsqueda ya en producción**
  (eso sería una regresión, no solo costo).
- **Rate-limit real (obligatorio antes de publicar):** token bucket por IP/sesión (contador en Postgres o
  Upstash) en `asistente` **y** retrofit en `buscar`; cap de longitud de `pregunta` **enforced en código**
  (no solo como nota de riesgo); `max_output_tokens` bajo.
- **Observabilidad:** logging estructurado de requests + hook de alerta de errores en ambas EF (hoy `buscar`
  solo tiene `console.error`), para detectar abuso/agotamiento de cuota antes de que degrade la búsqueda.
- **TTS en el cliente**: `speechSynthesis.speak(new SpeechSynthesisUtterance(respuesta))` con voz `es-*`
  (gratis, sin backend, sin cuota). Hook nuevo `useTTS` con `hablar/detener/soportado` y toggle de silencio
  en `localStorage`. **Siempre** mostrar texto además de la voz.
- **Globo flotante "Gemini" (UI):** botón flotante con **ícono de Gemini**, montado en `AppLayout` →
  **presente en todas las páginas**. **Tocarlo abre el panel de chat** (no dispara nada por sí solo: sin
  resumen automático ni botón dedicado). Dentro:
  - **Chat conversacional:** input de **texto** (principal) + **micrófono (`useVoz`)**; cada respuesta llega
    **escrita** + hablada (`useTTS`) + fuentes clicables. Memoria corta de **2-3 vueltas** (`useAsistente`),
    cada pregunta re-busca.
  - **Resumen = mensaje, no función aparte:** un **prompt sugerido** ("Resumime esta página") que pre-llena el
    input; si el usuario lo quiere, lo manda y listo. Reusa el grounding por contexto del endpoint.
  - **Micrófono → input:** la voz **transcribe al campo de texto** para revisar/editar antes de enviar (la Web
    Speech API a veces transcribe cualquier cosa; auto-enviar quemaría cuota con ruido). Manos-libres
    (auto-enviar al silencio) queda como toggle futuro.
  - **Un solo `SpeechRecognition` activo a la vez:** guardar que el micrófono del globo y el de `BuscarPage`
    no escuchen simultáneamente (la Web Speech API es efectivamente singleton).

### Pasos
1. Secret: crear `GEMINI_API_KEY_ASISTENTE` en Supabase. EF `supabase/functions/asistente/index.ts`
   (grounding por contexto + retrieval + resolución `tema_id`→nombre + Gemini + degradación + cap de input).
   Rate-limit en `asistente` y retrofit en `buscar`. CORS acotado. Desplegar y probar con curl.
2. `src/services/asistenteService.ts` (invoke con timeout 10 s) + tipos en `dtos.ts` (`pregunta`, `historial`,
   `contexto`).
3. `src/hooks/useTTS.ts` y `src/hooks/useAsistente.ts` (estado del chat + memoria de 2-3 vueltas).
4. `src/components/asistente/AsistenteWidget.tsx` (globo + ícono Gemini) montado en `AppLayout`; derivar
   `contexto` de la ruta/params; chat con texto + voz + prompt sugerido "Resumime esta página".
5. Pruebas manuales: pregunta contextual (anclada a la ficha), pregunta que se ensancha al catálogo,
   referencia entre vueltas ("ese, ¿es pago?"), Gemini caído (degradación), navegador sin TTS (solo texto),
   rate-limit (loop rechazado), micrófono que no colisiona con el de `BuscarPage`.

### Archivos
`supabase/functions/asistente/` (nuevo), `supabase/functions/buscar/index.ts` (rate-limit + CORS),
`src/services/asistenteService.ts` (nuevo), `src/hooks/useTTS.ts` y `useAsistente.ts` (nuevos),
`src/components/asistente/` (nuevo: `AsistenteWidget`), `src/components/layout/AppLayout.tsx`,
`src/types/dtos.ts`. Secret nuevo: `GEMINI_API_KEY_ASISTENTE`.

### Riesgos
- Cuota de Gemini → **mitigado con API key propia** (`GEMINI_API_KEY_ASISTENTE`) + doble modelo + degradación.
- Abuso de la EF pública → **rate-limit real + cap de input enforced + CORS acotado + observabilidad**
  (no alcanza con `max_output_tokens` bajo: eso limita el costo por llamada, no el volumen).
- Calidad de voces TTS varía por navegador → seleccionar la mejor voz `es-*` disponible; siempre mostrar texto.
- Costo de la conversación → mitigado: el `historial` se acota a 2-3 vueltas (mandar todo el chat en cada
  turno infla los tokens). El resumen ya no se auto-dispara: es un mensaje opcional del usuario.

---

## 4. Roadmap "Aprender Inteligencia Artificial" con el contenido de la BD

### Estado actual
- `temas.orden` (1–7) ya codifica una progresión pedagógica: búsqueda y resolución de problemas →
  representación del conocimiento → aprendizaje automático → … Es la columna vertebral del roadmap.
- `clasificaciones_si` sirve como módulo introductorio ("¿qué es un sistema inteligente?").
- `v_software_rating` permite destacar el software mejor valorado de cada etapa (la vista **no** trae
  `tema_id`: el "top por tema" necesita un JOIN explícito a `software`).

### Diseño
- **Página `/roadmap`**: línea de tiempo vertical. Etapa 0 = introducción (clasificaciones SI);
  etapas 1..7 = temas en `orden`. Cada nodo: nombre, descripción del tema, 2-3 software destacados
  (mejor valorados del tema vía `v_software_rating`, fallback alfabético), links a `TemaPage` y fichas.
- **Progreso del usuario**: tabla `progreso_roadmap (user_id uuid refs auth.users on delete cascade,
  tema_id uuid refs temas on delete cascade, completado_at timestamptz, pk (user_id, tema_id))`.
  **RLS enumerada** (no alcanza con "cada usuario sus filas"): `enable row level security` +
  `select using (auth.uid() = user_id)` + `insert with check (auth.uid() = user_id)` +
  `delete using (auth.uid() = user_id)` + **`update` (using + with check = auth.uid() = user_id)** — porque
  la PK fuerza upsert al re-completar y, sin policy de UPDATE, RLS lo rechaza en silencio (alternativa:
  modelar "completar" como delete+insert y omitir UPDATE). El `with check` en INSERT evita que un usuario
  inserte filas con `user_id` ajeno. Para visitantes anónimos, espejo en `localStorage` (se migra a la tabla
  al iniciar sesión). Barra de progreso global ("3 de 7 etapas completadas") y check por etapa.
- Sin contenido nuevo que mantener: el roadmap **se alimenta 100 % de la BD existente**, por lo que el
  nuevo seed (punto 1) lo mejora automáticamente.

### Pasos
1. Migración: tabla `progreso_roadmap` + **las políticas RLS enumeradas** (incluyendo UPDATE) +
   `on delete cascade` en ambas FKs.
2. `roadmapService.ts`: temas ordenados + top software por tema (**JOIN `v_software_rating` ↔ `software`
   por `tema_id`**, fallback alfabético) + CRUD de progreso.
3. Hook `useRoadmap` (combina temas, destacados y progreso; localStorage para anónimos). La migración
   localStorage→tabla se dispara **solo en el evento `SIGNED_IN`** (no en cada refresh de token) y usa
   `on conflict (user_id, tema_id) do nothing`.
4. `RoadmapPage.tsx` + entrada en `navLinks.ts` / `Sidebar` / `MobileNav` / `AppRouter`.
5. Regenerar `database.types.ts`.

### Archivos
Nueva migración SQL, `src/services/roadmapService.ts` (nuevo), `src/hooks/useRoadmap.ts` (nuevo),
`src/pages/RoadmapPage.tsx` (nuevo), `src/routes/AppRouter.tsx`, `src/components/layout/navLinks.ts`,
`src/types/database.types.ts`. La migración localStorage→tabla engancha en el `onAuthStateChange` de
`AuthContext` (que la mejora 5 también toca → **secuenciar 5 antes que 4**; `navLinks.ts` también lo tocan
ambas → merge trivial).

### Riesgos
- Bajo. Lo sensible: la migración localStorage→tabla al loguearse (idempotente con `on conflict do nothing`,
  atada solo a `SIGNED_IN`) y la policy de UPDATE faltante (fácil de pasar por alto, rompe el upsert).

---

## 5. Rol admin: gestión de contenido (con base preparada para crecer)

Decisión de alcance tras revisión: en esta app el **único privilegio** es gestionar contenido
(crear/editar/eliminar software y clasificaciones SI). Por eso arrancamos con **un solo rol `admin` =
gestor de contenido**, sembrado desde el dashboard de Supabase. El esquema se deja **preparado** para,
en el futuro y sin reescrituras, sumar un panel de auto-asignación de rol y/o un split `editor`/`owner`
(ver "Fase 2 — diferido"). No se incluye log de auditoría (descartado por ahora).

### Estado actual
- **No existe sistema de roles**: `AuthContext` solo expone `user/session/loading/signOut`; no hay tabla
  `profiles` ni claim de rol. Esto es prerrequisito de todo el punto.
- Escrituras sobre `software`/`clasificaciones_si`/`temas` no están expuestas en la UI (solo seed/SQL).
- Sinergia clave: crear o editar texto de un software dispara el trigger de re-embedding automáticamente —
  la búsqueda semántica se mantiene fresca sin trabajo extra.

### Diseño (Fase 1 — lo que se construye ahora)
- **Base de roles, preparada para crecer**:
  - Tabla `profiles (id uuid pk refs auth.users on delete cascade, role text not null default 'user'
    check (role in ('user','admin')), created_at)`. Se usa `text` + `check` (NO un `enum` de Postgres):
    agregar `editor`/`owner` después es un `alter ... drop/add constraint` de una línea, sin migrar datos.
  - **Trigger de alta blindado** (footgun #1 de Supabase): el trigger `on auth.users insert` corre **dentro
    de la transacción de signup de GoTrue** — si falla, **rompe TODOS los registros nuevos con un 500**.
    Definirlo `security definer set search_path = public` con un bloque `exception when others then return new`
    (espejar el patrón ya usado en `trigger_embed_on_software_change`, `db/2026-06-12_003_review_fixes.sql`).
  - **Backfill obligatorio en la misma migración**: el auth ya está mergeado en esta rama → **ya hay usuarios
    en `auth.users` sin fila en `profiles`**. `insert into public.profiles (id) select id from auth.users
    on conflict (id) do nothing;`.
  - **Capacidad vía función, no vía literal**: las políticas RLS de contenido apuntan a
    `public.puede_gestionar_contenido()`, NO a `role = 'admin'` embebido en cada policy. Así, el día que se
    pase a `editor`/`owner`, se redefine **esa única función** y **ninguna política se toca** (lo que mantiene
    abierta la Fase 2). Definición **blindada** (el `search_path` pineado es obligatorio — sin él es un vector
    de escalación; el equipo ya lo aplica en `003_review_fixes.sql`): `create function
    public.puede_gestionar_contenido() returns boolean language sql stable security definer set search_path =
    public as $$ select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') $$;`.
    El `exists` hace que una fila faltante sea determinísticamente `false`.
  - **RLS de escritura + lectura pública explícita (LANDMINE):** verificado que en `db/*.sql` **no hay
    `enable row level security` ni una sola policy** — el schema base y el RLS viven fuera del repo
    (dashboard/Management API), con el patrón Supabase habitual de **RLS deshabilitado + acceso anon por
    GRANT**. El instante en que hacés `enable row level security` para gatear escrituras, la tabla pasa a
    **default-deny también para SELECT** → **el catálogo público deja de devolver filas**. Por eso, en la
    **misma** migración: `enable row level security` + `policy ... for select to anon, authenticated using
    (true)` para `software` Y `clasificaciones_si` + las de escritura `insert/update/delete ... using
    (public.puede_gestionar_contenido()) with check (...)`. **Prerrequisito:** dumpear y commitear el schema +
    estado de RLS vivo antes de tocar nada. **La seguridad real vive en RLS; los iconos del frontend son solo UX.**
  - **Alta de admins**: desde el dashboard de Supabase (tabla `profiles` → `role='admin'`). Es una UI,
    no SQL crudo, y se hace una o dos veces en la vida del proyecto. Delegar a otra persona = darle admin;
    es sano porque el único poder de un admin es gestionar contenido.
- **Crear contenido (alta)**:
  - Las mismas políticas cubren el `insert` — cero infraestructura extra.
  - Software: el formulario incluye selectores de `tema_id` y `clasificacion_si_id` (`useTemas`/
    `useClasificaciones` ya existen) y genera el `slug` (columna del punto 1). El trigger embebe la fila nueva.
  - Clasificación SI: alta más simple (sin embedding).
  - El `SoftwareFormModal` sirve para crear y editar según reciba o no un `id` (un solo componente).
- **Autoría del contenido (nuevo):** columna `created_by uuid references public.profiles(id) on delete set
  null default auth.uid()` en `software` **y** `clasificaciones_si`. Se setea sola en el `insert` del cliente
  (default `auth.uid()`); el seed/SQL directo la deja `null` (= "contenido del sistema"). Hoy se **persiste el
  `uuid`**; mostrar el **nombre** del autor en la ficha es Fase 2 (necesita la RPC admin-only de lookup que ya
  prevé el plan — `auth.users` no se expone al cliente). `on delete set null` conserva la atribución aunque se
  borre el usuario. Deja el terreno listo para cuando haya varios gestores: se sabrá **quién creó qué**.
- **Borrado seguro**: `eventos.software_id` **ya tiene FK** con on-delete probablemente `NO ACTION` → hoy
  **bloquea** borrar un software con eventos. Hay que **ALTERarla** (drop + add `on delete set null`), no
  "definirla". La limpieza de `valoraciones` (polimórfica, sin FK) va por un **trigger `before delete on
  software/clasificaciones_si` `security definer` (search_path pineado)** que borra por
  `contenido_tipo + contenido_id` — **no** del lado del cliente: un usuario normal no tiene grant para borrar
  valoraciones ajenas y quedarían huérfanas que corrompen `v_software_rating`.
- **Frontend**:
  - `useIsAdmin()`: lee el perfil propio una vez por sesión (extensión de `AuthContext` con `role`).
  - Iconos lápiz/papelera/＋ visibles solo si admin: en `SoftwareCard` (esquina, `stopPropagation` para
    no navegar), `SoftwareDetallePage`, y cards/detalle de clasificaciones SI.
  - Editar/crear: `SoftwareFormModal` (reutiliza `src/components/ui/Modal.tsx`); al guardar, `insert`/
    `update` directo vía supabase-js (RLS valida) y refetch.
  - Eliminar: modal de confirmación con el nombre del ítem ("Esta acción no se puede deshacer").
- **Servicios**: `softwareService.crear/actualizar/eliminar`,
  `clasificacionesService.crear/actualizar/eliminar`.

### Fase 2 — diferido (opcional, baja prioridad)
Construir solo si delegar se vuelve frecuente y molesta entrar al dashboard. El esquema ya queda listo:
- **Panel de auto-asignación de rol** en una ruta `/admin`: promover por email vía RPC
  `set_user_role(target_user, nuevo_role)` (`security definer`, verifica capacidad del llamante, valida
  el rol y **prohíbe degradar al último admin**) + RPC admin-only `buscar_usuario_por_email`
  (no se expone `auth.users` al cliente). El `role` nunca es editable directo por el cliente — solo por RPC.
- **Split `editor`/`owner`**: si se quiere delegar contenido SIN dar el poder de crear más admins.
  Migración: agregar valores al `check`, redefinir `puede_gestionar_contenido()` (= editor ∨ owner) y
  gatear la asignación de rol a `owner`. Las políticas de contenido no cambian.

### Pasos (Fase 1)
0. **Prerrequisito:** dumpear y commitear el schema + RLS vivo (hoy fuera del repo) + snapshot/backup de la DB
   antes de la migración destructiva.
1. Migración: `profiles` (trigger de alta **blindado** + **backfill** de `auth.users`) +
   `puede_gestionar_contenido()` (`search_path` pineado) + **`enable row level security` y policy `select
   using (true)` para `anon, authenticated`** en `software` y `clasificaciones_si` + policies de escritura
   `using (puede_gestionar_contenido())` + columna `created_by` en ambas tablas + **ALTER** de la FK de
   `eventos` a `on delete set null` + trigger de limpieza de `valoraciones`.
2. Promover admin inicial desde el dashboard de Supabase; regenerar `database.types.ts`.
3. Extender `AuthContext`/`useAuth` con `role` y crear `useIsAdmin`.
4. Métodos de escritura en servicios.
5. UI: iconos condicionales + `SoftwareFormModal` (crear/editar) + `ConfirmDeleteModal` en cards y detalles.
6. Pruebas (**ver harness pgTAP en la sección de gaps**): **lecturas anónimas siguen devolviendo filas**
   (catálogo, detalle, `buscar_hibrido`); usuario normal no ve iconos y RLS rechaza escrituras directas con
   anon key; admin crea/edita (verificar re-embedding y `created_by`) y elimina (verificar limpieza de
   valoraciones/eventos).

### Archivos (Fase 1)
Nueva migración SQL, `src/context/AuthContext.tsx`, `src/context/auth-context-value.ts`,
`src/hooks/useIsAdmin.ts` (nuevo), `src/services/softwareService.ts`, `src/services/clasificacionesService.ts`,
`src/components/software/SoftwareCard.tsx`, `src/pages/SoftwareDetallePage.tsx`,
`src/pages/ClasificacionesPage.tsx`, `src/pages/ClasificacionDetallePage.tsx`,
`src/components/admin/` (modal de contenido + confirmación), `src/types/database.types.ts`, `src/types/dtos.ts`.

### Riesgos
- **(ALTO) Caída del sitio público** al habilitar RLS sin policy de SELECT explícita — mitigado: `enable row
  level security` + `select using (true)` para `anon, authenticated` en la misma migración, y test de lectura
  anónima en el paso 6.
- **(ALTO) Romper los signups** con un trigger de `profiles` que falle — mitigado: `security definer` +
  `search_path` pineado + bloque `exception` + backfill de usuarios existentes.
- Confiar en el frontend para autorización — mitigado haciendo RLS (vía `puede_gestionar_contenido()` con
  `search_path` pineado) la única barrera real; el cliente **nunca** escribe `role` (solo por RPC en Fase 2).
- Borrar un software con valoraciones/eventos huérfanos — mitigado con el ALTER de la FK de `eventos` y el
  trigger `security definer` de limpieza de `valoraciones` del paso 1.
- (Fase 2) Escalación de privilegios al sumar el panel de roles — mitigado porque el `role` no es editable
  por el cliente y el cambio pasa solo por la RPC `set_user_role` con verificación de capacidad y
  protección del último admin.
- Exposición del padrón de usuarios — mitigada porque la búsqueda por email es una RPC admin-only (y devuelve
  un resultado indistinguible entre "no existe" y "no permitido" para evitar enumeración).

---

## Gaps transversales (aplican a todas las mejoras)

- **Testing automatizado (hoy: cero).** No hay test runner en `package.json` ni un solo `*.test.*` — solo
  eslint + tsc. Validar policies de RLS críticas para seguridad con "pruebas manuales" es frágil. Mínimo: un
  harness **pgTAP** (o `supabase db test`) que afirme que `anon` y un usuario normal son **rechazados** en
  `insert/update/delete` sobre `software` y `clasificaciones_si`, que un admin es **aceptado**, y que las
  **lecturas anónimas siguen pasando** tras habilitar RLS. Más un smoke test de la degradación del asistente.
- **Rollback / down-migrations / backup.** Migraciones SQL forward-only aplicadas a mano (no hay
  `supabase/migrations/` ni down-migrations). El plan agrega DDL **destructiva** (ALTER de FK, DELETE de
  `valoraciones`, habilitación de RLS). Por cada migración destructiva: snapshot/backup previo, reversa manual
  documentada y aplicar primero en staging. "Rollback documentado" = criterio de aceptación.
- **Observabilidad + rate-limit de las EF públicas.** Acoplado a la mejora 3: logging estructurado, alerta de
  errores y CORS acotado en `buscar` y `asistente`. Sin esto, el abuso que drena cuota es invisible hasta que
  la búsqueda se degrada.
- **`database.types.ts` ya está desfasado.** Le falta el parámetro `adaptive_margin` de la migración 004. El
  script `gen:types` **existe** (`package.json`): regenerar **ahora**, antes de construir RPCs nuevas encima.
  Cada mejora que toca el schema regenera y commitea los types.
- **PII / retención + a11y.** `progreso_roadmap.user_id` con `on delete cascade`; la RPC
  `buscar_usuario_por_email` (Fase 2) con resultado indistinguible "no existe" vs "no permitido". i18n:
  **español-only** explícito. A11y del globo: `aria-live="polite"` para la respuesta + camino solo-teclado
  (los modales ya heredan focus-trap/Esc de `Modal.tsx`).

## Deuda en el código ya mergeado (auth/voz de esta rama — independiente de las 5 mejoras)

- **`RestablecerPage` no distingue sesión de recuperación de sesión normal** (`RestablecerPage.tsx:105` gatea
  el form solo por `session !== null`; `AuthContext.tsx:26` descarta el `_event`). `/restablecer` es ruta
  pública sin guard → **cualquier usuario logueado que entre puede cambiar su contraseña fuera del flujo de
  recuperación**. Fix: suscribir `onAuthStateChange` y mostrar el form solo con el evento `PASSWORD_RECOVERY`
  (propagarlo por `AuthContext`).
- **`match_threshold` hardcodeado** en `buscar/index.ts:258` (ver mejora 1, paso 5).
- **Defaults implícitos de supabase-js** (PKCE, `detectSessionInUrl`, `persistSession`) nunca seteados en
  `createClient` (`src/lib/supabase.ts:11`): OAuth/recovery andan hoy por los defaults; pinearlos para que un
  major de supabase-js no rompa el login de Google en silencio.

## Resumen de dependencias

| # | Mejora | Depende de | Infra nueva |
|---|--------|-----------|-------------|
| 1 | Seed hispano | — | Columna `slug` en software (+ sacar el literal de threshold de la EF) |
| 2 | Relacionados + diseño | Embeddings del corpus (1) | RPC `software_relacionados` |
| 5 | Admin + autoría | — | `profiles` (text+check), `puede_gestionar_contenido()` (search_path pineado), **RLS habilitado + SELECT público explícito**, columna `created_by`, ALTER FK `eventos`, trigger limpieza `valoraciones`. Fase 2: RPC `set_user_role` + ruta `/admin` |
| 4 | Roadmap | Seed (1) + **`AuthContext` de (5)** | Tabla `progreso_roadmap` + RLS enumerada (con UPDATE) |
| 3 | Asistente RAG + globo Gemini | Embeddings (1); reutiliza `buscar` | EF `asistente` (conversacional), `useTTS`, globo en `AppLayout`, **`GEMINI_API_KEY_ASISTENTE`**, rate-limit |
