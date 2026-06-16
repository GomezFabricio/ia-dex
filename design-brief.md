# Brief de diseño — IA-dex: "El índice cinematográfico del software de IA"

> **Para:** la IA de diseño (Claude design).
> **De:** dirección de diseño de IA-dex.
> **Objetivo:** generar el diseño de alta fidelidad definitivo para IA-dex, una app web que cataloga e indexa software de Inteligencia Artificial con fines pedagógicos. Este documento es la fuente de verdad. Seguilo al pie de la letra.

---

## 0. Contexto del proyecto

IA-dex es un "dex" (catálogo/índice) de software de IA. El contenido se organiza en una taxonomía real de dos ejes:

- **7 temas** (etapas pedagógicas, `temas.orden` 1–7) — la columna vertebral del aprendizaje.
- **clasificaciones_si** (categorías de Sistemas Inteligentes, conceptos).
- Cada **software** pertenece a la vez a un tema y a una clasificación_si. Tiene campos reales en la base: `imagen_url`, `video_url` (YouTube), `objetivo`, `descripcion_corta`, `licencia`, `anio_lanzamiento`, `autor_referencia`, `url_acceso`.

La app ya existe y ya tiene un sistema de diseño coherente ("Tech-Index": violeta + cian, dark-first). **No partimos de cero ni tiramos nada: EVOLUCIONAMOS ese sistema hacia una dirección cinematográfica.** Tu trabajo es elevar el contraste, la teatralidad y la jerarquía visual sin romper la implementación existente.

---

## 1. Objetivo estético exacto: **Netflix × Inteligencia Artificial**

La sensación: **"cine-neural"**. Imaginá el lobby de un laboratorio cuántico de noche. Oscuro, cinematográfico como Netflix, pero inequívocamente de IA/tecnología, no de streaming genérico.

Cuatro principios que hacen que se sienta "Netflix-pero-IA". Estos rigen TODA decisión visual:

1. **La oscuridad es el lienzo; el color es la luz.** El shell es casi negro. El violeta→magenta→cian vívido aparece SOLO como luz emitida: glows de héroe, el riel de navegación activo, el CTA, los anillos de foco. Exactamente el truco de Netflix (UI oscura, artwork luminoso) re-skineado para IA.
2. **Un héroe por ítem, a sangre completa (edge-to-edge).** Cada software y cada SI/tema recibe un héroe cinematográfico full-bleed: campo de póster/gradiente grande, un scrim oscuro que sube desde abajo (el título siempre apoya sobre casi-negro = legibilidad), y un glow de color suave sangrando por detrás del artwork. Este es el gesto más "Netflix": copiá el scrim de abajo-hacia-arriba, dale paleta IA.
3. **Contenido en rieles horizontales.** Las secciones del catálogo (por tema, "Más vistos", "Mejor valorados") se vuelven rieles scrolleables horizontalmente, con cards que escalan + brillan en hover y un "peek" de la siguiente card en el borde.
4. **El movimiento es sutil y físico.** Las cards se elevan y ganan glow de color en hover; los héroes tienen parallax lento + un barrido de gradiente al entrar en scroll. Todo respeta `prefers-reduced-motion`. La trama "dex-grid" (la grilla de datos) se mantiene, pero se atenúa detrás de los héroes para que el artwork domine.

**Resultado:** mantener el ADN "indexado / data-forward" del proyecto, pero subir el contraste y la cinemática para que la app **SE DESTAQUE** en vez de leerse como un dashboard.

---

## 2. Sistema de color (listo para implementar)

Mantené EXACTAMENTE los nombres de token existentes (`--color-bg`, `--color-accent`, `--color-accent-2`, etc.) para que ningún componente tenga que cambiar. Profundizamos la base oscura, hacemos los acentos más vívidos, y **agregamos un magenta** (`--color-accent-3`) para completar la tri-tonalidad neural. Cada color nuevo DEBE existir en los dos bloques: `@theme` (valores dark, por defecto) y `:root.light` (overrides).

### Dark (por defecto, dentro de `@theme`)

```css
@theme {
  /* Superficies — casi-negro cinematográfico, en capas */
  --color-bg:            #070A14;  /* lienzo (antes #0b1020) — más profundo */
  --color-bg-2:          #0B1020;  /* segundo lienzo para secciones en bandas */
  --color-surface:       #11162A;  /* cards / rieles */
  --color-surface-2:     #1A2140;  /* elevado / hover */
  --color-border:        #283156;  /* bordes visibles */
  --color-border-strong: #3A4470;  /* bordes enfatizados */

  /* Tinta */
  --color-text:   #EAEDFB;
  --color-muted:  #939DC0;
  --color-faint:  #5C6685;  /* captions / disabled */

  /* Marca — tri-tono neural: violeta -> magenta -> cian */
  --color-accent:        #8B5CFF;  /* violeta eléctrico (primario) */
  --color-accent-strong: #A684FF;  /* hover / énfasis */
  --color-accent-2:      #25E0F0;  /* cian cuántico (glow secundario) */
  --color-accent-3:      #FF4FD8;  /* magenta neural (NUEVO — tercer stop) */

  /* Tinta sobre relleno de acento (NUEVO — falta hoy) */
  --color-on-accent: #070A14;  /* tinta oscura sobre violeta brillante */

  /* Semánticos */
  --color-success: #34D399;
  --color-warning: #FBBF24;
  --color-error:   #FB7185;
  --color-info:    #38BDF8;
}
```

