import { When, Then } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import { getOvalTrackAdminToken } from '../../support/auth_helper.js';
import { findClubIdByName } from '../../support/club_helper.js';
import { makeHttpRequest } from '../../support/httpRequest.js';
import { findDivisionId } from '../../support/match_helper.js';

// El inicio de sesión y los "Entonces el sistema responde con ..." están definidos en support/common_steps.js

// <==================== Helpers ====================>

const findPersonByEmail = async (email, token) => {
  const response = await makeHttpRequest('GET', 'person', null, token);
  assert.equal(response.status, 200, 'No se pudo obtener el listado de personas');
  const person = response.body.find((p) => p.contactEmail === email);
  assert.ok(person, `No existe una persona con el email ${email}`);
  return person;
};

// Los listados paginados devuelven las personas en "content"
const listedEmails = (body) => (Array.isArray(body) ? body : body.content).map((p) => p.contactEmail);

const updatePerson = (person, changes, token) => {
  const { firstName, lastName, birthDate, contactEmail, contactPhone } = person;
  return makeHttpRequest('PUT', `person/${person.id}`, { firstName, lastName, birthDate, contactEmail, contactPhone, ...changes }, token);
};

// <==================== Permisos de edición ====================>

When('guarda sin cambios los datos de la persona con email {string}', async function (email) {
  const person = await findPersonByEmail(email, await getOvalTrackAdminToken());
  this.response = await updatePerson(person, {}, this.token);
});

// <==================== Alta y consulta ====================>

When('registra a la persona {string} {string} con email {string} y fecha de nacimiento {string}', async function (nombre, apellido, email, fechaNacimiento) {
  this.response = await makeHttpRequest('POST', 'person', {
    firstName: nombre,
    lastName: apellido,
    birthDate: fechaNacimiento,
    contactEmail: email,
  }, this.token);
});

Then('la persona con email {string} puede consultarse por su ID con nombre {string} {string}', async function (email, nombre, apellido) {
  const person = await findPersonByEmail(email, this.token);
  const response = await makeHttpRequest('GET', `person/${person.id}`, null, this.token);
  assert.equal(response.status, 200, response.body?.message);
  assert.equal(response.body.firstName, nombre);
  assert.equal(response.body.lastName, apellido);
});

When('consulta la persona inexistente con ID {string}', async function (personId) {
  this.response = await makeHttpRequest('GET', `person/${personId}`, null, this.token);
});

When('consulta el listado de personas', async function () {
  this.response = await makeHttpRequest('GET', 'person', null, this.token);
});

When('consulta las personas que juegan en la division {string}', async function (nombreDivision) {
  const divisionId = await findDivisionId(nombreDivision, this.token);
  this.response = await makeHttpRequest('GET', `person/division?divisionId=${divisionId}&size=50`, null, this.token);
});

When('consulta los jugadores del club {string} que no juegan en la division {string}', async function (nombreClub, nombreDivision) {
  const clubId = await findClubIdByName(nombreClub);
  const divisionId = await findDivisionId(nombreDivision, this.token);
  this.response = await makeHttpRequest('GET', `person/club?clubId=${clubId}&divisionId=${divisionId}&size=50`, null, this.token);
});

Then('el listado incluye a las personas con email {string} y {string}', function (email1, email2) {
  const emails = listedEmails(this.response.body);
  for (const email of [email1, email2]) {
    assert.ok(emails.includes(email), `El listado no incluye a ${email}`);
  }
});

// <==================== Edición ====================>

When('edita a la persona con email {string} con apellido {string} y teléfono {string}', async function (email, apellido, telefono) {
  const person = await findPersonByEmail(email, this.token);
  this.response = await updatePerson(person, { lastName: apellido, contactPhone: telefono }, this.token);
});

When('cambia el email de la persona {string} por {string}', async function (email, nuevoEmail) {
  const person = await findPersonByEmail(email, this.token);
  this.response = await updatePerson(person, { contactEmail: nuevoEmail }, this.token);
});

// <==================== Eliminación ====================>

When('elimina a la persona con email {string}', async function (email) {
  const person = await findPersonByEmail(email, this.token);
  this.deletedPersonId = person.id;
  this.response = await makeHttpRequest('DELETE', `person/${person.id}`, null, this.token);
});

When('elimina a la persona inexistente con ID {string}', async function (personId) {
  this.response = await makeHttpRequest('DELETE', `person/${personId}`, null, this.token);
});

Then('la persona eliminada ya no puede consultarse', async function () {
  const response = await makeHttpRequest('GET', `person/${this.deletedPersonId}`, null, this.token);
  assert.equal(response.status, 404);
});
