import { Injectable, inject } from '@angular/core';
import { Observable, TimeoutError, defer, firstValueFrom, forkJoin, from, map, switchMap, catchError, of, shareReplay, timeout } from 'rxjs';
import {
  LiveCaptureBootstrap,
  LiveCaptureEventType,
  LiveCapturePersistedState,
  LiveCaptureQuery,
} from '../types/live-capture.types';
import { BackendEventResponse, LocalMatchEvent } from '../types/event.types';
import { LiveMatchStateRequest, Match } from '../types/match.types';
import { MatchService } from './match.service';
import { EventService } from './event.service';
import { RosterService } from './roster.service';
import { toLiveCaptureEventType } from './event-type.service';
import { AvailablePlayer, MatchRosterPlayer, SavedRoster } from '../types/roster.types';
import { eventTeam } from '../statistics/calculators/event-rules';
import { LocalDatabaseService } from '../../local-database/services/local-database.service';
import { PendingEventSyncService } from '../../../core/synchronization/pending-event-sync.service';

const HOME_TEAM_NAME = 'PMRC';

const BOOTSTRAP_REMOTE_TIMEOUT_MS = 3_000;

@Injectable({
  providedIn: 'root',
})
export class LiveCaptureService {
  private readonly cache = inject(LocalDatabaseService);
  private readonly matchService = inject(MatchService);
  private readonly eventService = inject(EventService);
  private readonly rosterService = inject(RosterService);
  private readonly pendingEventSync = inject(PendingEventSyncService);
  private readonly rosterPlayersByMatch = new Map<string, MatchRosterPlayer[]>();

  getLiveCaptureBootstrap(query: LiveCaptureQuery): Observable<LiveCaptureBootstrap> {
    return defer(() => from(this.readBootstrap(query)));
  }

  hydrateMatchEvents(matchId: string): Observable<LocalMatchEvent[]> {
    return this.eventService.getByMatch(matchId).pipe(
      switchMap(remoteEvents => from(this.cache.mergeRemoteEvents(matchId, remoteEvents))),
    );
  }

  saveLiveCaptureState(state: LiveCapturePersistedState): Observable<void> {
    const request: LiveMatchStateRequest = {
      clockElapsedSeconds: state.clockElapsedSeconds,
      clockPaused: state.clockPaused,
      currentPossession: state.currentPossession ?? 'OWN',
    };

    return from(this.cache.saveState(state)).pipe(
      switchMap(() => from(this.cache.getMatch(state.matchId))),
      switchMap(match => {
        if (match) {
          const updatedMatch = {
            ...match,
            clockElapsedSeconds: state.clockElapsedSeconds,
            clockPaused: state.clockPaused,
            clockUpdatedAt: new Date(state.savedAt).toISOString(),
            currentPossession: state.currentPossession ?? match.currentPossession,
          };
          return from(this.cache.saveMatches([updatedMatch]));
        }
        return of(undefined);
      }),
      switchMap(() => this.matchService.updateLiveMatchState(state.matchId, request)),
      map(() => undefined),
      catchError(() => of(undefined))
    );
  }

  saveEvent(event: LocalMatchEvent): Observable<LocalMatchEvent> {
    return from(this.resolvePlayer(event)).pipe(
      switchMap(localEvent => from(this.cache.saveEvent(localEvent))),
      map(savedEvent => ({
        ...savedEvent,
        localSequence: event.localSequence,
      }))
    );
  }

  syncPendingEvents(matchId?: string): Observable<LocalMatchEvent[]> {
    return defer(() => from(this.pendingEventSync.flush(matchId)));
  }

  getLocalEvents(matchId: string): Observable<LocalMatchEvent[]> {
    return defer(() => from(this.cache.getEventsByMatch(matchId)));
  }

  deleteEvent(event: LocalMatchEvent): Observable<void> {
    return defer(() => from(this.cache.deleteEvent(event)));
  }

  deleteMatchData(matchId: string): Observable<void> {
    return defer(() => from(this.cache.deleteMatchData(matchId)));
  }

