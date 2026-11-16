import { ResolvedTourStep } from './types/tour.types';

/** Ayuda del «?» para una pantalla que no está en el recorrido: un globo centrado con lo que se hace ahí. */
export interface ScreenHelp {
  /** Ruta de la pantalla; `:id` = cualquier división, partido o persona. */
  readonly screen: string;
  readonly title: string;
  readonly body: string;
}

/** Pantallas del staff fuera del recorrido. Las del recorrido usan sus propios pasos (ver `helpStepsFor`). */
export const SCREEN_HELP: readonly ScreenHelp[] = [
  {
    screen: '/match-selection',
    title: 'Los partidos del club',
    body: 'Acá ves todos los partidos, filtrados por división. Desde cada uno armás la convocatoria, entrás a la carga en vivo o, si ya terminó, a la revisión post-partido. Con «Nuevo partido» cargás el próximo.'
  },
  {
    screen: '/club',
    title: 'La ficha del club',
    body: 'Los datos institucionales: nombre, ciudad, escudo y contacto. Con «Editar información» los mantenés al día; son los que ven los miembros del club.'
  },
  {
    screen: '/divisions/new',
    title: 'Nueva división',
    body: 'Elegís el nombre, la categoría por edad y el género. Después le sumás jugadores y entrenadores desde el listado de divisiones.'
  },
  {
    screen: '/divisions/:id/coaches',
    title: 'El cuerpo técnico',
    body: 'Los entrenadores y analistas a cargo de esta división. Los que asocies acá pueden cargar sus partidos y ver sus estadísticas.'
  },
  {
    screen: '/divisions/:id/statistics',
    title: 'La división, partido a partido',
    body: 'Resultados, promedios y la evolución de puntos y tries de la división en el rango de fechas que elijas. Ideal para ver si el equipo viene para arriba.'
  },
  {
    screen: '/division-statistics/:id',
    title: 'La división, partido a partido',
    body: 'Resultados, promedios y la evolución de puntos y tries de la división en el rango de fechas que elijas. Ideal para ver si el equipo viene para arriba.'
  },
  {
    screen: '/players/new',
    title: 'Alta de jugador',
    body: 'Cargás los datos del deportista y lo sumás a una división. Si le ponés un correo, después lo podés invitar para que vea sus propias estadísticas.'
  },
  {
    screen: '/division-player-user-query',
    title: 'Jugadores y cuentas',
    body: 'Elegís una división y ves qué jugadores ya tienen cuenta en OvalTrack y cuáles todavía no. Sirve para saber a quién falta invitar.'
  },
  {
    screen: '/members',
    title: 'La gente del club',
    body: 'Todos los miembros con su rol y el estado de su cuenta. Desde acá invitás a jugadores y staff, y ves quién ya aceptó.'
  },
  {
    screen: '/opponent',
    title: 'Los rivales',
    body: 'Los clubes contra los que juegan, con nombre y alias. Cargalos una vez y los elegís al crear cada partido; el alias es el que aparece en el marcador.'
  },
  {
    screen: '/live-capture/:id/halftime',
    title: 'Entretiempo',
    body: 'El resumen del primer tiempo: marcador y acciones por jugador, para la charla del vestuario. Cuando arranca el segundo tiempo, tocá «Comenzar 2º tiempo» y el reloj sigue desde el 40.'
  },
  {
    screen: '/players/:id/statistics',
    title: 'Estadísticas del jugador',
    body: 'Todo lo que hizo en la temporada: tackles, metros, puntos y su mapa de zonas. Tocá un partido para ver solo ese.'
  },
  {
    screen: '/players/:id/statistics/:id',
    title: 'El jugador en este partido',
    body: 'Lo que hizo en este partido: sus acciones y dónde las hizo en la cancha. Con «Ver estadísticas generales» volvés a toda su temporada.'
  },
  {
    screen: '/profile',
    title: 'Tu perfil',
    body: 'Tus datos personales y de acceso. Desde acá podés cambiar tu contraseña.'
  }
];

/** Si la pantalla no tiene ayuda escrita, Ovi lo dice y ofrece el recorrido completo. */
const GENERIC_HELP = {
  title: 'Esta pantalla no tiene ayuda todavía',
  body: 'No tengo una explicación para esta pantalla, pero te puedo mostrar OvalTrack de punta a punta con «Ver tutorial completo».'
};

const screenPattern = (screen: string): RegExp => new RegExp(`^${screen.replace(/:id/g, '[^/]+')}$`);

/** `true` si la ruta corresponde a la pantalla (`:id` = cualquier segmento). */
export function matchesScreen(screen: string, path: string): boolean {
  return screenPattern(screen).test(path);
}

/** Globo centrado con la ayuda escrita de la pantalla, o el genérico si no tiene. */
export function screenHelpFor(help: readonly ScreenHelp[], path: string): ResolvedTourStep {
  const entry = help.find(item => matchesScreen(item.screen, path)) ?? GENERIC_HELP;
  return {
    id: 'screen-help',
    url: path,
    anchor: '',
    title: entry.title,
    body: entry.body,
    placement: 'center',
    mood: 'talking'
  };
}
