import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { NEVER, of } from 'rxjs';

import { LiveCaptureService } from '../services/live-capture.service';
import { MatchService } from '../services/match.service';
import { StatisticCalculationService } from '../statistics/services/statistic-calculation.service';
import { LiveCaptureEventType } from '../types/event-type.types';
import { CargaEnVivoComponent } from './carga-en-vivo.component';
import { ToastService } from 'src/app/core/services/toast.service';
import { SyncStatusSource } from 'src/app/core/navigation/sync-status.source';
import { SyncStatus } from 'src/app/core/navigation/navigation.types';

declare const describe: (description: string, specDefinitions: () => void) => void;
declare const beforeEach: (action: () => void | Promise<void>) => void;
declare const it: (description: string, testFunction: () => void | Promise<void>) => void;
declare const expect: (actual: unknown) => {
  toBe(expected: unknown): void;
  toEqual(expected: unknown): void;
  not: {
    toBe(expected: unknown): void;
  };
};

const eventType = (overrides: Partial<LiveCaptureEventType> = {}): LiveCaptureEventType => ({
  id: 'event-type-try', name: 'Try', groupName: 'Ataque', category: 'ATTACK',
  isScoring: true, points: 5, requiresPlayer: true, isActive: true,
  code: 'TRY', showInPalette: true, followUpEventTypeId: null,
  actor: 'ATTACKING', possessionAfter: 'KEEP', followUpChoices: [], templateEventFields: [],
  createdAt: '2026-09-14T12:00:00Z',
  ...overrides,
});

const storedEvent = (id: string, eventTypeId: string, teamPossession: 'OWN' | 'OPPONENT', sequence: number) => ({
  id, eventTypeId, matchId: 'match', playerId: null, teamPossession, matchTime: sequence * 10, realTime: null,
  period: 1, origin: 'live-capture', attributes: null, createdAt: '2026-09-14T12:00:00Z',
  synchronizedAt: null, localSequence: sequence,
});

