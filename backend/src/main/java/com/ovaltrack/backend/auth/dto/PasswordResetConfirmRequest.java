package com.ovaltrack.backend.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Contraseña nueva + token del enlace. El correo sale del token, nunca del cliente. */
public record PasswordResetConfirmRequest(
        @NotBlank(message = "El enlace no es válido.")
        String token,

        // Mismas reglas que el alta por invitación. Máx. 72: BCrypt ignora lo que pase de 72 bytes.
        @NotBlank(message = "La contraseña es obligatoria")
        @Size(min = 8, max = 72, message = "La contraseña debe tener entre 8 y 72 caracteres")
        @Pattern(regexp = "^(?=.*[A-Za-z])(?=.*\\d).+$",
                 message = "La contraseña debe incluir al menos una letra y un número")
        String password) {

    @Override
    public String toString() {
        return "PasswordResetConfirmRequest[token=***, password=***]";
    }
}
