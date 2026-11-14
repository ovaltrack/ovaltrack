# CLAUDE.md

Contexto compartido del proyecto **OvalTrack**. Leer completo antes de trabajar. Complementa a `AGENTS.md`, `docs/` y `supp/contexto.md`; ante conflicto, **manda el código** (ver "Discrepancias conocidas").

## 1. Qué es OvalTrack

Plataforma web + PWA para clubes, entrenadores y analistas de rugby. Cubre el ciclo completo:
estructura del club → convocatoria de 23 jugadores → **captura en vivo al borde de la cancha (offline-first)** → **auditoría post-partido** (`/post-match`) → estadísticas.

Fase actual: Fase 1 (un club por instalación lógica; multi-club/Bounded Context es Fase 2). Evitar sobrealcance.

## 2. Reglas de entorno y ejecución

- **Docker-first monorepo**: `backend/` (Spring Boot), `frontend/` (Angular 18 PWA), `testing/` (Cucumber.js), más `staging/` (SQL), `bruno/` (colección API), `docs/`, `supp/`.
- **`./ds` es el único entrypoint** (no existe `ds.sh`; ignorar esa referencia en `docs/REFACTORING.md`).
- **No ejecutar `mvn`/`npm`/`ng` en el host.** Todo corre en contenedores (solo `./backend/mvnw` sirve en el host si es estrictamente necesario).

| Comando | Qué hace |
|---|---|
| `./ds up` / `down` / `ps` / `restart [svc]` / `build [svc]` | Ciclo de vida de contenedores (`up` crea `.env` desde `.env.example`) |
| `./ds logs [svc]` | Logs (`backend`, `frontend`, `db`) |
| `./ds compile` | `mvn compile -DskipTests` dentro del contenedor backend |
| `./ds mvn <args>` | Maven arbitrario en el contenedor (ej. `./ds mvn test`) |
| `./ds test` | Suite Cucumber contra el backend vivo (ejecuta antes `staging/clean.sql`) |
| `./ds staging <file.sql>` | Carga un script de `staging/` (`data.sql`, `data_trelew.sql`, `event_type.sql`, `clean.sql`) |
| `./ds db` | `psql` interactivo |
| `./ds backend` / `frontend` | Shell dentro del contenedor |
| `./ds pwa` / `pwa-down` | PWA de producción con Nginx en `:4201` (probar Service Worker/offline) |
| `./ds install` | `npm install --legacy-peer-deps` en el contenedor frontend |
| `./ds sync-node` | Copia `node_modules` al host (solo autocompletado IDE) |
| `./ds reset` | Borra contenedores y volúmenes (pide confirmación) |

Puertos: backend `8080` (Swagger `/swagger-ui`, health `/actuator/health`), frontend `4200`, PWA `4201`, Postgres `5432` (test `5433`).
Variables en `.env` (ignorado por git): `DB_*`, `OVALTRACK_BOOTSTRAP_ADMIN_EMAIL/PASSWORD`, `EMAIL_USERNAME/PASSWORD`. **Nunca commitear ni mostrar secretos.**

## 3. Backend

**Stack**: Spring Boot 3.3.4, Java 21, Lombok, Spring Security + JWT (JJWT 0.12.5), Spring Data JPA, PostgreSQL 16, SpringDoc, Actuator. Hot reload vía `backend/run.sh` (`inotifywait` + DevTools).

**Paquete base** `com.ovaltrack.backend`, organizado **por dominio** y, dentro, por capa:
`admin`, `auth` (config/controller/dto/registration/security/service), `club`, `common` (config/exceptions, dto/response, mail), `division`, `event`, `invitations`, `match`, `person`, `statistic`, `token`, `user`. Capas típicas: `controller/`, `business/` (services), `domain/` (entidades, enums, `dto/`), `repository/`.

