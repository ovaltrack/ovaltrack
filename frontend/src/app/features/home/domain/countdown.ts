const HOUR_MS = 3_600_000;

/** Un partido a menos de 24 h muestra cuenta regresiva en vez de fecha. */
export const MATCH_DAY_WINDOW_MS = 24 * HOUR_MS;

/** `HH:MM:SS` restante; se detiene en `00:00:00` cuando el partido ya empezó. */
export function formatCountdown(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map(part => String(part).padStart(2, '0')).join(':');
}
