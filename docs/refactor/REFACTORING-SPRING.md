# REFACTORING-SPRING.md — Refactor del backend (Java 21 / Spring Boot 3.3.4)

> Ubicación en el repo: `docs/REFACTORING-SPRING.md`. Última revisión: 2026-11-14.
> Leer antes `docs/REFACTORING.md`: principios, protocolo, catálogo y §8 (cuándo parar y
> preguntar) aplican completos. Este documento agrega lo propio del stack: qué cambia de
> comportamiento "sin que se note" en Spring/JPA, y cómo escribir el código destino.

## 0. Versiones y qué se puede usar

Stack fijo: **Java 21, Spring Boot 3.3.4** (Spring Framework 6.1, Spring Security 6.3,
Hibernate 6.5, Jackson 2.17), Lombok, PostgreSQL 16. No se proponen upgrades.

| Disponible y recomendado | **No** disponible en este stack — no usar |
|---|---|
| `record`, `sealed` + `permits`, `switch` con pattern matching y record patterns, `instanceof` con patrón, text blocks, `var`, sequenced collections (`getFirst()`, `getLast()`, `reversed()`), `Stream.toList()` | Variables sin nombre `_` (estables desde Java 22), String Templates, Stream Gatherers, cuerpos de constructor flexibles, `import module` |
| `RestClient`, `@TransactionalEventListener`, `ApplicationEventPublisher`, `@ConfigurationProperties` con records | Anotaciones de null-safety JSpecify de Spring 7, versionado de API de Spring 7, Jackson 3 |
| `ProblemDetail` existe en Spring 6.1, **pero el proyecto usa `MessageResponse`**: no migrar (cambia el contrato de errores) | Cualquier cosa que requiera cambiar `pom.xml` sin aprobación |

Comandos (nunca `mvn` en el host):

```bash
./ds compile                          # compila dentro del contenedor
./ds mvn test                         # todos los tests unitarios
./ds mvn test -Dtest=MatchServiceTest # una clase
./ds restart backend && ./ds logs backend   # tras tocar entidades/queries: ver arranque
./ds test                             # Cucumber contra el backend vivo
./ds db                               # psql, para verificar nombres reales de columnas
```

---

## 1. Dirección de dependencias entre capas

Paquete base `com.ovaltrack.backend`, organizado por dominio y, dentro, por capa:

```
controller/  →  business/ (services)  →  repository/
     │               │                        │
     └──── dto ──────┴──── domain/ (entidades, enums) ◄┘
```

- **Controller:** recibe y valida (`@Valid`), llama a **un** método de servicio, devuelve
  `ResponseEntity<...>`. Sin lógica de negocio, sin `try/catch` de excepciones de negocio, sin
  `BindingResult`, sin repositorios.
- **Service (`business/`):** orquesta casos de uso, define el borde transaccional, mapea
  entidad ↔ DTO **dentro** de la transacción.
- **Repository:** solo acceso a datos.
- **Domain:** entidades y enums; no depende de servicios ni de controllers.
- **Entre dominios:** un servicio de `match` usa servicios de `event`, no su repositorio. Si hoy
  existen accesos cruzados a repositorios, no se corrigen "de paso": se anotan y se tratan como
  refactor propio.
- **Las entidades nunca salen del servicio.** Si un controller recibe o devuelve una entidad, es
  un smell a corregir (con cuidado: el JSON resultante debe quedar idéntico, ver §4).

---

## 2. Trampas de proxies: refactors que en Spring cambian el comportamiento

Spring implementa `@Transactional`, `@PreAuthorize`, `@Async`, `@Cacheable` y los listeners con
**proxies**. La anotación solo actúa cuando el método es invocado **desde otro bean** a través del
proxy. Por eso un Extract Method o un Move Function "inocente" puede cambiar transacciones o
seguridad sin que falle ningún test unitario.

