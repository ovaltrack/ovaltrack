import { InjectionToken } from '@angular/core';
import { matchesScreen } from './screen-help';
import { ResolvedTourStep, TourContext, TourStep } from './types/tour.types';

const home = (): string => '/home';
const divisions = (): string => '/divisions';
const squad = (c: TourContext): string | null => (c.divisionId ? `/divisions/${c.divisionId}/players` : null);
const roster = (c: TourContext): string | null => (c.upcomingMatchId ? `/selection-roster/${c.upcomingMatchId}` : null);
const live = (c: TourContext): string | null => (c.liveMatchId ? `/live-capture/${c.liveMatchId}` : null);
const postMatch = (c: TourContext): string | null => (c.finishedMatchId ? `/post-match/${c.finishedMatchId}` : null);
const zones = (c: TourContext): string | null => (c.finishedMatchId ? `/post-match/${c.finishedMatchId}/zones` : null);
const statistics = (c: TourContext): string | null => (c.finishedMatchId ? `/post-match/${c.finishedMatchId}/statistics` : null);
/** Capturas de la landing que usan las vistas previas. */
const SHOTS = 'assets/landing';
/** Vistas previas sin pantalla anterior (no pasa con el guion actual: el primer paso siempre es el inicio). */
const PREVIEW_FALLBACK_URL = '/home';
/** El cierre va en la última pantalla que se pudo mostrar. */
const finish = (c: TourContext): string => statistics(c) ?? live(c) ?? roster(c) ?? home();

