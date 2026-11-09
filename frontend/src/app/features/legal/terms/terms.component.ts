import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LegalSection } from '../legal-info';
import { LegalPageBase } from '../legal-page.base';

/** Términos y Condiciones de uso de OvalTrack (página pública). */
@Component({
  selector: 'app-terms',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './terms.component.html',
  styleUrls: ['../legal-page.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TermsComponent extends LegalPageBase {
  readonly sections: LegalSection[] = [
    { id: 'aceptacion', title: 'Aceptación' },
    { id: 'servicio', title: 'Qué es OvalTrack' },
    { id: 'cuentas', title: 'Cuentas y roles' },
    { id: 'menores', title: 'Menores de edad' },
    { id: 'clubes', title: 'Obligaciones de los clubes' },
    { id: 'uso', title: 'Uso permitido' },
    { id: 'contenido', title: 'Datos y contenido cargado' },
    { id: 'offline', title: 'Uso sin conexión' },
    { id: 'disponibilidad', title: 'Disponibilidad del servicio' },
    { id: 'propiedad', title: 'Propiedad intelectual' },
    { id: 'baja', title: 'Suspensión y baja' },
    { id: 'responsabilidad', title: 'Responsabilidad' },
    { id: 'terceros', title: 'Servicios de terceros' },
    { id: 'cambios', title: 'Cambios en los términos' },
    { id: 'ley', title: 'Ley aplicable y jurisdicción' },
    { id: 'contacto', title: 'Contacto' },
  ];
}
