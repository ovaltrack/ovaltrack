import { When, Then } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { getUserToken } from '../../support/auth_helper.js';
import { getMatchCoverage } from '../../support/event_helper.js';
import { MISSING_UUID } from '../../support/ids.js';

// Pasos reutilizados:
//  - "Dado que el coach ... ha iniciado sesión" (division-jugador/step_definitions/creacion_jugadores.js)
//  - "Y que existe un partido finalizado ..." y "Y que se han registrado ... eventos ..." (linea_eventos_steps.js)
//  - "Y el entrenador elimina el evento {string}" (edicion_eventos_steps.js)
//  - "Entonces el sistema responde con {int}" y "... con {int} y {string}" (support/common_steps.js)

When('el entrenador consulta la cobertura de análisis del partido', async function () {
  this.response = await getMatchCoverage([this.currentMatch.id], this.token);
});

When('el administrador del club con email {string} y contraseña {string} consulta la cobertura de análisis del partido', async function (email, contraseña) {
  const otherClubToken = await getUserToken(email, contraseña);
  assert.ok(otherClubToken, `Fallo de inicio de sesión para ${email}`);
  this.response = await getMatchCoverage([this.currentMatch.id], otherClubToken);
});

When('el entrenador consulta la cobertura de análisis de un partido que no existe', async function () {
  this.response = await getMatchCoverage([MISSING_UUID], this.token);
});

When('el entrenador consulta la cobertura de análisis de {int} partidos', async function (cantidad) {
  this.response = await getMatchCoverage(Array.from({ length: cantidad }, () => randomUUID()), this.token);
});

Then('la cobertura del partido es de {int} jugadas, {int} sin jugador y {int} %', function (total, sinJugador, porcentaje) {
  assert.deepEqual(this.response.body, [
    { matchId: this.currentMatch.id, totalEvents: total, withoutPlayer: sinJugador, percent: porcentaje },
  ]);
});
