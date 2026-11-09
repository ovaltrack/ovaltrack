package com.ovaltrack.backend.user.domain.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Datos de contacto que el usuario puede editar desde su perfil. No cambia el correo de inicio de sesión. */
public record UpdateContactRequest(
        @NotBlank(message = "El correo de contacto es obligatorio.")
        @Email(message = "El formato del correo de contacto no es válido.")
        @Size(max = 254, message = "El correo de contacto no puede superar los 254 caracteres.")
        @Schema(example = "martin.perez@correo.com")
        String contactEmail,

        @Size(max = 40, message = "El teléfono no puede superar los 40 caracteres.")
        @Schema(example = "+54 280 4000000", nullable = true)
        String contactPhone) {
}
