import { Given, When, Then } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import { makeHttpRequest } from '../../support/httpRequest.js';

// "que el administrador de OvalTrack ha iniciado sesión" y "el club {string} figura entre los
// clubes rechazados" están en rechazo_activacion.js; "el sistema responde con ..." en common_steps.js

const ADMIN_API = 'api/admin/ovaltrack';
const PASSWORD = 'PassSegura123!';

// <==================== Helpers ====================>

const getList = async (path, token) => {
  const response = await makeHttpRequest('GET', `${ADMIN_API}/${path}`, null, token);
  assert.equal(response.status, 200, `No se pudo consultar ${path}`);
  return response.body;
};

const findClub = async (nombreClub, token) => {
  const clubs = [...await getList('clubs/pending', token), ...await getList('clubs', token)];
  const club = clubs.find((c) => c.name === nombreClub);
  assert.ok(club, `No se encontró el club ${nombreClub} en el panel`);
  return club;
};

const findAccount = async (email, token) => {
  const registrations = [...await getList('users/pending', token), ...await getList('users', token)];
  const registration = registrations.find((r) => r.user.email === email);
  assert.ok(registration, `No se encontró la cuenta ${email} en el panel`);
  return registration.user;
};

const expectOk = (response, accion) => {
  assert.equal(response.status, 200, `No se pudo ${accion}: ${response.body?.message}`);
};

const login = (email) => makeHttpRequest('POST', 'api/auth/login', { email, password: PASSWORD });

// <==================== Contexto ====================>

// Deja el club ACTIVE con su administrador activo, sin importar lo que hizo un escenario anterior
Given('que el club {string} de la ciudad {string} está activo con el administrador {string}', async function (nombreClub, ciudad, email) {
  const registration = await makeHttpRequest('POST', 'api/auth/register-club', {
    admin: { email, password: PASSWORD, firstName: 'Admin', lastName: nombreClub, birthDate: '1985-01-01', role: 'ADMIN_CLUB' },
    club: { name: nombreClub, city: ciudad, contactEmail: email, contactPhone: '+542804000000' },
  });
  const alreadyRegistered = registration.status === 409 && registration.body?.message === 'El email ya fue registrado con una cuenta';
  assert.ok(registration.status === 201 || alreadyRegistered, `No se pudo registrar el club ${nombreClub}: ${registration.body?.message}`);

  const pending = (await getList('users/pending', this.token)).find((r) => r.user.email === email);
  const user = pending ? pending.user : await findAccount(email, this.token);
  if (pending) {
    expectOk(await makeHttpRequest('POST', `${ADMIN_API}/users/${user.id}/approve`, null, this.token), `aprobar la cuenta ${email}`);
  } else if (user.active === false) {
    expectOk(await makeHttpRequest('POST', `${ADMIN_API}/${user.id}/activate`, null, this.token), `activar la cuenta ${email}`);
  }

  const club = await findClub(nombreClub, this.token);
  if (club.status === 'PENDING') {
    expectOk(await makeHttpRequest('POST', `${ADMIN_API}/clubs/${club.id}/approve?adminUserId=${user.id}`, null, this.token), `aprobar el club ${nombreClub}`);
  } else if (club.status === 'REJECTED') {
    expectOk(await makeHttpRequest('POST', `${ADMIN_API}/clubs/${club.id}/reactivate`, null, this.token), `reactivar el club ${nombreClub}`);
  }
});

Given('que el club {string} fue desactivado', async function (nombreClub) {
  const club = await findClub(nombreClub, this.token);
  expectOk(await makeHttpRequest('POST', `${ADMIN_API}/clubs/${club.id}/reject`, null, this.token), `desactivar el club ${nombreClub}`);
});

Given('que la cuenta {string} fue desactivada', async function (email) {
  const user = await findAccount(email, this.token);
  expectOk(await makeHttpRequest('DELETE', `${ADMIN_API}/${user.id}/deactivate`, null, this.token), `desactivar la cuenta ${email}`);
});

Given('que {string} tiene la sesión abierta', async function (email) {
  const response = await login(email);
  expectOk(response, `iniciar sesión con ${email}`);
  this.memberToken = response.body.token;
  expectOk(await makeHttpRequest('GET', 'api/me', null, this.memberToken), `consultar el contexto de ${email}`);
});

// <==================== Acciones ====================>

When('desactiva el club {string}', async function (nombreClub) {
  const club = await findClub(nombreClub, this.token);
  this.response = await makeHttpRequest('POST', `${ADMIN_API}/clubs/${club.id}/reject`, null, this.token);
});

When('reactiva el club {string}', async function (nombreClub) {
  const club = await findClub(nombreClub, this.token);
  this.response = await makeHttpRequest('POST', `${ADMIN_API}/clubs/${club.id}/reactivate`, null, this.token);
});

When('reactiva el club inexistente con ID {string}', async function (clubId) {
  this.response = await makeHttpRequest('POST', `${ADMIN_API}/clubs/${clubId}/reactivate`, null, this.token);
});

When('{string} intenta iniciar sesión', async function (email) {
  this.response = await login(email);
});

When('consulta su contexto con la sesión abierta', async function () {
  this.response = await makeHttpRequest('GET', 'api/me', null, this.memberToken);
});

When('consulta los clubes revisados del panel', async function () {
  this.response = await makeHttpRequest('GET', `${ADMIN_API}/clubs`, null, this.token);
});

Then('{string} puede iniciar sesión', async function (email) {
  const response = await login(email);
  assert.equal(response.status, 200, `${email} no pudo iniciar sesión: ${response.body?.message}`);
  assert.ok(response.body?.token, 'El login no devolvió token');
});
