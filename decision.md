# decision.md

Registro local del trabajo (no se commitea).

## Estado actual — 2026-11-07

Rama `HU-landing-funcionalidades` (desde `main` @ 1d94630). HU: "Como posible usuario, quiero que la home me muestre las funcionalidades para decidir si contratar el servicio".

- [x] Rediseño de la landing pública (`features/home/landing/`): hero con vista previa de la carga en vivo, "Cómo funciona" (4 pasos), 6 funcionalidades, bloque offline-first, roles, cierre y footer.
- [x] Fix "Ver funcionalidades": scroll suave a `#features` + foco.
- [x] Spec `landing.component.spec.ts` (sin correr: no hay Chrome en el contenedor; solo type-check).
- [x] Capturas reales en `frontend/src/assets/landing/` (carga en vivo y estadísticas, webp 800/1600 px): reemplazan el tablero ilustrativo del hero y se suman como sección al inicio de `#features`.
- [ ] Revisión visual del usuario en local → commit → PR.

## Decisiones

| Fecha | Decisión | Motivo |
|---|---|---|
| 2026-11-07 | El botón usa `scrollIntoView` en vez de `href="#features"` | Con `<base href="/">` el ancla navega a `/#features`, el router redirige a `/home` y se pierde |
| 2026-11-07 | Textos en `landing-content.ts` tipados | Separar contenido de marketing del maquetado |
| 2026-11-07 | Solo tokens del design system; un único `.btn-invite` | Reglas Sport Pro Salvia; claro/oscuro salen de los tokens |
| 2026-11-07 | Sin testimonios ni cifras inventadas; la vista previa se rotula "ilustrativa" | No mostrar datos falsos a posibles clientes |
| 2026-11-07 | Capturas con Chrome headless (CDP, 2x) sobre datos de staging, viewport 1680x1050 para la carga en vivo | A ≤1440 px el encabezado de la carga en vivo superpone "Estadísticas" con el marcador (bug aparte) |
| 2026-11-07 | Carga en vivo: partido vs Patoruzú con posesión propia; estadísticas: partido vs Trelew 32–21 | Fondo verde se lee mejor que el rojo de posesión rival; partido con 505 eventos |