### Light (overrides en `:root.light`)

Cinematográfico en dark, calmo y legible en light; los acentos se OSCURECEN para pasar contraste sobre blanco.

```css
:root.light {
  --color-bg:            #F5F6FC;
  --color-bg-2:          #ECEFF9;
  --color-surface:       #FFFFFF;
  --color-surface-2:     #EEF1F9;
  --color-border:        #DCE1F0;
  --color-border-strong: #C3CADF;
  --color-text:          #161B30;
  --color-muted:         #525C7B;
  --color-faint:         #7A82A0;
  --color-accent:        #6D3CF0;  /* violeta más oscuro para AA sobre blanco */
  --color-accent-strong: #5A2DDB;
  --color-accent-2:      #0892A8;  /* cian más oscuro para AA sobre blanco */
  --color-accent-3:      #C026A8;  /* magenta más oscuro para AA sobre blanco */
  --color-on-accent:     #FFFFFF;
  --color-success: #059669;
  --color-warning: #B45309;
  --color-error:   #DC2626;
  --color-info:    #0284C7;
  color-scheme: light;
}
```

### Gradientes y glows de marca (tokens + utilities)

```css
@theme {
  /* Tri-tono firma — el gradiente de marca. Wordmark, H1 de héroe, rieles clave. */
  --gradient-neural: linear-gradient(110deg, var(--color-accent) 0%, var(--color-accent-3) 50%, var(--color-accent-2) 100%);
  /* Dos stops para marcas chicas / divisores. */
  --gradient-vc: linear-gradient(to right, var(--color-accent), var(--color-accent-2));
  /* Scrim cinematográfico de héroe — abajo-hacia-arriba a casi-negro. */
  --gradient-hero-scrim: linear-gradient(to top, var(--color-bg) 8%, color-mix(in oklab, var(--color-bg) 72%, transparent) 42%, transparent 78%);
  /* Wash ambiental — luz de color sangrando detrás del artwork. */
  --gradient-hero-wash: radial-gradient(120% 100% at 18% 0%, color-mix(in oklab, var(--color-accent) 34%, transparent), transparent 55%), radial-gradient(90% 90% at 100% 0%, color-mix(in oklab, var(--color-accent-2) 26%, transparent), transparent 60%);

  /* Glows (evolucionan el --shadow-glow actual; mantienen el nombre) */
  --shadow-glow:      0 0 0 1px color-mix(in oklab, var(--color-accent) 50%, transparent), 0 22px 55px -22px color-mix(in oklab, var(--color-accent) 70%, transparent);
  --shadow-glow-cyan: 0 0 0 1px color-mix(in oklab, var(--color-accent-2) 50%, transparent), 0 22px 55px -22px color-mix(in oklab, var(--color-accent-2) 65%, transparent);
  --shadow-hero:      0 40px 120px -40px color-mix(in oklab, var(--color-accent-3) 55%, transparent);
}

@utility neural-text { background-image: var(--gradient-neural); -webkit-background-clip: text; background-clip: text; color: transparent; }
@utility hero-scrim  { background-image: var(--gradient-hero-scrim); }
@utility hero-wash   { background-image: var(--gradient-hero-wash); }
@utility glow-ring   { box-shadow: var(--shadow-glow); }
```

### Reglas de gusto del color (NO negociables)

- **El neón vive solo en:** héroes, riel de nav activo, estados hover, y el CTA primario. **Todo lo demás es mate.** Netflix es mayormente oscuro; la luz es el punto justamente porque es rara.
- **`neural-text` se reserva** para el wordmark y el ÚNICO H1 de héroe más grande por página. **No clipear con gradiente texto de cuerpo ni H2 de sección** — esos van sólidos `--color-text` para legibilidad.
- **El magenta es color de GLOW/acento, NUNCA de texto de cuerpo.** Es el stop del MEDIO de los gradientes firma y un acento por-héroe usado con cuentagotas.
- **Sobre imágenes fotográficas:** un `--color-scrim` fijo `rgb(8 11 24 / 0.62)` en AMBOS temas, con texto claro fijo arriba. NO intercambiar color de texto por tema sobre fotos impredecibles.
- **En light theme, bajá el alpha de los glows** (~30% máx) o se manchan sobre blanco.

---

## 3. Tipografía (listo para implementar)

Mantené el trío actual — ya es fuerte, apto para español y cinematográfico. Solo formalizamos la escala y subimos el peso arriba para impacto de héroe. Las tres ya están cargadas vía Google Fonts en `index.html`.

- **DISPLAY — "Space Grotesk"** (héroes, H1/H2, wordmark, números grandes). Geométrica, techie, distinta de lo genérico. Peso de héroe: **700**.
- **CUERPO — "Inter"** (párrafos, UI, labels). Cobertura completa de diacríticos del español (á é í ó ú ñ ¿ ¡ ü), excelente en tamaños chicos. Pesos 400/500/600/700.
- **DATOS — "JetBrains Mono"** vía utility `.dex-label` con cifras tabulares (`tnum`) — números dex, años, licencias, ratings, IDs. Refuerza la identidad de "catálogo indexado".

### Escala (agregar a `@theme`)

