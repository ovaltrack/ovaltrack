import { Injectable } from '@angular/core';
import { liveCaptureDatabase, matchDatabase } from '../local-databases';
import { LiveCaptureEventType, LiveCapturePersistedState } from '../../match/types/live-capture.types';
import { BackendEventResponse, LocalMatchEvent } from '../../match/types/event.types';
import { Match, MatchStatus, PendingMatchMutation, isOfflineMatch } from '../../match/types/match.types';
import { Division } from '../../division/types/division.types';
import { AvailablePlayer, SavedRoster } from '../../match/types/roster.types';
import { UserContext } from '../../auth/types/auth.types';

/**
 * Evento que la sincronización todavía tiene que enviar: sin sincronizar, no rechazado por el servidor,
 * y activo o borrado localmente después de existir en el backend.
 */
function isPendingEvent(event: LocalMatchEvent): boolean {
  return event.synchronizedAt === null
    && !event.syncFailedAt
    && (event.active || event.backendEventId != null);
}

@Injectable({ providedIn: 'root' })
export class LocalDatabaseService {

  saveUserContext(context: UserContext): Promise<void> {
    return matchDatabase.userContexts.put({
      ...context,
      cachedAt: Date.now(),
    }).then(() => undefined);
  }

  getUserContext(userId: string): Promise<UserContext | undefined> {
    return matchDatabase.userContexts.get(userId);
  }

  getMatch(matchId: string): Promise<Match | undefined> {
    return matchDatabase.matches.get(matchId);
  }

  saveMatches(matches: Match[]): Promise<void> {
    return matchDatabase.matches.bulkPut(matches).then(() => undefined);
  }

  /**
   * Alinea IndexedDB con los partidos que devolvió el backend: guarda los que se usan sin conexión
   * (`isOfflineMatch`) y borra los demás junto con su plantel. Un partido con una transición pendiente
   * no se modifica
   */
  syncOfflineMatches(matches: Match[]): Promise<void> {
    return matchDatabase.transaction(
      'rw',
      matchDatabase.matches,
      matchDatabase.rosters,
      matchDatabase.pendingMatchMutations,
      async () => {
        const pendingMatchIds = new Set(
          (await this.getPendingMatchMutations()).map(mutation => mutation.matchId),
        );
        const syncable = matches.filter(match => !pendingMatchIds.has(match.id));
        const staleMatchIds = syncable.filter(match => !isOfflineMatch(match)).map(match => match.id);

        await matchDatabase.matches.bulkDelete(staleMatchIds);
        await matchDatabase.rosters.bulkDelete(staleMatchIds);
        await this.saveMatches(syncable.filter(isOfflineMatch));
      },
    );
  }

  getMatchesByStatus(statuses: readonly MatchStatus[]): Promise<Match[]> {
    return matchDatabase.matches.filter(match => statuses.includes(match.status)).toArray();
  }

  getMatchesByDivision(divisionId: string): Promise<Match[]> {
    return matchDatabase.matches.where('divisionId').equals(divisionId).toArray();
  }

  saveDivisions(divisions: Division[]): Promise<void> {
    return matchDatabase.divisions.bulkPut(divisions).then(() => undefined);
  }

  getDivisionsByClub(clubId: string): Promise<Division[]> {
    return matchDatabase.divisions.where('clubId').equals(clubId).toArray();
  }

  saveRoster(matchId: string, roster: SavedRoster): Promise<void> {
    return matchDatabase.rosters.put({
      matchId,
      startingPlayers: roster.startingPlayers,
      substitutePlayers: roster.substitutePlayers,
    }).then(() => undefined);
  }

  getRoster(matchId: string): Promise<SavedRoster | undefined> {
    return matchDatabase.rosters.get(matchId).then(roster => {
      if (!roster || !this.isEnrichedRoster(roster)) {
        return undefined;
      }
      return roster;
    });
  }

