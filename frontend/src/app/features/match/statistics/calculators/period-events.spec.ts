import { eventsOfPeriod } from './period-events';
import { StatisticEvent } from '../types/statistic.types';

describe('eventsOfPeriod', () => {
  const event = (id: string, extra: Partial<StatisticEvent> = {}): StatisticEvent => ({
    id, eventTypeId: 't', teamPossession: 'OWN', matchTime: 10, period: 1, ...extra
  });

  it('sin período devuelve todos los eventos activos', () => {
    const events = [event('a'), event('b', { period: 2 }), event('c', { active: false })];

    expect(eventsOfPeriod(events).map(e => e.id)).toEqual(['a', 'b']);
  });

  it('un evento sin `active` (timeline del post-partido) cuenta como activo', () => {
    expect(eventsOfPeriod([event('a')], 1).map(e => e.id)).toEqual(['a']);
  });

  it('con período filtra por él y los de período null cuentan en ambos', () => {
    const events = [event('a'), event('b', { period: 2 }), event('c', { period: null })];

    expect(eventsOfPeriod(events, 2).map(e => e.id)).toEqual(['b', 'c']);
  });

  it('descarta los inactivos aunque coincida el período', () => {
    expect(eventsOfPeriod([event('a', { active: false })], 1)).toEqual([]);
  });
});
