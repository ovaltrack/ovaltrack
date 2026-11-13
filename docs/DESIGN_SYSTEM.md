# OvalTrack — Sistema de Diseño Oficial (Design System)

> **Estado:** Activo y alineado al 100% con la interfaz del frontend.  
> **Identidad Visual:** *Cal y botella* (modo claro) y *Grafito con verde botella* (modo oscuro): estética deportiva de alto rendimiento, un solo color de marca (el verde botella) y elevación física.

Este documento es la **fuente de verdad definitiva y obligatoria** para el diseño y desarrollo de todas las vistas del frontend de OvalTrack. Cualquier componente o pantalla nueva debe construirse respetando los tokens, patrones y lineamientos aquí descritos.

---

## 1. Tokens de Color Globales (`:root`) — Diseño Actual Activo

Los tokens oficiales del sistema corresponden a la identidad visual **Cal y botella** (claro) y **Grafito con verde botella** (oscuro, §5), implementadas en el frontend. Los nombres de los tokens son los mismos en los dos temas; solo cambian sus valores.

### 1.1 Paleta Activa (Modo Claro «Cal y botella»)

**Principio:** el verde deja de ser ambiente. El fondo es una «cal» casi neutra y el verde botella queda para lo que significa algo: acción, selección, equipo propio y marca. El lima es la firma de marca y **solo se usa sobre superficies verde botella** (tablero de Inicio, píldora «En vivo», emblemas, el check de «Posesión propia»); nunca sobre fondo claro ni gris. El logo es una excepción y no se toca.

```css
:root {
  /* Lienzo: cal casi neutra, con un susurro cálido */
  --bg: #f6f7f3;
  --bg-canvas: #eef0ea;
  --canvas-image:                              /* brillo arriba + líneas tácticas a 135° (body y Entretiempo) */
    radial-gradient(ellipse 70% 40% at 50% 0%, rgba(255, 255, 255, 0.7), transparent 70%),
    repeating-linear-gradient(135deg, rgba(27, 33, 22, 0.045) 0 1.5px, transparent 1.5px 54px);

  /* Superficies */
  --surface: #ffffff;                         /* Tarjetas, modales, tablas y navbar */
  --surface-alt: #f6f7f3;                     /* Cabeceras de tabla, inputs deshabilitados, filas anidadas */
  --surface-hover: #f3f4f0;                   /* Hover de filas y botones */
  --surface-track: #f9faf7;                   /* Carril de la línea de tiempo */
  --surface-header-start: #f6f7f3;            /* Cabecera de tarjeta: neutra, sin degradé verde */
  --surface-header-end: #f6f7f3;
  --surface-toolbar: #ffffff;                 /* Barras de filtros: tarjeta blanca */
  --surface-segment: #e4e7df;                 /* Contenedor del selector de vistas y de los filtros */
  --border-segment: #dcdfd7;

  /* Bordes */
  --border: #e6e8e2;                          /* Separadores */
  --border-strong: #858b7e;                   /* Inputs y controles: 3,50 : 1 sobre blanco */
  --border-sport: #dcdfd7;                    /* Tarjetas de primer nivel (2px) y bordes de 1px en tarjetas anidadas */
  --border-sport-subtle: #e6e8e2;             /* Separadores internos y cabeceras */

  /* Texto */
  --text-primary: #1b2116;                    /* 16,46 : 1 sobre blanco */
  --text-secondary: #4b5540;                  /* 7,86 : 1 */
  --text-muted: #646b5b;                      /* 5,53 : 1 sobre blanco, 4,82 sobre cal, 4,69 sobre el tinte */

  /* Verde botella: acción, selección, equipo propio y marca */
  --btn-primary-bg: #204b22;                  /* CTA principal; blanco encima 10,04 : 1 */
  --btn-primary-fg: #ffffff;
  --btn-primary-hover: #163618;
  --btn-outline-bg: #ffffff;                  /* Botón secundario: blanco, borde gris, texto oscuro (sin verde) */
  --btn-outline-border: #858b7e;
  --btn-outline-fg: #1b2116;
  --grass: #204b22;                           /* Texto, foco y trazos de acento. En claro NUNCA es lima */
  --grass-hover: #163618;
  --on-grass: #ffffff;
  --grass-deep: #204b22;
  --grass-tint: rgba(32, 75, 34, 0.10);       /* Fondos suaves de acento */
  --grass-tint-strong: #e6efe3;               /* Selección activa: módulo del navbar, pestaña, fila; botella encima 8,52 : 1 */
  --grass-border: rgba(32, 75, 34, 0.40);
  --brand-signature: #a3e635;                 /* Lima de marca, solo sobre #204b22 o #163618 (6,66 y 8,84 : 1) */

  /* Roles y equipos */
  --navy: #16324f;                            /* Administrador de club */
  --navy-tint: rgba(22, 50, 79, 0.08);
  --navy-border: rgba(22, 50, 79, 0.30);
  --blue-mid: #2b6ca3;                        /* Entrenador / Analista */
  --blue-mid-tint: rgba(43, 108, 163, 0.08);
  --player: #6b6f5f;                          /* Jugador / neutro */
  --player-tint: rgba(20, 25, 15, 0.05);
  --team-rival: #3d5a80;                      /* Rival (7,06 : 1 sobre blanco); el propio es el verde botella */

  /* Estados: ámbar avisa, rojo alerta, verde confirma. Siempre ícono + texto */
  --success: #2a722e;                         /* 5,92 : 1 sobre blanco, 5,04 sobre su tinte */
  --success-tint: #e6efe6;
  --success-border: rgba(42, 114, 46, 0.30);
  --warning: #8a5700;                         /* 6,10 : 1 */
  --warning-tint: #ffefd3;
  --warning-border: rgba(138, 87, 0, 0.35);
  --error: #b42318;                           /* 6,57 : 1 */
  --error-tint: #fde9e7;
  --error-border: rgba(180, 35, 24, 0.30);

  /* «Sin jugador»: chip dashed, fila pendiente con barra y marcadores rayados a 135° */
  --unassigned-border: #b7791f;
  --unassigned-bg: #fff8ea;
  --unassigned-stripe: #fff4dc;

  /* Calor de la cancha de zonas (post-partido): escala secuencial ámbar → naranja */
  --zone-heat-low: #fdb022;
  --zone-heat-high: #d9480f;
  --zone-heat-mix: 62%;

  /* Píldora de marcador del encabezado de análisis post-partido (Eventos, Zonas y Estadísticas) */
  --score-pill-bg: #204b22;
  --score-pill-fg: #ffffff;

  /* Geometría y sombras */
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;
  --radius-xl: 20px;
  --radius-pill: 999px;
  --shadow-elevation: 0 1px 2px rgba(16, 24, 16, 0.06), 0 12px 32px rgba(16, 24, 16, 0.07);
  --shadow-button: 0 4px 12px rgba(32, 75, 34, 0.20);
  --shadow-button-hover: 0 6px 16px rgba(32, 75, 34, 0.28);

  /* Compartidos con el modo oscuro (§5.1) */
  --surface-sunken: var(--surface);
  --surface-overlay: var(--surface);
  --shadow-navbar: 0 4px 14px rgba(20, 45, 20, 0.08);
  --on-navy: #ffffff;                         /* texto sobre --navy */

  /* Colores de jugadas (línea de tiempo y tabla de post-partido), §5.6 */
  --event-try: #2e7d32;
  --event-kick: #7c3aed;
  --event-tackle-missed: #2563eb;
  --event-tackle: #16324f;
  --event-penalty: #b42318;
  --event-set-piece: #b8560a;                 /* oscurecido para llegar a 4,80 : 1 con texto blanco */
  --event-turnover: #b8560a;
  --event-default: #204b22;
}
```

### 1.2 Reglas de uso del color (claro)

- **Un solo primario sólido verde botella por pantalla.** El resto es `.btn-outline` (blanco, borde `--border-strong`, texto `--text-primary`). El rojo es solo para error y borrar.
- **Lima solo sobre botella.** `--brand-signature` va únicamente sobre `#204b22`/`#163618`. Sobre blanco o cal da 1,51 y 1,31 : 1 y está prohibido. `--grass` en claro es botella, no lima.
- **El verde de estado nunca va en un botón.** `.status-active` y `.banner-success` son estado: usan `--success*`, no el verde de marca.
- **Ámbar** = falta algo que se puede completar; **rojo** = algo falló, se rechaza o se pierde; **verde** = confirma. Siempre ícono + texto, nunca solo color.
- **El estado solo aparece cuando no es el normal** (p. ej. «Inactivo» en Miembros; «Activo» no lleva rótulo).
- **JetBrains Mono solo para números, tiempos, marcadores, códigos y rótulos `.label-mono`.** Las frases van en Inter.

### 1.3 Contrastes del claro (WCAG 2.x, calculados)

Mínimos: 4,5 : 1 para texto y 3 : 1 para bordes de controles.

