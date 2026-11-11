import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin, of, switchMap } from 'rxjs';
import { DivisionPlayerService } from 'src/app/services/division-player.service';
import { DivisionService } from 'src/app/services/division.service';
import { PersonService } from 'src/app/services/person.service';
import { Division } from '../../division/types/division.types';
import { DivisionPlayerResponse } from '../type/division-player.types';
import { PersonResponse } from '../../person/types/person.types';
import { PaginationComponent } from '../../pagination/pagination.component';
import { ResultsPage } from '../../pagination/results-page';
import { ModalComponent } from '../../modal/modal.component';
import { ToastService } from 'src/app/core/services/toast.service';

@Component({
  selector: 'app-division-player-list',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, PaginationComponent, ModalComponent],
  templateUrl: './division-player-list.component.html',
  styleUrls: ['../../division/styles/division-lists.css', './division-player-list.component.css']
})
export class DivisionPlayerListComponent implements OnInit {
  private readonly divisionService = inject(DivisionService);
  private readonly personService = inject(PersonService);
  private readonly divisionPlayerService = inject(DivisionPlayerService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);

  division: Division | null = null;
  activePlayers: DivisionPlayerResponse[] = [];
  playerHistory: DivisionPlayerResponse[] = [];
  activePersons: PersonResponse[] = [];

  eliminandoId: string | null = null;
  playerToRemove: DivisionPlayerResponse | null = null;
  mostrarModalConfirmacion = false;

  // private autoDismissTimer: any = null;

  resultsPage: ResultsPage = <ResultsPage>{};
  currentPage: number = 1;
  activePlayersResultsPage: ResultsPage = <ResultsPage>{};
  activePlayersCurrentPage: number = 1;
  mostrarFormularioAsociacion = false;


  ngOnInit(): void {
    this.cargarJugadoresActivos();
  }

  mostrarJugadoresInactivos(): void {
    if (this.mostrarFormularioAsociacion) {
      this.mostrarFormularioAsociacion = false;
      return;
    }

    if (!this.division?.clubId) {
      this.toastService.show('error', 'No se pudo obtener los jugadores del club porque el ID del club no está disponible.', 'Error');
      return;
    }
    this.cerrarHistorial();
    this.cargarJugadoresDisponibles(1);
  }

  cargarJugadoresDisponibles(page: number): void {
    if (!this.division?.clubId) {
      this.toastService.show('error', 'No se pudo obtener los jugadores del club porque el ID del club no está disponible.', 'Error');
      return;
    }

    this.currentPage = page;
    this.personService.getPagedInactivePlayersByClubAndDivision(this.division.clubId, this.division.id, page, 10).subscribe({
      next: (response: ResultsPage) => {
        this.resultsPage = response;
        this.mostrarFormularioAsociacion = true;
      },
      error: (err) => {
        console.error('Error al cargar personas del club', err);
        this.toastService.show('error', 'No se pudieron obtener las personas del club.', 'Error');
      }
    });
  }

  onPageChangeRequested(page: number): void {
    this.cargarJugadoresDisponibles(page);
  }

  crearAsociacion(personId: string, position: string, jerseyNumber?: number): void {
    if (!personId || !position) {
      this.toastService.show('warning', 'Por favor selecciona una persona y define una posición.', 'Datos incompletos');
      return
    }

    const creationDto = {
      divisionId: this.division?.id,
      personId,
      position,
      jerseyNumber
    };

    this.divisionPlayerService.registerPlayer(creationDto).subscribe({
      next: () => {
        this.toastService.show('success', 'Jugador asociado a la división.', '¡Excelente!');
        this.cargarJugadoresActivos();
        this.cargarJugadoresDisponibles(this.currentPage);
      },
      error: (err) => {
        console.error('Error al asociar jugador a la división', err);
        const msg = typeof err.error === 'string'
          ? err.error
          : (err.error?.message || 'Ocurrió un conflicto o error al crear la asociación.');
        this.toastService.show('error', msg, 'Error');
      }
    });
  }