```css
--text-hero:    clamp(2.75rem, 6vw, 4.5rem);  /* H1 de héroe por página — Space Grotesk 700 */
--text-display: clamp(2rem, 4vw, 3rem);        /* héroes de sección / títulos SI — 700 */
--text-h1:      2rem;
--text-h2:      1.5rem;     /* Space Grotesk 600 */
--text-h3:      1.25rem;
--text-body-lg: 1.125rem;   /* subcopy de héroe — Inter 400/500 */
--text-body:    1rem;
--text-sm:      0.875rem;
--text-label:   0.6875rem;  /* 11px — dex-label, uppercase, tracking-widest */
```

**Pesos / tracking:** H1 de héroe Space Grotesk 700, `letter-spacing -0.02em`, `leading-[1.05]`. H2/H3 Space Grotesk 600 con `-0.015em` (ya existe). Cuerpo Inter 400, énfasis 500/600, `line-height 1.6` para párrafos en español. `dex-label` JetBrains Mono 500, uppercase, `letter-spacing 0.08–0.12em`.

**Nota español (crítica):** el español corre ~15–20% más largo que el inglés y usa ¿ ¡ + acentos/ñ. Aflojá los line-heights de héroe y dejá que los títulos envuelvan a 2 líneas (`text-wrap: balance` ya está en headings — mantenelo). **No pongas en MAYÚSCULAS strings largos en español** (los acentos pesan visualmente); reservá uppercase para los `dex-label` cortos ("ÍNDICE DE IA").

**Ratings/números** siempre en JetBrains Mono tabular para que los rieles no tiemblen cuando cambian las cifras.

---

## 4. Marca / logo

El Logo actual ya está on-brand: marca hexagonal ("celda dex") con gradiente violeta→cian + wordmark "IA" sólido / "dex" en gradiente, en Space Grotesk bold. **Evolucionar, no reemplazar:**

1. **Marca a tri-tono:** en el `<linearGradient>` de la marca, pasar a 3 stops: `#8B5CFF` (violeta) → `#FF4FD8` (magenta) → `#25E0F0` (cian). El hexágono = celda neural / nodo de datos; mantenelo.
2. **Wordmark:** "IA" sólido `--color-text`, "dex" clipeado con `.neural-text` para que marca y wordmark compartan exactamente el mismo gradiente. Lockup en Space Grotesk 700, tracking-tight.
3. **Favicon** a los mismos 3 stops.
4. **Lockup XL** para el splash de login/héroe (marca ~56–64px, wordmark a `--text-display`) sobre casi-negro, con un `shadow-glow` suave solo detrás de la marca.
5. **Fallback monocromo** sobre artwork fotográfico o en la barra superior de light theme (un solo color plano), para que el gradiente nunca pelee con fondos ocupados. El gradiente completo se reserva para superficies oscuras sólidas.

---

## 5. Restricciones de stack (para que el diseño sea implementable)

Estas restricciones son arquitectónicas. Diseñá DENTRO de ellas.

- **React 19.2 + TypeScript + Vite 8 + React Router 7** (patrón `createBrowserRouter` / `Outlet`). **Tailwind CSS 4.3 CSS-first**: toda la config vive en `src/index.css` dentro de `@theme {}`. **NO existe `tailwind.config.js`** y no debe crearse.
- **Tokens nuevos = agregar a `@theme` (dark) Y a `:root.light` (overrides).** Tailwind 4 auto-genera utilities desde los tokens (`bg-accent`, `text-on-accent`, `border-border`, `shadow-glow`, etc.).
- **Utilities custom con `@utility`** (no `@layer components`). Patrón ya usado: `dex-label`, `dex-grid`. Los nuevos (`neural-text`, `hero-scrim`, `hero-wash`, `reveal`, `skeleton`, `focus-ring`) van con `@utility`.
- **PROHIBIDO `light-dark()`** — el minificador de producción lo baja a media queries `prefers-color-scheme` y rompe el toggle manual. Theming SOLO por clase `.light` en `<html>`.
- **PROHIBIDO el variant `dark:` de Tailwind** — dark es el DEFAULT, light es el override. Los componentes son agnósticos al tema; **solo los tokens conocen el tema.** Escribí siempre utilities semánticas (`bg-surface`, `text-text`).
- **PROHIBIDO hexes hardcodeados por componente.** Un `#22d3ee` fijo se ve vívido en dark y se mancha en light, y saltea el sistema. Agregá un token en ambos bloques.
- **Sin librería de UI ni de animación.** Todo a mano con utilities Tailwind + SVG inline. Todo el movimiento en CSS (`@keyframes` en `index.css`). Excepción permitida: el paquete `motion` (sucesor de framer-motion, import desde `motion/react`) SOLO para el widget asistente (transición FAB→panel, pop del dot de notificación). Scroll/parallax/reveals de listas → CSS nativo, nunca `motion`.
- **El contenedor de scroll NO es la ventana.** `AppLayout` renderiza `<main className="overflow-y-auto">` dentro de un grid `h-dvh`. Por lo tanto `window.scrollY`, `position: sticky` contra el viewport, y un `IntersectionObserver` con root a nivel documento **fallan**. Todo efecto de scroll apunta a `<main>` (dale `id="app-scroll"`; usalo como `root` del IO; las animaciones scroll-driven usan `scroll(nearest)` / `view()`). **`<main>` debe pasar a padding 0**: los héroes y rieles van full-bleed; solo los bloques de lectura densa (dl, foro, prosa) usan un `<div className="mx-auto w-full max-w-[1400px]">` interno.
- **Imágenes:** el hook `useImageOk` (umbral 200px) decide entre mostrar imagen o un placeholder con la inicial. Los banners usan patrón de dos capas: cover borroso de fondo (`absolute` + `scale-110` + `opacity-40` + `blur-2xl`) detrás de una imagen `object-contain`. Todo héroe respeta este patrón o lo reemplaza con un fallback robusto. **Diagramas de SI van siempre `object-contain` (NUNCA recortados).**
- **Breakpoint primario `lg` (1024px):** aparece el sidebar, se activan grids de 2 col, el ThemeToggle va a esquina fija. **No hay header/topbar en ningún breakpoint** — todo es sidebar-first.

