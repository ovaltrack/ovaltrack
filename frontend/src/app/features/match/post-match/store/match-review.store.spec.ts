import { TestBed } from '@angular/core/testing';
import { MatchReviewStore } from './match-review.store';
import { MatchTimelineEventResponse } from '../../types/event.types';
import { clearPersistedSignals } from '../../../../shared/utils/persisted-signal';

describe('MatchReviewStore (HU-8.4)', () => {
  let store: MatchReviewStore;

  beforeEach(() => {
    // Los filtros se guardan en sessionStorage por partido: sin esto, un test le pasaría sus filtros al siguiente.
    clearPersistedSignals();
    TestBed.configureTestingModule({
      providers: [MatchReviewStore]
    });
    store = TestBed.inject(MatchReviewStore);
  });

  describe('filtros recordados por partido', () => {
    it('al volver a un partido recupera sus filtros, y otro partido arranca sin filtros', () => {
      store.setMatchId('match-1');
      store.setTeamFilter('OWN');

      store.resetSession();
      store.setMatchId('match-2');
      expect(store.filters().team).withContext('otro partido').toBe('ALL');

      store.resetSession();
      store.setMatchId('match-1');
      expect(store.filters().team).toBe('OWN');
    });

    it('resetSession vuelve a los filtros por defecto sin borrar los guardados', () => {
      store.setMatchId('match-1');
      store.setTeamFilter('OWN');

      store.resetSession();

      expect(store.filters().team).toBe('ALL');
      store.setMatchId('match-1');
      expect(store.filters().team).toBe('OWN');
    });

    it('limpiar filtros también borra los guardados del partido', () => {
      store.setMatchId('match-1');
      store.setTeamFilter('OWN');

      store.clearFilters();
      store.resetSession();
      store.setMatchId('match-1');

      expect(store.filters().team).toBe('ALL');
    });
  });

  it('should initialize with empty state', () => {
    expect(store.rawEvents()).toEqual([]);
    expect(store.visibleEvents()).toEqual([]);
    expect(store.selectedEventId()).toBeNull();
  });

  describe('zona del evento', () => {
    const event = (id: string, matchTime: number, zone?: { row: number; col: number } | null): MatchTimelineEventResponse => ({
      id, eventTypeId: 't', eventTypeName: 'Pase / Offload', matchTime, period: 1, teamPossession: 'OWN', zone
    });
    const tramo = { id: 'z', matchId: 'm', period: 1 as const, startMinute: 10, endMinute: 20, row: 2, col: 4 };

    it('usa la zona que informa el servidor, también null', () => {
      store.setEvents([event('a', 600, { row: 1, col: 1 }), event('b', 660, null)]);

      expect(store.allViewModels().map(vm => vm.zone)).toEqual([{ row: 1, col: 1 }, null]);
    });

    it('sin zona del servidor y sin tramos cargados, no se sabe (undefined)', () => {
      store.setEvents([event('a', 600)]);

      expect(store.allViewModels()[0].zone).toBeUndefined();
    });

    it('un evento recién creado (sin zona del servidor) deriva la zona de los tramos cargados', () => {
      store.setEvents([event('a', 600), event('b', 1500)]);
      store.setZoneAssignments([tramo]);

      expect(store.allViewModels().map(vm => vm.zone)).toEqual([{ row: 2, col: 4 }, null]);
    });

    it('si fallaron los tramos no inventa una zona', () => {
      store.setEvents([event('a', 600)]);
      store.setZonesFailed();

      expect(store.zonesStatus()).toBe('failed');
      expect(store.allViewModels()[0].zone).toBeUndefined();
    });

    it('resetSession descarta los tramos', () => {
      store.setZoneAssignments([tramo]);

      store.resetSession();

      expect(store.zoneAssignments()).toEqual([]);
      expect(store.zonesStatus()).toBe('idle');
    });
  });

  it('should add event, sort chronologically and select it', () => {
    const event1: MatchTimelineEventResponse = {
      id: 'ev-1',
      eventTypeId: 'type-1',
      eventTypeName: 'Tackle completado',
      matchTime: 600,
      absoluteMatchTime: 650,
      period: 1,
      teamPossession: 'OWN',
      origin: 'live-capture'
    };

    const event2: MatchTimelineEventResponse = {
      id: 'ev-2',
      eventTypeId: 'type-2',
      eventTypeName: 'Try',
      matchTime: 300,
      absoluteMatchTime: 320,
      period: 1,
      teamPossession: 'OWN',
      origin: 'post_capture'
    };

    store.setEvents([event1]);
    expect(store.rawEvents().length).toBe(1);

    store.addEvent(event2);

    const raw = store.rawEvents();
    expect(raw.length).toBe(2);
    // event2 (300s) should be sorted before event1 (600s)
    expect(raw[0].id).toBe('ev-2');
    expect(raw[1].id).toBe('ev-1');
    expect(store.selectedEventId()).toBe('ev-2');

    const vms = store.allViewModels();
    expect(vms[0].isPostMatch).toBeTrue();
    expect(vms[0].origin).toBe('post_capture');
    expect(vms[0].absoluteMatchTime).toBe(320);
    expect(vms[0].absoluteTimeFormatted).toBe('05:20');
    expect(vms[1].isPostMatch).toBeFalse();
    expect(vms[1].origin).toBe('live-capture');
    expect(vms[1].absoluteMatchTime).toBe(650);
    expect(vms[1].absoluteTimeFormatted).toBe('10:50');
  });

  it('should enrich player name and jersey number when available in roster', () => {
    store.setAvailablePlayers([
      { id: 'player-1', fullName: 'Juan Pérez', jerseyNumber: 10, position: null }
    ]);

    const newEvent: MatchTimelineEventResponse = {
      id: 'ev-3',
      eventTypeId: 'type-1',
      eventTypeName: 'Try',
      playerId: 'player-1',
      matchTime: 900,
      absoluteMatchTime: 940,
      period: 1,
      teamPossession: 'OWN',
      origin: 'post_capture'
    };

    store.addEvent(newEvent);

    const vm = store.allViewModels().find(e => e.id === 'ev-3');
    expect(vm).toBeDefined();
    expect(vm?.playerName).toBe('Juan Pérez');
    expect(vm?.playerJerseyNumber).toBe(10);
    expect(vm?.hasPlayer).toBeTrue();
    expect(vm?.isPostMatch).toBeTrue();
    expect(vm?.absoluteMatchTime).toBe(940);
    expect(vm?.absoluteTimeFormatted).toBe('15:40');
  });

  describe('estimateAbsoluteTime', () => {
    it('should calculate absolute time by projecting previous event pause offset in same period', () => {
      // Evento previo: min 5:30 (330s), absoluto 6:20 (380s) -> offset pausa: 50s
      store.setEvents([
        {
          id: 'ev-prev',
          eventTypeId: 'type-1',
          eventTypeName: 'Try',
          matchTime: 330,
          absoluteMatchTime: 380,
          period: 1,
          teamPossession: 'OWN'
        }
      ]);

      // Nuevo evento: min 5:35 (335s) -> 335 + 50 = 385s (6:25)
      const estimated = store.estimateAbsoluteTime(335, 1);
      expect(estimated).toBe(385);
    });

    it('should add 2 seconds disambiguation if matchTime equals previous event', () => {
      store.setEvents([
        {
          id: 'ev-try',
          eventTypeId: 'type-1',
          eventTypeName: 'Try',
          matchTime: 330,
          absoluteMatchTime: 380,
          period: 1,
          teamPossession: 'OWN'
        }
      ]);

      // Conversión en el mismo segundo de juego (330s) -> 380 + 2 = 382s
      const estimated = store.estimateAbsoluteTime(330, 1);
      expect(estimated).toBe(382);
    });

    it('should return raw matchTime if period 1 has no previous events', () => {
      store.setEvents([]);
      const estimated = store.estimateAbsoluteTime(180, 1);
      expect(estimated).toBe(180);
    });

    it('should anchor to last period 1 event when period 2 has no previous events', () => {
      store.setEvents([
        {
          id: 'ev-p1-last',
          eventTypeId: 'type-1',
          eventTypeName: 'Penal',
          matchTime: 2400,
          absoluteMatchTime: 2650,
          period: 1,
          teamPossession: 'OWN'
        }
      ]);

      // Primer evento de 2T en el min 1 (60s) -> 2650 + 60 = 2710s
      const estimated = store.estimateAbsoluteTime(60, 2);
      expect(estimated).toBe(2710);
    });
  });

  describe('scoreboard', () => {
    it('should calculate points according to event types and possessions, attributing player events to home', () => {
      store.setEventTypesList([
        { id: 't-try', name: 'Try', groupName: 'General', isScoring: true, points: 5, category: 'ATTACK', affectsPossession: false, requiresPlayer: false, isActive: true, createdAt: '', showInPalette: true, followUpEventTypeId: null, defaultPossession: 'OWN', templateEventFields: [] },
        { id: 't-penal', name: 'Penal a los palos', groupName: 'General', isScoring: true, points: 3, category: 'ATTACK', affectsPossession: false, requiresPlayer: false, isActive: true, createdAt: '', showInPalette: true, followUpEventTypeId: null, defaultPossession: 'OWN', templateEventFields: [] }
      ] as any);

      store.setEvents([
        // Try propio (5)
        { id: 'e1', eventTypeId: 't-try', eventTypeName: 'Try', matchTime: 100, teamPossession: 'OWN', period: 1 },
        // Try con jugador pero sin posesión OWN explícita (5) -> suma a home
        { id: 'e2', eventTypeId: 't-try', eventTypeName: 'Try', matchTime: 200, playerId: 'player-x', teamPossession: 'NEUTRAL', period: 1 },
        // Penal rival (3) -> suma a away
        { id: 'e3', eventTypeId: 't-penal', eventTypeName: 'Penal a los palos', matchTime: 300, teamPossession: 'OPPONENT', period: 1 }
      ]);

      expect(store.scoreboard()).toEqual({ home: 10, away: 3 });
    });

    it('should use initial scores when no scoring events exist', () => {
      store.setInitialScores(33, 25);
      store.setEvents([]);
      expect(store.scoreboard()).toEqual({ home: 33, away: 25 });
    });

    it('should not add points when a kick event has wasSuccessful = false and reactively update when changed to true', () => {
      store.setEventTypesList([
        {
          id: 't-penal',
          name: 'Penal a los palos',
          isScoring: true,
          points: 3,
          templateEventFields: [
            { key: 'wasSuccessful', label: 'Resultado', type: 'boolean', phase: 'live', required: true, effects: ['scoring'] }
          ]
        }
      ] as any);

      store.setEvents([
        {
          id: 'e-kick-1',
          eventTypeId: 't-penal',
          eventTypeName: 'Penal a los palos',
          matchTime: 120,
          teamPossession: 'OWN',
          period: 1,
          attributes: { wasSuccessful: false }
        }
      ]);

      // Errado -> 0 puntos
      expect(store.scoreboard().home).toBe(0);

      // Cambiar a Convertido -> 3 puntos y scoreDelta +3 OWN
      store.updateEvent('e-kick-1', { attributes: { wasSuccessful: true } });
      expect(store.scoreboard().home).toBe(3);
      expect(store.scoreDelta()).toEqual({ text: '+3', type: 'OWN' });

      // Cambiar nuevamente a Errado -> 0 puntos y scoreDelta -3 OWN
      store.updateEvent('e-kick-1', { attributes: { wasSuccessful: false } });
      expect(store.scoreboard().home).toBe(0);
      expect(store.scoreDelta()).toEqual({ text: '-3', type: 'OWN' });
    });

    it('should trigger scoreDelta and update scoreboard when changing possession of a scoring event', () => {
      store.setEventTypesList([
        {
          id: 't-try',
          name: 'Try',
          isScoring: true,
          points: 5,
          templateEventFields: []
        }
      ] as any);

      store.setEvents([
        {
          id: 'e-try-1',
          eventTypeId: 't-try',
          eventTypeName: 'Try',
          matchTime: 100,
          teamPossession: 'OWN',
          period: 1
        }
      ]);

      expect(store.scoreboard()).toEqual({ home: 5, away: 0 });

      // Transferir Try de OWN a OPPONENT -> rival suma +5, propio pierde 5
      store.updateEvent('e-try-1', { teamPossession: 'OPPONENT' });
      expect(store.scoreboard()).toEqual({ home: 0, away: 5 });
      expect(store.scoreDelta()).toEqual({ text: '+5', type: 'OPPONENT' });

      // Transferir Try de OPPONENT a OWN -> propio suma +5, rival pierde 5
      store.updateEvent('e-try-1', { teamPossession: 'OWN' });
      expect(store.scoreboard()).toEqual({ home: 5, away: 0 });
      expect(store.scoreDelta()).toEqual({ text: '+5', type: 'OWN' });
    });

    it('should trigger scoreDelta when adding and removing scoring events', () => {
      store.setEventTypesList([
        {
          id: 't-try',
          name: 'Try',
          isScoring: true,
          points: 5,
          templateEventFields: []
        }
      ] as any);
      store.setEvents([]);

      // Agregar Try rival
      store.addEvent({
        id: 'e-rival-try',
        eventTypeId: 't-try',
        eventTypeName: 'Try',
        matchTime: 200,
        teamPossession: 'OPPONENT',
        period: 1
      });
      expect(store.scoreboard()).toEqual({ home: 0, away: 5 });
      expect(store.scoreDelta()).toEqual({ text: '+5', type: 'OPPONENT' });

      // Eliminar Try rival
      store.removeEvent('e-rival-try');
      expect(store.scoreboard()).toEqual({ home: 0, away: 0 });
      expect(store.scoreDelta()).toEqual({ text: '-5', type: 'OPPONENT' });
    });
  });

  it('avisa cada alta, edición y baja confirmada (el servidor recalcula el marcador)', () => {
    let changes = 0;
    store.confirmedChange$.subscribe(() => changes++);
    store.setEvents([{ id: 'a', eventTypeId: 't', eventTypeName: 'Kick', matchTime: 100, period: 1, teamPossession: 'OWN' }]);
    expect(changes).withContext('cargar eventos no es un cambio').toBe(0);

    store.addEvent({ id: 'b', eventTypeId: 't', eventTypeName: 'Kick', matchTime: 200, period: 1, teamPossession: 'OWN' });
    store.updateEvent('a', { note: 'nota' });
    store.removeEvent('b');

    expect(changes).toBe(3);
  });

  describe('timelineLanes and activeLanesCount', () => {
    it('should maintain stable activeLanesCount and keep lanes present when filtering', () => {
      store.setEventTypesList([
        { id: 't-try', code: 'TRY', name: 'Try', groupName: 'General', isScoring: true, points: 5, category: 'ATTACK', affectsPossession: false, requiresPlayer: false, isActive: true, createdAt: '', showInPalette: true, followUpEventTypeId: null, templateEventFields: [] },
        { id: 't-tackle', code: 'TACKLE_MADE', name: 'Tackle acertado', groupName: 'General', isScoring: false, points: 0, category: 'DEFENSE', affectsPossession: false, requiresPlayer: false, isActive: true, createdAt: '', showInPalette: true, followUpEventTypeId: null, templateEventFields: [] }
      ] as any);

      // Try tiene jugador asignado, Tackle no tiene jugador asignado (isUnassigned = true)
      store.setEvents([
        { id: 'e1', eventTypeId: 't-try', eventTypeName: 'Try', playerId: 'p1', teamPossession: 'OWN', matchTime: 100, period: 1 },
        { id: 'e2', eventTypeId: 't-tackle', eventTypeName: 'Tackle acertado', playerId: null, teamPossession: 'OWN', matchTime: 200, period: 1 }
      ]);

      expect(store.activeLanesCount()).toBe(2);
      expect(store.timelineLanes().length).toBe(2);

      // Activar filtro solo pendientes (solo sin jugador)
      store.toggleOnlyUnassigned();

      const filteredLanes = store.timelineLanes();
      expect(store.activeLanesCount()).toBe(2); // Estabilidad garantizada
      expect(filteredLanes.length).toBe(2);

      // Try debe seguir presente en la lista, pero dimmed y con filteredCount = 0
      const tryLane = filteredLanes.find(l => l.eventTypeId === 't-try');
      expect(tryLane).toBeDefined();
      expect(tryLane?.totalCount).toBe(1);
      expect(tryLane?.filteredCount).toBe(0);
      expect(tryLane?.isDimmed).toBeTrue();

      // Tackle debe tener filteredCount = 1 y no estar dimmed
      const tackleLane = filteredLanes.find(l => l.eventTypeId === 't-tackle');
      expect(tackleLane).toBeDefined();
      expect(tackleLane?.totalCount).toBe(1);
      expect(tackleLane?.filteredCount).toBe(1);
      expect(tackleLane?.isDimmed).toBeFalse();
    });
  });

  it('oculta los eventos de tipos dados de baja en el catálogo', () => {
    const base = { matchTime: 600, absoluteMatchTime: 600, period: 1, teamPossession: 'OWN' as const, origin: 'live-capture' };
    const type = (id: string, isActive: boolean) => ({
      id, name: id, groupName: 'G', category: 'NEUTRAL' as const, isScoring: false, points: 0, requiresPlayer: false,
      code: id, showInPalette: true, followUpEventTypeId: null, actor: 'ATTACKING' as const,
      possessionAfter: 'KEEP' as const, followUpChoices: [], templateEventFields: [], isActive, createdAt: '',
    });
    store.setEventTypesList([type('active', true), type('retired', false)]);
    store.setEvents([
      { ...base, id: 'a', eventTypeId: 'active', eventTypeName: 'Activo' },
      { ...base, id: 'b', eventTypeId: 'retired', eventTypeName: 'Dado de baja' },
      { ...base, id: 'c', eventTypeId: 'missing', eventTypeName: 'Ya no está en el catálogo' },
    ]);

    expect(store.visibleEvents().map(event => event.id)).toEqual(['a']);
    expect(store.rawEvents().length).withContext('los eventos no se borran').toBe(3);
  });

  describe('hiddenByFilters y revealEvent', () => {
    const event: MatchTimelineEventResponse = {
      id: 'ev-1', eventTypeId: 'type-1', eventTypeName: 'Tackle completado',
      matchTime: 600, absoluteMatchTime: 600, period: 1, teamPossession: 'OWN', origin: 'post_capture'
    };

    beforeEach(() => store.setEvents([event]));

    it('no informa filtros si el evento se ve', () => {
      expect(store.hiddenByFilters('ev-1')).toEqual([]);
    });

    it('informa los filtros que ocultan el evento', () => {
      store.setPeriod(2);
      store.setSearchTerm('scrum');

      expect(store.hiddenByFilters('ev-1')).toEqual(['period', 'search']);
    });

    it('revealEvent limpia solo los filtros que lo ocultan y lo selecciona', () => {
      store.setPeriod(2);
      store.setTeamFilter('OWN');

      store.revealEvent('ev-1');

      expect(store.filters().period).toBe('ALL');
      expect(store.filters().team).withContext('un filtro que no lo oculta se conserva').toBe('OWN');
      expect(store.selectedEventId()).toBe('ev-1');
    });
  });
});
