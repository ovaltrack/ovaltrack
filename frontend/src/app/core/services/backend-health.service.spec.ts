import { TestBed, discardPeriodicTasks, fakeAsync, tick } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { BACKEND_HEALTH_INTERVAL_MS, BackendHealthService } from './backend-health.service';
import { ConnectivityService } from './connectivity.service';

describe('BackendHealthService', () => {
  const online = signal(true);
  let httpMock: HttpTestingController;

  beforeEach(() => {
    online.set(true);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ConnectivityService, useValue: { online } },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('consulta el health check del backend en cada intervalo', fakeAsync(() => {
    TestBed.inject(BackendHealthService);

    tick(BACKEND_HEALTH_INTERVAL_MS);
    httpMock.expectOne(req => req.url.endsWith('/actuator/health')).flush({ status: 'UP' });
    tick(BACKEND_HEALTH_INTERVAL_MS);
    httpMock.expectOne(req => req.url.endsWith('/actuator/health')).flush({ status: 'UP' });

    discardPeriodicTasks();
  }));

  it('sin conexión no hace peticiones', fakeAsync(() => {
    online.set(false);
    TestBed.inject(BackendHealthService);

    tick(BACKEND_HEALTH_INTERVAL_MS * 2);
    httpMock.expectNone(req => req.url.endsWith('/actuator/health'));

    discardPeriodicTasks();
  }));

  it('no acumula peticiones si el backend todavía no respondió', fakeAsync(() => {
    TestBed.inject(BackendHealthService);

    tick(BACKEND_HEALTH_INTERVAL_MS * 3);
    const pending = httpMock.match(req => req.url.endsWith('/actuator/health'));
    expect(pending.length).toBe(1);
    pending[0].flush({ status: 'UP' });

    discardPeriodicTasks();
  }));
});
