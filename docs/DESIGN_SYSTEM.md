# OvalTrack — Sistema de Diseño Oficial (Design System)

> **Estado:** Activo y alineado al 100% con la interfaz del frontend.  
> **Identidad Visual:** *Sport Pro Salvia & Grafito con verde botella* (Estética deportiva de alto rendimiento, contrastes tácticos y elevación física).

Este documento es la **fuente de verdad definitiva y obligatoria** para el diseño y desarrollo de todas las vistas del frontend de OvalTrack. Cualquier componente o pantalla nueva debe construirse respetando los tokens, patrones y lineamientos aquí descritos.

---

## 1. Tokens de Color Globales (`:root`) — Diseño Actual Activo

Los tokens oficiales del sistema corresponden a la identidad visual **Sport Pro Salvia** actualmente implementada en el frontend.

### 1.1 Paleta Activa (Modo Claro Deportivo — Vistas de Gestión)

```css
:root {
  /* Lienzo y Fondo de Cancha */
  --bg: #f6f7f1;
  --bg-canvas: #e1edde;                       /* Fondo base verde salvia deportivo suave (luminoso hacia blanco) */
  --bg-canvas-pattern: rgba(55, 75, 60, 0.14); /* Líneas tácticas a 135deg */

  /* Superficies y Tarjetas Elevadas */
  --surface: #ffffff;                         /* Tarjetas principales, modales y tablas */
  --surface-alt: #eef1e7;                     /* Fondos secundarios, chips y segmentos */
  --surface-hover: #f1f3ea;                   /* Estados hover en filas y botones */
  --surface-header-start: #edf5e9;            /* Degradado superior cabecera tarjeta */
  --surface-header-end: #e0ebd8;              /* Degradado inferior cabecera tarjeta */
  --surface-toolbar: #eaf3e6;                 /* Barra de filtros segmentada */

  /* Bordes de Elevación Deportiva */
  --border: rgba(27, 33, 22, 0.10);          /* Separadores y bordes sutiles */
  --border-strong: rgba(27, 33, 22, 0.22);   /* Bordes de inputs e interacción */
  --border-sport: rgba(32, 75, 34, 0.28);    /* Borde firme 2px en tarjetas y modales */
  --border-sport-subtle: rgba(32, 75, 34, 0.20); /* Separadores internos de tarjetas */

  /* Textos y Tipografías */
  --text-primary: #1b2116;                   /* Títulos y textos de alto contraste */
  --text-secondary: #4b5540;                 /* Subtítulos, descripciones y labels */
  --text-muted: #7c8571;                     /* Placeholders y contadores */

  /* Colores de Acento y Acción */
  --btn-primary-bg: #204b22;                 /* Verde rugby botella (CTA principal) */
  --btn-primary-fg: #ffffff;                 /* Texto blanco sobre verde botella */
  --btn-primary-hover: #163618;              /* Hover de acción principal */
  --btn-outline-bg: #ffffff;                 /* Fondo botón secundario */
  --btn-outline-border: rgba(32, 75, 34, 0.25);
  --btn-outline-fg: #204b22;

  /* Semántica de Roles y Estados */
  --navy: #16324f;                           /* Identidad Admin Club / Foco */
  --navy-tint: rgba(22, 50, 79, 0.08);
  --navy-border: rgba(22, 50, 79, 0.30);
  --blue-mid: #2b6ca3;                       /* Identidad Coach / Analista */
  --blue-mid-tint: rgba(43, 108, 163, 0.08);
  --player: #6b6f5f;                         /* Identidad Jugador / Neutro */
  --player-tint: rgba(20, 25, 15, 0.05);

  /* Feedback y Alertas */
  --success: #2e7d32;
  --success-tint: rgba(46, 125, 50, 0.12);
  --warning: #8a5700;
  --warning-tint: rgba(253, 176, 34, 0.20);
  --error: #b42318;
  --error-tint: rgba(240, 68, 56, 0.14);
  --error-border: rgba(180, 35, 24, 0.35);

  /* Calor de la cancha de zonas (post-partido): escala secuencial ámbar → naranja */
  --zone-heat-low: #fdb022;
  --zone-heat-high: #d9480f;

  /* Píldora de marcador del encabezado de análisis post-partido: un solo estilo en Eventos, Zonas y Estadísticas */
  --score-pill-bg: #204b22;
  --score-pill-fg: #ffffff;

  /* Geometría y Sombras */
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;
  --radius-xl: 20px;
  --radius-pill: 999px;
  --shadow-elevation: 0 16px 36px rgba(15, 35, 15, 0.12), 0 4px 12px rgba(15, 35, 15, 0.06);
  --shadow-button: 0 4px 12px rgba(32, 75, 34, 0.20);
  --shadow-button-hover: 0 6px 16px rgba(32, 75, 34, 0.28);

  /* Compartidos con el modo oscuro (§5.1): en claro valen la superficie y la sombra de siempre */
  --surface-sunken: var(--surface);
  --surface-overlay: var(--surface);
  --shadow-navbar: 0 4px 14px rgba(20, 45, 20, 0.08);
}
```

