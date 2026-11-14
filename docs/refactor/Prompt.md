# Tarea: auditoría de código muerto y plan de refactor de la pantalla <PANTALLA>

Actuá como ingeniero de software senior. Trabajás sobre el monorepo OvalTrack (Angular 18 PWA + Spring Boot 3.3.4 / Java 21). Las versiones son fijas: no propongas upgrades ni uses APIs de versiones posteriores.

## Archivos de trabajo (fuera de git)
Usá la carpeta `supp/<slug>/refactoring/` (creala si no existe). `supp/` está en `.gitignore`: **nunca** hagas `git add` de estos archivos, y leelos y escribilos por ruta exacta, porque las búsquedas pueden ignorarlos.
- `supp/<slug>/refactoring/PLAN.md`: plan vivo, fuente de verdad del trabajo.
- `supp/<slug>/refactoring/CAMBIOS.md`: bitácora de sesiones, solo se agrega al final. No copies diffs ni repitas `git log`.

Si `PLAN.md` ya existe, **no lo pises**: frená y avisame.

## Antes de empezar (obligatorio)
1. Leé completos `CLAUDE.md`, `AGENTS.md`, `docs/refactor/REFACTORING.md`, `docs/refactor/REFACTORING-SPRING.md` y `docs/refactor/REFACTORING-ANGULAR.md`. Si alguno no existe, frená y avisame.
2. Nada de `mvn`/`npm`/`ng` en el host; usá `./ds compile`, `./ds mvn test`, `./ds test`, `./ds test-front` y `./ds frontend`.
3. Línea base: anotá el commit actual (`git rev-parse --short HEAD`) y el resultado de `./ds compile`, `./ds mvn test`, `./ds test` y `./ds test-front` sobre la carpeta de la pantalla. Si algo ya falla, informalo y no lo arregles.

## Análisis (solo lectura: el único archivo que escribís es PLAN.md)
1. **Mapa de la pantalla:**
   - **Frontend:** la ruta, el componente de página, los componentes hijos, servicios, store, tipos, utils, guards, estilos y specs.
   - **Llamadas HTTP:** qué endpoints llama la pantalla.
   - **Backend:** por cada endpoint, el controller, los métodos de servicio, los repositorios y queries, las entidades, los DTOs y mappers, los validadores de seguridad y los listeners.
   - **Cobertura actual:** qué tests (Cucumber, unitarios, specs) cubren cada pieza.
2. **Código muerto**, front y back. Confirmá cada candidato buscando en **todo** el repo:
   - templates HTML;
   - otras features;
   - `testing/`, `bruno/`, `staging/*.sql`;
   - configuración de Spring (`SecurityConfig`, reflexión, listeners);
   - service worker / PWA.

   Clasificá cada candidato así:
   - **A — Muerto seguro, interno:** se puede eliminar.
   - **B — Muerto, pero es contrato o persistencia:** endpoints, campos de DTO o JSON, entidades JPA, enums, Dexie. Requiere aprobación (`docs/REFACTORING.md` §8).
   - **C — Dudoso:** solo se reporta.
3. **Smells, malas prácticas y duplicación**, front y back, según `docs/REFACTORING.md` §6 y las tablas de síntomas de cada guía. Incluí la duplicación de una misma regla de negocio entre front y back, indicando cuál debería ser la fuente de verdad. Para cada hallazgo, indicá:
   - **Ubicación:** archivo y líneas.
   - **Smell:** el code smell nombrado.
   - **Técnica propuesta:** el nombre del catálogo.
   - **Nivel de riesgo:** de 0 a 4.
   - **Tests:** cuáles lo cubren hoy y cuáles hay que escribir antes.
   - **Aprobación:** si toca algo de §8.

## Estructura de PLAN.md
Plan de refactor — <PANTALLA>

Estado: <fase actual> | Commit base: <hash> | Última actualización: <fecha>

Próximo paso

<1–3 líneas: qué tiene que hacer la próxima sesión>

Línea base de tests
Mapa de la pantalla
Código muerto (A / B / C, con evidencia de búsqueda)
Hallazgos (ID, ubicación, smell, técnica, nivel, tests, ¿§8?)
Fases
Fase 1 — Eliminación de código muerto A
[ ] DM-01 <descripción> — commit: chore(<módulo>): remove dead code — <qué> — estado: propuesto
Fase 2 — Tests de caracterización faltantes
Fase 3 — Refactors nivel 0–1
Fase 4 — Refactors nivel 2
Fase 5 — Nivel 3 e ítems de §8 aprobados
Reglas del plan:
- Cada fase tiene que entrar en **una sesión y un PR revisable** (orientativo: hasta ~400 líneas). Si no entra, partila en 3a, 3b, etc.
- Estados posibles por ítem: `propuesto`, `aprobado`, `rechazado`, `hecho (<hash>)`, `bloqueado (<motivo>)`.
- Yo apruebo ítems cambiando su estado en el archivo o diciéndotelo en el chat.

## Cierre de esta sesión (FRENÁ ACÁ)
- Escribí `PLAN.md` y agregá a `CAMBIOS.md` la entrada de esta sesión.
- Mostrame un resumen: cantidad de ítems por fase, lo que requiere mi aprobación y la recomendación de por dónde empezar.
- **No modifiques código en esta sesión.**

## Formato de cada entrada de CAMBIOS.md
Sesión <n> — <fecha> — <fase>
Ítems ejecutados: <ID> → <hash corto>
Tests ejecutados: <comando> → OK/FALLA
Specs escritos pero NO ejecutados: <spec> (motivo)
Decisiones / aprobaciones / rechazos: <ID>: <qué y por qué>
Bugs detectados y NO corregidos: <descripción>
Verificación manual pendiente para el usuario: <pasos exactos y resultado esperado>
Bloqueos: <ID>: <motivo>