| Par | Ratio |
|---|---|
| Primario `#1b2116` sobre blanco / cal `#eef0ea` / `#f6f7f3` / tinte `#e6efe3` | 16,46 / 14,33 / 15,30 / 13,97 |
| Secundario `#4b5540` sobre las mismas | 7,86 / 6,84 / 7,30 / 6,67 |
| Atenuado `#646b5b` sobre las mismas (antes `#7c8571`: 3,85 sobre blanco) | 5,53 / 4,82 / 5,14 / 4,69 |
| Botella `#204b22` sobre el tinte `#e6efe3` | 8,52 |
| Blanco sobre botella `#204b22` / `#163618` | 10,04 / 13,33 |
| Lima `#a3e635` sobre `#204b22` / `#163618` | 6,66 / 8,84 |
| Éxito `#2a722e` sobre blanco / su tinte `#e6efe6` | 5,92 / 5,04 |
| Advertencia `#8a5700` sobre `#ffefd3` / `#fff8ea` | 5,38 / 5,77 |
| Error `#b42318` sobre `#fde9e7` | 5,63 |
| Rival `#3d5a80` sobre blanco / cal | 7,06 / 6,15 |
| Borde fuerte `#858b7e` sobre blanco / `#f6f7f3` / cal | 3,50 / 3,26 / 3,05 |
| Naranja de jugadas `#b8560a`: blanco encima / sobre el carril | 4,80 / 4,58 |

Límite conocido: `#858b7e` da 2,80 : 1 sobre el contenedor `--surface-segment`; los controles de ese contenedor se distinguen por texto y fondo, no por borde (el activo es blanco con sombra).

---

## 2. Tipografía

El sistema utiliza tres familias tipográficas, **empaquetadas con la app** (`@fontsource`, subconjunto latin con tildes y ñ, importadas al inicio de `frontend/src/styles.css`; no hay CDN, así que el Service Worker las precachea y funcionan sin conexión):

- Hanken Grotesk 600, 700 y 800; Inter 400, 500, 600 y 700; JetBrains Mono 500, 600 y 700 (10 caras woff2, de 14 a 24 KB cada una).
- Un peso que no se carga (por ejemplo 800 sobre Inter o JetBrains Mono) lo resuelve el navegador con el más cercano (700). No se precargan con `<link rel="preload">`: los archivos llevan hash en el nombre y cambia con cada build.
- Antes de quitar una cara hay que comprobar que ninguna pantalla la use (los pesos 500 a 800 aparecen en los tres tipos de letra).

| Familia | Pesos | Uso principal |
|---|---|---|
| **Hanken Grotesk** (`--font-head`) | 600, 700, 800 | Títulos de página (HUD), encabezados de tarjetas, títulos de modales y logos. |
| **Inter** (`--font-body`) | 400, 500, 600, 700 | Textos de interfaz, inputs, tablas, botones, descripciones y badges. |
| **JetBrains Mono** (`--font-mono`) | 500, 600, 700 | Dorsales, emails, contadores, timestamps y datos numéricos/estadísticos. |

---

## 3. Componentes Base Globales

### 3.1 Fondo de Cancha «Cal»
El fondo global de las pantallas de gestión es una cal casi neutra (`--bg-canvas`, `#eef0ea`) con un brillo suave arriba y líneas tácticas diagonales muy tenues, definidas en `--canvas-image` (el modo oscuro y Entretiempo usan el mismo token):

```css
body {
  background-color: var(--bg-canvas);
  background-image: var(--canvas-image);
  background-attachment: fixed;
  color: var(--text-primary);
  font-family: var(--font-body);
}
```

### 3.2 Page Header (HUD integrado, encabezado único)
Todas las pantallas de gestión usan el mismo encabezado, promovido del HUD de Inicio: rótulo mono, título Hanken 800 y subtítulo, con las acciones a la derecha. **No hay píldoras de rótulo** en estos encabezados.

```html
<header class="hud">
  <div class="hud-text">
    <p class="label-mono hud-label">Perfil Institucional</p>
    <h1 class="hud-title">Configuración del Club</h1>
    <p class="hud-subtitle">Información general y parámetros de la institución</p>
  </div>

  <div class="hud-actions">
    <button type="button" class="btn btn-invite">Guardar</button>
  </div>
</header>
```

- `.label-mono`: JetBrains Mono 700, 12px, mayúsculas, tracking `.12em`, color `--text-secondary`.
- `.hud-title`: Hanken Grotesk 800, 44px (32px en ≤ 700px), interlineado 1,05, tracking `-.03em`, color `--text-primary`.
- `.hud-subtitle`: 15px, color `--text-secondary`.
- `.hud-text--fluid`: el texto se ajusta (`flex: 1 1 320px`) en vez de empujar las acciones.
- Usan este patrón: Inicio (`HomeHudComponent`), alta de división, jugadores y entrenadores de división, alta de jugador, Club, Partidos, Rivales, armado de plantel, Admin OvalTrack, Estadísticas del jugador y de división, Miembros (un solo encabezado, sin doble título) y Consulta interna. Post-partido tiene su propio HUD con el marcador, pero también usa el rótulo mono.
- **Excepción:** la lista de Divisiones conserva su encabezado anterior (`.hud-brand` + `.badge-tech` + `.brand-text`). `.badge-tech` sigue existiendo como clase neutra (fondo `--surface-alt`, borde `--border-sport`, texto `--text-secondary`) para Divisiones, Entretiempo, el modo edición de Club, el alias de Rivales y el selector de registro; no se usa en encabezados nuevos.

### 3.3 Botones

```css
/* Botón de Acción Principal (CTA Rugby): uno por pantalla */
.btn-invite, .btn-primary-rugby {
  height: 44px;
  padding: 0 20px;
  border-radius: 10px;
  background-color: var(--btn-primary-bg);   /* #204b22 */
  color: var(--btn-primary-fg);
  font-weight: 700;
  border: 1px solid var(--btn-primary-bg);
  box-shadow: var(--shadow-button);
  transition: all 0.15s ease;
}
.btn-invite:hover {
  background-color: var(--btn-primary-hover);
  transform: translateY(-1px);
  box-shadow: var(--shadow-button-hover);
}

/* Botón Secundario / Outline: blanco, borde gris, texto oscuro (sin verde) */
.btn-outline {
  height: 44px;
  padding: 0 20px;
  border-radius: 10px;
  background-color: var(--btn-outline-bg);
  border: 1px solid var(--btn-outline-border);
  color: var(--btn-outline-fg);
  font-weight: 600;
  box-shadow: 0 2px 6px rgba(16, 24, 16, 0.04);
}
.btn-outline:hover {
  background-color: var(--surface-hover);
  border-color: var(--text-secondary);
  color: var(--text-primary);
  transform: translateY(-1px);
}
```

**Selector de vistas y filtros** (`.status-segment`, `.status-tab`, `.filters`, `.chip`): contenedor `--surface-segment` con borde `--border-segment`; el activo es **blanco con sombra** (`0 1px 3px rgba(16,24,16,.14)`) y anillo de 1px. El conteo usa `--text-secondary` para llegar a 4,5 : 1 sobre el contenedor.

### 3.4 Tarjetas Elevadas de Formulario y Contenido (`.form-card`, `.match-card-shell`, etc.)
Estructura en dos capas con cabecera neutra y cuerpo blanco puro, con bordes de 2px y una sombra de elevación suave. Las tarjetas anidadas llevan borde de 1px `--border-sport` y una sombra mínima (`0 1px 2px rgba(16,24,16,.05)`):

```css
.form-card {
  background: var(--surface);
  border: 2px solid var(--border-sport);      /* #dcdfd7 */
  border-radius: 20px;
  box-shadow: var(--shadow-elevation);
  overflow: hidden;
}

.form-card-header {
  background: linear-gradient(180deg, var(--surface-header-start) 0%, var(--surface-header-end) 100%); /* neutra */
  border-bottom: 2px solid var(--border-sport-subtle);
  padding: 24px 32px 20px;
}

.form-card-title {
  font-family: var(--font-head);
  font-weight: 800;
  font-size: 20px;
  color: var(--text-primary);
}
```

### 3.5 Controles de Formulario (`.form-control`)
Inputs y selects con altura táctil accesible (46px), borde de control `--border-strong` (3,50 : 1) y foco en verde botella:

```css
.form-control {
  width: 100%;
  height: 46px;
  background: var(--surface);
  border: 1px solid var(--border-strong);
  border-radius: 10px;
  color: var(--text-primary);
  padding: 0 14px;
  font-size: 14.5px;
}
.form-control::placeholder { color: var(--text-muted); }
.form-control:focus {
  border-color: var(--btn-primary-bg);
  box-shadow: 0 0 0 3px rgba(32, 75, 34, 0.15);
  background: var(--surface);
}
```

---

## 4. Patrones de Pantalla Implementados

### 4.1 Barra de Navegación Global (`NavbarComponent`)
Barra superior **sólida, blanca (`--surface`), sin efecto vidrio**, de ancho completo (no usa `.layout-container`): el logo y el avatar no cambian de lugar entre pantallas. El margen lateral es `clamp(var(--layout-pad), 3vw, 56px)`. `position: sticky`, `z-index: 1030`, alto `var(--navbar-h)`.

