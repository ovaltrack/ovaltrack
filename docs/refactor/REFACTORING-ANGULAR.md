# REFACTORING-ANGULAR.md — Refactor del frontend (Angular 18 PWA / TypeScript)

> Ubicación en el repo: `docs/REFACTORING-ANGULAR.md`. Última revisión: 2026-11-14.
> Leer antes `docs/REFACTORING.md`: principios, protocolo, catálogo y §8 (cuándo parar y
> preguntar) aplican completos. Este documento agrega lo propio del stack: qué cambia de
> comportamiento "sin que se note" en Angular/RxJS/Dexie, y cómo escribir el código destino.

## 0. Versiones y qué se puede usar

Stack fijo: **Angular 18** (standalone, PWA), TypeScript de la versión que trae el proyecto,
RxJS, Dexie (IndexedDB), Bootstrap 5 en subset. No se proponen upgrades. Verificar la versión
menor exacta en `frontend/package.json` antes de usar algo marcado "desde 18.x".

| Estable en v18 — usar | Developer preview en v18 — se puede usar (el proyecto ya lo hace) | **No** existe en v18 — no usar |
|---|---|---|
| Standalone components, `inject()`, `signal()`, `computed()`, control flow `@if`/`@for`/`@switch`, `@defer`, guards e interceptores funcionales, `DestroyRef` | `input()`, `output()`, `model()`, `viewChild()`/`viewChildren()`/`contentChild()`, `effect()`, `toSignal()`/`toObservable()`/`takeUntilDestroyed()`, `@let` (desde 18.1) | `linkedSignal`, `resource`/`rxResource`/`httpResource`, Signal Forms, zoneless estable, migraciones automáticas a signal inputs/outputs/queries (llegaron en v19: acá esos cambios se hacen a mano), estilo de archivos sin sufijo (v20+) |

Comandos (nunca `npm`/`ng` en el host):

```bash
./ds test-front src/app/features/match/post-match/utils   # specs puros (Jasmine en Node)
./ds frontend                                             # shell en el contenedor
#   dentro del contenedor:
npx ng build                        # compilación de producción (falla si faltan íconos/clases del subset)
npx ng generate @angular/core:control-flow --path src/app/features/<carpeta>
```

Los specs con `TestBed`/`HttpTestingController` se escriben pero **no se ejecutan** en este
entorno: se reportan como "no ejecutados". La verificación visual, responsive (390/1024/1440px),
tema claro/oscuro y offline la hace el usuario con los pasos que deja el agente (ver `AGENTS.md`).

---

## 1. Estructura y dirección de dependencias

```
src/app/
├── core/       guards, interceptor, routing, services (singletons), synchronization
├── features/   <dominio>/ { types/, services/, componentes, store/, utils/ }
└── shared/     componentes reutilizables sin conocimiento de dominio (navbar, toast-container)
```

- `features/*` puede usar `core/` y `shared/`. `shared/` **no** importa de `features/`.
- Una feature no importa componentes internos de otra feature; si algo se comparte entre dos
  features, se mueve a `shared/` (UI genérica) o a `core/` (servicio transversal) — Move Function
  con la regla de las tres repeticiones.
- Tipos del dominio en `features/<dominio>/types/`. Lógica pura en `features/<dominio>/utils/`
  (precedente: `post-match/utils/zone-grid.ts`).
- Imports relativos; el único alias es `@environments/*`. Un refactor no agrega aliases.

---

## 2. Componentes

### 2.1 Contenedor vs presentacional

- **Contenedor (página/feature):** inyecta servicios o el store, lee signals, llama comandos.
- **Presentacional:** recibe datos por `input()`, emite intenciones por `output()`, no inyecta
  servicios de datos. Es el destino natural de un **Extract Component**.

**Extract Component** es el Extract Function de las plantillas: un bloque del template con
intención propia (una fila de la tabla, una tarjeta de evento, el header de un panel) pasa a su
propio componente presentacional. Señales: template de más de ~150–200 líneas, bloques repetidos,
o un `@if` grande con su propio estado.

### 2.2 Reglas para el código destino

- `inject()` en campos `private readonly`, nunca inyección por constructor en código nuevo o
  refactorizado.
- Miembros usados solo desde el template: `protected`. Signals, inputs y outputs: `readonly`.
- En el template, solo lecturas de signals (`total()`) y pipes puros. Nada de métodos que calculan
  en cada ciclo de detección: se reemplazan por `computed()`.
- `@for` siempre con `track` por identidad estable (`track evento.id`). `track $index` solo para
  listas estáticas que nunca se reordenan.
