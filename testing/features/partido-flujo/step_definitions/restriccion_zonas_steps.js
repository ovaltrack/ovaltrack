import { When, Then } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import { findEventType, getPostMatchEvents, parseAttributes, registerEvent } from '../../support/event_helper.js';
import { makeHttpRequest } from '../../support/httpRequest.js';
import { LIVE_CAPTURE, POST_CAPTURE, findTimelineEvent, patchEvent } from '../../support/post_match_helper.js';

// Pasos reutilizados:
//  - "Dado que el coach ... ha iniciado sesión" y "Y que existe un partido finalizado ..." (linea_eventos_steps.js)
//  - "Y que el partido tiene asignada la zona ..." y las verificaciones de zona y resumen (match_zones_steps.js)
//  - "el entrenador agrega post-partido el evento ... para el equipo propio ..." (alta_post_partido_steps.js)
//  - "el entrenador corrige el tiempo del evento ..." (edicion_eventos_steps.js)
//  - "Entonces el sistema responde con {int}" / "... con {int} y {string}" (support/common_steps.js)

// <==================== Helpers ====================>

const OPPONENT = 'OPPONENT';
const OWN = 'OWN';

const registerTimedEvent = (world, { tipoEvento, atributos, minuto, periodo, posesion, origin }) =>
  findEventType(tipoEvento, world.token).then((eventTypeId) =>
    registerEvent(world.token, {
      eventTypeId,
      matchId: world.currentMatch.id,
      teamPossession: posesion,
      matchTime: minuto * 60,
      period: periodo,
      origin,
      attributes: parseAttributes(atributos),
    }));

/** Regla de zona del catálogo en el mismo formato que las tablas del feature (listas separadas por coma). */
const describeRule = (rule) => ({
  columnas: (rule?.columns ?? []).join(','),
  filas: (rule?.rows ?? []).join(','),
  filaDesde: rule?.rowFrom ?? '',
});

const findCatalogType = (world, nombre) => {
  const type = world.response.body.find((t) => t.name === nombre);
  assert.ok(type, `El catálogo no contiene el tipo de evento "${nombre}"`);
  return type;
};

// <==================== Catálogo ====================>

When('el entrenador consulta el catálogo de tipos de evento', async function () {
  this.response = await makeHttpRequest('GET', 'eventType', null, this.token);
});

Then('el tipo de evento {string} declara la regla de zona:', function (nombre, dataTable) {
  const expected = { columnas: '', filas: '', filaDesde: '', ...dataTable.rowsHash() };
  assert.deepEqual(describeRule(findCatalogType(this, nombre).zoneRule), expected);
});

Then('el tipo de evento {string} no declara regla de zona', function (nombre) {
  assert.equal(findCatalogType(this, nombre).zoneRule ?? null, null);
});

Then('el tipo de evento {string} cierra el tramo', function (nombre) {
  assert.equal(findCatalogType(this, nombre).zoneRule?.closesTramo, true, `"${nombre}" debería cerrar el tramo`);
});

Then('el tipo de evento {string} no cierra el tramo', function (nombre) {
  assert.notEqual(findCatalogType(this, nombre).zoneRule?.closesTramo, true, `"${nombre}" no debería cerrar el tramo`);
});

// <==================== Alta y edición de eventos ====================>

When('el entrenador agrega post-partido el evento {string} con atributos {string} para el equipo rival en el minuto {int} del periodo {int}', async function (tipoEvento, atributos, minuto, periodo) {
  this.response = await registerTimedEvent(this, { tipoEvento, atributos, minuto, periodo, posesion: OPPONENT, origin: POST_CAPTURE });
});

When('el entrenador registra en vivo el evento {string} con atributos {string} para el equipo propio en el minuto {int} del periodo {int}', async function (tipoEvento, atributos, minuto, periodo) {
  this.response = await registerTimedEvent(this, { tipoEvento, atributos, minuto, periodo, posesion: OWN, origin: LIVE_CAPTURE });
});

When('el entrenador edita el evento {string} cambiándolo a {string} con atributos {string}', async function (tipoAnterior, tipoNuevo, atributos) {
  const event = await findTimelineEvent(this.currentMatch.id, tipoAnterior, this.token);
  this.editedEventId = event.id;
  this.response = await patchEvent(event.id, {
    eventTypeId: await findEventType(tipoNuevo, this.token),
    attributes: parseAttributes(atributos),
  }, this.token);
});

// <==================== Verificaciones ====================>

Then('la línea de eventos no contiene eventos {string}', async function (tipoEvento) {
  const events = await getPostMatchEvents(this.currentMatch.id, this.token);
  assert.equal(events.filter((e) => e.eventTypeName === tipoEvento).length, 0, `La línea no debería contener eventos "${tipoEvento}"`);
});
