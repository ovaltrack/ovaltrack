# Refactor de estilos del frontend (`refactor/styles`)

Contexto para entender y retomar la limpieza de CSS de OvalTrack sin releer el repo. Complementa `docs/DESIGN_SYSTEM.md` (sección 10) y `docs/REFACTORING.md`. Si algo no coincide, manda el código.

## 1. Objetivo y restricciones

1. Eliminar código muerto o deprecado de los estilos.
2. Eliminar duplicación y seguir la metodología de la app: lo que cruza pantallas va al global, lo específico al CSS de la pantalla.
3. SOLID sin sobreingeniería: se consolida solo con ≥ 3 consumidores, o con 2 consumidores y un bloque idéntico grande (≥ ~15 líneas).
4. **No cambiar cómo se ve ninguna pantalla** (claro y oscuro). Es mejora de código, no de diseño.

Decisiones del usuario: literal → token solo si el token vale lo mismo en claro y en oscuro; la duplicación dentro de una feature va a un CSS compartido de la feature (`styleUrls`); un solo PR (`refactor/styles`).

## 2. Estado

- Rama `refactor/styles`: ver `git log main..refactor/styles` (`main` no se tocó); incluye 3 commits `fix(styles)` de correcciones. Las ramas `refactor/styles-dead-code` (fase 1) y `refactor/styles-deduplicacion` (fase 2) quedaron incluidas y son redundantes.
- Resultado: CSS de 20.492 a 18.561 líneas; `opponent-manager` deja de cargar ~1.300 líneas de Partidos; bundle inicial ~ −2,8 kB.
- Correcciones tras comparar contra `main` (commits `fix(styles)`): se restauraron la animación `modalIn` del modal de Partidos y Rivales (el `@keyframes` debe vivir en la misma hoja que la regla `animation`), el padding del botón del pie del modal de alta post-partido en celular y el fondo `--surface` de `.sheet-wrapper` en oscuro. Caso latente: se quitó `.status-chip--danger`; hoy no se ve porque `derived-metrics.ts` nunca devuelve `danger`, pero `MetricStatusType` lo permite.
- **Optimización de rendimiento (misma rama, sin cambio visual):** el CSS global pasó de 586 KB a 72 KB y el bundle inicial de 1,27 MB a 750 kB (presupuesto 1 MB): íconos en subconjunto de fuente (`src/icons/`), Bootstrap en subconjunto (`src/bootstrap/bootstrap-subset.css`), 42 overrides oscuros iguales a la base borrados, 14 pares de reglas idénticas agrupados y `.halftime-page` sin `background-attachment: fixed`. Los archivos generados, cómo regenerarlos y qué comprobaciones corren en el build están en `DESIGN_SYSTEM.md` §10.1 y `AGENTS.md`.
- Verificado: build de producción OK, `./ds test-front` en verde (448 pruebas), comparación de equivalencia por selector, clases usadas siguen definidas. **Falta la verificación visual manual** (390/1024/1440 px, claro y oscuro); la lista de pantallas está en el PR.
- La rama `fix/theme-live-capture` (sale de `refactor/styles`, PR aparte) hace que Captura en vivo y Entretiempo usen `ThemeService`, el mismo tema claro/oscuro que el resto de la app. Cambia comportamiento, no es parte del refactor.
- `supp/refactor-styles/` (ignorado por git) tiene `cambios.txt` (resumen para el grupo) y `pr.md` (título y descripción del PR).

## 3. Cómo quedaron organizados los estilos

Tres niveles (detalle en `DESIGN_SYSTEM.md` §10):

1. **Global** `frontend/src/styles.css`: tokens, base, layout y clases usadas por varias features.
2. **CSS compartido de feature** `features/<dominio>/styles/*.css`, incluido con `styleUrls: ['<compartido>', './x.component.css']` (el compartido primero).
3. **CSS del componente**: solo lo específico.

| Archivo compartido                                                                                    | Lo incluyen                                                        |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `admin/styles/admin-panel.css`, `auth/styles/register-form.css`, `legal/legal-page.css` (ya existían) | tablas/diálogos de admin; formularios de registro; páginas legales |
| `match/post-match/styles/kpi-strip.css`                                                               | `post-match-kpi-strip`, `zone-kpi-strip`                           |
| `match/post-match/styles/filter-pills.css`                                                            | `post-match-zones`, `post-match-timeline`                          |
| `match/styles/match-stats.css`                                                                        | `halftime-summary`, `current-stats-modal`                          |
| `match/styles/match-shared.css`                                                                       | `match-selection`, `opponent-manager`                              |
| `division/styles/division-lists.css`                                                                  | `division-list`, `division-coach-list`, `division-player-list`     |
| `division/styles/division-forms.css`                                                                  | `division-form`, `division-player-form`                            |
| `home/views/styles/home-views.css`                                                                    | `admin-home`, `coach-home`, `player-home`                          |