- Bindings `[class.x]` / `[style.x]` en vez de `ngClass`/`ngStyle` en código nuevo o tocado.
- Handlers con nombre de la acción (`guardarEvento()`), no del evento (`onClick()`).
- Hooks de ciclo de vida finitos: delegan en métodos con nombre.
- Archivos con el estilo de v18: `*.component.ts`, `*.service.ts`, `*.store.ts`, prefijo de
  selector `app-`. **No** renombrar archivos masivamente al estilo sin sufijos de v20+.

### 2.3 Refactors de componente que cambian comportamiento

| Refactor | Qué puede cambiar | Regla |
|---|---|---|
| `ChangeDetectionStrategy.Default` → `OnPush` | La vista deja de actualizarse si el componente depende de inputs mutados en el lugar, de `setTimeout`, o de propiedades comunes modificadas desde afuera de signals/eventos. | Nivel 2. Recomendado para componentes nuevos y presentacionales. En existentes: solo si todo el estado que pinta viene de signals, inputs inmutables o `async`. Pasos de verificación manual obligatorios. |
| `*ngIf`/`*ngFor` → `@if`/`@for` (migración `control-flow`) | `@for` exige `track`; un `track` mal elegido recrea el DOM (pierde foco, scroll, estado de inputs). | Correr la migración acotada a una carpeta con `--path`, revisar cada `track` generado, un commit por carpeta. |
| `@Input()` decorado → `input()` | El valor pasa a ser signal: hay que leerlo como `valor()` en clase y template; `ngOnChanges` deja de ser necesario y debe reemplazarse por `computed()`. | A mano (no hay migración automática en v18), un componente por commit, actualizar specs. |
| Mover lógica de `ngOnInit` al constructor o a un `computed()` | Cambia el momento en que se ejecuta (los inputs no están disponibles en el constructor). | Verificar que no se lean inputs antes de tiempo. |
| Extraer un bloque con `@defer` | Cambia cuándo se carga y renderiza. | Es optimización, no refactor: commit aparte, verificación manual. |

---

## 3. Estado con Signals

- **Estado escribible privado, lectura pública de solo lectura** (Encapsulate Variable):

  ```ts
  @Injectable() // proveído en el componente de la pantalla: el estado vive lo que vive la pantalla
  export class MatchReviewStore {
    private readonly _events = signal<readonly PostMatchEvent[]>([]);
    readonly events = this._events.asReadonly();

    readonly scoringEvents = computed(() =>
      this.events().filter(e => esEventoDePuntaje(e)),
    );

    agregarEvento(evento: PostMatchEvent): void {
      this._events.update(lista => [...lista, evento]);
    }
  }
  ```

- **Derivado = `computed()`** (Replace Derived Variable with Query). Nunca un `effect()` que copie un
  signal en otro: es estado duplicado con sincronización manual. En v18 no existe `linkedSignal`;
  para estado "derivado pero editable por el usuario", el valor se resetea explícitamente dentro del
  método comando que cambia la fuente.
- **`effect()` solo para efectos hacia afuera** (persistir en `localStorage`, sincronizar con una API
  del DOM, logging). Si un `effect()` necesita `allowSignalWrites: true`, es casi siempre un
  `computed()` mal resuelto.
- **Inmutabilidad:** los signals comparan por referencia. Mutar un array u objeto en el lugar y
  volver a hacer `set` con la misma referencia **no notifica** a nadie. Un refactor nunca cambia
  `update(l => [...l, x])` por `l.push(x)`.
- **Un store por pantalla compleja** (precedente: `post-match/store/match-review.store.ts`). Los
  componentes leen signals y llaman comandos; ningún componente escribe estado de otro.
- Contexto global solo en `UserContextService`; un refactor no duplica ese estado en componentes.

---

## 4. Asincronía con RxJS

- Los servicios HTTP devuelven `Observable<T>` tipado. El componente o el store lo convierte con
  `toSignal()` o se suscribe **una sola vez** con `takeUntilDestroyed()`.
- **Prohibido `.subscribe()` anidado.** Pero ojo con el operador que se elige al aplanarlo: cada uno
  tiene semántica distinta y elegir mal es un cambio de comportamiento.

  | Operador | Semántica | Uso típico |
  |---|---|---|
  | `mergeMap` | Todas en paralelo, sin cancelar | **Equivalente exacto de un subscribe anidado.** Es el refactor puro. |
  | `switchMap` | Cancela la anterior al llegar una nueva | Búsquedas con `debounceTime`, cambio de ruta/parámetro |
  | `concatMap` | En cola, de a una, en orden | Guardados que deben respetar orden (**sincronización**) |
  | `exhaustMap` | Ignora nuevas mientras hay una en curso | Botón de enviar, evitar doble submit |

  Regla: el refactor de un subscribe anidado se hace con `mergeMap`. Pasar a `switchMap`/`concatMap`/
  `exhaustMap` porque "es lo correcto" es un **fix** en commit aparte, con su justificación.

