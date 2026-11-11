# AGENTS.md

## Environment & Execution Rules

- **Docker-first Monorepo**: Three-service architecture: `backend/` (Spring Boot), `frontend/` (Angular 18 PWA), `testing/` (Cucumber.js).
- **No Host Toolchain**: No local Java/Maven/Node/Angular/PostgreSQL required. Do NOT run `mvn`/`npm`/`ng` directly on the host (only `./backend/mvnw` is host-compatible if strictly needed).
- **Single Entrypoint**: `./ds` is the sole script for managing the environment. First `./ds up` auto-creates `.env` from `.env.example`. Detached mode by default (`docker compose up -d --build`).

## Commands (`./ds`)

- `./ds up` — Builds (if needed) and starts backend, frontend, and PostgreSQL in detached mode.
- `./ds down` — Stops containers (preserves database volumes).
- `./ds ps` — Lists container status, health, and exposed ports.
- `./ds logs [svc]` — Streams live logs (all services or specific: `./ds logs backend`).
- `./ds restart [svc]` — Restarts all services or a specific container (`./ds restart db`).
- `./ds build [svc]` — Rebuilds Docker images.
- `./ds compile` — Recompiles backend Java code inside the container (`dc exec backend mvn compile -DskipTests`).
- `./ds mvn <args>` — Runs arbitrary Maven commands inside backend container (e.g. `./ds mvn test`).
- `./ds test` — Runs the Cucumber.js BDD test suite against the backend. Automatically executes `staging clean.sql` beforehand.
- `./ds staging <file.sql>` — Executes a SQL script from `staging/` into the PostgreSQL database (e.g. `./ds staging data.sql`).
- `./ds db` — Opens an interactive `psql` shell connected to PostgreSQL.
- `./ds backend` / `./ds frontend` — Opens an interactive shell (`bash`/`sh`) inside the respective container.
- `./ds pwa` / `pwa-down` — Builds and serves/stops the production PWA with Nginx on port `4201` (for testing Service Workers and offline mode).
- `./ds install` — Runs `npm install --legacy-peer-deps` inside the frontend container.
- `./ds sync-node` — Copies `node_modules` from the frontend container to host for IDE autocompletion/TypeScript server.
- **`./ds reset`** — Stops containers and deletes all data volumes and caches (prompts for confirmation).

## Backend Architecture & Stack

- **Stack**: Spring Boot **3.3.4**, **Java 21**, Lombok, SpringDoc OpenAPI (Swagger UI at `http://localhost:8080/swagger-ui`), Actuator (`/actuator/health`).
- **Hot Reload**: `backend/run.sh` monitors `src/` with `inotifywait` $\rightarrow$ triggers `mvn compile`, and Spring DevTools restarts on class changes. `./ds compile` forces an immediate recompile.
- **Database**: PostgreSQL 16 with Hibernate `spring.jpa.hibernate.ddl-auto=update` (schema auto-synchronized from JPA entities, **no migration files**).
- **Security & Authentication**:
  - Stateless Spring Security with JWT Bearer tokens (`io.jsonwebtoken` JJWT 0.12.5), validated by `JwtAuthenticationFilter`.
  - Method-level security enabled via `@EnableMethodSecurity` / `@PreAuthorize`.
  - Initial system admin bootstrap: `BootstrapAdminRunner` creates the first `ADMIN_OVALTRACK` from environment variables `OVALTRACK_BOOTSTRAP_ADMIN_EMAIL` and `OVALTRACK_BOOTSTRAP_ADMIN_PASSWORD` (min 12 characters).
  - User Roles (`UserRole`): `ADMIN_OVALTRACK`, `ADMIN_CLUB`, `COACH_ANALYST`, `PLAYER`, `NO_ROLE`.
