import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ScreenCarouselComponent } from './screen-carousel.component';
import { LANDING_SCREENS } from '../landing-content';
import { ThemeService } from '../../../../core/services/theme.service';

describe('ScreenCarouselComponent', () => {
  let fixture: ComponentFixture<ScreenCarouselComponent>;
  let host: HTMLElement;
  let component: ScreenCarouselComponent;
  const last = LANDING_SCREENS.length - 1;
  const top = LANDING_SCREENS.findIndex(screen => screen.face === 'top');
  const bottom = LANDING_SCREENS.findIndex(screen => screen.face === 'bottom');
  const ring = LANDING_SCREENS.flatMap((screen, index) => (screen.face ? [] : [index]));

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ScreenCarouselComponent] });
    fixture = TestBed.createComponent(ScreenCarouselComponent);
    fixture.componentRef.setInput('screens', LANDING_SCREENS);
    component = fixture.componentInstance;
    host = fixture.nativeElement as HTMLElement;
    host.style.width = '1000px';
    document.body.appendChild(host);
    fixture.detectChanges();
  });

  afterEach(() => host.remove());

  const faces = (): HTMLElement[] => Array.from(host.querySelectorAll<HTMLElement>('.face'));
  const dots = (): HTMLButtonElement[] => Array.from(host.querySelectorAll<HTMLButtonElement>('.dot'));
  const scene = (): HTMLElement => host.querySelector<HTMLElement>('.scene')!;
  const arrow = (label: string): HTMLButtonElement =>
    host.querySelector<HTMLButtonElement>(`[aria-label="Pantalla ${label}"]`)!;
  const vturn = (side: string): HTMLButtonElement =>
    host.querySelector<HTMLButtonElement>(`[aria-label^="Girar hacia ${side}"]`)!;
  const pointer = (type: string, clientX: number): void => {
    scene().dispatchEvent(new PointerEvent(type, { pointerId: 1, clientX, clientY: 100, button: 0, pointerType: 'touch', bubbles: true }));
    fixture.detectChanges();
  };

  it('muestra una cara y un punto por pantalla, con la primera de frente', () => {
    expect(faces().length).toBe(LANDING_SCREENS.length);
    expect(dots().length).toBe(LANDING_SCREENS.length);
    expect(faces()[0].classList).toContain('face--active');
    expect(faces()[1].hasAttribute('inert')).toBeTrue();
    expect(dots()[0].getAttribute('aria-current')).toBe('true');
  });

  it('la flecha siguiente gira el cubo 90° y deja visible la cara que se va mientras gira', () => {
    arrow('siguiente').click();
    fixture.detectChanges();

    expect(component.activeIndex()).toBe(1);
    expect(component.yaw()).toBe(90);
    expect(faces()[1].classList).toContain('face--visible');
    expect(faces()[0].classList).toContain('face--visible');
    expect(faces()[2].classList).not.toContain('face--visible');
  });

  it('el anillo da la vuelta: desde la primera, la flecha anterior lleva a la última del anillo', () => {
    arrow('anterior').click();
    fixture.detectChanges();

    expect(component.activeIndex()).toBe(ring[ring.length - 1]);
    expect(component.yaw()).toBe(-90);
  });

  it('un punto lleva a su pantalla en un solo giro, por el lado más corto del anillo', () => {
    dots()[2].click();
    fixture.detectChanges();
    expect(component.activeIndex()).toBe(2);
    expect(component.yaw()).toBe(90);
    expect(dots()[2].getAttribute('aria-current')).toBe('true');

    dots()[0].click();
    fixture.detectChanges();
    expect(component.yaw()).toBe(180);
  });

  it('girar hacia arriba muestra la cara de arriba y hacia abajo vuelve a la cara de la que colgaba', () => {
    arrow('siguiente').click();
    vturn('arriba').click();
    fixture.detectChanges();

    expect(component.activeIndex()).toBe(top);
    expect(component.pitch()).toBe(90);
    expect(faces()[1].classList).toContain('face--visible');
    expect(host.querySelector('[aria-label^="Girar hacia arriba"]')).toBeNull();

    vturn('abajo').click();
    fixture.detectChanges();
    expect(component.activeIndex()).toBe(1);
    expect(component.pitch()).toBe(0);
  });

  it('de arriba a abajo gira 180° pasando por la cara del anillo', () => {
    dots()[top].click();
    dots()[bottom].click();
    fixture.detectChanges();

    expect(component.activeIndex()).toBe(bottom);
    expect(component.pitch()).toBe(-90);
    expect(faces()[0].classList).toContain('face--visible');
  });

  it('desde arriba, las flechas laterales vuelven al anillo', () => {
    dots()[top].click();
    arrow('siguiente').click();
    fixture.detectChanges();

    expect(component.activeIndex()).toBe(0);
    expect(component.pitch()).toBe(0);
  });

  it('las capturas siguen al tema activo', () => {
    const src = (): string => host.querySelector<HTMLImageElement>('.face-image')!.getAttribute('src')!;
    TestBed.inject(ThemeService).setTheme('dark');
    fixture.detectChanges();
    expect(src()).toContain('-dark-800.webp');

    TestBed.inject(ThemeService).setTheme('light');
    fixture.detectChanges();
    expect(src()).toContain('-light-800.webp');
  });

  it('arrastrar más allá del umbral pasa a la cara siguiente', () => {
    pointer('pointerdown', 600);
    pointer('pointermove', 400);
    expect(component.dragging()).toBeTrue();
    expect(component.yaw()).toBeGreaterThan(0);

    pointer('pointerup', 400);
    expect(component.dragging()).toBeFalse();
    expect(component.activeIndex()).toBe(1);
    expect(component.yaw()).toBe(90);
  });

  it('un arrastre corto vuelve a la cara de frente', () => {
    pointer('pointerdown', 600);
    pointer('pointermove', 580);
    pointer('pointerup', 580);

    expect(component.activeIndex()).toBe(0);
    expect(component.yaw()).toBe(0);
  });

  it('el teclado gira el cubo', () => {
    scene().dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(component.activeIndex()).toBe(last);

    scene().dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    scene().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(component.activeIndex()).toBe(1);

    scene().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    expect(component.activeIndex()).toBe(top);
  });
});
