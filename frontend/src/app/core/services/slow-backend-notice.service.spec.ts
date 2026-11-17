import '@angular/compiler';
import '../../features/home/testing/node-globals';
import { Injector, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ConnectivityService } from './connectivity.service';
import { SLOW_BACKEND_DELAY_MS, SLOW_BACKEND_MESSAGE, SLOW_BACKEND_NOTICE_GAP_MS, SlowBackendNoticeService } from './slow-backend-notice.service';
import { ToastService } from './toast.service';

describe('SlowBackendNoticeService', () => {
  const api = `${environment.apiUrl}/matches/division`;
  const online = signal(true);
  let notices: string[];
  let service: SlowBackendNoticeService;

  beforeEach(() => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(2026, 10, 17, 10, 0));
    notices = [];
    online.set(true);
    const injector = Injector.create({
      providers: [
        { provide: ToastService, useValue: { info: (message: string) => notices.push(message) } },
        { provide: ConnectivityService, useValue: { online } },
        { provide: SlowBackendNoticeService, useClass: SlowBackendNoticeService, deps: [] }
      ]
    });
    service = injector.get(SlowBackendNoticeService);
  });

  afterEach(() => jasmine.clock().uninstall());

  it('avisa si el pedido sigue sin respuesta pasado el umbral, y entrega la respuesta igual', () => {
    const response = new Subject<number>();
    const values: number[] = [];
    service.watch(api, response).subscribe(value => values.push(value));
    jasmine.clock().tick(SLOW_BACKEND_DELAY_MS);
    expect(notices).toEqual([SLOW_BACKEND_MESSAGE]);
    response.next(1);
    expect(values).toEqual([1]);
  });

  it('no avisa si la respuesta llega antes del umbral', () => {
    const response = new Subject<number>();
    service.watch(api, response).subscribe();
    jasmine.clock().tick(SLOW_BACKEND_DELAY_MS - 1);
    response.complete();
    jasmine.clock().tick(SLOW_BACKEND_DELAY_MS);
    expect(notices).toEqual([]);
  });

  it('avisa una sola vez por ventana aunque haya varios pedidos lentos', () => {
    service.watch(api, new Subject<number>()).subscribe();
    service.watch(api, new Subject<number>()).subscribe();
    jasmine.clock().tick(SLOW_BACKEND_DELAY_MS);
    expect(notices.length).toBe(1);
    jasmine.clock().tick(SLOW_BACKEND_NOTICE_GAP_MS);
    service.watch(api, new Subject<number>()).subscribe();
    jasmine.clock().tick(SLOW_BACKEND_DELAY_MS);
    expect(notices.length).toBe(2);
  });

  it('no avisa sin conexión: la demora no es del servidor', () => {
    online.set(false);
    service.watch(api, new Subject<number>()).subscribe();
    jasmine.clock().tick(SLOW_BACKEND_DELAY_MS);
    expect(notices).toEqual([]);
  });

  it('no avisa para el health check ni para otros orígenes', () => {
    service.watch(`${environment.apiUrl}/actuator/health`, new Subject<number>()).subscribe();
    service.watch('https://fonts.googleapis.com/css', new Subject<number>()).subscribe();
    jasmine.clock().tick(SLOW_BACKEND_DELAY_MS);
    expect(notices).toEqual([]);
  });
});
