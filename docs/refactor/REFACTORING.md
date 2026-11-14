# REFACTORING.md — Reglas generales de refactor para OvalTrack

> Ubicación en el repo: `docs/REFACTORING.md`. Última revisión: 2026-11-14.
> Guías específicas por stack (se leen **después** de este documento):
> - Backend Java 21 / Spring Boot 3.3.4 → `docs/REFACTORING-SPRING.md`
> - Frontend Angular 18 / TypeScript → `docs/REFACTORING-ANGULAR.md`

## 0. Qué es este documento y cómo usarlo

Guía operativa para un **agente de código** (o una persona) que va a refactorizar OvalTrack.
Complementa a `AGENTS.md` / `CLAUDE.md` (cómo correr y construir el proyecto) y a
`DESIGN_SYSTEM.md` (cómo se ve la UI). Responde una sola pregunta: **qué refactor aplicar,
cuándo, y con qué red de seguridad**.

**Definición de trabajo (Fowler):** refactorizar es cambiar la estructura interna del código
sin cambiar su comportamiento observable. Si un cambio altera lo que el sistema hace —aunque
sea "mejorándolo"— no es un refactor: es una feature o un fix, va en commit separado y con
tests que describan el comportamiento nuevo.

**Orden de lectura obligatorio:**

1. Principios (§1) y cuándo refactorizar (§2): siempre.
2. Protocolo (§3): siempre.
3. Para elegir la técnica: tabla síntoma → refactor (§6), que apunta al catálogo (§4).
4. Si el cambio no entra en un solo commit chico: técnicas para refactors grandes (§5).
5. Antes de tocar código del stack: la guía específica (Spring o Angular).
6. Antes de aplicar: §8 (cuándo parar y preguntar).

**Precedencia ante conflictos:** el código manda sobre la documentación (ver `CLAUDE.md` §10);
entre documentos, las reglas de "parar y preguntar" (§8) pesan más que cualquier técnica del
catálogo; las guías específicas detallan pero no relajan las reglas de este documento.

---

## 1. Principios no negociables

1. **Sin tests en verde no hay refactor.** Antes de tocar código, correr la suite relevante y
   confirmar que pasa. Si el código no tiene test que lo cubra, el primer paso es escribir un
   **test de caracterización**: describe lo que el código hace hoy (aunque parezca raro), no
   lo que debería hacer. Recién después se refactoriza.
2. **Estructura y comportamiento nunca viajan juntos.** Un refactor = un commit. Ningún commit
   mezcla refactor con fix, feature o cambio de formato masivo. Si en el camino aparece un bug,
   se anota y se corrige aparte. Cuando un refactor prepara una feature, los commits de
   refactor van **primero** (idealmente en su propio PR) y la feature después.
3. **Pasos chicos, verdes y reversibles.** Cada paso compila y pasa tests. Si algo se rompe, el
   paso era demasiado grande: se revierte (`git restore`/`git revert`) y se parte en pasos más
   chicos. No se debuggea a mitad de un refactor.
4. **Herramienta antes que mano.** Si el IDE o el compilador puede hacer el refactor de forma
   automática (Rename, Extract Method, Inline, Change Signature, Move), se usa la herramienta:
   actualiza todas las referencias y no se equivoca al tipear. Las ediciones a mano son para
   lo que la herramienta no cubre, y se verifican con búsqueda de texto completa en el repo
   (incluidos templates HTML, SQL de `staging/`, steps de Cucumber y colección `bruno/`).
5. **Regla de las tres repeticiones y "mejor duplicar que abstraer mal".** No abstraer ante la
   primera duplicación; tolerarla la segunda; extraer recién en la tercera. Si una abstracción
   existente obliga a llenarse de flags y casos especiales, el refactor correcto es
   **inlinearla** de vuelta y volver a extraer lo realmente común. Aplica con más fuerza a los
   patrones DDD (Nivel 4).
6. **El build queda verde siempre.** Backend: `./ds compile` sin errores. Frontend: compilación
   Angular sin errores ni warnings nuevos; nada de `any` introducido "para que compile".
7. **Versiones fijas.** El proyecto se mantiene en Angular 18, Spring Boot 3.3.4 y Java 21. Un
   refactor **no** propone upgrades de framework, lenguaje ni dependencias, y **no** usa APIs de
   versiones posteriores (las guías específicas listan qué está disponible y qué no).
