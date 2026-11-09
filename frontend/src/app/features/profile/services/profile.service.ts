import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@environments/environment';
import { MessageResponse } from '../../../shared/types/shared-types';
import { ChangeLoginEmailRequest, UpdateContactRequest, UserProfile } from '../types/profile.types';

/** Perfil del usuario autenticado (/api/me/profile). */
@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/api/me/profile`;

  getProfile(): Observable<UserProfile> {
    return this.http.get<UserProfile>(this.apiUrl);
  }

  updateContact(request: UpdateContactRequest): Observable<UserProfile> {
    return this.http.patch<UserProfile>(`${this.apiUrl}/contact`, request);
  }

  /** Cambia el correo de acceso; después hay que volver a iniciar sesión. */
  changeLoginEmail(request: ChangeLoginEmailRequest): Observable<MessageResponse> {
    return this.http.patch<MessageResponse>(`${this.apiUrl}/login-email`, request);
  }
}
