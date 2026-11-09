package com.ovaltrack.backend.auth.registration.domain.dto;

import com.ovaltrack.backend.club.domain.dto.ClubResponseDTO;
import com.ovaltrack.backend.user.domain.UserRole;
import com.ovaltrack.backend.auth.registration.domain.LegalTerms;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.time.LocalDate;

/**
 * Registro de jugadores y coaches: los datos del solicitante
 * y el club existente al que quiere unirse.
 */
@Schema(description = "Datos del solicitante (jugador o coach) y club al que se une")
public record MemberRegistrationDTO(

        @Valid
        @NotNull(message = "Los datos del solicitante son obligatorios")
        ApplicantData applicant,

        // Sin @Valid: el cliente solo envía el id de un club existente.
        // El servicio debe cargar el club desde la base de datos.
        @NotNull(message = "El club es obligatorio")
        ClubResponseDTO club,

        @NotNull(message = LegalTerms.NOT_ACCEPTED_MESSAGE)
        @AssertTrue(message = LegalTerms.NOT_ACCEPTED_MESSAGE)
        @Schema(description = "Aceptación de los Términos y Condiciones y de la Política de Privacidad vigentes", example = "true")
        Boolean termsAccepted) {

    /** Datos de la cuenta que se solicita. */
    public record ApplicantData(

            @NotBlank(message = "El email es obligatorio.")
            @Email(message = "El formato del email no es válido")
            @Size(max = 254, message = "El email no puede superar los 254 caracteres")
            @Schema(example = "tomas.paredes@tigresrc.com")
            String email,

            @NotBlank(message = "La contraseña es obligatoria.")
            @Size(min = 8, message = "La contraseña debe tener al menos 8 caracteres")
            @Schema(example = "Secreta123", accessMode = Schema.AccessMode.WRITE_ONLY)
            String password,

            @NotNull(message = "El rol solicitado es obligatorio.")
            @Schema(description = "Rol que solicita la cuenta. No admite roles de administración.")
            UserRole requestedRole,

            @NotBlank(message = "El nombre del usuario es obligatorio.")
            @Size(max = 100, message = "El nombre no puede superar los 100 caracteres")
            @Schema(example = "Tomás")
            String firstName,

            @NotBlank(message = "El apellido del usuario es obligatorio.")
            @Size(max = 100, message = "El apellido no puede superar los 100 caracteres")
            @Schema(example = "Paredes")
            String lastName,

            @NotNull(message = "La fecha de nacimiento es obligatoria.")
            @Past(message = "La fecha de nacimiento debe ser anterior a hoy")
            @Schema(example = "1998-03-22")
            LocalDate birthDate) {


        /** Evita que la contraseña aparezca en logs. */
        @Override
        public String toString() {
            return "ApplicantData[email=" + email + ", requestedRole=" + requestedRole
                    + ", firstName=" + firstName + ", lastName=" + lastName
                    + ", birthDate=" + birthDate + ", password=***]";
        }
    }
}