  private async readBootstrap(query: LiveCaptureQuery): Promise<LiveCaptureBootstrap> {
    let match: Match;
    let remoteEvents: BackendEventResponse[] | null = null;
    let eventTypes: LiveCaptureEventType[];
    let players: AvailablePlayer[];
    let rosterPlayers: MatchRosterPlayer[];

    this.rosterService.getAvailablePlayers(query.matchId).subscribe();

    const remote$ = forkJoin({
      bootstrap: this.matchService.getLiveMatchBootstrap(query.matchId),
      rosterPlayers: this.rosterService.getMatchRosterPlayers(query.matchId),
    }).pipe(shareReplay({ bufferSize: 1, refCount: false }));

    try {
      const remote = await firstValueFrom(remote$.pipe(timeout(BOOTSTRAP_REMOTE_TIMEOUT_MS)))
        .catch(async error => {
          if (error instanceof TimeoutError && !(await this.cache.getMatch(query.matchId))) {
            return firstValueFrom(remote$);
          }
          throw error;
        });
      match = remote.bootstrap.match;
      remoteEvents = remote.bootstrap.events;
      rosterPlayers = remote.rosterPlayers;
      eventTypes = remote.bootstrap.eventTypes.map(toLiveCaptureEventType);
      await this.cache.syncActiveEventTypes(eventTypes);
    } catch {
      const localMatch = await this.cache.getMatch(query.matchId);
      if (!localMatch) {
        throw new Error(`Match ${query.matchId} is unavailable offline`);
      }

      match = localMatch;
      [eventTypes, players] = await Promise.all([
        this.cache.getActiveEventTypes(),
        localMatch.divisionId ? this.cache.getPersonsByDivisionId(localMatch.divisionId) : Promise.resolve([]),
      ]);
      const cachedRoster = await this.cache.getRoster(query.matchId);
      rosterPlayers = this.toRosterPlayers(cachedRoster, players);
    }

    if (match.status === 'cancelled') {
      throw new Error(`Match ${query.matchId} was cancelled`);
    }
    const resolvedQuery = {
      ...query,
      divisionId: match.divisionId,
    };
    this.rosterPlayersByMatch.set(query.matchId, rosterPlayers);
    const substitutePlayers = rosterPlayers.filter(player => player.role === 'SUPLENTE');
    const events = remoteEvents
      ? await this.cache.mergeRemoteEvents(query.matchId, remoteEvents)
      : await this.cache.getEventsByMatch(query.matchId);
    const isHalftime = match.status === 'halftime';
    const period = match.currentPeriod ?? 1;
    const periodLabel = isHalftime ? 'Entretiempo' : (period === 2 ? '2T' : '1T');

    return {
      query: resolvedQuery,
      match,
      state: {
        homeTeam: HOME_TEAM_NAME,
        awayTeam: match.opponent.alias,
        scoreboard: {
          home: match.homeScore ?? 0,
          away: match.awayScore ?? 0,
        },
        gameClock: this.formatClock(match.clockElapsedSeconds ?? 0),
        period,
        periodLabel,
        clockPaused: match.clockPaused ?? true,
        clockUpdatedAt: match.clockUpdatedAt,
        currentPossession: match.currentPossession ?? 'OWN',
        synchronized: true,
        isHalftime,
        history: [],
      },
      recentEvents: events,
      eventTypes,
      rosterPlayers,
      substitutePlayers,
    };
  }

  private formatClock(totalSeconds: number): string {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  private async resolvePlayer(event: LocalMatchEvent): Promise<LocalMatchEvent> {
    if (event.playerId) return event;

    const eventTypes = await this.cache.getEventTypes();
    const et = eventTypes.find(t => t.id === event.eventTypeId);
    if (eventTeam(et, event) !== 'OWN') return event;

    const raw = event.attributes?.['playerNumber'];
    if (raw === null || raw === undefined || raw === '') return event;
    const matchNumber = Number(raw);
    if (!Number.isInteger(matchNumber) || matchNumber < 1) return event;

    const rosterPlayers = this.rosterPlayersByMatch.get(event.matchId)
      ?? await this.readCachedRosterPlayers(event.matchId);
    const player = rosterPlayers.find(candidate => candidate.number === matchNumber);

    return player ? { ...event, playerId: player.id } : event;
  }

  private async readCachedRosterPlayers(matchId: string): Promise<MatchRosterPlayer[]> {
    const [match, savedRoster] = await Promise.all([
      this.cache.getMatch(matchId),
      this.cache.getRoster(matchId),
    ]);
    if (!match?.divisionId || !savedRoster) {
      return [];
    }
    const players = await this.cache.getPersonsByDivisionId(match.divisionId);
    return this.toRosterPlayers(savedRoster, players);
  }

  private toRosterPlayers(roster: SavedRoster | undefined, players: AvailablePlayer[]): MatchRosterPlayer[] {
    if (!roster) return [];
    return [...roster.startingPlayers, ...roster.substitutePlayers]
      .map(entry => {
        const player = players.find(candidate => candidate.id === entry.playerId);
        return player ? {
          id: player.id,
          fullName: player.fullName,
          position: player.position,
          number: entry.number,
          role: entry.role ?? (roster.startingPlayers.includes(entry) ? 'TITULAR' : 'SUPLENTE'),
          fieldStatus: entry.fieldStatus ?? (entry.role === 'TITULAR' ? 'EN_CANCHA' : 'EN_BANCO'),
          fieldSlot: entry.fieldSlot ?? null,
          slotOrder: entry.slotOrder ?? null,
        } : null;
      })
      .filter((player): player is MatchRosterPlayer => player !== null);
  }


}