---

## 6. Arquitectura de layout

**Mantené el riel izquierdo** (sidebar frosted, `lg:grid-cols-[18rem_1fr]`, con el campo de blur accent/accent-2 detrás del vidrio) — ya lee como un shell de app premium y es exactamente el vibe Netflix-dark. **El cambio es la columna de CONTENIDO, no el chrome.**

- **Columna principal edge-to-edge:** quitá el padding de `<main>`. Héroes y rieles a sangre; bloques de lectura en contenedor `max-w-[1400px]` interno.
- **Top chrome reactivo al scroll (firma Netflix):** una barra superior delgada DENTRO de `<main>` que arranca transparente y se funde a `bg-bg/80 backdrop-blur-xl border-b border-border/60` cuando `scrollTop > 64` (centinela + IntersectionObserver, sin listeners de scroll). Lleva el `ThemeToggle` (sacalo de la esquina fija y dockealo acá) y, en páginas internas, un **breadcrumb** (`Catálogo → Tema → Software`).
- **Ritmo vertical (la cadencia Netflix):** página = `[HÉROE full-bleed]` → `[rieles apilados con aire: space-y-12 lg:space-y-16]` → `[bloques de detalle en caja]`. Cada riel con header alineado a la izquierda y el motivo de barra-gradiente existente (`h-4 w-1 bg-gradient-to-b from-accent to-accent-2`). Alterná fondos sutiles: cada riel par sobre una banda `bg-surface/30` a sangre, para crear el ritmo de secciones sin bordes pesados.
- **Nav:** agregá `/roadmap` a `PRIMARY_LINKS` (entre Inicio y Catálogo — es la espina pedagógica), con icono en `SidebarBody` y `MobileNav`. La ruta también se agrega a `AppRouter.tsx`.
- **Mobile:** mantené el drawer inferior-derecho de `MobileNav` (zona del pulgar). Héroes bajan de `min-h-[80vh]` a `min-h-[60vh]` y apilan texto sobre visual. Los rieles son nativamente mobile-friendly: mismo scroll horizontal con snap, peek de la próxima card vía `pr-[12%]`.

---

## 7. Componente clave: `ContentRow` (riel estilo Netflix)

El caballo de batalla que reemplaza los grids estáticos de `SoftwareList` en Inicio, TemaPage y SoftwareDetallePage. `SoftwareList` (grid `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`) **se conserva** para contextos de grilla real: resultados de búsqueda y grilla de catálogo.

- **Header:** barra-gradiente + título `font-display text-lg` + chip `dex-label` de conteo opcional (ej. `23 herramientas`) + link `Ver todo →` a la derecha.
- **Track:** `<ul className="flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-4 pr-[12%] [scrollbar-width:none]">`, cada `<li className="snap-start shrink-0 w-[260px]">`. `pr-[12%]` hace peek de la siguiente card. Scrollbar nativa oculta.
- **Flechas hover (desktop):** overlays de fade gradiente (`from-bg`) a los lados con botón chevron que scrollea `clientWidth * 0.8` vía `ref.scrollBy`. Ocultas en touch (`@media (hover:hover)`). **Las flechas son siempre visibles para accesibilidad** (no solo en hover) y operables por teclado.
- **Card hover-peek (el card-expand de Netflix):** card base = `group relative transition-transform duration-200`. En `group-hover`: `scale-[1.06] z-20 origin-bottom` y revela un overlay (de `opacity-0`) con `objetivo` (line-clamp 2), chips licencia/año, y `Ver ficha →`. La card base solo muestra póster + nombre; el hover revela la meta.
- **Navegación por teclado:** cada riel es `role="region"` con `aria-label` (nombre del tema/clasificación). Flechas izq/der mueven foco Y hacen `scrollIntoView({ inline: 'nearest', behavior: reduced-motion ? 'auto' : 'smooth' })`. No atrapar las flechas globalmente — solo cuando el foco está dentro del riel.

**Rieles concretos a entregar** (todos mapean a hooks existentes — sin backend nuevo): `useSoftwarePopulares`, `useMejorValorados`, `useRecomendacionesGlobales`, `useSoftwarePorTema`, `useRecomendaciones`.

---

## 8. Variantes de HÉROE (en detalle)

Base compartida: full-bleed, `min-h-[78vh] lg:min-h-[80vh]` (`60vh` mobile), backdrop en capas (imagen cover O placeholder `dex-grid`) → scrims oscuros → contenido anclado abajo. **Pila de capas:** artwork → `hero-wash` detrás → `hero-scrim` arriba → título + CTA sobre el scrim. **Un solo glow vívido por héroe, nunca dos compitiendo.** Reutilizá `useImageOk` + el fallback de inicial. El título es SIEMPRE `<h1>` HTML real sobre imagen decorativa scrimeada (`aria-hidden` / `alt=""`); **nunca hornees el título dentro de la imagen.**

### 8.1 Héroe de ficha de SOFTWARE (el marquee — software tiene los campos más ricos)