- Pipelines repetidos → Extract Function a un operador con nombre:

  ```ts
  export const conReintentoYToast = <T>(toast: ToastService, mensaje: string) =>
    (source$: Observable<T>) => source$.pipe(
      retry({ count: 2, delay: 1000 }),
      catchError(err => { toast.error(mensaje); return throwError(() => err); }),
    );
  ```

- Errores: `catchError` en el servicio o en el borde, feedback con `ToastService`. Nunca
  `window.alert()`.
- `BehaviorSubject` usado como estado síncrono en un servicio → candidato a signal (Nivel 2: cambian
  todos los consumidores; Parallel Change si hay muchos).

---

## 5. Tipado

- Sin `any`, sin `as unknown as T` y sin `!` (non-null assertion) como atajo de refactor.
- En los bordes (respuestas HTTP, Dexie, `localStorage`) los datos entran como `unknown` o con el tipo
  del contrato, y se validan con *type guards* si hay duda.
- Variantes con **uniones discriminadas** en vez de flags opcionales:

  ```ts
  type EventOrigin = 'live_capture' | 'post_capture';

  type Possession =
    | { kind: 'OWN'; playerId: number }
    | { kind: 'OPPONENT' }        // sin jugador: regla de dominio
    | { kind: 'NEUTRAL' };
  ```

  Se crean nuevas uniones así en código nuevo; transformar los tipos que espejan JSON del backend
  cambia el mapeo y requiere cuidado (el JSON no cambia, pero sí el código que lo lee).
- Los tipos que espejan enums del backend (`MatchStatus`, `UserRole`, `EventPossession`, ...) deben
  coincidir **exactamente** con `CLAUDE.md` §3. Preferir uniones de literales u objetos `as const`
  para tipos nuevos; no migrar masivamente `enum` existentes.
- `satisfies` para validar objetos de configuración sin perder el tipo literal.
- `attributes` de eventos (`Record<string, unknown>` o equivalente): no tiparlo más fino todavía;
  misma regla que el backend (§7 general).

---

## 6. Offline-first y Dexie — zona de máximo riesgo

Requisito crítico: **0% de pérdida de eventos**. Todo lo de esta sección requiere aprobación salvo
Nivel 0 (renombres locales, Extract Variable) que no cambie el orden de ejecución.

- **Orden de los `await`** en el camino de guardado (`LocalDatabaseService`,
  `PendingEventSyncService`, `PendingMatchMutationSyncService`, `SyncManagerService`,
  `ActiveMatchPullService`): no se reordena, ni siquiera para "agrupar".
- **Transacciones de Dexie:** mover código dentro o fuera de `db.transaction('rw', ...)` cambia la
  atomicidad. Además, esperar una promesa que no es de Dexie (`fetch`, `HttpClient`, `setTimeout`)
  dentro de una transacción puede cerrarla antes de tiempo. Extraer a función un bloque que vive
  dentro de una transacción es válido solo si la función extraída se sigue llamando **dentro** de
  la misma transacción y no introduce awaits ajenos a Dexie.
- **`clientEventId`** (idempotencia) se genera antes del primer guardado local y nunca se regenera.
- **Timestamps:** no mover la generación de `Date.now()`/`new Date()` a otro momento del flujo; para
  testear, pasar el tiempo como parámetro (§7) sin cambiar dónde se toma en producción.
- **Esquema de Dexie** (`db.version(n).stores(...)`): renombrar tablas o índices es una migración de
  datos en el dispositivo del usuario.
- Verificación manual obligatoria: `./ds pwa` + DevTools offline, cargar eventos, reconectar,
  confirmar que todos llegan al backend una sola vez.

---

## 7. Testabilidad: extraer lógica pura

Como en este entorno solo corren specs puros (`./ds test-front`), **el refactor que más valor
agrega es sacar lógica de componentes y servicios a funciones puras en `utils/`**: sin `inject()`,
sin imports de `@angular/*`, deterministas (el tiempo y los datos entran por parámetro).

```ts
// features/match/post-match/utils/match-time.ts
export function minutoDePartido(periodo: 1 | 2, minutoDelPeriodo: number): number {
  return periodo === 1 ? minutoDelPeriodo : 40 + minutoDelPeriodo;
}

// match-time.spec.ts — corre con ./ds test-front
describe('minutoDePartido', () => {
  it('en el 2T el minuto 10 es el 50 de partido', () => {
    expect(minutoDePartido(2, 10)).toBe(50);
  });
});
```

Protocolo: 1) escribir el spec de caracterización sobre la función extraída **copiando** el
comportamiento actual; 2) hacer que el componente/servicio llame a la función; 3) correr
`./ds test-front`; 4) recién entonces mejorar la función.

