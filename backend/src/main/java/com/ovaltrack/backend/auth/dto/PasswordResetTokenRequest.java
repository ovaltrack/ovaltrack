package com.ovaltrack.backend.auth.dto;

import jakarta.validation.constraints.NotBlank;

/** Token en crudo recibido en el enlace del correo de recupero. */
public record PasswordResetTokenRequest(
        @NotBlank(message = "El enlace no es válido.")
        String token) {
}