| Refactor | Qué puede cambiar | Regla |
|---|---|---|
| Extract Method a un método **privado de la misma clase** | Nada, si el método que llama es el que tiene la anotación. Pero una anotación puesta en el método extraído **no hace nada** (autoinvocación). | No poner `@Transactional`/`@PreAuthorize` en métodos privados ni en métodos llamados desde la misma clase. |
| Extract Class / Move Function de un método a **otro bean** | Ahora la llamada pasa por el proxy: si el método movido tiene anotaciones, empiezan a aplicarse (nueva transacción, chequeo de rol, ejecución async). Si las tenía y se movió a un método privado, dejan de aplicarse. | Requiere aprobación (§8 general). Documentar en el PR qué anotaciones tenía/tiene cada método antes y después. |
| Partir un método `@Transactional` en dos llamadas desde el controller | Lo que era atómico pasa a ser dos transacciones: un fallo en la segunda deja la primera commiteada. | Prohibido como refactor. El borde transaccional de un caso de uso se mantiene en un solo método de servicio. |
| Cambiar una excepción unchecked por checked, o capturarla | Por defecto solo `RuntimeException` y `Error` hacen rollback. Una checked, o una excepción capturada y "tragada", hace commit. | No cambiar el tipo de excepción ni agregar `catch` en código transaccional como parte de un refactor. |
| Agregar `@Transactional(readOnly = true)` | Hibernate deja de hacer flush de entidades modificadas: si el método "de consulta" mutaba algo (aunque sea por accidente), ese cambio deja de guardarse. | Solo en métodos verificados como puras consultas, con test que lo cubra. Es un cambio aparte, no "de paso". |
| `@EventListener` ↔ `@TransactionalEventListener` | El segundo se ejecuta por defecto **después del commit** y no se ejecuta si hay rollback. | Cambio de comportamiento, no refactor. `StatisticEventListener` / `MatchPeriodClosedEvent` no se tocan sin aprobación. |
| Mover/renombrar un método con `@PreAuthorize` o tocar `SecurityConfig` | Puede dejar un endpoint sin control de rol o de club. | Siempre requiere aprobación. Cubrir con Cucumber de acceso denegado (401/403) antes. |

**Inyección:** siempre por constructor con `@RequiredArgsConstructor` y campos `private final`.
Nunca `@Autowired` en campos ni setters. Una dependencia circular entre servicios es un smell:
se resuelve extrayendo lo común a un tercer componente, no con `@Lazy`.

---

## 3. JPA / Hibernate con `ddl-auto=update`

Hibernate con `update` **agrega** columnas y tablas, pero **no renombra ni borra**. Consecuencias:

### 3.1 Renombrar un campo de entidad sin tocar la base (refactor seguro)

1. Ver el nombre real de la columna (Spring Boot usa snake_case: `matchTime` → `match_time`):

   ```bash
   ./ds db
   \d events
   ```

2. Fijar el nombre actual explícitamente **antes** de renombrar:

   ```java
   // Antes
   private Integer matchTime;

   // Paso 1: fijar la columna (commit propio, no cambia nada)
   @Column(name = "match_time")
   private Integer matchTime;

   // Paso 2: renombrar el campo Java con el IDE (commit propio)
   @Column(name = "match_time")
   private Integer gameClockSeconds;
   ```

3. Lo mismo para `@Table(name = ...)` al renombrar la clase y `@JoinColumn(name = ...)` al
   renombrar una relación.
4. Buscar el nombre viejo en: métodos derivados de repositorios (`findByMatchTime...`),
   strings de `@Query` (JPQL usa nombres de **campos**, SQL nativo usa nombres de **columnas**),
   DTOs/mappers y `staging/*.sql`.
5. Reiniciar y mirar el arranque: los métodos derivados y las `@Query` JPQL se validan al
   levantar el contexto, **no** al compilar.

   ```bash
   ./ds restart backend && ./ds logs backend
   ```

Sin el paso 2 de `@Column`, el rename crea una columna nueva vacía y los datos quedan en la vieja:
para la aplicación, se "perdieron".

### 3.2 Otras reglas de entidades

