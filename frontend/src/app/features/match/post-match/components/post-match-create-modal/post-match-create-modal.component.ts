import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatchReviewStore } from '../../store/match-review.store';
import { EventService } from '../../../services/event.service';
import { ToastService } from 'src/app/core/services/toast.service';
import { Possession } from '../../../types/live-capture.types';
import { BackendEventCreationRequest, MatchTimelineEventResponse } from '../../../types/event.types';
import { EventFormComponent, EventFormData } from '../event-form/event-form.component';
import { EventPrefillHints, buildEventPrefill } from '../../utils/event-prefill';
import { toMatchTimeSeconds, validateEventTime } from '../../utils/event-time';
import { NextEvent, nextEvents } from '../../utils/follow-up';

@Component({
  selector: 'app-post-match-create-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, EventFormComponent],
  templateUrl: './post-match-create-modal.component.html',
  styleUrl: './post-match-create-modal.component.css'
})
export class PostMatchCreateModalComponent implements OnChanges {
  readonly store = inject(MatchReviewStore);
  private readonly eventService = inject(EventService);
  private readonly toastService = inject(ToastService);

  @Input() isOpen = false;
  @Input() matchId = '';

  @Output() close = new EventEmitter<void>();
  @Output() created = new EventEmitter<MatchTimelineEventResponse>();

  readonly isSubmitting = signal<boolean>(false);

  /** Valores iniciales del formulario según el filtro de período y el evento seleccionado al abrir. */
  readonly initialData = signal<EventFormData | null>(null);
  readonly prefillHints = signal<EventPrefillHints | null>(null);