  private isEnrichedRoster(roster: SavedRoster): boolean {
    const players = [...roster.startingPlayers, ...roster.substitutePlayers];
    return players.every(player =>
      Number.isInteger(player.number)
      && player.number > 0
      && typeof player.playerId === 'string'
      && player.fieldStatus !== undefined
      && player.slotOrder !== undefined
    );
  }
  
  savePersonsByDivisionId(players: (AvailablePlayer & { divisionId: string })[]): Promise<void> {
    return matchDatabase.divisionPlayers.bulkPut(players).then(() => undefined);
  }

  getPersonsByDivisionId(divisionId: string): Promise<AvailablePlayer[]> {
    return matchDatabase.divisionPlayers.where('divisionId').equals(divisionId).toArray();
  }

  savePendingMatchMutation(mutation: PendingMatchMutation): Promise<void> {
    return matchDatabase.pendingMatchMutations.put(mutation).then(() => undefined);
  }

  getPendingMatchMutations(): Promise<PendingMatchMutation[]> {
    return matchDatabase.pendingMatchMutations.orderBy('createdAt').toArray();
  }

  deletePendingMatchMutation(id: string): Promise<void> {
    return matchDatabase.pendingMatchMutations.delete(id).then(() => undefined);
  }

  completePendingMatchMutation(mutation: PendingMatchMutation, serverMatch: Match): Promise<boolean> {
    return matchDatabase.transaction(
      'rw',
      matchDatabase.pendingMatchMutations,
      matchDatabase.matches,
      async () => {
        if (!await this.isPendingMutationUnchanged(mutation)) {
          return false;
        }
        await matchDatabase.pendingMatchMutations.delete(mutation.id);
        await matchDatabase.matches.put(serverMatch);
        return true;
      },
    );
  }

  discardPendingMatchMutation(mutation: PendingMatchMutation): Promise<boolean> {
    return matchDatabase.transaction('rw', matchDatabase.pendingMatchMutations, async () => {
      if (!await this.isPendingMutationUnchanged(mutation)) {
        return false;
      }
      await matchDatabase.pendingMatchMutations.delete(mutation.id);
      return true;
    });
  }

  private async isPendingMutationUnchanged(mutation: PendingMatchMutation): Promise<boolean> {
    const current = await matchDatabase.pendingMatchMutations.get(mutation.id);
    return current !== undefined
      && current.createdAt === mutation.createdAt
      && current.action === mutation.action;
  }

  getEventTypes(): Promise<LiveCaptureEventType[]> {
    return liveCaptureDatabase.eventTypes.toArray();
  }

  saveEventTypes(eventTypes: LiveCaptureEventType[]): Promise<void> {
    return liveCaptureDatabase.eventTypes.bulkPut(eventTypes).then(() => undefined);
  }

  getActiveEventTypes(): Promise<LiveCaptureEventType[]> {
    return liveCaptureDatabase.eventTypes.filter(eventType => eventType.isActive !== false).toArray();
  }


  syncActiveEventTypes(activeEventTypes: LiveCaptureEventType[]): Promise<void> {
    if (activeEventTypes.length === 0) {
      return Promise.resolve();
    }

    return liveCaptureDatabase.transaction('rw', liveCaptureDatabase.eventTypes, async () => {
      const activeIds = new Set(activeEventTypes.map(eventType => eventType.id));
      await liveCaptureDatabase.eventTypes
        .filter(eventType => !activeIds.has(eventType.id) && eventType.isActive !== false)
        .modify({ isActive: false });
      await liveCaptureDatabase.eventTypes.bulkPut(activeEventTypes);
    });
  }

  saveState(state: LiveCapturePersistedState): Promise<void> {
    return liveCaptureDatabase.states.put(state).then(() => undefined);
  }

  saveEvent(event: LocalMatchEvent): Promise<LocalMatchEvent> {
    return liveCaptureDatabase.events.put(event).then(() => event);
  }

