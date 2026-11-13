import { Injectable, computed, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { MatchTimelineEventResponse } from '../../types/event.types';
import { AvailablePlayer } from '../../types/roster.types';
import { LiveCaptureEventType } from '../../types/event-type.types';
import { ZoneAssignmentResponse } from '../../types/zone.types';
import {
  ReviewEventViewModel,
  ReviewFilters,
  ReviewKpis,
  ReviewPeriodFilter,
  ReviewTimelineLane
} from '../types/match-review.types';

import {
  RUGBY_HALF_TIME_MIN,
  RUGBY_FULL_TIME_MIN,
  EMPTY_TIME_PLACEHOLDER,
  estimateAbsoluteTime as estimateAbsoluteTimeUtil,
  resolveEventColor,
  formatTimeSeconds,
  formatAbsoluteTime,
  formatOnlyTime
} from '../utils/match-review.utils';
import { zoneForEvent } from '../utils/zone-event-link';
import { ScoringTypesById, ZoneRulesByType, isFixedZone } from '../utils/zone-rule';
import { eventsInRange } from '../utils/zone-stats';
import { TramoTrim, predictTramoTrim } from '../utils/zone-track-layout';
import { countsAsScoring, scoringTeam } from '../../statistics/calculators/event-rules';
import { oneOf, persistedSignal } from '../../../../shared/utils/persisted-signal';

export { RUGBY_HALF_TIME_MIN, RUGBY_FULL_TIME_MIN, EMPTY_TIME_PLACEHOLDER };

/** Filtro de Eventos que puede dejar un evento fuera de la vista. */
export type HidingFilter = 'period' | 'team' | 'unassigned' | 'search' | 'lane';

const DEFAULT_REVIEW_FILTERS: ReviewFilters = {
  period: 'ALL',
  team: 'ALL',
  onlyUnassigned: false,
  searchTerm: '',
  hiddenLaneIds: [],
};

/** Valida los filtros guardados: una versión vieja o editada a mano vuelve a los filtros por defecto. */
function isReviewFilters(value: unknown): value is ReviewFilters {
  if (typeof value !== 'object' || value === null) return false;
  const filters = value as Record<string, unknown>;
  return oneOf<ReviewFilters['period']>(['ALL', 1, 2])(filters['period'])
    && oneOf<ReviewFilters['team']>(['ALL', 'OWN', 'OPPONENT'])(filters['team'])
    && typeof filters['onlyUnassigned'] === 'boolean'
    && typeof filters['searchTerm'] === 'string'
    && Array.isArray(filters['hiddenLaneIds'])
    && filters['hiddenLaneIds'].every(laneId => typeof laneId === 'string');
}

@Injectable({
  providedIn: 'root'
})
export class MatchReviewStore {

  // --- Estado Primario (Signals) ---
  readonly matchId = signal<string>('');
  readonly rawEvents = signal<MatchTimelineEventResponse[]>([]);
  readonly matchStartTime = signal<string | null>(null);
  readonly selectedEventId = signal<string | null>(null);
  readonly eventTypesDict = signal<Record<string, string>>({});
  readonly eventTypesList = signal<LiveCaptureEventType[]>([]);
  /** Regla de zona de cada tipo de evento, del catálogo; los tipos sin regla valen null. */
  readonly zoneRulesByType = computed<ZoneRulesByType>(() =>
    new Map(this.eventTypesList().map(type => [type.id, type.zoneRule ?? null])));
  /** Tipos por id con lo que dice si un tanto cuenta (un Kick H errado no reinicia el juego). */
  private readonly scoringTypesById = computed<ScoringTypesById>(() =>
    new Map(this.eventTypesList().map(type => [type.id, type])));
  readonly availablePlayers = signal<AvailablePlayer[]>([]);
  /** Tramos de zona del partido (solo lectura): dan el rango y el enlace a Zonas de cada evento. */
  readonly zoneAssignments = signal<ZoneAssignmentResponse[]>([]);
  /** Si falló `GET /zones` la zona se sigue viendo (viene en el evento), pero sin rango ni enlace al tramo. */
  readonly zonesStatus = signal<'idle' | 'loaded' | 'failed'>('idle');
  readonly initialHomeScore = signal<number>(0);
  readonly initialAwayScore = signal<number>(0);
  readonly scoreDelta = signal<{ text: string; type: 'OWN' | 'OPPONENT' } | null>(null);

  /**
   * Avisa cada alta, edición o baja de un evento. Los mutadores (`addEvent`, `updateEvent`, `removeEvent`) se llaman
   * solo con el cambio ya confirmado por el servidor, que en ese momento recalcula el marcador del partido.
   */
  private readonly confirmedChange = new Subject<void>();
  readonly confirmedChange$ = this.confirmedChange.asObservable();

  /**
   * Se recuerdan por partido en la pestaña (recarga o volver a la pantalla). La clave se asigna en `setMatchId`;
   * `resetSession` la suelta sin borrar lo guardado.
   */
  readonly filters = persistedSignal<ReviewFilters>(null, DEFAULT_REVIEW_FILTERS, { isValid: isReviewFilters });

  /**
   * Eventos que se muestran en el post-partido: se ocultan los de tipos dados de baja en el
   * catálogo (inactivos o que ya no devuelve el servidor). Sin catálogo cargado se muestran todos.
   */
  readonly reviewEvents = computed<MatchTimelineEventResponse[]>(() => {
    const types = this.eventTypesList();
    const raw = this.rawEvents();
    if (types.length === 0) return raw;
    const activeTypeIds = new Set(types.filter(type => type.isActive !== false).map(type => type.id));
    return raw.filter(event => activeTypeIds.has(event.eventTypeId));
  });

  // --- Tanteador Reactivo Oficial ---
  readonly scoreboard = computed<{ home: number; away: number }>(() => {
    const events = this.reviewEvents();
    const typesMap = new Map<string, LiveCaptureEventType>();
    this.eventTypesList().forEach(t => typesMap.set(t.id, t));

    let home = 0;
    let away = 0;

    for (const ev of events) {
      const pts = this.getEventPoints(ev, typesMap);
      home += pts.home;
      away += pts.away;
    }

    // Fallback al tanteador de cabecera si los eventos aún no tienen scores calculados
    if (home === 0 && away === 0 && (this.initialHomeScore() > 0 || this.initialAwayScore() > 0)) {
      return { home: this.initialHomeScore(), away: this.initialAwayScore() };
    }

    return { home, away };
  });

  // --- Indicador Reactivo de Filtros Activos ---
  /** Algo de la barra difiere del estado por defecto: período, posesión, "Solo sin jugador" o búsqueda. */
  readonly hasActiveFilters = computed<boolean>(() => {
    const f = this.filters();
    return f.period !== 'ALL' ||
           f.team !== 'ALL' ||
           f.onlyUnassigned ||
           f.searchTerm.trim() !== '';
  });

  // --- Duración Dinámica y Escala (Eje X) ---
  readonly matchDurationScale = computed<number>(() => {
    let maxMinutes = RUGBY_FULL_TIME_MIN; // Estándar mínimo reglamentario de rugby
    for (const ev of this.reviewEvents()) {
      const mins = (ev.matchTime ?? 0) / 60;
      if (mins > maxMinutes) {
        maxMinutes = Math.ceil(mins);
      }
    }
    return maxMinutes;
  });

  // --- Transformación DTO a ViewModels Puros ---
  readonly allViewModels = computed<ReviewEventViewModel[]>(() => {
    const raw = this.reviewEvents();
    const dict = this.eventTypesDict();
    const scale = this.matchDurationScale();
    const currentFilters = this.filters();
    const term = currentFilters.searchTerm.trim().toLowerCase();
    const zonesLoaded = this.zonesStatus() === 'loaded';
    const assignments = this.zoneAssignments();
    const rules = this.zoneRulesByType();

    return raw.map(e => {
      const vm = this.buildBaseViewModel(e, dict, scale);
      const rule = rules.get(e.eventTypeId) ?? null;
      const fixedByType = isFixedZone(rule, e.attributes);
      // El servidor informa la zona; los eventos recién creados o editados en esta pantalla no la traen y se derivan con
      // la regla del tipo y los tramos (una zona fija no necesita que los tramos estén cargados)
      vm.zone = e.zone !== undefined ? e.zone : (zonesLoaded || fixedByType ? zoneForEvent(e, assignments, rule) : undefined);
      vm.zoneFixed = fixedByType && !!vm.zone;
      vm.isDimmed = !this.evaluateFilters(vm, currentFilters, term);
      return vm;
    });
  });

  // --- Eventos Visibles (Filtrados para Tabla) ---
  readonly visibleEvents = computed<ReviewEventViewModel[]>(() => {
    return this.allViewModels()
      .filter(ev => !ev.isDimmed)
      .sort((a, b) => this.sortChronologically(a, b));
  });

  // --- Cola de Revisión (Pendientes sin jugador) ---
  readonly pendingQueue = computed<ReviewEventViewModel[]>(() => {
    return this.allViewModels()
      .filter(ev => ev.isUnassigned)
      .sort((a, b) => this.sortChronologically(a, b));
  });

  // --- Evento Actualmente Seleccionado ---
  readonly selectedEvent = computed<ReviewEventViewModel | null>(() => {
    const id = this.selectedEventId();
    if (!id) return null;
    return this.allViewModels().find(e => e.id === id) ?? null;
  });

  // --- Carriles de la Línea de Tiempo (Timeline Lanes) ---
  readonly timelineLanes = computed<ReviewTimelineLane[]>(() => {
    const all = this.allViewModels();
    const hidden = new Set(this.filters().hiddenLaneIds);
    const lanesMap = new Map<string, ReviewEventViewModel[]>();

    for (const ev of all) {
      if (!lanesMap.has(ev.eventTypeId)) {
        lanesMap.set(ev.eventTypeId, []);
      }
      lanesMap.get(ev.eventTypeId)!.push(ev);
    }

    const lanes: ReviewTimelineLane[] = [];
    lanesMap.forEach((occurrences, typeId) => {
      const first = occurrences[0];
      const isHidden = hidden.has(typeId);
      const filteredOccurrences = occurrences.filter(ev => !ev.isDimmed);
      const filteredCount = filteredOccurrences.length;
      const isDimmed = isHidden || filteredCount === 0;

      lanes.push({
        eventTypeId: typeId,
        eventName: first.eventTypeName,
        color: first.color,
        totalCount: occurrences.length,
        filteredCount,
        hidden: isHidden,
        isDimmed,
        occurrences
      });
    });

    return lanes;
  });

  // Cantidad total de carriles presentes en el partido (inmune a filtros para estabilidad de layout)
  readonly activeLanesCount = computed<number>(() => {
    const lanes = this.timelineLanes();
    return Math.max(1, lanes.length);
  });

  // --- KPIs del Resumen Superior ---
  readonly kpis = computed<ReviewKpis>(() => {
    const all = this.allViewModels();
    const totalEvents = all.length;
    const unassignedEvents = all.filter(e => e.isUnassigned).length;
    const coveragePercentage = totalEvents > 0
      ? Math.round(((totalEvents - unassignedEvents) / totalEvents) * 100)
      : 100;

    const startTimeFormatted = this.resolveMatchStartTimeFormatted(all, this.matchStartTime());

    return {
      totalEvents,
      unassignedEvents,
      coveragePercentage,
      startTimeFormatted
    };
  });

  // --- Acciones de Estado (State Mutators) ---

  private deltaTimeoutId: ReturnType<typeof setTimeout> | null = null;

  setInitialScores(home: number, away: number): void {
    this.initialHomeScore.set(home);
    this.initialAwayScore.set(away);
  }

  triggerScoreDelta(points: number, type: 'OWN' | 'OPPONENT'): void {
    if (this.deltaTimeoutId) {
      clearTimeout(this.deltaTimeoutId);
    }
    const text = points > 0 ? `+${points}` : `${points}`;
    this.scoreDelta.set({ text, type });
    this.deltaTimeoutId = setTimeout(() => {
      this.scoreDelta.set(null);
    }, 3000);
  }

  setEvents(events: MatchTimelineEventResponse[], matchStartTime?: string | null): void {
    this.rawEvents.set(events);
    if (matchStartTime !== undefined) {
      this.matchStartTime.set(matchStartTime);
    }
  }

  setMatchId(id: string): void {
    this.matchId.set(id);
    this.filters.useKey(`post-match.${id}.review`);
  }

  setZoneAssignments(assignments: ZoneAssignmentResponse[]): void {
    this.zoneAssignments.set(assignments);
    this.zonesStatus.set('loaded');
  }

  /** Recorte que hará el backend al guardar el evento (un tanto dentro de un tramo); null sin tramos cargados o si no recorta. */
  tramoTrimFor(event: MatchTimelineEventResponse): TramoTrim | null {
    if (this.zonesStatus() !== 'loaded') return null;
    return predictTramoTrim(event, this.zoneAssignments(), this.zoneRulesByType(), this.scoringTypesById());
  }

  /**
   * Refleja el recorte que hizo el backend al guardar un tanto, sin volver a pedir los tramos: el tramo termina en el corte
   * y las jugadas que quedaron después descartan la zona del servidor para derivarla de nuevo (ahora caen en un hueco).
   */
  applyTramoTrim({ tramo, endMinute }: TramoTrim): void {
    this.zoneAssignments.update(list => list.map(a => a.id === tramo.id ? { ...a, endMinute } : a));
    const released = { period: tramo.period, startMinute: endMinute, endMinute: tramo.endMinute };
    const releasedIds = new Set(eventsInRange(released, this.rawEvents()).map(event => event.id));
    this.rawEvents.update(events => events.map(event => releasedIds.has(event.id) ? { ...event, zone: undefined } : event));
  }

  setZonesFailed(): void {
    this.zoneAssignments.set([]);
    this.zonesStatus.set('failed');
  }

  setAvailablePlayers(players: AvailablePlayer[]): void {
    this.availablePlayers.set(players);
  }

  setEventTypesList(types: LiveCaptureEventType[]): void {
    this.eventTypesList.set(types);
    const dict: Record<string, string> = {};
    types.forEach(t => {
      dict[t.id] = t.name;
    });
    this.eventTypesDict.set(dict);
  }

  setEventTypes(dict: Record<string, string>): void {
    this.eventTypesDict.set(dict);
  }

  selectEvent(id: string | null): void {
    this.selectedEventId.set(id);
  }

  selectNextVisible(): void {
    const events = this.visibleEvents();
    if (events.length === 0) return;

    const currentId = this.selectedEventId();
    const currentIndex = events.findIndex(e => e.id === currentId);

    if (currentIndex === -1 || currentIndex === events.length - 1) {
      this.selectedEventId.set(events[0].id);
    } else {
      this.selectedEventId.set(events[currentIndex + 1].id);
    }
  }

  selectPrevVisible(): void {
    const events = this.visibleEvents();
    if (events.length === 0) return;

    const currentId = this.selectedEventId();
    const currentIndex = events.findIndex(e => e.id === currentId);

    if (currentIndex <= 0) {
      this.selectedEventId.set(events[events.length - 1].id);
    } else {
      this.selectedEventId.set(events[currentIndex - 1].id);
    }
  }

  selectNextPending(): void {
    const queue = this.pendingQueue();
    if (queue.length === 0) return;

    const currentId = this.selectedEventId();
    const currentIndex = queue.findIndex(e => e.id === currentId);

    if (currentIndex === -1 || currentIndex === queue.length - 1) {
      this.selectedEventId.set(queue[0].id);
    } else {
      this.selectedEventId.set(queue[currentIndex + 1].id);
    }
  }

  selectPrevPending(): void {
    const queue = this.pendingQueue();
    if (queue.length === 0) return;

    const currentId = this.selectedEventId();
    const currentIndex = queue.findIndex(e => e.id === currentId);

    if (currentIndex <= 0) {
      this.selectedEventId.set(queue[queue.length - 1].id);
    } else {
      this.selectedEventId.set(queue[currentIndex - 1].id);
    }
  }

  setPeriod(period: ReviewPeriodFilter): void {
    this.filters.update(f => ({ ...f, period }));
  }

  setTeamFilter(team: 'ALL' | 'OWN' | 'OPPONENT'): void {
    this.filters.update(f => ({ ...f, team }));
  }

  toggleOnlyUnassigned(): void {
    this.filters.update(f => ({ ...f, onlyUnassigned: !f.onlyUnassigned}));
  }

  setSearchTerm(term: string): void {
    this.filters.update(f => ({ ...f, searchTerm: term }));
  }

  toggleLane(laneId: string): void {
    this.filters.update(f => {
      const isHidden = f.hiddenLaneIds.includes(laneId);
      const updated = isHidden
        ? f.hiddenLaneIds.filter(id => id !== laneId)
        : [...f.hiddenLaneIds, laneId];
      return { ...f, hiddenLaneIds: updated };
    });
  }

  /** Filtros activos que dejan fuera de la vista a un evento (vacío si se ve). */
  hiddenByFilters(eventId: string): HidingFilter[] {
    const ev = this.allViewModels().find(e => e.id === eventId);
    if (!ev) return [];
    const filters = this.filters();
    return this.findHidingFilters(ev, filters, filters.searchTerm.trim().toLowerCase());
  }

  /** Limpia solo los filtros que ocultan al evento, lo selecciona y la tabla hace scroll hasta él. */
  revealEvent(eventId: string): void {
    const hiding = this.hiddenByFilters(eventId);
    const ev = this.allViewModels().find(e => e.id === eventId);
    if (ev && hiding.length > 0) {
      this.filters.update(f => ({
        ...f,
        period: hiding.includes('period') ? 'ALL' : f.period,
        team: hiding.includes('team') ? 'ALL' : f.team,
        onlyUnassigned: hiding.includes('unassigned') ? false : f.onlyUnassigned,
        searchTerm: hiding.includes('search') ? '' : f.searchTerm,
        hiddenLaneIds: hiding.includes('lane') ? f.hiddenLaneIds.filter(id => id !== ev.eventTypeId) : f.hiddenLaneIds
      }));
    }
    this.selectEvent(eventId);
  }

  clearFilters(): void {
    this.filters.set(DEFAULT_REVIEW_FILTERS);
  }

  resetSession(): void {
    this.selectedEventId.set(null);
    this.scoreDelta.set(null);
    this.zoneAssignments.set([]);
    this.zonesStatus.set('idle');
    // Vuelve a los filtros por defecto solo en memoria: lo guardado para el partido se recupera en setMatchId.
    this.filters.useKey(null);
  }

  removeEvent(eventId: string): void {
    const current = this.rawEvents();
    const toRemove = current.find(e => e.id === eventId);
    if (toRemove) {
      const pts = this.getEventPoints(toRemove);
      if (pts.away > 0) {
        this.triggerScoreDelta(-pts.away, 'OPPONENT');
      } else if (pts.home > 0) {
        this.triggerScoreDelta(-pts.home, 'OWN');
      }
    }
    this.rawEvents.set(current.filter(e => e.id !== eventId));
    if (this.selectedEventId() === eventId) {
      this.selectedEventId.set(null);
    }
    this.confirmedChange.next();
  }

  updateEvent(eventId: string, partial: Partial<MatchTimelineEventResponse>): void {
    const current = this.rawEvents();
    const index = current.findIndex(e => e.id === eventId);
    if (index !== -1) {
      const existing = current[index];
      const dict = this.eventTypesDict();
      const updated = { ...existing, ...partial };
      // La zona depende del tiempo y, si el tipo tiene regla, también del tipo, la posesión y los atributos:
      // si cambió algo de eso, se descarta la del servidor y se deriva
      if (this.changesZone(existing, updated, partial)) {
        updated.zone = undefined;
      }
      if (partial.eventTypeId && dict[partial.eventTypeId]) {
        updated.eventTypeName = dict[partial.eventTypeId];
      }
      if (partial.playerId !== undefined) {
        const playerObj = this.availablePlayers().find(p => p.id === partial.playerId);
        updated.playerName = playerObj ? playerObj.fullName : null;
        updated.playerJerseyNumber = playerObj ? playerObj.jerseyNumber : null;
      }

      const before = this.getEventPoints(existing);
      const after = this.getEventPoints(updated);
      const deltaAway = after.away - before.away;
      const deltaHome = after.home - before.home;

      if (deltaAway > 0) {
        this.triggerScoreDelta(deltaAway, 'OPPONENT');
      } else if (deltaHome > 0) {
        this.triggerScoreDelta(deltaHome, 'OWN');
      } else if (deltaAway < 0) {
        this.triggerScoreDelta(deltaAway, 'OPPONENT');
      } else if (deltaHome < 0) {
        this.triggerScoreDelta(deltaHome, 'OWN');
      }

      const newArray = [...current];
      newArray[index] = updated;
      this.rawEvents.set(newArray);
    }
    this.confirmedChange.next();
  }

  private changesZone(
    existing: MatchTimelineEventResponse,
    updated: MatchTimelineEventResponse,
    partial: Partial<MatchTimelineEventResponse>
  ): boolean {
    const rules = this.zoneRulesByType();
    const changesTime = partial.matchTime !== undefined || partial.period !== undefined;
    const changesWhatRulesRead = partial.eventTypeId !== undefined || partial.teamPossession !== undefined || partial.attributes !== undefined;
    const hasRule = !!rules.get(existing.eventTypeId) || !!rules.get(updated.eventTypeId);
    return changesTime || (changesWhatRulesRead && hasRule);
  }

  addEvent(event: MatchTimelineEventResponse): void {
    const dict = this.eventTypesDict();
    const eventName = event.eventTypeName || dict[event.eventTypeId] || 'Evento';
    let playerName = event.playerName;
    let playerJerseyNumber = event.playerJerseyNumber;

    if (event.playerId && !playerName) {
      const playerObj = this.availablePlayers().find(p => p.id === event.playerId);
      if (playerObj) {
        playerName = playerObj.fullName;
        playerJerseyNumber = playerObj.jerseyNumber;
      }
    }

    const enrichedEvent: MatchTimelineEventResponse = {
      ...event,
      eventTypeName: eventName,
      playerName: playerName ?? null,
      playerJerseyNumber: playerJerseyNumber ?? null,
      origin: event.origin ?? 'post_capture'
    };

    const current = this.rawEvents();
    const updated = [...current, enrichedEvent].sort((a, b) => {
      const pDiff = (a.period ?? 1) - (b.period ?? 1);
      if (pDiff !== 0) return pDiff;
      const tDiff = (a.matchTime ?? 0) - (b.matchTime ?? 0);
      if (tDiff !== 0) return tDiff;
      const absA = a.absoluteMatchTime ?? 0;
      const absB = b.absoluteMatchTime ?? 0;
      return absA - absB;
    });

    this.rawEvents.set(updated);
    this.selectedEventId.set(enrichedEvent.id);

    const pts = this.getEventPoints(enrichedEvent);
    if (pts.away > 0) {
      this.triggerScoreDelta(pts.away, 'OPPONENT');
    } else if (pts.home > 0) {
      this.triggerScoreDelta(pts.home, 'OWN');
    }
    this.confirmedChange.next();
  }

  /**
   * Estima la hora absoluta para un nuevo evento proyectando el desfase acumulado
   * de pausas del evento previo más cercano en el mismo período (sin contar `excludeEventId`).
   */
  estimateAbsoluteTime(newMatchTimeSeconds: number, period: 1 | 2, excludeEventId?: string): number {
    return estimateAbsoluteTimeUtil(this.rawEvents(), newMatchTimeSeconds, period, excludeEventId);
  }

  // --- Funciones Extraídas (Refactoring Niveles 1 y 2) ---

  private sortChronologically(a: ReviewEventViewModel, b: ReviewEventViewModel): number {
    if (a.period !== b.period) return a.period - b.period;
    if (a.matchTime !== b.matchTime) return a.matchTime - b.matchTime;
    return a.absoluteMatchTime - b.absoluteMatchTime;
  }

  private resolveMatchStartTimeFormatted(allEvents: ReviewEventViewModel[], explicitStart: string | null): string {
    if (explicitStart) {
      return formatOnlyTime(explicitStart);
    }
    return EMPTY_TIME_PLACEHOLDER;
  }

  private buildBaseViewModel(
    e: MatchTimelineEventResponse,
    dict: Record<string, string>,
    scale: number
  ): ReviewEventViewModel {
    const eventName = e.eventTypeName || dict[e.eventTypeId] || 'Evento';
    const hasPlayer = Boolean(e.playerId && e.playerId.trim() !== '');
    const playerName = e.playerName || (hasPlayer ? 'Jugador' : 'Sin asignar');
    const seconds = e.matchTime ?? 0;
    const absSeconds = e.absoluteMatchTime != null
      ? e.absoluteMatchTime
      : this.estimateAbsoluteTime(seconds, (e.period === 2 ? 2 : 1));
    const minute = seconds / 60;
    const pct = Math.min(100, Math.max(0, (minute / scale) * 100));
    const isUnassigned = !hasPlayer && e.teamPossession !== 'OPPONENT';
    const isPostMatch = e.origin === 'post_capture';

    return {
      id: e.id,
      eventTypeId: e.eventTypeId,
      eventTypeName: eventName,
      color: resolveEventColor(eventName),
      period: e.period ?? 1,
      matchTime: seconds,
      minute,
      pct,
      matchTimeFormatted: formatTimeSeconds(seconds),
      absoluteMatchTime: absSeconds,
      absoluteTimeFormatted: formatAbsoluteTime(absSeconds),
      playerId: e.playerId ?? null,
      playerName,
      playerJerseyNumber: e.playerJerseyNumber ?? null,
      hasPlayer,
      isUnassigned,
      teamPossession: e.teamPossession,
      origin: e.origin,
      isPostMatch,
      attributes: e.attributes,
      note: e.note || null,
      isDimmed: false
    };
  }

  private evaluateFilters(ev: ReviewEventViewModel, filters: ReviewFilters, term: string): boolean {
    return this.findHidingFilters(ev, filters, term).length === 0;
  }

  private findHidingFilters(ev: ReviewEventViewModel, filters: ReviewFilters, term: string): HidingFilter[] {
    const hiding: HidingFilter[] = [];
    if (filters.period !== 'ALL' && ev.period !== filters.period) hiding.push('period');
    if (filters.team !== 'ALL' && ev.teamPossession !== filters.team) hiding.push('team');
    if (filters.onlyUnassigned && !ev.isUnassigned) hiding.push('unassigned');
    const matchesSearch = term === '' ||
      ev.playerName.toLowerCase().includes(term) ||
      ev.eventTypeName.toLowerCase().includes(term);
    if (!matchesSearch) hiding.push('search');
    if (filters.hiddenLaneIds.includes(ev.eventTypeId)) hiding.push('lane');
    return hiding;
  }

  private getEventPoints(ev: MatchTimelineEventResponse, typesMap?: Map<string, LiveCaptureEventType>): { home: number; away: number } {
    const type = typesMap ? typesMap.get(ev.eventTypeId) : this.eventTypesList().find(t => t.id === ev.eventTypeId);
    if (!type || !countsAsScoring(type, ev.attributes)) return { home: 0, away: 0 };
    const pts = type.points || 0;
    const team = scoringTeam(ev);
    if (team === 'OPPONENT') {
      return { home: 0, away: pts };
    }
    return team === 'OWN' ? { home: pts, away: 0 } : { home: 0, away: 0 };
  }
}