- **Estructura:** logo (lleva a `/home`; reemplaza a "Volver al inicio"), nombre del club debajo del logo (solo > 1120px y fuera de post-partido), módulos, y a la derecha partido en vivo, sincronización y avatar.
- **Módulos por rol** (catálogo único `core/navigation/navigation-modules.ts`; un módulo sin `route` no se muestra): Admin de club → Inicio, Partidos, Divisiones, Club, Miembros · Entrenador/Analista → Inicio, Partidos, Divisiones (Reportes cuando exista su ruta) · Jugador → Inicio, Estadísticas (Partidos cuando exista su ruta) · Admin OvalTrack → Inicio, Administración. La pantalla actual se resalta con el tinte de selección (`--grass-tint-strong`, `#e6efe3`, con texto botella; `aria-current="page"`).
- **Estados, solo cuando hacen falta:** *Partido en vivo* (`LiveMatchSource`, lee Dexie; solo el partido que captura este dispositivo, división + marcador, lleva a `/live-capture/:id` o a `/halftime`; el jugador no lo ve). *Sincronización* (`SyncStatusSource` → `LocalSyncStatusSource`; icono + texto o contador; desaparece si todo está sincronizado). Cuenta en Dexie, con `liveQuery`, los cambios sin enviar (eventos pendientes + transiciones de partido; los rechazados por el servidor no cuentan), combina la conexión (`ConnectivityService`) y "Sincronizar ahora" reutiliza `SyncManagerService.synchronizeAll()` sin cambiar el orden de envío.
- **Menú de usuario** (`UserMenuComponent`): avatar con iniciales y color del rol; identidad (nombre, correo, rol, club); estado de sincronización con "Sincronizar ahora"; apariencia claro/oscuro; "Cerrar sesión" al final, separado y en rojo. Cerrar sesión siempre abre un modal bloqueante (`LogoutConfirmDialogComponent`, `<dialog>` nativo), porque sin conexión no se puede volver a entrar. Sin cambios pendientes es una confirmación simple («Cancelar» / «Cerrar sesión») que recuerda que hace falta conexión para volver. Con cambios sin enviar: sin conexión no se puede volver a iniciar sesión, así que la acción principal es «Seguir conectado» y «Cerrar sesión igual» queda en rojo secundario; con conexión, la principal es «Sincronizar y cerrar sesión» (cierra solo si se envió todo) junto a «Cancelar» y «Cerrar sin enviar». En celular el menú es una hoja inferior.
- **Modo por ruta** (`data.navbar` en `app.routes.ts`, resuelto por `NavbarModeService`): `default`, `compact` (post-partido, 56px) y `hidden` (captura en vivo y entretiempo, sin navbar para evitar toques accidentales).
- **Responsive:**

| Ancho | Barra | Módulos | Estados |
|---|---|---|---|
| ≥ 1280px | 64px | icono + texto | sincronización con texto completo |
| 1121–1279px | 64px | icono + texto | sincronización con contador |
| 960–1120px | 64px | icono + texto, 48px de alto | marcador y contador |
| 701–959px | 64px | solo texto, 48px de alto | marcador y contador |
| ≤ 700px | 56px + barra inferior flotante | abajo, icono + texto | partido en vivo sobre la barra inferior |

- **Celular:** `MobileTabBarComponent` (barra inferior flotante) se compacta a solo íconos al bajar y vuelve al subir. En post-partido no hay barra inferior (deja lugar a "Nuevo tramo") y el partido en vivo pasa a la barra superior; con ≤ 360px ese acceso se oculta. `styles.css` reserva el espacio inferior con `.app-shell:has(app-mobile-tab-bar)`.
- **Accesibilidad:** objetivos táctiles de 48px (módulos, avatar y estados), estados con icono + texto/contador (nunca solo color), foco visible, botones reales, `aria-label` en controles de icono y `prefers-reduced-motion` respetado.

### 4.2 Autenticación Split-Screen Pro Deportivo (`/login` y `/auth/register`)
- **Columna Izquierda (Hero de Alto Impacto):**
  - Fondo oscuro con gradiente deportivo, tramado sutil e iluminación radial verde neón.
  - Badge tech brillante `"ALTO RENDIMIENTO EN RUGBY"`.
  - Título enfático: `"Eleva la gestión de tu club al siguiente nivel"`.
  - Tarjetas flotantes de métricas en vivo (Scrum efficiency, Live tagging, etc.).
- **Columna Derecha (Formulario Flotante):**
  - Botón flotante superior `← Volver a la portada`.
  - Tarjeta de formulario con bordes firmes, soporte reactivo para tema Claro/Oscuro.
  - Tabs de selección de rol (Administrador de Club vs. Entrenador / Analista).
  - Todos los campos de validación requeridos intactos.

### 4.3 Mi Club (`/club`)
- **Modo Lectura por Defecto:**
  - Hero card con logo del club, nombre en grande, ciudad, dirección y fecha de fundación.
  - Tarjetas de información organizadas en grid (2px borders, cabeceras neutras `--surface-header-*`).
  - Botón de activación: `✏️ Editar información`.
- **Modo Edición Condicional:**
  - Clona un borrador independiente (`clubDraft`) sin mutar el estado global hasta guardar.
  - Inputs editables con focus verde rugby y feedback de validación.
  - Botones de acción `Cancelar` y `Guardar cambios`.
  - Sincronización instantánea con el `UserContextService` y la barra de navegación global al guardar.

### 4.4 Listados y Tablas de Planteles (`/divisions/:id/players`, `/divisions/:id/coaches`, `/members`)
- **Cabeceras de tabla:** fondo `--surface-alt`, borde inferior `--border-sport`, títulos `.label-mono` (mono, mayúsculas, tracking deportivo).
- **Filas:** fondo blanco, hover `--surface-hover`, borde inferior sutil `--border`.
- **Miembros (`/members`, pestaña Cuentas):** una sola tarjeta con tabla MIEMBRO · ROL · ACCIONES y pie «Mostrando X de N» (N es el total del club). El estado se muestra **solo si la cuenta no está activa** («Inactivo» junto al nombre; «Activo» no lleva rótulo). El administrador protegido se ve como texto con ícono de escudo en lugar del selector de rol; la descripción del permiso va como `title` del rol (no hay indicador de lápiz). En celular la tabla se apila en dos renglones.
- **Avatares de Iniciales:** Círculos de 40px con borde de rol específico (Navy para Admin, Blue para Coach, gris neutro para Jugador).
- **Selector de Rol Personalizado:** Popover dropdown a medida (no `<select>` nativo del navegador).
- **Barra de Guardado en Lote (`.batch-bar`):** Flotante en la parte inferior cuando existen cambios sin persistir (`is-dirty`).

### 4.5 Fixture y Selección de Partidos (`/match-selection`)
- **Toolbar de Filtros:** Tarjeta blanca (`--surface-toolbar`) con un selector segmentado (`--surface-segment`) de pestañas redondeadas (Todos, Por Jugar, En Curso, Finalizados, Cancelados).
- **Tarjetas de Partidos (`.match-card-shell`):**
  - Badge de estado con indicador luminoso pulsante para partidos `in_progress`.
  - Sección central con tipografía destacada de rival `"VS CLUB_OPONENTE"`.
  - Badges de fecha y marcador parcial/final con tipografía JetBrains Mono.
  - Botón de eliminación discreto en la esquina superior.
  - Acción contextual en pie de tarjeta (`Definir alineación →`, `Capturar en vivo →`, `Ver resumen →`).

### 4.6 Captura en Vivo (`/live-capture/:matchId`)
- **Entorno Especializado de Cancha:** Interfaz de alto contraste, táctil (hit-target mínimo de 48px), optimizada para tablets en tiempo real.
- **Marcador e Instrumentos:** Cronómetro, marcador y rótulos en `JetBrains Mono`; el resto de la pantalla en `Inter`, como el sistema de diseño.
- **Aislamiento:** No incluye la barra de navegación estándar para maximizar el área de control e impedir clics accidentales durante el juego.

---

## 5. Modo oscuro: Grafito con verde botella

El modo oscuro es la segunda cara de la misma identidad, no un tema aparte: **grafito neutro con luz desde arriba**, el verde de marca como señal y color solo donde significa algo. El modo claro (*Cal y botella*, §1) tiene sus propios valores para los mismos nombres de token. Lo elige el `ThemeService` (clave `ovaltrack_theme`, oscuro por defecto) y se aplica con `data-theme="dark"` en `<html>`.

### 5.1 Cómo se resuelve

- **Todo vive en tokens.** Los valores están en el bloque `[data-theme="dark"]` de `frontend/src/styles.css`. Un componente nunca escribe un color oscuro a mano: usa `var(--token)`. Los pocos literales que quedan en reglas oscuras son deliberados (sombra de la hoja inferior, halo del marcador seleccionado, verde de marca de la mini cancha y de la pelota, colores locales de la cancha nocturna).
- **Token solo oscuro:** se define únicamente en `[data-theme="dark"]` y se usa solo en reglas oscuras (`--veil`, `--scrim`, `--focus-ring`, `--shadow-overlay`, `--shadow-elevation-hover`, `--error-solid`).
- **Token compartido:** si lo usa una regla que aplica en los dos temas, se define también en `:root` con su valor claro (`--surface-sunken`, `--surface-overlay`, `--shadow-navbar`, `--team-rival`, `--on-navy`, `--zone-heat-mix`, `--event-*`, `--canvas-image`, `--surface-track`, `--surface-segment`, `--border-segment`, `--success-border`, `--brand-signature`, `--unassigned-*`, `--btn-on-board-hover`).
- Los nombres de los tokens existentes no cambian: solo cambian sus valores en oscuro.
- **Antes de cambiar el claro de una regla que no tiene override oscuro,** fijá primero el valor oscuro de hoy (un override o un token propio); si no, el cambio también mueve el oscuro.