/** Guion de la guía: Ovi recorre las pantallas reales, del vestuario a las estadísticas. */
export const DEFAULT_TOUR_STEPS: readonly TourStep[] = [
  {
    id: 'welcome',
    route: home,
    anchor: 'welcome',
    title: '¡Hola! Soy Ovi',
    body: 'Te muestro OvalTrack de punta a punta, del vestuario a las estadísticas, con los datos de tu club. Si ya lo conocés, podés saltar el tutorial cuando quieras.',
    placement: 'center',
    mood: 'wink'
  },
  {
    id: 'home-board',
    screen: '/home',
    route: home,
    anchor: 'home-board',
    title: 'Lo urgente, apenas entrás',
    body: 'El inicio te pone adelante el próximo partido o el que se está jugando, con lo que falta para tenerlo listo: convocatoria, estado y acceso directo a la carga.',
    placement: 'bottom',
    mood: 'talking'
  },
  {
    id: 'division-list',
    screen: '/divisions',
    route: divisions,
    anchor: 'division-list',
    title: 'Tu club, ordenado',
    body: 'Cada división tiene su categoría, su staff y su plantel. Nada de planillas sueltas dando vueltas por el grupo.',
    placement: 'bottom',
    mood: 'talking'
  },
  {
    id: 'squad',
    screen: '/divisions/:id/players',
    route: squad,
    anchor: 'squad',
    title: 'El plantel completo',
    body: 'Jugadores con su puesto y su dorsal. ¿Tenés el plantel en Excel? Con «Importar planilla» lo cargás de una vez, sin duplicar a nadie. Después los invitás por correo para que vean sus propias estadísticas.',
    placement: 'bottom',
    mood: 'happy'
  },
  {
    id: 'roster-field',
    screen: '/selection-roster/:id',
    route: roster,
    anchor: 'roster-field',
    title: 'Convocá a los 23',
    body: 'Armás la nómina oficial del partido: 15 titulares por puesto y hasta 8 suplentes. Solo estos jugadores pueden recibir eventos después.',
    placement: 'bottom',
    mood: 'talking',
    preview: {
      title: 'Convocá a los 23',
      body: 'Cuando cargues tu próximo partido con «Nuevo partido» desde el inicio, armás acá la nómina oficial: 15 titulares por puesto y hasta 8 suplentes. Solo ellos pueden recibir eventos después.'
    }
  },
  {
    id: 'roster-pool',
    screen: '/selection-roster/:id',
    route: roster,
    anchor: 'roster-pool',
    title: 'Elegís del plantel',
    body: 'A la derecha está el plantel disponible de la división. Lo ubicás en un puesto y listo: el contador te avisa si falta alguien.',
    placement: 'left',
    mood: 'happy'
  },
  {
    id: 'live-scoreboard',
    screen: '/live-capture/:id',
    route: live,
    anchor: 'live-scoreboard',
    title: 'Carga en vivo, al borde de la cancha',
    body: 'El reloj de juego se pausa cuando para el árbitro; el tiempo de video sigue corriendo. Dos tiempos de 40 minutos y el marcador se arma solo con cada tanto.',
    placement: 'bottom',
    mood: 'talking',
    preview: {
      title: 'Carga en vivo, al borde de la cancha',
      body: 'El día del partido cargás todo desde el celu: el reloj de juego se pausa con el árbitro, cada jugada va en dos toques y, si no hay señal, queda en el dispositivo y se envía sola después.',
      image: { src: `${SHOTS}/live-capture`, alt: 'Carga en vivo: marcador, reloj del partido y botonera de jugadas' }
    }
  },
  {
    id: 'live-catalog',
    screen: '/live-capture/:id',
    route: live,
    anchor: 'live-catalog',
    title: 'Una jugada, dos toques',
    body: 'Botones grandes por categoría para registrar tackles, scrums, line-outs y tries sin mirar mucho la pantalla. Primero la jugada, después el jugador.',
    placement: 'bottom',
    mood: 'happy'
  },
  {
    id: 'live-sync',
    screen: '/live-capture/:id',
    route: live,
    anchor: 'live-sync',
    title: '¿Sin señal en la cancha? Tranqui',
    body: 'Cada evento se guarda primero en el dispositivo y se envía solo cuando vuelve la conexión. Esta nube te dice si está todo sincronizado.',
    placement: 'bottom',
    mood: 'wink'
  },
  {
    id: 'pm-timeline',
    screen: '/post-match/:id',
    route: postMatch,
    anchor: 'pm-timeline',
    title: 'La revisión post-partido',
    body: 'Cuando termina el partido, todas las jugadas quedan en una línea de tiempo. La filtrás por tipo o por jugador y la recorrés minuto a minuto.',
    placement: 'bottom',
    mood: 'talking',
    preview: {
      title: 'La revisión post-partido',
      body: 'Cuando termines tu primer partido, todas las jugadas quedan en una línea de tiempo: las filtrás, corregís lo que se cargó mal y sumás lo que faltó. El marcador se recalcula solo.',
      image: { src: `${SHOTS}/post-match-events`, alt: 'Revisión post-partido: línea de tiempo de jugadas y tabla de eventos' }
    }
  },
  {
    id: 'pm-table',
    screen: '/post-match/:id',
    route: postMatch,
    anchor: 'pm-table',
    title: 'Corregí sin miedo',
    body: '¿Se cargó un tackle a quien no era? Lo editás acá. Si cambiás un tanto, el marcador se recalcula solo. Y lo que faltó lo agregás después.',
    placement: 'top',
    mood: 'happy'
  },
  {
    id: 'zones-grid',
    screen: '/post-match/:id/zones',
    route: zones,
    anchor: 'zones-grid',
    title: '¿Dónde se jugó el partido?',
    body: 'Marcás por tramos en qué zona estuvo la pelota y OvalTrack ubica cada jugada en la cancha. El calor te muestra dónde pasó lo importante.',
    placement: 'bottom',
    mood: 'talking',
    preview: {
      title: '¿Dónde se jugó el partido?',
      body: 'Después marcás por tramos en qué zona estuvo la pelota y OvalTrack ubica cada jugada en la cancha, con un mapa de calor de dónde pasó lo importante.',
      image: { src: `${SHOTS}/post-match-zones`, alt: 'Zonas de cancha: tramos por zona y mapa de calor sobre la grilla' }
    }
  },
  {
    id: 'zones-panel',
    screen: '/post-match/:id/zones',
    route: zones,
    anchor: 'zones-panel',
    title: 'Los tramos',
    body: 'Cada tramo es un rango de minutos y una zona. Después de un try el tramo se corta solo, porque el juego vuelve a empezar desde la mitad.',
    placement: 'left',
    mood: 'happy'
  },
  {
    id: 'stats-summary',
    screen: '/post-match/:id/statistics',
    route: statistics,
    anchor: 'stats-summary',
    title: 'Estadísticas al toque',
    body: 'Marcador, posesión, tackles, disciplina y pelota parada, listos apenas cerrás el partido. Sin pasar nada a mano.',
    placement: 'bottom',
    mood: 'talking',
    preview: {
      title: 'Estadísticas al toque',
      body: 'Y apenas cerrás el partido tenés posesión, tackles, disciplina y pelota parada del equipo y de cada jugador, sin pasar nada a mano.',
      image: { src: `${SHOTS}/statistics`, alt: 'Estadísticas post-partido: marcador, posesión y comparación entre equipos' }
    }
  },
  {
    id: 'stats-players',
    screen: '/post-match/:id/statistics',
    route: statistics,
    anchor: 'stats-players',
    title: 'Y jugador por jugador',
    body: 'En «Jugadores» tocás a cualquiera del plantel y ves lo suyo: tackles, metros, puntos y su mapa de zonas. Datos para decidir, no para adivinar.',
    placement: 'bottom',
    mood: 'happy'
  },
  {
    id: 'finish',
    route: finish,
    anchor: 'finish',
    title: '¡Try! Llegaste al final',
    body: 'Eso es OvalTrack: organizar, convocar, cargar en vivo y analizar, todo en un solo lugar. Y si te perdés, tocá el «?» de arriba: te explico la pantalla en la que estés.',
    placement: 'center',
    mood: 'wink'
  }
];

