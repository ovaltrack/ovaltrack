import { Given, When, Then } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import { findEventType, parseAttributes, registerEvent } from '../../support/event_helper.js';
import { MISSING_UUID } from '../../support/ids.js';
import { makeHttpRequest } from '../../support/httpRequest.js';
import { findRosterPlayer, POST_CAPTURE } from '../../support/post_match_helper.js';

// Pasos reutilizados:
//  - "Dado que el coach / jugador / administrador del club ... ha iniciado sesión"
//  - "Y que existe un partido finalizado ..." (partido-flujo/step_definitions/linea_eventos_steps.js)
//  - "Y que existe un partido en curso ..." (evento/step_definitions/evento_steps.js)
//  - "Y que el partido tiene asignada la zona ..." (partido-flujo/step_definitions/match_zones_steps.js)

// <==================== Helpers ====================>

const getPlayerStatistics = (personId, token) =>
  makeHttpRequest('GET', `statistics/player/${personId}`, null, token);

const getPlayerMatchStatistics = (personId, matchId, token) =>
  makeHttpRequest('GET', `statistics/player/${personId}/match/${matchId}`, null, token);

/** El plantel se consulta con el token del coach: el jugador o un admin de otro club pueden no tener acceso. */
const personIdOf = async (world, fullName) => {
  const player = await findRosterPlayer(world.currentMatch.id, fullName, world.coachToken ?? world.token);
  return player.id;
};

/** `personId` que viaja en el JWT del usuario autenticado. */
const personIdFromToken = (token) =>
  JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')).personId;

// <==================== Preparación ====================>

Given('que se registraron los siguientes eventos de jugadores en el partido:', async function (dataTable) {
  this.coachToken = this.token;
  for (const row of dataTable.hashes()) {
    const response = await registerEvent(this.token, {
      eventTypeId: await findEventType(row.tipo_evento, this.token),
      matchId: this.currentMatch.id,
      origin: POST_CAPTURE,
      teamPossession: 'OWN',
      playerId: await personIdOf(this, row.jugador),
      matchTime: parseInt(row.tiempo_segundos, 10),
      period: parseInt(row.periodo, 10),
      attributes: parseAttributes(row.atributos),
    });
    assert.equal(response.status, 200, `No se pudo registrar ${row.tipo_evento} de ${row.jugador}: ${response.body?.message}`);
  }
});

// <==================== Consultas ====================>

When('consulta las estadísticas de {string} en el partido', async function (fullName) {
  this.response = await getPlayerMatchStatistics(await personIdOf(this, fullName), this.currentMatch.id, this.token);
});

When('consulta las estadísticas de {string} en un partido inexistente', async function (fullName) {
  this.response = await getPlayerMatchStatistics(await personIdOf(this, fullName), MISSING_UUID, this.token);
});

When('consulta sus propias estadísticas en el partido', async function () {
  this.response = await getPlayerMatchStatistics(personIdFromToken(this.token), this.currentMatch.id, this.token);
});

When('consulta las estadísticas generales de {string}', async function (fullName) {
  this.response = await getPlayerStatistics(await personIdOf(this, fullName), this.token);
});

// <==================== Partido ====================>

Then('el partido del jugador informa un plantel de {int} jugadores', function (squadSize) {
  assert.equal(this.response.body.squadSize, squadSize);
});

Then('las métricas del jugador en el partido incluyen:', function (dataTable) {
  const { metrics } = this.response.body.match;
  for (const { campo, valor } of dataTable.hashes()) {
    assert.equal(metrics[campo], Number(valor), `Métrica "${campo}"`);
  }
});

Then('la comparación con el plantel es:', function (dataTable) {
  const comparisons = this.response.body.comparisons;
  for (const { metrica, jugador, plantel, veredicto } of dataTable.hashes()) {
    const comparison = comparisons.find((c) => c.key === metrica);
    assert.ok(comparison, `No se informó la métrica "${metrica}"`);
    assert.equal(comparison.playerValue, Number(jugador), `Valor del jugador en "${metrica}"`);
    assert.equal(comparison.squadValue, Number(plantel), `Promedio del plantel en "${metrica}"`);
    assert.equal(comparison.verdict, veredicto, `Veredicto de "${metrica}"`);
  }
});

Then('el mapa de zonas del jugador tiene {int} eventos en la celda fila {int} columna {int}', function (count, row, col) {
  const cell = this.response.body.zones.cells.find((c) => c.row === row && c.col === col);
  assert.equal(cell?.count ?? 0, count);
});

Then('el mapa de zonas del jugador tiene {int} eventos sin zona', function (count) {
  assert.equal(this.response.body.zones.unzonedEvents, count);
});

// <==================== Generales ====================>

Then('las estadísticas generales son de la división {string} en la temporada del partido', function (divisionNombre) {
  const body = this.response.body;
  assert.equal(body.divisionName, divisionNombre);
  assert.equal(body.season, Number(this.currentMatch.date.slice(0, 4)));
  assert.ok(body.seasons.includes(body.season), 'La temporada informada no figura entre las disponibles');
  assert.ok(body.divisions.some((d) => d.divisionId === body.divisionId), 'La división no figura entre las disponibles');
});

Then('la lista de partidos del jugador incluye el partido con {int} puntos y {int} tackles completados', function (points, tackles) {
  const match = this.response.body.matches.find((m) => m.matchId === this.currentMatch.id);
  assert.ok(match, 'El partido no figura entre los jugados');
  assert.equal(match.metrics.points, points);
  assert.equal(match.metrics.tacklesMade, tackles);
});

Then('cada métrica comparada tiene un veredicto coherente con sus valores', function () {
  const { comparisons } = this.response.body;
  assert.equal(comparisons.length, 8);
  for (const { key, playerValue, squadValue, verdict } of comparisons) {
    if (playerValue === null || squadValue === null) {
      assert.equal(verdict, 'NO_DATA', `Veredicto de "${key}" sin datos`);
    } else if (verdict === 'ABOVE') {
      assert.ok(playerValue > squadValue, `"${key}" figura por encima con ${playerValue} vs ${squadValue}`);
    } else if (verdict === 'BELOW') {
      assert.ok(playerValue < squadValue, `"${key}" figura por debajo con ${playerValue} vs ${squadValue}`);
    } else {
      assert.equal(verdict, 'EQUAL', `Veredicto desconocido en "${key}"`);
    }
  }
});