**Reglas**
- Separación estricta Entity ↔ DTO/Mapper ↔ Service ↔ Controller. Inyección con `@RequiredArgsConstructor`.
- Esquema con `ddl-auto=update`: **no hay migraciones**. Renombrar/eliminar/cambiar tipo de campos de entidad altera la BD real sin rollback → avisar antes (ver `docs/REFACTORING.md` §6).
- Errores: `GlobalExceptionHandler` → `BusinessException` 409, `EntityNotFoundException` 404, `AccessDeniedException` 401/403, `HttpMessageNotReadableException` 400. Cuerpo `{ "message": "..." }`.
- Respuestas: DTO directo con `ResponseEntity<...>`; algunos módulos (club, auth, admin, invitations) usan `BackendResponse<T>` (`common/dto/response`). Respetar la convención del módulo que se toca.
- Seguridad: JWT stateless, `JwtAuthenticationFilter`, `@EnableMethodSecurity` + `@PreAuthorize`. Rutas públicas en `SecurityConfig` (auth, validate de invitación, `GET /division/{id}`, `GET /person/{id}`, `/club/registration-options`, `/club/search/{term}`, health, swagger); todo lo demás exige token.
- Aislamiento de datos por club/división: `DivisionSecurityValidator`, `MatchSecurityValidator`. **Tocar esto = riesgo de fuga entre clubes → pedir confirmación.**
- Bootstrap del primer `ADMIN_OVALTRACK`: `BootstrapAdminRunner` con las env `OVALTRACK_BOOTSTRAP_ADMIN_*` (pass ≥ 12 chars, idempotente). `ADMIN_OVALTRACK` no se puede registrar públicamente.
- `User` (cuenta/login) y `Person` (identidad deportiva) están separados; `User` ↔ `Person` es `@OneToOne`. Una `Person` puede existir sin `User`. El JWT lleva `sub`, `userId`, `personId`, `role`.

**Enums reales (fuente de verdad)**
- `UserRole`: `ADMIN_OVALTRACK, ADMIN_CLUB, COACH_ANALYST, PLAYER, NO_ROLE`
- `UserStatus`: `PENDING_APPROVAL, ACTIVE, REJECTED, SUSPENDED, DEACTIVATED`
- `ClubStatus`: `PENDING, ACTIVE, REJECTED`
- `MatchStatus`: `EMPTY_ROSTER, NOT_STARTED, IN_PROGRESS, HALFTIME, FINISHED, CANCELLED`
- `MatchPlayerRole`: `TITULAR, SUPLENTE`
- `AgeCategory`: `U14, U15, U16, U18, U20, SENIOR, VETERAN`; `Gender`: `MALE, FEMALE, MIXED`
- `EventPossession`: `OWN, OPPONENT, NEUTRAL`; `EventCategory`: `ATTACK, DEFENSE, NEUTRAL, SET_PIECE, POSSESSION`; además `Actor`, `PossessionAfter`, `FollowUpChoice`, `TemplateField`.

**Endpoints (prefijos reales, inconsistentes a propósito del historial)**
- `/api/auth`, `/api/me` (contexto de usuario), `/api/admin/ovaltrack`, `/api/invitation`
- `/club`, `/division`, `/players`, `/coaches`, `/person`, `/user`
- `/matches` — `GET /club?clubId`, `GET /division?divisionId`, `GET|PUT /{id}`, `POST`, `PUT /{id}/start`, `/finish`, `/close-first-half`, `/start-second-half`, `DELETE /{id}/cancel`, `GET|PUT /{id}/live-state`, `GET /{id}/live-bootstrap`, `GET|POST /{id}/roster`, `GET /{id}/roster/players`
- `/opponents`, `/eventType`
- `/event` — `GET /club|/division|/match`, `GET /match/post-match`, `GET|PATCH|DELETE /{id}`, `POST`
- `/statistics/match/{matchId}`

**Modelo de eventos**: `Event` (`events`) tiene `clientEventId` (idempotencia offline), `eventType`, `match`, `player` (`Person`), `teamPossession`, `matchTime` (reloj de juego, se pausa), `absoluteMatchTime` (tiempo de video, corre siempre), `realTime`, `period`, `origin` (`live_capture` | `post_capture`), `attributes` (`Map<String,Object>` validado por `EventAttributeValidator` contra `templateEventFields` del `EventType`), `active` (borrado lógico), `synchronizedAt`.

