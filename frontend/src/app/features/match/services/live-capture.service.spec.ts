import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { LiveCaptureService } from './live-capture.service';
import { LocalDatabaseService } from '../../local-database/services/local-database.service';
import { buildBackendEventResponse, buildBackendMatch, buildEventType, buildLocalEvent, buildMatch, clearLocalDatabases, nextRequest, settle } from '../../../testing/offline-test-helpers';

describe('LiveCaptureService', () => {
  let service: LiveCaptureService;
  let cache: LocalDatabaseService;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(LiveCaptureService);
    cache = TestBed.inject(LocalDatabaseService);
    httpMock = TestBed.inject(HttpTestingController);
    await clearLocalDatabases();
  });

  afterEach(() => httpMock.verify());

  it('propaga al servidor un borrado hecho mientras la creación estaba en vuelo', async () => {
    const event = buildLocalEvent();
    await cache.saveEvent(event);

    const firstSync = firstValueFrom(service.syncPendingEvents('match-1'));
    const create = await nextRequest(httpMock, req => req.method === 'POST' && req.url.endsWith('/event'));
    await cache.deleteEvent(event);
    create.flush(buildBackendEventResponse(event));
    await firstSync;

    const secondSync = firstValueFrom(service.syncPendingEvents('match-1'));
    const deletion = await nextRequest(httpMock, req => req.method === 'DELETE');
    expect(deletion.request.url).toMatch(/\/event\/backend-event-1$/);
    deletion.flush(buildBackendEventResponse(event, { active: false }));
    await secondSync;

    expect(await cache.getPendingEvents('match-1')).toEqual([]);
    expect(await cache.getEventsByMatch('match-1')).toEqual([]);
  });

  describe('bootstrap offline', () => {
    beforeEach(async () => {
      await cache.saveMatches([buildMatch({ divisionId: 'division-1' })]);
      await cache.saveRoster('match-1', {
        startingPlayers: [
          { playerId: 'p-2', number: 99, role: 'TITULAR', fieldStatus: 'EN_CANCHA', fieldSlot: 1, slotOrder: 0 },
          { playerId: 'p-1', number: 7, role: 'TITULAR', fieldStatus: 'EN_CANCHA', fieldSlot: 2, slotOrder: 1 },
        ],
        substitutePlayers: [],
      });
      await cache.savePersonsByDivisionId([
        { id: 'p-1', fullName: 'Uno', jerseyNumber: 1, position: null, divisionId: 'division-1' },
        { id: 'p-2', fullName: 'Dos', jerseyNumber: 7, position: null, divisionId: 'division-1' },
      ]);
      await cache.saveEventTypes([
        buildEventType({ id: 'tackle' }),
        buildEventType({ id: 'old-type', isActive: false }),
      ]);
    });

    it('arma el plantel con el roster y los jugadores cacheados y ofrece solo tipos activos', async () => {
      const loading = firstValueFrom(service.getLiveCaptureBootstrap({ matchId: 'match-1' }));
      (await nextRequest(httpMock, req => req.url.endsWith('/matches/match-1/live-bootstrap')))
        .error(new ProgressEvent('error'), { status: 0 });

      const bootstrap = await loading;
      (await nextRequest(httpMock, req => req.url.endsWith('/matches/match-1')))
        .error(new ProgressEvent('error'), { status: 0 });
      expect(httpMock.match(() => true).every(request => request.cancelled)).toBeTrue();

      expect(bootstrap.rosterPlayers.map(player => player.id)).toEqual(['p-2', 'p-1']);
      expect(bootstrap.eventTypes.map(type => type.id)).toEqual(['tackle']);
      expect((await cache.getEventTypes()).find(type => type.id === 'old-type')?.isActive)
        .withContext('el bootstrap offline no reactiva tipos dados de baja')
        .toBe(false);
    });

    it('con el backend lento abre con los datos de Dexie al vencer el plazo', async () => {
      jasmine.clock().install();
      const loading = firstValueFrom(service.getLiveCaptureBootstrap({ matchId: 'match-1' }));
      jasmine.clock().tick(3_000);
      jasmine.clock().uninstall();

      const bootstrap = await loading;
      expect(bootstrap.rosterPlayers.map(player => player.id)).toEqual(['p-2', 'p-1']);
      expect(bootstrap.eventTypes.map(type => type.id)).toEqual(['tackle']);

      httpMock.expectOne(req => req.url.endsWith('/matches/match-1/live-bootstrap'))
        .error(new ProgressEvent('error'), { status: 0 });
      httpMock.match(() => true);
    });

    it('asigna el jugador por número permanente del plantel y no por índice ni camiseta', async () => {
      const saved = await firstValueFrom(service.saveEvent(buildLocalEvent({
        eventTypeId: 'tackle',
        playerId: null,
        attributes: { playerNumber: 99 },
      })));

      expect(saved.playerId).withContext('el número 99 del plantel es p-2 (camiseta 7)').toBe('p-2');
    });

    it('deja el evento sin jugador si no hay plantel, en vez de adivinar por camiseta', async () => {
      await cache.saveRoster('match-1', { startingPlayers: [], substitutePlayers: [] });

      const saved = await firstValueFrom(service.saveEvent(buildLocalEvent({
        eventTypeId: 'tackle',
        playerId: null,
        attributes: { playerNumber: 1 },
      })));

      expect(saved.playerId).toBeNull();
    });
  });

  it('sin datos en Dexie sigue esperando al backend lento, sin repetir la consulta', async () => {
    let resolved = false;
    jasmine.clock().install();
    const loading = firstValueFrom(service.getLiveCaptureBootstrap({ matchId: 'match-1' }))
      .finally(() => { resolved = true; });
    jasmine.clock().tick(3_000);
    jasmine.clock().uninstall();

    await settle();
    expect(resolved).withContext('no se rinde al vencer el plazo si no hay datos locales').toBeFalse();

    httpMock.expectOne(req => req.url.endsWith('/matches/match-1/live-bootstrap'))
      .flush({ match: buildBackendMatch(), events: [], eventTypes: [] });
    (await nextRequest(httpMock, req => req.url.endsWith('/matches/match-1/roster/players'))).flush([]);

    expect((await loading).match.id).toBe('match-1');
    (await nextRequest(httpMock, req => req.url.endsWith('/matches/match-1'))).flush(buildBackendMatch());
    (await nextRequest(httpMock, req => req.url.endsWith('/division/division-1/players'))).flush([]);
  });

  it('abre sin esperar a los jugadores de la división y igual los deja en Dexie', async () => {
    const loading = firstValueFrom(service.getLiveCaptureBootstrap({ matchId: 'match-1' }));
    (await nextRequest(httpMock, req => req.url.endsWith('/matches/match-1/live-bootstrap')))
      .flush({ match: buildBackendMatch(), events: [], eventTypes: [] });
    (await nextRequest(httpMock, req => req.url.endsWith('/matches/match-1/roster/players'))).flush([]);

    expect((await loading).match.id).withContext('abre sin la respuesta de los jugadores').toBe('match-1');

    (await nextRequest(httpMock, req => req.url.endsWith('/matches/match-1'))).flush(buildBackendMatch());
    (await nextRequest(httpMock, req => req.url.endsWith('/division/division-1/players')))
      .flush([{ id: 'p-1', fullName: 'Uno', jerseyNumber: 1, position: null }]);
    await settle();

    expect((await cache.getPersonsByDivisionId('division-1')).map(player => player.id)).toEqual(['p-1']);
  });

  it('actualiza clockUpdatedAt del partido cacheado al guardar el reloj', async () => {
    await cache.saveMatches([buildMatch({ clockUpdatedAt: '2026-10-23T10:00:00' })]);
    const savedAt = Date.parse('2026-10-23T15:30:00Z');

    const saving = firstValueFrom(service.saveLiveCaptureState({
      matchId: 'match-1',
      isStarted: true,
      gameClock: '30:00',
      period: 1,
      periodLabel: '1T',
      synchronized: false,
      clockPaused: false,
      pendingSelection: null,
      clockElapsedSeconds: 1800,
      savedAt,
      currentPossession: 'OWN',
    }));
    (await nextRequest(httpMock, req => req.method === 'PUT' && req.url.endsWith('/live-state')))
      .flush(buildBackendMatch({ clockElapsedSeconds: 1800 }));
    await saving;

    const cached = await cache.getMatch('match-1');
    expect(cached?.clockElapsedSeconds).toBe(1800);
    expect(cached?.clockUpdatedAt).toBe('2026-10-23T15:30:00.000Z');
  });
});