Globales nuevos: `.feedback-state` (+ `--error`; estado de carga/error de Zonas, Estadísticas y Estadísticas de jugador) y `.hud-brand--fluid`. Se eliminó `src/styles/ovaltrack-tokens.css` (las fuentes Manrope/Space Grotesk y `--ot-radius-md` están en `styles.css`) y `src/styles/live-capture.css`. En Inicio del entrenador `.pending-*` pasó a `.inbox-*`.

## 4. Trampas que hay que respetar (aprendidas en el proceso)

1. **Especificidad con encapsulado.** Una regla de componente lleva `[_ngcontent]`: `.x` pesa 0,2,0 y gana a `.x` global (0,1,0) y a estados de Bootstrap como `.btn:hover` o `.btn:disabled` (0,2,0, anteriores). Borrar una propiedad "idéntica" a la global en `.btn*` o `.form-control` cambia el comportamiento en `:hover`/`:disabled`/`a:hover`. Esas clases se excluyen.
2. **Overrides oscuros y estados.** `:host-context([data-theme="dark"]) .x` pesa más que `.x.active`/`.x:hover` claros. Borrar el override oscuro de `.x` deja que la regla clara de estado le gane a la oscura base. Los overrides de `:hover`/`.active` se dejaron.
3. **Varias clases en un mismo elemento.** Ej.: `status-pill status-not_started` en `match-selection`: `.status-pill` (0,2,0, posterior) pisaba el fondo claro del estado, y borrar el override oscuro habría mostrado el color claro en oscuro. Antes de borrar un override, mirar las otras clases del elemento en la plantilla; si hay clases dinámicas (`[ngClass]`, `{{ }}`) no se toca.
4. **`@keyframes` por hoja de estilos.** Angular renombra los keyframes en cada hoja; la regla que los usa debe estar en el mismo archivo (por eso `spin` quedó junto a `.spinner` y no en `match-stats.css`).
5. **Fugas de un CSS compartido.** Cada componente incluye _todo_ el compartido: hay que comprobar que ninguna regla pueda matchear elementos de la plantilla de un componente que no la tenía. Ocurrió con `@media .app` y `.form-actions` (se separó `division-forms.css`).
6. **Orden de la cascada al mover reglas.** El compartido va primero; una regla local de igual especificidad que antes aparecía antes de la movida pasaría a ganar. Comparar orden, especificidad, propiedades y elemento.
7. **Fallbacks de `var()`.** `var(--x, valor)` con `--x` definido en `:root` equivale a `var(--x)`. No tocar tokens locales ni indefinidos (`--danger`, `--accent`, `--heat`, `--role-*`).
8. **Nombres que chocan.** `.state-box`, `.scoreboard`, `.custom-input`, `.spinner`, `.status-chip` existen con estilos distintos en varias pantallas: nada de eso va a global con el mismo nombre.
9. **Reglas globales dentro de `@media`.** Borrar una regla de componente "igual a `.btn` global" no basta si un global con `@media` la pisa: en celular `.btn-invite { padding: 0 16px }` (`@media (max-width: 760px)`) le ganó al botón del pie del modal de alta post-partido. Antes de borrar, buscar la clase en los `@media` de `styles.css`.
10. **Override oscuro que hace de fondo base.** Si la regla base de `.x` solo existe dentro de un `@media`, el override `:host-context([data-theme="dark"]) .x` puede ser lo único que le da fondo fuera de ese `@media` (pasó con `.sheet-wrapper`). Borrarlo lo deja transparente en otros anchos.
11. **Captura en vivo y entretiempo** son pantalla completa (DESIGN_SYSTEM §6.5): se compartió CSS, no se tocaron sus contenedores.
12. **Cambiar el claro puede mover el oscuro.** Una regla clara con un literal (verde salvia, ámbar, etc.) y **sin** override oscuro en el mismo selector y propiedad pinta lo mismo en los dos temas: pasarla a token o neutro cambia el oscuro. Antes de tocarla, fijá el valor oscuro de hoy (un override `:host-context([data-theme="dark"])` o un token con valor oscuro propio) y recién después cambiá el claro. Los tokens de `:root` que el oscuro redefine no tienen este problema. Se comprueba con la equivalencia por selector de §5 resolviendo `var()` contra el mapa de tokens oscuro. Es el inverso de la trampa 2.
13. **Override oscuro compartido que un consumidor redefine.** Un `:host-context([data-theme="dark"]) .x` en un CSS compartido (`division-lists.css`) puede ser el que gana sobre un literal que otro componente (`division-list`) escribe después en su propio CSS: aunque sea igual a la base compartida, borrarlo cambia ese consumidor. Se detecta con la comprobación por elemento de §5, no con la comparación por selector.
14. **Bootstrap por nombre.** Bootstrap da estilos a clases usadas sin su componente (`.bi`, `.card-title`/`.card-header`/`.card-subtitle` sin `.card`, cuyas `var(--bs-card-*)` no existen y dejan la propiedad en `unset`; `.figure`, `.carousel`, `.small`, `.container`). Un recorte de Bootstrap tiene que conservar esas reglas idénticas; el subconjunto generado lo hace porque conserva toda regla cuyas clases nombra alguna plantilla o `.ts`.