8. **Nada de dependencias nuevas sin aprobación.** Ni librerías de runtime ni de test/lint.
   Si una técnica de este documento sugiere una herramienta que el proyecto no tiene, se
   propone por escrito y se espera respuesta.
9. **Los cambios de esquema JPA son de riesgo especial.** No hay migraciones formales
   (`ddl-auto=update`): un refactor de entidad puede ser un cambio de base de datos. Ver §7 y
   la guía Spring.

---

## 2. Cuándo refactorizar (y cuándo no)

**Sí:**

- **Refactor preparatorio** — "primero hacer fácil el cambio, después hacer el cambio fácil"
  (Kent Beck). Es el motivo más valioso: se refactoriza el código que se va a tocar para una
  feature o fix concreto.
- **Refactor de comprensión** — al leer código confuso para entenderlo, dejar la comprensión
  escrita en el código (renombres, Extract Function) en vez de en la cabeza.
- **Hotspots** — código que cambia seguido *y* es complejo. Para priorizar, cruzar frecuencia de
  cambio con tamaño/complejidad:

  ```bash
  # archivos más modificados en los últimos 6 meses
  git log --since="6 months ago" --name-only --pretty=format: -- backend/src frontend/src \
    | grep -v '^$' | sort | uniq -c | sort -rn | head -20
  ```

  Un archivo grande que aparece arriba de esta lista es mejor candidato que uno feo que nadie
  toca.
- **Regla del boy scout, acotada** — dejar un poco mejor el código que ya se está modificando,
  **dentro de los archivos del cambio**. No es licencia para refactorizar módulos vecinos.

**No:**

- Código que se va a borrar o reescribir pronto.
- Código estable que nadie toca, solo porque "es feo".
- Como excusa para cambiar comportamiento ("ya que estaba, lo arreglé").
- Reformateos masivos de archivos enteros: ensucian el diff y esconden cambios reales. Si hace
  falta formatear, es un commit aparte `style(...)` sin ningún otro cambio.
- Cerca de una entrega, sin tiempo para correr la suite completa.

---

## 3. Protocolo paso a paso

1. **Nombrar el síntoma.** Identificar el code smell concreto (§6). Sin síntoma nombrado no
   hay refactor.
2. **Verificar la red de seguridad.**
   - ¿Hay un test que falla si rompo esto? Si no, escribir el de caracterización primero.
   - Backend `business/`: tests unitarios obligatorios antes de refactorizar.
   - Frontend: la lógica pura se cubre con specs que corran en `./ds test-front` (ver guía
     Angular: si la lógica no es testeable, el primer refactor es extraerla a una función pura).
3. **Elegir el refactor más chico que resuelve el síntoma.** Empezar por Nivel 0 y subir solo si
   no alcanza.
4. **Aplicar un solo refactor**, de forma mecánica, con herramienta del IDE cuando exista.
5. **Correr tests según el alcance:**

   | Alcance del cambio | Qué correr |
   |---|---|
   | Dentro de una clase, sin tocar firmas públicas | `./ds compile` + tests unitarios del módulo (`./ds mvn test -Dtest=...`) |
   | Toca firmas públicas entre clases/servicios | `./ds mvn test` completo |
   | Toca `controller/`, DTOs, JSON o reglas de negocio expuestas | Lo anterior + `./ds test` (Cucumber) **antes y después** |
   | Frontend, lógica pura | `./ds test-front <carpeta-o-archivo>` |
   | Frontend, componentes/servicios con `TestBed` | Escribir/actualizar el spec; marcarlo como **"no ejecutado"** en el reporte (Karma no corre en el entorno) |
   | Frontend, plantillas o estilos | Lista de pasos de verificación manual para el usuario (ver `AGENTS.md`) |

6. **Commit atómico** con formato Conventional Commits:
   `refactor(<módulo>): <técnica> — <razón breve>`
   Ej.: `refactor(event-service): extract method calcularPosesion — reduce complejidad en registrarEvento()`
7. **Repetir** desde el paso 1 para el siguiente síntoma.
8. **Reportar** al terminar (§10).

