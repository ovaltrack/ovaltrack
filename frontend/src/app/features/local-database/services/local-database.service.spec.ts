import { TestBed } from '@angular/core/testing';
import { LocalDatabaseService } from './local-database.service';
import { buildBackendEventResponse, buildEventType, buildLocalEvent, buildMatch, clearLocalDatabases } from '../../../testing/offline-test-helpers';
import { matchDatabase } from '../local-databases';

describe('LocalDatabaseService (partidos offline)', () => {
  let cache: LocalDatabaseService;
  const roster = { startingPlayers: [], substitutePlayers: [] };

  beforeEach(async () => {
    cache = TestBed.inject(LocalDatabaseService);
    await clearLocalDatabases();
  });

  it('borra la nómina de un partido que dejó de capturarse sin conexión', async () => {
    await cache.saveMatches([buildMatch({ id: 'match-1', status: 'in_progress' })]);
    await cache.saveRoster('match-1', roster);

    await cache.syncOfflineMatches([buildMatch({ id: 'match-1', status: 'finished' })]);

    expect(await cache.getMatch('match-1')).toBeUndefined();
    expect(await matchDatabase.rosters.get('match-1')).toBeUndefined();
  });

  it('conserva partido y nómina si tiene una transición pendiente', async () => {
    await cache.saveMatches([buildMatch({ id: 'match-1', status: 'finished' })]);
    await cache.saveRoster('match-1', roster);
    await cache.savePendingMatchMutation({ id: 'match-1-latest', matchId: 'match-1', action: 'finish', createdAt: 1 });

    await cache.syncOfflineMatches([buildMatch({ id: 'match-1', status: 'in_progress' })]);

    expect((await cache.getMatch('match-1'))?.status).toBe('finished');
    expect(await matchDatabase.rosters.get('match-1')).toBeDefined();
  });

  it('no toca los eventos de un partido que deja de guardarse', async () => {
    await cache.saveMatches([buildMatch({ id: 'match-1', status: 'in_progress' })]);
    await cache.saveEvent(buildLocalEvent());

    await cache.syncOfflineMatches([buildMatch({ id: 'match-1', status: 'finished' })]);

    expect((await cache.getPendingEvents('match-1')).length).toBe(1);
  });
});

