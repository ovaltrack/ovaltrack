import { ComponentFixture, TestBed } from '@angular/core/testing';
import { gaugeDonut } from '../../utils/donut';
import { StatDonutComponent } from './stat-donut.component';

describe('StatDonutComponent', () => {
  let fixture: ComponentFixture<StatDonutComponent>;

  const trackOf = (percent: number | null): SVGCircleElement => {
    fixture.componentRef.setInput('chart', gaugeDonut('g', 'Efectividad', percent, '--btn-primary-bg'));
    fixture.detectChanges();
    return fixture.nativeElement.querySelector('.donut__track');
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [StatDonutComponent] });
    fixture = TestBed.createComponent(StatDonutComponent);
  });

  it('un anillo sin dato lleva el carril punteado', () => {
    expect(trackOf(null).classList).toContain('donut__track--none');
  });

  it('un anillo en 0 % mantiene el carril continuo', () => {
    expect(trackOf(0).classList).not.toContain('donut__track--none');
  });
});