**Estadísticas**: `StatisticService` + patrón Strategy (`Period`, `Possession`, `Tackle`, `Discipline`, `SetPiece`, `Score`, `Turnover` `StatisticStrategy`); `StatisticEventListener` reacciona a `MatchPeriodClosedEvent`.

## 4. Frontend (Angular 18 PWA)

- Standalone components, **`inject()`** (no constructor injection), rutas lazy con `loadComponent`, guards `authGuard`, `hasRoleGuard` (roles en `data.roles`), `hasClubGuard`. Layout ancho vía `data: { layout: 'wide' }` (post-match).
- Estado: **Signals** (`signal`/`computed`) para UI y contexto; **RxJS** (`switchMap`, `debounceTime`, `takeUntilDestroyed`) para HTTP. **Prohibido `.subscribe()` anidado.**
- Contexto global: `UserContextService` (`core/services/user-context.service.ts`) → `userContext`, `currentClub`, `currentRole`, `activeDivisions`, `hasClub`.
- HTTP: `provideHttpClient(withInterceptors([jwtInterceptor]))`. Token en `localStorage` vía `TokenService`.
- Estructura: `src/app/core/{guards,interceptor,routing,services,synchronization}`, `features/<dominio>/{types,services,...}`, `shared/components` (navbar, toast-container).
- Tipado fuerte en `features/<dominio>/types/`; **sin `any`**. Solo `@environments/*` está aliasado; resto, imports relativos.
- **Offline-first**: Dexie/IndexedDB (`features/local-database`, `LocalDatabaseService`) + `core/synchronization` (`ActiveMatchPullService`, `PendingEventSyncService`, `PendingMatchMutationSyncService`, `SyncManagerService`). Requisito crítico: **0% de pérdida de eventos**. No tocar orden de guardado/timestamps/conflictos "de paso".
- Post-match: `features/match/post-match/` con `store/match-review.store.ts` (estado centralizado), componentes `event-form` (compartido entre modal e inspector), `post-match-{header,kpi-strip,timeline,table,panel,statistics,create-modal}`. Virtual scroll CDK + `ResizeObserver`.
- Notificaciones: **siempre `ToastService`** (`success/error/warning/info`); nunca `window.alert()` ni librerías externas.
- Rutas principales: `/home`, `/auth/*`, `/club`, `/club/new`, `/divisions`, `/divisions/new`, `/divisions/:id/players|coaches`, `/players/new`, `/members`, `/match-selection`, `/opponent`, `/selection-roster/:id`, `/live-capture/:matchId`, `/live-capture/:matchId/halftime`, `/post-match/:id`, `/post-match/:id/statistics`, `/invitation`, `/admin/ovaltrack`.

## 5. UI / Design System "Cal y botella" (claro) y "Grafito" (oscuro)

Fuente de verdad: `docs/DESIGN_SYSTEM.md` + `frontend/src/styles.css`. Bootstrap 5 y Bootstrap Icons disponibles globalmente **como subconjuntos generados y commiteados** (`frontend/src/icons/` y `frontend/src/bootstrap/bootstrap-subset.css`): al usar un ícono o una clase de Bootstrap nuevos hay que regenerarlos y commitear el resultado (comandos en `AGENTS.md`); si no, `npm run build` falla.
- **No inventar colores ni sombras**; usar tokens (`--bg-canvas: #eef0ea`, `--btn-primary-bg: #204b22`, `--border-sport`, `--surface`, etc.). El verde botella es el único color de marca; el lima (`--brand-signature`) va solo sobre superficies verde botella.
- **Un solo botón primario sólido verde por pantalla**; el resto `outline`; rojo solo destructivo.
- Tarjetas/tablas: borde 2px, radio 16–20px, sombra de elevación. Hit-targets táctiles **44–48px**.
- Pantallas de gestión dentro de `.layout-container.page` (max 1180px; wide 1560px).
- **Excepción**: `/live-capture/:matchId` y `/halftime` son pantalla completa, sin navbar ni `.layout-container`.
- Tipografías: Hanken Grotesk (títulos), Inter (UI), JetBrains Mono (números/dorsales/tiempos).
- Modo oscuro «Grafito con verde botella»: definido en `docs/DESIGN_SYSTEM.md` §5. Los colores oscuros van en tokens de `[data-theme="dark"]` (`frontend/src/styles.css`); no escribir colores a mano en overrides `:host-context`.

