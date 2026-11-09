import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { AuthResponse } from '../../types/auth.types';
import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
  let fixture: ComponentFixture<LoginComponent>;
  let component: LoginComponent;
  let response$: Subject<AuthResponse>;
  let authService: jasmine.SpyObj<AuthService>;

  beforeEach(async () => {
    response$ = new Subject<AuthResponse>();
    authService = jasmine.createSpyObj<AuthService>('AuthService', ['login', 'getErrorMessage']);
    authService.login.and.returnValue(response$.asObservable());
    authService.getErrorMessage.and.returnValue('Correo o contraseña incorrectos.');

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [provideRouter([]), { provide: AuthService, useValue: authService }],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    fixture.detectChanges();
    component.loginForm.setValue({ email: 'coach@club.com', password: 'Secreta123' });
  });

  it('no envía un formulario inválido', () => {
    component.loginForm.setValue({ email: 'no-es-correo', password: '' });
    component.onSubmit();
    expect(authService.login).not.toHaveBeenCalled();
  });

  it('ignora clics repetidos mientras espera la respuesta', () => {
    component.onSubmit();
    component.onSubmit();
    component.onSubmit();

    expect(authService.login).toHaveBeenCalledTimes(1);
    expect(component.submitting()).toBeTrue();
    fixture.detectChanges();
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button[type="submit"]');
    expect(button.disabled).toBeTrue();
    expect(button.textContent).toContain('Ingresando');
  });

  it('libera el botón y muestra el error si falla', () => {
    component.onSubmit();
    response$.error(new Error('401'));

    expect(component.submitting()).toBeFalse();
    expect(component.errorMessage()).toBe('Correo o contraseña incorrectos.');
  });
});