**Tamaño de PR:** apuntar a diffs revisables (orientativo: hasta ~400 líneas cambiadas). Si un
refactor no entra, usar las técnicas de §5 y partirlo en varios PRs que dejan el sistema
funcionando en cada paso.

---

## 4. Catálogo de refactors, de menor a mayor riesgo

Los nombres siguen el catálogo de Fowler (*Refactoring*, 2ª ed.). Las guías específicas traen
el equivalente idiomático en Java 21 y Angular 18.

### Nivel 0 — Micro (riesgo ~nulo; aplicar libremente)

| Técnica | Qué hace |
|---|---|
| Rename Variable / Field / Method / Class | El nombre no describe lo que hace o contiene; se renombra. Con herramienta del IDE. **Excepción:** campos de entidades JPA, DTOs y enums persistidos (ver §7). |
| Extract Variable | Una expresión compleja se asigna a una variable con nombre que explica su intención. |
| Inline Variable | La variable no agrega claridad sobre la expresión; se elimina. |
| Replace Magic Literal | Un número o string con significado de negocio (`40`, `"live_capture"`) se reemplaza por una constante con nombre (`MINUTOS_POR_TIEMPO`). |
| Replace Temp with Query | Una variable temporal se reemplaza por un método/consulta que calcula el valor; habilita Extract Function sin arrastrar locales. |
| Split Variable | Una variable reasignada con significados distintos se separa en dos. |
| Slide Statements | Se acercan las sentencias relacionadas entre sí; suele ser el paso previo a Extract Function. |
| Remove Dead Code / Unused Parameter | Código, imports o parámetros que ya no se usan. Verificar con búsqueda en todo el repo (incluye templates y reflexión de Spring). |
| Consolidate Duplicate Conditional Fragments | Código idéntico en todas las ramas de un `if/else` se saca afuera. |

### Nivel 1 — Función / método (riesgo bajo)

| Técnica | Qué hace |
|---|---|
| Extract Function/Method | Un fragmento con intención identificable pasa a su propia función, con un nombre que dice *qué* hace, no *cómo*. |
| Inline Function | Una función cuyo cuerpo es tan claro como su nombre se inlinea. |
| Change Function Declaration | Renombrar y/o agregar, quitar o reordenar parámetros. En APIs públicas, usar Parallel Change (§5). |
| Introduce Parameter Object | Parámetros que viajan siempre juntos (data clump) se agrupan en un objeto. |
| Preserve Whole Object | En vez de pasar varios valores sueltos de un objeto, se pasa el objeto. |
| Parameterize Function | Dos funciones casi iguales que solo difieren en un valor se unifican con un parámetro. |
| Remove Flag Argument | Un booleano que cambia el comportamiento interno se reemplaza por dos funciones explícitas. |
| Separate Query from Modifier (CQS) | Un método que devuelve un valor *y* muta estado se separa en consulta y comando. |
| Split Loop | Un bucle que hace dos cosas se separa en dos bucles (el rendimiento casi nunca importa aquí; se mide si hay duda). |
| Replace Loop with Pipeline | Un bucle de filtrado/transformación se reemplaza por un pipeline (`stream()` en Java, `filter/map` en TS, operadores RxJS) **si queda más legible**, no por moda. |
| Decompose Conditional | Una condición compleja se extrae a una función con nombre (`if (esEventoDePuntaje(e))`). |
| Replace Nested Conditional with Guard Clauses | Condicionales anidados se aplanan con retornos tempranos para los casos excepcionales. |
| Combine Functions into Class / Transform | Varias funciones que operan sobre los mismos datos se agrupan (clase, o función que deriva un objeto enriquecido). |

### Nivel 2 — Clase / módulo (riesgo medio; revisar impacto en otras clases)

