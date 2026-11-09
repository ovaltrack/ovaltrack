package com.ovaltrack.backend.invitations.domain;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/** Fila de la tabla de jugadores en Miembros: datos del jugador y estado de su cuenta. */
public record ClubPlayerResponse(
        UUID personId,
        String firstName,
        String lastName,
        String contactEmail,
        List<DivisionSummary> divisions,
        PlayerAccountStatus status,
        /** Último envío de la invitación; null si nunca se lo invitó. */
        LocalDateTime invitedAt,
        /** Vencimiento del último enlace; null si nunca se lo invitó. */
        LocalDateTime invitationExpiresAt) {

    public record DivisionSummary(UUID id, String name) {
    }
}
