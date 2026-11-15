/**
 * Espera a que aparezca en el DOM el elemento que señala un paso (las pantallas se cargan en diferido).
 * Devuelve `null` si no aparece antes del timeout: el paso se muestra centrado, sin resaltado.
 */
export function waitForAnchor(selector: string, timeoutMs = 3000, root: ParentNode = document): Promise<HTMLElement | null> {
  const found = root.querySelector<HTMLElement>(selector);
  if (found) {
    return Promise.resolve(found);
  }
  return new Promise(resolve => {
    const observer = new MutationObserver(() => {
      const element = root.querySelector<HTMLElement>(selector);
      if (element) {
        finish(element);
      }
    });
    const timer = setTimeout(() => finish(null), timeoutMs);
    function finish(element: HTMLElement | null): void {
      clearTimeout(timer);
      observer.disconnect();
      resolve(element);
    }
    observer.observe(document.body, { childList: true, subtree: true });
  });
}