| Técnica | Qué hace |
|---|---|
| Extract Class | Una clase con más de una razón de cambio se divide. |
| Inline Class | Una clase que ya no justifica existir se fusiona con la que más la usa. |
| Move Function / Move Field | Un método o campo que se usa más desde otra clase (feature envy) se mueve allí. **Ojo en Spring:** mover métodos cambia transacciones y seguridad (ver guía Spring). |
| Hide Delegate / Remove Middle Man | Ajustar cuánto expone una clase de sus colaboradores. |
| Encapsulate Variable / Field / Collection | Estado mutable expuesto se pone detrás de accessors; las colecciones se devuelven como vistas inmutables. |
| Replace Primitive with Object | Un primitivo con reglas propias (un minuto de partido, un dorsal) pasa a un tipo propio. Es el paso intermedio antes de un Value Object completo. |
| Replace Derived Variable with Query | Un campo que guarda algo calculable a partir de otros datos se reemplaza por un cálculo (en Angular: `computed()`). |
| Replace Constructor with Factory Function | La construcción necesita validación o elegir subtipo. |
| Introduce Special Case | Chequeos de `null`/"desconocido" repetidos se reemplazan por un objeto o valor especial con comportamiento propio. |
| Introduce Assertion | Una precondición implícita se hace explícita. |

### Nivel 3 — Estructural / jerarquías (riesgo alto; exigir cobertura sólida)

| Técnica | Qué hace |
|---|---|
| Replace Conditional with Polymorphism | Un `switch`/`if` por "tipo" repetido en varios lugares se reemplaza por subtipos o Strategy. Referencia ya existente en el proyecto: las `*StatisticStrategy` de `StatisticService`. |
| Replace Type Code with Subclasses / State / Strategy | Un campo "tipo" que condiciona comportamiento en varios métodos se modela como jerarquía o Strategy inyectable. |
| Extract Superclass / Extract Interface | Dos clases comparten comportamiento o contrato. Preferir interfaz + composición antes que herencia. |
| Collapse Hierarchy | Una jerarquía que dejó de justificar sus niveles se aplana. |
| Replace Inheritance with Delegation | Una subclase usa solo parte del padre (viola LSP); se cambia herencia por composición. |
| Replace Subclass with Delegate | Variante de lo anterior cuando hay más de un eje de variación. |
| Split Phase | Un método que hace dos etapas (ej. validar/parsear y luego calcular) se separa, con un objeto intermedio explícito. |
| Extract Service por caso de uso | Un `*Service` que creció con muchos casos de uso no relacionados se parte por caso de uso (ver guía Spring). |

### Nivel 4 — Patrones tácticos de DDD (Evans) — solo si se justifica

No usar por defecto. Antes de aplicar cualquier técnica de este nivel, se debe poder responder
por escrito (en el PR): **qué invariante de negocio protege, y por qué un refactor de Nivel 0–3
no alcanza.** Si no hay respuesta clara, no se aplica. Todo el nivel requiere aprobación (§8).

| Técnica | Cuándo se justifica en OvalTrack | Cuándo NO |
|---|---|---|
| **Value Object** | Un grupo de primitivos con invariantes, comportamiento e igualdad por valor, repetido en 3+ lugares. Candidato: reloj de juego (`matchTime`, se pausa) vs tiempo de video (`absoluteMatchTime`, continuo) de `Event`, si la lógica de "tiempo efectivo"/proyección de pausas se repite en varios servicios. En Java se implementa como `record` (ver guía Spring). | Mientras el catálogo de eventos de la Fase 1 siga cambiando. `EventPossession`/`EventCategory` siguen siendo enums. |
| **Entity vs Value Object** | Como criterio al agregar clases nuevas: ¿necesita identidad propia o dos instancias con los mismos datos son iguales? | No re-litigar entidades JPA estables (`Match`, `Division`, `Club`) por prolijidad conceptual. |
| **Aggregate / Aggregate Root** | Aparece una invariante que cruza entidades y hoy nada la garantiza (ej. "la suma de puntos de los `Event` activos cuadra con el marcador de `Match`"). La solución en este proyecto **no** es una clase `Aggregate` con ceremonia: es que todas las mutaciones que afectan la invariante pasen por un único Application Service que la aplica, y que no haya otro punto de entrada que mute esas entidades. | Cuando la invariante ya está protegida por un único servicio. |
| **Domain Event** | Reaccionar a "algo pasó en el dominio" desacoplado del flujo principal. **Ya existe precedente:** `MatchPeriodClosedEvent` + `StatisticEventListener` (eventos de aplicación de Spring). Los nuevos siguen ese patrón y ese nombre: hecho en pasado + `Event` (`TryScoredEvent`). Nunca llamar a uno `Event` a secas: colisiona con la entidad `Event` (evento de partido). | Desacoplar dos servicios que hoy se llaman directo sin problema. Infraestructura de mensajería externa: fuera de alcance. |
| **Repository (DDD)** | Ya cubierto por Spring Data JPA. Una capa propia solo si decidir *qué* devolver requiere reglas de negocio sin lugar natural en el Service. | Envolver `JpaRepository` solo por seguir el patrón. |
| **Domain Service vs Application Service** | Cuando un `*Service` mezcla reglas puras de rugby (cuándo cambia la posesión, cómo se recalcula el marcador) con `@Transactional`/repositorios en el mismo método: extraer las reglas a una clase sin dependencias de infraestructura, testeable con unit tests puros. | Si el servicio es chico y legible. |
| **Specification** | Combinaciones de filtros de negocio sobre `Event` repetidas en más de una consulta. | Un filtro usado una sola vez. |
| **Bounded Context** | Solo en Fase 2 (multi-club real) si el modelo diverge de verdad. | Ahora: el documento de visión marca "sobrealcance" como riesgo. |

