/**
 * Avisa cada vez que cambia el ancho de un elemento (al redimensionar la ventana o su contenedor), también al empezar a
 * observarlo. Devuelve la función que deja de observar. Sin `ResizeObserver` (tests, navegadores viejos) no hace nada.
 */
export function observeWidth(element: HTMLElement, onChange: (width: number) => void): () => void {
  if (typeof ResizeObserver === 'undefined') return () => undefined;
  const observer = new ResizeObserver(() => onChange(element.clientWidth));
  observer.observe(element);
  return () => observer.disconnect();
}
