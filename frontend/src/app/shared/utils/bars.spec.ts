import {
  BarChart,
  barPercent,
  describeBars,
  isEmptyBars,
  niceScaleMax,
  scaleMaxFor,
  scaleTicks,
  showsColumnValues,
  teamBars,
  versusBars,
} from './bars';
import { withTeam } from './donut';

const names = { own: 'Puerto Madryn', opponent: 'Rival' };

describe('niceScaleMax', () => {
  it('no baja de 4, para que un eje con pocos eventos no se estire', () => {
    expect([0, 1, 3, 4].map(niceScaleMax)).toEqual([4, 4, 4, 4]);
  });

  it('redondea hacia arriba a medio orden de magnitud (misma escala que el gráfico de líneas)', () => {
    expect(niceScaleMax(5)).toBe(5);
    expect(niceScaleMax(7)).toBe(7);
    expect(niceScaleMax(7.2)).toBe(7.5);
    expect(niceScaleMax(13)).toBe(15);
    expect(niceScaleMax(99)).toBe(100);
    expect(niceScaleMax(120)).toBe(150);
  });
});

describe('scaleMaxFor', () => {
  it('los porcentajes siempre van de 0 a 100, sin importar el máximo', () => {
    expect(scaleMaxFor('percent', [12, 30])).toBe(100);
  });

  it('las cantidades usan el mayor valor y descartan los que no tienen dato', () => {
    expect(scaleMaxFor('count', [3, null, 13])).toBe(15);
    expect(scaleMaxFor('count', [null, null])).toBe(4);
  });
});

describe('scaleTicks', () => {
  it('marca cero, la mitad y el máximo', () => {
    expect(scaleTicks({ max: 15, unit: 'count' })).toEqual([
      { value: 0, label: '0', percent: 0 },
      { value: 7.5, label: '7.5', percent: 50 },
      { value: 15, label: '15', percent: 100 },
    ]);
  });

  it('en porcentajes agrega el símbolo', () => {
    expect(scaleTicks({ max: 100, unit: 'percent' }).map(tick => tick.label)).toEqual(['0%', '50%', '100%']);
  });
});

describe('barPercent', () => {
  it('calcula el largo sobre el máximo del eje', () => {
    expect(barPercent(5, 20)).toBe(25);
  });

  it('recorta al rango 0–100', () => {
    expect(barPercent(30, 20)).toBe(100);
    expect(barPercent(-3, 20)).toBe(0);
  });

  it('sin dato o sin escala no hay barra', () => {
    expect(barPercent(null, 20)).toBe(0);
    expect(barPercent(5, 0)).toBe(0);
  });
});

describe('versusBars', () => {
  it('arma una barra por equipo en cada línea con el color de cada uno', () => {
    const chart = versusBars('tries', 'Tries', [{ label: 'Tries', ownValue: 3, opponentValue: 1 }], names);

    expect(chart.groups[0].values).toEqual([
      { series: 'Puerto Madryn', value: 3, display: '3', color: 'var(--btn-primary-bg)' },
      { series: 'Rival', value: 1, display: '1', color: 'var(--team-rival)' },
    ]);
    expect(chart.orientation).toBe('horizontal');
  });

  it('comparte una escala redondeada entre todas las líneas', () => {
    const chart = versusBars('x', 'X', [
      { label: 'A', ownValue: 13, opponentValue: 2 },
      { label: 'B', ownValue: 1, opponentValue: 0 },
    ], names);

    expect(chart.max).toBe(15);
  });

  it('usa el texto de la fila cuando lo trae (convertidos/intentos) y «—» si no hay dato', () => {
    const chart = versusBars('kick', 'Patadas', [
      { label: 'Conversión', ownValue: 2, opponentValue: null, own: '2/3', opponent: undefined },
    ], names);

    expect(chart.groups[0].values.map(value => value.display)).toEqual(['2/3', '—']);
  });

  it('en porcentajes la escala es 0–100 y el texto lleva el símbolo', () => {
    const chart = versusBars('p', 'Indicadores', [{ label: 'Tackle', ownValue: 85.5, opponentValue: null }], names, { unit: 'percent' });

    expect(chart.max).toBe(100);
    expect(chart.groups[0].values.map(value => value.display)).toEqual(['85.5%', '—']);
  });

  it('respeta la orientación pedida', () => {
    expect(versusBars('b', 'B', [], names, { orientation: 'vertical' }).orientation).toBe('vertical');
  });
});