  /** Opciones del catálogo para continuar después de guardar (solo si hay más de una); null = formulario de alta. */
  readonly nextChoices = signal<NextEvent[] | null>(null);
  /** El formulario abierto es un evento propuesto por el catálogo: se puede omitir. */
  readonly isFollowUp = signal<boolean>(false);
  /** Evento recién guardado del que sale lo que sigue. */
  followUpName = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] && this.isOpen) {
      this.applyPrefill();
    }
  }

  private applyPrefill(): void {
    this.resetForm();
    const prefill = buildEventPrefill(this.store.filters().period, this.store.selectedEvent());
    if (!prefill) {
      this.initialData.set(null);
      this.prefillHints.set(null);
      return;
    }
    this.period = prefill.period;
    if (prefill.minute !== null) {
      this.minute = prefill.minute;
      this.second = prefill.second;
    }
    this.initialData.set({
      eventTypeId: '',
      teamPossession: 'OWN',
      playerId: null,
      period: this.period,
      minute: this.minute,
      second: this.second
    });
    this.prefillHints.set(prefill.hints);
  }

  // Form State
  eventTypeId = '';
  period: 1 | 2 = 1;
  minute: number | null = 1;
  second: number | null = 0;
  possession: Possession = 'OWN';
  playerId = '';
  attributes: Record<string, unknown> | null = null;
  isFormValid = true;

  onFormChange(data: EventFormData): void {
    this.eventTypeId = data.eventTypeId;
    this.possession = data.teamPossession;
    this.playerId = data.playerId || '';
    if (data.period !== undefined) this.period = data.period;
    if (data.minute !== undefined) this.minute = data.minute;
    if (data.second !== undefined) this.second = data.second;
    this.attributes = data.attributes ?? null;
    this.isFormValid = data.isValid !== false;
  }

  onPossessionChange(): void {
    if (this.possession === 'OPPONENT') {
      this.playerId = '';
    }
  }

  onClose(): void {
    if (this.isSubmitting()) return;
    this.close.emit();
  }

  get closeLabel(): string {
    if (this.nextChoices()) return 'Nada más';
    return this.isFollowUp() ? 'Omitir' : 'Cancelar';
  }

  get formattedDisplayTime(): string {
    const min = Math.max(0, Math.floor(this.minute ?? 0));
    const sec = Math.max(0, Math.min(59, Math.floor(this.second ?? 0)));
    return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  }

  get formattedMatchTotalTime(): string {
    const min = Math.max(0, Math.floor(this.minute ?? 0));
    const sec = Math.max(0, Math.min(59, Math.floor(this.second ?? 0)));
    const totalMin = this.period === 2 ? (min < 40 ? 40 + min : min) : min;
    return `${totalMin.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  }

  save(): void {
    if (!this.eventTypeId) {
      this.toastService.warning('Debés seleccionar un tipo de evento');
      return;
    }

    // El tiempo va primero: su mensaje es más concreto que el genérico (el formulario también lo cuenta como inválido)
    const timeError = validateEventTime(this.period, this.minute, this.second);
    if (timeError || this.minute === null) {
      this.toastService.warning(timeError ?? 'Ingresá un minuto válido');
      return;
    }

    if (!this.isFormValid) {
      this.toastService.warning('Corregí los valores inválidos antes de guardar');
      return;
    }

    const matchTimeSeconds = toMatchTimeSeconds(this.period, this.minute, this.second);

    const assignedPlayerId = (this.possession === 'OPPONENT') ? null : (this.playerId.trim() || null);
    const absoluteSeconds = this.store.estimateAbsoluteTime(matchTimeSeconds, this.period);

    const payload: BackendEventCreationRequest = {
      eventTypeId: this.eventTypeId,
      matchId: this.matchId,
      period: this.period,
      matchTime: matchTimeSeconds,
      absoluteMatchTime: absoluteSeconds,
      teamPossession: this.possession,
      playerId: assignedPlayerId,
      origin: 'post_capture',
      realTime: new Date().toISOString(),
      attributes: this.attributes ?? undefined
    };

    this.isSubmitting.set(true);

    this.eventService.create(payload).subscribe({
      next: (res) => {
        this.isSubmitting.set(false);

        const dict = this.store.eventTypesDict();
        const eventTypeName = dict[this.eventTypeId] || 'Evento';
        const playerObj = assignedPlayerId
          ? this.store.availablePlayers().find(p => p.id === assignedPlayerId)
          : null;

        const timelineEvent: MatchTimelineEventResponse = {
          id: res.id,
          eventTypeId: this.eventTypeId,
          eventTypeName,
          playerId: assignedPlayerId,
          playerName: playerObj ? playerObj.fullName : null,
          playerJerseyNumber: playerObj ? playerObj.jerseyNumber : null,
          matchTime: matchTimeSeconds,
          absoluteMatchTime: res.absoluteMatchTime ?? absoluteSeconds,
          period: this.period,
          teamPossession: this.possession,
          origin: 'post_capture',
          attributes: res.attributes || undefined
        };

        const next = this.followUpsOf(eventTypeName);

        this.store.addEvent(timelineEvent);
        this.toastService.success('Evento agregado correctamente');
        this.created.emit(timelineEvent);
        this.continueWith(next);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        const msg = err?.error?.message || err?.error || 'Error al agregar el evento post-partido';
        this.toastService.error(typeof msg === 'string' ? msg : 'Error al guardar el evento');
      }
    });
  }

  /** Eventos que el catálogo propone después del que se acaba de guardar (con el formulario todavía intacto). */
  private followUpsOf(eventTypeName: string): NextEvent[] {
    const types = this.store.eventTypesList();
    const saved = types.find(type => type.id === this.eventTypeId);
    this.followUpName = eventTypeName;
    return saved ? nextEvents(saved, this.attributes, this.possession === 'NEUTRAL' ? null : this.possession, types) : [];
  }

  private continueWith(next: NextEvent[]): void {
    if (next.length === 0) {
      this.resetForm();
      this.close.emit();
    } else if (next.length === 1) {
      this.prefillNext(next[0]);
    } else {
      this.nextChoices.set(next);
    }
  }

  /** Pasa el formulario al evento siguiente: mismo período y tiempo que el anterior, equipo y preset del catálogo. */
  prefillNext(next: NextEvent): void {
    this.nextChoices.set(null);
    this.isFollowUp.set(true);
    this.eventTypeId = next.type.id;
    this.possession = next.team ?? this.possession;
    this.playerId = '';
    this.attributes = Object.keys(next.preset).length > 0 ? { ...next.preset } : null;
    this.isFormValid = true;
    this.initialData.set({
      eventTypeId: this.eventTypeId,
      teamPossession: this.possession,
      playerId: null,
      period: this.period,
      minute: this.minute,
      second: this.second,
      attributes: this.attributes
    });
    this.prefillHints.set({ time: `Sigue a ${this.followUpName} · ${this.formattedDisplayTime}` });
  }

  private resetForm(): void {
    this.nextChoices.set(null);
    this.isFollowUp.set(false);
    this.eventTypeId = '';
    this.period = 1;
    this.minute = 1;
    this.second = 0;
    this.possession = 'OWN';
    this.playerId = '';
    this.attributes = null;
  }
}
