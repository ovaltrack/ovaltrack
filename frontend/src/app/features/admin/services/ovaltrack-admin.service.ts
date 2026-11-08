import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@environments/environment';
import { MessageResponse } from 'src/app/shared/types/shared-types';
import { Club, ClubStatus } from '../../club/types/club.types';
import { UserClubRegistration } from '../types/ovaltrack-admin.types';

@Injectable({ providedIn: 'root' })
export class OvalTrackAdminService {
    private readonly http = inject(HttpClient);
    private readonly apiUrl = `${environment.apiUrl}/api/admin/ovaltrack`;

    /* ---------- Listados ---------- */

    /** GET /clubs/pending */
    getPendingClubs(): Observable<Club[]> {
        return this.http.get<Club[]>(`${this.apiUrl}/clubs/pending`);
    }

    /** GET /users/pending */
    getPendingUsers(): Observable<UserClubRegistration[]> {
        return this.http.get<UserClubRegistration[]>(`${this.apiUrl}/users/pending`);
    }

    /** GET /users: sin parámetro devuelve activas e inactivas; con `active` filtra. */
    getUsers(active?: boolean): Observable<UserClubRegistration[]> {
        let params = new HttpParams();
        if (active !== undefined) {
            params = params.set('active', active);
        }
        return this.http.get<UserClubRegistration[]>(`${this.apiUrl}/users`, { params });
    }

    /** GET /clubs: sin parámetro devuelve ACTIVE y REJECTED; con `status` filtra. */
    getClubs(status?: ClubStatus): Observable<Club[]> {
        let params = new HttpParams();
        if (status) {
            params = params.set('status', status);
        }
        return this.http.get<Club[]>(`${this.apiUrl}/clubs`, { params });
    }

    /* ---------- Clubes ---------- */

    /** POST /clubs/{clubId}/approve */
    approveClub(clubId: string, adminUserId: string): Observable<MessageResponse> {
        const params = new HttpParams().set('adminUserId', adminUserId);

        return this.http.post<MessageResponse>(`${this.apiUrl}/clubs/${clubId}/approve`, null, { params });
    }

    /** POST /clubs/{clubId}/reject: rechaza una solicitud o desactiva un club activo (queda REJECTED). */
    rejectClub(clubId: string): Observable<MessageResponse> {
        return this.http.post<MessageResponse>(`${this.apiUrl}/clubs/${clubId}/reject`, null);
    }

    /** POST /clubs/{clubId}/reactivate: vuelve a ACTIVE un club REJECTED (su administrador debe estar activo). */
    reactivateClub(clubId: string): Observable<MessageResponse> {
        return this.http.post<MessageResponse>(`${this.apiUrl}/clubs/${clubId}/reactivate`, null);
    }

    /* ---------- Cuentas ---------- */

    /** POST /users/{userId}/approve */
    approveAccount(userId: string): Observable<MessageResponse> {
        return this.http.post<MessageResponse>(`${this.apiUrl}/users/${userId}/approve`, null);
    }

    /** POST /users/{userId}/reject (comentario opcional) */
    rejectAccount(userId: string): Observable<MessageResponse> {
        return this.http.post<MessageResponse>(`${this.apiUrl}/users/${userId}/reject`, null);
    }

    activateAccount(userId: string): Observable<MessageResponse> {
        return this.http.post<MessageResponse>(`${this.apiUrl}/${userId}/activate`, null);
    }
    deactivateAccount(userId: string): Observable<MessageResponse> {
        return this.http.delete<MessageResponse>(`${this.apiUrl}/${userId}/deactivate`);
    }

}