- **API & Error Standards**:
  - Direct REST payloads (`ResponseEntity<DTO>`), no generic envelopes. Endpoints with no resource to return (approve, delete, register…) respond with `MessageResponse` (`{ "message": "..." }`).
  - Standard HTTP status codes (`200 OK`, `201 Created`, `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`, `409 Conflict`).
  - Centralized exception handling in `GlobalExceptionHandler` (`BusinessException` $\rightarrow$ 409, `MethodArgumentNotValidException` from `@Valid` $\rightarrow$ 409 with the first field's message, `EntityNotFoundException` $\rightarrow$ 404, `AccessDeniedException` $\rightarrow$ 401/403, `HttpMessageNotReadableException` $\rightarrow$ 400). Every error, including the Spring Security 401, uses `MessageResponse`. Controllers don't take `BindingResult` or catch business exceptions.
  - Strict layer separation: Entity $\leftrightarrow$ DTO Mapper $\leftrightarrow$ Service $\leftrightarrow$ Controller/Presenter.

## Frontend Architecture & Stack

- **Stack**: Angular 18 PWA, Standalone Components, `inject()`-based Dependency Injection (prefer `inject()` over constructor injection).
- **Hot Reload**: Served with `ng serve --poll 2000 --host 0.0.0.0` at `http://localhost:4200`. Dependencies install with **`npm install --legacy-peer-deps`**.
- **State & Reactivity**:
  - Prefer Angular Signals (`signal()`, `computed()`) for synchronous UI/component state and service context.
  - Use RxJS pipelines (`switchMap`, `takeUntilDestroyed`) for asynchronous HTTP streams. Avoid manual nested `.subscribe()` calls.
  - Global user state is managed via `UserContextService` (`src/app/core/services/user-context.service.ts`), exposing reactive signals (`userContext`, `currentClub`, `currentRole`, `activeDivisions`, `hasClub`).
- **UI & Design System (*Cal y botella* light, *Grafito* dark)**:
  - Reference `docs/DESIGN_SYSTEM.md` and `src/styles.css` as the single source of truth for UI design.
  - Use predefined design tokens (`--bg-canvas: #eef0ea`, `--btn-primary-bg: #204b22`, `--border-sport`, elevated cards, 2px borders, minimum hit-targets of 44–48px). Do NOT invent arbitrary colors or ad-hoc styles.
  - Bootstrap 5 and Bootstrap Icons are available globally.
- **UI Feedback & Toasts**:
  - Always use `ToastService` (`src/app/core/services/toast.service.ts`) for notifications and feedback (`toastService.success()`, `toastService.error()`, `toastService.warning()`, `toastService.info()`).
  - Toasts are rendered globally by `<app-toast-container />`. Do NOT use `window.alert()` or install external UI notification libraries.
- **Offline & Storage**:
  - Dexie (`IndexedDB`) is used for client-side local caching and offline data storage.
- **Typing & Paths**:
  - Strong domain typing with TypeScript interfaces in `features/<domain>/types/`. Avoid `any`.
  - Only `@environments/*` is aliased in `tsconfig.json`; use clean relative paths for other internal imports.

## Testing & Staging

- **BDD Suite (Cucumber.js)**: Located in `testing/`. Feature files (`.feature`) and step definitions are written in **Spanish** (`Dado`, `Cuando`, `Entonces`).
- **Target**: Hits the live backend at `http://backend:8080` (or `API_URL`).
- **Execution**: Run with `./ds test`. It automatically cleans the database with `staging clean.sql` before execution.
- **Helpers**: Reusable auth and domain helpers in `testing/features/support/` (`auth_helper.js`, `getUserToken`, `getAdminToken`).
- **Frontend specs (no Karma/Chrome)**: the dev environment has no Chrome and Karma cannot run (`ng test` is unavailable). Only pure specs run, with `./ds test-front [folder-or-file]` (Jasmine in Node; it skips any spec that uses `TestBed` or `HttpTestingController`). Pure logic (utils, rules, calculators) must be covered by specs that run there. Component, service and store specs that need `TestBed` are still written, but are **not executed by the agent**: flag them as "not run" in the report.
- **Manual verification is done by the user**: UI behavior, responsive layout (390/1024/1440px), light/dark theme, offline (`./ds pwa` + DevTools offline) and anything else that needs a browser. The agent must not claim these were verified; it lists the exact manual steps to follow and what result to expect.
- **Database Seeding**: SQL scripts in `staging/` (`clean.sql`, `data.sql`, `snapshot.sql`, `event_type.sql`) loaded with `./ds staging <file.sql>`.

## Development Guidelines (SOLID & Clean Code)

- **S (Single Responsibility)**: Cada clase, servicio, componente o entidad debe tener una única razón para cambiar. Separar estrictamente entidades de dominio, DTOs, mappers, servicios de negocio y controladores.
- **O (Open/Closed)**: El código debe estar abierto a la extensión pero cerrado a la modificación. Los DTOs desacoplan el contrato de API del modelo de persistencia.
- **L (Liskov Substitution)**: Las implementaciones deben cumplir estrictamente los contratos e interfaces sin alterar el comportamiento esperado.
- **I (Interface Segregation)**: Contratos pequeños y específicos; los DTOs deben solicitar y exponer únicamente los datos requeridos.
- **D (Dependency Inversion)**: Depender de abstracciones mediante inyección de dependencias en Spring (`@RequiredArgsConstructor`) y Angular (`inject()`).
- **Refactoring Protocols**: Seguir las directivas de `docs/REFACTORING.md` (no refactorizar sin tests en verde, un refactor = un commit, regla de las tres repeticiones, pasos pequeños y reversibles).
