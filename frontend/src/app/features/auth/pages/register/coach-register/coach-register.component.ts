import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { ToastService } from 'src/app/core/services/toast.service';
import { ClubService } from '../../../../../services/club.service';
import { ClubRegistrationOption } from '../../../../club/types/club.types';
import { RegisterStepsComponent } from '../../../components/register-steps/register-steps.component';
import { AuthService } from '../../../services/auth.service';
import { MemberRegistrationDTO } from '../../../types/auth.types';
import { focusFirstInvalid, formatDate, notInFuture, todayIso, validateStep } from '../../../utils/register-form.utils';

type ClubsState = 'loading' | 'ready' | 'empty' | 'error';

const STEP_FIELDS = [['clubId'], ['firstName', 'lastName', 'email', 'password', 'birthDate'], ['termsAccepted']] as const;
const normalize = (text: string): string =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('es');

/** Solicitud de acceso de un entrenador a un club activo: club → datos → revisar y enviar. */
@Component({
  selector: 'app-coach-register',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, RegisterStepsComponent],
  templateUrl: './coach-register.component.html',
  styleUrls: ['../../../styles/register-form.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CoachRegisterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly clubService = inject(ClubService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly stepTitle = viewChild<ElementRef<HTMLElement>>('stepTitle');

  readonly steps = ['Tu club', 'Tus datos', 'Revisar y enviar'];
  readonly step = signal(0);
  readonly submitting = signal(false);
  readonly doneMessage = signal<string | null>(null);
  readonly showPassword = signal(false);
  readonly today = todayIso();
  readonly formatDate = formatDate;

  /* ---------- Clubes ---------- */
  readonly clubs = signal<ClubRegistrationOption[]>([]);
  readonly clubsState = signal<ClubsState>('loading');
  readonly clubQuery = signal('');
  readonly clubsOpen = signal(false);
  readonly activeClub = signal(-1);
  readonly filteredClubs = computed(() => {
    const q = normalize(this.clubQuery().trim());
    return q ? this.clubs().filter((c) => normalize(`${c.name} ${c.city ?? ''}`).includes(q)) : this.clubs();
  });

  readonly form = this.fb.nonNullable.group({
    clubId: ['', [Validators.required]],
    firstName: ['', [Validators.required, Validators.maxLength(80)]],
    lastName: ['', [Validators.required, Validators.maxLength(80)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    birthDate: ['', [Validators.required, notInFuture]],
    termsAccepted: [false, [Validators.requiredTrue]],
  });

  readonly selectedClub = signal<ClubRegistrationOption | null>(null);

  constructor() {
    this.loadClubs();
  }

  loadClubs(): void {
    this.clubsState.set('loading');
    this.clubService
      .getRegistrationOptions()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (clubs) => {
          this.clubs.set(clubs);
          this.clubsState.set(clubs.length ? 'ready' : 'empty');
        },
        error: () => this.clubsState.set('error'),
      });
  }

  showError(name: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[name];
    return control.invalid && control.touched;
  }

  /* ---------- Buscador de club ---------- */
  onClubQuery(event: Event): void {
    this.clubQuery.set((event.target as HTMLInputElement).value);
    this.form.controls.clubId.setValue('');
    this.selectedClub.set(null);
    this.clubsOpen.set(true);
    this.activeClub.set(-1);
  }

  onClubBlur(): void {
    this.clubsOpen.set(false);
    this.activeClub.set(-1);
    this.form.controls.clubId.markAsTouched();
  }

  onClubKeydown(event: KeyboardEvent): void {
    const options = this.filteredClubs();
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      this.clubsOpen.set(true);
      if (!options.length) return;
      const step = event.key === 'ArrowDown' ? 1 : -1;
      this.activeClub.update((i) => (i < 0 ? (step > 0 ? 0 : options.length - 1) : (i + step + options.length) % options.length));
      return;
    }
    if (event.key === 'Enter' && this.clubsOpen() && options.length) {
      event.preventDefault();
      this.selectClub(options[Math.max(this.activeClub(), 0)]);
      return;
    }
    if (event.key === 'Escape') this.clubsOpen.set(false);
  }

  selectClub(club: ClubRegistrationOption): void {
    this.form.controls.clubId.setValue(club.id);
    this.form.controls.clubId.markAsTouched();
    this.selectedClub.set(club);
    this.clubQuery.set(club.name);
    this.clubsOpen.set(false);
    this.activeClub.set(-1);
  }

  /* ---------- Pasos ---------- */
  next(): void {
    if (this.step() === 0 && this.clubsState() !== 'ready') return;
    if (!validateStep(this.form, STEP_FIELDS[this.step()])) {
      focusFirstInvalid(this.host.nativeElement);
      return;
    }
    this.goTo(this.step() + 1);
  }

  back(): void {
    this.goTo(this.step() - 1);
  }

  goTo(index: number): void {
    this.step.set(Math.min(Math.max(index, 0), this.steps.length - 1));
    setTimeout(() => this.stepTitle()?.nativeElement.focus());
  }

  submit(): void {
    if (this.submitting()) return;
    const invalidStep = STEP_FIELDS.findIndex((fields) => !validateStep(this.form, fields));
    if (invalidStep !== -1) {
      if (invalidStep !== this.step()) this.goTo(invalidStep);
      focusFirstInvalid(this.host.nativeElement);
      return;
    }

    const raw = this.form.getRawValue();
    const payload: MemberRegistrationDTO = {
      applicant: {
        email: raw.email.trim(),
        password: raw.password,
        requestedRole: 'COACH_ANALYST',
        firstName: raw.firstName.trim(),
        lastName: raw.lastName.trim(),
        birthDate: raw.birthDate,
      },
      club: { id: raw.clubId },
    };

    this.submitting.set(true);
    this.authService
      .registerMember(payload)
      .pipe(
        finalize(() => this.submitting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (response) => this.doneMessage.set(response.message),
        error: (error: unknown) => this.toast.error(this.authService.getErrorMessage(error, 'register'), 'No se pudo enviar la solicitud'),
      });
  }
}