- **Enums:** con `@Enumerated(EnumType.STRING)` renombrar una constante rompe las filas
  existentes; con `ORDINAL`, **reordenar** rompe las filas existentes. Ambos requieren aprobación.
  Agregar constantes al final es seguro.
- **Lombok en entidades:** no usar `@Data` ni `@EqualsAndHashCode`/`@ToString` sobre todos los
  campos (relaciones lazy → consultas inesperadas, recursión, `hashCode` inestable). `@Getter` y
  `@Setter` sí. Cambiar `equals`/`hashCode` de una entidad cambia el comportamiento de `Set`s y
  del contexto de persistencia: no es un refactor.
- **Fetch:** cambiar `LAZY`/`EAGER` o agregar `JOIN FETCH` cambia consultas y rendimiento; se
  trata como cambio de comportamiento, con medición.
- **Acceso a relaciones lazy:** mapear a DTO dentro del método transaccional del servicio. Un
  refactor que mueve ese mapeo afuera de la transacción puede producir
  `LazyInitializationException` (o depender de `open-in-view`, que no debe darse por sentado).
- **Pipelines sobre colecciones lazy:** reemplazar un `for` por `stream()` no arregla un N+1; las
  consultas son las mismas.
- **Borrado lógico de `Event` (`active`):** cualquier consulta reescrita o extraída debe seguir
  filtrando `active = true` donde corresponda. Cubrirlo con test antes de tocar.

---

## 4. Contratos JSON y DTOs

El contrato es lo que ve el frontend y Cucumber: nombres de propiedades, tipos, nulos, anidamiento,
orden de enums como strings, códigos HTTP y forma de los errores.

- **Renombrar un campo Java de un DTO sin cambiar el JSON:**

  ```java
  @JsonProperty("teamPossession")
  private EventPossession possession;
  ```

- **Convertir un DTO de clase Lombok a `record`** (recomendado para DTOs nuevos e inmutables) es
  Nivel 2 y se verifica con Cucumber. Puntos que cambian el JSON o rompen código:
  - Booleanos: en una clase Lombok, `private boolean active` genera `isActive()` → JSON
    `"active"`. En un record, el nombre de la componente **es** la propiedad: la componente se
    debe llamar `active`, no `isActive`.
  - Usos de `@Builder`, setters o constructores sin argumentos en mappers y tests dejan de
    compilar: actualizarlos en el mismo commit.
  - `@JsonInclude`, `@JsonFormat` y anotaciones de validación (`@NotNull`, `@Size`) se pasan a
    las componentes del record.
  - Comparar el JSON real antes y después (Bruno o `curl` contra el mismo dato de `staging/`).
- **Convención de respuesta por módulo:** hay módulos con `ResponseEntity<DTO>` directo y otros
  con `BackendResponse<T>` / `MessageResponse`. Un refactor respeta la convención del módulo que
  toca; **unificarlas cambia el contrato** y requiere aprobación.
- **Errores:** siguen centralizados en `GlobalExceptionHandler` con `MessageResponse`. Ningún
  refactor agrega manejo de errores en controllers ni cambia los códigos (409/404/401/403/400).

---

## 5. Servicios: cómo partirlos

Señales de que un `*Service` necesita Extract Class: más de ~6 dependencias inyectadas, métodos
agrupables en casos de uso que no se llaman entre sí, o reglas de rugby puras mezcladas con
repositorios y `@Transactional`.

**Corte recomendado (ejemplo ilustrativo; verificar en el código real):**

```
MatchService (demasiado grande)
├── MatchLifecycleService   start, closeFirstHalf, startSecondHalf, finish, cancel
├── MatchRosterService      getRoster, saveRoster
└── MatchScoreRules         reglas puras: puntos por tipo, recálculo de marcador
                            (sin Spring, sin repositorios → unit test sin mocks)
```