---

## 5. Refactors grandes: cómo partirlos sin romper nada

Cuando un cambio no entra en un commit chico (renombrar un campo de un contrato JSON, partir un
servicio usado por todo el sistema, reemplazar un mecanismo), se usa una de estas técnicas. Todas
mantienen el sistema funcionando y desplegable en cada paso.

| Técnica | Cómo funciona | Uso típico en OvalTrack |
|---|---|---|
| **Parallel Change (expand → migrate → contract)** | 1) *Expand*: agregar lo nuevo conviviendo con lo viejo. 2) *Migrate*: mover a los consumidores de a uno. 3) *Contract*: borrar lo viejo cuando nadie lo usa. Cada fase es un PR. | Renombrar un parámetro de método público, un campo de DTO (con aprobación, §8), una columna. |
| **Branch by Abstraction** | Introducir una interfaz delante de lo que se quiere reemplazar, hacer que todos los consumidores usen la interfaz, crear la implementación nueva detrás, cambiar, borrar la vieja. | Reemplazar la implementación de un cálculo de estadísticas o de un servicio interno. |
| **Strangler Fig** | Lo nuevo crece alrededor de lo viejo y va absorbiendo casos de uso hasta que lo viejo se puede borrar. | Partir un servicio gigante caso de uso por caso de uso. |
| **Mikado Method** | Intentar el cambio; si rompe cosas, anotar los prerequisitos en un grafo, **revertir**, resolver primero las hojas del grafo y volver a intentar. | Cuando no está claro cuánto arrastra un refactor. El grafo se deja en la descripción del PR. |

---

## 6. Tabla síntoma → refactor (consulta rápida)

Las señales numéricas son **disparadores para mirar**, no reglas automáticas.

