import { DOCUMENT } from '@angular/common';
import { inject } from '@angular/core';
import {
  LEGAL_CONTACT_EMAIL, LEGAL_JURISDICTION, LEGAL_PROVIDER, LEGAL_UPDATED_AT, LEGAL_VERSION, LegalSection,
} from './legal-info';

/** Datos y comportamiento comunes a las páginas legales. */
export abstract class LegalPageBase {
  private readonly document = inject(DOCUMENT);

  abstract readonly sections: LegalSection[];

  readonly version = LEGAL_VERSION;
  readonly updatedAt = LEGAL_UPDATED_AT;
  readonly provider = LEGAL_PROVIDER;
  readonly jurisdiction = LEGAL_JURISDICTION;
  readonly contactEmail = LEGAL_CONTACT_EMAIL;

  /** Desplaza hasta la sección y le pasa el foco (sin tocar la URL: los anclas # no sirven con el router). */
  goToSection(id: string): void {
    const target = this.document.getElementById(id);
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    target.focus({ preventScroll: true });
  }

  print(): void {
    this.document.defaultView?.print();
  }
}
