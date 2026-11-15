import { TestBed } from '@angular/core/testing';
import { BarChart, versusBars } from '../../utils/bars';
import { StatBarsComponent } from './stat-bars.component';

describe('StatBarsComponent', () => {
  const render = (chart: BarChart): HTMLElement => {
    TestBed.configureTestingModule({ imports: [StatBarsComponent] });
    const fixture = TestBed.createComponent(StatBarsComponent);
    fixture.componentRef.setInput('chart', chart);
    fixture.detectChanges();
    return fixture.nativeElement;
  };
  const names = { own: 'Club', opponent: 'Rival' };

  it('en un tanto con intentos dibuja el carril de intentos debajo de la barra de convertidos', () => {
    const element = render(versusBars('score', 'Tantos', [
      { label: 'Conversión', ownValue: 1, opponentValue: 2, own: '1/3', opponent: '2/3', ownOf: 3, opponentOf: 3 },
    ], names));

    const attempts = Array.from(element.querySelectorAll<HTMLElement>('.bars__attempts'));
    expect(attempts.length).toBe(2);
    expect(attempts[0].style.background).toContain('color-mix');
    expect(element.querySelectorAll('.bars__fill').length).toBe(2);
  });

  it('sin intentos no hay carril de intentos', () => {
    const element = render(versusBars('t', 'Tries', [{ label: 'Try', ownValue: 3, opponentValue: 1 }], names));
    expect(element.querySelectorAll('.bars__attempts').length).toBe(0);
  });
});
