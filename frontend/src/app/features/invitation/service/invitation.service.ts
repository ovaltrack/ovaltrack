import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '@environments/environment';
import { Observable } from 'rxjs';
import { ClubPlayer, InvitationSummary, InvitePlayerRequest } from '../types/invitation.types';

@Injectable({
  providedIn: 'root',
})
export class InvitationService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/api/invitation`;

  /** Jugadores que quien consulta puede invitar (admin: todo el club; entrenador: sus divisiones). */
  getPlayers(): Observable<ClubPlayer[]> {
    return this.http.get<ClubPlayer[]>(`${this.apiUrl}/players`);
  }

  /** Envía la invitación o la reenvía (el enlace anterior deja de servir). Devuelve la fila actualizada. */
  invite(request: InvitePlayerRequest): Observable<ClubPlayer> {
    return this.http.post<ClubPlayer>(this.apiUrl, request);
  }

  /** Valida el enlace y devuelve lo que muestra el formulario. No lo consume. */
  validate(token: string): Observable<InvitationSummary> {
    return this.http.post<InvitationSummary>(`${this.apiUrl}/validate`, { token });
  }
}
