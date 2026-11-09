import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthResponse, ClubRegistrationDTO, PasswordResetLink, CurrentUserSession, LoginRequest, MemberRegistrationDTO, TokenPayload, UserRole } from '../types/auth.types';
import { environment } from '@environments/environment';
import { TokenService } from '../../../core/services/token.service';
import { UserContextService } from '../../../core/services/user-context.service';
import { ToastService } from '../../../core/services/toast.service';
import { LocalDatabaseService } from '../../local-database/services/local-database.service';
import { Observable, tap } from 'rxjs';
import { MessageResponse } from 'src/app/shared/types/shared-types';
import { RegisterFromInvitationRequest } from '../../invitation/types/invitation.types';
import { SESSION_CLEANUP, runSessionCleanups } from '../../../core/session/session-cleanup';
@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private readonly apiUrl = `${environment.apiUrl}/api/auth`;
  private readonly tokenService = inject(TokenService);
  private readonly userContextService = inject(UserContextService);
  private readonly router = inject(Router);
  private readonly cache = inject(LocalDatabaseService);
  private readonly toastService = inject(ToastService);
  private readonly sessionCleanups = inject(SESSION_CLEANUP, { optional: true }) ?? [];
  private currentUserSignal = signal<CurrentUserSession | null>(this.loadUserFromToken());
  readonly currentUser = this.currentUserSignal.asReadonly();
  /** Rol vigente: el del contexto (`/api/me`) y, mientras no cargó, el del token. */
  readonly effectiveRole = computed<UserRole | null>(
    () => this.userContextService.currentRole() ?? this.currentUser()?.role ?? null
  );

  constructor(private http: HttpClient) {
    if (this.tokenService.isAuthenticated()) {
      this.userContextService.loadUserContext().subscribe();
    }
  }

  registerClub(data: ClubRegistrationDTO): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.apiUrl}/register-club`, data);
  }
  registerMember(data: MemberRegistrationDTO): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.apiUrl}/register`, data);
  }
  /** Siempre responde lo mismo, exista o no la cuenta. */
  requestPasswordReset(email: string): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.apiUrl}/password-reset/request`, { email });
  }

  validatePasswordResetToken(token: string): Observable<PasswordResetLink> {
    return this.http.post<PasswordResetLink>(`${this.apiUrl}/password-reset/validate`, { token });
  }

  /** Cambia la contraseña y cierra las sesiones abiertas de la cuenta. */
  confirmPasswordReset(token: string, password: string): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.apiUrl}/password-reset/confirm`, { token, password });
  }

  login(credentials: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, credentials).pipe(
      tap(res => this.handleAuthSuccess(res.token))
    );
  }

  getErrorMessage(error: unknown, action: 'login' | 'register'): string {
    if (!(error instanceof HttpErrorResponse)) {
      return 'Ocurrió un error inesperado. Inténtalo nuevamente.';
    }

    if (error.status === 0) {
      return 'No se pudo conectar con el servidor. Inténtalo nuevamente.';
    }

    if (error.status === 400) {
      // El backend no distingue correo inexistente de contraseña incorrecta, y el mensaje tampoco
      if (action === 'login') return 'Correo o contraseña incorrectos.';
      return this.readBackendMessage(error) ?? 'Los datos enviados no son válidos.';
    }

    if (error.status === 401 || error.status === 403) {
      const msg = this.readBackendMessage(error);
      if (msg) return msg;
      return action === 'login'
        ? 'El correo o la contraseña no son correctos.'
        : 'No tienes permisos para realizar esta acción.';
    }

    if (error.status === 409) {
      return this.readBackendMessage(error) ?? 'Ya existe un usuario con ese correo.';
    }

    return 'No se pudo completar la operación. Inténtalo nuevamente.';
  }
  logout(): void {
    runSessionCleanups(this.sessionCleanups);
    this.userContextService.clear();
    this.tokenService.removeToken();
    this.currentUserSignal.set(null);
    void this.clearLocalData();
    this.router.navigate(['/auth/login']);
  }

  private async clearLocalData(): Promise<void> {
    try {
      const keptChanges = await this.cache.clearCachedDataOnLogout();
      if (keptChanges > 0) {
        this.toastService.warning(
          `Quedan ${keptChanges} cambios sin sincronizar guardados en este dispositivo. Se enviarán al volver a iniciar sesión con conexión.`,
        );
      }
    } catch (error) {
      console.error('Could not clear local data on logout:', error);
    }
  }

  private handleAuthSuccess(token: string): void {
    this.tokenService.setToken(token);
    this.currentUserSignal.set(this.loadUserFromToken());
    this.userContextService.loadUserContext().subscribe();
  }

  private loadUserFromToken(): CurrentUserSession | null {
    if (!this.tokenService.isAuthenticated()) {
      return null;
    }
    const payload: TokenPayload | null = this.tokenService.getPayload();
    if (!payload) return null;

    return {
      id: payload.userId,
      email: payload.sub,
      role: payload.role
    };
  }

  private readBackendMessage(error: HttpErrorResponse): string | null {
    if (typeof error.error === 'string' && error.error.trim()) {
      return error.error;
    }

    if (error.error && typeof error.error.message === 'string') {
      return error.error.message;
    }

    return null;
  }
  registerFromInvitation(request: RegisterFromInvitationRequest): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.apiUrl}/register/invitation`, request);
  }

  public getUserRole(): string | null {
    const user = this.loadUserFromToken();
    return user ? user.role : null;
  }

}
