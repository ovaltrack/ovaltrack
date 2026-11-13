import { dragNewRange, minuteAtPosition, resizeRange } from './zone-drag';
import { ZoneAssignmentResponse } from '../../types/zone.types';

describe('zone-drag', () => {
  const zone = (id: string, period: 1 | 2, startMinute: number, endMinute: number, row = 2, col = 3): ZoneAssignmentResponse =>
    ({ id, matchId: 'm', period, startMinute, endMinute, row, col });

  describe('minuteAtPosition', () => {
    it('con un solo tiempo a la vista el minuto sale de ese tramo (2T: 40–80)', () => {
      expect(minuteAtPosition(0, 400, { start: 40, end: 80 })).toBe(40);
      expect(minuteAtPosition(200, 400, { start: 40, end: 80 })).toBe(60);
      expect(minuteAtPosition(999, 400, { start: 40, end: 80 })).toBe(80);
    });

    it('convierte la posición en el minuto entero más cercano de los 80', () => {
      expect(minuteAtPosition(0, 800)).toBe(0);
      expect(minuteAtPosition(400, 800)).toBe(40);
      expect(minuteAtPosition(104, 800)).toBe(10);
      expect(minuteAtPosition(800, 800)).toBe(80);
    });

    it('limita el punto a la pista aunque el cursor salga de ella y no falla con ancho 0', () => {
      expect(minuteAtPosition(-50, 800)).toBe(0);
      expect(minuteAtPosition(5000, 800)).toBe(80);
      expect(minuteAtPosition(10, 0)).toBe(0);
    });
  });

  describe('dragNewRange (crear sobre un hueco)', () => {
    it('F2-H2. arrastrar a la derecha dibuja el rango entre el ancla y el cursor', () => {
      expect(dragNewRange([], 1, 10, 18)).toEqual({ range: { period: 1, startMinute: 10, endMinute: 18 }, notice: null });
    });

    it('arrastrar hacia la izquierda invierte los extremos', () => {
      expect(dragNewRange([], 1, 18, 10).range).toEqual({ period: 1, startMinute: 10, endMinute: 18 });
    });

    it('F2-S1. se frena en el entretiempo y explica el motivo', () => {
      const result = dragNewRange([], 1, 30, 55);

      expect(result.range).toEqual({ period: 1, startMinute: 30, endMinute: 40 });
      expect(result.notice).toBe('tope: entretiempo');
    });

    it('en el 2T se frena en el entretiempo al ir hacia atrás y en el final del partido al ir hacia adelante', () => {
      expect(dragNewRange([], 2, 50, 20)).toEqual({
        range: { period: 2, startMinute: 40, endMinute: 50 }, notice: 'tope: entretiempo' });
      expect(dragNewRange([], 2, 70, 80).notice).toBeNull();
    });

    it('en el 1T se frena en el inicio del partido', () => {
      expect(dragNewRange([], 1, 5, 0).notice).toBeNull();
      expect(dragNewRange([], 1, 5, -3).notice).toBe('tope: inicio del partido');
    });

    it('F2-S1. se frena en otro tramo y lo nombra', () => {
      const result = dragNewRange([zone('a', 1, 20, 30)], 1, 10, 28);

      expect(result.range).toEqual({ period: 1, startMinute: 10, endMinute: 20 });
      expect(result.notice).toBe('tope: tramo C3');
    });

    it('hacia la izquierda también se frena en el tramo vecino', () => {
      const result = dragNewRange([zone('a', 1, 0, 10)], 1, 25, 2);

      expect(result.range).toEqual({ period: 1, startMinute: 10, endMinute: 25 });
      expect(result.notice).toBe('tope: tramo C3');
    });

    it('sin movimiento no hay rango (es un clic) y empezar fuera de un hueco no crea nada', () => {
      expect(dragNewRange([], 1, 10, 10).range).toBeNull();
      expect(dragNewRange([zone('a', 1, 0, 40)], 1, 10, 20)).toEqual({ range: null, notice: 'No hay un hueco libre en ese minuto' });
    });
  });

  describe('resizeRange (estirar o achicar un tramo)', () => {
    const segment = zone('s', 1, 10, 20);

    it('F2-H3. estira y achica ambos bordes dentro del hueco', () => {
      expect(resizeRange([segment], segment, 'end', 26).range).toEqual({ period: 1, startMinute: 10, endMinute: 26 });
      expect(resizeRange([segment], segment, 'end', 14).range).toEqual({ period: 1, startMinute: 10, endMinute: 14 });
      expect(resizeRange([segment], segment, 'start', 4).range).toEqual({ period: 1, startMinute: 4, endMinute: 20 });
      expect(resizeRange([segment], segment, 'start', 15).range).toEqual({ period: 1, startMinute: 15, endMinute: 20 });
    });

    it('no cruza el entretiempo', () => {
      const result = resizeRange([segment], segment, 'end', 60);

      expect(result.range?.endMinute).toBe(40);
      expect(result.notice).toBe('tope: entretiempo');
    });

    it('no pisa al tramo vecino y lo nombra', () => {
      const neighbor = zone('n', 1, 25, 35, 1, 5);
      const result = resizeRange([segment, neighbor], segment, 'end', 32);

      expect(result.range?.endMinute).toBe(25);
      expect(result.notice).toBe('tope: tramo I5');
    });

    it('el borde de inicio se frena en el tramo de la izquierda y en el inicio del partido', () => {
      const left = zone('l', 1, 0, 6);

      expect(resizeRange([left, segment], segment, 'start', 2)).toEqual({
        range: { period: 1, startMinute: 6, endMinute: 20 }, notice: 'tope: tramo C3' });
      expect(resizeRange([segment], segment, 'start', -4).notice).toBe('tope: inicio del partido');
    });

    it('un tramo no puede quedar de menos de 1 minuto', () => {
      expect(resizeRange([segment], segment, 'end', 10)).toEqual({
        range: { period: 1, startMinute: 10, endMinute: 11 }, notice: 'El tramo debe durar al menos 1 minuto' });
      expect(resizeRange([segment], segment, 'start', 25).range?.startMinute).toBe(19);
    });

    it('los tramos del otro tiempo no condicionan el borde', () => {
      const secondHalf = zone('h', 2, 40, 60);

      expect(resizeRange([segment, secondHalf], segment, 'end', 40).range?.endMinute).toBe(40);
    });

    it('en el 2T el límite izquierdo es el entretiempo', () => {
      const second = zone('s2', 2, 50, 60);

      expect(resizeRange([second], second, 'start', 30)).toEqual({
        range: { period: 2, startMinute: 40, endMinute: 60 }, notice: 'tope: entretiempo' });
    });
  });

  describe('cortes por try', () => {
    const tryCut = { period: 1 as const, minute: 23, label: 'Try 22:30' };

    it('crear arrastrando frena en el corte hacia adelante y lo nombra', () => {
      expect(dragNewRange([], 1, 20, 30, [tryCut])).toEqual({ range: { period: 1, startMinute: 20, endMinute: 23 }, notice: 'tope: Try 22:30' });
    });

    it('crear arrastrando hacia atrás frena en el corte', () => {
      expect(dragNewRange([], 1, 28, 15, [tryCut])).toEqual({ range: { period: 1, startMinute: 23, endMinute: 28 }, notice: 'tope: Try 22:30' });
    });

    it('un corte de otro tiempo no frena', () => {
      expect(dragNewRange([], 2, 50, 60, [tryCut]).notice).toBeNull();
    });

    it('estirar el fin de un tramo frena en el corte', () => {
      const segment = { id: 's', period: 1 as const, startMinute: 20, endMinute: 22, row: 2, col: 5 };

      expect(resizeRange([segment], segment, 'end', 30, [tryCut]))
        .toEqual({ range: { period: 1, startMinute: 20, endMinute: 23 }, notice: 'tope: Try 22:30' });
    });

    it('estirar el inicio de un tramo frena en el corte', () => {
      const segment = { id: 's', period: 1 as const, startMinute: 25, endMinute: 30, row: 2, col: 3 };

      expect(resizeRange([segment], segment, 'start', 15, [tryCut]))
        .toEqual({ range: { period: 1, startMinute: 23, endMinute: 30 }, notice: 'tope: Try 22:30' });
    });
  });
});
