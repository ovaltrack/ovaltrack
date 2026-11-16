import { When, Then } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import { makeHttpRequest } from '../../support/httpRequest.js';

// Pasos reutilizados:
//  - "Y que existe un partido finalizado ..." (partido-flujo/step_definitions/linea_eventos_steps.js)
//  - "Y que el jugador ... ha iniciado sesión" (user/step_definitions/baja_usuario_steps.js)

When('consulta los partidos que jugó', async function () {
  this.response = await makeHttpRequest('GET', 'matches/me', null, this.token);
});

// opponentName trae el alias del rival, no su nombre
Then('la lista incluye el partido contra el rival de alias {string} con el rol {string}', function (alias, rol) {
  const found = this.response.body.some((m) => m.opponentName === alias && m.role === rol);
  assert.ok(found, `La lista no incluye un partido contra ${alias} como ${rol}`);
});

Then('el partido contra el rival de alias {string} informa su fecha de finalización', function (alias) {
  const match = this.response.body.find((m) => m.opponentName === alias);
  assert.ok(match, `La lista no incluye un partido contra ${alias}`);
  assert.ok(match.finishedAt, 'El partido jugado no informa finishedAt');
  assert.ok(!Number.isNaN(Date.parse(`${match.finishedAt}Z`)), `finishedAt no es una fecha: ${match.finishedAt}`);
});

Then('la lista de partidos jugados está vacía', function () {
  assert.deepEqual(this.response.body, []);
});
