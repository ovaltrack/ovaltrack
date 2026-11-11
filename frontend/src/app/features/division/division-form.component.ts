import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { UserContextService } from 'src/app/core/services/user-context.service';
import { DivisionService } from 'src/app/services/division.service';
import { ToastService } from 'src/app/core/services/toast.service';

@Component({
  selector: 'app-division-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './division-form.component.html',
  styleUrls: ['./styles/division-forms.css', './division-form.component.css']
})
export class DivisionFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly divisionService = inject(DivisionService);
  readonly userContext = inject(UserContextService);
  private readonly toastService = inject(ToastService);

  divisionDetails!: FormGroup;
  guardando: boolean = false;

  readonly myClub = this.userContext.currentClub;

  ngOnInit(): void {
    this.iniciarFormulario();
  }

  getClubCrest(): string {
    const name = this.myClub()?.name?.trim();
    return name ? name.charAt(0).toUpperCase() : 'O';
  }

  iniciarFormulario(): void {
    this.divisionDetails = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      ageCategory: ['', Validators.required],
      gender: ['', Validators.required]
    });
  }

  guardarDivision(): void {
    const club = this.myClub();
    if (!club?.id) {
      this.toastService.show('error', 'No se puede crear una división sin un club asignado.', 'Error');
      return;
    }

    if (this.divisionDetails.valid) {
      this.guardando = true;
      const payload = {
        ...this.divisionDetails.value,
        clubId: club.id
      };

      this.divisionService.createDivision(payload).subscribe({
        next: () => {
          this.toastService.show('success', '¡División creada con éxito!', 'División creada');
          this.divisionDetails.reset({
            name: '',
            ageCategory: '',
            gender: ''
          });
          this.guardando = false;
        },
        error: (err) => {
          console.error('Error al crear la división', err);
          const msg = typeof err.error === 'string'
            ? err.error
            : (err.error?.message || err.error?.mensaje || 'Error al crear la división.');
          this.toastService.show('error', msg, 'Error');
          this.guardando = false;
        }
      });
    } else {
      this.divisionDetails.markAllAsTouched();
    }
  }
}
