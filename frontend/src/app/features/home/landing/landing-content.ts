/** Contenido de la landing: textos de marketing separados del maquetado. */

export interface LandingStep {
  readonly title: string;
  readonly description: string;
}

export interface LandingFeature {
  readonly icon: string;
  readonly title: string;
  readonly description: string;
  readonly points: readonly string[];
}

export interface LandingAudience {
  readonly icon: string;
  readonly role: string;
  readonly description: string;
}

export interface LandingScreen {
  readonly id: string;
  /** Etiqueta corta de la pestaña del carrusel. */
  readonly tab: string;
  /** Ruta base de la captura: existe en `-800.webp` y `-1600.webp`. */
  readonly image: string;
  readonly alt: string;
  readonly title: string;
  readonly description: string;
  readonly points: readonly string[];
}

export const LANDING_HIGHLIGHTS: readonly string[] = [
  'Funciona sin conexión',
  'Pensado para el borde de la cancha',
  'Datos aislados por club'
];

export const LANDING_STEPS: readonly LandingStep[] = [
  {
    title: 'Organizá el club',
    description: 'Divisiones por categoría, staff técnico y planteles con roles claros.'
  },
  {
    title: 'Convocá a los 23',
    description: 'Armá la nómina oficial del partido: 15 titulares y 8 suplentes.'
  },
  {
    title: 'Capturá en vivo',
    description: 'Registrá cada jugada desde la cancha, con o sin señal.'
  },
  {
    title: 'Analizá y decidí',
    description: 'Auditá el partido, corregí eventos y leé las estadísticas.'
  }
];

export const LANDING_FEATURES: readonly LandingFeature[] = [
  {
    icon: 'bi-diagram-3',
    title: 'Club y divisiones',
    description: 'Toda la estructura del club en un solo lugar.',
    points: ['Divisiones por categoría y género', 'Entrenadores y jugadores por división', 'Invitaciones y aprobación de miembros']
  },
  {
    icon: 'bi-people',
    title: 'Convocatoria del partido',
    description: 'La nómina oficial define quién puede sumar eventos.',
    points: ['Hasta 23 jugadores por partido', 'Titulares y suplentes', 'Calendario de partidos programados']
  },
  {
    icon: 'bi-lightning-charge',
    title: 'Carga en vivo',
    description: 'Tagging rápido al borde de la cancha, con botones táctiles grandes.',
    points: ['Tries, penales, tackles, scrums y lines', 'Reloj de juego con pausas y medio tiempo', 'Guardado local y sincronización automática']
  },
  {
    icon: 'bi-clipboard-check',
    title: 'Auditoría post-partido',
    description: 'Revisá la línea de tiempo y dejá los datos impecables.',
    points: ['Editar, corregir o dar de baja eventos', 'Sumar jugadas que se escaparon en vivo', 'Marcador recalculado automáticamente']
  },
  {
    icon: 'bi-grid-3x3',
    title: 'Zonas de cancha',
    description: 'Ubicá el juego en la cancha por tramos de tiempo.',
    points: ['Grilla de 18 zonas alineada a las líneas', 'Mapa de calor de eventos por zona', 'Cobertura del partido de un vistazo']
  },
  {
    icon: 'bi-bar-chart-line',
    title: 'Estadísticas',
    description: 'Métricas consolidadas para el cuerpo técnico y cada jugador.',
    points: ['Posesión, tackles, disciplina y pelota parada', 'Comparación por tiempo de juego', 'Rendimiento individual y por división']
  }
];

export const LANDING_AUDIENCES: readonly LandingAudience[] = [
  {
    icon: 'bi-building',
    role: 'Administración del club',
    description: 'Gestiona divisiones, miembros y accesos, con cada club aislado del resto.'
  },
  {
    icon: 'bi-clipboard-data',
    role: 'Entrenadores y analistas',
    description: 'Convocan, capturan en vivo y analizan cada partido con datos propios.'
  },
  {
    icon: 'bi-person-badge',
    role: 'Jugadores',
    description: 'Consultan sus partidos y su rendimiento individual.'
  }
];

