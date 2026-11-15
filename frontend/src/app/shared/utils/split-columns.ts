/** Reparte en dos columnas independientes: los de índice par a la izquierda y los impares a la derecha. */
export function splitColumns<T>(items: T[]): [T[], T[]] {
  return [items.filter((_, index) => index % 2 === 0), items.filter((_, index) => index % 2 === 1)];
}