## 6. Reglas de dominio de rugby (críticas)

1. Dos tiempos de **40'** máx. cada uno (1T ≤ 40', 2T hasta 80'). En 2T el minuto 10 = minuto 50 de partido.
2. **Tiempo de juego** (se pausa) ≠ **tiempo de video** (continuo). Alta post-partido proyecta pausas previas; desempate +2s.
3. Posesión `OWN` requiere jugador del plantel; `OPPONENT` **desasocia y limpia el jugador** (front y BD); `NEUTRAL` para disputas.
4. Un evento solo puede asignarse a jugadores de la **nómina oficial del partido** (hasta 23: 15 titulares + 8 suplentes).
5. Puntos: Try 5, Conversión 2, Penal 3, Drop 3. Crear/editar/borrar jugadas que puntúan **recalcula el marcador** en BD.
6. Cambiar el tipo de evento **resetea sus `attributes`**; atributos inválidos → 409.
7. `/post-match` exige partido `FINISHED` (si no, 409). Altas post-partido solo con origen `post_capture`. Borrado de eventos es lógico (`active=false`).

## 7. Testing

- **Cucumber.js** en `testing/features/` (`admin, club, division, event, invitar-jugador, match, registro-club, ...`); `.feature` y steps **en español** (`Dado/Cuando/Entonces`). Helpers en `testing/features/support/` (`auth_helper.js`, `event_helper.js`, `division_helper.js`, `clean.sql`). Golpea `http://backend:8080` (o `API_URL`).
- `./ds test` limpia la BD antes. Es la red de seguridad de contratos: cualquier cambio en `controller/` o forma de JSON se corre antes y después.
- Frontend: specs Karma/Jasmine (`ng test`, dentro del contenedor). Colección Bruno en `bruno/` para pruebas manuales de API.

## 8. Refactoring (resumen de `docs/REFACTORING.md`)

- Sin tests en verde no se refactoriza (escribir test de caracterización primero). **Un refactor = un commit** (`refactor(<módulo>): <técnica> — <razón>`). Pasos chicos, Regla de las Tres Repeticiones.
- Refactor ≠ cambio de comportamiento: fixes/features van en commits separados.
- **Parar y preguntar** antes de: cambiar contrato JSON de un controller, migrar datos de entidades JPA, tocar validación de roles/aislamiento por club-división, aplicar patrones DDD (Nivel 4), o tocar la sincronización offline.
- No tocar todavía `Map<String,Object>` de `EventType.metadata`/`Event.attributes` (catálogo en movimiento).

## 9. SOLID / Clean Code

S: una razón de cambio por clase. O: DTOs desacoplan API de persistencia. L: respetar contratos. I: DTOs/interfaces chicos. D: depender de abstracciones vía DI (Spring/Angular).

## 10. Discrepancias conocidas entre docs y código