- **Backdrop:** si existe `video_url`, el embed de YouTube reproduce MUTEADO + en loop como capa ambiental (`absolute inset-0 -z-10`, `pointer-events-none`, `scale-125` para ocultar el chrome) — extendé `VideoEmbed` con `mode="ambient"`. Si no hay video, `imagen_url` como cover borroso (promové el truco blur-cover-detrás-de-contain existente a héroe completo). Fallback: `dex-grid` + inicial gigante.
- **Contenido (abajo-izquierda, `max-w-2xl`):** kicker `dex-label` ('Software · {nombre del tema}', resolver `tema_id`→nombre client-side vía `useTemas`) → `font-display` con `neural-text` para el nombre (`text-5xl..6xl`) → **`objetivo` como tagline cinematográfico** (NO `descripcion_corta`; `objetivo` es el "porqué", perfecto para una línea de héroe; line-clamp 3) → chips meta (pill licencia, año `dex-label`, `autor_referencia` muted).
- **CTAs:** primario `bg-accent text-on-accent shadow-glow` → 'Ir al sitio' (`url_acceso`, nueva pestaña) + secundario glass 'Ver video' (scrollea al embed completo) + `StarRating` inline.
- **Bajo el fold:** el `<dl>` existente (objetivo/licencia/año/autor/url) **re-estilizado como panel "Especificaciones"** (hoja de specs visualmente distinta, `rounded-2xl`), luego el `VideoEmbed` completo (no-ambiental), luego el riel **'Relacionados'** (antes 'Recomendaciones') con chip de motivo por card ('Mismo tema' / 'Similar'). **El breadcrumb reemplaza el back-link.**

### 8.2 Héroe de SI / CLASIFICACIÓN (concepto, no producto — diagrama-forward)

Estos tienen un diagrama didáctico (`imagen_url`) que NO debe recortarse. Por eso este héroe es **PARTIDO, no image-bleed:**

- **Izquierda:** texto — kicker 'Clasificación de SI · Concepto', nombre enorme, `en_que_consiste` como párrafo lead, `StarRating`.
- **Derecha:** el diagrama en una card enmarcada con glow (`ring-1 ring-border bg-bg/40 backdrop-blur` con halo de glow accent detrás), `object-contain`.
- **Backdrop:** la trama `dex-grid` + blur accent (vibe "concepto" vs. el "póster" del producto).
- **Body:** mantené el callout accent de 'Ejemplos' y los chips de 'Enlaces de interés' (ya existen, son la página más cercana al target hoy). **Agregá un riel que falta hoy:** 'Herramientas de esta categoría' (software con ese `clasificacion_si_id`).

### 8.3 Héroe de LANDING / HOME (la declaración de marca)

- **Full-bleed cinematográfico:** backdrop animado = los orbes de blur accent/accent-2 de `AppLayout` PROMOVIDOS al héroe + `dex-grid` enmascarado + un gradiente de deriva lenta (`@keyframes` translate, ya hay precedente con `voice-bar`).
- **Contenido centro/izquierda:** kicker 'Índice de IA' → headline `font-display text-6xl..7xl` 'Aprendé Inteligencia Artificial' con `neural-text` → subhead existente → una **barra de comando de búsqueda PROMINENTE** (no solo botones) que rutea a `/buscar` con el query tipeado — la búsqueda como acción de héroe (paralelo Netflix-search). Mantené los 4 `QUICK_LINKS` re-estilizados como tiles glass flotando en la base del héroe. Agregá un CTA 'Ver roadmap' como gancho emocional ('Empezá tu camino').
- **Debajo:** la home se vuelve un home Netflix de 9+ rieles: 'Continuar aprendiendo' (progreso roadmap, localStorage), 'Tendencias', 'Mejor valorados' (con póster cards, no solo ranking de texto), 'Populares del catálogo', luego **un riel por tema** en `orden`. Más los dos paneles de ranking (2 col) en versión podio.

---

## 9. Anatomía de cards

### Software póster card (variante riel — evoluciona `SoftwareCard`)

- **Forma:** aspecto póster más alto (`aspect-[3/4]` o `aspect-video` según riel), `rounded-xl`, `border-border bg-surface`. La imagen LLENA (`object-cover`) en vez del `h-32` letterboxed actual. Sin imagen → el gradiente + inicial existente (gate `useImageOk` 200px).
- **Reposo:** póster + scrim de gradiente abajo + nombre (`font-display`) sobre el scrim — estilo póster, minimal. Mantené el chip dex `#003` arriba-izquierda (es el motivo catálogo-índice de la marca).
- **Hover (el peek):** `scale-1.06`, borde accent + `shadow-glow`, revela panel deslizando hacia arriba con `objetivo` (2 líneas), pill licencia + año + badge play si `video_url`, y `Ver ficha →`.
- **Badge play:** triángulo cian `accent-2` arriba-derecha cuando `video_url !== null` (señal de contenido mirable).

### SI concept tile (distinta del software — es categoría, no producto)

Tile landscape más ancho (`aspect-video`), backdrop `dex-grid` tenue + thumbnail del diagrama `object-contain` (nunca recortado), `orden` como numeral fantasma grande `dex-label` en la esquina. Hover revela un excerpt de una línea de `en_que_consiste`. Visualmente más "liviana"/esquemática que los pósters de software, para que el usuario sienta la diferencia de taxonomía.

### Ranking row (evoluciona `RankingRow` — hoy solo texto)

