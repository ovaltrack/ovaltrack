import { Given, When, Then } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import { getOvalTrackAdminToken } from '../../support/auth_helper.js';
import { makeHttpRequest } from '../../support/httpRequest.js';

// El "Entonces el sistema responde con {int} y {string}" está definido en support/common_steps.js

const ADMIN_API = 'api/admin/ovaltrack';

// <==================== Helpers ====================>

const getList = async (path, token) => {
  const response = await makeHttpRequest('GET', `${ADMIN_API}/${path}`, null, token);
  assert.equal(response.status, 200, `No se pudo consultar ${path}`);
  return response.body;
};

// Busca la cuenta entre las pendientes y las ya revisadas del panel
const findAccount = async (email, token) => {
  const registrations = [...await getList('users/pending', token), ...await getList('users', token)];
  const registration = registrations.find((r) => r.user.email === email);
  assert.ok(registration, `No se encontró la cuenta ${email} en el panel`);
  return registration.user;
};

// <==================== Contexto ====================>

Given('que el administrador de OvalTrack ha iniciado sesión', async function () {
  this.token = await getOvalTrackAdminToken();
  assert.ok(this.token, 'Fallo de inicio de sesión del administrador de OvalTrack');
});

// Registra la solicitud de alta; si el email ya tiene cuenta, la solicitud se envió en un escenario anterior
const requestClubRegistration = async (nombreClub, ciudad, email) => {
  const response = await makeHttpRequest('POST', 'api/auth/register-club', {
    admin: {
      email,
      password: 'PassSegura123!',
      firstName: 'Admin',
      lastName: nombreClub,
      birthDate: '1985-01-01',
      role: 'ADMIN_CLUB',
    },
    club: { name: nombreClub, city: ciudad, contactEmail: email, contactPhone: '+542804000000' },
    termsAccepted: true,
  });
  const alreadyRegistered = response.status === 409 && response.body?.message === 'El email ya fue registrado con una cuenta';
  assert.ok(response.status === 201 || alreadyRegistered, `No se pudo registrar el club ${nombreClub}: ${response.body?.message}`);
};

Given('que el club {string} de la ciudad {string} solicitó su alta con el administrador {string}', async function (nombreClub, ciudad, email) {
  await requestClubRegistration(nombreClub, ciudad, email);
});

Given('que la cuenta {string} del club {string} de la ciudad {string} fue aprobada', async function (email, nombreClub, ciudad) {
  await requestClubRegistration(nombreClub, ciudad, email);
  const pending = (await getList('users/pending', this.token)).find((r) => r.user.email === email);
  if (!pending) return;
  const response = await makeHttpRequest('POST', `${ADMIN_API}/users/${pending.user.id}/approve`, null, this.token);
  assert.equal(response.status, 200, `No se pudo aprobar la cuenta ${email}: ${response.body?.message}`);
});

// <==================== Rechazos ====================>

When('rechaza la solicitud de la cuenta {string}', async function (email) {
  const user = await findAccount(email, this.token);
  this.response = await makeHttpRequest('POST', `${ADMIN_API}/users/${user.id}/reject`, null, this.token);
});

When('rechaza la solicitud del club {string}', async function (nombreClub) {
  const club = (await getList('clubs/pending', this.token)).find((c) => c.name === nombreClub);
  assert.ok(club, `El club ${nombreClub} no tiene una solicitud pendiente`);
  this.response = await makeHttpRequest('POST', `${ADMIN_API}/clubs/${club.id}/reject`, null, this.token);
});

When('rechaza la cuenta inexistente con ID {string}', async function (userId) {
  this.response = await makeHttpRequest('POST', `${ADMIN_API}/users/${userId}/reject`, null, this.token);
});

When('rechaza el club inexistente con ID {string}', async function (clubId) {
  this.response = await makeHttpRequest('POST', `${ADMIN_API}/clubs/${clubId}/reject`, null, this.token);
});

Then('la cuenta {string} ya no figura entre las solicitudes pendientes', async function (email) {
  const pending = await getList('users/pending', this.token);
  assert.ok(!pending.some((r) => r.user.email === email), `La cuenta ${email} sigue pendiente`);
});

Then('el club {string} figura entre los clubes rechazados', async function (nombreClub) {
  const rejected = await getList('clubs?status=REJECTED', this.token);
  assert.ok(rejected.some((c) => c.name === nombreClub), `El club ${nombreClub} no figura como rechazado`);
});

// <==================== Activación y desactivación ====================>

When('activa la cuenta {string}', async function (email) {
  const user = await findAccount(email, this.token);
  this.response = await makeHttpRequest('POST', `${ADMIN_API}/${user.id}/activate`, null, this.token);
});

When('desactiva la cuenta {string}', async function (email) {
  const user = await findAccount(email, this.token);
  this.response = await makeHttpRequest('DELETE', `${ADMIN_API}/${user.id}/deactivate`, null, this.token);
});

Then('la cuenta {string} figura entre las cuentas revisadas como {string}', async function (email, estado) {
  const active = estado === 'activa';
  const accounts = await getList(`users?active=${active}`, this.token);
  assert.ok(accounts.some((r) => r.user.email === email), `La cuenta ${email} no figura como ${estado}`);
});
