import { Injectable, inject } from '@angular/core';
import { LiveCaptureEventType } from '../../types/event-type.types';
import { MatchStatistics, PlayerStatistics, StatisticEvent, StatView } from '../types/statistic.types';
import { computeMatchStatistics, computePlayerStatistics, eventsOfPeriod, RosterPlayerInfo } from '../calculators';
import { LocalDatabaseService } from '../../../local-database/services/local-database.service';

/** Datos ya cargados en memoria; lo que falte se lee de la caché local. */
export interface StatisticSource {
  events?: StatisticEvent[];
  eventTypes?: LiveCaptureEventType[];
}

@Injectable({ providedIn: 'root' })
export class StatisticCalculationService {
  private readonly cache = inject(LocalDatabaseService);

  async calculateMatchStatistics(
    matchId: string,
    view: StatView,
    period?: number,
    source: StatisticSource = {},
  ): Promise<MatchStatistics> {
    const { events, eventTypes } = await this.resolveSource(matchId, source);
    return this.computeMatchStatistics(events, eventTypes, view, period);
  }

  async calculatePlayerStatistics(
    matchId: string,
    roster: RosterPlayerInfo[],
    view: StatView,
    period?: number,
    source: StatisticSource = {},
  ): Promise<PlayerStatistics> {
    const { events, eventTypes } = await this.resolveSource(matchId, source);
    return this.computePlayerStatistics(events, roster, eventTypes, view, period);
  }

  computeMatchStatistics(
    events: StatisticEvent[],
    eventTypes: LiveCaptureEventType[],
    view: StatView,
    period?: number,
  ): MatchStatistics {
    return computeMatchStatistics(eventsOfPeriod(events, period), eventTypes, view);
  }

  computePlayerStatistics(
    events: StatisticEvent[],
    roster: RosterPlayerInfo[],
    eventTypes: LiveCaptureEventType[],
    view: StatView,
    period?: number,
  ): PlayerStatistics {
    return computePlayerStatistics(eventsOfPeriod(events, period), roster, eventTypes, view);
  }

  private async resolveSource(
    matchId: string,
    source: StatisticSource,
  ): Promise<Required<StatisticSource>> {
    const [events, eventTypes] = await Promise.all([
      source.events ?? this.cache.getEventsByMatch(matchId),
      source.eventTypes && source.eventTypes.length > 0 ? source.eventTypes : this.cache.getEventTypes(),
    ]);
    return { events, eventTypes };
  }
}
