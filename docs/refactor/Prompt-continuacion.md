Retomá el refactor de la pantalla <PANTALLA>.

1. Leé `CLAUDE.md`, `AGENTS.md`, `docs/refactor/REFACTORING.md` y la guía de stack que corresponda a los ítems de esta fase (`docs/refactor/REFACTORING-SPRING.md` o `docs/refactor/REFACTORING-ANGULAR.md`).
2. Leé por ruta exacta `supp/<slug>/refactoring/PLAN.md` y `supp/<slug>/refactoring/CAMBIOS.md` (están en `.gitignore`; no los agregues a git).
3. Verificá que el código no se haya movido desde la última sesión (`git log` desde el último hash registrado). Si algún ítem del plan quedó desactualizado, marcalo `bloqueado` y avisame antes de seguir.
4. **Línea base:** corré los tests que exige la fase (`./ds compile`, `./ds mvn test`, `./ds test`, `./ds test-front <carpeta>`) y anotá el resultado. Si algo que la fase necesita está en rojo y arreglarlo no es un ítem `aprobado` del plan, frená y avisame; no sigas sobre una red de seguridad rota.
5. **Rama:** antes del primer commit creá una rama `refactor/<slug>-fase-<n>` (o `fix/<slug>-fase-<n>` si la fase es de fixes). No hagas push ni abras PR salvo que te lo pida.
6. Ejecutá **solo** los ítems `aprobado` de la fase indicada en "Próximo paso". Seguí estas reglas:
   - **Commits:** un cambio = un commit; si falta cobertura, primero el test de caracterización.
   - **Fixes (ítems `FIX-*` / `BUG-*`):** no son refactors. Primero un test que **falla** y reproduce el bug (JUnit en `business/` o escenario Cucumber en español); después el arreglo mínimo que lo hace pasar. Commit `fix(<módulo>): <qué>`. Nunca mezclar un fix con un refactor en el mismo commit. Si el ítem dice "a confirmar" o "requiere confirmar diseño", frená y preguntame antes de codificar.
   - **Tests:** después de cada commit, según `docs/refactor/REFACTORING.md` §3. Si algo falla, revertí y partí el paso.
   - **Imprevistos de §8:** si aparece algo que no estaba en el plan, frená y preguntame.
7. Después de **cada** commit, marcá el ítem `hecho (<hash>)` en `PLAN.md`, para que si la sesión se corta, el plan refleje lo real.
8. Al terminar, actualizá "Estado" y "Próximo paso" en `PLAN.md`, agregá la entrada de la sesión en `CAMBIOS.md` y dame el reporte de `docs/refactor/REFACTORING.md` §10. No digas que verificaste nada que no ejecutaste.