### 5.2 Neutros y profundidad

Cada nivel es más claro que el anterior: lo que está más cerca del usuario recibe más luz.

| Nivel | Token | Valor | Uso |
|---|---|---|---|
| Hundido | `--surface-sunken` | `#0b0c0e` | navbar, cabecera y pie de Captura en vivo |
| Carril | `--surface-track` | `#111214` | reloj de Captura en vivo |
| Lienzo | `--bg` / `--bg-canvas` | `#0f1012` | fondo; `--canvas-image` suma un brillo superior y líneas a 135° |
| Superficie | `--surface` | `#17181b` | tarjetas, tablas, barras de filtros, KPI |
| Superficie alt | `--surface-alt` | `#1f2124` | inputs, chips, filas internas |
| Hover y cabecera | `--surface-hover`, `--surface-header-start` | `#25272b` | hover; cabecera de tarjeta (`--surface-header-end` `#1f2124`) |
| Overlay | `--surface-overlay` | `#282a2e` | modales, menús, hojas, diálogos |

- **Bordes:** `--border`, `--border-sport` y `--border-sport-subtle` son `#2a2c31` (decorativos; la tarjeta mantiene sus 2px). `--border-strong` y `--btn-outline-border` son `#7a7e86`: inputs, botones outline y controles.
- **Texto:** `--text-primary` `#ededef`, `--text-secondary` `#b3b6bc`, `--text-muted` `#8d9098`. No se usa blanco puro para texto sobre superficies; `#ffffff` queda solo sobre rellenos de color (`--btn-primary-fg`, `--score-pill-fg`).
- **Velo:** `--veil` (`rgba(255,255,255,.05)`) para fondos suaves de botones pequeños y cola de revisión. `--scrim` (`rgba(0,0,0,.6)`) detrás de modales.
- **Sombras:** `--shadow-elevation` (con un filo superior de luz y una base dura), `--shadow-elevation-hover`, `--shadow-overlay`, `--shadow-navbar`, `--shadow-button(-hover)`.

### 5.3 Los cuatro verdes

| Verde | Token | Valor | Uso | Nunca |
|---|---|---|---|---|
| Marca (botella) | `--board-bg-*`, `--score-pill-bg` | `#204b22` | tablero de Inicio, píldora del marcador | texto, línea ni foco sobre oscuro (1,77 : 1) |
| Acción | `--btn-primary-*` | `#337838` · hover `#38823d` · texto `#ffffff` | un solo botón primario sólido por pantalla | |
| Acento | `--grass`, `--grass-deep` | `#8cc98f` | equipo propio, filtro y pestaña activos, foco, trazos, enlaces | relleno de botón primario |
| Estado | `--success` | `#5fc57d` | resultado correcto, activo, ganado | botones |

- Selección: `--grass-tint-strong` (`#223f26`) de fondo (filtro activo, fila seleccionada, módulo activo del navbar) y `--grass-border` (`rgba(140,201,143,.55)`). `--grass-tint` (`rgba(140,201,143,.15)`) para fondos suaves.
- Foco: borde `--grass` más `--focus-ring` (`0 0 0 3px rgba(140,201,143,.28)`).
- El botón outline es neutro: fondo `--btn-outline-bg`, borde `--btn-outline-border`, texto `--btn-outline-fg` y hover con borde `--text-secondary`; no lleva verde.
- El tablero de Inicio (§9): el fondo es igual en los dos temas; el acento (`--on-board-accent`) es `#91da40` en claro y `#8cc98f` en oscuro, y los tokens del tablero tienen valor propio (no siguen a `--grass`).

### 5.4 Equipos y estados

| Rol | Texto | Tinte | Borde | Sólido |
|---|---|---|---|---|
| Propio | `--grass` | | | |
| Rival | `--team-rival` `#93b4e0` | | | |
| Éxito | `--success` `#5fc57d` | `--success-tint` | `--success-border` | |
| Advertencia | `--warning` `#e9b54f` | `--warning-tint` | `--warning-border` | |
| Error | `--error` `#f07a72` | `--error-tint` | `--error-border` | `--error-solid` `#b03838` con texto blanco |

Reglas de uso:
- **Ámbar** = falta algo que el usuario puede completar (sin jugador, cola de revisión, cambios sin enviar, por jugar). Nunca para errores.
- **Rojo** = algo falló, se rechazó o se pierde (error al guardar, 409, partido perdido, eliminar, cerrar sesión). El sólido `--error-solid` es para confirmar un borrado.
- **Verde de estado ≠ verde de acción ≠ verde de marca.** El de estado nunca va en un botón.
- **Información** es neutra (`--text-secondary` sobre `--veil`): el azul es del rival.
- **Siempre ícono + texto:** el color solo no alcanza.
- **Roles de usuario** (azules desaturados, distintos por luminosidad y no solo por tono): Admin `--navy` `#a9bfdd`, Coach `--blue-mid` `#6fa3d8`, Jugador `--player` `#b3b6bc`. El rival no usa `--navy`: usa `--team-rival` (`#93b4e0`), que en claro sigue valiendo `--navy`. El texto sobre un relleno `--navy` usa `--on-navy` (`#0f1012` en oscuro).

### 5.5 Captura en vivo

- **Cabecera (HUD), en los dos temas:** sin logo. A la izquierda «‹ Partidos» y «Estadísticas»; al centro el marcador (puntaje propio en `--score-own`: `--grass-deep` en claro y `--grass` en oscuro; rival en `--team-rival`), el reloj en un carril (`--hud-well`) con el botón de pausa y el período en píldora; a la derecha «Finalizar partido», «Deshacer» y tres íconos cuadrados de 44 px: tema, historial y sincronización (caja con `--success-tint` o `--warning-tint` según el estado). Botones con radio 10 px y borde `--ctl-border` (`#858b7e` en claro, `--border-strong` en oscuro), en Inter y JetBrains Mono. Hasta 1279 px el marcador baja a una segunda fila.
- **Oscuro:** cabecera y pie hundidos (`--hud-bg` = `--surface-sunken`), reloj en carril (`--hud-well` = `--surface-track`) con sombra interior, hover en `--surface-hover`, foco en `--grass` y diálogos sobre `--surface-overlay` con `--scrim` detrás. `.live-capture[data-theme="dark"]` ya no define neutros propios: hereda los del sistema.
- **Claro (solo color):** `.live-capture[data-theme="light"]` define sus neutros locales en cal (`--bg` `#eef0ea`, `--surface-alt` `#f6f7f3`, texto `#1b2116`, `--border` `#dcdfd7`); cabecera y pie blancos; reloj en pozo (`--hud-well` `#f6f7f3`, sombra interior `0 1px 3px rgba(16,24,16,.08)`) con el botón de pausa en `--btn-primary-bg`; hover neutro (`--navy-100` `#eef0ea`); `--score-own` es `--grass-deep` (`#204b22`). «Posesión propia» activa va en `--btn-primary-bg` con el check en `--brand-signature` y «Posesión rival» inactiva en blanco con borde `#858b7e` y texto `--team-rival`. El diálogo de confirmación usa tokens (superficie, `--border-sport`, tintes de éxito, botón botella).
- **La posesión conserva su color de fondo** en los dos temas, también en claro (verde, azul y rojo saturados detrás de los botones): `--bg-own` verde, `--bg-away` rojo, `--bg-neutral` azul. La barra dice «Posesión propia» y «Posesión rival», con un check en la activa y radio 10 px; en oscuro, «Propia» activa va en `--btn-primary-bg` y «Rival» inactivo en `--team-rival`.
- **Botones de jugadas:** radio 12 px, en Inter; en oscuro borde `rgba(255,255,255,.16)` y sombra para recortarse sobre el fondo de posesión, y en claro borde `rgba(0,0,0,.08)` con sombra `inset 0 1px 0 rgba(255,255,255,.18), 0 4px 10px rgba(16,24,16,.14)`. El relleno sigue saliendo de `eventVariant()` (rotación por posición, igual en claro y oscuro: en el catálogo actual cada jugada de Puntuación tiene su color). Esos rellenos (`#57AD16`, `#C6403A`, `#F5821F`, `#7952B3`) conservan los colores de siempre; el verde y el naranja dan menos de 4,5 : 1 con texto blanco. Tarjeta amarilla y roja llevan un chip con el color de la tarjeta (por `event.code`).
- **Rótulos de categoría:** JetBrains Mono en mayúsculas, sin indicador de color.
- **Pausa:** el fondo «respira» entre el color de la posesión y el cal liso. En claro lo hace la animación `live-capture-pause-pulse-light`; en oscuro el pulso original no mezcla (ver §5.9).
- La pantalla sigue a pantalla completa, sin navbar (§6, regla 5).

### 5.6 Jugadas por categoría (post-partido)

