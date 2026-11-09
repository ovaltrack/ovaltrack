import { Given, When, Then } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import { getOvalTrackAdminToken, getUserToken } from '../../support/auth_helper.js';
import { makeHttpRequest } from '../../support/httpRequest.js';

// Pasos reutilizados:
//  - "Entonces el sistema responde con ..." (support/common_steps.js)
//  - "que el jugador con email ... recibió una invitación ..." y "valida el token de invitación ..." (invitar-jugador)

const PROFILE = 'api/me/profile';

// <==================== Sesión ====================>

Given('que el usuario {string} con contraseña {string} inició sesión', async function (email, password) {
  this.token = await getUserToken(email, password);
  assert.ok(this.token, `No se pudo iniciar sesión con ${email}`);
});

Given('que el administrador de OvalTrack inició sesión', async function () {
  this.token = await getOvalTrackAdminToken();
  assert.ok(this.token, 'Fallo de inicio de sesión del administrador de OvalTrack');
});

// <==================== Acciones ====================>

When('consulta su perfil', async function () {
  this.response = await makeHttpRequest('GET', PROFILE, null, this.token);
});

When('un visitante sin sesión consulta el perfil', async function () {
  this.response = await makeHttpRequest('GET', PROFILE);
});

When('actualiza su contacto con el correo {string} y el teléfono {string}', async function (contactEmail, contactPhone) {
  this.response = await makeHttpRequest('PATCH', `${PROFILE}/contact`, { contactEmail, contactPhone }, this.token);
});

When('invita a la persona {string} a crear su cuenta', async function (email) {
  const persons = await makeHttpRequest('GET', 'person', null, this.token);
  const person = persons.body.find((p) => p.contactEmail === email);
  assert.ok(person, `No existe la persona ${email}`);
  this.response = await makeHttpRequest('POST', 'api/invitation', { personId: person.id }, this.token);
});

// <==================== Verificaciones ====================>

Then('el perfil muestra la cuenta {string} con el rol {string} y estado {string}', function (email, rol, estado) {
  const { account } = this.response.body;
  assert.equal(account.loginEmail, email);
  assert.equal(account.role, rol);
  assert.equal(account.status, estado);
  assert.ok(account.memberSince, 'Falta la fecha de alta');
});

Then('el perfil muestra a la persona {string} {string}', function (nombre, apellido) {
  const { person } = this.response.body;
  assert.equal(person.firstName, nombre);
  assert.equal(person.lastName, apellido);
});

Then('el perfil muestra a la persona {string} {string} nacida el {string}', function (nombre, apellido, fecha) {
  const { person } = this.response.body;
  assert.equal(person.firstName, nombre);
  assert.equal(person.lastName, apellido);
  assert.equal(person.birthDate, fecha);
});

Then('el perfil muestra el club {string} de {string} administrado por {string}', function (nombre, ciudad, admin) {
  const { club } = this.response.body;
  assert.ok(club, 'El perfil no tiene club');
  assert.equal(club.name, nombre);
  assert.equal(club.city, ciudad);
  assert.equal(club.status, 'ACTIVE');
  assert.equal(club.adminName, admin);
});

Then('el perfil incluye la división {string}', function (nombreDivision) {
  const names = this.response.body.divisions.map((d) => d.name);
  assert.ok(names.includes(nombreDivision), `Divisiones del perfil: ${names.join(', ')}`);
});

Then('el perfil registra la aceptación de los términos', function () {
  const { account } = this.response.body;
  assert.ok(account.termsVersion, 'Falta la versión de los términos');
  assert.ok(account.termsAcceptedAt, 'Falta la fecha de aceptación');
});

Then('el perfil no muestra club', function () {
  assert.equal(this.response.body.club, null);
  assert.deepEqual(this.response.body.divisions, []);
});

Then('el perfil muestra el contacto {string} y {string}', function (contactEmail, contactPhone) {
  const { person } = this.response.body;
  assert.equal(person.contactEmail, contactEmail);
  assert.equal(person.contactPhone, contactPhone);
});

Then('el usuario {string} con contraseña {string} sigue pudiendo iniciar sesión', async function (email, password) {
  assert.ok(await getUserToken(email, password), `${email} ya no puede iniciar sesión`);
});

// <==================== Correo de acceso ====================>

When('cambia su correo de acceso a {string} con la contraseña {string}', async function (newEmail, currentPassword) {
  this.previousToken = this.token;
  this.response = await makeHttpRequest('PATCH', `${PROFILE}/login-email`, { newEmail, currentPassword }, this.token);
});

Then('con la sesión anterior el perfil responde {int} con {string}', async function (status, message) {
  const response = await makeHttpRequest('GET', PROFILE, null, this.previousToken);
  assert.equal(response.status, status);
  assert.equal(response.body?.message, message);
});

Then('no puede iniciar sesión con {string} y contraseña {string}', async function (email, password) {
  assert.equal(await getUserToken(email, password), null, `${email} todavía puede iniciar sesión`);
});

Then('su perfil muestra el correo de acceso {string} y el contacto {string}', async function (loginEmail, contactEmail) {
  const token = await getUserToken(loginEmail);
  const { body } = await makeHttpRequest('GET', PROFILE, null, token);
  assert.equal(body.account.loginEmail, loginEmail);
  assert.equal(body.person.contactEmail, contactEmail);
});