describe('LocalDatabaseService (eventos)', () => {
  let cache: LocalDatabaseService;

  beforeEach(async () => {
    cache = TestBed.inject(LocalDatabaseService);
    await clearLocalDatabases();
  });

  describe('markEventSynchronized', () => {
    it('marca como sincronizado un evento que no cambió durante la petición', async () => {
      const event = buildLocalEvent();
      await cache.saveEvent(event);

      await cache.markEventSynchronized(event, buildBackendEventResponse(event));

      expect(await cache.getPendingEvents('match-1')).toEqual([]);
      const [stored] = await cache.getEventsByMatch('match-1');
      expect(stored.backendEventId).toBe('backend-event-1');
    });

    it('no resucita un evento borrado mientras su creación estaba en vuelo', async () => {
      const sentEvent = buildLocalEvent();
      await cache.saveEvent(sentEvent);
      await cache.deleteEvent(sentEvent);

      await cache.markEventSynchronized(sentEvent, buildBackendEventResponse(sentEvent));

      expect(await cache.getEventsByMatch('match-1')).toEqual([]);
      const [pendingDeletion] = await cache.getPendingEvents('match-1');
      expect(pendingDeletion).toEqual(jasmine.objectContaining({
        id: 'event-1',
        active: false,
        backendEventId: 'backend-event-1',
        synchronizedAt: null,
      }));
    });

    it('no recrea un evento eliminado localmente', async () => {
      const sentEvent = buildLocalEvent();

      const result = await cache.markEventSynchronized(sentEvent, buildBackendEventResponse(sentEvent));

      expect(result).toBeUndefined();
      expect(await cache.getStatusData('match-1')).toEqual(jasmine.objectContaining({ events: [] }));
    });
  });

  describe('mergeRemoteEvents', () => {
    it('conserva un borrado local pendiente aunque aún no tenga id del backend', async () => {
      const localEvent = buildLocalEvent();
      await cache.saveEvent(localEvent);
      await cache.deleteEvent(localEvent);

      const visible = await cache.mergeRemoteEvents('match-1', [buildBackendEventResponse(localEvent)]);

      expect(visible).toEqual([]);
      const [pendingDeletion] = await cache.getPendingEvents('match-1');
      expect(pendingDeletion.backendEventId).toBe('backend-event-1');
    });
  });

  describe('mergeRemoteEvents (reconciliación)', () => {
    it('oculta un evento sincronizado que se borró desde otro dispositivo', async () => {
      const kept = buildLocalEvent({ id: 'event-1', backendEventId: 'backend-1', synchronizedAt: '2026-10-23T15:00:05' });
      const deletedElsewhere = buildLocalEvent({ id: 'event-2', localSequence: 2, backendEventId: 'backend-2', synchronizedAt: '2026-10-23T15:00:05' });
      await cache.saveEvent(kept);
      await cache.saveEvent(deletedElsewhere);

      const visible = await cache.mergeRemoteEvents('match-1', [buildBackendEventResponse(kept)]);

      expect(visible.map(event => event.id)).toEqual(['event-1']);
      expect(await cache.getPendingEvents('match-1'))
        .withContext('el borrado remoto no genera un DELETE')
        .toEqual([]);
    });

    it('no oculta eventos locales que todavía no se sincronizaron', async () => {
      await cache.saveEvent(buildLocalEvent({ id: 'event-1' }));

      const visible = await cache.mergeRemoteEvents('match-1', []);

      expect(visible.map(event => event.id)).toEqual(['event-1']);
    });
  });

  describe('syncActiveEventTypes', () => {
    it('marca como inactivos los tipos que el servidor ya no devuelve, sin borrarlos', async () => {
      await cache.saveEventTypes([
        buildEventType({ id: 'tackle' }),
        buildEventType({ id: 'old-type', name: 'Dado de baja' }),
      ]);

      await cache.syncActiveEventTypes([buildEventType({ id: 'tackle' })]);

      expect((await cache.getActiveEventTypes()).map(type => type.id)).toEqual(['tackle']);
      const all = await cache.getEventTypes();
      expect(all.find(type => type.id === 'old-type')?.isActive).toBe(false);
    });

    it('reactiva un tipo que vuelve a estar activo', async () => {
      await cache.saveEventTypes([buildEventType({ id: 'tackle', isActive: false })]);

      await cache.syncActiveEventTypes([buildEventType({ id: 'tackle' })]);

      expect((await cache.getActiveEventTypes()).map(type => type.id)).toEqual(['tackle']);
    });
  });

  describe('clearCachedDataOnLogout', () => {
    it('borra la caché, conserva eventos sin sincronizar y no cuenta los rechazados', async () => {
      await cache.saveMatches([buildMatch()]);
      await cache.saveRoster('match-1', {
        startingPlayers: [
          { playerId: 'p-1', number: 7, role: 'TITULAR', fieldStatus: 'EN_CANCHA', fieldSlot: 1, slotOrder: 0 },
        ],
        substitutePlayers: [],
      });
      await cache.saveEventTypes([buildEventType()]);
      await cache.saveEvent(buildLocalEvent({ id: 'synced', backendEventId: 'b-1', synchronizedAt: '2026-10-23T15:00:05' }));
      await cache.saveEvent(buildLocalEvent({ id: 'pending', localSequence: 2 }));
      await cache.saveEvent(buildLocalEvent({ id: 'failed', localSequence: 3, syncFailedAt: '2026-10-23T15:01:00' }));
      await cache.saveEvent(buildLocalEvent({ id: 'discarded', localSequence: 4, active: false }));
      await cache.savePendingMatchMutation({ id: 'match-1-latest', matchId: 'match-1', action: 'finish', createdAt: 1 });

      const kept = await cache.clearCachedDataOnLogout();

      expect(kept).withContext('el rechazado se conserva pero no se reenvía').toBe(2);
      expect(await cache.getMatch('match-1')).toBeUndefined();
      expect(await cache.getRoster('match-1')).toBeUndefined();
      expect(await cache.getEventTypes()).toEqual([]);
      const { events } = await cache.getStatusData('match-1');
      expect(events.map(event => event.id).sort()).toEqual(['failed', 'pending']);
      expect((await cache.getPendingMatchMutations()).length).toBe(1);
    });
  });

  describe('countPendingChanges', () => {
    it('cuenta eventos pendientes y transiciones de partido, sin sincronizados ni rechazados', async () => {
      await cache.saveEvent(buildLocalEvent({ id: 'synced', backendEventId: 'b-1', synchronizedAt: '2026-10-23T15:00:05' }));
      await cache.saveEvent(buildLocalEvent({ id: 'pending', localSequence: 2 }));
      await cache.saveEvent(buildLocalEvent({ id: 'failed', localSequence: 3, syncFailedAt: '2026-10-23T15:01:00' }));
      await cache.saveEvent(buildLocalEvent({ id: 'discarded', localSequence: 4, active: false }));
      await cache.saveEvent(buildLocalEvent({ id: 'pending-deletion', localSequence: 5, active: false, backendEventId: 'b-5' }));
      await cache.savePendingMatchMutation({ id: 'match-1-latest', matchId: 'match-1', action: 'finish', createdAt: 1 });

      expect(await cache.countPendingChanges()).toBe(3);
    });

    it('coincide con getPendingEvents cuando no hay transiciones pendientes', async () => {
      await cache.saveEvent(buildLocalEvent({ id: 'a' }));
      await cache.saveEvent(buildLocalEvent({ id: 'b', localSequence: 2, matchId: 'match-2' }));

      expect(await cache.countPendingChanges()).toBe((await cache.getPendingEvents()).length);
    });
  });
});
