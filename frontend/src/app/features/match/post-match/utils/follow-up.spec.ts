import { LiveCaptureEventType } from '../../types/event-type.types';
import { nextEvents } from './follow-up';

declare const describe: (description: string, specDefinitions: () => void) => void;
declare const it: (description: string, testFunction: () => void | Promise<void>) => void;
declare const expect: (actual: unknown) => {
  toBe(expected: unknown): void;
  toEqual(expected: unknown): void;
};

const type = (overrides: Partial<LiveCaptureEventType> = {}): LiveCaptureEventType => ({
  id: 'type', name: 'Evento', groupName: 'Ataque', category: 'ATTACK', isScoring: false, points: 0,
  requiresPlayer: true, isActive: true, code: 'EVENTO', showInPalette: true, followUpEventTypeId: null,
  actor: 'ATTACKING', possessionAfter: 'KEEP', followUpChoices: [], templateEventFields: [],
  createdAt: '2026-09-14T12:00:00Z', ...overrides,
});

const conversion = type({ id: 'conversion', code: 'CONVERSION', name: 'Conversión', possessionAfter: 'OTHER' });
const kick = type({ id: 'kick', code: 'PENALTY_KICK', name: 'Kick H', possessionAfter: 'OTHER' });
const touch = type({ id: 'touch', code: 'KICK_TO_TOUCH', name: 'Patada al touch' });
const lineout = type({ id: 'lineout', code: 'LINEOUT', name: 'Line-out', category: 'SET_PIECE', actor: 'ATTACKING' });
const penalty = type({
  id: 'penalty', code: 'PENALTY_CONCEDED', name: 'Penal / Infracción', actor: 'CHOOSE', possessionAfter: 'OTHER',
  followUpChoices: [{ code: 'PENALTY_KICK' }, { code: 'KICK_TO_TOUCH', label: 'Touch' }, { code: 'NO_EXISTE' }],
});
const catalog = [conversion, kick, touch, lineout, penalty];

const scrum = type({
  id: 'scrum', code: 'SCRUM', name: 'Scrum', category: 'SET_PIECE', actor: 'ATTACKING',
  templateEventFields: [{
    key: 'result', label: 'Resultado', type: 'select', phase: 'live', required: true,
    options: [
      { value: 'won_clean', label: 'Ganado' },
      { value: 'penalty_for', label: 'Penal a favor', followUps: [{ code: 'PENALTY_CONCEDED', team: 'OTHER', preset: { penaltyType: 'scrum_illegal' } }] },
      { value: 'penalty_against', label: 'Penal en contra', followUps: [{ code: 'PENALTY_CONCEDED', team: 'SAME' }] },
    ],
  }],
});
const kickInPlay = type({
  id: 'kick-in-play', code: 'KICK_IN_PLAY', name: 'Patada en juego', possessionAfter: 'KEEP',
  templateEventFields: [{
    key: 'result', label: 'Resultado', type: 'select', phase: 'live', required: true,
    options: [
      { value: 'retained', label: 'Recuperada', possession: 'KEEP' },
      { value: 'out_in_full', label: 'Directa afuera', possession: 'OTHER', followUps: [{ code: 'LINEOUT' }] },
    ],
  }],
});
const withTry = (tryType: LiveCaptureEventType) => [...catalog, tryType, scrum, kickInPlay];

describe('follow-up', () => {
  it('el seguimiento único del tipo (Try → Conversión) sale del catálogo, del mismo equipo', () => {
    const tryType = type({ id: 'try', code: 'TRY', name: 'Try', followUpEventTypeId: 'conversion' });

    expect(nextEvents(tryType, { zone: 'left' }, 'OWN', withTry(tryType))).toEqual([
      { type: conversion, label: 'Conversión', preset: {}, team: 'OWN' },
    ]);
    expect(nextEvents(tryType, null, 'OPPONENT', withTry(tryType))[0].team).toBe('OPPONENT');
  });

  it('un seguimiento que no está en el catálogo no ofrece nada', () => {
    const tryType = type({ id: 'try', followUpEventTypeId: 'borrado' });

    expect(nextEvents(tryType, null, 'OWN', catalog)).toEqual([]);
  });

  it('sin seguimiento ni botonera no ofrece nada', () => {
    expect(nextEvents(conversion, { wasSuccessful: true }, 'OWN', catalog)).toEqual([]);
  });

  it('la botonera del tipo descarta los códigos inexistentes y respeta la etiqueta', () => {
    const next = nextEvents(penalty, null, 'OWN', catalog);

    expect(next.map(event => event.label)).toEqual(['Kick H', 'Touch']);
  });

  it('el equipo de cada opción sale de la posesión que deja el origen y del actor del evento elegido', () => {
    // El equipo del penal es el que comete la infracción: pierde la pelota (OTHER) y el contrario ejecuta la jugada
    const next = nextEvents(penalty, null, 'OWN', catalog);

    expect(next.map(event => event.team)).toEqual(['OPPONENT', 'OPPONENT']);
  });

  it('SAME / OTHER fijan el equipo respecto del origen y el preset viaja con la opción', () => {
    const favor = nextEvents(scrum, { result: 'penalty_for' }, 'OWN', [...catalog, scrum]);
    const against = nextEvents(scrum, { result: 'penalty_against' }, 'OWN', [...catalog, scrum]);

    expect(favor).toEqual([{ type: penalty, label: 'Penal / Infracción', preset: { penaltyType: 'scrum_illegal' }, team: 'OPPONENT' }]);
    expect(against[0].team).toBe('OWN');
    expect(against[0].preset).toEqual({});
  });

  it('la botonera de una opción pisa a la del tipo y las demás opciones no ofrecen nada', () => {
    const types = withTry(type());

    expect(nextEvents(scrum, { result: 'won_clean' }, 'OWN', types)).toEqual([]);
    expect(nextEvents(kickInPlay, { result: 'retained' }, 'OWN', types)).toEqual([]);
  });

  it('una patada directa afuera lanza el line-out del equipo que recibe la pelota', () => {
    const next = nextEvents(kickInPlay, { result: 'out_in_full' }, 'OWN', withTry(type()));

    expect(next.map(event => [event.type.code, event.team])).toEqual([['LINEOUT', 'OPPONENT']]);
  });

  it('con posesión neutral el equipo lo elige el analista', () => {
    expect(nextEvents(penalty, null, null, catalog).map(event => event.team)).toEqual([null, null]);
    expect(nextEvents(scrum, { result: 'penalty_for' }, null, [...catalog, scrum])[0].team).toBe(null);
  });
});