describe('CargaEnVivoComponent', () => {
  let fixture: ComponentFixture<CargaEnVivoComponent>;
  let component: CargaEnVivoComponent;
  let syncStatus: ReturnType<typeof signal<SyncStatus>>;

  beforeEach(async () => {
    syncStatus = signal<SyncStatus>({ state: 'synced', pendingCount: 0 });
    await TestBed.configureTestingModule({
      imports: [CargaEnVivoComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ matchId: '550e8400-e29b-41d4-a716-446655440002' }) } },
        },
        {
          provide: LiveCaptureService,
          useValue: {
            getLiveCaptureBootstrap: () => of({
              match: {
                id: '550e8400-e29b-41d4-a716-446655440002',
                date: '2026-09-14T12:00:00',
                divisionId: '550e8400-e29b-41d4-a716-446655440001',
                opponent: { id: 'opponent-1', name: 'DRC', alias: 'DRC', city: null },
                status: 'not_started' as const,
                currentPeriod: 1,
                clockElapsedSeconds: 0,
                clockPaused: true,
                currentPossession: 'OWN' as const,
                homeScore: 0,
                awayScore: 0,
              },
              query: {
                clubId: '550e8400-e29b-41d4-a716-446655440000',
                divisionId: '550e8400-e29b-41d4-a716-446655440001',
                matchId: '550e8400-e29b-41d4-a716-446655440002',
              },
              state: {
                homeTeam: 'PMRC',
                awayTeam: 'DRC',
                scoreboard: { home: 0, away: 0 },
                gameClock: '00:00',
                periodLabel: '1T',
                clockPaused: false,
                currentPossession: 'OWN',
                synchronized: false,
                history: [],
              },
              recentEvents: [],
              eventTypes: [],
              rosterPlayers: [],
            }),
            saveLiveCaptureState: () => of(undefined),
            saveEvent: (event: unknown) => of(event),
            syncPendingEvents: () => of([]),
            deleteEvent: () => of(undefined),
          },
        },
        {
          provide: MatchService,
          useValue: {
            closeFirstHalf: () => of(undefined),
            startSecondHalf: () => of(undefined),
            getPeriodStatistics: () => of({}),
          },
        },
        {
          provide: StatisticCalculationService,
          useValue: {
            calculateMatchStatistics: () => Promise.resolve({
              view: 'basic',
              score: { own: 10, opponent: 5 },
              ownPossessionPercentage: 50,
              groups: [],
              derived: [],
            }),
          },
        },
        {
          provide: SyncStatusSource,
          useValue: { status: syncStatus.asReadonly(), retry: () => Promise.resolve('done') },
        },
        {
          provide: ToastService,
          useValue: {
            warning: () => undefined,
            error: () => undefined,
            clear: () => undefined,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CargaEnVivoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should remove a persisted event from the rendered history', () => {
    component.eventTypes = [eventType({ requiresPlayer: false })];
    (component as any).events = [storedEvent('550e8400-e29b-41d4-a716-446655440011', 'event-type-try', 'OWN', 1)];

    component.removeHistoryEvent('550e8400-e29b-41d4-a716-446655440011');

    expect(component.history).toEqual([]);
  });

  it('should hide the history by default and toggle its visibility', () => {
    expect(component.historyVisible).toBe(false);

    component.toggleHistory();

    expect(component.historyVisible).toBe(true);
  });

  it('should offer only own and opponent possession controls', () => {
    const buttons = fixture.nativeElement.querySelectorAll('.possession-bar__btn');

    expect(buttons.length).toBe(2);
    expect(Array.from(buttons, (button: Element) => button.textContent?.trim())).toEqual(['Propia', 'Rival']);
  });

  it('should open the capture modal with a player step and cancel it without deleting an event', () => {
    component.isStarted = true;
    component.currentPossession = 'OWN';

    component.onEventTap(eventType());

    expect(component.capture).not.toBe(null);
    expect(component.captureStep?.kind).toBe('player');

    component.undoLastEvent();

    expect(component.capture).toBe(null);
    expect(component.currentPossession).toBe('OWN');
  });

  it('should require the same event to be tapped twice while the clock is paused', () => {
    const tryEvent = eventType({ id: 'try' });
    const tackleEvent = eventType({
      id: 'tackle',
      name: 'Tackle',
      code: 'TACKLE_MADE',
      isScoring: false,
      points: 0,
    });
    component.eventTypes = [tryEvent, tackleEvent];
    component.isStarted = true;
    component.clockPaused = true;

    component.onEventTap(tryEvent);
    expect(component.capture).toBe(null);

    component.onEventTap(tackleEvent);
    expect(component.capture).toBe(null);

    component.onEventTap(tryEvent);
    expect(component.capture).toBe(null);

    component.onEventTap(tryEvent);
    expect(component.capture?.event.id).toBe('try');
  });

  it('should clear the paused-event confirmation when the clock resumes', () => {
    const tryEvent = eventType({ id: 'try' });
    component.isStarted = true;
    component.clockPaused = true;

    component.onEventTap(tryEvent);
    component.toggleClock();
    component.toggleClock();
    component.onEventTap(tryEvent);

    expect(component.capture).toBe(null);
  });

  it('should save the event without a player when "Sin jugador" is picked', () => {
    component.eventTypes = [eventType()];
    component.isStarted = true;
    component.currentPossession = 'OWN';

    component.onEventTap(eventType());
    component.pickPlayer(null);

    expect(component.capture).toBe(null);
    expect((component as any).events[0].eventTypeId).toBe('event-type-try');
    expect((component as any).events[0].attributes).toBe(null);
  });

  it('should open the follow-up capture without waiting for the event to reach the server', () => {
    const liveCaptureService = TestBed.inject(LiveCaptureService);
    let syncRequests = 0;
    liveCaptureService.syncPendingEvents = () => {
      syncRequests += 1;
      return NEVER;
    };
    const conversion = eventType({ id: 'conversion', name: 'Conversión', code: 'CONVERSION', points: 2 });
    const tryEvent = eventType({ followUpEventTypeId: 'conversion' });
    component.eventTypes = [tryEvent, conversion];
    component.isStarted = true;
    component.currentPossession = 'OWN';

    component.onEventTap(tryEvent);
    component.pickPlayer(null);

    expect(component.capture?.event.id).toBe('conversion');
    expect(syncRequests).toBe(1);
  });

  it('should remove a deleted event without waiting for the deletion to reach the server', () => {
    const liveCaptureService = TestBed.inject(LiveCaptureService);
    let syncRequests = 0;
    liveCaptureService.syncPendingEvents = () => {
      syncRequests += 1;
      return NEVER;
    };
    component.eventTypes = [eventType({ requiresPlayer: false })];
    (component as any).events = [storedEvent('event-1', 'event-type-try', 'OWN', 1)];
    component.isStarted = true;
    (component as any).rebuildStateFromEvents();

    component.undoLastEvent();

    expect((component as any).events).toEqual([]);
    expect(component.scoreboard.home).toBe(0);
    expect(syncRequests).toBe(1);
  });

  it('should assign a defensive event to the team without the ball', () => {
    component.eventTypes = [eventType({ id: 'tackle', name: 'Tackle completado', code: 'TACKLE_MADE', isScoring: false, points: 0, actor: 'DEFENDING' })];
    component.isStarted = true;
    component.currentPossession = 'OPPONENT';

    component.onEventTap(component.eventTypes[0]);

    expect(component.capture?.team).toBe('OWN');
    expect(component.capture?.canChooseTeam).toBe(false);
  });

  it('should not ask for a player on rival events', () => {
    component.isStarted = true;
    component.currentPossession = 'OPPONENT';

    component.onEventTap(eventType());

    expect(component.capture).toBe(null);
    expect((component as any).events[0].playerId).toBe(null);
  });

  it('should let the analyst choose the team when the actor is CHOOSE', () => {
    component.isStarted = true;
    component.currentPossession = 'OWN';

    component.onEventTap(eventType({ id: 'card', name: 'Amonestación', code: 'YELLOW_CARD', isScoring: false, points: 0, actor: 'CHOOSE' }));

    expect(component.capture?.canChooseTeam).toBe(true);
  });

  it('should skip preset steps and resolve the follow-up team with the updated possession', () => {
    const touch = eventType({
      id: 'touch', name: 'Patada a touch', code: 'KICK_TO_TOUCH', isScoring: false, points: 0,
      templateEventFields: [{
        key: 'kind', label: 'Tipo', type: 'select', phase: 'live', required: true,
        options: [{ value: 'penalty_touch', label: 'Penal a touch' }, { value: 'open_play', label: 'Juego abierto' }],
      }, {
        key: 'outcome', label: 'Resultado', type: 'select', phase: 'live', required: true,
        options: [{ value: 'gained', label: 'Ganada' }, { value: 'lost', label: 'Perdida' }],
      }],
    });
    component.eventTypes = [touch];
    component.currentPossession = 'OPPONENT';

    component.pickFollowUp({ type: touch, label: touch.name, preset: { kind: 'penalty_touch' } });

    expect(component.capture?.steps.map(step => step.kind)).toEqual(['field']);
    expect(component.capture?.values).toEqual({ kind: 'penalty_touch' });
    expect(component.capture?.team).toBe('OPPONENT');
  });

  it('should revert score without changing possession when deleting an older event', () => {
    component.eventTypes = [
      eventType({ id: 'event-type-try', requiresPlayer: false, possessionAfter: 'OTHER' }),
      eventType({ id: 'event-type-turnover', name: 'Turnover ganado', code: 'TURNOVER_WON', isScoring: false, points: 0,
        requiresPlayer: false, actor: 'DEFENDING', possessionAfter: 'ACTOR' }),
    ];
    (component as any).events = [
      storedEvent('event-1', 'event-type-try', 'OWN', 1),
      storedEvent('event-2', 'event-type-turnover', 'OPPONENT', 2),
    ];
    component.currentPossession = 'OWN';
    component.isStarted = true;
    (component as any).rebuildStateFromEvents();

    component.undoHistoryEvent('event-1');

    expect(component.scoreboard.home).toBe(0);
    // El robo lo hizo OPPONENT y la pelota queda en él; borrar un evento viejo no la mueve.
    expect(component.currentPossession).toBe('OPPONENT');
  });

  it('should derive possession from the actor and the possession rule of the last event', () => {
    component.eventTypes = [
      eventType({ id: 'error', name: 'Error de manejo', code: 'HANDLING_ERROR', isScoring: false, points: 0, requiresPlayer: false, possessionAfter: 'OTHER' }),
      eventType({ id: 'lineout', name: 'Line-out', code: 'LINEOUT', isScoring: false, points: 0, requiresPlayer: false, possessionAfter: 'KEEP' }),
    ];
    (component as any).events = [
      storedEvent('event-1', 'error', 'OWN', 1),
      storedEvent('event-2', 'lineout', 'OPPONENT', 2),
    ];
    component.currentPossession = 'OWN';

    (component as any).rebuildStateFromEvents();

    expect(component.currentPossession).toBe('OPPONENT');
  });

  it('should apply the possession of the chosen option', () => {
    component.eventTypes = [eventType({
      id: 'scrum', name: 'Scrum', code: 'SCRUM', isScoring: false, points: 0, requiresPlayer: false,
      templateEventFields: [{
        key: 'scrumResult', label: 'Resultado', type: 'select', phase: 'live', required: true,
        options: [
          { value: 'won_clean', label: 'Ganó', possession: 'KEEP' },
          { value: 'lost_own', label: 'Perdió', possession: 'OTHER' },
        ],
      }],
    })];
    (component as any).events = [{ ...storedEvent('event-1', 'scrum', 'OWN', 1), attributes: { scrumResult: 'lost_own' } }];
    component.currentPossession = 'OWN';

    (component as any).rebuildStateFromEvents();

    expect(component.currentPossession).toBe('OPPONENT');
  });

  it('should open confirm halftime dialog when period button is clicked in period 1', () => {
    component.isStarted = true;
    component.period = 1;
    component.isHalftime = false;
    component.showConfirmHalftime = false;

    component.onPeriodButtonClick();

    expect(component.showConfirmHalftime).toBe(true);
  });

  it('should close first half and pause clock on confirm', async () => {
    component.period = 1;
    component.clockPaused = false;
    component.gameClock = '40:15';

    await component.confirmCloseFirstHalf();

    expect(component.isHalftime).toBe(true);
    expect(component.periodLabel).toBe('Entretiempo');
    expect(component.clockPaused).toBe(true);
  });

  describe('sync icon', () => {
    const syncIcon = (): HTMLElement => fixture.nativeElement.querySelector('.live-capture__sync');

    it('should show the cloud check when every change is synchronized', () => {
      syncStatus.set({ state: 'synced', pendingCount: 0 });
      fixture.detectChanges();

      expect(syncIcon().classList.contains('ti-cloud-check')).toBe(true);
      expect(syncIcon().getAttribute('aria-label')).toBe('Sincronizado');
    });

    it('should show the pending changes while online', () => {
      syncStatus.set({ state: 'pending', pendingCount: 2 });
      fixture.detectChanges();

      expect(syncIcon().classList.contains('ti-cloud-upload')).toBe(true);
      expect(syncIcon().getAttribute('aria-label')).toBe('2 sin sincronizar');
    });

    it('should refresh to synchronized once the pending changes are sent', () => {
      syncStatus.set({ state: 'pending', pendingCount: 1 });
      fixture.detectChanges();
      syncStatus.set({ state: 'synced', pendingCount: 0 });
      fixture.detectChanges();

      expect(syncIcon().classList.contains('ti-cloud-check')).toBe(true);
      expect(syncIcon().classList.contains('ti-cloud-upload')).toBe(false);
    });

    it('should show the cloud off without connection', () => {
      syncStatus.set({ state: 'offline', pendingCount: 3 });
      fixture.detectChanges();

      expect(syncIcon().classList.contains('ti-cloud-off')).toBe(true);
      expect(syncIcon().getAttribute('aria-label')).toBe('Sin conexión, guardando local');
    });
  });
});