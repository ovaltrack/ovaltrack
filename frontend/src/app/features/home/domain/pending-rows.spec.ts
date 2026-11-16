import { BoardModel } from '../types/home.types';
import { PendingAnalysis, PendingContext, PendingNext, analysisOnBoard, pendingRows, rosterOnBoard } from './pending-rows';

describe('pending-rows', () => {
  const idle: BoardModel = { kind: 'team-idle', divisionName: 'Superior', last: { opponent: 'TRC', dateLabel: '1 nov', ownScore: 1, opponentScore: 0, result: 'win' } };
  const callUpBoard = { kind: 'next', callUp: { title: 'Armá la nómina del sábado' } } as unknown as BoardModel;
  const analysisBoard = { kind: 'analysis' } as unknown as BoardModel;

  const analysis: PendingAnalysis = { matchId: 'f1', opponent: 'TRC', dateLabel: '1 nov', percent: 78, withoutPlayer: 12, minutesWithoutZone: 35 };
  const next: PendingNext = { id: 'n1', status: 'not_started', opponent: 'CRC', whenLabel: 'Sáb 21 nov · 15:30' };
  const context = (overrides: Partial<PendingContext> = {}): PendingContext => ({
    board: idle, divisionId: 'd1', divisionName: 'Superior', analysis: null, next: null, roster: null, withoutJersey: 0, ...overrides
  });
  const kinds = (overrides: Partial<PendingContext>) => pendingRows(context(overrides)).map(row => row.kind);

  it('sin nada pendiente devuelve una lista vacía', () => {
    expect(pendingRows(context({ analysis: { ...analysis, percent: 100, minutesWithoutZone: 0 }, next, roster: { starters: 15, substitutes: 8 } }))).toEqual([]);
  });

  it('respeta el orden: análisis, nómina, suplentes y dorsales', () => {
    expect(kinds({ analysis, next: { ...next, status: 'empty_roster' }, roster: null, withoutJersey: 2 })).toEqual(['analysis', 'roster', 'jerseys']);
    expect(kinds({ analysis, next, roster: { starters: 15, substitutes: 5 }, withoutJersey: 2 })).toEqual(['analysis', 'substitutes', 'jerseys']);
  });

  it('el análisis pendiente se explica con rival, fecha y lo que falta, y lleva a Eventos con «solo sin jugador»', () => {
    const [row] = pendingRows(context({ analysis }));
    expect(row).toEqual(jasmine.objectContaining({
      text: 'Análisis al 78 %', detail: 'vs TRC · 1 nov · 12 jugadas sin jugador · 35′ sin zona', route: '/post-match/f1', queryParams: { pendientes: 1 }, actionLabel: 'Completar análisis'
    }));
  });

  it('con el 100 % cargado pero minutos sin zona, lleva a las zonas', () => {
    const [row] = pendingRows(context({ analysis: { ...analysis, percent: 100, withoutPlayer: 0 } }));
    expect(row).toEqual(jasmine.objectContaining({ text: 'Zonas sin asignar', detail: 'vs TRC · 1 nov · 35′ sin zona', route: '/post-match/f1/zones', actionLabel: 'Completar zonas' }));
    expect(row.queryParams).toBeUndefined();
  });

  it('un análisis con minutos sin zona ilegibles (null) y 100 % no es pendiente', () => {
    expect(kinds({ analysis: { ...analysis, percent: 100, minutesWithoutZone: null } })).toEqual([]);
  });

  it('el análisis no se repite si el tablero está en la variante analysis', () => {
    expect(analysisOnBoard(analysisBoard)).toBeTrue();
    expect(kinds({ board: analysisBoard, analysis })).toEqual([]);
  });

  it('la nómina no se repite si el tablero está en Convocar, pero los suplentes faltantes sí se listan', () => {
    expect(rosterOnBoard(callUpBoard)).toBeTrue();
    expect(kinds({ board: callUpBoard, next: { ...next, status: 'empty_roster' }, roster: null })).toEqual([]);
    expect(kinds({ board: callUpBoard, next, roster: { starters: 15, substitutes: 6 } })).toEqual(['substitutes']);
  });

  it('el tablero en Entrenar (next sin callUp) no cubre la nómina', () => {
    const training = { kind: 'next', callUp: null } as unknown as BoardModel;
    expect(rosterOnBoard(training)).toBeFalse();
    expect(kinds({ board: training, next: { ...next, status: 'empty_roster' }, roster: null })).toEqual(['roster']);
  });

  it('textos de nómina: sin armar, titulares y suplentes', () => {
    const none = pendingRows(context({ next: { ...next, status: 'empty_roster' } }))[0];
    expect(none).toEqual(jasmine.objectContaining({ text: 'Nómina sin armar', detail: 'vs CRC · Sáb 21 nov · 15:30', route: '/selection-roster/n1', actionLabel: 'Armar nómina' }));
    expect(pendingRows(context({ next, roster: { starters: 12, substitutes: 8 } }))[0].text).toBe('Faltan 3 titulares');
    expect(pendingRows(context({ next, roster: { starters: 15, substitutes: 7 } }))[0].text).toBe('Faltan 1 suplente');
  });

  it('una nómina ilegible en un partido sin iniciar no se acusa', () => {
    expect(kinds({ next, roster: null })).toEqual([]);
  });

  it('jugadores sin dorsal: singular, plural y ruta al plantel', () => {
    expect(pendingRows(context({ withoutJersey: 1 }))[0].text).toBe('1 jugador sin dorsal');
    const [row] = pendingRows(context({ withoutJersey: 4 }));
    expect(row).toEqual(jasmine.objectContaining({ text: '4 jugadores sin dorsal', detail: 'Plantel Superior', route: '/divisions/d1/players', actionLabel: 'Asignar' }));
  });
});
