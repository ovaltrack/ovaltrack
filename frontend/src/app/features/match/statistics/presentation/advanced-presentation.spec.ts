import { presentAdvancedStatistics } from './advanced-presentation';
import { AdvancedPeriodStatistics } from '../types/statistic.types';

const zero = { own: 0, opponent: 0 };

const stats = (overrides: Partial<AdvancedPeriodStatistics> = {}): AdvancedPeriodStatistics => ({
  period: 1,
  possessions: { own: 3, opponent: 2 },
  pointsPerPossession: { own: 3.333, opponent: null },
  possessionOutcomes: [
    { key: 'POINTS', own: 2, opponent: 0 },
    { key: 'KICK', own: 0, opponent: 0 },
    { key: 'NEW_OUTCOME', own: 1, opponent: 0 },
  ],
  trySources: [
    { key: 'LINEOUT', own: 1, opponent: 0 },
    { key: 'SCRUM', own: 0, opponent: 0 },
  ],
  turnoverPossessions: zero,
  pointsFromTurnovers: zero,
  redZone: { available: false, visits: zero, points: zero, pointsPerVisit: { own: null, opponent: null } },
  penaltiesByTerritory: { ownHalf: { own: 1, opponent: 0 }, opponentHalf: zero, withoutZone: zero },
  scoreByBlock: [
    { fromMinute: 0, toMinute: 10, own: 7, opponent: 0 },
    { fromMinute: 10, toMinute: 20, own: 0, opponent: 0 },
  ],
  sinBin: { yellowCards: zero, pointsFor: zero, pointsAgainst: zero },
  ...overrides,
});

const sectionOf = (id: string, value = stats()) => presentAdvancedStatistics(value).find(section => section.id === id);

describe('presentAdvancedStatistics', () => {
  it('posesiones: tasa con un decimal, sin dato como guion y solo los finales con datos', () => {
    const lines = sectionOf('possessions')?.lines ?? [];

    expect(lines.map(line => [line.label, line.own, line.opponent])).toEqual([
      ['Posesiones', '3', '2'],
      ['Puntos por posesión', '3.3', '—'],
      ['Terminan en puntos', '2', '0'],
      ['NEW_OUTCOME', '1', '0'],
    ]);
  });

  it('origen de los tries: solo las fuentes con tries, con barra', () => {
    const section = sectionOf('try-sources');

    expect(section?.bars).toBeTrue();
    expect(section?.lines.map(line => line.label)).toEqual(['Line-out']);
    expect(section?.emptyMessage).toBeNull();
  });

  it('un bloque sin datos muestra su mensaje', () => {
    expect(sectionOf('turnovers')?.emptyMessage).toBe('Sin turnovers en el período.');
  });

  it('sin tramos la zona roja pide cargarlos', () => {
    const section = sectionOf('red-zone');

    expect(section?.lines).toEqual([]);
    expect(section?.emptyMessage).toBe('Cargá los tramos de zona del período para ver la zona roja.');
  });

  it('con tramos la zona roja informa visitas, puntos y puntos por visita', () => {
    const value = stats({
      redZone: { available: true, visits: { own: 2, opponent: 1 }, points: { own: 7, opponent: 0 }, pointsPerVisit: { own: 3.5, opponent: 0 } },
    });

    expect(sectionOf('red-zone', value)?.lines.map(line => [line.label, line.own, line.opponent])).toEqual([
      ['Visitas', '2', '1'],
      ['Puntos', '7', '0'],
      ['Puntos por visita', '3.5', '0.0'],
    ]);
  });

  it('disciplina: los penales sin zona aparecen solo si los hay', () => {
    const without = sectionOf('discipline')?.lines.map(line => line.label);
    const withMissing = sectionOf('discipline', stats({
      penaltiesByTerritory: { ownHalf: zero, opponentHalf: zero, withoutZone: { own: 0, opponent: 2 } },
    }))?.lines.map(line => line.label);

    expect(without).not.toContain('Penales sin zona');
    expect(withMissing).toContain('Penales sin zona');
  });

  it('cada bloque explica cómo leerlo', () => {
    for (const section of presentAdvancedStatistics(stats())) {
      expect(section.hint).withContext(section.id).toBeTruthy();
    }
  });

  it('puntos cada 10 minutos: un renglón por bloque, aunque esté vacío', () => {
    expect(sectionOf('score-blocks')?.lines.map(line => line.label)).toEqual(["0'–10'", "10'–20'"]);
  });
});
