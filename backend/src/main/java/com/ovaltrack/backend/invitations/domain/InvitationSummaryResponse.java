package com.ovaltrack.backend.invitations.domain;

/**
 * Respuesta de POST /api/invitation/validate: lo que muestra el formulario de alta.
 * Reemplaza las consultas públicas a /person y /division que hacía la página.
 */
public record InvitationSummaryResponse(
        String firstName,
        String lastName,
        String email,
        String clubName,
        String divisionName) {
}
