import { FOCUS_SPARK_MATCHES, FocusView, focusRows } from './focus-rows';

describe('focusRows', () => {
  const flat = [75, 75, 75, 75];
  const stableSeries = { lineout: flat, tackle: [80, 80, 80, 80], penalties: [8, 8, 8, 8] };
  const rowsOf = (view: FocusView) => view.status === 'rows' ? view.rows : [];

  it('con menos de 3 partidos: no hay con qué comparar', () => {
    expect(focusRows({ series: { lineout: [70, 60], tackle: [80, 80], penalties: [5, 9] } })).toEqual({ status: 'not-enough' });
    expect(focusRows({ series: { lineout: [], tackle: [], penalties: [] } })).toEqual({ status: 'not-enough' });
  });

  it('con todo estable: sin desvíos y las tres estables para el pie', () => {
    expect(focusRows({ series: stableSeries })).toEqual({ status: 'stable', stable: ['Line-out propio', 'Efectividad de tackle', 'Penales cometidos'] });
  });

  it('alerta de line-out con su nota, valor, chip y mini gráfico', () => {
    const view = focusRows({
      series: { ...stableSeries, lineout: [78, 70, 75, 80, 72, 76, 73, 58] },
      lineoutLast: { won: 7, total: 12 }
    });
    expect(rowsOf(view).length).toBe(1);
    const row = rowsOf(view)[0];
    expect(row).toEqual(jasmine.objectContaining({
      metric: 'lineout', name: 'Line-out propio', valueLabel: '58 %', subtitle: 'Promedio previo 74,9 % · 7 de 12 ganados', average: 74.9,
      chip: { text: '▼ −16,9 p.p. · peor', tone: 'worse' }
    }));
    expect(row.spark).toEqual([78, 70, 75, 80, 72, 76, 73, 58]);
    expect(row.ariaLabel).toBe('Line-out propio en los últimos 8 partidos: 78, 70, 75, 80, 72, 76, 73, 58. Último 58 %, promedio previo 74,9 %');
    expect(view.status === 'rows' && view.stable).toEqual(['Efectividad de tackle', 'Penales cometidos']);
  });

  it('sin line-outs del último partido la fila omite esa nota', () => {
    const view = focusRows({ series: { ...stableSeries, lineout: [78, 70, 75, 58] } });
    expect(rowsOf(view)[0].subtitle).toBe('Promedio previo 74,3 %');
  });

  it('penales: subir es peor, sin unidad ni p.p.', () => {
    const view = focusRows({ series: { ...stableSeries, penalties: [9, 12, 8, 7, 10, 6, 11, 13] } });
    expect(rowsOf(view)[0]).toEqual(jasmine.objectContaining({
      metric: 'penalties', valueLabel: '13', subtitle: 'Promedio previo 9 · subir es peor', chip: { text: '▲ +4 · peor', tone: 'worse' }
    }));
  });

  it('suma la mejora no estable más grande, al final', () => {
    const view = focusRows({ series: { lineout: [70, 70, 70, 50], tackle: [80, 82, 78, 92], penalties: [8, 8, 8, 8] } });
    expect(rowsOf(view).map(row => [row.metric, row.chip.tone])).toEqual([['lineout', 'worse'], ['tackle', 'better']]);
    expect(rowsOf(view)[1].subtitle).toBe('Promedio previo 80 % · la mejora más grande');
    expect(rowsOf(view)[1].chip.text).toBe('▲ +12 p.p. · mejor');
  });

  it('una variación pequeña no es mejora: queda estable', () => {
    const view = focusRows({ series: { ...stableSeries, tackle: [80, 80, 80, 81] } });
    expect(view.status).toBe('stable');
  });

  it('como mucho 3 filas', () => {
    const view = focusRows({ series: { lineout: [80, 80, 80, 60], tackle: [80, 80, 80, 60], penalties: [5, 5, 5, 12] } });
    expect(rowsOf(view).length).toBe(3);
  });

  it('el mini gráfico dibuja los últimos 8 partidos', () => {
    const long = [50, 51, 52, 53, 54, 55, 56, 57, 58, 40];
    const row = rowsOf(focusRows({ series: { ...stableSeries, tackle: long } }))[0];
    expect(row.spark.length).toBe(FOCUS_SPARK_MATCHES);
    expect(row.spark[row.spark.length - 1]).toBe(40);
  });

  it('un partido de la serie sin datos de otra métrica no rompe: las series cortas se ignoran', () => {
    const view = focusRows({ series: { lineout: [80, 80, 80, 60], tackle: [90], penalties: [] } });
    expect(rowsOf(view).map(row => row.metric)).toEqual(['lineout']);
    expect(view.status === 'rows' && view.stable).toEqual([]);
  });
});
