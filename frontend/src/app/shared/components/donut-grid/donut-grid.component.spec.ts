import { TestBed } from '@angular/core/testing';
import { DonutChart, gaugeDonut } from '../../utils/donut';
import { DonutGridComponent } from './donut-grid.component';

describe('DonutGridComponent', () => {
  const render = (charts: DonutChart[]): HTMLElement => {
    TestBed.configureTestingModule({ imports: [DonutGridComponent] });
    const fixture = TestBed.createComponent(DonutGridComponent);
    fixture.componentRef.setInput('charts', charts);
    fixture.detectChanges();
    return fixture.nativeElement;
  };

  it('dibuja los dos anillos de un indicador en una celda con un solo título', () => {
    const element = render([
      { ...gaugeDonut('scrum-own', 'Scrums propios ganados', 50, '--btn-primary-bg'), group: 'scrum' },
      { ...gaugeDonut('scrum-rival', 'Scrums propios ganados', 0, '--team-rival'), group: 'scrum' },
    ]);

    expect(element.querySelectorAll('.donut-pair').length).toBe(1);
    expect(element.querySelectorAll('.donut-pair__title').length).toBe(1);
    expect(element.querySelectorAll('.donut__title').length).toBe(0);
    expect(element.querySelectorAll('app-stat-donut').length).toBe(2);
    expect(element.querySelector('.donut-grid')?.classList).toContain('donut-grid--pairs');
  });

  it('las donas sin grupo siguen sueltas, cada una con su título', () => {
    const element = render([gaugeDonut('a', 'A', 10, '--x'), gaugeDonut('b', 'B', 20, '--x')]);

    expect(element.querySelectorAll('.donut-pair').length).toBe(0);
    expect(element.querySelectorAll('.donut__title').length).toBe(2);
  });
});
