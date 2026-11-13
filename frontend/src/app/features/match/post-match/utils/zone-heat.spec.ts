import { heatScale } from './zone-heat';

describe('zone-heat', () => {
  describe('heatScale: la escala sale de los valores que se muestran', () => {
    const labels = (values: number[]): string[] => heatScale(values).steps.map(step => step.label);

    it('sin eventos (o todo en cero) solo existe el 0', () => {
      expect(labels([])).toEqual(['0']);
      expect(labels([0, 0, 0])).toEqual(['0']);
    });

    it('con pocos valores distintos cada valor es su propio nivel', () => {
      expect(labels([1, 3, 7, 3])).toEqual(['0', '1', '3', '7']);
    });

    it('si todas las celdas valen lo mismo hay un solo nivel', () => {
      expect(labels([1, 1, 1])).toEqual(['0', '1']);
    });

    it('partido chico (máximo 10): reparte en cuartiles con los rangos reales', () => {
      expect(labels([1, 1, 2, 2, 3, 4, 5, 6, 7, 8, 10])).toEqual(['0', '1–2', '3–4', '5–7', '8–10']);
    });

    it('partido grande (cientos de eventos): los cortes siguen al máximo actual', () => {
      expect(labels([12, 20, 25, 31, 40, 55, 60, 80, 120, 300])).toEqual(['0', '12–25', '31–40', '55–80', '120–300']);
    });

    it('si varios cuartiles coinciden se unen y no quedan rangos vacíos', () => {
      expect(labels([1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 3, 4, 5])).toEqual(['0', '1', '2', '3–5']);
    });

    it('ignora ceros, negativos y valores inválidos', () => {
      expect(labels([0, -3, Number.NaN, 5, 5])).toEqual(['0', '5']);
    });

    it('los niveles son consecutivos desde 0', () => {
      expect(heatScale([1, 1, 2, 2, 3, 4, 5, 6, 7, 8, 10]).steps.map(step => step.level)).toEqual([0, 1, 2, 3, 4]);
    });

    describe('levelOf', () => {
      const scale = heatScale([1, 1, 2, 2, 3, 4, 5, 6, 7, 8, 10]);

      it('el cero y los valores inválidos son nivel 0', () => {
        expect([0, -1, Number.NaN].map(value => scale.levelOf(value))).toEqual([0, 0, 0]);
      });

      it('un 10 y un 1 ya no caen en el mismo tono', () => {
        expect(scale.levelOf(10)).toBeGreaterThan(scale.levelOf(1));
      });

      it('cada valor cae en el rango que dice su etiqueta', () => {
        expect([1, 2, 3, 4, 5, 7, 8, 10].map(value => scale.levelOf(value))).toEqual([1, 1, 2, 2, 3, 3, 4, 4]);
      });

      it('un valor mayor que el máximo conocido queda en el último nivel', () => {
        expect(scale.levelOf(99)).toBe(4);
      });
    });

    describe('mezcla de color', () => {
      const mixes = (values: number[]): number[] => heatScale(values).steps.map(step => step.mix);

      it('con cuatro niveles va del ámbar al naranja', () => {
        expect(mixes([1, 1, 2, 2, 3, 4, 5, 6, 7, 8, 10])).toEqual([0, 0, 1 / 3, 2 / 3, 1]);
      });

      it('con dos niveles el más alto es el naranja', () => {
        expect(mixes([1, 5])).toEqual([0, 0, 1]);
      });

      it('con un solo nivel es el ámbar claro', () => {
        expect(mixes([4, 4])).toEqual([0, 0]);
      });
    });
  });
});
