import { sparklineGeometry } from './sparkline';

describe('sparklineGeometry', () => {
  it('con menos de 2 valores no hay gráfico', () => {
    expect(sparklineGeometry([], 140, 40)).toBeNull();
    expect(sparklineGeometry([5], 140, 40)).toBeNull();
  });

  it('serie plana: línea a media altura y promedio sobre ella', () => {
    const geometry = sparklineGeometry([10, 10, 10, 10], 140, 40)!;
    expect(geometry.points).toBe('5,20 48.3,20 91.7,20 135,20');
    expect(geometry.last).toEqual({ x: 135, y: 20 });
    expect(geometry.averageY).toBe(20);
    expect(geometry.average).toBe(10);
  });

  it('8 valores: el máximo arriba, el mínimo abajo, primero a la izquierda y último a la derecha', () => {
    const geometry = sparklineGeometry([78, 70, 75, 80, 72, 76, 73, 58], 140, 40)!;
    const points = geometry.points.split(' ').map(pair => pair.split(',').map(Number));
    expect(points.length).toBe(8);
    expect(points[0][0]).toBe(5);
    expect(points[7][0]).toBe(135);
    expect(points[3][1]).toBe(5);   // 80, el máximo
    expect(points[7][1]).toBe(35);  // 58, el mínimo
    expect(geometry.last).toEqual({ x: 135, y: 35 });
    expect(geometry.average).toBe(74.9);
    expect(geometry.averageY).toBeGreaterThan(5);
    expect(geometry.averageY).toBeLessThan(35);
  });

  it('usa el promedio recibido para la línea', () => {
    const geometry = sparklineGeometry([60, 70, 80], 140, 40, 70)!;
    expect(geometry.average).toBe(70);
    expect(geometry.averageY).toBe(20);
  });

  it('un promedio fuera del rango se acota al borde del gráfico', () => {
    expect(sparklineGeometry([60, 70, 80], 140, 40, 200)!.averageY).toBe(5);
  });
});
