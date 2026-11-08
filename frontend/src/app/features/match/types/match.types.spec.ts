import { MatchStatus, isOfflineMatch } from './match.types';

describe('isOfflineMatch', () => {
  const offline: MatchStatus[] = ['not_started', 'in_progress', 'halftime'];
  const onlineOnly: MatchStatus[] = ['empty_roster', 'finished', 'cancelled'];

  offline.forEach(status => {
    it(`guarda para usar sin conexión un partido ${status}`, () => {
      expect(isOfflineMatch({ status })).toBeTrue();
    });
  });

  onlineOnly.forEach(status => {
    it(`no guarda para usar sin conexión un partido ${status}`, () => {
      expect(isOfflineMatch({ status })).toBeFalse();
    });
  });
});
