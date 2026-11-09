package com.ovaltrack.backend.invitations.domain;

import java.util.UUID;

import jakarta.validation.constraints.NotNull;

/** Body de POST /api/invitation. La división se elige sola: la activa del jugador. */
public record InvitePlayerRequest(
        @NotNull(message = "Indicá a qué jugador querés invitar.")
        UUID personId) {
}