Pasos seguros: 1) Extract Class de las reglas puras (no tienen anotaciones: riesgo bajo).
2) Extract Class por caso de uso con Branch by Abstraction o Strangler Fig (§5 general),
moviendo el controller a llamar al servicio nuevo método por método. 3) Revisar la tabla de §2
para cada método movido.

**Reglas puras de dominio** (cuándo cambia la posesión, puntos por jugada, tiempo de juego vs
tiempo de video, validaciones de tiempos 40'/80') son las mejores candidatas a clases sin
dependencias de infraestructura: se testean rápido y sin mocks.

**Patrones ya presentes que sirven de referencia:** `*StatisticStrategy` (Strategy para
polimorfismo), `MatchPeriodClosedEvent` + `StatisticEventListener` (eventos de aplicación).
Nuevas variantes siguen esos patrones en vez de inventar otros.

---

## 6. Java 21: idioms destino al refactorizar

| En vez de | Usar | Notas |
|---|---|---|
| DTO o VO mutable con Lombok `@Data` | `record` | Ver §4 antes de convertir un DTO existente. Validar invariantes en el constructor compacto. |
| Grupo de primitivos con reglas (Value Object) | `record` con validación | `record GameClock(int seconds) { GameClock { if (seconds < 0) throw ...; } }` — Nivel 4: requiere justificación. |
| `switch` clásico con `break` sobre enum | `switch` expression **sin `default`** | Si se agrega una constante al enum, el compilador obliga a manejarla. |
| Cadena de `if (x instanceof A) ... else if (x instanceof B)` | `sealed interface` + `switch` con patrones | Para conjuntos **cerrados** de variantes donde se agregan operaciones más seguido que tipos. Si se agregan tipos más seguido, preferir polimorfismo/Strategy. |
| Cast después de `instanceof` | `if (x instanceof Foo foo)` | Nivel 0. |
| JPQL concatenado en strings | Text blocks `"""` | Nivel 0, verificar arranque (§3.1 paso 5). |
| `list.get(0)` / `list.get(list.size()-1)` | `getFirst()` / `getLast()` | Ojo: sobre lista vacía lanzan `NoSuchElementException` en vez de `IndexOutOfBoundsException`; si algo captura esa excepción, es cambio de comportamiento. |
| `collect(Collectors.toList())` | `.toList()` | **Devuelve lista inmodificable.** Si algún llamador hace `add`/`remove`, falla en runtime. Verificar usos antes. |
| `Optional` como campo o parámetro | `Optional` solo como tipo de retorno | Nunca `.get()` sin chequeo: `orElseThrow(() -> new EntityNotFoundException(...))`. |
| `null` devuelto para "no encontrado" | `Optional` o excepción de negocio | Cambia la firma: aplicar con Change Function Declaration y actualizar todos los llamadores. |
| Tipo explícito largo y obvio | `var` | Solo cuando el tipo es evidente en la misma línea. No en firmas ni en campos (no se puede). |
| Efectos secundarios dentro de `map`/`filter` | Pipeline sin efectos + bucle explícito para efectos | Un stream con mutaciones adentro es menos legible que un `for`. |

---

## 7. Tests que habilitan refactors (y no los traban)

- **Testear comportamiento, no implementación.** Afirmar sobre resultados y estado (AssertJ),
  no sobre cada interacción. Un test lleno de `verify(...)` para cada llamada interna se rompe en
  cada refactor y obliga a reescribirlo: eso no es una red de seguridad.
- **Tests de caracterización** para `business/` antes de refactorizar: JUnit 5 + Mockito +
  AssertJ (vienen con `spring-boot-starter-test`). Mockear solo bordes (repositorios, servicios de
  otros dominios, mail), nunca la clase bajo prueba.
- **No testear métodos privados.** Si una lógica privada merece test propio, es la señal para
  Extract Class (§5).
- **Nombres descriptivos en español** con `@DisplayName` (consistente con Cucumber):
  `@DisplayName("Cambiar a posesión OPPONENT limpia el jugador asignado")`.