Mantené la lista compacta para sidebars, pero agregá una **variante PODIO** para el top 3 en Inicio: numeral de rank traslúcido gigante detrás de un thumb chico de póster, nombre, y la métrica (`vistas`/`promedio`) como stat `dex-label`. Posiciones 1–3 en `accent-2` (ya es la regla), 4+ en muted. El número-fantasma-detrás-del-póster es el icónico 'Top 10' de Netflix — alto impacto, bajo costo, reutiliza data existente.

---

## 10. Dirección sección por sección (páginas reales)

1. **LoginPage (`/login`, `/restablecer`)** — standalone, sin sidebar. Máxima primera impresión. Fondo `bg-bg` + gradiente radial + backdrop `dex-grid` + lockup XL del logo con glow. Formularios email/password/Google OAuth. Debe funcionar en ambos temas.
2. **InicioPage (`/`)** — el home Netflix (sección 8.3): héroe + 9+ rieles + rankings podio.
3. **CatalogoPage (`/catalogo`)** — banda-héroe slim (`dex-grid` + glow) con título + barra sticky de chips de tema (anclas scroll-to) + toggle 'Ver como: Rieles | Cuadrícula'. **Default = RIELES** (un `ContentRow` por tema). Grid cae al `SoftwareList` existente para densidad. El `#001` de cada tema se vuelve un numeral fantasma grande en el header de su sección.
4. **TemaPage (`/catalogo/:temaSlug`)** — mini-héroe del tema (numeral + descripción + `StarRating`), luego rieles agrupados por `clasificacion_si_id` dentro del tema + un riel 'Mejor valorados de este tema'. El filtro de texto local se re-estiliza como pill de búsqueda dockeado en la barra sticky.
5. **SoftwareDetallePage (`/software/:id`)** — héroe de software (8.1) + panel Especificaciones + video + riel Relacionados. Breadcrumb arriba.
6. **ClasificacionesPage (`/clasificaciones`)** — mismo patrón que Catálogo (banda-héroe + grid/rieles de SI concept tiles).
7. **ClasificacionDetallePage (`/clasificaciones/:slug`)** — héroe SI partido (8.2). Es la página más cercana al target hoy; el rediseño la amplifica.
8. **BuscarPage (`/buscar`)** — el showpiece. Reemplazá el form en caja por un **héroe de comando search-first:** input grande centrado (`text-xl`, anillo de foco con glow accent + accent-2) con el botón de mic (mantené `VoiceSearchOverlay` tal cual, y la lógica `buscarAndRecord`/filtros extraídos) INTEGRADO en la barra como icono trailing, sobre `dex-grid`. Filtros (tema/licencia/año) colapsan en una fila de chips 'Filtros' bajo la barra, expandible — demotealos para que el query sea la estrella. Estado idle: chips de sugerencia ('procesamiento de lenguaje', 'visión por computadora', 'gratis y open source') + riel tenue de populares (nunca vacío visualmente). Resultados: `SoftwareList` GRID (search = escanear muchos resultados) con la nueva anatomía de card.
9. **ForoPage (`/foro`)** — layout 2 col (lista de hilos `rounded-2xl` vía `TemaForoItem` | aside CTA + stats). Modal 'Nuevo tema' con el componente Modal existente.
10. **ForoTemaPage (`/foro/:id`)** — hilo 2 col (conversación con `MensajeItem` | aside stats). Form de respuesta para autenticados.
11. **EstadisticasPage (`/estadisticas`)** — héroe de stats slim + dos paneles de ranking (2 col) con badges de podio visuales. Números con count-up disparado por IntersectionObserver al entrar en viewport de `<main>`, en `dex-label` tabular.

### 12. RoadmapPage (`/roadmap`) — NUEVA, la más ambiciosa

'Aprendé Inteligencia Artificial', una **línea de tiempo de aprendizaje vertical cinematográfica.** Mapea directo a la base: Etapa 0 = `clasificaciones_si` (intro '¿qué es un SI?'), Etapas 1–7 = `temas` por `orden`. 100% data existente.

- **Héroe:** 'Tu camino en la IA', barra de progreso global ('3 de 7 etapas completadas' — localStorage para anónimos, tabla `progreso_roadmap` para logueados) + CTA 'Continuar' que salta a la primera etapa incompleta. Backdrop = gradiente animado + motivo de línea ascendente evocando ascenso.
- **Spine (la espina):** línea vertical glow central (`bg-gradient-to-b from-accent via-accent-2 to-transparent`). Desktop `lg:grid-cols-[auto_1fr]`: columna izquierda = mini-spine STICKY con índice de etapa (`Etapa 0..7` como numerales `dex-label` grandes; la actual en accent con glow, completadas con check, futuras en muted) que trackea scroll vía IntersectionObserver. Columna derecha = el contenido de etapa scrollea por delante.
- **Nodo de etapa:** dot conector en la línea (relleno accent si completada, ring si actual, hueco si futura), card con kicker `Etapa {orden}`, nombre del tema (`font-display text-3xl`), descripción como lead, toggle 'Marcar como completada', link `Ir al tema →`, y un mini-riel horizontal de 2-3 destacados (top software del tema vía `v_software_rating`, fallback alfabético) con póster cards. Etapa 0 lista las SI concept tiles.
- **Scroll effects (vívidos):** cards de etapa hacen fade+slide-in al entrar (IO + `.reveal`); la línea spine se "dibuja" al scrollear (animar altura de máscara gradiente atada al progreso de scroll); nodos completados pulsan el glow accent brevemente al togglear. Todo CSS/IO — sin librería.
- **Mobile:** spine a la izquierda extrema, cards full-width, índice sticky se vuelve una pill de progreso superior delgada.

