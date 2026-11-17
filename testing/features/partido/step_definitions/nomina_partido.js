import { When, Then } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import { getUserToken } from '../../support/auth_helper.js';
import { MISSING_UUID } from '../../support/ids.js';
import { makeHttpRequest } from '../../support/httpRequest.js';
import { getDivisionStarters, saveRoster } from '../../support/match_helper.js';

// Pasos reutilizados:
//  - "Dado que el coach ... ha iniciado sesión" (division-jugador/step_definitions/creacion_jugadores.js)
//  - "Y que existe un partido programado ..." y "Y que el partido está en curso" (partido_steps.js)

const saveStartersRoster = async function (starters) {
  this.response = await saveRoster(this.match.id, { titulares: starters, suplentes: [] }, this.token);
};

// <==================== Guardar la nómina ====================>

When('intenta guardar el plantel con {int} titulares de la division', async function (cantidad) {
  await saveStartersRoster.call(this, await getDivisionStarters(this.match.divisionId, this.token, cantidad));
});

When('intenta guardar un plantel con {int} suplentes', async function (cantidad) {
  const titulares = await getDivisionStarters(this.match.divisionId, this.token);
  const suplentes = Array.from({ length: cantidad }, (_, index) => ({ playerId: MISSING_UUID, number: titulares.length + index + 1 }));
  this.response = await saveRoster(this.match.id, { titulares, suplentes }, this.token);
});

When('intenta guardar un plantel con dos titulares con el mismo número', async function () {
  const [first, second, ...others] = await getDivisionStarters(this.match.divisionId, this.token);
  await saveStartersRoster.call(this, [first, { ...second, number: first.number }, ...others]);
});

When('intenta guardar un plantel con un titular que no pertenece a la division', async function () {
  const starters = await getDivisionStarters(this.match.divisionId, this.token);
  await saveStartersRoster.call(this, [...starters.slice(0, -1), { ...starters.at(-1), playerId: MISSING_UUID }]);
});

// <==================== Acceso desde otro club ====================>

const loginAsOtherClubAdmin = async (email, contraseña) => {
  const token = await getUserToken(email, contraseña);
  assert.ok(token, `Fallo de inicio de sesión para ${email}`);
  return token;
};

When('el administrador del club con email {string} y contraseña {string} intenta consultar la nómina del partido', async function (email, contraseña) {
  this.response = await makeHttpRequest('GET', `matches/${this.match.id}/roster`, null, await loginAsOtherClubAdmin(email, contraseña));
});

When('el administrador del club con email {string} y contraseña {string} intenta consultar el detalle de la nómina del partido', async function (email, contraseña) {
  this.response = await makeHttpRequest('GET', `matches/${this.match.id}/roster/players`, null, await loginAsOtherClubAdmin(email, contraseña));
});

When('el administrador del club con email {string} y contraseña {string} intenta guardar la nómina del partido', async function (email, contraseña) {
  const titulares = await getDivisionStarters(this.match.divisionId, this.token);
  this.response = await saveRoster(this.match.id, { titulares, suplentes: [] }, await loginAsOtherClubAdmin(email, contraseña));
});

When('el administrador del club con email {string} y contraseña {string} intenta consultar el bootstrap del plantel del partido', async function (email, contraseña) {
  this.response = await makeHttpRequest('GET', `matches/${this.match.id}/roster-bootstrap`, null, await loginAsOtherClubAdmin(email, contraseña));
});

// <==================== Consultar la nómina ====================>

Then('la nómina del partido tiene {int} titulares y {int} suplentes', async function (titulares, suplentes) {
  const response = await makeHttpRequest('GET', `matches/${this.match.id}/roster`, null, this.token);
  assert.equal(response.status, 200, response.body?.message);
  assert.equal(response.body.startingPlayers.length, titulares);
  assert.equal(response.body.substitutePlayers.length, suplentes);
});

Then('el detalle de la nómina muestra {int} titulares numerados desde el 1', async function (cantidad) {
  const response = await makeHttpRequest('GET', `matches/${this.match.id}/roster/players`, null, this.token);
  assert.equal(response.status, 200, response.body?.message);
  const numbers = response.body.filter((p) => p.role === 'TITULAR').map((p) => p.number).sort((a, b) => a - b);
  assert.deepEqual(numbers, Array.from({ length: cantidad }, (_, index) => index + 1));
});

Then('el partido figura en estado {string}', async function (estado) {
  const response = await makeHttpRequest('GET', `matches/${this.match.id}`, null, this.token);
  assert.equal(response.status, 200, response.body?.message);
  assert.equal(response.body.status, estado);
});

When('consulta el bootstrap del plantel del partido', async function () {
  this.response = await makeHttpRequest('GET', `matches/${this.match.id}/roster-bootstrap`, null, this.token);
});

Then('el bootstrap del plantel incluye el partido, los jugadores de la división y {int} titulares en la nómina', function (titulares) {
  const { match, players, roster } = this.response.body;
  assert.equal(match.id, this.match.id);
  assert.ok(players.length >= 15, `La división devolvió ${players.length} jugadores`);
  assert.equal(roster.filter((p) => p.role === 'TITULAR').length, titulares);
});