---

## 2. Tipografía

El sistema utiliza tres familias tipográficas de Google Fonts cargadas globalmente:

```html
<link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@600;700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600;700&display=swap" rel="stylesheet">
```

| Familia | Pesos | Uso principal |
|---|---|---|
| **Hanken Grotesk** (`--font-head`) | 700, 800 | Títulos de página (HUD), encabezados de tarjetas, títulos de modales y logos. |
| **Inter** (`--font-body`) | 400, 500, 600, 700 | Textos de interfaz, inputs, tablas, botones, descripciones y badges. |
| **JetBrains Mono** (`--font-mono`) | 500, 600, 700 | Dorsales, emails, contadores, timestamps y datos numéricos/estadísticos. |

---

## 3. Componentes Base Globales

### 3.1 Fondo de Cancha Salvia Deportivo
El fondo global de las pantallas de gestión aplica un lienzo verde salvia suave y luminoso `#e1edde` con líneas tácticas diagonales sutiles:

```css
body {
  background-color: #e1edde;
  background-image: 
    radial-gradient(ellipse at 50% 30%, rgba(225, 237, 222, 0.92) 0%, rgba(225, 237, 222, 0.65) 35%, rgba(225, 237, 222, 0.15) 65%, transparent 80%),
    repeating-linear-gradient(135deg, rgba(55, 75, 60, 0.14) 0px, rgba(55, 75, 60, 0.14) 1.5px, transparent 1.5px, transparent 54px);
  background-attachment: fixed;
  color: #1b2116;
  font-family: var(--font-body);
}
```

### 3.2 Page Header (HUD Integrado)
Cabecera estática superior (sin efecto glassmorphism flotante ni fondos oscuros pesados) que unifica el título y la acción principal:

```html
<header class="hud">
  <div class="hud-brand">
    <div class="badge-tech">
      <span>Categorías & Planteles</span>
    </div>
    <div class="brand-text">
      <h1 class="title">Divisiones & Planteles</h1>
      <p class="club">Administra las categorías competitivas y planteles activos</p>
    </div>
  </div>

  <div class="hud-actions">
    <button type="button" class="btn btn-invite">+ Nueva División</button>
  </div>
</header>
```

- `.badge-tech`: Píldora en fondo `#d6eac0`, borde `1px solid rgba(36, 76, 9, 0.25)` y texto `#244c09`.
- `.title`: Tipografía `Hanken Grotesk` 800, tamaño `2rem` (32px), color `#111d0e`.
- `.club`: Tamaño `14px`, peso 500, color `#3b4e33`.

### 3.3 Botones

```css
/* Botón de Acción Principal (CTA Rugby) */
.btn-invite, .btn-primary-rugby {
  height: 44px;
  padding: 0 20px;
  border-radius: 10px;
  background-color: #204b22;
  color: #ffffff;
  font-weight: 700;
  border: 1px solid #204b22;
  box-shadow: 0 4px 12px rgba(32, 75, 34, 0.20);
  transition: all 0.15s ease;
}
.btn-invite:hover {
  background-color: #163618;
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(32, 75, 34, 0.28);
}

/* Botón Secundario / Outline Deportivo */
.btn-outline {
  height: 44px;
  padding: 0 20px;
  border-radius: 10px;
  background-color: #ffffff;
  border: 1px solid rgba(32, 75, 34, 0.25);
  color: #204b22;
  font-weight: 600;
  box-shadow: 0 2px 6px rgba(20, 45, 20, 0.04);
}
.btn-outline:hover {
  background-color: #f2f7ef;
  border-color: #204b22;
  color: #142e15;
  transform: translateY(-1px);
}
```

