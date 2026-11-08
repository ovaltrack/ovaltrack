import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LandingComponent } from './landing.component';
import { LANDING_FEATURES, LANDING_SCREENS } from './landing-content';

describe('LandingComponent', () => {
  let fixture: ComponentFixture<LandingComponent>;
  let host: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [LandingComponent],
      providers: [provideRouter([])]
    });
    fixture = TestBed.createComponent(LandingComponent);
    fixture.detectChanges();
    host = fixture.nativeElement as HTMLElement;
  });

  const featuresButton = (): HTMLButtonElement =>
    Array.from(host.querySelectorAll<HTMLButtonElement>('button'))
      .find(button => button.textContent?.includes('Ver funcionalidades'))!;

  it('muestra una tarjeta por cada funcionalidad', () => {
    expect(host.querySelectorAll('#features .feature-card').length).toBe(LANDING_FEATURES.length);
  });

  it('"Ver funcionalidades" lleva a la sección de funcionalidades', () => {
    const section = host.querySelector<HTMLElement>('#features')!;
    const scroll = spyOn(section, 'scrollIntoView');

    featuresButton().click();

    expect(scroll).toHaveBeenCalled();
    expect(document.activeElement).toBe(section);
  });

  it('muestra las capturas reales con texto alternativo', () => {
    const shots = Array.from(host.querySelectorAll<HTMLImageElement>('#features app-screen-carousel img'));
    expect(shots.length).toBe(LANDING_SCREENS.length);
    shots.forEach(shot => expect(shot.alt.length).toBeGreaterThan(0));
  });

  it('tiene una sola acción primaria', () => {
    expect(host.querySelectorAll('.btn-invite').length).toBe(1);
  });
});
