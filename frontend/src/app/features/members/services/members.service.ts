import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '@environments/environment';
import { BackendUserResponse, ClubInfo, Member, UserRole } from '../types/members.types';

@Injectable({
  providedIn: 'root'
})
export class MembersService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  getMembers(): Observable<Member[]> {
    return this.http.get<BackendUserResponse[]>(`${this.baseUrl}/club/my-club/members`).pipe(
      map(users =>
        users
          .filter(u => u.role !== 'ADMIN_OVALTRACK')
          .map(u => {
            return {
              id: u.personId || u.id,
              personId: u.personId || u.person?.id || u.id,
              email: u.email || u.loginEmail || u.person?.contactEmail || '',
              firstName: u.firstName || u.person?.firstName || '',
              lastName: u.lastName || u.person?.lastName || '',
              role: u.role || 'NO_ROLE',
              active: u.active ?? true,
              jersey: undefined,
              isProtected: u.role === 'ADMIN_CLUB' || u.role === 'ADMIN_OVALTRACK',
              
              // Como por ahora el backend solo trae usuarios registrados, todos tienen ID
              userId: u.id 
            };
          })
      )
    );
  }

  updateUserRole(userId: string, newRole: UserRole): Observable<any> {
    return this.http.patch(`${this.baseUrl}/user/${userId}/role`, { role: newRole });
  }

  activateUser(userId: string): Observable<BackendUserResponse> {
    return this.http.patch<BackendUserResponse>(`${this.baseUrl}/user/${userId}/activar`, {});
  }
  
  deactivateUser(userId: string): Observable<BackendUserResponse> {
    return this.http.patch<BackendUserResponse>(`${this.baseUrl}/user/${userId}/baja`, {});
  }

  updateBatchRoles(updates: Array<{ userId: string; newRole: UserRole }>): Observable<any[]> {
    if (!updates || updates.length === 0) {
      return of([]);
    }
    return forkJoin(updates.map(u => this.updateUserRole(u.userId, u.newRole)));
  }

  getMyClub(): Observable<ClubInfo> {
    return this.http.get<ClubInfo>(`${this.baseUrl}/club/my-club`);
  }

  inviteMember(personId: string, email: string): Observable<any> {
    const payload = { personId, email };
    // 2. CORRECCIÓN DE URL: Tenías `${this}/invite` que iba a dar error de [object Object]
    return this.http.post(`${this.baseUrl}/invite`, payload); 
  }

  updatePerson(personId: string, data: any): Observable<any> {
    return this.http.put(`${this.baseUrl}/person/${personId}`, data);
  }
}