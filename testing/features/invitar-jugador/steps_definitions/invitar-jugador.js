import { Given, When, Then } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { createSentInvitationForPerson, seedClubPlayer } from "../../support/db_helper.js";
import { makeHttpRequest } from "../../support/httpRequest.js";

// Pasos reutilizados:
//  - "Dado que el administrador del club ..." y "Entonces el sistema responde con ..." (support/common_steps.js)
//  - "Dado que el coach ..." (division-jugador/step_definitions/creacion_jugadores.js)
//  - "Dado que el jugador con email ... ha iniciado sesión" y "Dado un usuario sin sesión ..." (user/step_definitions)

const ADMIN = "admin_puerto@test.com";
const INVITATION_API = "api/invitation";
const EXPIRED_HOURS = -1;

const fullName = (firstName, lastName) => `${firstName} ${lastName}`;

async function seed(world, firstName, lastName, options) {
  world.seeded ??= {};
  world.seeded[fullName(firstName, lastName)] = await seedClubPlayer({ adminEmail: ADMIN, firstName, lastName, ...options });
}

function seededId(world, firstName, lastName) {
  const id = world.seeded?.[fullName(firstName, lastName)];
  assert.ok(id, `El jugador ${fullName(firstName, lastName)} no se creó en los antecedentes`);
  return id;
}

const findRow = (rows, name) => rows.find((row) => fullName(row.firstName, row.lastName) === name);

// <==================== Jugadores sembrados ====================>

Given("el jugador {string} {string} con correo {string} en la division {string}", async function (firstName, lastName, contactEmail, divisionName) {
  await seed(this, firstName, lastName, { contactEmail, divisionName });
});

Given("el jugador {string} {string} con correo {string} y cuenta en la division {string}", async function (firstName, lastName, contactEmail, divisionName) {
  await seed(this, firstName, lastName, { contactEmail, divisionName, withAccount: true });
});

Given("el jugador {string} {string} sin correo en la division {string}", async function (firstName, lastName, divisionName) {
  await seed(this, firstName, lastName, { divisionName });
});

Given("{string} {string} tiene una invitación vigente", async function (firstName, lastName) {
  await createSentInvitationForPerson(seededId(this, firstName, lastName));
});

Given("{string} {string} tiene una invitación vencida", async function (firstName, lastName) {
  await createSentInvitationForPerson(seededId(this, firstName, lastName), { expiresInHours: EXPIRED_HOURS });
});

// <==================== Consultas ====================>

When("consulta los jugadores para invitar", async function () {
  this.response = await makeHttpRequest("GET", `${INVITATION_API}/players`, null, this.token);
});

When("consulta el listado general de invitaciones", async function () {
  this.response = await makeHttpRequest("GET", INVITATION_API, null, this.token);
});

Then("los jugadores figuran con estos estados:", function (table) {
  for (const { jugador, estado, division } of table.hashes()) {
    const row = findRow(this.response.body, jugador);
    assert.ok(row, `${jugador} no figura en la lista`);
    assert.equal(row.status, estado, `Estado de ${jugador}`);
    assert.deepEqual(row.divisions.map((d) => d.name), [division], `Divisiones de ${jugador}`);
  }
});

Then("{string} {string} figura con la fecha de envío y el vencimiento de su invitación", function (firstName, lastName) {
  const row = findRow(this.response.body, fullName(firstName, lastName));
  assert.ok(row?.invitedAt, "Falta la fecha de envío");
  assert.ok(new Date(row.invitationExpiresAt) > new Date(row.invitedAt), "El vencimiento debe ser posterior al envío");
});

Then("la lista incluye a {string}", function (name) {
  assert.ok(findRow(this.response.body, name), `${name} debería figurar en la lista`);
});

Then("la lista no incluye a {string}", function (name) {
  assert.equal(findRow(this.response.body, name), undefined, `${name} no debería figurar en la lista`);
});

Then("el sistema no responde 200", function () {
  assert.notEqual(this.response.status, 200);
});

// <==================== Invitar ====================>

When("invita a {string} {string}", async function (firstName, lastName) {
  const personId = seededId(this, firstName, lastName);
  this.response = await makeHttpRequest("POST", INVITATION_API, { personId }, this.token);
});

When("invita a la persona con ID {string}", async function (personId) {
  this.response = await makeHttpRequest("POST", INVITATION_API, { personId }, this.token);
});

When("invita sin indicar el jugador", async function () {
  this.response = await makeHttpRequest("POST", INVITATION_API, {}, this.token);
});
