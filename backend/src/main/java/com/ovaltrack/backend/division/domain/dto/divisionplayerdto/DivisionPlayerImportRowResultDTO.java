package com.ovaltrack.backend.division.domain.dto.divisionplayerdto;

import java.util.UUID;

/** Resultado de una fila: field es la columna con el problema (null si no aplica). */
public record DivisionPlayerImportRowResultDTO(
        Integer rowNumber,
        DivisionPlayerImportStatus status,
        String field,
        String message,
        UUID personId
) {
}