/** Guion que usa `TourService`; se reemplaza en los tests. */
export const TOUR_STEPS = new InjectionToken<readonly TourStep[]>('TOUR_STEPS', {
  providedIn: 'root',
  factory: () => DEFAULT_TOUR_STEPS
});

/**
 * Pasos que se pueden mostrar con este contexto: resuelve la URL y, si al club le faltan los datos de esa pantalla,
 * muestra su vista previa (centrada, sin salir de la pantalla anterior) o saltea el paso.
 */
export function resolveTourSteps(steps: readonly TourStep[], context: TourContext): ResolvedTourStep[] {
  const resolved: ResolvedTourStep[] = [];
  for (const step of steps) {
    const url = step.route(context);
    if (url !== null) {
      resolved.push({
        id: step.id,
        url,
        anchor: step.anchor,
        title: step.title,
        body: step.body,
        placement: step.placement,
        mood: step.mood
      });
    } else if (step.preview) {
      resolved.push({
        id: step.id,
        url: resolved[resolved.length - 1]?.url ?? PREVIEW_FALLBACK_URL,
        anchor: step.anchor,
        title: step.preview.title,
        body: step.preview.body,
        placement: 'center',
        mood: 'talking',
        ...(step.preview.image ? { image: step.preview.image } : {})
      });
    }
  }
  return resolved;
}

/**
 * Ayuda del botón «?»: los pasos de la pantalla en la que está el usuario (con cualquier división o partido),
 * sobre la URL actual. Vacío si la pantalla no tiene ayuda.
 */
export function helpStepsFor(steps: readonly TourStep[], path: string): ResolvedTourStep[] {
  return steps
    .filter(step => step.screen !== undefined && matchesScreen(step.screen, path))
    .map(step => ({
      id: step.id,
      url: path,
      anchor: step.anchor,
      title: step.title,
      body: step.body,
      placement: step.placement,
      mood: step.mood
    }));
}
