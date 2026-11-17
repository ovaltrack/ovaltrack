import { After, Given, When, Then } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setEventTypeActive } from '../../support/db_helper.js';
import { getCoverage } from '../../support/event_helper.js';
import { MISSING_UUID } from '../../support/ids.js';
import { createScheduledMatch, findDivisionId, getMatchRosterPlayers, startMatch } from '../../support/match_helper.js';
import { findTimelineEvent, patchEvent } from '../../support/post_match_helper.js';

// Pasos reutilizados:
//  - "Dado que el coach/jugador/usuario ... ha iniciado sesión"
//  - "Y que existe un partido finalizado ...", "Y que se han registrado los siguientes eventos en el partido:",
//    "Y que se han registrado eventos con y sin jugador asignado para el partido" y "el entrenador elimina el evento"
//    (partido-flujo/step_definitions)
//  - "Entonces el sistema responde con ..." (support/common_steps.js)

// <==================== Contexto ====================>

Given('que se asigna un jugador del plantel a un evento {string}', async function (tipoEvento) {
  const event = await findTimelineEvent(this.currentMatch.id, tipoEvento, this.token);
  const [player] = await getMatchRosterPlayers(this.currentMatch.id, this.token);
  const response = await patchEvent(event.id, { playerId: player.id }, this.token);
  assert.equal(response.status, 200, `No se pudo asignar el jugador: ${response.body?.message}`);
});

Given('que el tipo de evento {string} está inactivo', async function (tipoEvento) {
  await setEventTypeActive(tipoEvento, false);
  this.inactiveEventType = tipoEvento;
});

Given('que existe además un partido en curso para la división {string} contra {string}', async function (divisionNombre, rival) {
  const divisionId = await findDivisionId(divisionNombre, this.token);
  this.extraMatch = await startMatch(await createScheduledMatch(divisionId, rival, this.token), this.token);
});

After({ tags: '@tipo_inactivo' }, async function () {
  await setEventTypeActive(this.inactiveEventType, true);
});

// <==================== Consulta ====================>

When('consulta la cobertura del partido', async function () {
  this.response = await getCoverage([this.currentMatch.id], this.token);
});

When('consulta la cobertura de ambos partidos', async function () {
  this.response = await getCoverage([this.currentMatch.id, this.extraMatch.id], this.token);
});

When('consulta la cobertura de un partido inexistente', async function () {
  this.response = await getCoverage([MISSING_UUID], this.token);
});

When('consulta la cobertura de {int} partidos', async function (cantidad) {
  const ids = Array.from({ length: cantidad }, () => randomUUID());
  this.response = await getCoverage(ids, this.token);
});

// <==================== Resultado ====================>

Then('la cobertura del partido es de {int} eventos, {int} sin jugador y {int} por ciento', function (total, sinJugador, porcentaje) {
  assert.equal(this.response.body.length, 1);
  const [coverage] = this.response.body;
  assert.deepEqual(
    { matchId: coverage.matchId, totalEvents: coverage.totalEvents, withoutPlayer: coverage.withoutPlayer, percent: coverage.percent },
    { matchId: this.currentMatch.id, totalEvents: total, withoutPlayer: sinJugador, percent: porcentaje },
  );
});

Then('la respuesta incluye solo la cobertura del partido finalizado', function () {
  assert.deepEqual(this.response.body.map((c) => c.matchId), [this.currentMatch.id]);
});
