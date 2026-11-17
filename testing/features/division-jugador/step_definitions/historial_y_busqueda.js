import { When, Then } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import { makeHttpRequest } from '../../support/httpRequest.js';
import { findDivisionId } from '../../support/match_helper.js';

When('busca {string} entre los jugadores actuales de la division {string}', async function (search, divisionName) {
  const divisionId = await findDivisionId(divisionName, this.token);
  this.response = await makeHttpRequest(
    'GET',
    `players?divisionId=${divisionId}&page=0&size=10&search=${encodeURIComponent(search)}`,
    null,
    this.token
  );
});

Then('los resultados incluyen un jugador cuyo nombre contiene {string}', function (fragment) {
  const normalized = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  assert.ok(this.response.body.content.some(player =>
    normalized(`${player.firstName} ${player.lastName}`).includes(normalized(fragment))));
});

When('consulta las personas con historial de la division {string}', async function (divisionName) {
  const divisionId = await findDivisionId(divisionName, this.token);
  this.response = await makeHttpRequest('GET', `players/history/people?divisionId=${divisionId}&page=0&size=10`, null, this.token);
});

Then('la respuesta de historial contiene personas', function () {
  assert.ok(this.response.body.content.length > 0);
});