- **Después de tocar entidades o queries:** reinicio + logs (§3.1), además de tests.
- **Después de tocar controllers o DTOs:** `./ds test` antes y después; si algo falla después,
  se revierte el refactor, no se "arregla" el step.

### Posible incorporación (requiere aprobación): tests de arquitectura

Si el equipo aprueba agregar ArchUnit como dependencia de test, estas reglas convierten §1 en una
verificación automática:

```java
@AnalyzeClasses(packages = "com.ovaltrack.backend")
class ArquitecturaTest {

    @ArchTest
    static final ArchRule controllersNoUsanRepositorios =
        noClasses().that().resideInAPackage("..controller..")
            .should().dependOnClassesThat().resideInAPackage("..repository..");

    @ArchTest
    static final ArchRule dominioNoDependeDeCapasSuperiores =
        noClasses().that().resideInAPackage("..domain..")
            .should().dependOnClassesThat()
            .resideInAnyPackage("..business..", "..controller..");

    @ArchTest
    static final ArchRule sinInyeccionPorCampo =
        noFields().should().beAnnotatedWith(Autowired.class);
}
```

Si al introducirlas fallan por código existente, se registran las violaciones actuales como
excepciones conocidas y se corrigen de a una, no todas en un PR.

---

## 8. Síntomas propios del backend

| Síntoma | Refactor | Nivel / riesgo |
|---|---|---|
| Controller con `if`s de negocio, cálculos o acceso a repositorio | Move Function al servicio | 2 — Cucumber antes/después |
| Controller con `try/catch` de `BusinessException` | Eliminar el catch (lo maneja `GlobalExceptionHandler`) | 2 — verificar que el código HTTP y el mensaje queden iguales |
| Entidad devuelta o recibida por un controller | Introducir DTO + mapper con el **mismo JSON** | 2 — requiere comparar JSON |
| Servicio con muchas dependencias o casos de uso no relacionados | Extract Class por caso de uso (§5) | 2–3 — revisar §2 |
| Regla de rugby enterrada en un método con `@Transactional` y repositorios | Extract Class a regla pura sin dependencias | 2 |
| Mismo `switch` sobre `EventCategory`/`EventPossession` en varios servicios | Replace Conditional with Polymorphism / Strategy, o un método en el enum | 3 |
| `@Autowired` en campos | Constructor con `@RequiredArgsConstructor` + `final` | 0–1 |
| Validación manual repetida en controllers | Bean Validation (`@Valid`, `@NotNull`, ...) en el DTO | 2 — la respuesta de error debe ser la misma (409 con el mensaje del primer campo) |
| Lógica de acceso por club/división duplicada | Centralizar en los `*SecurityValidator` existentes | **Requiere aprobación** |
| `Map<String,Object>` de `attributes`/`metadata` leído en muchos lugares | Por ahora nada (ver §7 general); cuando haya 3+ lecturas iguales, proponer tipo concreto | 4 — requiere aprobación |
| Entidad con `@Data` | `@Getter`/`@Setter` + `equals`/`hashCode` revisados | 2 — cambiar `equals`/`hashCode` es cambio de comportamiento; consultar |

---

## 9. Checklist antes de cada commit de refactor (backend)

- [ ] El commit contiene **un** refactor y ningún cambio de comportamiento.
- [ ] `./ds compile` sin errores.
- [ ] Tests unitarios del módulo en verde (`./ds mvn test -Dtest=...` o `./ds mvn test`).
- [ ] Si tocó entidades, repositorios o `@Query`: reinicio + logs sin errores, y nombres de columna
      verificados en `./ds db`.
- [ ] Si tocó controllers, DTOs o forma de JSON: `./ds test` en verde antes **y** después.
- [ ] Ningún método con `@Transactional`/`@PreAuthorize`/`@Async`/listener cambió de clase ni de
      visibilidad (o está aprobado y documentado).
- [ ] Ninguna constante de enum persistida renombrada ni reordenada.
- [ ] Ningún cambio en `pom.xml`.
- [ ] Mensaje: `refactor(<módulo>): <técnica> — <razón>`.
