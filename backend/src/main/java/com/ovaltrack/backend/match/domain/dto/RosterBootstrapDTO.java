package com.ovaltrack.backend.match.domain.dto;

import java.util.List;

public record RosterBootstrapDTO(
    MatchResponseDTO match,
    List<AvailablePlayerDTO> players,
    List<MatchRosterPlayerDTO> roster
) {
}