### 3.4 Tarjetas Elevadas de Formulario y Contenido (`.form-card`, `.match-card-shell`, etc.)
Estructura en dos capas con cabecera en degradé suave y cuerpo blanco puro con bordes de 2px:

```css
.form-card {
  background: #ffffff;
  border: 2px solid rgba(32, 75, 34, 0.28);
  border-radius: 20px;
  box-shadow: 0 16px 36px rgba(15, 35, 15, 0.12), 0 4px 12px rgba(15, 35, 15, 0.06);
  overflow: hidden;
}

.form-card-header {
  background: linear-gradient(180deg, #edf5e9 0%, #e0ebd8 100%);
  border-bottom: 2px solid rgba(32, 75, 34, 0.20);
  padding: 24px 32px 20px;
}

.form-card-title {
  font-family: var(--font-head);
  font-weight: 800;
  font-size: 20px;
  color: #111d0e;
}
```

### 3.5 Controles de Formulario (`.form-control`)
Inputs y selects con altura táctil accesible (46px), bordes salvia y foco verde bosque:

```css
.form-control {
  width: 100%;
  height: 46px;
  background: #ffffff;
  border: 1px solid rgba(32, 75, 34, 0.22);
  border-radius: 10px;
  color: #111d0e;
  padding: 0 14px;
  font-size: 14.5px;
}
.form-control:focus {
  border-color: #204b22;
  box-shadow: 0 0 0 3px rgba(32, 75, 34, 0.15);
  background: #fafdf9;
}
```

---

## 4. Patrones de Pantalla Implementados

### 4.1 Barra de Navegación Global (`NavbarComponent`)
Barra superior **sólida, blanca (`--surface`), sin efecto vidrio**, de ancho completo (no usa `.layout-container`): el logo y el avatar no cambian de lugar entre pantallas. El margen lateral es `clamp(var(--layout-pad), 3vw, 56px)`. `position: sticky`, `z-index: 1030`, alto `var(--navbar-h)`.

- **Estructura:** logo (lleva a `/home`; reemplaza a "Volver al inicio"), nombre del club debajo del logo (solo > 1120px y fuera de post-partido), módulos, y a la derecha partido en vivo, sincronización y avatar.
- **Módulos por rol** (catálogo único `core/navigation/navigation-modules.ts`; un módulo sin `route` no se muestra): Admin de club → Inicio, Partidos, Divisiones, Club, Miembros · Entrenador/Analista → Inicio, Partidos, Divisiones (Reportes cuando exista su ruta) · Jugador → Inicio, Estadísticas (Partidos cuando exista su ruta) · Admin OvalTrack → Inicio, Administración. La pantalla actual se resalta en verde claro (`--grass-tint-strong`, `aria-current="page"`).
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
  - Tarjetas de información organizadas en grid (2px borders, headers en degradé salvia).
  - Botón de activación: `✏️ Editar información`.
- **Modo Edición Condicional:**
  - Clona un borrador independiente (`clubDraft`) sin mutar el estado global hasta guardar.
  - Inputs editables con focus verde rugby y feedback de validación.
  - Botones de acción `Cancelar` y `Guardar cambios`.
  - Sincronización instantánea con el `UserContextService` y la barra de navegación global al guardar.

### 4.4 Listados y Tablas de Planteles (`/divisions/:id/players`, `/divisions/:id/coaches`, `/members`)
- **Cabeceras de Tabla Salvia:** Fondo `#edf5e9`, borde `2px solid rgba(32, 75, 34, 0.20)`, títulos en uppercase y tracking deportivo.
- **Filas Elevadas:** Fondo blanco `#ffffff`, hover `#f1f3ea`, borde inferior sutil.
- **Avatares de Iniciales:** Círculos de 40px con borde de rol específico (Navy para Admin, Blue para Coach, Salvia para Jugador).
- **Selector de Rol Personalizado:** Popover dropdown a medida (no `<select>` nativo del navegador).
- **Barra de Guardado en Lote (`.batch-bar`):** Flotante en la parte inferior cuando existen cambios sin persistir (`is-dirty`).

