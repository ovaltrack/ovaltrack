import { Given, When, Then } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import { getUserToken } from '../../support/auth_helper.js';
import { getPostMatchEvents } from '../../support/event_helper.js';
import { makeHttpRequest } from '../../support/httpRequest.js';
import { findDivisionId, requestMatchCreation } from '../../support/match_helper.js';
import { MISSING_UUID } from '../../support/ids.js';
import { createZone, deleteZone, listZones, updateZone } from '../../support/zone_helper.js';

// Pasos reutilizados:
//  - "Dado que el coach ... ha iniciado sesión" (division-jugador/step_definitions/creacion_jugadores.js)
//  - "Dado que el jugador ... ha iniciado sesión" (user/step_definitions/baja_usuario_steps.js)
//  - "Y que existe un partido finalizado ..." y "el entrenador consulta la línea de eventos ..." (linea_eventos_steps.js)
//  - "el entrenador agrega post-partido el evento ..." (alta_post_partido_steps.js)
//  - "Entonces el sistema responde con código {int}" / "rechaza la solicitud con código {int}" (support/common_steps.js)

// <==================== Helpers ====================>

const VALID_ZONE = { row: 2, col: 3, period: 1, startMinute: 10, endMinute: 25 };

const findEventAt = async (matchId, tipoEvento, minuto, periodo, token) => {
  const events = await getPostMatchEvents(matchId, token);
  const event = events.find((e) => e.eventTypeName === tipoEvento && e.period === periodo && e.matchTime === minuto * 60);
  assert.ok(event, `No se encontró el evento "${tipoEvento}" del minuto ${minuto} en el periodo ${periodo}`);
  return event;
};

const loginOtherClubAdmin = async (email, contraseña) => {
  const token = await getUserToken(email, contraseña);
  assert.ok(token, `Fallo de inicio de sesión para ${email}`);
  return token;
};

// <==================== Contexto ====================>

Given('que existe un partido no iniciado para la división {string} contra {string}', async function (divisionNombre, rival) {
  const divisionId = await findDivisionId(divisionNombre, this.token);
  const response = await requestMatchCreation('2026-12-01T15:30:00', divisionId, rival, this.token);
  assert.equal(response.status, 200, `No se pudo crear el partido contra ${rival}: ${response.body?.message}`);
  this.currentMatch = response.body;
});

Given('que el partido tiene asignada la zona fila {int} columna {int} en el periodo {int} entre el minuto {int} y el minuto {int}', async function (row, col, period, startMinute, endMinute) {
  const response = await createZone(this.currentMatch.id, { row, col, period, startMinute, endMinute }, this.token);
  assert.equal(response.status, 201, `No se pudo preparar la zona inicial: ${response.body?.message}`);
  this.lastZone = response.body;
});

// <==================== Acciones ====================>

When('el entrenador asigna la zona fila {int} columna {int} al periodo {int} entre el minuto {int} y el minuto {int}', async function (row, col, period, startMinute, endMinute) {
  this.response = await createZone(this.currentMatch.id, { row, col, period, startMinute, endMinute }, this.token);
});

When('el entrenador modifica la zona asignada a fila {int} columna {int} entre el minuto {int} y el minuto {int}', async function (row, col, startMinute, endMinute) {
  const zone = { row, col, period: this.lastZone.period, startMinute, endMinute };
  this.response = await updateZone(this.currentMatch.id, this.lastZone.id, zone, this.token);
});

When('el entrenador elimina la zona asignada', async function () {
  this.response = await deleteZone(this.currentMatch.id, this.lastZone.id, this.token);
});

When('el entrenador elimina el último evento agregado', async function () {
  const response = await makeHttpRequest('DELETE', `event/${this.createdEventId}`, null, this.token);
  assert.equal(response.status, 200, `No se pudo eliminar el evento: ${response.body?.message}`);
});

When('el entrenador consulta las zonas del partido', async function () {
  this.response = await listZones(this.currentMatch.id, this.token);
});

// <==================== Errores: datos inválidos, inexistentes o sin permisos ====================>

When('el entrenador intenta asignar una zona sin indicar la fila', async function () {
  this.response = await createZone(this.currentMatch.id, { ...VALID_ZONE, row: null }, this.token);
});