La línea de tiempo y la tabla de Eventos colorean cada jugada con `resolveEventColor()` (`post-match/utils/match-review.utils.ts`), que devuelve un token `--event-*` según el nombre del evento. En claro cada token vale el color de siempre (salvo el naranja, oscurecido a `#b8560a` para llegar a 4,80 : 1 con texto blanco y 4,58 : 1 sobre el carril); en oscuro toma la variante clara de su categoría, legible sobre el carril (≥ 7 : 1).

| Token | Reglas de nombre | Claro | Oscuro | Categoría |
|---|---|---|---|---|
| `--event-try`, `--event-kick` | try; drop, conversión | `#2e7d32`, `#7c3aed` | `#e2b54a` | Puntuación |
| `--event-tackle`, `--event-tackle-missed` | tackle; tackle fallado | `#16324f`, `#2563eb` | `#72c6d1` | Defensa |
| `--event-penalty` | penal, infracción, tarjetas | `#b42318` | `#a7adbb` | Neutro / disciplina |
| `--event-set-piece` | line, scrum | `#b8560a` | `#79a6ec` | Juego fijo |
| `--event-turnover` | turnover | `#b8560a` | `#e9925a` | Cambio de posesión |
| `--event-default` | el resto | `#204b22` | `#74c785` | Ataque |

«Sin jugador» usa en claro los tokens `--unassigned-*`: chip con borde `1px dashed #b7791f` sobre `#fff8ea` y texto `--warning`; fila pendiente con fondo `#fff8ea` y barra izquierda de 3 px `#b7791f`; marcadores rayados a 135° (`#b7791f` y `#fff4dc`, franjas de 3 px). En oscuro el rayado va en ámbar sobre ámbar apagado (`--warning` y `--warning` al 38 % sobre `--surface-track`), con borde `--warning-border`: sin el contraste de cinta de advertencia que tenían el naranja y el blanco. Es igual en la línea de tiempo y en la leyenda del KPI; el contador usa `--warning`.

### 5.7 Zonas

- **Cancha:** `--pitch-a` `#18241b`, `--pitch-b` `#1c2a20`, `--pitch-ingoal` `#142018` y líneas `rgba(255,255,255,.30)`, definidos en `rugby-field`. El chip de zona (I1…D6) es un chip hundido (`--bg` al 72 %) con `--text-primary`.
- **Calor:** `--zone-heat-low` `#544a16` → `--zone-heat-high` `#fb982c`, mezclados con `--zone-heat-mix` (62 % en claro, 88 % en oscuro). La escala es relativa al máximo mostrado y tiene hasta cuatro niveles con color; con cuatro quedan en `#4d4517`, `#7e5c1d`, `#af7324` y `#e08a2a`: más eventos, más luz, y cada escalón se separa 1,48 : 1 o más.
- **Conteo:** chip hundido (`--surface-sunken`, borde `--border-strong`, texto `--text-primary`), legible sobre cualquier nivel.
- **Tramos asignados:** en oscuro, fondo `--score-pill-bg` (`#204b22`), borde `--btn-primary-bg` y texto `--text-primary`; no forman una pared brillante ni compiten con el botón primario. La selección usa el acento (`--grass`). Los controles del panel (Lateral, − +, minutos) usan superficies del sistema.
- Los botones `.btn-outline` locales usan `--btn-outline-bg` para no quedar blancos en oscuro.

### 5.8 Contrastes (WCAG 2.x, calculados)

Mínimos: 4,5 : 1 para texto y 3 : 1 para bordes de controles.

| Par | Ratio |
|---|---|
| `--text-primary` sobre hundido / lienzo / superficie / superficie alt / cabecera / overlay | 16,74 / 16,28 / 15,18 / 13,80 / 12,79 / 12,29 |
| `--text-secondary` sobre las mismas | 9,63 / 9,37 / 8,74 / 7,94 / 7,36 / 7,07 |
| `--text-muted` sobre las mismas | 6,13 / 5,96 / 5,56 / 5,05 / 4,68 / **4,50** |
| `--grass` sobre superficie / overlay / `--grass-tint-strong` | 9,19 / 7,44 / 6,01 |
| `--border-strong` sobre lienzo / superficie / overlay | 4,67 / 4,36 / 3,53 |
| Blanco sobre `--btn-primary-bg` / hover / `--error-solid` / `#204b22` | 5,41 / 4,74 / 6,05 / 10,04 |
| `--success` / `--warning` / `--error` sobre superficie | 8,26 / 9,46 / 6,54 |
| `--team-rival` sobre superficie | 8,32 |
| `--navy` (Admin) / `--blue-mid` (Coach) sobre superficie y sobre su tinte | 9,45 y 6,95 / 6,68 y 5,25 |
| `--event-*` (seis categorías) sobre el carril | 7,57 a 9,77 |
| `--on-navy` sobre `--navy` | 10,14 |
| `#ededef` sobre un tramo `#204b22`; borde `--btn-primary-bg` sobre superficie | 8,59; 3,28 |
| `--on-board-accent` `#8cc98f` sobre `#204b22` | 5,20 |
| `#ededef` sobre el fondo de posesión propia / rival / neutra | 6,24 / 8,24 / 9,54 |
| `#204b22` como texto sobre superficie | **1,77: prohibido** |

`--text-muted` sobre overlay pasa con 4,5009 : 1, sin margen: no bajar su valor.

### 5.9 Límites conocidos

- `--border-strong` (`#7a7e86`) también lo usan divisores y marcas finas de la línea de tiempo y de las estadísticas: se ven más claros que en el diseño anterior.
- El pulso de pausa original de Captura en vivo usa `color-mix(..., --bg)` sin `var()` y no mezcla; el claro tiene su propia animación y en oscuro sigue sin pulsar (arreglarlo cambiaría el oscuro).
- Los colores de jugadas dependen del nombre del evento (no de su categoría del catálogo): «Kick-off», «Maul» y «Quick play» caen en `--event-default` (Ataque), y Tackle completado y fallado comparten color en oscuro (se distinguen por carril). Pasar a `groupName` cambiaría el claro.
- Fuera de alcance por ser funciones nuevas: tarjetas con degradé y borde superior iluminado, el chip «Sin asignar» con borde punteado y el rayado «sin jugador», la tarjeta de detalle de zona, botones sobre el tablero e íconos en los avisos.

### 5.10 Cómo agregar o cambiar un color oscuro

1. Buscá un token que ya tenga ese rol. Si existe, usalo: no hace falta un override oscuro.
2. Si el rol no existe, creá un token en `[data-theme="dark"]`. Si lo va a usar una regla que también aplica en claro, definilo en `:root` con el valor claro actual.
3. Antes de borrar un override oscuro, aplicá las trampas de `docs/styles/refactor-styles.md` §4 (especificidad con encapsulado, estados, varias clases en un elemento, `@media` global, override que hace de fondo base).
4. Verificá los contrastes y recorré las pantallas en claro y oscuro (390, 1024 y 1440 px).

---

## 6. Reglas de Oro para Desarrolladores y Agentes

1. **Nunca inventar colores ni sombras:** Usar estrictamente los tokens definidos en este sistema.
2. **Respetar la jerarquía visual de botones:**
   - Verde Rugby / Botella (`#204b22` o `--btn-invite`): Únicamente para la acción principal más importante de la pantalla (uno por pantalla; sobre el tablero de Inicio el primario es blanco).
   - Outline Blanco Deportivo (`.btn-outline`): Para acciones secundarias, filtros o cancelar.
   - Rojo destructivo (tokens `--error`, `--error-tint` y `--error-border`): Reservado para eliminar o cerrar sesión.
3. **Mantener la consistencia de elevación:** Toda tarjeta, tabla o contenedor de datos debe tener borde de `2px` con radio redondeado (`16px` o `20px`) y sombra de elevación profunda.
4. **Las acciones de una vista viven en la barra de esa vista:** el encabezado común solo contiene lo que vale para todas las vistas (volver, etiqueta, título, marcador, hora y selector de vistas), para que quede en las mismas coordenadas en todas.
5. **No alterar ni forzar contenedores en Carga en Vivo ni Entretiempo:** Dichas pantallas (`/live-capture/:matchId` y `/live-capture/:matchId/halftime`) son instrumentos tácticos especializados para tablet en tiempo real; deben mantenerse a pantalla completa y están exentas de `.layout-container`.
6. **Tema único:** Carga en Vivo y Entretiempo leen y cambian el mismo `ThemeService` que el navbar y el menú de usuario. Su botón de tema cambia el modo claro/oscuro de toda la app, y la elección se conserva (clave `ovaltrack_theme`).
7. **Uso obligatorio de `.layout-container.page`:** Toda nueva pantalla o flujo de gestión debe construirse dentro de `.layout-container.page` para garantizar alineación pixel-perfect con la Navbar.
8. **El lima solo sobre verde botella:** `--brand-signature` va únicamente sobre `#204b22` o `#163618` (tablero de Inicio, «En vivo», emblemas, check de «Posesión propia»). Nunca sobre fondo claro ni gris; en claro `--grass` es botella (§1.2).
9. **El estado solo aparece cuando no es el normal:** una cuenta activa no lleva rótulo «Activo»; sí lo lleva la inactiva, siempre con ícono + texto. El verde de estado (`--success*`) no va en botones.
10. **JetBrains Mono solo para números, tiempos, marcadores, códigos y rótulos `.label-mono`.** Las frases van en Inter (por ejemplo «Sin partido programado»).
11. **Encabezado único en las pantallas de gestión:** `.hud` + `.hud-text` (rótulo `.label-mono`, título Hanken 800 y subtítulo), sin píldoras de rótulo ni `.eyebrow` (§3.2).
12. **Cambiar el claro sin mover el oscuro:** si una regla clara usa un literal y no tiene override oscuro, fijá primero el valor oscuro de hoy antes de tocar el claro (§5.1).