### 4.5 Fixture y Selección de Partidos (`/match-selection`)
- **Toolbar de Filtros:** Contenedor en `#eaf3e6` con pestañas segmentadas redondeadas (Todos, Por Jugar, En Curso, Finalizados, Cancelados).
- **Tarjetas de Partidos (`.match-card-shell`):**
  - Badge de estado con indicador luminoso pulsante para partidos `in_progress`.
  - Sección central con tipografía destacada de rival `"VS CLUB_OPONENTE"`.
  - Badges de fecha y marcador parcial/final con tipografía JetBrains Mono.
  - Botón de eliminación discreto en la esquina superior.
  - Acción contextual en pie de tarjeta (`Definir alineación →`, `Capturar en vivo →`, `Ver resumen →`).

### 4.6 Captura en Vivo (`/live-capture/:matchId`)
- **Entorno Especializado de Cancha:** Interfaz de alto contraste, táctil (hit-target mínimo de 48px), optimizada para tablets en tiempo real.
- **Marcador e Instrumentos:** Cronómetro de partido y marcador en `Space Grotesk` / `JetBrains Mono`.
- **Aislamiento:** No incluye la barra de navegación estándar para maximizar el área de control e impedir clics accidentales durante el juego.

---

## 5. Modo oscuro: Grafito con verde botella

El modo oscuro es la segunda cara de la misma identidad, no un tema aparte: **grafito neutro con luz desde arriba**, el verde de marca como señal y color solo donde significa algo. El modo claro (*Sport Salvia*) no cambia. Lo elige el `ThemeService` (clave `ovaltrack_theme`, oscuro por defecto) y se aplica con `data-theme="dark"` en `<html>`.

### 5.1 Cómo se resuelve

- **Todo vive en tokens.** Los valores están en el bloque `[data-theme="dark"]` de `frontend/src/styles.css`. Un componente nunca escribe un color oscuro a mano: usa `var(--token)`. Los pocos literales que quedan en reglas oscuras son deliberados (sombra de la hoja inferior, halo del marcador seleccionado, verde de marca de la mini cancha y de la pelota, colores locales de la cancha nocturna).
- **Token solo oscuro:** se define únicamente en `[data-theme="dark"]` y se usa solo en reglas oscuras (`--canvas-image`, `--veil`, `--surface-track`, `--scrim`, `--team-rival`, `--focus-ring`, `--shadow-overlay`, `--shadow-elevation-hover`, `--error-solid`, `--success-border`).
- **Token compartido:** si lo usa una regla que aplica en los dos temas, se define también en `:root` con el valor que ya producía el claro (`--surface-sunken`, `--surface-overlay`, `--shadow-navbar`). Así el claro no cambia.
- Los nombres de los tokens existentes no cambian: solo cambian sus valores en oscuro.

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
- El tablero de Inicio (§9) es igual en los dos temas: sus tokens tienen valor propio y no siguen a `--grass`.

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
- **Roles de usuario:** `--navy` pasa a `#6a9df8` (sobre su tinte daba 4,03 : 1); `--blue-mid` `#60a5fa`; `--player` `#b3b6bc`.

### 5.5 Captura en vivo

- **El HUD** (cabecera, reloj, botones y barra de posesión) usa la paleta grafito: cabecera y pie hundidos (`--hud-bg` = `--surface-sunken`), reloj en carril (`--hud-well` = `--surface-track`) con sombra interior, botones con `--border-strong` y hover en `--surface-hover`, diálogos sobre `--surface-overlay` con `--scrim` detrás. `.live-capture[data-theme="dark"]` ya no define neutros propios: hereda los del sistema. Los `--hud-*` valen en claro lo de siempre.
- **La posesión conserva su color de fondo** en los dos temas: `--bg-own` verde, `--bg-away` rojo, `--bg-neutral` azul. «Propia» activa va en `--btn-primary-bg` con texto blanco; «Rival» inactivo, en `--team-rival`.
- **Los botones de jugadas no cambian.** Su color sale de una rotación por posición (`eventVariant()`), no de la categoría ni del catálogo, y es el mismo en claro y oscuro. Pintarlos por categoría sería una función nueva.
- La pantalla sigue a pantalla completa, sin navbar (§6, regla 5).

### 5.6 Zonas