Candidatos naturales: reglas de rugby (tiempos, puntos, posesión), cálculos de zonas y tramos,
filtros y agrupaciones de eventos, formateo de tiempos, validaciones de formularios.

---

## 8. UI: lo que un refactor no puede cambiar

- El resultado visual queda idéntico. Si un refactor de template cambia algo visible, no es refactor.
- Colores y sombras solo con tokens de `DESIGN_SYSTEM.md` / `styles.css`; overrides de tema oscuro en
  `[data-theme="dark"]`, no en `:host-context`.
- Un solo botón primario sólido por pantalla; hit-targets de 44–48px; `/live-capture` y `/halftime`
  siguen sin navbar ni `.layout-container`.
- **Subsets de Bootstrap e íconos:** mover markup entre archivos no requiere regenerar. Agregar una
  clase o ícono que antes no se usaba, o eliminar el último uso de uno, sí: regenerar y commitear en
  el mismo commit (comandos en `AGENTS.md`), y confirmar con `npx ng build` dentro del contenedor.
- El agente deja la lista de pasos de verificación manual (390/1024/1440px, claro/oscuro) con el
  resultado esperado.

---

## 9. Síntomas propios del frontend

| Síntoma | Refactor | Nivel / riesgo |
|---|---|---|
| `.subscribe()` anidado | Aplanar con `mergeMap` (equivalente); otro operador = fix aparte | 1 |
| `subscribe` sin `takeUntilDestroyed` en componente | Agregar `takeUntilDestroyed()` o pasar a `toSignal()` | 1 |
| Método llamado desde el template que calcula algo | `computed()` | 1 |
| Mismo estado derivado calculado en varios componentes | `computed()` en el store/servicio compartido | 1–2 |
| `effect()` que escribe otro signal | `computed()` o reset explícito en el comando | 2 |
| Array/objeto mutado en el lugar dentro de un signal | `update()` con copia inmutable | 1 — puede "arreglar" bugs de refresco: si cambia lo visible, es fix |
| Template enorme o bloques repetidos | Extract Component presentacional | 2 |
| Componente que inyecta muchos servicios y además pinta mucho | Separar contenedor / presentacionales; mover estado a un store | 2–3 |
| Lógica de negocio dentro de un componente | Extract Function pura a `utils/` + spec (§7) | 1 |
| `ngOnChanges` para recalcular a partir de inputs | `input()` + `computed()` | 2 |
| `any` / `!` / casts dobles | Tipar con tipos de `types/`, type guards en los bordes | 1–2 |
| Flags opcionales que representan variantes excluyentes | Unión discriminada | 2 |
| `*ngIf`/`*ngFor` en código que se está tocando | Migración `control-flow` acotada a la carpeta | 1–2 |
| Constructor injection | `inject()` en campos `private readonly` | 0–1 |
| `BehaviorSubject` como estado en servicio | Signal privado + `asReadonly()` | 2 |
| Cualquier síntoma dentro de `core/synchronization` o `local-database` | Anotar y pedir aprobación (§6) | — |

---

## 10. Lint (si se aprueba incorporarlo)

Si el proyecto tiene ESLint configurado, se corre antes de cada commit. Agregar ESLint, plugins o
reglas nuevas requiere aprobación (dependencias de desarrollo). Reglas que automatizan esta guía
(verificar nombres exactos en la versión instalada):

- `@typescript-eslint/no-explicit-any`
- `@typescript-eslint/no-non-null-assertion`
- `@angular-eslint/prefer-on-push-component-change-detection` (como `warn`, para código nuevo)
- `@angular-eslint/template/prefer-control-flow`
- `rxjs-x/no-nested-subscribe` (plugin `eslint-plugin-rxjs-x`)

---

## 11. Checklist antes de cada commit de refactor (frontend)

- [ ] El commit contiene **un** refactor y ningún cambio visible ni de comportamiento.
- [ ] Compila sin errores ni warnings nuevos; sin `any`, `!` ni casts dobles introducidos.
- [ ] `./ds test-front` en verde para la lógica pura tocada; specs con `TestBed` actualizados y
      marcados como "no ejecutados" en el reporte.
- [ ] Ningún `.subscribe()` anidado nuevo; aplanados con `mergeMap` salvo fix explícito.
- [ ] Nada tocado en `core/synchronization` ni `local-database` sin aprobación.
- [ ] Ninguna API que no exista en Angular 18 (`linkedSignal`, `resource`, `httpResource`, ...).
- [ ] Subsets de Bootstrap/íconos regenerados si cambió el conjunto de clases o íconos usados.
- [ ] Pasos de verificación manual listados para el usuario con el resultado esperado.
- [ ] Mensaje: `refactor(<feature>): <técnica> — <razón>`.
