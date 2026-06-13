# Plan de mejoras ia-dex

Análisis e implementación de las 5 mejoras propuestas. Cada sección incluye: análisis del estado actual,
decisiones de diseño, pasos de implementación, archivos afectados y riesgos.

**Orden recomendado de implementación**: 1 → 2 → 5 → 4 → 3.
El seed (1) alimenta todo lo demás; relacionados (2) depende de que los embeddings del nuevo corpus existan;
el rol admin (5) crea infraestructura (perfiles/RLS) que no existe hoy; el roadmap (4) es mayormente frontend;
el asistente (3) es el más complejo y reutiliza piezas de 1 y 2.

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
1. Migración `db/2026-06-XX_software_slug.sql`: agregar `slug` único a `software`; backfill de slugs.
2. Reescribir `db/seed-content.json`: por cada software, `video_url` en español verificado (existencia y
   embebible), descripciones en español neutro, y ampliar el corpus (~35–40 entradas) con herramientas
   conocidas en la cultura hispana. Mantener campos: `tema_slug`, `clasificacion_slug`, `nombre`, `objetivo`,
   `descripcion_corta`, `url_acceso`, `licencia`, `anio_lanzamiento`, `autor_referencia`, `video_url`, `imagen_url`.
3. Actualizar `db/seed-to-sql.mjs` a upsert por slug; regenerar `db/seed.sql`; aplicar.
4. Verificar re-embedding: `select count(*) from software where embedding is null` debe llegar a 0
   (el trigger dispara las llamadas async a la EF `embed`).
5. **Re-validar la calibración de búsqueda**: `match_threshold = 0.82` y `adaptive_margin = 0.04` fueron
   ajustados empíricamente sobre las 23 filas originales. Con un corpus mayor, repetir las pruebas de
   consultas relevantes/irrelevantes y re-ajustar vía parámetros de la RPC (sin redeploy).

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
4. Chips de tema/clasificación + breadcrumb (requiere fetch del tema; `useTema` ya existe).
5. Regenerar `database.types.ts`.

### Archivos
Nueva migración SQL, `src/services/softwareService.ts`, `src/hooks/useRelacionados.ts` (nuevo),
`src/pages/SoftwareDetallePage.tsx`, `src/components/software/SoftwareCard.tsx`, `src/types/database.types.ts`.

### Riesgos
- Con corpus pequeño todo es "algo similar" → aplicar el mismo patrón de corte adaptativo de
  `buscar_hibrido` (margen sobre la mejor similitud) dentro de la RPC.

---

## 3. Asistente virtual con voz (RAG sobre la base de datos)

### Estado actual
- STT ya resuelto: `useVoz` (Web Speech API SpeechRecognition, es).
- Retrieval ya resuelto: RPC `buscar_hibrido` (vector + FTS + filtros).
- Generación: patrón Gemini con modelo fallback y timeout ya probado en la EF `buscar`.
- Falta: TTS (salida por voz), una EF de generación con contexto, y el widget UI.

### Diseño
- **Nueva Edge Function `asistente`** (pública, CORS, mismo esqueleto que `buscar`):
  1. Request: `{ pregunta: string, contexto?: { ruta: string, tema_id?: string, software_id?: string } }`.
     El contexto de página ancla la respuesta (en `/software/:id` la pregunta "¿para qué sirve?" refiere a ese software).
  2. **Retrieval**: embeber `pregunta` con `gte-small` (mismo espacio vectorial que las filas) y llamar
     `buscar_hibrido` con `match_limit = 5`. Si hay `software_id`/`tema_id` en contexto, traer también esa
     ficha/tema directamente.
  3. **Augmented generation**: prompt a Gemini Flash-Lite (con el fallback de modelo ya usado en `buscar`):
     "Eres el asistente de ia-dex. Responde SOLO con la información del contexto. Si no está en el contexto,
     dilo. Responde en español, en 2-4 frases aptas para ser leídas en voz alta." + fichas recuperadas
     (nombre, objetivo, descripción, tema, licencia, año).
  4. Response: `{ respuesta: string, fuentes: { id, nombre }[] }` — las fuentes se renderizan como links.
  5. Degradación: si Gemini falla en ambos modelos → devolver las fuentes con un mensaje fijo
     ("Encontré estos resultados relacionados: …"), nunca error duro.
- **TTS en el cliente**: `speechSynthesis.speak(new SpeechSynthesisUtterance(respuesta))` con voz `es-*`
  (gratis, sin backend, sin cuota). Hook nuevo `useTTS` con `hablar/detener/soportado` y toggle de silencio
  persistido en `localStorage`.