  markEventSynchronized(sentEvent: LocalMatchEvent, response: BackendEventResponse): Promise<LocalMatchEvent | undefined> {
    return liveCaptureDatabase.transaction('rw', liveCaptureDatabase.events, async () => {
      const currentEvent = await liveCaptureDatabase.events.get(sentEvent.id);
      if (!currentEvent) {
        return undefined;
      }

      const changedWhileInFlight = currentEvent.active !== sentEvent.active;
      const synchronizedEvent: LocalMatchEvent = {
        ...currentEvent,
        backendEventId: response.id,
        synchronizedAt: changedWhileInFlight ? null : response.synchronizedAt,
        syncAttempts: 0,
        syncFailedAt: null,
        syncErrorMessage: null,
      };
      await liveCaptureDatabase.events.put(synchronizedEvent);
      return synchronizedEvent;
    });
  }

  markEventSyncFailed(sentEvent: LocalMatchEvent, errorMessage: string): Promise<boolean> {
    return liveCaptureDatabase.transaction('rw', liveCaptureDatabase.events, async () => {
      const currentEvent = await liveCaptureDatabase.events.get(sentEvent.id);
      if (!currentEvent || currentEvent.active !== sentEvent.active) {
        return false;
      }

      await liveCaptureDatabase.events.put({
        ...currentEvent,
        syncAttempts: (currentEvent.syncAttempts ?? 0) + 1,
        syncFailedAt: new Date().toISOString(),
        syncErrorMessage: errorMessage,
      });
      return true;
    });
  }

  recordEventSyncAttempt(eventId: string): Promise<void> {
    return liveCaptureDatabase.transaction('rw', liveCaptureDatabase.events, async () => {
      const currentEvent = await liveCaptureDatabase.events.get(eventId);
      if (currentEvent) {
        await liveCaptureDatabase.events.put({
          ...currentEvent,
          syncAttempts: (currentEvent.syncAttempts ?? 0) + 1,
        });
      }
    });
  }

  async mergeRemoteEvents(matchId: string, remoteEvents: BackendEventResponse[]): Promise<LocalMatchEvent[]> {
    await liveCaptureDatabase.transaction('rw', liveCaptureDatabase.events, async () => {
      const localEvents = await liveCaptureDatabase.events.where('matchId').equals(matchId).toArray();
      const byLocalId = new Map(localEvents.map(event => [event.id, event]));
      const byBackendId = new Map(
        localEvents
          .filter(event => event.backendEventId)
          .map(event => [event.backendEventId!, event]),
      );
      const byClientId = new Map(
        localEvents
          .filter(event => event.clientEventId)
          .map(event => [event.clientEventId!, event]),
      );
      let nextSequence = localEvents.reduce(
        (highest, event) => Math.max(highest, event.localSequence),
        0,
      );

      for (const remoteEvent of remoteEvents) {
        const localEvent = byBackendId.get(remoteEvent.id)
          ?? (remoteEvent.clientEventId ? byLocalId.get(remoteEvent.clientEventId) : undefined)
          ?? (remoteEvent.clientEventId ? byClientId.get(remoteEvent.clientEventId) : undefined);

        const hasPendingLocalDeletion = localEvent && !localEvent.active && localEvent.synchronizedAt === null;
        if (hasPendingLocalDeletion) {
          if (!localEvent.backendEventId) {
            const pendingDeletion: LocalMatchEvent = { ...localEvent, backendEventId: remoteEvent.id };
            await liveCaptureDatabase.events.put(pendingDeletion);
            byBackendId.set(remoteEvent.id, pendingDeletion);
          }
          continue;
        }

        const event: LocalMatchEvent = {
          ...remoteEvent,
          active: remoteEvent.active ?? true,
          id: localEvent?.id ?? remoteEvent.clientEventId ?? remoteEvent.id,
          backendEventId: remoteEvent.id,
          localSequence: localEvent?.localSequence ?? ++nextSequence,
        };

        await liveCaptureDatabase.events.put(event);
        byLocalId.set(event.id, event);
        byBackendId.set(event.backendEventId!, event);
        if (event.clientEventId) {
          byClientId.set(event.clientEventId, event);
        }
      }

      const remoteIds = new Set(remoteEvents.map(remoteEvent => remoteEvent.id));
      for (const localEvent of localEvents) {
        const deletedRemotely = localEvent.active
          && localEvent.synchronizedAt !== null
          && localEvent.backendEventId != null
          && !remoteIds.has(localEvent.backendEventId);
        if (deletedRemotely) {
          await liveCaptureDatabase.events.put({ ...localEvent, active: false });
        }
      }
    });

    return this.getEventsByMatch(matchId);
  }