### 13. Widget asistente Gemini (flotante, en todas las páginas in-app)

Botón flotante fijo montado en `AppLayout` (`z-50`, abajo-derecha, libre de `MobileNav`). Icono: logo Gemini. **NO es un modal full** — es un panel slide-in / bottom sheet.

- **Cerrado (FAB):** `bg-surface border-border` (como el variant fab del ThemeToggle), hover `border-accent/60`, `focus-ring`, `aria-label="Abrir asistente de IA"` + `aria-expanded`. **Idle:** pulso 'respiración' suave (halo que expande+desvanece cada ~3s, reutilizando el lenguaje de halo del `VoiceSearchOverlay`). **Atención:** pulso one-shot + dot de notificación que entra con `scale(0)→scale(1)`.
- **Abierto:** panel anclado con historial de chat (2-3 turnos), input de texto + botón mic (`useVoz`, transcript → campo de input, **NO auto-enviado**), toggle de reproducción TTS por respuesta, links de fuentes por respuesta, y un prompt sugerido 'Resumime esta página'. El contexto se deriva de la ruta/params actuales.
- **a11y (crítica):** panel **NO modal** (`role="dialog"` SIN `aria-modal`, o `role="complementary"`) — el usuario sigue leyendo la página mientras responde. Movés foco al input al abrir; Esc cierra + devuelve foco al FAB. La respuesta streameada va en una región `aria-live="polite"` actualizada en bloques GRUESOS (frase/oración), nunca token-por-token (ametralla al lector de pantalla). Mientras TTS habla, poné la live region en `aria-live="off"` para no narrar doble. Fuentes = `<a>` reales con texto discernible. Una única instancia de `SpeechRecognition` (no puede coexistir con el mic de BuscarPage). Estado de error / Gemini caído: mensaje fijo en español + fuentes de fallback en `role="alert"`, nunca una UI de error dura.

### 14. Modales de administración (CRUD de contenido)

Extienden el `Modal` existente (`<dialog>` nativo + `showModal()`, ya accesible: focus trap nativo, Esc, light-dismiss en backdrop). Más grandes (`max-w-lg`/`max-w-2xl`) con formularios multi-campo para crear/editar software y clasificaciones_si. Aparecen en contexto (ej. en SoftwareDetallePage para admins, gated por `puede_gestionar_contenido()`). Por modal: `labelledBy` al heading, `aria-describedby` al body, primer campo como primer focusable, `aria-busy` + submit deshabilitado mientras guarda, errores de validación inline (`--color-error`, `role="alert"`) sin cerrar en error.

---

## 11. Movimiento / coreografía de scroll y micro-interacciones

**Recomendación de tech:** animaciones CSS scroll-driven nativas (`animation-timeline: view()` / `scroll()`) + IntersectionObserver para el 90% (costo de bundle cero, compositadas en GPU, encajan con la filosofía CSS-first). El paquete `motion` SOLO para el widget asistente. Animá **únicamente `transform` y `opacity`** (y `filter`/`box-shadow` con cuidado para glows); NUNCA `width/height/top/left/margin`.

**Primitiva de entrada global** (`@utility reveal`) — aplicar a cada sección, grid, dl, ranking:
```css
@utility reveal {
  animation: reveal-in linear both;
  animation-timeline: view(block);
  animation-range: entry 0% cover 28%;
}
@keyframes reveal-in {
  from { opacity: 0; transform: translateY(28px); }
  to   { opacity: 1; transform: translateY(0); }
}
```
Envolvé en `@supports (animation-timeline: view())`; en navegadores sin soporte (Safari ≤17, Firefox sin flag), el contenido se renderiza estáticamente visible (**nunca contenido oculto**). El timeline se escopea a `<main>` (`scroll(nearest)`).

**Coreografía concreta:**
- **Home:** orbes de blur con parallax sutil (factor ~0.15 vía `scroll(nearest)`); copy + CTAs + 4 QUICK_LINKS con entrada escalonada al cargar (delays 60–80ms); secciones de ranking con `reveal`.
- **Héroe de detalle (EL momento Netflix):** banner sticky-scrub — el cover borroso escala `1.1→1.18` + parallax `translateY` al scrollear; la imagen contain se queda o deriva a factor menor (profundidad en capas); el scrim de gradiente abajo SE PROFUNDIZA con el scroll. Título + chips + StarRating entran escalonados al montar.
- **Catálogo/Tema:** grids con `reveal` + stagger por índice (`min(i, 8) * 50ms`, capeado). El swap de filtro hace crossfade, no corte duro.
- **Roadmap:** ver sección 12.
- **Stats:** count-up por IO; barras crecen `scaleX` desde 0.
- **Skeletons:** reemplazá los `<p>Cargando…</p>` por skeletons shimmer (`@utility skeleton`, base `bg-surface-2` con barrido `translateX(-100%)→100%` tintado accent `color-mix(... accent 12%)`, ~1.4s) que matchean la forma final (sin CLS). Al llegar la data: crossfade del skeleton + `reveal` del contenido nuevo.
- **Transición de ruta:** envolvé el `<Outlet/>` en un fade/slide-up de montaje (≤200ms, `route-enter` keyframe).

