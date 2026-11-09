import { Given, Then } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import { getUserToken } from './auth_helper.js';
import { makeHttpRequest } from './httpRequest.js';

function assertStatus(statusCode) {
  assert.equal(
    this.response.status,
    statusCode,
    `Se esperaba código HTTP ${statusCode} pero se obtuvo ${this.response.status}: ${this.response.body?.message}`
  );
}

Given('que el administrador del club con email {string} y contraseña {string} ha iniciado sesión', async function (email, contraseña) {
  this.token = await getUserToken(email, contraseña);
  assert.ok(this.token, `Fallo de inicio de sesión para el admin ${email}`);
  this.response = await makeHttpRequest(
    "GET",
    `club/my-club`,
    null,
    this.token,
  );
  this.club = this.response.body;
});

// Los registros envían termsAccepted: true salvo que el escenario diga lo contrario
Given('no acepta los términos y condiciones', function () {
  this.termsAccepted = false;
});

Then('el sistema responde con {int} y {string}', function (statusCode, statusText) {
    assert.equal(this.response.body?.message, statusText);
    assert.equal(this.response.status, statusCode);
});

Then('el sistema responde con {int}', assertStatus);

Then('el sistema responde con código {int}', assertStatus);

Then('el sistema rechaza la solicitud con código {int}', assertStatus);
