import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { switchMap } from 'rxjs';
import { DivisionCoachService, DivisionHistoryPerson } from '../../services/division-coach.service';
import { DivisionCoachResponse } from './types/division-coach.types';

@Component({
  selector: 'app-division-coach-history',
  standalone: true,
  imports: [CommonModule],
  styleUrls: ['../division/styles/division-lists.css', '../division/division-history.component.css'],
  template: `
    <main class="layout-container page history-page">
      <header class="hud">
        <div class="hud-text">
          <p class="label-mono hud-label">Staff técnico • Historial</p>
          <h1 class="hud-title">Historial de entrenadores</h1>
          <p class="hud-subtitle">Trayectoria del cuerpo técnico dentro de la división</p>
        </div>
        <div class="hud-actions">
          <button type="button" class="btn btn-outline" (click)="volver()">Volver</button>
        </div>
      </header>
      <section class="history-search">
        <label for="coach-search">Buscar entrenador</label>
        <input id="coach-search" class="form-control" [value]="search" (input)="search = $any($event.target).value; cargar()" placeholder="Nombre, apellido o email" />
      </section>
      <p class="empty-state" *ngIf="people.length === 0">No hay personas con historial en esta división.</p>
      <ul class="history-people" *ngIf="people.length">
        <li *ngFor="let person of people">
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
            <header class="history-detail-header"><h2>Asociaciones del entrenador</h2></header>
            <div class="table-responsive">
              <table>
                <thead><tr><th>Inicio</th><th>Fin</th><th>Estado</th></tr></thead>
                <tbody><tr *ngFor="let item of history">
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
export class DivisionCoachHistoryComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(DivisionCoachService);
  private readonly location = inject(Location);
  divisionId = '';
  search = '';
  people: DivisionHistoryPerson[] = [];
  history: DivisionCoachResponse[] = [];
  selectedPersonId: string | null = null;

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      this.divisionId = params.get('divisionId') || '';
      this.cargar();
      const personId = params.get('personId');
      if (personId) this.cargarDetalle(personId);
    });
  }
  cargar(): void { if (this.divisionId) this.service.getHistoryPeople(this.divisionId, this.search).subscribe(p => this.people = p); }
  seleccionar(person: DivisionHistoryPerson): void {
    if (this.selectedPersonId === person.personId) {
      this.selectedPersonId = null;
      this.history = [];
      return;
    }
    this.selectedPersonId = person.personId;
    this.history = [];
    this.cargarDetalle(person.personId);
  }
  volver(): void { this.location.back(); }
  private cargarDetalle(personId: string): void {
    this.service.getHistoryByDivisionIdAndPersonId(this.divisionId, personId).subscribe(h => {
      if (this.selectedPersonId === personId) this.history = h;
    });
  }
}
