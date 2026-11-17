import '@angular/compiler';
import '../../features/home/testing/node-globals';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injector } from '@angular/core';
import { Subject } from 'rxjs';
import { UserContext } from '../../features/auth/types/auth.types';
import { LocalDatabaseService } from '../../features/local-database/services/local-database.service';
import { TokenService } from './token.service';
import { UserContextService } from './user-context.service';

describe('UserContextService · contexto guardado mientras responde /api/me', () => {
  const context = (firstName: string): UserContext => ({
    userId: 'u1', email: 'coach@example.com', role: 'COACH_ANALYST', firstName, club: null, activeDivisions: []
  });

  let response: Subject<UserContext>;
  let cached: UserContext | undefined;
  let service: UserContextService;

  /** Deja correr las promesas pendientes (la lectura de Dexie). */
  const flush = () => new Promise(resolve => setTimeout(resolve));

  beforeEach(() => {
    response = new Subject<UserContext>();
    cached = context('Guardado');
    const injector = Injector.create({
      providers: [
        { provide: HttpClient, useValue: { get: () => response } },
        { provide: TokenService, useValue: { getPayload: () => ({ userId: 'u1' }), isAuthenticated: () => true } },
        { provide: LocalDatabaseService, useValue: { getUserContext: () => Promise.resolve(cached), saveUserContext: () => Promise.resolve() } },
        { provide: UserContextService, useClass: UserContextService, deps: [] }
      ]
    });
    service = injector.get(UserContextService);
  });

  it('muestra el contexto guardado mientras la red no responde, y después el del servidor', async () => {
    const emitted: (UserContext | null)[] = [];
    service.loadUserContext().subscribe(ctx => emitted.push(ctx));
    await flush();
    expect(service.userContext()?.firstName).toBe('Guardado');
    expect(emitted).toEqual([]);

    response.next(context('Servidor'));
    response.complete();
    await flush();
    expect(service.userContext()?.firstName).toBe('Servidor');
    expect(emitted.map(ctx => ctx?.firstName)).toEqual(['Servidor']);
  });

  it('si el servidor ya respondió, el guardado no pisa al del servidor', async () => {
    service.loadUserContext().subscribe();
    response.next(context('Servidor'));
    await flush();
    expect(service.userContext()?.firstName).toBe('Servidor');
  });

  it('un 401 deja la sesión sin contexto aunque haya uno guardado', async () => {
    service.loadUserContext().subscribe();
    response.error(new HttpErrorResponse({ status: 401 }));
    await flush();
    expect(service.userContext()).toBeNull();
  });
});