- **Widget global**: botón flotante en `AppLayout` (presente en todas las páginas) que abre un panel:
  input de texto + botón de micrófono (reutiliza `useVoz`), historial corto de la conversación, respuesta
  hablada + escrita + fuentes clicables. La ruta actual y los params se pasan como `contexto`.

### Pasos
1. EF `supabase/functions/asistente/index.ts` (retrieval + Gemini + degradación). Desplegar y probar con curl.
2. `src/services/asistenteService.ts` (invoke con timeout 10 s) + tipos en `dtos.ts`.
3. `src/hooks/useTTS.ts` y `src/hooks/useAsistente.ts` (estado del chat).
4. `src/components/asistente/AsistenteWidget.tsx` montado en `AppLayout`; pasar contexto de ruta.
5. Pruebas manuales: pregunta general ("¿qué software hay para ver imágenes?"), pregunta contextual en
   ficha, Gemini caído (degradación), navegador sin TTS (solo texto).

### Archivos
`supabase/functions/asistente/` (nuevo), `src/services/asistenteService.ts` (nuevo),
`src/hooks/useTTS.ts` y `useAsistente.ts` (nuevos), `src/components/asistente/` (nuevo),
`src/components/layout/AppLayout.tsx`, `src/types/dtos.ts`.

### Riesgos
- Cuota free-tier de Gemini compartida con `buscar` → mitigar con el doble modelo + degradación a fuentes.
- Calidad de voces TTS varía por navegador → seleccionar la mejor voz `es-*` disponible; siempre mostrar texto.
- Abuso de la EF pública → límite de longitud de `pregunta` y `max_output_tokens` bajos.

---

## 4. Roadmap "Aprender Inteligencia Artificial" con el contenido de la BD

### Estado actual
- `temas.orden` (1–7) ya codifica una progresión pedagógica: búsqueda y resolución de problemas →
  representación del conocimiento → aprendizaje automático → … Es la columna vertebral del roadmap.
- `clasificaciones_si` sirve como módulo introductorio ("¿qué es un sistema inteligente?").
- `v_software_rating` permite destacar el software mejor valorado de cada etapa.

### Diseño
- **Página `/roadmap`**: línea de tiempo vertical. Etapa 0 = introducción (clasificaciones SI);
  etapas 1..7 = temas en `orden`. Cada nodo: nombre, descripción del tema, 2-3 software destacados
  (mejor valorados del tema vía `v_software_rating`, fallback alfabético), links a `TemaPage` y fichas.
- **Progreso del usuario**: tabla `progreso_roadmap (user_id uuid refs auth.users, tema_id uuid refs temas,
  completado_at timestamptz, pk (user_id, tema_id))` con RLS (cada usuario solo sus filas). Para visitantes
  anónimos, espejo en `localStorage` (se migra a la tabla al iniciar sesión). Barra de progreso global
  ("3 de 7 etapas completadas") y check por etapa.
- Sin contenido nuevo que mantener: el roadmap **se alimenta 100 % de la BD existente**, por lo que el
  nuevo seed (punto 1) lo mejora automáticamente.

### Pasos
1. Migración: tabla `progreso_roadmap` + políticas RLS.
2. `roadmapService.ts`: temas ordenados + top software por tema + CRUD de progreso.
3. Hook `useRoadmap` (combina temas, destacados y progreso; localStorage para anónimos).
4. `RoadmapPage.tsx` + entrada en `navLinks.ts` / `Sidebar` / `MobileNav` / `AppRouter`.
5. Regenerar `database.types.ts`.

### Archivos
Nueva migración SQL, `src/services/roadmapService.ts` (nuevo), `src/hooks/useRoadmap.ts` (nuevo),
`src/pages/RoadmapPage.tsx` (nuevo), `src/routes/AppRouter.tsx`, `src/components/layout/navLinks.ts`,
`src/types/database.types.ts`.