  mostrarAsociaciones(player: DivisionPlayerResponse): void {
    const divisionId = this.division?.id;
    if (!divisionId) {
      this.toastService.show('error', 'No se pudo obtener el historial del jugador porque la división no está disponible.', 'Error');
      return;
    }

    this.playerHistory = [];
    this.divisionPlayerService.getByDivisionIdAndPersonId(divisionId, player.personId).subscribe({
      next: (history) => {
        this.playerHistory = history;
      },
      error: (err) => {
        console.error('Error al cargar el historial del jugador', err);
        this.playerHistory = [];
        const msg = typeof err.error === 'string'
          ? err.error
          : (err.error?.message || 'No se pudo cargar el historial del jugador.');
        this.toastService.show('error', msg, 'Error');
      }
    });
  }

  cerrarHistorial(): void {
    this.playerHistory = [];
  }

  cargarJugadoresActivos(page: number = this.activePlayersCurrentPage): void {
    this.route.paramMap.pipe(
      switchMap((params) => {
        const divisionId = params.get('divisionId');
        if (!divisionId) {
          throw new Error('No se recibió el ID de la división.');
        }

        return forkJoin({
          division: this.divisionService.getDivisionById(divisionId),
          activePlayersPage: this.divisionPlayerService.getActiveByDivisionId(divisionId, page, 10)
        });
      }),
      switchMap(({ division, activePlayersPage }) => {
        const activePlayers = activePlayersPage.content as DivisionPlayerResponse[];
        if (activePlayers.length === 0) {
          return of({ division, activePlayersPage, activePlayers, activePersons: [] as PersonResponse[] });
        }

        return forkJoin(
          activePlayers.map(player => this.personService.getPersonById(player.personId))
        ).pipe(
          switchMap((activePersons) => of({ division, activePlayersPage, activePlayers, activePersons }))
        );
      })
    ).subscribe({
      next: ({ division, activePlayersPage, activePlayers, activePersons }) => {
        this.division = division;
        this.activePlayersResultsPage = activePlayersPage;
        this.activePlayersCurrentPage = activePlayersPage.number + 1;
        this.activePlayers = activePlayers;
        this.activePersons = activePersons;
      },
      error: (err) => {
        console.error('Error al cargar los jugadores de la división', err);
        this.activePlayersResultsPage = <ResultsPage>{};
        this.activePlayers = [];
        this.activePersons = [];

        if (err.status === 403) {
          const msg = typeof err.error === 'string'
            ? err.error
            : (err.error?.message || 'Acceso denegado: no tienes permisos para acceder a esta división.');
          this.router.navigate(['/divisions'], {
            state: { errorMessage: msg, errorTitle: 'Acceso denegado' }
          });
          return;
        }

        if (err.status === 404) {
          this.router.navigate(['/divisions'], {
            state: { errorMessage: 'División no encontrada.', errorTitle: 'No encontrado' }
          });
          return;
        }

        this.toastService.show('error', 'No se pudieron cargar los jugadores de la división.', 'Error');
      }
    });
  }

  onActivePlayersPageChangeRequested(page: number): void {
    this.cargarJugadoresActivos(page);
  }

  desasociarJugador(player: DivisionPlayerResponse): void {
    if (player.endDate || this.eliminandoId) {
      return;
    }
    this.cerrarHistorial();
    this.playerToRemove = player;
    this.mostrarModalConfirmacion = true;
  }

  cancelarDesasociacion(): void {
    if (!this.eliminandoId) {
      this.mostrarModalConfirmacion = false;
      this.playerToRemove = null;
    }
  }

  confirmarDesasociacion(): void {
    if (!this.playerToRemove) {
      return;
    }

    this.eliminandoId = this.playerToRemove.id;
    this.divisionPlayerService.remove(this.playerToRemove.id).subscribe({
      next: () => {
        this.eliminandoId = null;
        this.mostrarModalConfirmacion = false;
        this.playerToRemove = null;
        this.toastService.show('success', 'El jugador fue desasociado correctamente.', 'Desasociado');
        this.cargarJugadoresActivos();
      },
      error: (err) => {
        console.error('Error al desasociar jugador', err);
        this.eliminandoId = null;
        this.mostrarModalConfirmacion = false;
        this.playerToRemove = null;
        const msg = typeof err.error === 'string'
          ? err.error
          : (err.error?.message || 'No se pudo desasociar el jugador.');
        this.toastService.show('error', msg, 'Error');
      }
    });
  }
}

