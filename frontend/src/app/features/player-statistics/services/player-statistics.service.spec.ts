import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { PlayerStatisticsService } from './player-statistics.service';
import { UserContextService } from 'src/app/core/services/user-context.service';
import { LocalDatabaseService } from '../../local-database/services/local-database.service';
import { buildBackendEventResponse, buildLocalEvent, clearLocalDatabases, nextRequest } from '../../../testing/offline-test-helpers';

describe('PlayerStatisticsService (solo backend)', () => {
  let service: PlayerStatisticsService;
  let cache: LocalDatabaseService;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: UserContextService, useValue: { personId: signal('person-1'), fullName: signal('Jugador Uno') } },
      ],
    });
    service = TestBed.inject(PlayerStatisticsService);
    cache = TestBed.inject(LocalDatabaseService);
    httpMock = TestBed.inject(HttpTestingController);
    await clearLocalDatabases();
  });

  afterEach(() => httpMock.verify());

  it('lee los eventos del partido del backend y no los guarda en IndexedDB', async () => {
    const remoteEvent = buildBackendEventResponse(buildLocalEvent({ id: 'event-1', matchId: 'match-1' }));

    const loading = firstValueFrom(service.loadMatchSource('match-1'));
    (await nextRequest(httpMock, req => req.url.endsWith('/event/match?matchId=match-1'))).flush([remoteEvent]);
    (await nextRequest(httpMock, req => req.url.endsWith('/eventType'))).flush([]);

    expect((await loading).events).toEqual([remoteEvent]);
    expect(await cache.getEventsByMatch('match-1')).toEqual([]);
  });

  it('sin conexión falla en lugar de usar eventos guardados en IndexedDB', async () => {
    await cache.saveEvent(buildLocalEvent({ id: 'event-1', matchId: 'match-1' }));

    const loading = firstValueFrom(service.loadMatchSource('match-1'));
    (await nextRequest(httpMock, req => req.url.endsWith('/event/match?matchId=match-1')))
      .error(new ProgressEvent('error'), { status: 0 });

    await expectAsync(loading).toBeRejected();
    httpMock.match(() => true);
  });
});
