import { LiveCaptureEventType, TemplateField } from '../../types/event-type.types';
import { BackendEventResponse } from '../../types/event.types';
import {
  BooleanFieldStat,
  EventTypeStat,
  EventTypeStatGroup,
  FieldStat,
  MatchStatistics,
  NumberFieldStat,
  SelectFieldStat,
  StatView,
  TeamValue,
} from '../types/statistic.types';
import { countsAsScoring, eventTeam, isJerseyNumberField, scoringTeam, Team } from './event-rules';
import { computeDerivedMetrics } from './derived-metrics';
import { computeOwnPossessionPercentage } from './possession-calculator';
import { fieldsInView, isScoringField, isTypeInView } from './stat-view';

const DEFAULT_GROUP = 'General';

export const emptyTeamValue = (): TeamValue => ({ own: 0, opponent: 0 });

const add = (value: TeamValue, team: Team, amount = 1): void => {
  if (team === 'OWN') {
    value.own += amount;
  } else {
    value.opponent += amount;
  }
};

export const readNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value);
  return null;
};

/**
 * Equipo al que se le acredita un evento. Los tipos que suman usan la misma regla que el marcador
 * persistido por el backend; el resto, el equipo que ejecuta la acción según el `actor` del tipo.
 */
export function creditedTeam(type: LiveCaptureEventType, event: BackendEventResponse): Team | null {
  return type.isScoring ? scoringTeam(event) : eventTeam(type, event);
}

/** Acumulador de un campo, armado a partir de su definición en el catálogo. */
interface FieldAccumulator {
  stat: FieldStat;
  add(event: BackendEventResponse, team: Team): void;
  finish(): void;
}

function fieldAccumulator(field: TemplateField): FieldAccumulator | null {
  switch (field.type) {
    case 'select': {
      const options = (field.options ?? []).map(option => ({
        value: option.value,
        label: option.label,
        count: emptyTeamValue(),
      }));
      const stat: SelectFieldStat = { kind: 'select', key: field.key, label: field.label, options, pending: emptyTeamValue() };
      return {
        stat,
        add: (event, team) => {
          const value = event.attributes?.[field.key];
          const option = options.find(candidate => candidate.value === value);
          add(option ? option.count : stat.pending, team);
        },
        finish: () => undefined,
      };
    }
    case 'boolean': {
      const stat: BooleanFieldStat = {
        kind: 'boolean',
        key: field.key,
        label: field.label,
        trueLabel: field.trueLabel ?? 'Sí',
        falseLabel: field.falseLabel ?? 'No',
        yes: emptyTeamValue(),
        no: emptyTeamValue(),
      };
      return {
        stat,
        add: (event, team) => {
          const value = event.attributes?.[field.key];
          if (value === true) add(stat.yes, team);
          if (value === false) add(stat.no, team);
        },
        finish: () => undefined,
      };
    }
    case 'number': {
      const sums = emptyTeamValue();
      const samples = emptyTeamValue();
      const stat: NumberFieldStat = {
        kind: 'number',
        key: field.key,
        label: field.label,
        total: { own: null, opponent: null },
        average: { own: null, opponent: null },
      };
      const totalOf = (team: keyof TeamValue): number | null => (samples[team] > 0 ? sums[team] : null);
      const averageOf = (team: keyof TeamValue): number | null =>
        (samples[team] > 0 ? sums[team] / samples[team] : null);
      return {
        stat,
        add: (event, team) => {
          const value = readNumber(event.attributes?.[field.key]);
          if (value === null) return;
          add(sums, team, value);
          add(samples, team);
        },
        finish: () => {
          stat.total = { own: totalOf('own'), opponent: totalOf('opponent') };
          stat.average = { own: averageOf('own'), opponent: averageOf('opponent') };
        },
      };
    }
    default:
      return null;
  }
}

interface TypeAccumulator {
  stat: EventTypeStat;
  fields: FieldAccumulator[];
}

function typeAccumulator(type: LiveCaptureEventType, view: StatView): TypeAccumulator {
  const fields = fieldsInView(type, view)
    // El campo de efecto scoring ya está en convertidos; un número de camiseta no es una cantidad.
    .filter(field => !isScoringField(field) && !isJerseyNumberField(field))
    .map(fieldAccumulator)
    .filter((accumulator): accumulator is FieldAccumulator => accumulator !== null);

  return {
    fields,
    stat: {
      eventTypeId: type.id,
      code: type.code,
      name: type.name,
      isScoring: type.isScoring,
      count: emptyTeamValue(),
      made: type.isScoring ? emptyTeamValue() : null,
      points: type.isScoring ? emptyTeamValue() : null,
      hasAttempts: type.isScoring && (type.templateEventFields ?? []).some(isScoringField),
      fields: fields.map(field => field.stat),
    },
  };
}

/**
 * Estadísticas del partido derivadas del catálogo de eventos: un bloque por tipo visible en la
 * vista (`statView`), agrupado por `groupName`, con el desglose de sus campos. Agregar o cambiar
 * un tipo en el catálogo no requiere tocar este cálculo. Recibe eventos activos ya filtrados por período.
 */
export function computeMatchStatistics(
  events: BackendEventResponse[],
  eventTypes: LiveCaptureEventType[],
  view: StatView,
): MatchStatistics {
  const typeById = new Map(eventTypes.map(type => [type.id, type]));
  const accumulators = new Map<string, TypeAccumulator>();
  for (const type of eventTypes) {
    if (isTypeInView(type, view)) {
      accumulators.set(type.id, typeAccumulator(type, view));
    }
  }

  const score = emptyTeamValue();
  for (const event of events) {
    const type = typeById.get(event.eventTypeId);
    if (!type) continue;

    const team = creditedTeam(type, event);
    const scored = countsAsScoring(type, event.attributes);
    if (scored && team) {
      add(score, team, type.points ?? 0);
    }

    const accumulator = accumulators.get(type.id);
    if (!accumulator || !team) continue;

    const { stat } = accumulator;
    add(stat.count, team);
    if (scored && stat.made && stat.points) {
      add(stat.made, team);
      add(stat.points, team, type.points ?? 0);
    }
    accumulator.fields.forEach(field => field.add(event, team));
  }

  const groups: EventTypeStatGroup[] = [];
  for (const type of eventTypes) {
    const accumulator = accumulators.get(type.id);
    if (!accumulator) continue;
    accumulator.fields.forEach(field => field.finish());

    const { stat } = accumulator;
    if (type.isActive === false && stat.count.own + stat.count.opponent === 0) continue;

    const name = type.groupName || DEFAULT_GROUP;
    let group = groups.find(candidate => candidate.name === name);
    if (!group) {
      group = { name, types: [] };
      groups.push(group);
    }
    group.types.push(stat);
  }

  const statsByCode = new Map(groups.flatMap(group => group.types).map(stat => [stat.code, stat]));

  return {
    view,
    score,
    ownPossessionPercentage: computeOwnPossessionPercentage(events, typeById),
    groups,
    derived: computeDerivedMetrics(code => statsByCode.get(code)),
  };
}
