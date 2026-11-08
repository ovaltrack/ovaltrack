import { LiveCaptureEventType } from '../../types/event-type.types';
import { BackendEventResponse } from '../../types/event.types';
import { PlayerStatColumn, PlayerStatistic, PlayerStatistics, StatView } from '../types/statistic.types';
import { countsAsScoring } from './event-rules';
import { creditedTeam, readNumber } from './match-statistics-calculator';
import { isScoringField, isTypeInView } from './stat-view';

const HALF_MINUTES = 40;

export interface RosterPlayerInfo {
  playerId: string;
  jerseyNumber: number;
  playerName: string;
  position?: string;
  isStarter: boolean;
}

/** Columnas de la planilla: los tipos de la vista que se cargan con jugador, en orden de catálogo. */
export function playerStatColumns(eventTypes: LiveCaptureEventType[], view: StatView): PlayerStatColumn[] {
  return eventTypes
    .filter(type => type.requiresPlayer && type.isActive !== false && isTypeInView(type, view))
    .map(type => ({
      eventTypeId: type.id,
      code: type.code,
      label: type.name,
      groupName: type.groupName || 'General',
      isScoring: type.isScoring,
      hasAttempts: type.isScoring && (type.templateEventFields ?? []).some(isScoringField),
    }));
}

/**
 * Estadísticas individuales: por cada tipo de la vista que requiere jugador, cuántos eventos
 * (y en los que suman, cuántos contaron). Los puntos incluyen todos los tipos que suman.
 * Un evento se atribuye por `playerId` o por `playerNumber` (número de slot) del equipo propio.
 * Recibe eventos activos ya filtrados por período.
 */
export function computePlayerStatistics(
  events: BackendEventResponse[],
  roster: RosterPlayerInfo[],
  eventTypes: LiveCaptureEventType[],
  view: StatView,
): PlayerStatistics {
  const typeById = new Map(eventTypes.map(type => [type.id, type]));
  const columns = playerStatColumns(eventTypes, view);

  const eventsByPlayerId = new Map<string, BackendEventResponse[]>();
  const eventsBySlot = new Map<number, BackendEventResponse[]>();
  const push = <K>(map: Map<K, BackendEventResponse[]>, key: K, event: BackendEventResponse) =>
    map.set(key, [...(map.get(key) ?? []), event]);

  for (const event of events) {
    if (event.playerId) {
      push(eventsByPlayerId, event.playerId, event);
    }
    const type = typeById.get(event.eventTypeId);
    const slot = readNumber(event.attributes?.['playerNumber']);
    if (type && slot !== null && creditedTeam(type, event) !== 'OPPONENT') {
      push(eventsBySlot, slot, event);
    }
  }

  const players: PlayerStatistic[] = roster.map(player => {
    const playerEvents = new Map<string, BackendEventResponse>();
    for (const event of eventsByPlayerId.get(player.playerId) ?? []) playerEvents.set(event.id, event);
    for (const event of eventsBySlot.get(player.jerseyNumber) ?? []) playerEvents.set(event.id, event);

    const values: PlayerStatistic['values'] = {};
    for (const column of columns) {
      values[column.eventTypeId] = { count: 0, made: column.isScoring ? 0 : null };
    }

    let totalPoints = 0;
    for (const event of playerEvents.values()) {
      const type = typeById.get(event.eventTypeId);
      if (!type) continue;
      const scored = countsAsScoring(type, event.attributes);
      if (scored) totalPoints += type.points ?? 0;

      const value = values[type.id];
      if (!value) continue;
      value.count++;
      if (scored && value.made !== null) value.made++;
    }

    return {
      playerId: player.playerId,
      jerseyNumber: player.jerseyNumber,
      playerName: player.playerName,
      position: player.position,
      isStarter: player.isStarter,
      minutesPlayed: player.isStarter ? HALF_MINUTES : 0,
      totalPoints,
      values,
      hasActivity: totalPoints > 0 || Object.values(values).some(value => value.count > 0),
    };
  });

  return { columns, players: players.sort((a, b) => a.jerseyNumber - b.jerseyNumber) };
}
