import '@angular/compiler';
import '../../features/home/testing/node-globals';
import { Injector } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subject, firstValueFrom } from 'rxjs';
import { UserContext } from '../../features/auth/types/auth.types';
import { LocalDatabaseService } from '../../features/local-database/services/local-database.service';
import { TokenService } from './token.service';
import { UserContextService } from './user-context.service';

describe('UserContextService.loadUserContext', () => {
  const context = (overrides: Partial<UserContext>): UserContext => ({
    userId: 'u1', email: 'a@b.c', role: 'COACH_ANALYST', club: null, activeDivisions: [], ...overrides
  });
  const cached = context({ firstName: 'Cacheado' });
  const fresh = context({ firstName: 'Fresco' });

  let response: Subject<UserContext>;
  let stored: UserContext | undefined;
  let saved: UserContext[];
  let service: UserContextService;

  beforeEach(() => {
    response = new Subject<UserContext>();
    stored = cached;
    saved = [];
    const injector = Injector.create({
      providers: [
        { provide: HttpClient, useValue: { get: () => response } },
        { provide: TokenService, useValue: { getPayload: () => ({ userId: 'u1' }), isAuthenticated: () => true } },
        {
          provide: LocalDatabaseService,
          useValue: { getUserContext: async () => stored, saveUserContext: async (value: UserContext) => { saved.push(value); } }
        },
        { provide: UserContextService, useClass: UserContextService, deps: [] }
      ]
    });
    service = injector.get(UserContextService);
  });

  const flush = () => new Promise<void>(resolve => setTimeout(resolve));

  it('pinta el contexto de Dexie sin esperar a /api/me', async () => {
    service.loadUserContext().subscribe();
    await flush();
    expect(service.userContext()).toBe(cached);
  });

  it('cuando llega /api/me reemplaza el contexto de Dexie y lo guarda', async () => {
    const loaded = firstValueFrom(service.loadUserContext());
    await flush();
    response.next(fresh);
    expect(await loaded).toBe(fresh);
    expect(service.userContext()).toBe(fresh);
    expect(saved).toEqual([fresh]);
  });

  it('no pisa con el valor de Dexie un contexto que ya llegó de /api/me', async () => {
    service.setContext(fresh);
    service.loadUserContext().subscribe();
    await flush();
    expect(service.userContext()).toBe(fresh);
  });

  it('un 401 de /api/me deja el contexto vacío aunque Dexie lo haya pintado', async () => {
    service.loadUserContext().subscribe();
    await flush();
    response.error({ status: 401 });
    expect(service.userContext()).toBeNull();
  });

  it('un 401 antes de que Dexie responda no deja el contexto guardado a la vista', async () => {
    service.loadUserContext().subscribe();
    response.error({ status: 401 });
    await flush();
    expect(service.userContext()).toBeNull();
  });

  it('sin contexto guardado espera a /api/me', async () => {
    stored = undefined;
    service.loadUserContext().subscribe();
    await flush();
    expect(service.userContext()).toBeNull();
  });
});