- **Cancha:** `--pitch-a` `#18241b`, `--pitch-b` `#1c2a20`, `--pitch-ingoal` `#142018` y líneas `rgba(255,255,255,.30)`, definidos en `rugby-field`. El chip de zona (I1…D6) es un chip hundido (`--bg` al 72 %) con `--text-primary`.
- **Calor:** `--zone-heat-low` `#8a6a12` → `--zone-heat-high` `#ffb23f`. La escala se interpola entre los dos tokens y se mezcla al 62 % sobre la cancha: más eventos, más luz. Es una rampa, no cinco tonos fijos.
- Los botones `.btn-outline` locales usan `--btn-outline-bg` para no quedar blancos en oscuro.

### 5.7 Contrastes (WCAG 2.x, calculados)

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
| `--navy` sobre superficie | 6,59 |
| `#ededef` sobre el fondo de posesión propia / rival / neutra | 6,24 / 8,24 / 9,54 |
| `#204b22` como texto sobre superficie | **1,77: prohibido** |

`--text-muted` sobre overlay pasa con 4,5009 : 1, sin margen: no bajar su valor.

### 5.8 Límites conocidos

- `--border-strong` (`#7a7e86`) también lo usan divisores y marcas finas de la línea de tiempo y de las estadísticas: se ven más claros que en el diseño anterior.
- El pulso de pausa de Captura en vivo usa `color-mix(..., --bg)` sin `var()` y no mezcla; arreglarlo cambiaría el claro.
- Fuera de alcance por ser funciones nuevas: tarjetas con degradé y borde superior iluminado, el chip «Sin asignar» con borde punteado y el rayado «sin jugador», la tarjeta de detalle de zona, botones sobre el tablero e íconos en los avisos.

### 5.9 Cómo agregar o cambiar un color oscuro

1. Buscá un token que ya tenga ese rol. Si existe, usalo: no hace falta un override oscuro.
2. Si el rol no existe, creá un token en `[data-theme="dark"]`. Si lo va a usar una regla que también aplica en claro, definilo en `:root` con el valor claro actual.
3. Antes de borrar un override oscuro, aplicá las trampas de `docs/styles/refactor-styles.md` §4 (especificidad con encapsulado, estados, varias clases en un elemento, `@media` global, override que hace de fondo base).
4. Verificá los contrastes y recorré las pantallas en claro y oscuro (390, 1024 y 1440 px).

---

## 6. Reglas de Oro para Desarrolladores y Agentes

1. **Nunca inventar colores ni sombras:** Usar estrictamente los tokens definidos en este sistema.
2. **Respetar la jerarquía visual de botones:**
   - Verde Rugby / Botella (`#204b22` o `--btn-invite`): Únicamente para la acción principal más importante de la pantalla.
   - Outline Blanco Deportivo (`.btn-outline`): Para acciones secundarias, filtros o cancelar.
   - Rojo destructivo (tokens `--error`, `--error-tint` y `--error-border`): Reservado para eliminar o cerrar sesión.