Si algo no coincide, **el código manda**. Corregir el doc cuando se detecte:
- `supp/contexto.md` describe `MatchStatus` como `CREATED→IN_PROGRESS→FINISHED`, rutas `/match`, `/division-player`, `/division-coach`, `/statistic` y `STARTER/BENCH`; el código usa los valores/prefijos de la sección 3.
- `docs/api-reference.md` usa `NOT_STARTED` como único estado inicial (el código también tiene `EMPTY_ROSTER`), lista rol `COMMISSION` (no existe en `UserRole`) y categorías `SENIOR` solamente en ejemplos; `POST` de club/división devuelven 200 (no 201). No cubre event/statistics/opponents/invitation.
- `docs/auth-architecture.md` y `AGENTS.md` mencionan `DevMockAuthFilter`/perfiles `dev`: **no existe en el código**; hoy todas las rutas privadas exigen JWT. `docs/auth-architecture.md` lista `UserRole` sin `NO_ROLE`.
- `docs/REFACTORING.md` usa `./ds.sh`; el script real es `./ds`.
- `AGENTS.md` cita `snapshot.sql` en `staging/`, que no existe.
- `.github/copilot-instructions.md` es de otro contexto (macOS/OpenProject); no aplica a este flujo.
- `supp/` contiene material de apoyo (`contexto.md`, `contexto.txt`, `Cambios.txt`, `demo.txt`, `guion.txt`); `contexto.txt` difiere de `contexto.md`.

## 11. Convenciones de trabajo con Claude

- Responder en español. Commits en español siguiendo el estilo existente (`feat:`, `update(...)`, `refactor(...)`).
- Antes de proponer cambios, verificar en el código que clases/archivos/endpoints citados existan.
- Cambios mínimos y enfocados; no crear archivos de documentación salvo que se pidan.
- Subagentes (herramienta Agent): lanzarlos siempre con `model: "sonnet"` y `effort: "medium"`, salvo que se pida otra cosa.

## 12. Zonas de cancha (post-partido)