---

## 7. Arquitectura de Layout y Contenedores Unificados

El sistema de interfaz de OvalTrack implementa una arquitectura de layout fluida y sincronizada entre la barra de navegación superior (`NavbarComponent`) y las vistas de la aplicación, desacoplada mediante variables CSS en el contenedor raíz `.app-shell`:

### 7.1 Tokens de Layout (`:root`)
```css
:root {
  --layout-max: 1180px;   /* Ancho máximo estándar para vistas de gestión */
  --layout-pad: 24px;     /* Padding lateral en desktop */
  --layout-pad-y: 24px;   /* Separación superior entre Navbar y contenido */
}

@media (max-width: 768px) {
  :root {
    --layout-pad: 16px;   /* Padding lateral reducido en tablet/móvil */
    --layout-pad-y: 16px;
  }
}

/* Modificador activado en .app-shell para vistas analíticas de alta densidad */
.layout-wide {
  --layout-max: 1560px;
}
```

### 7.2 Clases de Layout Universales
1. **`.layout-container`:** Clase compartida utilizada tanto en el interior de la Navbar como en las páginas. Aplica la fórmula moderna:
   ```css
   .layout-container {
     width: min(100% - 2 * var(--layout-pad), var(--layout-max));
     margin-inline: auto;
   }
   ```
2. **`.page`:** Define el espaciado vertical estandarizado de las páginas ruteadas:
   ```css
   .page {
     padding-block: var(--layout-pad-y) 64px;
   }
   ```

### 7.3 Flujo y Reglas de Vistas
* **Vistas de Gestión (Estándar):**
  - Club, Divisiones, Miembros, Fixture, Panel de Inicio (`/home`), Admin OvalTrack (`/admin/ovaltrack`).
  - Utilizan `.layout-container.page` (o `.app` por compatibilidad retroactiva).
  - Ancho máximo acotado a `1180px` centrado.
