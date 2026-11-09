import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { getUserInitials } from '../../../../core/navigation/user-initials';
import { ToastService } from '../../../../core/services/toast.service';
import { AuthService } from '../../../auth/services/auth.service';
import { ROLE_META } from '../../../members/types/members.types';
import { ProfileService } from '../../services/profile.service';
import { UserProfile } from '../../types/profile.types';
import { ACCOUNT_STATUS, CLUB_STATUS, ageFrom, categoryLabel, formatLongDate, genderLabel } from './profile.labels';

type LoadState = 'loading' | 'ready' | 'error';
/** Formulario abierto: uno a la vez, así hay un solo botón primario en pantalla. */
type EditMode = 'contact' | 'login' | null;

/** "Mi perfil": datos de la cuenta, de la persona y del club; permite editar el contacto. */
@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileComponent {
  private readonly profileService = inject(ProfileService);
  private readonly toast = inject(ToastService);
  private readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly emailInput = viewChild<ElementRef<HTMLInputElement>>('emailInput');
  private readonly newEmailInput = viewChild<ElementRef<HTMLInputElement>>('newEmailInput');

  readonly state = signal<LoadState>('loading');
  readonly profile = signal<UserProfile | null>(null);
  readonly editing = signal<EditMode>(null);
  readonly showPassword = signal(false);
  readonly saving = signal(false);

  readonly formatLongDate = formatLongDate;
  readonly categoryLabel = categoryLabel;
  readonly genderLabel = genderLabel;

  readonly contactForm = this.fb.nonNullable.group({
    contactEmail: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    contactPhone: ['', [Validators.maxLength(40)]],
  });

  readonly loginForm = this.fb.nonNullable.group({
    newEmail: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    currentPassword: ['', [Validators.required]],
  });

  readonly fullName = computed(() => {
    const p = this.profile();
    if (!p) return '';
    return p.person ? `${p.person.firstName} ${p.person.lastName}` : p.account.loginEmail;
  });
  readonly initials = computed(() => getUserInitials(this.fullName(), this.profile()?.account.loginEmail ?? ''));
  readonly role = computed(() => {
    const role = this.profile()?.account.role;
    return role ? ROLE_META[role] : null;
  });
  readonly accountStatus = computed(() => {
    const status = this.profile()?.account.status;
    return status ? ACCOUNT_STATUS[status] : null;
  });
  readonly clubStatus = computed(() => {
    const status = this.profile()?.club?.status;
    return status ? CLUB_STATUS[status] : null;
  });
  readonly age = computed(() => ageFrom(this.profile()?.person?.birthDate ?? null));
  readonly clubInitial = computed(() => this.profile()?.club?.name.trim().charAt(0).toUpperCase() ?? '');
  readonly divisionsTitle = computed(() =>
    this.profile()?.account.role === 'ADMIN_CLUB' ? 'Divisiones del club' : 'Mis divisiones',
  );

  constructor() {
    this.load();
  }

  load(): void {
    this.state.set('loading');
    this.profileService
      .getProfile()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (profile) => {
          this.profile.set(profile);
          this.state.set('ready');
        },
        error: () => this.state.set('error'),
      });
  }

  showError(name: 'contactEmail' | 'contactPhone'): boolean {
    const control = this.contactForm.controls[name];
    return control.invalid && control.touched;
  }

  showLoginError(name: 'newEmail' | 'currentPassword'): boolean {
    const control = this.loginForm.controls[name];
    return control.invalid && control.touched;
  }

  startEdit(): void {
    const person = this.profile()?.person;
    if (!person) return;
    this.contactForm.reset({ contactEmail: person.contactEmail ?? '', contactPhone: person.contactPhone ?? '' });
    this.editing.set('contact');
    setTimeout(() => this.emailInput()?.nativeElement.focus());
  }

  startLoginEdit(): void {
    this.loginForm.reset();
    this.showPassword.set(false);
    this.editing.set('login');
    setTimeout(() => this.newEmailInput()?.nativeElement.focus());
  }

  cancelEdit(): void {
    this.editing.set(null);
  }

  saveContact(): void {
    if (this.saving()) return;
    if (this.contactForm.invalid) {
      this.contactForm.markAllAsTouched();
      return;
    }
    const { contactEmail, contactPhone } = this.contactForm.getRawValue();
    this.saving.set(true);
    this.profileService
      .updateContact({ contactEmail: contactEmail.trim(), contactPhone: contactPhone.trim() || null })
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (profile) => {
          this.profile.set(profile);
          this.editing.set(null);
          this.toast.success('Tus datos de contacto quedaron actualizados.', 'Contacto guardado');
        },
        error: (error: HttpErrorResponse) =>
          this.toast.error(error.error?.message ?? 'Intentá de nuevo en unos minutos.', 'No se pudo guardar el contacto'),
      });
  }

  /** Cambia el correo de acceso y cierra la sesión: el token anterior deja de servir. */
  saveLoginEmail(): void {
    if (this.saving()) return;
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }
    const { newEmail, currentPassword } = this.loginForm.getRawValue();
    this.saving.set(true);
    this.profileService
      .changeLoginEmail({ newEmail: newEmail.trim(), currentPassword })
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (response) => {
          this.toast.success(response.message, 'Correo de acceso actualizado');
          this.authService.logout();
        },
        error: (error: HttpErrorResponse) =>
          this.toast.error(error.error?.message ?? 'Intentá de nuevo en unos minutos.', 'No se pudo cambiar el correo'),
      });
  }
}
