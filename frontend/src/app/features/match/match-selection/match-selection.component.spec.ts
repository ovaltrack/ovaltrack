import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';

import { MatchSelectComponent } from './match-selection.component';
import { MatchService } from '../services/match.service';
import { RosterService } from '../services/roster.service';
import { LiveCaptureService } from '../services/live-capture.service';
import { Match, MatchStatus } from '../types/match.types';
import { buildMatch } from '../../../testing/offline-test-helpers';
import { clearPersistedSignals } from '../../../shared/utils/persisted-signal';

const divisionMatch = (id: string, status: MatchStatus): Match => buildMatch({ id, divisionId: 'division-1', status });

describe('MatchSelectionComponent', () => {
  let component: MatchSelectComponent;
  let fixture: ComponentFixture<MatchSelectComponent>;
  let divisionPlayersRequests: string[];
  let availablePlayersRequests: string[];
  let savedRosterRequests: string[];
  let matchEventsRequests: string[];
  let divisionMatches: Match[];
  let navigations: unknown[][];
  let finishNavigation: () => void;

  beforeEach(async () => {
    // Los filtros se guardan en sessionStorage: sin esto, un test le pasaría su filtro al siguiente.
    clearPersistedSignals();
    divisionPlayersRequests = [];
    availablePlayersRequests = [];
    savedRosterRequests = [];
    matchEventsRequests = [];
    divisionMatches = [];
    navigations = [];
    finishNavigation = () => undefined;
    await TestBed.configureTestingModule({
      imports: [MatchSelectComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: Router,
          useValue: {
            // La navegación queda pendiente hasta que el test llama a finishNavigation().
            navigate: (commands: unknown[]) => {
              navigations.push(commands);
              return new Promise<boolean>(resolve => { finishNavigation = () => resolve(true); });
            },
          },
        },
        {
          provide: MatchService,
          useValue: {
            getMatches: () => of([]),
            getAllMatchesByDivisionId: () => of(divisionMatches),
            createMatch: () => of({}),
            deleteMatch: () => of(undefined),
          },
        },
        {
          provide: RosterService,
          useValue: {
            getSavedRoster: (matchId: string) => {
              savedRosterRequests.push(matchId);
              return of(null);
            },
            getDivisionPlayers: (divisionId: string) => {
              divisionPlayersRequests.push(divisionId);
              return of([]);
            },
            getAvailablePlayers: (matchId: string) => {
              availablePlayersRequests.push(matchId);
              return of([]);
            },
          },
        },
        {
          provide: LiveCaptureService,
          useValue: {
            hydrateMatchEvents: (matchId: string) => {
              matchEventsRequests.push(matchId);
              return of([]);
            },
          },
        },
      ],
    })
      .compileComponents();

    fixture = TestBed.createComponent(MatchSelectComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should request the division players once, not once per match, when loading the division matches', () => {
    divisionMatches = [divisionMatch('ready-1', 'not_started'), divisionMatch('ready-2', 'not_started')];

    component.loadMatchesForDivision('division-1');

    expect(divisionPlayersRequests).toEqual(['division-1']);
    expect(availablePlayersRequests).toEqual([]);
  });

  it('should only cache roster and events of the matches that can be captured offline', () => {
    divisionMatches = [
      divisionMatch('new', 'empty_roster'),
      divisionMatch('ready', 'not_started'),
      divisionMatch('live', 'in_progress'),
      divisionMatch('break', 'halftime'),
      divisionMatch('played', 'finished'),
      divisionMatch('cancelled', 'cancelled'),
    ];

    component.loadMatchesForDivision('division-1');

    expect(savedRosterRequests).toEqual(['ready', 'live', 'break']);
    // Un partido sin iniciar todavía no tiene eventos.
    expect(matchEventsRequests).toEqual(['live', 'break']);
  });

  it('should not request anything to cache when the division has no match to capture', () => {
    divisionMatches = [divisionMatch('new', 'empty_roster'), divisionMatch('played', 'finished')];

    component.loadMatchesForDivision('division-1');

    expect(divisionPlayersRequests).toEqual([]);
    expect(savedRosterRequests).toEqual([]);
    expect(matchEventsRequests).toEqual([]);
  });

  describe('match without roster (empty_roster)', () => {
    const sameDay = '2026-10-23T15:00:00';
    const multiMonthDay = { view: { type: 'multiMonthYear' }, date: new Date(2026, 9, 23) };

    it('should offer a "Sin plantel" filter that lists only the matches without roster', () => {
      component.matches = [
        buildMatch({ id: 'new', status: 'empty_roster' }),
        buildMatch({ id: 'ready', status: 'not_started' }),
      ];

      component.setFilter('empty_roster');

      expect(component.filters.includes('empty_roster')).toBeTrue();
      expect(component.statusLabels['empty_roster']).toBe('Sin plantel');
      expect(component.visibleMatches.map(match => match.id)).toEqual(['new']);
    });

    it('should label each pending status with the shared status labels', () => {
      expect(component.getDetailedStatusLabel(buildMatch({ status: 'empty_roster' }))).toBe('Sin plantel');
      expect(component.getDetailedStatusLabel(buildMatch({ status: 'not_started' }))).toBe('No iniciado');
      expect(component.getDetailedStatusLabel(buildMatch({ status: 'in_progress' }))).toBe('En progreso');
      expect(component.getDetailedStatusLabel(buildMatch({ status: 'halftime' }))).toBe('Entretiempo');
      expect(component.getDetailedStatusLabel(buildMatch({ status: 'cancelled' }))).toBe('Cancelado');
      expect(component.getDetailedStatusLabel(buildMatch({ status: 'finished', homeScore: 10, awayScore: 3 }))).toBe('Ganado');
    });

    it('should not share the cancelled color', () => {
      const newGameColor = component.getMatchColor(buildMatch({ status: 'empty_roster' }));

      expect(newGameColor).toBe('var(--player)');
      expect(newGameColor).not.toBe(component.getMatchColor(buildMatch({ status: 'cancelled' })));
    });

    it('should paint a day with a match without roster over a finished one', () => {
      component.matches = [
        buildMatch({ id: 'played', date: sameDay, status: 'finished' }),
        buildMatch({ id: 'new', date: sameDay, status: 'empty_roster' }),
      ];

      expect(component.getDayClassNames(multiMonthDay)).toEqual(['day-with-match', 'day-status-new_game']);
    });

    it('should paint a day with a ready match over one without roster', () => {
      component.matches = [
        buildMatch({ id: 'new', date: sameDay, status: 'empty_roster' }),
        buildMatch({ id: 'ready', date: sameDay, status: 'not_started' }),
      ];

      expect(component.getDayClassNames(multiMonthDay)).toEqual(['day-with-match', 'day-status-ready']);
    });
  });

  describe('opening a match', () => {
    const settle = () => new Promise(resolve => setTimeout(resolve));

    it('should mark the match as opening until the navigation finishes', async () => {
      component.openMatch(divisionMatch('played', 'finished'));

      expect(component.openingMatchId()).toBe('played');
      expect(navigations).toEqual([['/post-match', 'played']]);

      finishNavigation();
      await settle();

      expect(component.openingMatchId()).toBeNull();
    });

    it('should ignore another match while one is opening', () => {
      component.openMatch(divisionMatch('played', 'finished'));
      component.openMatch(divisionMatch('ready', 'not_started'));

      expect(navigations).toEqual([['/post-match', 'played']]);
      expect(component.openingMatchId()).toBe('played');
    });

    it('should stop opening without navigating when the roster is incomplete', async () => {
      component.startMatch('ready');
      await settle();

      expect(navigations).toEqual([]);
      expect(savedRosterRequests).toEqual(['ready']);
      expect(component.openingMatchId()).toBeNull();
    });

    it('should not show the indicator when the match opens quickly', async () => {
      component.openMatch(divisionMatch('played', 'finished'));
      finishNavigation();
      await settle();

      expect(component.openingGate.showIndicator()).toBeFalse();
      expect(component.isShowingOpening('played')).toBeFalse();
    });
  });

  describe('remembering the filters in the tab', () => {
    const recreate = (): MatchSelectComponent => TestBed.createComponent(MatchSelectComponent).componentInstance;

    it('should keep the status filter after leaving and coming back to the screen', () => {
      component.setFilter('finished');

      expect(recreate().activeFilter()).toBe('finished');
    });

    it('should keep the cards view of the finished matches', () => {
      component.setFilter('finished');
      component.isCalendarView.set(true);

      expect(recreate().isCalendarView()).toBeTrue();
    });

    it('should show the restored division in the selector, not the first one', () => {
      component.userDivisions = [{ id: 'primera', name: 'Primera' }, { id: 'm19', name: 'M19' }];
      component.selectedDivisionId.set('m19');
      fixture.detectChanges();

      const select: HTMLSelectElement = fixture.nativeElement.querySelector('#divisionSelect');
      expect(select.value).toBe('m19');
      expect(select.selectedOptions[0].textContent?.trim()).toBe('M19');
    });

    it('should ignore a saved filter that no longer exists', () => {
      sessionStorage.setItem('ovaltrack.view.match-selection.filter', JSON.stringify('postponed'));

      expect(recreate().activeFilter()).toBe('all');
    });
  });
});
