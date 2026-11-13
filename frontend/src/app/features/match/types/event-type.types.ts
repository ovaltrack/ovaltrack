import { UUID } from './common.types';

export type Actor = 'ATTACKING' | 'DEFENDING' | 'CHOOSE';
export type PossessionAfter = 'KEEP' | 'ACTOR' | 'OTHER';

/** Evento que se puede elegir como siguiente al guardar otro (p. ej. cómo se juega un penal). */
export interface FollowUpChoice {
  code: string;
  label?: string;
  /** Valores que se pre-llenan en el evento elegido (se salta ese paso). */
  preset?: Record<string, unknown>;
  team?: 'SAME' | 'OTHER';
}

export interface TemplateOption {
  value: string;
  label: string;
  /** Posesión resultante al elegir esta opción (pisa la del tipo). */
  possession?: PossessionAfter;
  /** Botonera de eventos siguientes al elegir esta opción. */
  followUps?: FollowUpChoice[];
}

export interface BackendEventTypeResponse {
  id: UUID;
  name: string;
  groupName: string | null;
  category: 'ATTACK' | 'DEFENSE' | 'NEUTRAL' | 'SET_PIECE' | 'POSSESSION' | null;
  isScoring: boolean;
  points: number | null;
  requiresPlayer: boolean;
  code: string;
  showInPalette: boolean;
  followUpEventTypeId: string | null;
  actor: Actor;
  possessionAfter: PossessionAfter;
  followUpChoices: FollowUpChoice[];
  templateEventFields: TemplateField[];
  /**
   * Vistas de estadísticas en vivo donde aparece el tipo (`event_types.stat_view`). Las estadísticas
   * post-partido muestran todos los tipos. Puede faltar en tipos cacheados antes de esta columna.
   */
  statView?: LiveStatView[] | null;
  /** Zonas de la cancha donde puede ocurrir el tipo; null/ausente = sin restricción (tipos cacheados antes de esta columna). */
  zoneRule?: ZoneRule | null;
}

/**
 * Regla de zona de un tipo de evento, vista desde el equipo que lo ejecuta (espejo de `ZoneRule` del backend).
 * Un eje con un único valor queda fijo; si no, sale del tramo. `rowFrom` es el atributo (left | center | right) que fija la fila.
 */
export interface ZoneRule {
  columns?: number[] | null;
  rows?: number[] | null;
  rowFrom?: string | null;
  /** Después del evento el juego se reinicia: el tramo que lo contiene termina en su minuto. */
  closesTramo?: boolean | null;
}

/** `basic`: modal de estadísticas de la carga en vivo · `intermediate`: resumen de entretiempo. */
export type LiveStatView = 'basic' | 'intermediate';

export interface TemplateField {
  key: string; label: string;
  type: 'select' | 'number' | 'boolean';
  phase: 'live' | 'post';
  required: boolean;
  options?: TemplateOption[];
  min?: number; max?: number;
  default?: unknown;
  effects?: ('scoring' | 'possession')[];
  trueLabel?: string;
  falseLabel?: string;
}

export type LiveCaptureEventType = Omit<BackendEventTypeResponse,
  'groupName' | 'category' | 'isScoring' | 'points' | 'requiresPlayer'
> & {
  groupName: string;
  category: 'ATTACK' | 'DEFENSE' | 'NEUTRAL' | 'POSSESSION' | 'SET_PIECE';
  isScoring: boolean;
  points: number;
  requiresPlayer: boolean;
  isActive: boolean;
  createdAt: string;
};