- **Vocabulario**: *tramo* = rango de tiempo + zona (entidad `ZoneAssignment`, tabla `match_zone_assignments`); *zona* = celda de la cancha. UI: "Nuevo tramo", "Tramos asignados".
- **Grilla 3x6 fija** (fuente única: `frontend/.../post-match/utils/zone-grid.ts`): columnas `10/22/28/28/22/10 m` (in-goal propio, 22 propio, campo propio, campo rival, 22 rival, in-goal rival) y filas `15/40/15 m` (izquierda, centro, derecha) alineadas con las líneas de 15 m. Etiqueta de zona = letra de fila + columna (`I1`…`D6`).
- **Vista relativa**: siempre se ataca hacia la derecha; en el 2T **no se espeja**. Izquierda/derecha se leen mirando al ataque.
- **Rangos**: minutos acumulados de partido, 1T 0–40 y 2T 40–80, semiabiertos `[inicio, fin)` (el minuto 25 pertenece al tramo que empieza en 25). Sin solapes dentro de un mismo tiempo; solo editables con el partido `FINISHED`.
- **La zona del evento se deriva**, no se guarda: `EventZoneResolver.resolve(ZoneQuery, tramos)` (backend) es el único lugar que la calcula; `GET /event/match/post-match` la expone como `zone: {row, col} | null` y también la usan el resumen de `/zones` y el mapa de zonas de las estadísticas del jugador. El front la replica solo para eventos recién creados/editados y para prevalidar (`post-match/utils/zone-rule.ts`). La pantalla deriva conteos, cobertura y listas de esos eventos (una sola fuente de verdad).
- **Tiempo añadido**: un evento después del 40' (1T) o del 80' (2T) cuenta como el último segundo del tiempo (`ZoneGrid.effectiveSeconds`): cae en el tramo que termina en el 40′ u 80′. Solo la captura en vivo registra tiempo añadido (el alta post-partido no pasa de 40:00 en el 1T).
- **Regla de zona por tipo** (catálogo, `event_types.zone_rule` jsonb, expuesta en `EventTypeResponseDTO.zoneRule`): `columns`/`rows` = celdas permitidas, `rowFrom` = atributo (`left|center|right`) del que sale la fila, `closesTramo` = el tipo corta el tramo. Un eje con un único valor queda **fijo** (zona fija, sin tramo: el Try va a I6/C6/D6 según el lado del apoyo); si no, sale del tramo y una celda no permitida deja el evento "Sin zona". La regla se lee **desde el equipo que ejecuta**: para `OPPONENT` se espeja la celda (columna 6↔1, fila I↔D). Sin regla = sin restricción. Catálogo inicial: Try/Try penal (columna 6, cortan), Kick H y Drop goal (columnas 2–5, cortan si se convierten), Conversión, Scrum, Line-out, Maul, Ruck ofensivo y Jugada rápida (columnas 2–5), Kick-off/Salida (columnas 1–4). Se carga con `UPDATE` por código en los SQL de `staging/` y en `migrations/002_event_type_zone_rule.sql`.
- **Corte de tramo**: después de un tanto que reinicia el juego —Try, Try penal, Kick H o Drop goal **convertidos** (`closesTramo` y que puntúe, `TramoCuts.closes`; un Kick H o drop con `wasSuccessful = false` no corta)— el territorio cambia, así que el tramo que lo contiene termina en su minuto (`fin = minuto + 1`) y **lo que sigue queda como hueco**, sin copiar la zona. Es automático: al guardar el tanto (alta `post_capture` o en vivo, o edición de tipo, atributos, posesión, período o tiempo) `TramoTrimmer` acorta el tramo; nunca rechaza el evento. El tramo guardado es la verdad: borrar el tanto no restaura el tramo. En el panel, un «Hasta» que cruza un corte se lleva solo al corte con una nota informativa.
- **Validación 409 solo post-partido** (`EventZoneRuleValidator`, `TramoCutValidator`): altas `post_capture` y ediciones con el partido `FINISHED` que cambian tipo, atributos, posesión, período o tiempo, y `POST`/`PUT` de tramos. **Nunca** en la captura en vivo ni en `core/synchronization` (un 409 rompería el 0 % de pérdida) ni al borrar un tramo. El 409 de corte por tanto queda como protección para quien llega por la API; la pantalla ya ajusta el rango antes de enviarlo.
- **API** `/matches/{matchId}/zones`: `GET` (tramos + resumen), `POST` 201, `PUT /{zoneId}`, `DELETE /{zoneId}` 204; 409 por partido no finalizado, rango/celda inválidos, solape (el mensaje nombra el tramo en conflicto), celda prohibida para una jugada del rango («Scrum (1T 22:00) no puede quedar en C6 (tramo 1T 20'–25'): solo puede ocurrir en las columnas 2 a 5») o corte por try («El tramo 1T 20'–25' no puede seguir después del Try (1T 22:30): terminalo en 23'»). `POST /event` y `PATCH /event/{id}` devuelven el mismo 409 de celda. Ruta frontend: `/post-match/:id/zones`.
- **UI de Zonas** (detalle en `docs/DESIGN_SYSTEM.md` §8.2): barra con tiempo y posesión; encabezado del mapa con el tipo de jugada y **Eventos / Minutos** (el tipo solo cambia la cancha, no la grilla). Grilla de territorio: bloques con la letra del lateral, puntos ◆ (zona fija, rellenos; los que quedan a menos de 12 px se agrupan con su número), el rombo es la única señal del tanto (sin tira de letras sobre el eje) y señalarlo resalta con una barra lima el fin del tramo que cortó; la línea de corte fina aparece solo junto al rango en edición que la toca; el entretiempo es la línea más fuerte. El in-goal solo tiene puntos: no se crean tramos ahí (los viejos se ven, editan y borran). Cancha con **escala de calor relativa** al máximo mostrado (cuartiles, leyenda con rangos reales) y, al costado, el **detalle de la celda** tocada o señalada (jugadas con el origen de su zona, o tramos en Minutos). El KPI «sin zona» abre esas jugadas: las de hueco en una línea que lleva a «Huecos sin zona» del panel y el resto (sin tiempo o tramo que no admite el tipo) una por una con su motivo y su arreglo; en «Minutos» solo se deshabilita el tipo (la posesión sigue filtrando la grilla); Eventos avisa con un toast cuando un tanto recorta un tramo; el panel dice «Tiempo cubierto · N jugadas sin zona» en vez de «Partido completo» mientras queden. Un toque en un hueco propone solo el segmento hasta el próximo corte, y después de guardar un tramo que termina en un tanto el asistente propone la zona del saque (campo propio si el tanto fue nuestro, campo rival si fue del rival).