  async deleteEvent(event: LocalMatchEvent): Promise<void> {
    await liveCaptureDatabase.events.update(event.id, {
      active: false,
      synchronizedAt: null,
      syncFailedAt: null,
      syncErrorMessage: null,
    });
  }

  getStatusData(matchId: string): Promise<{
    state: LiveCapturePersistedState | undefined;
    events: LocalMatchEvent[];
  }> {
    return Promise.all([
      liveCaptureDatabase.states.get(matchId),
      liveCaptureDatabase.events.where('matchId').equals(matchId).toArray(),
    ]).then(([state, events]) => ({ state, events }));
  }

  /** Partidos que este dispositivo abrió en captura (solo lectura). */
  getCaptureStates(): Promise<LiveCapturePersistedState[]> {
    return liveCaptureDatabase.states.toArray();
  }

  getEventsByMatch(matchId: string): Promise<LocalMatchEvent[]> {
    return liveCaptureDatabase.events
      .where('matchId')
      .equals(matchId)
      .filter(event => event.active === true)
      .sortBy('localSequence');
  }

  getPendingEvents(matchId?: string): Promise<LocalMatchEvent[]> {
    const eventsQuery = matchId
      ? liveCaptureDatabase.events.where('matchId').equals(matchId)
      : liveCaptureDatabase.events.toCollection();

    return eventsQuery.toArray().then(events => events
      .filter(isPendingEvent)
      .sort((first, second) => first.localSequence - second.localSequence));
  }

  /**
   * Cambios locales que la sincronización todavía tiene que enviar: eventos pendientes y transiciones de partido.
   * Solo lectura; dentro de un `liveQuery` de Dexie se vuelve a calcular cuando cambian esas tablas.
   */
  async countPendingChanges(): Promise<number> {
    const [pendingEvents, pendingMutations] = await Promise.all([
      liveCaptureDatabase.events.filter(isPendingEvent).count(),
      matchDatabase.pendingMatchMutations.count(),
    ]);
    return pendingEvents + pendingMutations;
  }

  /**
   * Borra la caché de la sesión y conserva lo que no está en el backend (incluidos los rechazados).
   * @returns los cambios que todavía se van a enviar; los rechazados no cuentan porque no se reintentan.
   */
  async clearCachedDataOnLogout(): Promise<number> {
    try {
      localStorage.removeItem('ovaltrack.live-match-visits');
    } catch {
      // Sin almacenamiento no hay nada que borrar.
    }
    await Promise.all([
      matchDatabase.userContexts.clear(),
      matchDatabase.matches.clear(),
      matchDatabase.divisions.clear(),
      matchDatabase.rosters.clear(),
      matchDatabase.divisionPlayers.clear(),
      liveCaptureDatabase.eventTypes.clear(),
      liveCaptureDatabase.states.clear(),
      liveCaptureDatabase.events
        .filter(event => event.synchronizedAt !== null || (!event.active && event.backendEventId == null))
        .delete(),
    ]);

    return this.countPendingChanges();
  }

  deleteMatchData(matchId: string): Promise<void> {
    return liveCaptureDatabase.transaction(
      'rw',
      liveCaptureDatabase.states,
      liveCaptureDatabase.events,
      async () => {
        await liveCaptureDatabase.states.delete(matchId);
        await liveCaptureDatabase.events.where('matchId').equals(matchId).delete();
      },
    );
  }
}