| Síntoma / code smell | Señal orientativa | Refactor recomendado | Nivel |
|---|---|---|---|
| Nombre misterioso | Hace falta leer el cuerpo para saber qué es | Rename | 0 |
| Número o string "mágico" | Literal con significado de negocio | Replace Magic Literal | 0 |
| Comentario que explica *qué* hace un bloque | — | Extract Function con nombre descriptivo | 0–1 |
| Método largo | No entra en una pantalla (~30 líneas) o complejidad cognitiva > 15 | Extract Function repetido; Slide Statements antes | 1 |
| Lista de parámetros larga / data clump | Más de 3–4 parámetros, o los mismos viajan juntos | Introduce Parameter Object / Preserve Whole Object | 1 |
| Booleano que cambia el comportamiento | `hacerAlgo(x, true)` | Remove Flag Argument | 1 |
| Condicionales anidados en escalera | 3+ niveles de indentación | Guard Clauses / Decompose Conditional | 1 |
| Bucle que hace varias cosas | — | Split Loop → Replace Loop with Pipeline | 1 |
| Método que consulta y modifica a la vez | — | Separate Query from Modifier | 1 |
| Código duplicado | 3+ apariciones | Extract Function / Extract Class | 1–2 |
| Obsesión por primitivos | Mismas validaciones de un `int`/`String` en varios lugares | Replace Primitive with Object → Value Object (si tiene invariantes y 3+ usos) | 2 → 4 |
| Valor guardado que se puede calcular | Campo que se "sincroniza" a mano | Replace Derived Variable with Query (`computed()` en Angular) | 2 |
| Chequeos de `null` repetidos | Mismo `if (x == null)` en varios lugares | Introduce Special Case | 2 |
| Feature envy | Un método usa más datos de otra clase que de la propia | Move Function | 2 |
| Cadena de mensajes | `a.getB().getC().getD()` | Hide Delegate | 2 |
| Intermediario sin valor | Clase que solo delega | Remove Middle Man / Inline Class | 2 |
| Clase grande / God class | Muchas dependencias inyectadas (6+) o varios grupos de métodos sin relación | Extract Class / Extract Service por caso de uso | 2–3 |
| Cambio divergente | Una clase cambia por razones no relacionadas | Extract Class / Split Phase | 2–3 |
| Cirugía de escopeta | Un cambio de negocio obliga a tocar muchas clases | Move Function/Field para juntar lo que cambia junto; Inline Class | 2 |
| `switch`/`if` por tipo repetido | El mismo `switch` en 2+ lugares | Replace Conditional with Polymorphism / Strategy | 3 |
| Herencia rechazada | Subclase que ignora o rompe métodos del padre | Replace Inheritance with Delegation | 3 |
| Generalidad especulativa | Interfaces con una sola implementación "por si acaso", parámetros nunca usados | Inline Class / Collapse Hierarchy / Remove Parameter | 2–3 |
| Abstracción equivocada | Una función compartida llena de flags y casos especiales | Inline de vuelta en los llamadores y re-extraer lo común | 1–2 |

Síntomas propios de cada stack (proxies de Spring, entidades JPA, RxJS, signals, plantillas):
ver las guías específicas.

---

## 7. Reglas específicas del proyecto

- **Separación de capas.** Se rechaza cualquier refactor que mezcle Entity, DTO, Mapper,
  Service y Controller en una misma clase, aunque "simplifique".
- **`ddl-auto=update` sin migraciones.** Renombrar, eliminar o cambiar el tipo de un campo de
  entidad cambia el esquema real sin registro ni rollback. Hibernate **no renombra** columnas:
  crea una nueva y deja la vieja con los datos. La guía Spring explica cómo renombrar en Java sin
  tocar la base (`@Column(name = ...)`).
- **Enums persistidos o expuestos.** Renombrar una constante de `MatchStatus`, `UserRole`,
  `EventPossession`, etc. rompe datos ya guardados y el contrato JSON. No es un Rename de
  Nivel 0: requiere aprobación (§8).
- **Cucumber es la red de seguridad de contrato.** `.feature` y steps en español contra el
  backend vivo (`./ds test`). Todo refactor que toque `controller/` o la forma de un JSON se
  corre antes y después, sin excepción.
- **No correr `mvn`/`npm`/`ng` en el host.** Usar `./ds compile`, `./ds mvn <args>`,
  `./ds test`, `./ds test-front` o el contenedor de frontend.
- **Frontend: Signals para estado síncrono, RxJS para asincronía, sin `.subscribe()` anidados.**
  Un refactor que agrega un `.subscribe()` anidado es un paso atrás.
- **Nada de `any` como atajo.** Si un refactor obliga a tipar algo, tipar es parte del refactor.
- **`Map<String, Object>` en `EventType.metadata` y `Event.attributes`.** Primitive/Map
  Obsession conocida. **No tocar todavía**: el catálogo de eventos de Fase 1 sigue cambiando.
  Reevaluar (Value Object o tipos concretos, Nivel 4) cuando el mismo patrón de lectura del mapa
  aparezca en 3+ lugares.
- **Subsets de Bootstrap e íconos.** Si un refactor de plantilla agrega o cambia clases de
  Bootstrap o íconos, se regeneran y commitean los subsets en el mismo commit (comandos en
  `AGENTS.md`).
- **Notificaciones solo con `ToastService`; colores solo con tokens de `DESIGN_SYSTEM.md`.** Un
  refactor de UI no introduce estilos ad hoc.

---

## 8. Cuándo el agente debe detenerse y preguntar

No aplicar sin aprobación explícita, aunque el catálogo lo permita técnicamente:

