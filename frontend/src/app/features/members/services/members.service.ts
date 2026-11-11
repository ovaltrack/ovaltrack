import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '@environments/environment';
import { BackendUserResponse, Member, UserRole } from '../types/members.types';

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
          .map(u => ({
            id: u.id,
            personId: u.personId || u.person?.id || u.id,
            email: u.email || u.loginEmail || '',
            firstName: u.firstName || u.person?.firstName || '',
            lastName: u.lastName || u.person?.lastName || '',
            role: u.role,
            active: u.active ?? true,
            jersey: undefined,
            isProtected: u.role === 'ADMIN_CLUB' || u.role === 'ADMIN_OVALTRACK'
          }))
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
}
