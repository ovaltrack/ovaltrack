import { NavModule } from './navigation.types';

/**
 * Catálogo único de módulos. El orden de este arreglo es el orden en la barra.
 * Agregar un módulo o un rol es agregar/editar una entrada; los componentes no cambian.
 * Los módulos con `route: null` se habilitan solos al asignarles una ruta.
 */
export const NAV_MODULES: readonly NavModule[] = [
  {
    id: 'home',
    label: 'Inicio',
    icon: 'bi-house',
    route: '/home',
    exact: true,
    roles: ['ADMIN_CLUB', 'COACH_ANALYST', 'PLAYER', 'ADMIN_OVALTRACK'],
  },
  {
    id: 'matches',
    label: 'Partidos',
    icon: 'bi-calendar-event',
    route: '/match-selection',
    activeAlso: ['/selection-roster', '/post-match'],
    roles: ['ADMIN_CLUB', 'COACH_ANALYST'],
  },
  {
    id: 'player-matches',
    label: 'Partidos',
    icon: 'bi-calendar-event',
    route: null,
    roles: ['PLAYER'],
  },
  {
    id: 'reports',
    label: 'Reportes',
    icon: 'bi-bar-chart',
    route: null,
    roles: ['COACH_ANALYST'],
  },
  {
    id: 'divisions',
    label: 'Divisiones',
    icon: 'bi-layers',
    route: '/divisions',
    activeAlso: ['/division-statistics', '/players/new'],
    roles: ['ADMIN_CLUB', 'COACH_ANALYST'],
  },
  {
    id: 'club',
    label: 'Club',
    icon: 'bi-shield',
    route: '/club',
    roles: ['ADMIN_CLUB'],
  },
  {
    id: 'members',
    label: 'Miembros',
    icon: 'bi-people',
    route: '/members',
    roles: ['ADMIN_CLUB', 'COACH_ANALYST'],
  },
  {
    id: 'player-statistics',
    label: 'Estadísticas',
    icon: 'bi-graph-up',
    route: '/player-statistics',
    roles: ['PLAYER'],
  },
  {
    id: 'admin',
    label: 'Administración',
    icon: 'bi-gear',
    route: '/admin/ovaltrack',
    roles: ['ADMIN_OVALTRACK'],
  },
];