**Micro-interacciones (extender el vocabulario existente):**
- **Cards:** mantené `hover:-translate-y-0.5 + hover:border-accent/60 + hover:shadow-glow`. Agregá `group-hover:scale-105` a la imagen interna (Ken-Burns sutil), un sheen accent de bajo opacity, brillo del badge dex `accent-2`. Usá `transition-[transform,box-shadow,border-color]` (no `transition-all`). `will-change: transform` SOLO en `:hover`, nunca estático.
- **CTAs:** glow pulsante suave en el CTA de héroe (box-shadow accent, ~2.4s, baja amplitud).
- **Ranking rows:** barra de acento izquierda que crece (`scaleX` desde la izquierda) en hover para top-3.

**Reduced-motion (gate global único en `@layer base`):**
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
    scroll-behavior: auto !important;
  }
}
```
Los `reveal` usan `animation-fill-mode: both` para aterrizar en el frame visible final (nunca el oculto). Loops decorativos (respiración del asistente, glow del CTA, parallax de orbes) **se detienen por completo** bajo reduced-motion. Mobile: factores de parallax menores o apagados; el scrub pesado de héroe detrás de `@media (min-width: 1024px)`.

---

## 12. Accesibilidad y dark/light (requisitos no negociables)

- **Contraste verificado:** texto de cuerpo (`#EAEDFB` sobre `#070A14` ≈ 17:1) y muted (`#939DC0` ≈ 7:1) pasan AA/AAA en ambos temas. **PERO los acentos vívidos son para RELLENOS, labels grandes (≥14px semibold) e iconos, NUNCA texto de cuerpo.** Cian como texto normal falla AA en light (`#0892A8` sobre blanco ≈ 4:1). Magenta nunca es texto. Sobre relleno accent, el texto va `--color-on-accent` (oscuro en dark, blanco en light).
- **Foco visible (la deuda a11y #1 — hoy falta global):** agregá un `@utility focus-ring` (`outline: 2px solid var(--color-accent); outline-offset: 2px`) o regla global `:focus-visible` en `@layer base`, aplicada a TODO interactivo (cards `<Link>`, ranking rows, FAB, flechas de riel). El anillo es INSTANTÁNEO (sin transición) y NO depende de movimiento.
- **No dependas de affordances solo-hover** (flechas de carousel reveladas, bordes de card solo-hover) para estado — teclado y touch no reciben nada.
- **Alt text:** título de héroe = `<h1>` real sobre imagen decorativa `aria-hidden`/`alt=""` scrimeada; nunca horneado en la imagen. Cards usan `alt={nombre}`, placeholder con inicial `aria-hidden`.
- **Modales:** `<dialog>` nativo (focus trap, Esc, light-dismiss ya correctos); el padre devuelve foco al trigger al cerrar.
- **No scrim-swap por tema sobre fotos:** un `--color-scrim` oscuro fijo + tinta clara fija en AMBOS temas.

---

## 13. Entregables (lo que quiero que produzcas)

1. **Sistema de diseño / tokens:** la hoja de tokens completa lista para pegar en `index.css` — bloque `@theme` (dark) + `:root.light` (overrides), incluyendo los nuevos `--color-accent-3`, `--color-on-accent`, `--color-bg-2`, `--color-border-strong`, `--color-faint`, los gradientes firma, los glows, y las `@utility` (`neural-text`, `hero-scrim`, `hero-wash`, `glow-ring`, `reveal`, `skeleton`, `focus-ring`). Más la escala tipográfica.
2. **Pantallas clave en alta fidelidad, en dark Y light:** InicioPage (home Netflix con rieles + rankings podio), SoftwareDetallePage (héroe de software + Especificaciones + Relacionados), ClasificacionDetallePage (héroe SI partido), CatalogoPage (vista rieles + toggle grid), BuscarPage (héroe de comando search-first), LoginPage (splash con lockup XL), y EstadisticasPage.
3. **RoadmapPage completa:** héroe con barra de progreso + timeline vertical con spine sticky, nodos de etapa, mini-rieles de destacados, y los estados de etapa (completada / actual / futura). Mobile incluido.
4. **El widget asistente Gemini:** FAB en sus estados (idle/respiración, atención con dot, abierto) + el panel de chat slide-in completo (historial, input + mic, toggle TTS, fuentes, prompt sugerido), en dark y light.
5. **Las tres variantes de héroe** especificadas con todas sus capas (artwork/video ambiental, `hero-wash`, `hero-scrim`, contenido anclado, CTAs).
6. **Estados de componente (matriz completa):** para CTA primario, software póster card (con hover-peek revelado), ContentRow (incl. flechas y card escalada), ranking row podio, modal de admin, y el FAB del asistente — cada uno en: default / hover / focus-visible / active / disabled / loading (skeleton) / error.
7. **El logo evolucionado:** marca hexagonal tri-tono + wordmark con `neural-text` + lockup XL para splash.
8. **Spec de movimiento:** la primitiva `reveal`, el sticky-scrub de héroe, el stagger de grids, el draw de la spine del roadmap, los skeletons shimmer, y el gate global de `prefers-reduced-motion` — todo expresado en CSS/`@keyframes` pegables.

Sé decisivo y específico. Entregá un diseño que SE DESTAQUE — cinematográfico, vívido, inequívocamente de IA — y 100% implementable sobre React 19 + Tailwind 4 CSS-first con los componentes y tokens que ya existen.