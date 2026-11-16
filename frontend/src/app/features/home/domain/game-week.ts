import { DivisionMatchState, StateMatch } from './division-match-state';
import { MATCH_DAY_WINDOW_MS } from './countdown';
import { clockLabel, msUntil, parseWallClock, weekdayDayLabel } from './match-time';
import { LINEUP_WINDOW_MS } from './primary-action';
import { RosterCount, needsCallUp, rosterGaps } from './roster-gaps';

export type GameWeekStage = 'analyze' | 'train' | 'call-up' | 'play';
export type GameWeekStepStatus = 'done' | 'current' | 'pending';

export interface GameWeekStep {
  stage: GameWeekStage;
  /** 1–4. */
  number: number;
  name: string;
  status: GameWeekStepStatus;
  subtitle: string;
}

export interface GameWeek {
  stage: GameWeekStage;
  /** Posición de la etapa actual, 1–4 ("paso n de 4"). */
  stepNumber: number;
  steps: GameWeekStep[];
}

export interface GameWeekAnalysis {
  /** Rival del último partido jugado, ya abreviado. */
  opponent: string;
  /** 0–100. */
  percent: number;
  /** `null` si no se pudieron leer los tramos de zona. */
  minutesWithoutZone: number | null;
}

export interface GameWeekInput {
  state: DivisionMatchState<StateMatch>;
  /** Análisis del último partido jugado; `null` si no hay partido jugado o no se pudo leer. */
  analysis: GameWeekAnalysis | null;
  /** Nómina leída del próximo partido; `null` si no existe o no se pudo leer. */
  roster: RosterCount | null;
  now: Date;
}

const STEPS: readonly { stage: GameWeekStage; name: string }[] = [
  { stage: 'analyze', name: 'Analizar' },
  { stage: 'train', name: 'Entrenar' },
  { stage: 'call-up', name: 'Convocar' },
  { stage: 'play', name: 'Jugar' }
];

const analysisPending = (analysis: GameWeekAnalysis | null): boolean =>
  analysis !== null && (analysis.percent < 100 || (analysis.minutesWithoutZone ?? 0) > 0);

/**
 * Etapa actual de la semana de juego, en este orden: Jugar (partido en curso o `not_started` a menos de 24 h) → Convocar
 * (próximo en ≤ 72 h sin nómina o con menos de 8 suplentes) → Analizar (último partido con análisis o zonas sin cerrar) →
 * Entrenar (hay próximo partido). `null`: sin pasos (sin partido por jugar ni análisis pendiente).
 */
export function gameWeekStage(input: GameWeekInput): GameWeekStage | null {
  const { state, analysis, roster, now } = input;
  const nextStart = state.next ? parseWallClock(state.next.date) : null;
  const untilNext = nextStart ? msUntil(nextStart, now) : null;

  if (state.live || (state.next?.status === 'not_started' && untilNext !== null && untilNext < MATCH_DAY_WINDOW_MS)) return 'play';
  if (state.next && untilNext !== null && untilNext <= LINEUP_WINDOW_MS && needsCallUp(rosterGaps(roster, state.next.status))) return 'call-up';
  if (analysisPending(analysis)) return 'analyze';
  return state.next ? 'train' : null;
}

function analysisSubtitle(analysis: GameWeekAnalysis | null): string {
  return analysis ? `vs ${analysis.opponent} · ${analysis.percent} %` : 'Sin partido previo';
}

function callUpSubtitle(input: GameWeekInput): string {
  const { state, roster } = input;
  if (!state.next) return '–';
  const gaps = rosterGaps(roster, state.next.status);
  if (gaps.kind === 'complete') return 'Completa';
  return gaps.kind === 'unknown' ? '–' : gaps.label;
}

function playSubtitle(input: GameWeekInput): string {
  const { state } = input;
  if (state.live) return state.live.status === 'halftime' ? 'Entretiempo' : 'En curso';
  const start = state.next ? parseWallClock(state.next.date) : null;
  return start ? `${weekdayDayLabel(start)} · ${clockLabel(start)}` : '–';
}

/** Los 4 pasos con su estado propio (Entrenar es pasivo: queda hecho cuando la semana llega a Convocar o a Jugar, D1). */
export function gameWeek(input: GameWeekInput): GameWeek | null {
  const stage = gameWeekStage(input);
  if (!stage) return null;
  const current = STEPS.findIndex(step => step.stage === stage);
  const { state, analysis, roster } = input;
  const gaps = state.next ? rosterGaps(roster, state.next.status) : null;

  const statusOf = (index: number, done: boolean): GameWeekStepStatus => index === current ? 'current' : done ? 'done' : 'pending';
  const done: Record<GameWeekStage, boolean> = {
    analyze: !analysisPending(analysis),
    train: current > 1,
    'call-up': stage === 'play' || gaps?.kind === 'complete',
    play: false
  };
  const subtitle: Record<GameWeekStage, string> = {
    analyze: analysisSubtitle(analysis),
    train: current > 1 ? 'Hecho' : 'Esta semana',
    'call-up': stage === 'play' && gaps?.kind !== 'complete' ? 'Cerrada' : callUpSubtitle(input),
    play: playSubtitle(input)
  };

  return {
    stage,
    stepNumber: current + 1,
    steps: STEPS.map((step, index) => ({
      stage: step.stage, number: index + 1, name: step.name, status: statusOf(index, done[step.stage]), subtitle: subtitle[step.stage]
    }))
  };
}