3. **Mantener la consistencia de elevación:** Toda tarjeta, tabla o contenedor de datos debe tener borde de `2px` con radio redondeado (`16px` o `20px`) y sombra de elevación profunda.
4. **Las acciones de una vista viven en la barra de esa vista:** el encabezado común solo contiene lo que vale para todas las vistas (volver, etiqueta, título, marcador, hora y selector de vistas), para que quede en las mismas coordenadas en todas.
5. **No alterar ni forzar contenedores en Carga en Vivo ni Entretiempo:** Dichas pantallas (`/live-capture/:matchId` y `/live-capture/:matchId/halftime`) son instrumentos tácticos especializados para tablet en tiempo real; deben mantenerse a pantalla completa y están exentas de `.layout-container`.
6. **Tema único:** Carga en Vivo y Entretiempo leen y cambian el mismo `ThemeService` que el navbar y el menú de usuario. Su botón de tema cambia el modo claro/oscuro de toda la app, y la elección se conserva (clave `ovaltrack_theme`).
7. **Uso obligatorio de `.layout-container.page`:** Toda nueva pantalla o flujo de gestión debe construirse dentro de `.layout-container.page` para garantizar alineación pixel-perfect con la Navbar.

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
   - Etiqueta fija `ANÁLISIS POST-PARTIDO` (volver al inicio se hace desde el logo de la barra), píldora de marcador con `--score-pill-bg` / `--score-pill-fg` (mono tabular) y línea inferior siempre `Hora de inicio HH:MM:SS`.
   - Burbuja flotante animada `.score-delta-badge` (`+5`), con `scoreDeltaPop` y temporizador de 3 segundos (solo cuando Eventos la informa).
   - Selector de vistas en la misma fila del título: `routerLink` + `routerLinkActive` (`aria-current="page"`), contenedor gris claro y vista activa **blanca elevada** (el verde queda para filtros). Entre 960px y 1279px comparte fila con el partido (si no entra, baja a su propia fila); con < 960px baja a su propia fila con tres partes iguales.
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
   - Columnas (`--table-cols`): `PERÍODO` (56px) | `JUEGO` (64px) | `VIDEO` (64px) | `JUGADA` (1fr) | `JUGADOR` (1.1fr) | `ZONA` (48px) | `NOTA` (1fr) | `ACCIÓN` (72px).
   - **Zona (solo lectura):** solo la etiqueta mono (C4) en `--text-secondary`, sin mini mapa (el mini mapa queda en el inspector); tooltip y `aria-label` con el nombre completo («Centro · Campo rival»). Sin zona: «—» gris, sin ámbar (son muchos). La zona se edita solo en Zonas.
   - Selector inline `[ Sin asignar ▾ ]`: chip con borde discontinuo ámbar (`#d97706`), fondo crema (`#fffdf0`) y desplegable nativo sin solapamiento de virtual scroll.
5. **Inspector Dual y Formulario Reactivo (`PostMatchPanelComponent`):**
   - **Desktop:** Columna lateral fija de 320px con solapas `[Ver]` y `[Editar]`.
   - **Eliminar:** mismo estilo que el de la fila seleccionada de la tabla (ícono con borde rojo claro, lleno al pasar el cursor), en el borde derecho de la barra `[Ver | Editar]` y en los dos modos; 28px visibles y 44px tocables, con tooltip y `aria-label` «Eliminar evento» y la confirmación de siempre. El pie de Editar solo dice «Los cambios se guardan automáticamente».
   - **Zona (solo lectura):** en «Ver», una fila de una línea del alto de los demás atributos, justo después de Jugador: mini mapa + etiqueta + ›. Toda la fila es el enlace a Zonas (`?tramo=<id>`, o `?minuto=<n>` si no tiene zona); el detalle (lateral, franja, tramo y tiempo añadido) va en el tooltip y el `aria-label`. Sin zona: «Sin zona» en ámbar (`--warning`). El tiempo añadido se rotula «T. añadido».
   - **Prioridad de la cola (desktop):** la cola de revisión muestra solo los ítems que entran completos en el alto libre (mínimo 2), sin barra de scroll, y suma los que no entran al aviso «+N más en la tabla» (misma utilidad de desborde que «Huecos sin zona»: `utils/list-overflow.ts`). Si los atributos del evento no entran, scrollean dentro del bloque de detalle (el título queda fijo) con un degradado abajo que avisa que hay más.
   - **Tablet/Mobile:** Bottom Sheet flotante con estado *peek* (comprimido con handle, stepper `‹ 1 de 4 ›`, selector rápido y botón Editar) y estado *open* (expandido al 78vh con backdrop blur).
   - **Autoguardado con Debounce:** Pipeline RxJS con `debounceTime(400)` e indicador visual en tiempo real (`Guardando...`, `Guardado ✓`, `Error al guardar`; durante el debounce de la edición ya se muestra `Guardando...`, sin estado "pendiente" aparte).
   - **Cola de Revisión:** Tarjetas compactas (`02:36 Penal / infracción 1T`) con resaltado ámbar al seleccionar y stepper rápido.
   - **`EventFormComponent` Reutilizable:** Componente común compartido entre el inspector y el modal de alta, asegurando consistencia y mantenibilidad (SRP/DRY).


---

## 9. Inicio · Pizarra de juego (`/home`)

Reglas propias del Inicio con sesión (la landing pública no cambia). Se suman a las anteriores; el lienzo (`.layout-container.page`, fondo salvia global) no cambia.

