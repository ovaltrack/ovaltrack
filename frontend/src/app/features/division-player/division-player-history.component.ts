import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { DivisionPlayerService } from '../../services/division-player.service';
import { DivisionPlayerResponse } from './type/division-player.types';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { DestroyRef, inject as angularInject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-division-player-history',
  standalone: true,
  imports: [CommonModule],
  styleUrls: ['../division/styles/division-lists.css', '../division/division-history.component.css'],
  template: `
    <main class="layout-container page history-page">
      <header class="hud">
        <div class="hud-text">
          <p class="label-mono hud-label">Plantel • Historial</p>
          <h1 class="hud-title">Historial de jugadores</h1>
          <p class="hud-subtitle">Trayectoria de cada jugador dentro de la división</p>
        </div>
        <div class="hud-actions">
          <button type="button" class="btn btn-outline" (click)="volver()">Volver</button>
        </div>
      </header>
      <section class="history-search">
        <label for="player-search">Buscar jugador</label>
        <input id="player-search" class="form-control" [value]="search" (input)="buscar($any($event.target).value)" placeholder="Nombre, apellido o email" />
      </section>
      <p class="empty-state" *ngIf="!people.content.length">No hay personas con historial en esta división.</p>
      <ul class="history-people" *ngIf="people.content.length">
        <li *ngFor="let person of people.content">
          <button type="button" class="history-person" (click)="seleccionar(person)">
            <span class="history-person-info">
              <span class="history-person-avatar">{{ person.firstName.charAt(0).toUpperCase() }}</span>
              <span class="history-person-name">{{ person.firstName }} {{ person.lastName }}</span>
            </span>
            <span class="history-person-status" [class.active]="person.active" [class.finished]="!person.active">
              {{ person.active ? 'Activo' : 'Finalizado' }}
            </span>
          </button>
          <section *ngIf="selectedPersonId === person.personId && history.length" class="history-detail">
            <header class="history-detail-header"><h2>Asociaciones del jugador</h2></header>
            <div class="table-responsive">
              <table>
                <thead><tr><th>Posición</th><th>Camiseta</th><th>Inicio</th><th>Fin</th><th>Estado</th></tr></thead>
                <tbody><tr *ngFor="let item of history">
                  <td>{{ item.position }}</td><td>{{ item.jerseyNumber || '--' }}</td>
                  <td>{{ item.startDate | date:'dd/MM/yyyy' }}</td>
                  <td>{{ item.endDate ? (item.endDate | date:'dd/MM/yyyy') : 'Actualidad' }}</td>
                  <td>{{ item.endDate ? 'Finalizado' : 'Activo' }}</td>
                </tr></tbody>
              </table>
            </div>
          </section>
        </li>
      </ul>
    </main>
  `
})
export class DivisionPlayerHistoryComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(DivisionPlayerService);
  private readonly location = inject(Location);
  private readonly destroyRef = angularInject(DestroyRef);
  private readonly searchChanges = new Subject<string>();
  divisionId = '';
  search = '';
  people = { content: [] as Array<{ personId: string; firstName: string; lastName: string; active: boolean }> };
  history: DivisionPlayerResponse[] = [];
  selectedPersonId: string | null = null;
  ngOnInit(): void {
    this.searchChanges.pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.cargar());
    this.route.paramMap.subscribe(params => {
      this.divisionId = params.get('divisionId') || '';
      this.cargar();
      const personId = params.get('personId');
      if (personId) this.cargarDetalle(personId);
    });
  }
  buscar(value: string): void { this.search = value; this.searchChanges.next(value); }
  volver(): void { this.location.back(); }
  cargar(): void { if (this.divisionId) this.service.getHistoryPeople(this.divisionId, 1, 50, this.search).subscribe(p => this.people = p as typeof this.people); }
  seleccionar(person: { personId: string }): void {
    if (this.selectedPersonId === person.personId) {
      this.selectedPersonId = null;
      this.history = [];
      return;
    }
    this.selectedPersonId = person.personId;
    this.history = [];
    this.cargarDetalle(person.personId);
  }
  private cargarDetalle(personId: string): void {
    this.service.getByDivisionIdAndPersonId(this.divisionId, personId).subscribe(h => {
      if (this.selectedPersonId === personId) this.history = h;
    });
  }
}