- Cambiar el **contrato JSON** de un `controller` (nombres de campos, tipos, anidamiento,
  códigos HTTP, forma de los errores) — rompe frontend y steps de Cucumber.
- Cambiar una **entidad JPA** de forma que altere el esquema (renombrar/eliminar/cambiar tipo de
  campo, cambiar relaciones, `@Table`, `@Column`, `@Enumerated`), o que implique migrar datos.
- Renombrar o eliminar **constantes de enums** persistidos o expuestos en la API.
- Tocar **validación de roles o aislamiento por club/división** (`SecurityConfig`,
  `@PreAuthorize`, `DivisionSecurityValidator`, `MatchSecurityValidator`, JWT). Un error ahí es
  una fuga de datos entre clubes.
- Tocar la **sincronización offline-first** (orden de guardado, timestamps, `clientEventId`,
  resolución de conflictos, transacciones de Dexie). Requisito crítico: 0% de pérdida de eventos.
- Mover o extraer métodos anotados con `@Transactional`, `@PreAuthorize`, `@Async` o
  `@EventListener` entre clases, o volverlos privados (cambia el comportamiento real; ver guía
  Spring).
- Aplicar cualquier técnica de **Nivel 4 (DDD)**.
- Agregar **dependencias** (runtime, test o lint) o cambiar versiones.
- Un refactor que, al planificarlo, supera un PR revisable y requiere §5: se presenta el plan
  (y el grafo Mikado si aplica) antes de empezar.

---

## 9. Red de seguridad automatizada (fitness functions)

Las reglas de este documento valen más si una máquina las verifica. Lo que ya existe se usa
siempre; lo que no existe se propone (§1.8) y no se agrega por cuenta propia.

| Qué protege | Ya disponible | Posible incorporación (requiere aprobación) |
|---|---|---|
| Contratos de API | Cucumber (`./ds test`), colección `bruno/` | — |
| Comportamiento interno backend | JUnit 5 + Mockito + AssertJ (`spring-boot-starter-test`) | Tests de slice `@WebMvcTest` / `@DataJpaTest` |
| Lógica pura frontend | `./ds test-front` (Jasmine en Node) | — |
| Capas y dependencias entre paquetes | Revisión manual | Tests de arquitectura (ArchUnit) — ver guía Spring |
| Complejidad y smells | Inspecciones del IDE | Análisis estático en el IDE (SonarQube for IDE) o en CI |
| Calidad de los tests antes de un refactor grande | — | Mutation testing puntual (PIT en Java, Stryker en TS) sobre el módulo a refactorizar |

---

## 10. Reporte del agente al terminar

Al cerrar un trabajo de refactor, el agente entrega:

```markdown
## Refactor: <módulo>
- Síntomas atacados: <smell> → <técnica> (nivel N), uno por línea
- Commits: <hash corto> <mensaje>, uno por línea
- Tests ejecutados y resultado: <comando> → OK/FALLA
- Tests escritos pero NO ejecutados: <spec> (motivo: requiere TestBed/Karma)
- Verificación manual pendiente para el usuario: <pasos exactos y resultado esperado>
- Bugs detectados y NO corregidos (van aparte): <descripción>
- Decisiones que quedaron esperando aprobación (§8): <descripción>
```

El agente nunca declara verificado algo que no ejecutó (UI, responsive, tema oscuro, offline).

---

## 11. Mantenimiento de este documento

Si se agrega una convención o herramienta que cambie cómo se aplican estos refactors (por
ejemplo, si se aprueba ArchUnit, si el catálogo de `EventType` se estabiliza y se decide el Value
Object de §7, o si Fase 2 introduce Bounded Contexts), se actualiza este archivo y la guía
específica correspondiente en el mismo PR. La práctica real no debe divergir de lo escrito,
mismo criterio que `DESIGN_SYSTEM.md` para lo visual.

Línea sugerida para `AGENTS.md` / `CLAUDE.md`:

```markdown
## Refactor
Todo refactor sigue `docs/REFACTORING.md` (reglas generales, catálogo por riesgo, tabla
síntoma→refactor, cuándo parar y preguntar) y la guía del stack:
`docs/REFACTORING-SPRING.md` o `docs/REFACTORING-ANGULAR.md`.
```
