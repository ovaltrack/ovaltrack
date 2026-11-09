package com.ovaltrack.backend.auth.registration.domain.dto;

import com.ovaltrack.backend.auth.registration.domain.LegalTerms;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.time.LocalDate;

/**
 * Registro de un club junto con su administrador.
 * Con estos datos se crean la cuenta del administrador (rol ADMIN_CLUB)
 * y el club, ambos pendientes de aprobación.
 */
@Schema(description = "Datos del administrador y del club a registrar")
public record ClubRegistrationDTO(

        @Valid
        @NotNull(message = "Los datos del administrador son obligatorios")
        AdminData admin,

        @Valid
        @NotNull(message = "Los datos del club son obligatorios")
        ClubData club,

        @NotNull(message = LegalTerms.NOT_ACCEPTED_MESSAGE)
        @AssertTrue(message = LegalTerms.NOT_ACCEPTED_MESSAGE)
        @Schema(description = "Aceptación de los Términos y Condiciones y de la Política de Privacidad vigentes", example = "true")
        Boolean termsAccepted) {

    /** Datos de la cuenta que administrará el club. */
    public record AdminData(

            @NotBlank(message = "El email es obligatorio.")
            @Email(message = "El formato del email de contacto del club no es válido.")
            @Size(max = 254, message = "El email no puede superar los 254 caracteres")
            @Schema(example = "agus.gomez@lospumas.club")
            String email,

            @NotBlank(message = "La contraseña es obligatoria.")
            @Size(min = 8, message = "La contraseña debe tener al menos 8 caracteres.")
            @Schema(example = "Secreta123", accessMode = Schema.AccessMode.WRITE_ONLY)
            String password,

            @NotBlank(message = "El nombre del usuario es obligatorio.")
            @Size(max = 100, message = "El nombre no puede superar los 100 caracteres")
            @Schema(example = "Agustina")
            String firstName,

            @NotBlank(message = "El apellido del usuario es obligatorio.")
            @Size(max = 100, message = "El apellido no puede superar los 100 caracteres")
            @Schema(example = "Gómez")
            String lastName,

            @NotNull(message = "La fecha de nacimiento es obligatoria.")
            @Past(message = "La fecha de nacimiento debe ser anterior a la fecha actual")
            @Schema(example = "1990-05-14")
            LocalDate birthDate) {

        /** Evita que la contraseña aparezca en logs. */
        @Override
        public String toString() {
            return "AdminData[email=" + email + ", firstName=" + firstName
                    + ", lastName=" + lastName + ", birthDate=" + birthDate + ", password=***]";
        }
    }

    /** Datos del club que se va a crear. */
    public record ClubData(

            @NotBlank(message = "El nombre del club es obligatorio.")
            @Size(max = 180, message = "El nombre del club no puede superar los 180 caracteres.")
            @Schema(example = "Los Pumas del Sur")
            String name,

            @NotBlank(message = "La ciudad del club es obligatoria.")
            @Size(max = 180, message = "La ciudad del club no puede superar los 180 caracteres.")
            @Schema(example = "Puerto Madryn, Chubut")
            String city,

            @Email(message = "El formato del email de contacto del club no es válido.")
            @Size(max = 254, message = "El email no puede superar los 254 caracteres.")
            @Schema(example = "contacto@lospumas.club")
            String contactEmail,

            @Size(max = 40, message = "El teléfono no puede superar los 40 caracteres.")
            @Schema(example = "+54 280 1234567")
            String contactPhone) {
    }

}