### Riesgos
- Bajo. Lo único sensible es la migración localStorage→tabla al loguearse (hacerla idempotente con upsert).

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
    check (role in ('user','admin')), created_at)` + trigger `on auth.users insert` que crea el perfil.
    Se usa `text` + `check` (NO un `enum` de Postgres): agregar `editor`/`owner` después es un
    `alter ... drop/add constraint` de una línea, sin migrar datos.
  - **Capacidad vía función, no vía literal**: las políticas RLS de contenido apuntan a
    `public.puede_gestionar_contenido() returns boolean` (`security definer`, hoy = "es admin"), NO a
    `role = 'admin'` embebido en cada policy. Así, el día que se pase a `editor`/`owner`, se redefine
    **esa única función** y **ninguna política se toca**. Esta es la decisión que mantiene abierta la Fase 2.
  - Políticas RLS de escritura: `insert/update/delete` sobre `software` y `clasificaciones_si`
    `using (public.puede_gestionar_contenido())`. La lectura pública no cambia. **La seguridad real vive
    en RLS; los iconos del frontend son solo UX.**
  - **Alta de admins**: desde el dashboard de Supabase (tabla `profiles` → `role='admin'`). Es una UI,
    no SQL crudo, y se hace una o dos veces en la vida del proyecto. Delegar a otra persona = darle admin;
    es sano porque el único poder de un admin es gestionar contenido.
- **Crear contenido (alta)**:
  - Las mismas políticas cubren el `insert` — cero infraestructura extra.
  - Software: el formulario incluye selectores de `tema_id` y `clasificacion_si_id` (`useTemas`/
    `useClasificaciones` ya existen) y genera el `slug` (columna del punto 1). El trigger embebe la fila nueva.
  - Clasificación SI: alta más simple (sin embedding).
  - El `SoftwareFormModal` sirve para crear y editar según reciba o no un `id` (un solo componente).
- **Borrado seguro**: `eventos.software_id` ya es FK; definir `on delete set null` (conservar métricas) y
  limpiar `valoraciones` del contenido borrado (es polimórfica sin FK: borrar por
  `contenido_tipo + contenido_id` en la misma operación o vía trigger).
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
1. Migración: `profiles` + trigger de alta + `puede_gestionar_contenido()` + políticas RLS
   (insert/update/delete sobre `software` y `clasificaciones_si`) + FK `on delete set null` en eventos.
2. Promover admin inicial desde el dashboard de Supabase; regenerar `database.types.ts`.
3. Extender `AuthContext`/`useAuth` con `role` y crear `useIsAdmin`.
4. Métodos de escritura en servicios.
5. UI: iconos condicionales + `SoftwareFormModal` (crear/editar) + `ConfirmDeleteModal` en cards y detalles.
6. Pruebas: usuario normal no ve iconos y RLS rechaza escrituras directas (probar con anon key);
   admin crea/edita (verificar re-embedding) y elimina (verificar limpieza de valoraciones/eventos).

### Archivos (Fase 1)
Nueva migración SQL, `src/context/AuthContext.tsx`, `src/context/auth-context-value.ts`,
`src/hooks/useIsAdmin.ts` (nuevo), `src/services/softwareService.ts`, `src/services/clasificacionesService.ts`,
`src/components/software/SoftwareCard.tsx`, `src/pages/SoftwareDetallePage.tsx`,
`src/pages/ClasificacionesPage.tsx`, `src/pages/ClasificacionDetallePage.tsx`,
`src/components/admin/` (modal de contenido + confirmación), `src/types/database.types.ts`, `src/types/dtos.ts`.

### Riesgos
- Confiar en el frontend para autorización — mitigado haciendo RLS (vía `puede_gestionar_contenido()`)
  la única barrera real.
- Borrar un software con valoraciones/eventos huérfanos — mitigado con las reglas de FK/limpieza del paso 1.
- (Fase 2) Escalación de privilegios al sumar el panel de roles — mitigado porque el `role` no es editable
  por el cliente y el cambio pasa solo por la RPC `set_user_role` con verificación de capacidad y
  protección del último admin.
- Exposición del padrón de usuarios — mitigada porque la búsqueda por email es una RPC admin-only.

---

## Resumen de dependencias

| # | Mejora | Depende de | Infra nueva |
|---|--------|-----------|-------------|
| 1 | Seed hispano | — | Columna `slug` en software |
| 2 | Relacionados + diseño | Embeddings del corpus (1) | RPC `software_relacionados` |
| 5 | Admin: gestión de contenido | — | `profiles` (text+check), `puede_gestionar_contenido()`, RLS de escritura. Fase 2 diferida: RPC `set_user_role` + ruta `/admin` |
| 4 | Roadmap | Mejor con seed nuevo (1) | Tabla `progreso_roadmap` |
| 3 | Asistente RAG por voz | Embeddings (1); reutiliza patrón de `buscar` | EF `asistente`, hook `useTTS` |
