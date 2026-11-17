import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { EMPTY, Observable, tap, catchError, of, from, merge, share, switchMap, takeUntil, ignoreElements } from 'rxjs';
import { environment } from '../../../environments/environment';
import { UserContext, UserRole } from '../../features/auth/types/auth.types';
import { ClubSummary, Division } from '../../features/division/types/division.types';
import { TokenService } from './token.service';
import { LocalDatabaseService } from 'src/app/features/local-database/services/local-database.service';

@Injectable({
  providedIn: 'root'
})
export class UserContextService {
  private readonly http = inject(HttpClient);
  private readonly tokenService = inject(TokenService);
  private readonly cache = inject(LocalDatabaseService);
  private readonly apiUrl = environment.apiUrl;

  private readonly contextSignal = signal<UserContext | null>(null);
  readonly userContext = this.contextSignal.asReadonly();
  readonly currentClub = computed<ClubSummary | null>(() => this.contextSignal()?.club ?? null);
  readonly currentRole = computed<UserRole | null>(() => this.contextSignal()?.role ?? null);
  readonly personId = computed<string | null>(() => this.contextSignal()?.personId ?? null);
  readonly activeDivisions = computed<Division[]>(() => this.contextSignal()?.activeDivisions ?? []);

  readonly fullName = computed<string>(() => {
    const ctx = this.contextSignal();
    if (!ctx) return '';
    const name = `${ctx.firstName || ''} ${ctx.lastName || ''}`.trim();
    return name || ctx.email;
  });

  readonly hasClub = computed<boolean>(() => {
    const ctx = this.contextSignal();
    return ctx?.role === 'ADMIN_OVALTRACK' || (ctx?.club !== null && ctx?.club !== undefined);
  });

  loadUserContext(): Observable<UserContext | null> {
    const tokenPayload = this.tokenService.getPayload();
    if (!tokenPayload || !this.tokenService.isAuthenticated()) {
      this.contextSignal.set(null);
      return of(null);
    }

    const fresh$ = this.revalidate(tokenPayload.userId).pipe(share());
    return merge(this.hydrateFromCache(tokenPayload.userId).pipe(takeUntil(fresh$)), fresh$);
  }

  /** Pinta el contexto guardado en Dexie sin esperar a `/api/me`; nunca pisa uno que ya llegó. */
  private hydrateFromCache(userId: string): Observable<never> {
    return from(this.cache.getUserContext(userId)).pipe(
      tap(cached => {
        if (cached && this.contextSignal() === null) this.contextSignal.set(cached);
      }),
      ignoreElements(),
      catchError(() => EMPTY),
    );
  }

  private revalidate(userId: string): Observable<UserContext | null> {
    return this.http.get<UserContext>(`${this.apiUrl}/api/me`).pipe(
      switchMap(ctx => from(this.cache.saveUserContext(ctx)).pipe(
        tap(() => this.contextSignal.set(ctx)),
        switchMap(() => of(ctx)),
      )),
      catchError(err => {
        console.error('Error al cargar el contexto de usuario:', err);

        if (err.status === 401 || err.status === 403) {
          this.contextSignal.set(null);
          return of(null);
        }

        return from(this.cache.getUserContext(userId)).pipe(
          tap(context => this.contextSignal.set(context ?? null)),
          switchMap(context => of(context ?? null)),
        );
      })
    );
  }


  /**
   * La guía ya arrancó: el backend no vuelve a marcarla pendiente en ningún dispositivo.
   * Si falla (sin conexión), solo queda el cambio local: en el peor caso la guía vuelve a arrancar una vez.
   */
  markTutorialSeen(): Observable<void> {
    const ctx = this.contextSignal();
    if (ctx?.tutorialPending) {
      this.contextSignal.set({ ...ctx, tutorialPending: false });
    }
    return this.http.post<void>(`${this.apiUrl}/api/me/tutorial/seen`, null).pipe(
      catchError(() => of(undefined))
    );
  }

  setContext(context: UserContext | null): void {
    this.contextSignal.set(context);
  }

  clear(): void {
    this.contextSignal.set(null);
  }
}
