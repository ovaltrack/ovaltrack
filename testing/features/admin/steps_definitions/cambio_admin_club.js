import { Given, When, Then } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import { makeHttpRequest } from '../../support/httpRequest.js';

// Reusa "que el club {string} de la ciudad {string} está activo con el administrador {string}"
// (desactivacion_clubes.js), "que el club ... solicitó su alta ..." (rechazo_activacion.js)
// y "el sistema responde con ..." (common_steps.js)

const ADMIN_API = 'api/admin/ovaltrack';
const PASSWORD = 'PassSegura123!';

// <==================== Helpers ====================>

const findClub = async (nombreClub, token) => {
  const pending = await makeHttpRequest('GET', `${ADMIN_API}/clubs/pending`, null, token);
  const reviewed = await makeHttpRequest('GET', `${ADMIN_API}/clubs`, null, token);
  const club = [...pending.body, ...reviewed.body].find((c) => c.name === nombreClub);
  assert.ok(club, `No se encontró el club ${nombreClub} en el panel`);
  return club;
};

// GET /user lista todas las cuentas (salvo ADMIN_OVALTRACK), de cualquier rol
const findUser = async (email, token) => {
  const response = await makeHttpRequest('GET', 'user', null, token);
  assert.equal(response.status, 200, 'No se pudo consultar las cuentas');
  const user = response.body.find((u) => u.email === email);
  assert.ok(user, `No se encontró la cuenta ${email}`);
  return user;
};

const login = async (email) => {
  const response = await makeHttpRequest('POST', 'api/auth/login', { email, password: PASSWORD });
  assert.equal(response.status, 200, `No se pudo iniciar sesión con ${email}: ${response.body?.message}`);
  return response.body.token;
};

const createRival = (token, nombre) => makeHttpRequest('POST', 'opponents', { name: nombre, alias: 'RLV', city: 'Rawson' }, token);

// <==================== Contexto ====================>

const ensureClubAccount = async function (nombreClub, email, role, active) {
  const club = await findClub(nombreClub, this.token);
  const response = await makeHttpRequest('POST', 'user', {
    email,
    password: PASSWORD,
    role,
    active,
    firstName: role === 'PLAYER' ? 'Jugador' : 'Coach',
    lastName: nombreClub,
    birthDate: '1990-01-01',
    clubId: club.id,
  }, this.token);
  const exists = response.status === 409 && response.body?.message === 'El email ya se encuentra registrado';
  assert.ok(response.status === 200 || exists, `No se pudo crear la cuenta ${email}: ${response.body?.message}`);
};

Given('que el club {string} tiene la cuenta activa {string} con rol {string}', async function (nombreClub, email, role) {
  await ensureClubAccount.call(this, nombreClub, email, role, true);
});

Given('que el club {string} tiene la cuenta inactiva {string} con rol {string}', async function (nombreClub, email, role) {
  await ensureClubAccount.call(this, nombreClub, email, role, false);
});

Given('que {string} y {string} tienen la sesión abierta', async function (emailA, emailB) {
  this.sessions = { [emailA]: await login(emailA), [emailB]: await login(emailB) };
});

// <==================== Acciones ====================>

When('consulta los candidatos a administrador del club {string}', async function (nombreClub) {
  const club = await findClub(nombreClub, this.token);
  this.response = await makeHttpRequest('GET', `${ADMIN_API}/clubs/${club.id}/admin-candidates`, null, this.token);
});

When('designa a {string} como administrador del club {string}', async function (email, nombreClub) {
  const club = await findClub(nombreClub, this.token);
  const user = await findUser(email, this.token);
  this.response = await makeHttpRequest('PUT', `${ADMIN_API}/clubs/${club.id}/admin?adminUserId=${user.id}`, null, this.token);
});

When('designa un administrador al club inexistente con ID {string}', async function (clubId) {
  this.response = await makeHttpRequest(
    'PUT',
    `${ADMIN_API}/clubs/${clubId}/admin?adminUserId=00000000-0000-0000-0000-000000000000`,
    null,
    this.token,
  );
});

// <==================== Verificaciones ====================>

Then('los candidatos son solo {string}', function (email) {
  assert.equal(this.response.status, 200, `No se pudo consultar los candidatos: ${this.response.body?.message}`);
  assert.deepEqual(this.response.body.map((u) => u.email), [email]);
});

Then('el administrador del club {string} es {string}', async function (nombreClub, email) {
  const club = await findClub(nombreClub, this.token);
  const user = await findUser(email, this.token);
  assert.equal(club.adminUserId, user.id, `El administrador de ${nombreClub} no es ${email}`);
});

Then('la cuenta {string} tiene el rol {string}', async function (email, role) {
  const user = await findUser(email, this.token);
  assert.equal(user.role, role);
});

Then('con su sesión anterior {string} ya no puede crear rivales', async function (email) {
  const response = await createRival(this.sessions[email], 'Rival Sin Permiso');
  assert.equal(response.status, 403, `Se esperaba 403 y respondió ${response.status}`);
});

Then('con su sesión anterior {string} puede crear rivales', async function (email) {
  const response = await createRival(this.sessions[email], `Rival Relevo ${Date.now()}`);
  assert.equal(response.status, 201, `No pudo crear el rival: ${response.body?.message}`);
});

Then('la cuenta {string} no figura entre las solicitudes de registro', async function (email) {
  const response = await makeHttpRequest('GET', `${ADMIN_API}/users/pending`, null, this.token);
  assert.equal(response.status, 200, 'No se pudo consultar las solicitudes');
  assert.ok(!response.body.some((r) => r.user.email === email), `${email} figura entre las solicitudes de registro`);
});

Then('la cuenta {string} figura entre las solicitudes de registro', async function (email) {
  const response = await makeHttpRequest('GET', `${ADMIN_API}/users/pending`, null, this.token);
  assert.equal(response.status, 200, 'No se pudo consultar las solicitudes');
  assert.ok(response.body.some((r) => r.user.email === email), `${email} no figura entre las solicitudes de registro`);
});
