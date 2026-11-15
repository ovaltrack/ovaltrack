import { When, Then } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import { makeHttpRequest } from '../../support/httpRequest.js';

// Pasos reutilizados: "que el usuario ... inició sesión" (perfil_usuario.js) y "el sistema responde con ..." (support/common_steps.js)

When('consulta su contexto', async function () {
  this.response = await makeHttpRequest('GET', 'api/me', null, this.token);
});

When('marca la guía como vista', async function () {
  this.response = await makeHttpRequest('POST', 'api/me/tutorial/seen', null, this.token);
});

When('un visitante sin sesión marca la guía como vista', async function () {
  this.response = await makeHttpRequest('POST', 'api/me/tutorial/seen');
});

Then('la guía figura pendiente', function () {
  assert.equal(this.response.body.tutorialPending, true);
});

Then('la guía ya no figura pendiente', function () {
  assert.equal(this.response.body.tutorialPending, false);
});
