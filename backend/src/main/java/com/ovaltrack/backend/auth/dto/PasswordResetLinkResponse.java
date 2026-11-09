package com.ovaltrack.backend.auth.dto;

/** Enlace de recupero válido: correo de acceso de la cuenta (lo usa el front para precargar el login). */
public record PasswordResetLinkResponse(String email) {
}