## 5. Cómo se verificó (herramientas efímeras, no versionadas)

Se usaron scripts temporales de Python con un parser de llaves (no regex sobre el CSS crudo). Si hace falta repetir, recrear estos chequeos:

- **Equivalencia por selector:** aplicar en orden los archivos "antes" (desde `git show <ref>:<ruta>`) y "después" (compartido + local) y comparar, por (`@media`, selector), el valor final de cada propiedad. Debe dar 0 diferencias (salvo reglas ajenas que la plantilla no alcanza).
- **Clases vivas:** el conjunto de clases usadas en HTML/TS que estaban definidas antes debe seguir definido en algún CSS.
- **Fugas:** para cada regla de un compartido que no provenía de un componente, verificar que sus clases no estén en un mismo elemento de su plantilla.
- **Conflictos antes de quitar un override oscuro o cambiar a token:** otras reglas del archivo con la misma clase o con otras clases del mismo elemento que fijen la misma familia de propiedades (`background*`, `border*`, `color`, `box-shadow`).
- **Comentarios huérfanos** tras borrar reglas.
- **Ganador por elemento (la comprobación que manda):** para cada componente (`@Component` con su plantilla y sus hojas: Bootstrap, `styles.css`, el CSS compartido y el del componente, en ese orden) y cada elemento de la plantilla (clases de `class=""`, `[class.x]` y `[ngClass]`), calcular por propiedad qué declaración gana (`!important`, especificidad con +1 clase por compuesto por el encapsulado de Angular y +1 por el prefijo oscuro, orden de origen y de archivo, `@media`), en claro y en oscuro, con `var()` resuelto contra los tokens de cada tema y con `border*` y `background` expandidos. Se evalúa sin estado y con cada estado (`:hover`, `:focus`, `:disabled`, `.active`, atributos que existan en la plantilla), solos y de a pares, y por seudoelemento (`::before`, `::placeholder`). Es pesimista: ignora los combinadores y supone que una regla aplica si coincide su último compuesto y existen en la plantilla las clases de sus ancestros, así que puede dar falsos positivos pero no pasar por alto un cambio. Se compara el árbol de antes (`git archive <ref> frontend/src`) con el de después: debe dar 0 diferencias. Se valida con un cambio que sí rompe (por ejemplo, borrar el `color` oscuro de `.form-control`) para confirmar que la comprobación lo detecta. En la optimización cubrió 372.356 contextos y atajó casos que la comparación por selector no ve (trampa 13) y 20 overrides de componentes que compiten con un estado.
- Build: `docker exec ovaltrack-frontend npx ng build --configuration production --output-path /tmp/ot-build`. Specs puros: `./ds test-front`. Nunca `npm`/`ng` en el host. Avisos conocidos del build: presupuesto del bundle inicial y `.form-floating>~label`.

## 6. Pendientes y posibles siguientes pasos

Cambian lo que se ve, por eso no se hicieron (decidir aparte):

- `match-selection`: en claro todas las píldoras de estado se ven iguales (`.status-pill` pisa a `.status-*`); las reglas claras por estado se conservaron para el arreglo.
- `post-match-zones` / `post-match-statistics`: su `.btn-outline` local fija fondo blanco y en oscuro queda texto claro sobre blanco.
- `carga-en-vivo`: `.confirm-icon` usa `var(--green-600)` (token inexistente).
- `PlayerRegisterComponent` no está referenciado por ninguna ruta.
- Literales oscuros preservados: quedan 38 declaraciones oscuras con color escrito a mano en 12 archivos (`division-coach-list` 10, `post-match-panel` 9, `match-selection` 6). Pasarlas a tokens cambia el oscuro; se dejaron porque la ganancia es de mantenimiento (unos 2 KB, nada de rendimiento).
- `body` con `background-attachment: fixed`: pasarlo a un `body::before` fijo evita el repintado al scrollear, pero en iOS cambia lo que se ve (hoy el `fixed` se comporta como `scroll`).
- 37 `transition: all` (18 archivos): reemplazarlos por listas cerradas casi no cambia lo que se anima (hay que listar `border`, `box-shadow`, `color`, `background` y `transform`) y arriesga dejar sin animar lo que cambia al cambiar de tema.
- Nombres con el viejo tema en clases (`.modal-header-salvia` en `match-shared.css` y `post-match-table`): renombrarlas toca HTML.

Posibles mejoras (bajo ahorro o mayor riesgo, hoy fuera de alcance): unificar `app-modal` y `deactivate-modal`; backdrop común de modales; avatares/tablas/tarjetas base (valores distintos); token `--selected-bg` para los estados `.active` (requiere resolver la trampa 2); `.btn*`/`.form-control` locales (trampa 1).
