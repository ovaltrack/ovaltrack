import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import {
  AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ToastService } from 'src/app/core/services/toast.service';
// ADAPTA: rutas y nombres de tus servicios/modelos existentes de persona y división.
import { Division } from 'src/app/features/division/types/division.types';

import { InvitationService } from './service/invitation.service';
import {
  InvitationAction, InvitationSummary, InvitationValidationResponse,
} from './types/invitation.types';
import { PersonService } from 'src/app/services/person.service';
import { DivisionService } from 'src/app/services/division.service';
import { PersonResponse } from '../person/types/person.types';
import { AuthService } from '../auth/services/auth.service';

type View = 'loading' | 'invalid' | 'create' | 'link' | 'done';

/** Marca el error `mismatch` en el grupo si las contraseñas no coinciden. */
function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value;
  const confirm = group.get('confirmPassword')?.value;
  return password && confirm && password !== confirm ? { mismatch: true } : null;
}

@Component({
  selector: 'app-invitation',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './invitation.component.html',
  styleUrl: './invitation.component.css'
})
export class InvitationComponent implements OnInit {
  private token: string = '';

  view: View = 'loading';
  action: InvitationAction | null = null;
  summary: InvitationSummary | null = null;
  errorMessage = '';
  submitting = false;
  showPasswords = false;

  readonly form = new FormGroup(
    {
      password: new FormControl('', {
        nonNullable: true,
        validators: [
          Validators.required,
          Validators.minLength(8),
          Validators.pattern(/^(?=.*[A-Za-z])(?=.*\d).+$/),
        ],
      }),
      confirmPassword: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      termsAccepted: new FormControl(false, {
        nonNullable: true,
        validators: [Validators.requiredTrue],
      }),
    },
    { validators: passwordsMatch },
  );

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private toastService: ToastService,
    private invitationService: InvitationService,
    private personService: PersonService,
    private divisionService: DivisionService,
    private authService: AuthService
  ) { }

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) {
      this.toastService.show('error', 'No se encontro el token de acceso');
      this.router.navigateByUrl('/home');
      return;
    }
    this.token = token;

    this.invitationService.validate(token).subscribe({
      next: (response) => this.loadSummary(response),
      error: (error: HttpErrorResponse) =>
        this.markInvalid(error.error?.message ?? 'El enlace venció o no es válido.'),
    });
  }

  /** Trae a la persona y la división para mostrarlas, y decide qué formulario abrir. */
  private loadSummary(response: InvitationValidationResponse): void {
    forkJoin({
      person: this.personService.getPersonById(response.personId),
      division: this.divisionService.getDivisionById(response.divisionId),
    }).subscribe({
      next: ({ person, division }) => {
        this.summary = this.toSummary(person, division);
        this.action = response.action;
        this.view = response.action === 'CREATE_ACCOUNT' ? 'create' : 'link';
      },
      error: () => this.markInvalid('No pudimos cargar los datos de la invitación.'),
    });
  }

  // ADAPTA: nombres de campos de tus modelos.
  private toSummary(person: PersonResponse, division: Division): InvitationSummary {
    return {
      playerName: `${person.firstName} ${person.lastName}`,
      email: person.contactEmail!,
      divisionName: division.name,
    };
  }

  /** Requisitos que se marcan en vivo mientras escribe. */
  get rules(): { label: string; ok: boolean }[] {
    const value = this.form.controls.password.value;
    return [
      { label: 'Al menos 8 caracteres', ok: value.length >= 8 },
      { label: 'Una letra', ok: /[A-Za-z]/.test(value) },
      { label: 'Un número', ok: /\d/.test(value) },
    ];
  }

  get passwordInvalid(): boolean {
    const control = this.form.controls.password;
    return control.invalid && (control.touched || control.dirty);
  }

  get termsInvalid(): boolean {
    const control = this.form.controls.termsAccepted;
    return control.invalid && control.touched;
  }

  get confirmInvalid(): boolean {
    const control = this.form.controls.confirmPassword;
    return (control.touched || control.dirty) &&
           (control.hasError('required') || this.form.hasError('mismatch'));
  }

  get confirmError(): string {
    return this.form.hasError('mismatch')
      ? 'Las contraseñas no coinciden.'
      : 'Repite la contraseña para continuar.';
  }

  createAccount(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting = true;
    this.authService
      .registerFromInvitation({
        token: this.token,
        password: this.form.controls.password.value,
        termsAccepted: this.form.controls.termsAccepted.value,
      })
      .subscribe({
        next: () => this.finish(),
        error: (error: HttpErrorResponse) => this.handleSubmitError(error),
      });
  }

  acceptLink(): void {
    this.submitting = true;
    this.invitationService.accept({ token: this.token }).subscribe({
      next: () => this.finish(),
      error: (error: HttpErrorResponse) => this.handleSubmitError(error),
    });
  }

  private finish(): void {
    this.submitting = false;
    this.view = 'done';
  }

  private handleSubmitError(error: HttpErrorResponse): void {
    this.submitting = false;
    const message = error.error?.message;
    if (error.status === 410) {
      this.markInvalid(message ?? 'El enlace venció o ya se usó.');
      return;
    }
    this.toastService.error(message ?? 'No pudimos completar la acción. Intenta de nuevo.', 'Error');
  }

  private markInvalid(message: string): void {
    this.errorMessage = message;
    this.view = 'invalid';
  }
}