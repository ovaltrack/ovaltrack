import { divisionMatchState, StateMatch } from './division-match-state';
import { GameWeekAnalysis, GameWeekInput, GameWeekStage, gameWeek, gameWeekStage } from './game-week';

describe('gameWeek', () => {
  const now = new Date(2026, 10, 16, 9, 0); // lun 16 nov 2026, 09:00
  const at = (days: number, hour = 15, minute = 30): string => {
    const date = new Date(2026, 10, 16 + days, hour, minute);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
  };
  const match = (id: string, status: StateMatch['status'], date: string): StateMatch => ({ id, status, date });
  const full = { starters: 15, substitutes: 8 };
  const done: GameWeekAnalysis = { opponent: 'TRC', percent: 100, minutesWithoutZone: 0 };

  const input = (matches: StateMatch[], overrides: Partial<GameWeekInput> = {}, capture: string | null = null): GameWeekInput => ({
    state: divisionMatchState(matches, capture, now), analysis: done, roster: full, now, ...overrides
  });
  const names = (week: ReturnType<typeof gameWeek>) => week?.steps.map(step => `${step.name}:${step.status}`);

  describe('etapa', () => {
    const stage = (matches: StateMatch[], overrides: Partial<GameWeekInput> = {}, capture: string | null = null): GameWeekStage | null =>
      gameWeekStage(input(matches, overrides, capture));

    it('Jugar: partido en curso, acá o en otro dispositivo, aunque su fecha sea de mañana', () => {
      expect(stage([match('a', 'in_progress', at(1))], {}, 'a')).toBe('play');
      expect(stage([match('a', 'halftime', at(1))])).toBe('play');
    });

    it('Jugar: not_started a menos de 24 h', () => {
      expect(stage([match('a', 'not_started', at(0, 20))])).toBe('play');
    });

    it('not_started a más de 24 h con nómina completa: Entrenar', () => {
      expect(stage([match('a', 'not_started', at(2))])).toBe('train');
    });

    it('Convocar: sin nómina a 72 h o menos, también a menos de 24 h', () => {
      expect(stage([match('a', 'empty_roster', at(3, 9, 0))], { roster: null })).toBe('call-up');
      expect(stage([match('a', 'empty_roster', at(0, 20))], { roster: null })).toBe('call-up');
    });

    it('Convocar: suplentes 3/8', () => {
      expect(stage([match('a', 'not_started', at(2))], { roster: { starters: 15, substitutes: 3 } })).toBe('call-up');
    });

    it('sin nómina a más de 72 h: todavía no es Convocar', () => {
      expect(stage([match('a', 'empty_roster', at(5))], { roster: null })).toBe('train');
    });

    it('nómina que no se pudo leer en un not_started: no se acusa, sigue Entrenar', () => {
      expect(stage([match('a', 'not_started', at(2))], { roster: null })).toBe('train');
    });

    it('Analizar: último partido con análisis < 100 % o minutos sin zona', () => {
      const matches = [match('a', 'not_started', at(5))];
      expect(stage(matches, { analysis: { ...done, percent: 85 } })).toBe('analyze');
      expect(stage(matches, { analysis: { ...done, minutesWithoutZone: 12 } })).toBe('analyze');
    });

    it('minutos sin zona desconocidos (null) no cuentan como pendientes', () => {
      expect(stage([match('a', 'not_started', at(5))], { analysis: { ...done, minutesWithoutZone: null } })).toBe('train');
    });

    it('Convocar le gana a Analizar; Jugar le gana a todo', () => {
      const pending = { analysis: { ...done, percent: 85 }, roster: null };
      expect(stage([match('a', 'empty_roster', at(2))], pending)).toBe('call-up');
      expect(stage([match('a', 'in_progress', at(0, 8))], pending)).toBe('play');
    });

    it('sin próximo partido y con análisis completo: sin pasos', () => {
      expect(stage([])).toBeNull();
      expect(stage([match('a', 'finished', at(-3))])).toBeNull();
    });

    it('sin próximo partido pero con análisis pendiente: Analizar', () => {
      expect(stage([match('a', 'finished', at(-3))], { analysis: { ...done, percent: 70 } })).toBe('analyze');
    });
  });

  describe('pasos', () => {
    it('Analizar: actual, con el rival y el %; el resto pendiente', () => {
      const week = gameWeek(input([match('n', 'not_started', at(5, 15, 30))], { analysis: { opponent: 'TRC', percent: 85, minutesWithoutZone: 0 } }));
      expect(week?.stepNumber).toBe(1);
      expect(names(week)).toEqual(['Analizar:current', 'Entrenar:pending', 'Convocar:done', 'Jugar:pending']);
      expect(week?.steps.map(step => step.subtitle)).toEqual(['vs TRC · 85 %', 'Esta semana', 'Completa', 'Sáb 21 · 15:30']);
    });

    it('Analizar sin pasar por la etapa: hecho si está completo, pendiente si no', () => {
      const incomplete = gameWeek(input([match('n', 'empty_roster', at(2))], { roster: null, analysis: { ...done, percent: 85 } }));
      expect(names(incomplete)).toEqual(['Analizar:pending', 'Entrenar:done', 'Convocar:current', 'Jugar:pending']);
      const complete = gameWeek(input([match('n', 'empty_roster', at(2))], { roster: null }));
      expect(names(complete)).toEqual(['Analizar:done', 'Entrenar:done', 'Convocar:current', 'Jugar:pending']);
    });

    it('Entrenar: actual con el próximo partido más allá de 72 h', () => {
      const week = gameWeek(input([match('n', 'not_started', at(6))]));
      expect(week?.stepNumber).toBe(2);
      expect(names(week)).toEqual(['Analizar:done', 'Entrenar:current', 'Convocar:done', 'Jugar:pending']);
    });

    it('Convocar: actual con «Suplentes 3/8»; Entrenar pasa a hecho (D1)', () => {
      const week = gameWeek(input([match('n', 'not_started', at(2))], { roster: { starters: 15, substitutes: 3 } }));
      expect(week?.stepNumber).toBe(3);
      expect(week?.steps[1]).toEqual(jasmine.objectContaining({ status: 'done', subtitle: 'Hecho' }));
      expect(week?.steps[2]).toEqual(jasmine.objectContaining({ status: 'current', subtitle: 'Suplentes 3/8' }));
    });

    it('Convocar sin nómina', () => {
      const week = gameWeek(input([match('n', 'empty_roster', at(1))], { roster: null }));
      expect(week?.steps[2].subtitle).toBe('Sin nómina');
    });

    it('Jugar en curso: «En curso», los pasos anteriores hechos', () => {
      const week = gameWeek(input([match('v', 'in_progress', at(1))], {}, 'v'));
      expect(week?.stepNumber).toBe(4);
      expect(names(week)).toEqual(['Analizar:done', 'Entrenar:done', 'Convocar:done', 'Jugar:current']);
      expect(week?.steps[3].subtitle).toBe('En curso');
    });

    it('Jugar en el entretiempo', () => {
      expect(gameWeek(input([match('v', 'halftime', at(0, 8))]))?.steps[3].subtitle).toBe('Entretiempo');
    });

    it('Jugar con partido en curso y la nómina del próximo incompleta: Convocar queda «Cerrada»', () => {
      const week = gameWeek(input([match('v', 'in_progress', at(0, 8)), match('n', 'empty_roster', at(7))], { roster: null }));
      expect(week?.steps[2]).toEqual(jasmine.objectContaining({ status: 'done', subtitle: 'Cerrada' }));
    });

    it('Jugar día de partido: fecha y hora en el subtítulo', () => {
      const week = gameWeek(input([match('n', 'not_started', at(0, 20, 5))]));
      expect(week?.steps[3].subtitle).toBe('Lun 16 · 20:05');
    });

    it('sin pasos devuelve null', () => {
      expect(gameWeek(input([]))).toBeNull();
    });
  });
});
