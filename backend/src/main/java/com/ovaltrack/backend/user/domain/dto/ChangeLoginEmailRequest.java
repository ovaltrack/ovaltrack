package com.ovaltrack.backend.user.domain.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Cambio del correo de acceso: se confirma con la contraseña actual y se aplica al instante. */
public record ChangeLoginEmailRequest(
        @NotBlank(message = "Ingresá tu contraseña actual.")
        @Schema(accessMode = Schema.AccessMode.WRITE_ONLY)
        String currentPassword,

        @NotBlank(message = "El correo nuevo es obligatorio.")
        @Email(message = "El formato del correo nuevo no es válido.")
        @Size(max = 254, message = "El correo nuevo no puede superar los 254 caracteres.")
        @Schema(example = "martin.perez@correo.com")
        String newEmail) {

    /** Evita que la contraseña aparezca en logs. */
    @Override
    public String toString() {
        return "ChangeLoginEmailRequest[newEmail=" + newEmail + ", currentPassword=***]";
    }
}