1. **Tablero oscuro verde botella, uno por pantalla.** Degradé de 135° entre `--board-bg-start` y `--board-bg-end`, radio 24px (20px en ≤ 700px) y `--board-shadow`. Contiene el próximo partido, el día de partido, el partido en curso o el onboarding.
2. **Sobre el tablero, el primario es blanco** (`.btn-on-board`); su secundario es `.btn-on-board-outline`. Nunca hay otro primario sólido en la pantalla.
3. **Tarjeta `.tile`** sin cabecera en degradé: borde 2px `--border-sport`, radio 18px, `--shadow-elevation`, padding 20px; el rótulo (`.label-mono`) y el título van en el cuerpo.
4. **Pestañas `.tabs-underline`** (división activa, serie del gráfico): subrayado en la activa, 44px de alto, scroll interno en celular.

### 9.1 Tokens nuevos (`:root`)
Valores iguales en claro y oscuro: el tablero conserva sus colores en los dos temas. Los tokens del tablero tienen valor propio y no siguen a `--grass` ni a `--zone-heat-low`, para que cambiar la paleta oscura no los arrastre.

| Token | Valor |
|---|---|
| `--board-bg-start` / `--board-bg-end` | `#204b22` / `#163618` |
| `--board-line` / `--board-line-strong` | `rgba(255,255,255,.10)` / `rgba(255,255,255,.22)` |
| `--board-shadow` | `0 18px 40px rgba(15,35,15,.28)` |
| `--on-board` / `--on-board-muted` | `#ffffff` / `rgba(255,255,255,.72)` |
| `--on-board-accent` | `#91da40` (5,89 : 1 sobre `#204b22`) |
| `--board-chip-ok-bg/fg` | `rgba(145,218,64,.30)` / `#ffffff` |
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
- h1: Hanken 800, 44/32px, tracking −.03em. Título del tablero: Hanken 800, 52/36px. Título de tarjeta: Hanken 800, 20px.
- Rótulo (`.label-mono`): Mono 700, 12px, mayúsculas, tracking .12em. No usar `.eyebrow`, que es la píldora navy global.
- Marcador: Mono 700, 104/72px tabular. Cuenta regresiva: Mono 52/36px en cajas de 84/64px. Hora de inicio: Mono 60px. KPIs: Mono 34–44px.

---

## 10. Organización de los estilos

Cada estilo vive en el nivel más chico que lo cubre; si lo usan más pantallas, sube un nivel:

1. **Global (`frontend/src/styles.css`):** tokens, base, layout y las clases que usan varias features (`.hud`, `.hud-brand`, `.hud-brand--fluid`, botones, `.form-card*`, `.filters`/`.chip`, `.status-badge`, `.empty-state`, `.feedback-state`, etc.). El modo oscuro de estas clases se resuelve con los tokens de `[data-theme="dark"]` (§5); no se repite el valor en un override.
2. **CSS compartido de feature (`features/<dominio>/styles/*.css`):** lo que repiten varias pantallas de una misma feature. Se incluye con `styleUrls` antes del CSS del componente (por ejemplo `['../styles/kpi-strip.css', './x.component.css']`), así conserva el encapsulado de Angular. Hoy: `admin/styles/admin-panel.css`, `auth/styles/register-form.css`, `match/post-match/styles/{kpi-strip,filter-pills}.css`, `match/styles/{match-stats,match-shared}.css`, `division/styles/{division-lists,division-forms}.css`, `home/views/styles/home-views.css`.
3. **CSS del componente (`*.component.css`):** solo lo específico de esa pantalla.

Reglas al tocar estilos:
- Los `@keyframes` se declaran en el mismo archivo que la regla que los usa (Angular renombra los keyframes por hoja de estilos).
- Un CSS compartido no debe alcanzar a un componente que no lo necesita: antes de incluirlo, comprobar que ninguna regla pueda matchear elementos de su plantilla.
- Un override oscuro (`:host-context([data-theme="dark"])`) usa tokens, no colores escritos a mano (§5.1). Borrarlo solo si el token vale lo mismo en claro y en oscuro, y ninguna regla de estado (`:hover`, `.active`) o de otra clase del mismo elemento compite por la propiedad.
- No usar `var(--token, valor)` con tokens definidos en `:root`: el respaldo nunca se aplica.
- El nombre `.state-box` no es global: existe con estilos distintos en entretiempo, invitación y el shell de post-partido. El estado de pantalla común es `.feedback-state`.
