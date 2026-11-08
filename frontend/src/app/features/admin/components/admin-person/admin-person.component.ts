import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { UserRole } from 'src/app/features/auth/types/auth.types';
import { initials, roleClass } from '../../utils/admin-format';

/**
 * Celda de identidad: avatar con iniciales (cuenta) o logo con la inicial (club), nombre y detalle.
 * Es un atributo para que el host sea la celda misma (`<div role="cell" appAdminPerson>`)
 * y la grilla de la tabla siga viendo `.adm-person` como hijo directo de la fila.
 */
@Component({
  selector: '[appAdminPerson]',
  standalone: true,
  host: { class: 'adm-person' },
  template: `
    @if (kind() === 'logo') {
      <span class="adm-logo" aria-hidden="true">{{ name()[0] }}</span>
    } @else {
      <span class="adm-avatar" [class]="avatarClass()" aria-hidden="true">{{ initialsText() }}</span>
    }
    <span class="adm-person-text">
      <b>{{ name() }}</b>
      @if (detail()) {
        <span [class.adm-mono]="monoDetail()">{{ detail() }}</span>
      }
    </span>
  `,
  styleUrl: './admin-person.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminPersonComponent {
  readonly name = input.required<string>();
  readonly detail = input<string | null>(null);
  readonly kind = input<'avatar' | 'logo'>('avatar');
  readonly userRole = input<UserRole | null>(null);
  readonly small = input(false);
  readonly monoDetail = input(false);

  readonly initialsText = computed(() => initials(this.name()));
  readonly avatarClass = computed(() => {
    const role = this.userRole();
    return ['adm-avatar', role ? roleClass(role) : 'role-player', this.small() ? 'adm-avatar-sm' : ''].join(' ').trim();
  });
}