/** Capturas reales de la app (datos de staging), en el orden del ciclo del partido. */
export const LANDING_SCREENS: readonly LandingScreen[] = [
  {
    id: 'coach-home',
    tab: 'Inicio',
    image: 'assets/landing/coach-home',
    alt: 'Inicio del entrenador en OvalTrack: partido en curso, deuda de análisis, pendientes antes del próximo partido y forma de los últimos partidos',
    title: 'Todo lo urgente apenas entrás',
    description: 'El inicio de cada rol muestra lo que hay que hacer hoy: el partido en curso, lo que falta analizar y lo que falta para el próximo.',
    points: ['Partido en vivo a la vista, desde cualquier dispositivo', 'Avance del análisis del último partido', 'Racha y diferencia de puntos de la temporada']
  },
  {
    id: 'live-capture',
    tab: 'Carga en vivo',
    image: 'assets/landing/live-capture',
    alt: 'Pantalla de carga en vivo de OvalTrack: marcador, reloj del partido y botonera de eventos agrupados por puntuación, juego fijo, cambio de posesión y ataque',
    title: 'Carga en vivo pensada para el borde de la cancha',
    description: 'Botones grandes agrupados por tipo de jugada, el reloj y el marcador siempre a la vista, y la posesión marcada con color de un vistazo.',
    points: ['Hasta dos toques por jugada: tipo y jugador', 'Deshacer al instante si te equivocaste', 'Guarda en el dispositivo aunque no haya señal']
  },
  {
    id: 'post-match-events',
    tab: 'Eventos',
    image: 'assets/landing/post-match-events',
    alt: 'Revisión post-partido de OvalTrack: línea de tiempo de jugadas por tipo, tabla de eventos con jugador y zona, y cola de revisión de pendientes',
    title: 'Revisión del partido jugada por jugada',
    description: 'Línea de tiempo y tabla sincronizadas para auditar el partido con el video: completá jugadores, corregí eventos y sumá lo que faltó.',
    points: ['Cola de eventos pendientes de completar', 'Tiempo de juego y tiempo de video por evento', 'Filtros por tiempo y por equipo']
  },
  {
    id: 'post-match-zones',
    tab: 'Zonas de cancha',
    image: 'assets/landing/post-match-zones',
    alt: 'Zonas de cancha en OvalTrack: tramos de tiempo por zona a lo largo del partido y mapa de calor de eventos sobre una grilla de 18 zonas',
    title: 'Dónde se jugó el partido',
    description: 'Asigná tramos de tiempo a zonas de la cancha y OvalTrack ubica cada evento en el mapa de calor.',
    points: ['Grilla de 18 zonas alineada a las líneas de la cancha', 'Mapa de calor por cantidad de eventos', 'Huecos sin zona señalados para completarlos']
  },
  {
    id: 'statistics',
    tab: 'Estadísticas',
    image: 'assets/landing/statistics',
    alt: 'Pantalla de estadísticas post-partido de OvalTrack: marcador, porcentaje de posesión y comparación de tries, conversiones y penales entre ambos equipos',
    title: 'Estadísticas listas cuando termina el partido',
    description: 'Los eventos capturados se convierten en métricas comparadas entre tu equipo y el rival, por tiempo y por jugador.',
    points: ['Posesión, puntuación, ataque y defensa', 'Filtro por primer y segundo tiempo', 'Vista por equipo o por jugador']
  },
  {
    id: 'division-dashboard',
    tab: 'Evolución',
    image: 'assets/landing/division-dashboard',
    alt: 'Dashboard de partidos de una división en OvalTrack: resumen de resultados, promedios y gráficos de puntos y tries partido a partido',
    title: 'La evolución de la división, partido a partido',
    description: 'Elegí un rango de fechas y las métricas que te importan para ver cómo viene el equipo a lo largo de la temporada.',
    points: ['Ganados, empatados y perdidos con promedios', 'Gráficos de puntos, tries, penales y obtención', 'Rangos rápidos: últimos 3 o 6 meses y el año']
  }
];