* **Vistas Analíticas Densas (Wide):**
  - Revisión post-partido (`/post-match/:id`).
  - Declaran `data: { layout: 'wide' }` en [app.routes.ts](file:///home/gonzalolopez/Documentos/Proyectos/ovaltrack/frontend/src/app/app.routes.ts).
  - `LayoutService` activa automáticamente la clase `.layout-wide` en `.app-shell`, expandiendo simultáneamente la Navbar y el contenido a `1560px` con alineación vertical milimétrica.
* **Vistas Especializadas Exentas (Pantalla Completa):**
  - Captura en vivo (`/live-capture/:matchId`) y Resumen táctico de entretiempo (`/live-capture/:matchId/halftime`).
  - Declaran `data: { navbar: 'hidden' }`, ocultan la Navbar y no consumen `.layout-container`, operando al 100% del viewport en tablets.

---

## 8. Estación de Trabajo Post-Partido (Post-Match Workstation)

> **Ubicación:** `/post-match/:id`  
> **Modo de pantalla:** `.layout-wide` (ancho sincronizado a 1560px con la Navbar).

La pantalla de post-partido está estructurada como una estación de trabajo de alta densidad orientada al análisis táctico y corrección de video, eliminando el doble scroll y garantizando ergonomía táctil en tablets.

### 8.1 Grilla CSS Grid y Viewport Lock
- **Desktop ($\ge 1121\text{px}$):**
  - El shell (`PostMatchShellComponent`) bloquea el viewport solo en Eventos (`data.lockViewport`): `.pm-shell--locked` con `height: calc(100dvh - var(--navbar-h, 64px) - 26px);` y columna flex (encabezado de alto automático + vista con `flex: 1`). Así Eventos ocupa el alto restante sin depender de la altura del encabezado.
  - El padding superior (14px, 6px con alto ≤ 800px) y el gap (8px, 6px) de la shell son los mismos en las tres vistas, y `html:has(.pm-shell)` reserva el espacio de la barra de scroll (`scrollbar-gutter: stable`): así el encabezado queda en las mismas coordenadas aunque Zonas y Estadísticas scrolleen y Eventos no. Las vistas no agregan padding ni margen superior propio.
  - La vista Eventos (`.pm`) ocupa el 100% de ese espacio con:
    ```css
    grid-template-areas:
      "kpi kpi"
      "timeline inspector"
      "table inspector";
    grid-template-columns: minmax(0, 1fr) 320px;
    grid-template-rows: auto auto minmax(0, 1fr);
    ```
  - La tabla aloja un `cdk-virtual-scroll-viewport` vertical que aprovecha todo el espacio remanente del viewport.
- **Tablet y Mobile ($< 1121\text{px}$):**
  - Flujo vertical a 1 columna: `kpi`, `timeline`, `table` (el encabezado común va arriba, fuera de la grilla).
  - La tarjeta de tabla adopta altura fija de `470px` y `padding-bottom` extra para dar despeje al inspector flotante.

### 8.2 Componentes de la Estación de Trabajo
1. **Encabezado común (`PostMatchHeaderComponent` dentro de `PostMatchShellComponent`):**
   - Compartido por Eventos (`/post-match/:id`), Zonas (`/zones`) y Estadísticas (`/statistics`), que son rutas hijas del shell.
   - Rótulo mono fijo `ANÁLISIS • POST-PARTIDO` (`.label-mono`, sin píldora; volver al inicio se hace desde el logo de la barra), píldora de marcador con `--score-pill-bg` / `--score-pill-fg` (mono tabular) y línea inferior siempre `Hora de inicio HH:MM:SS`.
   - Burbuja flotante animada `.score-delta-badge` (`+5`), con `scoreDeltaPop` y temporizador de 3 segundos (solo cuando Eventos la informa).
   - Selector de vistas en la misma fila del título: `routerLink` + `routerLinkActive` (`aria-current="page"`), contenedor `--surface-segment` y vista activa **blanca elevada** (en oscuro, `--surface-overlay` con `--text-primary`; el verde queda para filtros). Entre 960px y 1279px comparte fila con el partido (si no entra, baja a su propia fila); con < 960px baja a su propia fila con tres partes iguales.
   - El encabezado no tiene acciones propias de una vista: el selector queda siempre pegado al borde derecho. Lo que es de una vista vive en la barra de esa vista (p. ej. «Agregar evento», en la barra de Eventos).
2. **Tira Condensada de KPIs (`PostMatchKpiStripComponent`):**
   - Altura de 44px con 3 secciones: total de eventos, conteo de jugadas sin jugador con botón `"Ver pendientes ›"` y porcentaje de carga con barra de progreso verde.
3. **Timeline Táctico Compacto (`PostMatchTimelineComponent`):**
   - Su barra de herramientas aloja los filtros, el buscador y la acción primaria `+ Agregar evento` (`.btn-primary-rugby`), ambos de 36px con mouse y 44px en pantallas táctiles (`--toolbar-ctl-h`) a la derecha, separada por un divisor `--border-strong`. Atajo `N` (`aria-keyshortcuts`). La acción queda fija a la derecha. **< 1000px** de tarjeta (`@container timeline-card`) la acción pasa a botón «+» con `aria-label` (mismo `--toolbar-ctl-h`).
   - **Búsqueda:** con lugar es un campo visible de 220–250px a la izquierda de la acción, con una × interna que borra el texto. El componente mide el ancho real de la barra (filtros, incluido el lugar reservado de «Limpiar filtros», y la acción) y solo si el campo no entra lo pliega a una lupa (36px con mouse, 44px tocables). Abierta, crece sobre el espacio libre de la fila sin ocultar los filtros; si no queda lugar (< 180px), la búsqueda y la acción quedan arriba y los filtros pasan a una segunda línea. Nunca se pliega con texto; Esc la cierra solo si está vacía. Con la lupa, si los filtros no entran scrollean en horizontal con un degradado a la derecha.
   - **«Limpiar filtros»:** botón de texto fantasma (no verde: el verde es "filtro aplicado"), 44px tocables, al final del grupo de filtros después de un divisor. Aparece solo si algo difiere del estado por defecto (período, posesión, «Solo sin jugador» o búsqueda); limpia todo, búsqueda incluida, y deja el foco en «Todo el partido». El estado vacío de la tabla repite la acción como botón outline.
   - El modal de alta abre con el período del filtro activo (o del evento seleccionado) y sugiere su tiempo, con una etiqueta de origen por campo. Si los filtros ocultan el evento creado, un toast ofrece «Mostrar evento» o «Limpiar filtros».
   - Altura de carril `--lane-h: 32px;` y marcadores de jugada de `20px`.
   - Container Queries (`@container (max-width: 650px)`) para abreviar nombres largos (*Infracción*, *Penal palos*, *Tackle ✓*, etc.).
4. **Tabla Cronológica (`PostMatchTableComponent`):**
   - Columnas (`--table-cols`): `PERÍODO` (56px) | `JUEGO` (64px) | `VIDEO` (64px) | `JUGADA` (1fr) | `JUGADOR` (1.1fr) | `ZONA` (40px) | `NOTA` (1.5fr) | `ACCIÓN` (72px).
   - **Zona (solo lectura):** solo la etiqueta mono (C4) en `--text-secondary`, sin mini mapa (el mini mapa queda en el inspector); tooltip y `aria-label` con el nombre completo («Centro · Campo rival»). Sin zona: «—» gris, sin ámbar (son muchos). La zona se edita solo en Zonas.
   - Selector inline `[ Sin asignar ▾ ]`: chip con borde discontinuo ámbar (`--unassigned-border`, `#b7791f`), fondo crema (`--unassigned-bg`, `#fff8ea`), texto `--warning` y desplegable nativo sin solapamiento de virtual scroll.
5. **Inspector Dual y Formulario Reactivo (`PostMatchPanelComponent`):**
   - **Desktop:** Columna lateral fija de 320px con solapas `[Ver]` y `[Editar]`.
   - **Eliminar:** mismo estilo que el de la fila seleccionada de la tabla (ícono con borde rojo claro, lleno al pasar el cursor), en el borde derecho de la barra `[Ver | Editar]` y en los dos modos; 28px visibles y 44px tocables, con tooltip y `aria-label` «Eliminar evento» y la confirmación de siempre. El pie de Editar solo dice «Los cambios se guardan automáticamente».
   - **Zona (solo lectura):** en «Ver», una fila de una línea del alto de los demás atributos, justo después de Jugador: mini mapa + etiqueta + ›. Toda la fila es el enlace a Zonas (`?tramo=<id>`, o `?minuto=<n>` si no tiene zona); el detalle (lateral, franja, tramo y tiempo añadido) va en el tooltip y el `aria-label`. Sin zona: «Sin zona» en ámbar (`--warning`). El tiempo añadido se rotula «T. añadido».
   - **Prioridad de la cola (desktop):** la cola de revisión muestra solo los ítems que entran completos en el alto libre (mínimo 2), sin barra de scroll, y suma los que no entran al aviso «+N más en la tabla» (misma utilidad de desborde que «Huecos sin zona»: `utils/list-overflow.ts`). Si los atributos del evento no entran, scrollean dentro del bloque de detalle (el título queda fijo) con un degradado abajo que avisa que hay más.
   - **Tablet/Mobile:** Bottom Sheet flotante con estado *peek* (comprimido con handle, stepper `‹ 1 de 4 ›`, selector rápido y botón Editar) y estado *open* (expandido al 78vh con backdrop blur).
   - **Autoguardado con Debounce:** Pipeline RxJS con `debounceTime(400)` e indicador visual en tiempo real (`Guardando...`, `Guardado ✓`, `Error al guardar`; durante el debounce de la edición ya se muestra `Guardando...`, sin estado "pendiente" aparte).
   - **Cola de Revisión:** Tarjetas compactas (`02:36 Penal / infracción 1T`) con resaltado ámbar al seleccionar y stepper rápido.
   - **`EventFormComponent` Reutilizable:** Componente común compartido entre el inspector y el modal de alta, asegurando consistencia y mantenibilidad (SRP/DRY).
   - **Zona fija por el tipo:** si el tipo de jugada fija la zona (Try, Try penal), el formulario muestra «Se ubica en D6 · In-goal rival» (`.zone-placement`, 0.75rem, `--text-secondary`, ícono `bi-geo-alt`) bajo el campo que fija la fila (el lado del apoyo) o, si la regla no depende de un atributo, bajo el tipo. El tooltip de la zona en «Ver» agrega «zona fija por el tipo».
6. **Zonas de cancha (`PostMatchZonesComponent`, `/post-match/:id/zones`):**
   - **Barra de la pantalla:** tiempo (Todo / 1T / 2T) y posesión, más la ayuda «?». Valen para la grilla y la cancha.
   - **Encabezado del mapa (`.map-header`):** sobre la cancha, el título «Eventos por zona» / «Minutos por zona» (`.map-title`, `--font-head`) y, a su lado, el selector de tipo de jugada (`.type-select`, mismo alto táctil que las píldoras) y las píldoras Eventos / Minutos. El tipo solo cambia la cancha y el detalle, no la grilla. En Minutos el tipo se deshabilita (un tramo no lo tiene); la posesión sigue activa porque filtra la grilla, y la leyenda de la cancha aclara «Minutos: no se filtra por posesión» (`.heat-legend-note`, `--text-muted`).
   - **KPI (`ZoneKpiStripComponent`):** con jugadas sin zona, «N sin zona» es un botón (`.kpi-link`: número ámbar, rótulo y `bi-chevron-right`) que abre la lista de esas jugadas; con 0 es solo un número.
   - **Grilla de territorio (`ZoneTerritoryGridComponent`):** tramos como bloques `--btn-primary-bg` con **solo la letra del lateral** (I, C o D; el detalle va en el tooltip y el `aria-label`) y huecos con rayado `--warning-tint`. Los carriles de in-goal son finos (`--lane-h: 22px`) y solo alojan puntos: no se crean tramos ahí.
   - **Punto de zona (◆):** rombo de solo lectura de 12px, **relleno** `--navy` con borde 2px `--surface`, rotado 45°, en la franja y el minuto de cada evento de zona fija (Try, Try penal). No es un tramo: no se selecciona, no ocupa rango y no bloquea el arrastre. Al señalarlo se dibuja un anillo `--navy`. Dos o más a menos de 12px se agrupan en un círculo de 18px con el número (`.is-cluster`, texto `--on-navy`); el `title` y el `aria-label` los listan. Su `title` y `aria-label` explican el corte por minuto entero: «Try 05:11 · D6 · el tramo llega hasta 05:59 (termina en 6′)»: se nombra el último segundo cubierto y el minuto de fin queda entre paréntesis, porque «termina en 6′» solo sonaba a que el try fue a las 6.
   - **Línea de corte:** fina (1px `--text-muted`) y **no permanente**: se dibuja solo para los cortes que toca el rango que se edita o arrastra (los que cruza y los que caen justo en su inicio o su fin) (resaltada, 2px `--navy`, si además se señala ese rombo). Señalar el rombo **no** dibuja la línea, que quedaría pegada a él: resalta el fin del tramo que cortó con una barra de 4px `--brand-signature` en su borde derecho (`.block.is-cut-edge`; el lima va sobre el verde botella del bloque), en cualquier franja. Si ningún tramo termina en el corte, el tooltip del rombo dice «ningún tramo llega hasta 05:59 (terminaría en 6′)». Un Kick H o un drop convertido no tiene rombo: su corte solo se ve como línea junto al rango en edición, con el tope «tope: Kick H 30:10» al arrastrar. El **entretiempo** es la línea más fuerte de la grilla (sólida, 2px `--text-secondary`). No hay tira de letras sobre el eje: el rombo es la única señal del tanto.
   - **Arrastre:** crear o estirar frena en el corte con el aviso del tooltip en vivo «tope: Try 22:30», igual que en el entretiempo o en un tramo vecino. Un clic o Enter en un hueco propone solo el segmento hasta el próximo corte.
   - **Cancha (`RugbyFieldComponent`):** el calor usa una **escala relativa** al máximo mostrado (jugadas o minutos): cuartiles de las celdas con valor, con hasta cuatro niveles ámbar → naranja, y la leyenda muestra los rangos reales («1–2 · 3–4 · 5–7 · 8–10»). El «0» de la leyenda usa `--pitch-a`, el verde de la celda vacía. Tocar una celda, también las del in-goal, fija su detalle.
   - **Detalle de la celda (`ZoneCellDetailComponent`):** al costado de la cancha (proyectado con `ng-content`), tarjeta con borde `--border-sport-subtle`. Muestra las jugadas de la celda señalada o tocada (reloj, tipo, equipo y «Zona fija por el tipo» o «Tramo 1T 20'–25'»), o sus tramos con su duración en Minutos. La misma tarjeta muestra las **jugadas sin zona**: las que caen en huecos van en una línea (`.detail-gaps`: «22 jugadas en 3 huecos · Ver huecos») que lleva a «Huecos sin zona» del panel (en móvil abre la hoja), y el resto (celda prohibida o sin tiempo) se lista una por una con su motivo y su arreglo («Abrir tramo» o «Ver en Eventos»); la lista scrollea por dentro (máx. 220px) y sus botones miden 32px, 44px con puntero táctil.
   - **Panel de tramos (`ZoneAssignmentPanelComponent`):** al confirmar «Hasta», con ± o al precargar un hueco, un rango que cruza un tanto termina solo en el corte y lo avisa con una nota informativa (`.preview`: «El tramo llega hasta 22:59 (termina en 23′) por el Try 22:30»). El error del rango (`.inline-error`) conserva el texto del 409 (solape, celda prohibida o corte por try). Después de guardar un tramo que termina en un tanto, el asistente propone la zona del saque (campo propio si el tanto fue nuestro, campo rival si fue del rival). Con todo el tiempo cubierto pero jugadas sin zona dice «Tiempo cubierto · N jugadas sin zona» (`.match-complete.is-pending`, número como enlace); «Partido completo» solo cuando no queda ninguna.
   - **Aviso del recorte en Eventos:** cargar o editar en Eventos un tanto dentro de un tramo muestra un toast con el recorte que hace el backend («El tramo C4 20′–30′ ahora termina en 23′ · 23′–30′ quedó como hueco») y Eventos refleja el tramo acortado y la zona de las jugadas que quedaron después, sin recargar.
   - **Ayuda «?»:** explica punto y tramo, el in-goal, Eventos / Minutos, las jugadas sin zona y la regla del corte en «Rango del tramo», incluida la razón de los minutos enteros (con un try a las 5:11, el tramo llega hasta 5:59). No hay tokens ni íconos nuevos.

---

## 9. Inicio · Pizarra de juego (`/home`)

Reglas propias del Inicio con sesión (la landing pública no cambia). Se suman a las anteriores; el lienzo (`.layout-container.page`, fondo cal global) no cambia.

1. **Tablero oscuro verde botella, uno por pantalla.** Degradé de 135° entre `--board-bg-start` y `--board-bg-end`, radio 24px (20px en ≤ 700px) y `--board-shadow`. Contiene el próximo partido, el día de partido, el partido en curso o el onboarding.
2. **Sobre el tablero, el primario es blanco** (`.btn-on-board`); su secundario es `.btn-on-board-outline`. Nunca hay otro primario sólido en la pantalla.
3. **Tarjeta `.tile`** sin cabecera en degradé: borde 2px `--border-sport`, radio 18px, `--shadow-elevation`, padding 20px; el rótulo (`.label-mono`) y el título van en el cuerpo.
4. **Pestañas `.tabs-underline`** (división activa, serie del gráfico): subrayado en la activa, 44px de alto, scroll interno en celular.

### 9.1 Tokens nuevos (`:root`)
El fondo y los rótulos del tablero son iguales en claro y oscuro. Sus tokens tienen valor propio y no siguen a `--grass` ni a `--zone-heat-low`, para que cambiar la paleta oscura no los arrastre; solo el acento y el chip «ok» tienen una variante oscura.

| Token | Valor |
|---|---|
| `--board-bg-start` / `--board-bg-end` | `#204b22` / `#163618` |
| `--board-line` / `--board-line-strong` | `rgba(255,255,255,.10)` / `rgba(255,255,255,.22)` |
| `--board-shadow` | `0 18px 40px rgba(15,35,15,.28)` |
| `--on-board` / `--on-board-muted` | `#ffffff` / `rgba(255,255,255,.72)` |
| `--on-board-accent` | `var(--brand-signature)` = `#a3e635` (claro, 6,66 : 1 sobre `#204b22`) / `#8cc98f` (oscuro, 5,20 : 1) |
| `--board-chip-ok-bg/fg` | `rgba(145,218,64,.30)` (claro) / `rgba(140,201,143,.30)` (oscuro) / `#ffffff` |
| `--board-chip-warn-bg/fg` | `#fdb022` / `#3d2600` |
| `--board-chip-neutral-bg/fg` | `rgba(255,255,255,.12)` / `#ffffff` |
| `--board-digit-bg/border` | `rgba(255,255,255,.08)` / `rgba(255,255,255,.22)` |
| `--btn-on-board-bg/fg` | `#ffffff` / `var(--btn-primary-bg)` |
| `--btn-on-board-outline` | `rgba(255,255,255,.55)` |

### 9.2 Color de los datos
- Propio: `--btn-primary-bg`. Rival y promedio: `--text-muted`.
- Mejor: `--success`. Peor: `--error`. Pendiente: `--warning`.
- Las variaciones siempre llevan texto (`▼ −17 p.p. · peor`); el color solo no alcanza.
- La barra de análisis usa `--success` (≥ 90 %), `--warning` (≥ 60 %) y `--error`, con el porcentaje escrito.

### 9.3 Tipografía
- h1 (`.hud-title`, global desde §3.2): Hanken 800, 44/32px, tracking −.03em. Título del tablero: Hanken 800, 52/36px. Título de tarjeta: Hanken 800, 20px.
- Rótulo (`.label-mono`): Mono 700, 12px, mayúsculas, tracking .12em. Los encabezados no llevan píldoras: `.eyebrow` ya no existe.
- Marcador: Mono 700, 104/72px tabular. Cuenta regresiva: Mono 52/36px en cajas de 84/64px. Hora de inicio: Mono 60px. KPIs: Mono 34–44px.

---

## 10. Organización de los estilos

Cada estilo vive en el nivel más chico que lo cubre; si lo usan más pantallas, sube un nivel:

1. **Global (`frontend/src/styles.css`):** tokens, base, layout y las clases que usan varias features (`.hud`, `.hud-text`, `.hud-brand` y `.hud-brand--fluid` (solo Divisiones), botones, `.form-card*`, `.filters`/`.chip`, `.status-badge`, `.empty-state`, `.feedback-state`, etc.). El modo oscuro de estas clases se resuelve con los tokens de `[data-theme="dark"]` (§5); no se repite el valor en un override.
2. **CSS compartido de feature (`features/<dominio>/styles/*.css`):** lo que repiten varias pantallas de una misma feature. Se incluye con `styleUrls` antes del CSS del componente (por ejemplo `['../styles/kpi-strip.css', './x.component.css']`), así conserva el encapsulado de Angular. Hoy: `admin/styles/admin-panel.css`, `auth/styles/register-form.css`, `match/post-match/styles/{kpi-strip,filter-pills}.css`, `match/styles/{match-stats,match-shared}.css`, `division/styles/{division-lists,division-forms}.css`, `home/views/styles/home-views.css`.
3. **CSS del componente (`*.component.css`):** solo lo específico de esa pantalla.

Reglas al tocar estilos:
- Los `@keyframes` se declaran en el mismo archivo que la regla que los usa (Angular renombra los keyframes por hoja de estilos).
- Un CSS compartido no debe alcanzar a un componente que no lo necesita: antes de incluirlo, comprobar que ninguna regla pueda matchear elementos de su plantilla.
- Un override oscuro (`:host-context([data-theme="dark"])`) usa tokens, no colores escritos a mano (§5.1). Borrarlo solo si el token vale lo mismo en claro y en oscuro, y ninguna regla de estado (`:hover`, `.active`) o de otra clase del mismo elemento compite por la propiedad.
- No usar `var(--token, valor)` con tokens definidos en `:root`: el respaldo nunca se aplica.
- El nombre `.state-box` no es global: existe con estilos distintos en entretiempo, invitación y el shell de post-partido. El estado de pantalla común es `.feedback-state`.

### 10.1 Íconos y Bootstrap generados, fondos fijos y presupuesto

Dos piezas del CSS global (los íconos y la hoja de Bootstrap) **no se editan a mano**: se generan y se commitean, así `./ds up`, `./ds pwa` y el deploy automático no necesitan pasos extra.

- **Íconos (`frontend/src/icons/`):** Bootstrap Icons (`bi bi-*`) y Tabler (`ti ti-*`) se cargan solo con los glifos que usan las plantillas y los `.ts` (115 de unos 8.000: 12,8 KB de fuentes en lugar de 1 MB). Las clases, los códigos y los dibujos son los de las librerías. Se regeneran con `python3 frontend/scripts/icons/build-icon-subset.py` (requiere `fonttools` y `brotli`, y `node_modules` copiado del contenedor con `./ds sync-node`; ver la cabecera del script). Se importan desde `styles.css` con `@import "./icons/icons.css"`.
- **Bootstrap (`frontend/src/bootstrap/bootstrap-subset.css`):** `angular.json` carga este archivo en lugar de `bootstrap.min.css`. Conserva, sin tocar y en el mismo orden, las reglas sin clases (reboot, `:root`) y las que nombran clases que alguna plantilla o `.ts` menciona; una regla con una clase que nadie usa no puede coincidir con ningún elemento, así que ningún ganador cambia. Se regenera con `docker exec -u "$(id -u):$(id -g)" ovaltrack-frontend node scripts/bootstrap/build-bootstrap-subset.mjs`. Bootstrap aporta estilos a clases usadas por nombre aunque no sea la intención (`.bi`, `.card-title`, `.card-header` y `.card-subtitle` sin `.card`, `.figure`, `.carousel`, `.small`, `.container`): se conservan porque sus nombres aparecen en las plantillas.
- **Comprobación en el build:** `npm run build` (lo que usan `Dockerfile.pwa` y Vercel) corre `scripts/check-icons.mjs` y `build-bootstrap-subset.mjs --check` y falla, con la lista, si una pantalla usa un ícono o una clase de Bootstrap que el archivo generado no tiene. `ng serve` (`./ds up`) no corre esas comprobaciones: un ícono o una clase faltante se vería sin estilo en desarrollo, así que hay que regenerar antes de commitear.
- **Fondos fijos:** `body` conserva `background-attachment: fixed` (en iOS el `fixed` ya se comporta como `scroll`: pasarlo a un seudoelemento fijo cambiaría lo que se ve ahí). `.halftime-page` no lo usa: su fondo ocupa justo el viewport.
- **Presupuesto:** el bundle inicial pesa unos 750 kB contra un presupuesto de 1 MB; ninguna optimización tocó `angular.json` más que la hoja de Bootstrap.