describe('teamBars', () => {
  it('arma una barra por categoría en el orden recibido, con el color del equipo', () => {
    const chart = teamBars('a', 'Pateo', [
      { label: 'Conversiones', value: 3, display: '2 de 3' },
      { label: 'Penales', value: 1 },
    ], '--btn-primary-bg');

    expect(chart.groups.map(group => group.label)).toEqual(['Conversiones', 'Penales']);
    expect(chart.groups[0].values[0]).toEqual({ series: 'Conversiones', value: 3, display: '2 de 3', color: 'var(--btn-primary-bg)' });
    expect(chart.groups[1].values[0].display).toBe('1');
    expect(chart.max).toBe(4);
  });
});

describe('isEmptyBars', () => {
  it('es vacío sin grupos o con todo sin dato', () => {
    expect(isEmptyBars(versusBars('a', 'A', [], names))).toBeTrue();
    expect(isEmptyBars(versusBars('b', 'B', [{ label: 'L', ownValue: null, opponentValue: null }], names, { unit: 'percent' }))).toBeTrue();
  });

  it('en cantidades, todo en cero también es vacío', () => {
    expect(isEmptyBars(versusBars('c', 'C', [{ label: 'L', ownValue: 0, opponentValue: 0 }], names))).toBeTrue();
  });

  it('una secuencia en cero (columnas) es un dato: ninguna tarjeta en el rango no es «sin datos»', () => {
    const quiet = versusBars('e', 'E', [{ label: 'L', ownValue: 0, opponentValue: 0 }], names, { orientation: 'vertical' });
    const unknown = versusBars('f', 'F', [{ label: 'L', ownValue: null, opponentValue: null }], names, { orientation: 'vertical' });

    expect(isEmptyBars(quiet)).toBeFalse();
    expect(isEmptyBars(unknown)).toBeTrue();
  });

  it('un porcentaje en cero es un dato, no un gráfico vacío', () => {
    expect(isEmptyBars(versusBars('d', 'D', [{ label: 'L', ownValue: 0, opponentValue: null }], names, { unit: 'percent' }))).toBeFalse();
  });
});

describe('showsColumnValues', () => {
  const chartWith = (groups: number): BarChart =>
    versusBars('s', 'S', Array.from({ length: groups }, (_, index) => ({ label: `${index}`, ownValue: 1, opponentValue: 1 })), names, { orientation: 'vertical' });

  it('muestra los valores mientras entren sin pisarse', () => {
    expect(showsColumnValues(chartWith(12))).toBeTrue();
  });

  it('los oculta cuando hay más de 24 valores (siguen en el título y en el texto accesible)', () => {
    expect(showsColumnValues(chartWith(13))).toBeFalse();
  });
});

describe('describeBars', () => {
  it('lista cada grupo con el valor de cada serie', () => {
    const chart = versusBars('t', 'Tries', [{ label: 'Tries', ownValue: 3, opponentValue: 1 }], names);

    expect(describeBars(chart)).toBe('Tries: Tries: Puerto Madryn 3, Rival 1');
  });

  it('avisa la escala en los porcentajes', () => {
    const chart = versusBars('i', 'Indicadores', [{ label: 'Tackle', ownValue: 85, opponentValue: 70 }], names, { unit: 'percent' });

    expect(describeBars(chart)).toBe('Indicadores (de 0 a 100 %): Tackle: Puerto Madryn 85%, Rival 70%');
  });

  it('con una sola serie escribe «categoría valor»', () => {
    const chart = teamBars('a', 'Pateo', [{ label: 'Conversiones', value: 3, display: '2 de 3' }, { label: 'Penales', value: 1 }], '--x');

    expect(describeBars(chart)).toBe('Pateo: Conversiones 2 de 3; Penales 1');
  });

  it('sin etiqueta de grupo escribe solo los valores: el título ya nombra la fila', () => {
    const chart = versusBars('v', 'Visitas', [{ label: '', ownValue: 3, opponentValue: 1 }], names);

    expect(describeBars(chart)).toBe('Visitas: Puerto Madryn 3, Rival 1');
  });

  it('dice «sin datos» si no hay nada que dibujar', () => {
    expect(describeBars(versusBars('e', 'Penales', [], names))).toBe('Penales: sin datos');
  });

  it('nombra el equipo cuando el gráfico es de uno solo', () => {
    const chart = withTeam(teamBars('a', 'Pateo', [], '--x'), 'Puerto Madryn', '--btn-primary-bg');

    expect(describeBars(chart)).toBe('Pateo de Puerto Madryn: sin datos');
  });
});
