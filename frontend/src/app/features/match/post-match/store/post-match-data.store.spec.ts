import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { EventTypeService } from '../../services/event-type.service';
import { LiveCaptureService } from '../../services/live-capture.service';
import { RosterService } from '../../services/roster.service';
import { PostMatchDataStore } from './post-match-data.store';

describe('PostMatchDataStore', () => {
  let store: PostMatchDataStore;
  let http: HttpTestingController;
  let syncPendingEvents: jasmine.Spy;

  const eventsUrl = (r: { url: string }) => r.url.includes('/event/match/post-match');
  const zonesUrl = (r: { url: string }) => r.url.endsWith('/matches/match-1/zones');
  const advancedUrl = (r: { url: string }) => r.url.endsWith('/match-1/advanced');

  beforeEach(() => {
    syncPendingEvents = jasmine.createSpy('syncPendingEvents').and.returnValue(of([]));
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        PostMatchDataStore,
        { provide: LiveCaptureService, useValue: { syncPendingEvents } },
        { provide: EventTypeService, useValue: { getAll: () => of([]) } },
        { provide: RosterService, useValue: { getRosterOrDivisionPlayers: () => of([]) } },
      ],
    });
    store = TestBed.inject(PostMatchDataStore);
    http = TestBed.inject(HttpTestingController);
    store.load('match-1');
    http.expectOne(eventsUrl).flush([]);
    http.expectOne(zonesUrl).flush({ assignments: [], summary: { cells: [], unzonedEventCount: 0 } });
  });

  afterEach(() => http.verify());

  it('al cargar pide en paralelo y precarga las avanzadas cuando terminan', () => {
    http.expectOne(advancedUrl).flush({ periods: [] });
  });

  it('una segunda lectura no vuelve a pedir', () => {
    http.expectOne(advancedUrl).flush({ periods: [] });

    store.events().subscribe();
    store.zones().subscribe();
    store.advanced().subscribe();

    http.expectNone(eventsUrl);
    http.expectNone(zonesUrl);
    http.expectNone(advancedUrl);
  });

  it('tras editar un evento vuelve a pedir eventos, tramos y avanzadas', () => {
    http.expectOne(advancedUrl).flush({ periods: [] });
    store.invalidateAfterEventChange();

    store.events().subscribe();
    store.zones().subscribe();
    store.advanced().subscribe();

    http.expectOne(eventsUrl).flush([]);
    http.expectOne(zonesUrl).flush({ assignments: [], summary: { cells: [], unzonedEventCount: 0 } });
    http.expectOne(advancedUrl).flush({ periods: [] });
  });

  it('tras guardar un tramo vuelve a pedir eventos, tramos y avanzadas', () => {
    http.expectOne(advancedUrl).flush({ periods: [] });
    store.invalidateAfterZoneChange();

    store.events().subscribe();
    store.zones().subscribe();
    store.advanced().subscribe();

    http.expectOne(eventsUrl).flush([]);
    http.expectOne(zonesUrl).flush({ assignments: [], summary: { cells: [], unzonedEventCount: 0 } });
    http.expectOne(advancedUrl).flush({ periods: [] });
  });

  it('un error no queda cacheado', () => {
    http.expectOne(advancedUrl).flush('falló', { status: 500, statusText: 'Error' });

    store.advanced().subscribe({ error: () => undefined });

    http.expectOne(advancedUrl).flush({ periods: [] });
  });

  it('envía lo capturado en el dispositivo una sola vez por visita', () => {
    http.expectOne(advancedUrl).flush({ periods: [] });
    store.invalidateAfterEventChange();

    store.events().subscribe();
    http.expectOne(eventsUrl).flush([]);

    expect(syncPendingEvents).toHaveBeenCalledTimes(1);
  });
});
