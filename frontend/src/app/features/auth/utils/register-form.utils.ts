import { AbstractControl, FormGroup, ValidationErrors, ValidatorFn } from '@angular/forms';

/** La fecha (yyyy-MM-dd) no puede ser futura. */
export const notInFuture: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = control.value as string;
  if (!value) return null;
  return value > todayIso() ? { future: true } : null;
};

export function todayIso(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

/** Marca como tocados los controles del paso y dice si todos son válidos. */
export function validateStep(form: FormGroup, names: readonly string[]): boolean {
  names.forEach((name) => form.get(name)?.markAsTouched());
  return names.every((name) => form.get(name)?.valid ?? true);
}

/** Lleva el foco al primer campo inválido del contenedor (después del render). */
export function focusFirstInvalid(root: HTMLElement): void {
  setTimeout(() => root.querySelector<HTMLElement>('.is-invalid')?.focus());
}

export function formatDate(iso: string): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
