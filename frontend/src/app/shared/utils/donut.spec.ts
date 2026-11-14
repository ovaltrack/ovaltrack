import {
  DonutSlice,
  describeDonut,
  donutSegments,
  gaugeDonut,
  isEmptyDonut,
  limitSlices,
  roundedPercents,
  shareDonut,
  slicePercents,
  teamTones,
  versusDonut,
  withTeam,
} from './donut';

const slice = (label: string, value: number): DonutSlice => ({ label, value, color: 'red' });
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

describe('roundedPercents', () => {
  it('suma siempre 100, aunque el redondeo simple no lo haga', () => {
    expect(roundedPercents([1, 1, 1])).toEqual([34, 33, 33]);
    expect(sum(roundedPercents([7, 11, 13, 17, 19]))).toBe(100);
  });

  it('devuelve ceros si no hay total', () => {
    expect(roundedPercents([0, 0])).toEqual([0, 0]);
    expect(roundedPercents([])).toEqual([]);
  });

  it('no le asigna porcentaje a lo que vale cero', () => {
    expect(roundedPercents([3, 0, 1])).toEqual([75, 0, 25]);
  });
});

describe('slicePercents', () => {
  it('calcula sobre el máximo: un avance del 61 % deja 39 % sin informar', () => {
    expect(slicePercents([slice('Posesión', 61)], 100)).toEqual([61]);
  });

  it('en un reparto la suma da 100', () => {
    expect(sum(slicePercents([slice('a', 1), slice('b', 1), slice('c', 1)], 3))).toBe(100);
  });
});

describe('donutSegments', () => {
  it('acumula el desplazamiento de cada tramo y llena el círculo', () => {
    const segments = donutSegments([slice('a', 1), slice('b', 3)], 100, 4);
    expect(segments.map(s => s.dash)).toEqual([25, 75]);
    expect(segments.map(s => s.offset)).toEqual([0, 25]);
    expect(segments.map(s => s.gap)).toEqual([75, 25]);
  });

  it('deja en largo cero lo que no tiene valor y conserva su lugar en la leyenda', () => {
    const [own, rival] = donutSegments([slice('Propio', 2), slice('Rival', 0)], 100, 2);
    expect(own.dash).toBe(100);
    expect(rival.dash).toBe(0);
    expect(rival.percent).toBe(0);
  });

  it('con máximo cero no dibuja nada ni divide por cero', () => {
    expect(donutSegments([slice('a', 0)], 100, 0).map(s => s.dash)).toEqual([0]);
  });
});

describe('limitSlices', () => {
  const items = ['a', 'b', 'c', 'd', 'e'].map((label, index) => ({ label, value: index + 1 }));

  it('no toca una lista que entra', () => {
    expect(limitSlices(items, 5)).toEqual(items);
  });

  it('conserva las más grandes en su orden y junta el resto en «Otros»', () => {
    const limited = limitSlices(items, 3);
    expect(limited.map(s => s.label)).toEqual(['d', 'e', 'Otros']);
    expect(limited[2].value).toBe(1 + 2 + 3);
    expect(limited[2].muted).toBeTrue();
  });
});

describe('teamTones', () => {
  it('el primer tono es el color del equipo y los siguientes lo mezclan con la superficie', () => {
    const [first, second] = teamTones('--btn-primary-bg', 2);
    expect(first).toBe('var(--btn-primary-bg)');
    expect(second).toContain('color-mix(in srgb, var(--btn-primary-bg) 82%, var(--surface))');
  });

  it('repite el último tono si hay más porciones que tonos', () => {
    const tones = teamTones('--team-rival', 10);
    expect(tones.length).toBe(10);
    expect(tones[9]).toBe(tones[8]);
  });
});

