import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LegalSection } from '../legal-info';
import { LegalPageBase } from '../legal-page.base';

/** Política de Privacidad de OvalTrack (página pública). */
@Component({
  selector: 'app-privacy',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './privacy.component.html',
  styleUrls: ['../legal-page.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrivacyComponent extends LegalPageBase {
  readonly sections: LegalSection[] = [
    { id: 'responsable', title: 'Responsable de los datos' },
    { id: 'datos', title: 'Qué datos tratamos' },
    { id: 'origen', title: 'De dónde salen los datos' },
    { id: 'finalidades', title: 'Para qué los usamos' },
    { id: 'base', title: 'Consentimiento' },
    { id: 'menores', title: 'Datos de menores de edad' },
    { id: 'acceso', title: 'Quién accede a los datos' },
    { id: 'transferencias', title: 'Proveedores y transferencias' },
    { id: 'local', title: 'Almacenamiento en tu dispositivo' },
    { id: 'conservacion', title: 'Cuánto tiempo los guardamos' },
    { id: 'seguridad', title: 'Seguridad' },
    { id: 'derechos', title: 'Tus derechos' },
    { id: 'cambios', title: 'Cambios en esta política' },
  ];
}
