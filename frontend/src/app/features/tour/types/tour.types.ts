/** Lado del elemento resaltado donde se abre el globo; `center` lo muestra en el medio, sin ancla. */
export type TourPlacement = 'top' | 'bottom' | 'left' | 'right' | 'center';

/** Gesto de Ovi en cada paso. */
export type OviMood = 'happy' | 'talking' | 'wink';

/** Lo que la guía necesita saber del club para armar las rutas reales de cada paso. */
export interface TourContext {
  readonly divisionId: string | null;
  /** Próximo partido sin empezar (convocatoria). */
  readonly upcomingMatchId: string | null;
  /** Partido en curso o en el entretiempo (carga en vivo). */
  readonly liveMatchId: string | null;
  /** Último partido finalizado (post-partido, zonas y estadísticas). */
  readonly finishedMatchId: string | null;
}

/** Ruta real de un paso; `null` si al club le faltan los datos para mostrarla y el paso se saltea. */
export type TourRoute = (context: TourContext) => string | null;

/** Captura de una pantalla (las de la landing): ruta base sin el sufijo de tema y tamaño (`-light-800.webp`, `-dark-1600.webp`…). */
export interface TourImage {
  readonly src: string;
  readonly alt: string;
}

/**
 * Lo que dice Ovi cuando al club todavía le faltan los datos de esa pantalla (club nuevo, ningún partido en curso):
 * un globo centrado, sin salir de la pantalla anterior, con una captura de cómo se ve.
 */
export interface TourPreview {
  readonly title: string;
  readonly body: string;
  readonly image?: TourImage;
}

/** Un paso del guion: en qué pantalla ocurre, qué elemento señala y qué dice Ovi. */
export interface TourStep {
  readonly id: string;
  readonly route: TourRoute;
  /** Pantalla a la que pertenece (`:id` = cualquier división o partido); la usa la ayuda del «?». Sin pantalla, no hay ayuda. */
  readonly screen?: string;
  /** Valor del atributo `data-tour` del elemento que se resalta. */
  readonly anchor: string;
  readonly title: string;
  readonly body: string;
  readonly placement: TourPlacement;
  readonly mood: OviMood;
  /** Si la ruta da `null`: vista previa en lugar de saltear el paso. Va solo en el primer paso de cada pantalla. */
  readonly preview?: TourPreview;
}

/** Paso listo para mostrar: con la URL ya resuelta (o la vista previa, si la pantalla no tiene datos). */
export interface ResolvedTourStep {
  readonly id: string;
  readonly url: string;
  readonly anchor: string;
  readonly title: string;
  readonly body: string;
  readonly placement: TourPlacement;
  readonly mood: OviMood;
  readonly image?: TourImage;
}

/** `tour`: el recorrido completo por las pantallas; `help`: solo los pasos de la pantalla actual (botón «?»). */
export type TourMode = 'tour' | 'help';

export interface TourState {
  readonly active: boolean;
  readonly index: number;
  readonly mode: TourMode;
}

export interface TourProgress {
  readonly current: number;
  readonly total: number;
}

export interface BubblePosition {
  readonly top: number;
  readonly left: number;
  readonly placement: TourPlacement;
}

export interface BoxSize {
  readonly width: number;
  readonly height: number;
}

/** Rectángulo mínimo que necesita el posicionamiento (compatible con `DOMRect`). */
export interface AnchorRect {
  readonly top: number;
  readonly left: number;
  readonly width: number;
  readonly height: number;
}
