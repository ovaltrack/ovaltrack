import { Component, EventEmitter, Input, Output, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatchReviewStore } from '../../store/match-review.store';
import { Possession } from '../../../types/live-capture.types';

import { TemplateField } from '../../../types/event-type.types';
import { EventPrefillHints } from '../../utils/event-prefill';
import { toMatchTimeSeconds, validateEventTime } from '../../utils/event-time';
import { formatTimeSeconds } from '../../utils/match-review.utils';
import { ZONE_COLUMN_NAMES, zoneLabel } from '../../utils/zone-grid';
import { isFixedZone, placeEventZone } from '../../utils/zone-rule';

export interface EventFormData {
  /** Evento que se edita; sin id (alta) el formulario siempre toma los datos que recibe. */
  eventId?: string;
  eventTypeId: string;
  teamPossession: Possession;
  playerId: string | null;
  period?: 1 | 2;
  minute?: number | null;
  second?: number | null;
  attributes?: Record<string, unknown> | null;
  isValid?: boolean;
}

@Component({
  selector: 'app-event-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './event-form.component.html',
  styleUrl: './event-form.component.css'
})
export class EventFormComponent {
  readonly store = inject(MatchReviewStore);

  @Input() set initialData(data: EventFormData | null) {
    if (data) {
      // Mientras haya cambios sin confirmar del mismo evento, los datos que llegan del store no pisan lo que se escribe
      const sameEvent = data.eventId !== undefined && data.eventId === this.seededEventId;
      if (sameEvent && this.hasUnsavedChanges && !this.matchesForm(data)) return;
      this.seededEventId = data.eventId ?? null;
      this.hasUnsavedChanges = false;
      this.timeTouched.set(false);
      this.eventTypeId.set(data.eventTypeId || '');
      this.teamPossession.set(data.teamPossession || 'OWN');
      this.playerId.set(data.playerId || null);
      if (data.period !== undefined) this.period.set(data.period);
      if (data.minute !== undefined) this.minute.set(data.minute);
      if (data.second !== undefined) this.second.set(data.second);
      this.attributes.set(data.attributes ? { ...data.attributes } : {});
    }
  }

  /** Etiquetas de origen de los valores precargados; se ocultan apenas el usuario edita ese campo. */
  @Input() set prefillHints(hints: EventPrefillHints | null) {
    this.periodHint.set(hints?.period ?? null);
    this.timeHint.set(hints?.time ?? null);
  }

  readonly periodHint = signal<string | null>(null);
  readonly timeHint = signal<string | null>(null);

  @Input() showTimeFields = false;
  @Input() showEnrichmentSlot = false;
  @Input() disabled = false;

  @Output() formChange = new EventEmitter<EventFormData>();
  /** El foco salió de los campos de tiempo: quien edita puede guardar sin esperar. */
  @Output() timeCommit = new EventEmitter<void>();

  private seededEventId: string | null = null;
  private hasUnsavedChanges = false;

  readonly eventTypeId = signal<string>('');
  readonly teamPossession = signal<Possession>('OWN');
  readonly playerId = signal<string | null>(null);
  readonly period = signal<1 | 2>(1);
  readonly minute = signal<number | null>(1);
  readonly second = signal<number | null>(0);
  readonly attributes = signal<Record<string, unknown>>({});
  private readonly timeTouched = signal<boolean>(false);

  /** Error del tiempo cargado; el minuto vacío del alta no se marca hasta que se toca un campo de tiempo. */
  readonly timeError = computed<string | null>(() => {
    if (!this.showTimeFields) return null;
    if (this.minute() === null && !this.timeTouched()) return null;
    return validateEventTime(this.period(), this.minute(), this.second());
  });

  readonly timeHelp = 'Minuto del partido (0–80). En el 2T podés escribir el minuto del tiempo (5) o el del partido (45): se guarda como 45′.';

  /** Minuto del partido al que equivale lo escrito, solo en el 2T con minuto < 40 (la única ambigüedad posible). */
  readonly matchTimeEquivalent = computed<string | null>(() => {
    const minute = this.minute();
    if (this.period() !== 2 || minute === null || minute < 0 || minute >= 40 || validateEventTime(2, minute, this.second()) !== null) {
      return null;
    }
    return formatTimeSeconds(toMatchTimeSeconds(2, minute, this.second()));
  });

  readonly currentTemplateFields = computed<TemplateField[]>(() => {
    const typeId = this.eventTypeId();
    if (!typeId) return [];
    const type = this.store.eventTypesList().find(t => t.id === typeId);
    return type?.templateEventFields || [];
  });

  private readonly zoneRule = computed(() => this.store.zoneRulesByType().get(this.eventTypeId()) ?? null);

  /** Atributo que fija la fila de la zona (ej. el lado del apoyo): la línea de ubicación va debajo de ese campo. */
  readonly placementFieldKey = computed<string | null>(() => this.zoneRule()?.rowFrom ?? null);

  /** Dónde se ubica la jugada cuando su tipo fija la zona sin depender de un tramo (ej. "Se ubica en D6 · In-goal rival"). */
  readonly fixedPlacement = computed<string | null>(() => {
    const rule = this.zoneRule();
    const attributes = this.attributes();
    const cell = isFixedZone(rule, attributes) ? placeEventZone(rule, this.teamPossession(), attributes, null) : null;
    return cell ? `Se ubica en ${zoneLabel(cell)} · ${ZONE_COLUMN_NAMES[cell.col - 1]}` : null;
  });

