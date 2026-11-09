import { Given, When, Then } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import {
  countActivePasswordResetTokens,
  createPasswordResetToken,
  upsertLoginAccount,
} from '../../support/db_helper.js';
import { makeHttpRequest } from '../../support/httpRequest.js';

// Pasos reutilizados:
//  - "Cuando solicita recuperar la contraseña de la cuenta ..." y "Cuando consulta los datos de su sesión"
//    (auth/step_definitions/autenticacion_steps.js)
//  - "Entonces el sistema responde con {int}" y "... con {int} y {string}" (support/common_steps.js)

const login = (email, password) => makeHttpRequest('POST', 'api/auth/login', { email, password });

// Los enlaces se insertan en la BD (como si el correo ya se hubiera enviado): el entorno de pruebas no manda mails.
Given('la cuenta {string} con la contraseña {string}', async function (email, password) {
  await upsertLoginAccount(email, password);
});

Given('un enlace de recupero {string} para {string}', async function (rawToken, email) {
  await createPasswordResetToken(email, rawToken);
});

Given('un enlace de recupero {string} para {string} que venció', async function (rawToken, email) {
  await createPasswordResetToken(email, rawToken, { expiresInHours: -1 });
});

Given('un enlace de recupero {string} para {string} que es de una invitación', async function (rawToken, email) {
  await createPasswordResetToken(email, rawToken, { purpose: 'INVITATION' });
});

Given('un enlace de recupero {string} para {string} que no existe', function (_rawToken, _email) {
  // Nada que insertar: el backend no conoce ese valor
});

When('valida el enlace de recupero {string}', async function (token) {
  this.response = await makeHttpRequest('POST', 'api/auth/password-reset/validate', { token });
});

When('restablece la contraseña con el enlace {string} y la contraseña {string}', async function (token, password) {
  this.response = await makeHttpRequest('POST', 'api/auth/password-reset/confirm', { token, password });
});

Then('el enlace corresponde a la cuenta {string}', function (email) {
  assert.equal(this.response.body?.email, email);
});

Then('la cuenta {string} tiene {int} enlace de recupero vigente', async function (email, expected) {
  assert.equal(await countActivePasswordResetTokens(email), expected);
});

Then('la cuenta {string} puede iniciar sesión con {string}', async function (email, password) {
  const response = await login(email, password);
  assert.equal(response.status, 200, response.body?.message);
  assert.ok(response.body?.token, 'El login no devolvió un token');
});

Then('la cuenta {string} no puede iniciar sesión con {string}', async function (email, password) {
  const response = await login(email, password);
  assert.equal(response.status, 400);
  assert.equal(response.body?.token, undefined);
});
