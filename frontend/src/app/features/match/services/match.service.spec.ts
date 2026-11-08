import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { MatchService } from './match.service';
import { Division } from '../../division/types/division.types';
import { LocalDatabaseService } from '../../local-database/services/local-database.service';
import { buildBackendMatch, buildMatch, clearLocalDatabases, nextRequest } from '../../../testing/offline-test-helpers';

describe('MatchService (transiciones offline)', () => {
  let service: MatchService;
  let cache: LocalDatabaseService;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(MatchService);
    cache = TestBed.inject(LocalDatabaseService);
    httpMock = TestBed.inject(HttpTestingController);
    await clearLocalDatabases();
    await cache.saveMatches([buildMatch({ status: 'in_progress' })]);
  });

  afterEach(() => httpMock.verify());

  for (const status of [0, 502, 503, 504]) {
    it(`encola la transición y actualiza la caché ante status ${status}`, async () => {
      const closing = firstValueFrom(service.closeFirstHalf('match-1'));
      const request = await nextRequest(httpMock, req => req.url.endsWith('/matches/match-1/close-first-half'));
      if (status === 0) {
        request.error(new ProgressEvent('error'), { status: 0 });
      } else {
        request.flush({ message: 'Bad gateway' }, { status, statusText: 'Server error' });
      }

      const localMatch = await closing;

      expect(localMatch.status).toBe('halftime');
      expect((await cache.getMatch('match-1'))?.status).toBe('halftime');
      const [mutation] = await cache.getPendingMatchMutations();
      expect(mutation).toEqual(jasmine.objectContaining({ id: 'match-1-latest', action: 'close-first-half' }));
    });
  }

  it('propaga un rechazo del servidor sin encolar', async () => {
    const finishing = firstValueFrom(service.finishMatch('match-1'));
    (await nextRequest(httpMock, req => req.url.endsWith('/finish')))
      .flush({ message: 'Conflicto' }, { status: 409, statusText: 'Conflict' });

    await expectAsync(finishing).toBeRejected();
    expect(await cache.getPendingMatchMutations()).toEqual([]);
  });

  it('guarda la respuesta del servidor cuando la transición se confirma', async () => {
    const closing = firstValueFrom(service.closeFirstHalf('match-1'));
    (await nextRequest(httpMock, req => req.url.endsWith('/close-first-half')))
      .flush(buildBackendMatch({ status: 'HALFTIME' }));

    expect((await closing).status).toBe('halftime');
    expect(await cache.getPendingMatchMutations()).toEqual([]);
  });

  it('cachea un partido finalizado offline para las pantallas post-partido', async () => {
    const finishing = firstValueFrom(service.finishMatch('match-1'));
    (await nextRequest(httpMock, req => req.url.endsWith('/finish')))
      .error(new ProgressEvent('error'), { status: 0 });

    expect((await finishing).status).toBe('finished');
    expect((await cache.getMatch('match-1'))?.status).toBe('finished');
  });

  it('cachea solo los partidos que se capturan sin conexión y quita los que dejaron de serlo', async () => {
    const loading = firstValueFrom(service.getAllMatchesByDivisionId('division-1'));
    (await nextRequest(httpMock, req => req.url.includes('/matches/division')))
      .flush([
        buildBackendMatch({ id: 'match-1', status: 'FINISHED' }),
        buildBackendMatch({ id: 'match-2', status: 'CANCELLED' }),
        buildBackendMatch({ id: 'match-3', status: 'EMPTY_ROSTER' }),
        buildBackendMatch({ id: 'match-4', status: 'HALFTIME' }),
      ]);

    expect((await loading).length).withContext('la pantalla recibe todos los partidos').toBe(4);
    const cached = await cache.getMatchesByDivision('division-1');
    expect(cached.map(match => [match.id, match.status])).toEqual([['match-4', 'halftime']]);
  });

  it('al consultar un partido finalizado no lo deja en IndexedDB', async () => {
    const loading = firstValueFrom(service.getMatchById('match-1'));
    (await nextRequest(httpMock, req => req.url.endsWith('/matches/match-1')))
      .flush(buildBackendMatch({ id: 'match-1', status: 'FINISHED' }));

    expect((await loading).status).toBe('finished');
    expect(await cache.getMatch('match-1')).toBeUndefined();
  });

  it('al consultar un partido en entretiempo lo guarda para usarlo sin conexión', async () => {
    const loading = firstValueFrom(service.getMatchById('match-1'));
    (await nextRequest(httpMock, req => req.url.endsWith('/matches/match-1')))
      .flush(buildBackendMatch({ id: 'match-1', status: 'HALFTIME' }));
    await loading;

    expect((await cache.getMatch('match-1'))?.status).toBe('halftime');
  });

  it('no pisa ni borra un partido con una transición pendiente', async () => {
    await cache.saveMatches([buildMatch({ id: 'match-1', status: 'finished' })]);
    await cache.savePendingMatchMutation({ id: 'match-1-latest', matchId: 'match-1', action: 'finish', createdAt: 1 });

    const loading = firstValueFrom(service.getAllMatchesByDivisionId('division-1'));
    (await nextRequest(httpMock, req => req.url.includes('/matches/division')))
      .flush([buildBackendMatch({ id: 'match-1', status: 'IN_PROGRESS' })]);
    await loading;

    expect((await cache.getMatch('match-1'))?.status).toBe('finished');
  });

  it('lista los partidos del club y los cachea', async () => {
    const loading = firstValueFrom(service.getMatchesByClub('club-1'));
    (await nextRequest(httpMock, req => req.url.endsWith('/matches/club?clubId=club-1')))
      .flush([buildBackendMatch({ id: 'match-1', status: 'NOT_STARTED' })]);

    expect((await loading).map(match => [match.id, match.status])).toEqual([['match-1', 'not_started']]);
    expect((await cache.getMatch('match-1'))?.status).toBe('not_started');
  });

  it('sin conexión lista los partidos cacheados de las divisiones del club', async () => {
    await cache.saveDivisions([{ id: 'division-1', clubId: 'club-1' } as Division]);
    const loading = firstValueFrom(service.getMatchesByClub('club-1'));
    (await nextRequest(httpMock, req => req.url.includes('/matches/club')))
      .error(new ProgressEvent('error'), { status: 0 });

    expect((await loading).map(match => match.id)).toEqual(['match-1']);
  });

  it('quita de IndexedDB el partido cancelado y su nómina', async () => {
    await cache.saveRoster('match-1', { startingPlayers: [], substitutePlayers: [] });

    const cancelling = firstValueFrom(service.deleteMatch('match-1'));
    (await nextRequest(httpMock, req => req.url.endsWith('/matches/match-1/cancel')))
      .flush(buildBackendMatch({ status: 'CANCELLED' }));
    await cancelling;

    expect(await cache.getMatch('match-1')).toBeUndefined();
    expect(await cache.getRoster('match-1')).toBeUndefined();
  });

  it('no deja en IndexedDB un partido recién creado (sin plantel)', async () => {
    const creating = firstValueFrom(service.createMatch({ date: '2026-10-30T16:00', opponentId: 'opponent-1' }, 'division-1'));
    (await nextRequest(httpMock, req => req.method === 'POST' && req.url.endsWith('/matches')))
      .flush(buildBackendMatch({ id: 'match-2', status: 'EMPTY_ROSTER' }));

    expect((await creating).status).toBe('empty_roster');
    expect(await cache.getMatch('match-2')).toBeUndefined();
  });

  it('una transición encolada completa startedAt/finishedAt y clockUpdatedAt en la caché', async () => {
    await cache.saveMatches([buildMatch({ status: 'not_started', startedAt: null, clockUpdatedAt: '2026-10-23T10:00:00' })]);
    const before = Date.now();

    const starting = firstValueFrom(service.startMatch('match-1'));
    (await nextRequest(httpMock, req => req.url.endsWith('/start')))
      .error(new ProgressEvent('error'), { status: 0 });
    await starting;

    const cached = await cache.getMatch('match-1');
    const [mutation] = await cache.getPendingMatchMutations();
    expect(cached?.startedAt).toBe(new Date(mutation.createdAt).toISOString());
    expect(cached?.clockUpdatedAt).toBe(new Date(mutation.createdAt).toISOString());
    expect(mutation.createdAt).toBeGreaterThanOrEqual(before);
    expect(cached?.finishedAt ?? null).toBeNull();

    const finishing = firstValueFrom(service.finishMatch('match-1'));
    (await nextRequest(httpMock, req => req.url.endsWith('/finish')))
      .error(new ProgressEvent('error'), { status: 0 });
    await finishing;

    const finished = await cache.getMatch('match-1');
    expect(finished?.startedAt).withContext('no pisa el inicio').toBe(cached?.startedAt);
    expect(finished?.finishedAt).toEqual(jasmine.any(String));
  });
});
