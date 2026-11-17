package com.ovaltrack.backend.division.domain.dto;

import java.time.LocalDate;
import java.util.UUID;

public record DivisionHistoryPersonDTO(
        UUID personId,
        String firstName,
        String lastName,
        String contactEmail,
        boolean active,
        LocalDate firstStartDate,
        LocalDate lastEndDate) {
}
