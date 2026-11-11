import { Component, OnInit, inject, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { switchMap, of, catchError } from 'rxjs';
import { UserContextService } from 'src/app/core/services/user-context.service';
import { DivisionService } from 'src/app/services/division.service';
import { ClubService } from 'src/app/services/club.service';
import { Division, ClubSummary } from './types/division.types';
import { ToastService } from 'src/app/core/services/toast.service';

@Component({
  selector: 'app-division-list',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './division-list.component.html',
  styleUrls: ['./styles/division-lists.css', './division-list.component.css']
})
export class DivisionListComponent implements OnInit {
  private readonly divisionService = inject(DivisionService);
  private readonly clubService = inject(ClubService);
  private readonly userContextService = inject(UserContextService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toastService = inject(ToastService);

  myClub: ClubSummary | null = null;
  divisions: Division[] = [];
  cargando: boolean = false;

  ngOnInit(): void {
    const navState = history.state;
    if (navState?.errorMessage) {
      this.toastService.show('error', navState.errorMessage, navState.errorTitle || 'Acceso denegado');
      history.replaceState({ ...navState, errorMessage: undefined, errorTitle: undefined }, '');
    }
    this.cargarClubYDivisiones();
  }

  getClubCrest(): string {
    const name = this.myClub?.name?.trim();
    return name ? name.charAt(0).toUpperCase() : 'O';
  }

  formatCategory(category?: string): string {
    if (!category) return 'Sin categoría';
    const mapping: Record<string, string> = {
      U14: 'M14',
      U15: 'M15',
      U16: 'M16',
      U18: 'M18',
      U20: 'M20',
      SENIOR: 'Primera',
      VETERAN: 'Veteranos'
    };
    return mapping[category] || category;
  }

  formatGender(gender?: string): string {
    if (!gender) return 'General';
    const mapping: Record<string, string> = {
      MALE: 'Masculino',
      FEMALE: 'Femenino'
    };
    return mapping[gender] || gender;
  }

  get esCoach(): boolean {
    return this.userContextService.currentRole() === 'COACH_ANALYST';
  }

  cargarClubYDivisiones(): void {
    this.cargando = true;

    if (this.userContextService.currentRole() === 'COACH_ANALYST') {
      this.myClub = this.userContextService.currentClub();
      this.divisions = this.userContextService.activeDivisions();
      this.cargando = false;
      return;
    }

    this.clubService.getMyClub()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap((club: ClubSummary) => {
          this.myClub = club;
          if (!club?.id) {
            return of([]);
          }
          return this.divisionService.getDivisiones(club.id).pipe(
            catchError((err) => {
              console.error('Error al cargar las divisiones', err);
              this.toastService.show('error', 'No se pudieron cargar las divisiones de tu club.', 'Error de carga');
              return of([]);
            })
          );
        }),
        catchError((err) => {
          console.error('Error al cargar el club del usuario', err);
          this.toastService.show('error', 'No se pudo obtener la información de tu club.', 'Error de carga');
          return of([]);
        })
      )
      .subscribe((divisions: Division[]) => {
        this.divisions = divisions;
        this.cargando = false;
      });
  }
}