import { TestBed } from '@angular/core/testing';
import { BarChart } from '../../utils/bars';
import { StatColumnsComponent } from './stat-columns.component';

describe('StatColumnsComponent', () => {
  const chart = (sublabels: (string | undefined)[]): BarChart => ({
    id: 'points', title: 'Puntos', orientation: 'vertical', unit: 'count', max: 20,
    groups: sublabels.map((sublabel, index) => ({
      label: `0${index + 1}/09`, sublabel, detail: 'd',
      values: [{ series: 'A favor', value: 10, display: '10', color: 'var(--x)' }],
    })),
  });
  const render = (value: BarChart): HTMLElement => {
    TestBed.configureTestingModule({ imports: [StatColumnsComponent] });
    const fixture = TestBed.createComponent(StatColumnsComponent);
    fixture.componentRef.setInput('chart', value);
    fixture.detectChanges();
    return fixture.nativeElement;
  };

  it('pone la sigla del rival debajo de la fecha y reserva dos renglones en el eje', () => {
    const element = render(chart(['DP', 'PAT']));
    expect(Array.from(element.querySelectorAll('.cols__xsub')).map(node => node.textContent)).toEqual(['DP', 'PAT']);
    expect(element.querySelector('.cols__xaxis')?.classList).toContain('cols__xaxis--two-lines');
  });

  it('cada grupo lleva su rótulo o, si se saltea, una marca corta en el eje', () => {
    const element = render(chart(Array.from({ length: 11 }, () => 'DP')));
    const labels = element.querySelectorAll('.cols__xtext').length;
    const marks = element.querySelectorAll('.cols__xmark').length;
    expect(labels + marks).toBe(11);
    expect(labels).toBeGreaterThanOrEqual(6);
  });

  it('sin siglas (bloques de 10\') el eje queda en un renglón', () => {
    const element = render(chart([undefined, undefined]));
    expect(element.querySelectorAll('.cols__xsub').length).toBe(0);
    expect(element.querySelector('.cols__xaxis')?.classList).not.toContain('cols__xaxis--two-lines');
  });
});