describe('versusDonut', () => {
  const names = { own: 'Club', opponent: 'Rival' };

  it('suma ambos equipos en el centro y respeta el texto de la leyenda', () => {
    const chart = versusDonut('tries', 'Tries', { ownValue: 3, opponentValue: 1, own: '3', opponent: '1' }, names);
    expect(chart.center).toEqual({ value: '4', label: 'total' });
    expect(chart.max).toBe(4);
    expect(chart.slices.map(s => s.label)).toEqual(['Club', 'Rival']);
  });

  it('usa el texto «convertidos/intentos» en la leyenda pero cuenta solo los convertidos', () => {
    const chart = versusDonut('goal', 'Patadas', { ownValue: 2, opponentValue: 1, own: '2/3', opponent: '1/1' }, names);
    expect(chart.slices[0].display).toBe('2/3');
    expect(chart.max).toBe(3);
  });

  it('sin datos queda vacío', () => {
    expect(isEmptyDonut(versusDonut('x', 'X', { ownValue: 0, opponentValue: 0 }, names))).toBeTrue();
  });
});

describe('shareDonut', () => {
  it('colorea con la rampa del equipo y suma el total', () => {
    const chart = shareDonut('src', 'Origen', [{ label: 'Scrum', value: 2 }, { label: 'Line-out', value: 1 }], '--btn-primary-bg');
    expect(chart.slices[0].color).toBe('var(--btn-primary-bg)');
    expect(chart.slices[1].color).not.toBe(chart.slices[0].color);
    expect(chart.center.value).toBe('3');
  });

  it('pinta en neutro las porciones de relleno sin gastar un tono de la rampa', () => {
    const chart = shareDonut('src', 'Origen', [
      { label: 'Sin completar', value: 1, muted: true },
      { label: 'Scrum', value: 2 },
    ], '--btn-primary-bg');
    expect(chart.slices[0].color).toBe('var(--border-strong)');
    expect(chart.slices[1].color).toBe('var(--btn-primary-bg)');
  });

  it('agrupa en «Otros» cuando hay demasiadas categorías', () => {
    const items = Array.from({ length: 9 }, (_, index) => ({ label: `c${index}`, value: index + 1 }));
    const chart = shareDonut('many', 'Muchas', items, '--team-rival');
    expect(chart.slices.length).toBe(6);
    expect(chart.slices[5].label).toBe('Otros');
    expect(chart.max).toBe(45);
  });
});

describe('gaugeDonut', () => {
  it('muestra el porcentaje en el centro', () => {
    const chart = gaugeDonut('poss', 'Posesión', 61.5, '--btn-primary-bg');
    expect(chart.center.value).toBe('61.5%');
    expect(chart.max).toBe(100);
    expect(chart.slices[0].value).toBe(61.5);
  });

  it('acota a 0–100', () => {
    expect(gaugeDonut('a', 'A', 140, '--x').slices[0].value).toBe(100);
    expect(gaugeDonut('a', 'A', -3, '--x').slices[0].value).toBe(0);
  });

  it('sin dato queda vacío con «—»', () => {
    const chart = gaugeDonut('a', 'A', null, '--x');
    expect(isEmptyDonut(chart)).toBeTrue();
    expect(chart.center.value).toBe('—');
  });
});

describe('withTeam', () => {
  it('asocia la dona al equipo con su color, sin modificar la original', () => {
    const chart = gaugeDonut('p', 'Posesión', 50, '--x');
    const owned = withTeam(chart, 'Club', '--btn-primary-bg');
    expect(owned.team).toEqual({ name: 'Club', color: 'var(--btn-primary-bg)' });
    expect(chart.team).toBeUndefined();
  });

  it('el texto para lectores de pantalla nombra al equipo', () => {
    expect(describeDonut(withTeam(gaugeDonut('p', 'Tackles', 70, '--x'), 'Club', '--y'))).toBe('Tackles de Club: 70%');
  });
});

describe('describeDonut', () => {
  it('lista cada porción con su valor y porcentaje', () => {
    const chart = versusDonut('t', 'Tries', { ownValue: 3, opponentValue: 1 }, { own: 'Club', opponent: 'Rival' });
    expect(describeDonut(chart)).toBe('Tries: Club 3 (75 %), Rival 1 (25 %)');
  });

  it('en un avance dice el porcentaje', () => {
    expect(describeDonut(gaugeDonut('p', 'Posesión', 61, '--x'))).toBe('Posesión: 61%');
  });

  it('avisa si no hay datos', () => {
    expect(describeDonut(gaugeDonut('p', 'Posesión', null, '--x'))).toBe('Posesión: sin datos');
  });
});