When('el entrenador intenta asignar una zona a un partido inexistente', async function () {
  this.response = await createZone(MISSING_UUID, VALID_ZONE, this.token);
});

When('el entrenador intenta modificar una zona inexistente', async function () {
  this.response = await updateZone(this.currentMatch.id, MISSING_UUID, VALID_ZONE, this.token);
});

When('el entrenador intenta eliminar una zona inexistente', async function () {
  this.response = await deleteZone(this.currentMatch.id, MISSING_UUID, this.token);
});

When('alguien sin autenticar intenta asignar una zona al partido', async function () {
  this.response = await createZone(this.currentMatch.id, VALID_ZONE, null);
});

When('el administrador del club con email {string} y contraseña {string} intenta asignar una zona a ese partido', async function (email, contraseña) {
  this.response = await createZone(this.currentMatch.id, VALID_ZONE, await loginOtherClubAdmin(email, contraseña));
});

When('el administrador del club con email {string} y contraseña {string} intenta consultar las zonas de ese partido', async function (email, contraseña) {
  this.response = await listZones(this.currentMatch.id, await loginOtherClubAdmin(email, contraseña));
});

// <==================== Verificaciones ====================>

Then('la zona asignada se devuelve con fila {int}, columna {int}, periodo {int}, desde el minuto {int} hasta el minuto {int}', function (row, col, period, startMinute, endMinute) {
  const zone = this.response.body;
  assert.ok(zone?.id, 'La respuesta no contiene la zona creada');
  assert.deepEqual(
    { row: zone.row, col: zone.col, period: zone.period, startMinute: zone.startMinute, endMinute: zone.endMinute },
    { row, col, period, startMinute, endMinute },
  );
});

Then('el evento {string} del minuto {int} del periodo {int} pertenece a la zona fila {int} columna {int}', async function (tipoEvento, minuto, periodo, row, col) {
  const event = await findEventAt(this.currentMatch.id, tipoEvento, minuto, periodo, this.token);
  assert.ok(event.zone, `El evento debería tener zona fila ${row} columna ${col} pero no tiene zona`);
  assert.deepEqual({ row: event.zone.row, col: event.zone.col }, { row, col });
});

Then('el evento {string} del minuto {int} del periodo {int} queda sin zona', async function (tipoEvento, minuto, periodo) {
  const event = await findEventAt(this.currentMatch.id, tipoEvento, minuto, periodo, this.token);
  assert.equal(event.zone ?? null, null, `El evento debería quedar sin zona pero tiene ${JSON.stringify(event.zone)}`);
});

Then('la consulta devuelve {int} asignación/asignaciones de zona', function (cantidad) {
  assert.ok(Array.isArray(this.response.body?.assignments), 'La respuesta debe incluir la lista "assignments"');
  assert.equal(this.response.body.assignments.length, cantidad);
});

Then('la consulta devuelve la asignación fila {int} columna {int} del periodo {int} entre el minuto {int} y el minuto {int}', function (row, col, period, startMinute, endMinute) {
  const assignments = this.response.body?.assignments;
  assert.ok(Array.isArray(assignments), 'La respuesta debe incluir la lista "assignments"');
  const found = assignments.some((a) => a.row === row && a.col === col && a.period === period && a.startMinute === startMinute && a.endMinute === endMinute);
  assert.ok(found, `No hay una asignación fila ${row} columna ${col} del periodo ${period} entre ${startMinute} y ${endMinute}: ${JSON.stringify(assignments)}`);
});

Then('el resumen indica {int} evento/eventos en la fila {int} columna {int}', function (cantidad, row, col) {
  const cells = this.response.body?.summary?.cells;
  assert.ok(Array.isArray(cells), 'La respuesta debe incluir "summary.cells"');
  const actual = cells.find((c) => c.row === row && c.col === col)?.eventCount ?? 0;
  assert.equal(actual, cantidad, `Se esperaban ${cantidad} eventos en fila ${row} columna ${col} y hay ${actual}`);
});

Then('el resumen indica {int} evento/eventos sin zona', function (cantidad) {
  assert.equal(this.response.body?.summary?.unzonedEventCount, cantidad);
});