  private emitChange(): void {
    this.hasUnsavedChanges = true;
    const cleanAttrs = cleanAttributes(this.attributes());
    const isValid = !this.hasAnyInvalidField() &&
      (!this.showTimeFields || validateEventTime(this.period(), this.minute(), this.second()) === null);

    this.formChange.emit({
      eventTypeId: this.eventTypeId(),
      teamPossession: this.teamPossession(),
      playerId: this.playerId(),
      period: this.period(),
      minute: this.minute(),
      second: this.second(),
      attributes: Object.keys(cleanAttrs).length > 0 ? cleanAttrs : null,
      isValid
    });
  }

  /** Los datos recibidos son los que muestra el formulario (el store ya confirmó lo escrito). */
  private matchesForm(data: EventFormData): boolean {
    return data.eventTypeId === this.eventTypeId() &&
      data.teamPossession === this.teamPossession() &&
      (data.playerId ?? null) === this.playerId() &&
      (data.period === undefined || data.period === this.period()) &&
      this.matchesFormTime(data) &&
      sameAttributes(cleanAttributes(data.attributes ?? {}), cleanAttributes(this.attributes()));
  }

  /** Mismo instante de partido aunque se haya escrito distinto (5' del 2T se guarda y vuelve como 45'). */
  private matchesFormTime(data: EventFormData): boolean {
    if (data.minute === undefined) return true;
    const minute = this.minute();
    if (data.minute === null || minute === null) return data.minute === minute;
    return toMatchTimeSeconds(this.period(), data.minute, data.second) === toMatchTimeSeconds(this.period(), minute, this.second());
  }

  onTimeFocusOut(event: FocusEvent, container: HTMLElement): void {
    const next = event.relatedTarget as Node | null;
    if (next && container.contains(next)) return;
    this.timeCommit.emit();
  }

  isFieldInvalid(field: TemplateField): boolean {
    const val = this.getAttributeValue(field.key);
    if (val === null || val === undefined || val === '') {
      return false;
    }
    const num = Number(val);
    if (isNaN(num)) {
      return true;
    }
    if (field.min != null && num < field.min) {
      return true;
    }
    if (field.max != null && num > field.max) {
      return true;
    }
    return false;
  }

  getNumberPlaceholder(field: TemplateField): string {
    if (field.min != null && field.max != null) {
      return `Entre ${field.min} y ${field.max}`;
    }
    if (field.min != null) {
      return `Mínimo ${field.min}`;
    }
    if (field.max != null) {
      return `Máximo ${field.max}`;
    }
    return 'Ingresar valor numérico...';
  }

  getFieldValidationMessage(field: TemplateField): string {
    if (field.min != null && field.max != null) {
      return `Inserte un valor entre ${field.min} y ${field.max}`;
    }
    if (field.min != null) {
      return `Inserte un valor mayor o igual a ${field.min}`;
    }
    if (field.max != null) {
      return `Inserte un valor menor o igual a ${field.max}`;
    }
    return 'Valor numérico fuera de rango';
  }

  hasAnyInvalidField(): boolean {
    const fields = this.currentTemplateFields();
    for (const field of fields) {
      if (field.type === 'number' && this.isFieldInvalid(field)) {
        return true;
      }
    }
    return false;
  }

  onEventTypeChange(id: string): void {
    const changed = this.eventTypeId() !== id;
    this.eventTypeId.set(id);
    if (changed) {
      this.attributes.set({});
    }
    this.emitChange();
  }

  onAttributeChange(key: string, value: unknown): void {
    const current = { ...this.attributes() };
    if (value === null || value === undefined || value === '') {
      delete current[key];
    } else {
      current[key] = value;
    }
    this.attributes.set(current);
    this.emitChange();
  }

  onNumericAttributeChange(key: string, rawVal: number | string | null): void {
    if (rawVal === null || rawVal === '' || rawVal === undefined || isNaN(Number(rawVal))) {
      this.onAttributeChange(key, null);
    } else {
      this.onAttributeChange(key, Number(rawVal));
    }
  }

  getAttributeValue(key: string): unknown {
    return this.attributes()[key] ?? null;
  }

  onPossessionChange(pos: 'OWN' | 'OPPONENT'): void {
    this.teamPossession.set(pos);
    if (pos === 'OPPONENT') {
      this.playerId.set(null);
    }
    this.emitChange();
  }

  onPlayerChange(id: string): void {
    const finalId = id.trim() || null;
    this.playerId.set(finalId);
    this.emitChange();
  }

  onPeriodChange(p: 1 | 2): void {
    this.periodHint.set(null);
    this.timeTouched.set(true);
    this.period.set(p);
    this.emitChange();
  }

  onMinuteChange(m: number | null): void {
    this.timeHint.set(null);
    this.timeTouched.set(true);
    this.minute.set(m);
    this.emitChange();
  }

  onSecondChange(s: number | null): void {
    this.timeHint.set(null);
    this.timeTouched.set(true);
    this.second.set(s);
    this.emitChange();
  }
}

function cleanAttributes(raw: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v !== undefined && v !== null && v !== '') {
      clean[k] = v;
    }
  }
  return clean;
}

function sameAttributes(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every(k => a[k] === b[k]);
}
