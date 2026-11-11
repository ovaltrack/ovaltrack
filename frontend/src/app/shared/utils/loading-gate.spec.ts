import { LoadingGate } from './loading-gate';

describe('LoadingGate', () => {
  let gate: LoadingGate;

  beforeEach(() => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(0));
    gate = new LoadingGate(400, 400);
  });

  afterEach(() => {
    gate.dispose();
    jasmine.clock().uninstall();
  });

  const advance = (ms: number) => jasmine.clock().tick(ms);

  it('una carga rápida nunca muestra el indicador', async () => {
    gate.start();
    advance(300);
    expect(gate.pending()).toBeTrue();

    await gate.finish();
    advance(500);

    expect(gate.pending()).toBeFalse();
    expect(gate.showIndicator()).toBeFalse();
  });

  it('una carga lenta muestra el indicador recién a los 400 ms', () => {
    gate.start();
    advance(399);
    expect(gate.showIndicator()).toBeFalse();

    advance(1);
    expect(gate.showIndicator()).toBeTrue();
  });

  it('una vez visible, el indicador (y el esqueleto) quedan al menos 400 ms', async () => {
    gate.start();
    advance(500);

    let finished = false;
    const done = gate.finish().then(() => (finished = true));
    advance(299);
    await Promise.resolve();
    expect(finished).toBeFalse();
    expect(gate.pending()).toBeTrue();
    expect(gate.showIndicator()).toBeTrue();

    advance(1);
    await done;
    expect(gate.pending()).toBeFalse();
    expect(gate.showIndicator()).toBeFalse();
  });

  it('si el indicador ya estuvo visible el mínimo, termina en el acto', async () => {
    gate.start();
    advance(1200);

    await gate.finish();

    expect(gate.pending()).toBeFalse();
    expect(gate.showIndicator()).toBeFalse();
  });

  it('volver a llamar start durante la carga no reinicia la espera', () => {
    gate.start();
    advance(300);
    gate.start();
    advance(100);

    expect(gate.showIndicator()).toBeTrue();
  });

  describe('showNow', () => {
    it('muestra el indicador sin esperar los 400 ms y respeta el mínimo visible', async () => {
      gate.start();
      advance(50);

      const painted = gate.showNow();
      expect(gate.showIndicator()).toBeTrue();
      advance(1);
      await painted;

      let finished = false;
      const done = gate.finish().then(() => (finished = true));
      advance(398);
      await Promise.resolve();
      expect(finished).toBeFalse();

      advance(1);
      await done;
      expect(gate.showIndicator()).toBeFalse();
    });

    it('sin carga en curso no hace nada', async () => {
      await gate.showNow();

      expect(gate.showIndicator()).toBeFalse();
    });
  });
});
