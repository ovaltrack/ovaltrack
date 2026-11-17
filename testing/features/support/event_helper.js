import assert from 'node:assert/strict';
import { makeHttpRequest } from './httpRequest.js';

const eventTypeCache = new Map();

export async function findEventType(tipoEvento, token) {
  if (!eventTypeCache.has(tipoEvento)) {
    const response = await makeHttpRequest('GET', 'eventType', null, token);
    assert.equal(response.status, 200, 'No se pudo consultar el catálogo de tipos de evento');
    response.body.forEach((type) => eventTypeCache.set(type.name, type.id));
  }
  const eventTypeId = eventTypeCache.get(tipoEvento);
  assert.ok(eventTypeId, `No se encontró el tipo de evento "${tipoEvento}"`);
  return eventTypeId;
}

// "zone=center;wasSuccessful=true" -> { zone: 'center', wasSuccessful: true }; vacío -> sin atributos
export function parseAttributes(text) {
  if (!text) return undefined;
  return Object.fromEntries(
    text.split(';').map((pair) => {
      const [key, value] = pair.split('=').map((part) => part.trim());
      if (value === 'true' || value === 'false') return [key, value === 'true'];
      return [key, Number.isNaN(Number(value)) ? value : Number(value)];
    }),
  );
}

export function registerEvent(token, event) {
  return makeHttpRequest('POST', 'event', { origin: 'live-capture', ...event }, token);
}

export function getPostMatchTimeline(matchId, token) {
  return makeHttpRequest('GET', `event/match/post-match?matchId=${matchId}`, null, token);
}

/** Línea de eventos post-partido, fallando si la consulta no devuelve 200. */
export async function getPostMatchEvents(matchId, token) {
  const response = await getPostMatchTimeline(matchId, token);
  assert.equal(response.status, 200, `No se pudo consultar la línea de eventos: ${response.body?.message}`);
  return response.body;
}
