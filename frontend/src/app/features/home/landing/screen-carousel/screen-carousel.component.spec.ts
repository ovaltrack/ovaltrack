import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ScreenCarouselComponent } from './screen-carousel.component';
import { LANDING_SCREENS } from '../landing-content';

describe('ScreenCarouselComponent', () => {
  let fixture: ComponentFixture<ScreenCarouselComponent>;
  let host: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ScreenCarouselComponent] });
    fixture = TestBed.createComponent(ScreenCarouselComponent);
    fixture.componentRef.setInput('screens', LANDING_SCREENS);
    host = fixture.nativeElement as HTMLElement;
    host.style.width = '1000px';
    document.body.appendChild(host);
    fixture.detectChanges();
  });

  afterEach(() => host.remove());

  const tabs = (): HTMLButtonElement[] => Array.from(host.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
  const slides = (): HTMLElement[] => Array.from(host.querySelectorAll<HTMLElement>('[role="tabpanel"]'));
  const arrow = (label: string): HTMLButtonElement =>
    host.querySelector<HTMLButtonElement>(`[aria-label="Pantalla ${label}"]`)!;

  it('muestra una pestaña y una diapositiva por pantalla, con la primera activa', () => {
    expect(tabs().length).toBe(LANDING_SCREENS.length);
    expect(slides().length).toBe(LANDING_SCREENS.length);
    expect(tabs()[0].getAttribute('aria-selected')).toBe('true');
    expect(slides()[1].hasAttribute('inert')).toBeTrue();
    expect(arrow('anterior').disabled).toBeTrue();
  });

  it('una pestaña lleva a su pantalla', () => {
    tabs()[3].click();
    fixture.detectChanges();

    expect(fixture.componentInstance.activeIndex()).toBe(3);
    expect(tabs()[3].getAttribute('aria-selected')).toBe('true');
    expect(slides()[3].hasAttribute('inert')).toBeFalse();
  });

  it('las flechas avanzan y se desactivan en los extremos', () => {
    arrow('siguiente').click();
    fixture.detectChanges();
    expect(fixture.componentInstance.activeIndex()).toBe(1);

    fixture.componentInstance.goTo(99);
    fixture.detectChanges();
    expect(fixture.componentInstance.activeIndex()).toBe(LANDING_SCREENS.length - 1);
    expect(arrow('siguiente').disabled).toBeTrue();
  });

  it('el teclado recorre las pantallas desde las pestañas', () => {
    const tabList = tabs();
    tabList[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(fixture.componentInstance.activeIndex()).toBe(LANDING_SCREENS.length - 1);

    tabList[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    tabList[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(fixture.componentInstance.activeIndex()).toBe(1);
  });
});
