package com.ovaltrack.backend.match.domain.dto;

import java.time.LocalDateTime;
import java.util.UUID;

import com.ovaltrack.backend.match.domain.MatchPlayerRole;

public record PlayerMatchResponseDTO(
    UUID matchId,
    LocalDateTime date,
    String opponentName,
    String divisionName,
    Integer homeScore,
    Integer awayScore,
    MatchPlayerRole role,
    /** Número de slot en la planilla (titulares 1-15, suplentes 16-23). Null en planteles sin orden. */
    Integer slotNumber,
    /** Cuándo terminó el partido (UTC, sin zona); null si no se registró. Define cuál fue el último jugado. */
    LocalDateTime finishedAt
) {
}
