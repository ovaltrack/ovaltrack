import { Given, When, Then } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { createSentInvitation } from "../../support/db_helper.js";
import { makeHttpRequest } from "../../support/httpRequest.js";
import { MISSING_UUID } from "../../support/ids.js";
import { findDivisionId } from "../../support/match_helper.js";

// Pasos reutilizados:
//  - "Dado que el administrador del club ... ha iniciado sesión" y "Entonces el sistema responde con ..." (support/common_steps.js)
//  - "Dado un usuario sin sesión iniciada ..." (user/step_definitions/baja_usuario_steps.js)
//  - "Y el jugador inicia sesión ..." y "Y la cuenta tiene el rol ..." (cuenta-jugador/step_definitions/cuenta_jugador.js)

const EXPIRED_HOURS = -1;

// <==================== Invitaciones sembradas ====================>

Given('que el jugador con email {string} recibió una invitación a la division {string} con el token {string}', async function (email, nombreDivision, token) {
  await createSentInvitation(email, await findDivisionId(nombreDivision, this.token), { rawToken: token });
});

Given('que el jugador con email {string} recibió una invitación vencida a la division {string} con el token {string}', async function (email, nombreDivision, token) {
  await createSentInvitation(email, await findDivisionId(nombreDivision, this.token), { rawToken: token, expiresInHours: EXPIRED_HOURS });
});

// <==================== Validar y registrarse ====================>

const validateToken = (token) => makeHttpRequest("POST", "api/invitation/validate", { token });

When('valida el token de invitación {string}', async function (token) {
  this.response = await validateToken(token);
});

When('se registra con el token {string} y la contraseña {string}', async function (token, password) {
  this.response = await makeHttpRequest("POST", "api/auth/register/invitation", { token, password, termsAccepted: this.termsAccepted ?? true });
});

Then('la validación indica la acción {string} para la persona {string} en la division {string}', async function (accion, email, nombreDivision) {
  const persons = await makeHttpRequest("GET", "person", null, this.token);
  const person = persons.body.find((p) => p.contactEmail === email);
  assert.ok(person, `No existe la persona ${email}`);
  assert.equal(this.response.body.action, accion);
  assert.equal(this.response.body.personId, person.id);
  assert.equal(this.response.body.divisionId, await findDivisionId(nombreDivision, this.token));
});

Then('el enlace {string} ya no es válido', async function (token) {
  const response = await validateToken(token);
  assert.equal(response.status, 409);
  assert.equal(response.body?.message, "Este enlace ya fue utilizado.");
});

// <==================== Consulta de invitaciones ====================>

When('consulta una invitación con un ID cualquiera', async function () {
  this.response = await makeHttpRequest("GET", `api/invitation/id/${MISSING_UUID}`, null, this.token);
});
