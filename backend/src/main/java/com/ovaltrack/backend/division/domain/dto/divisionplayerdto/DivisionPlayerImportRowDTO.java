package com.ovaltrack.backend.division.domain.dto.divisionplayerdto;

import java.time.LocalDate;

/**
 * Una fila de la planilla del plantel. rowNumber es la fila de la planilla
 * (la 2 es la primera debajo de los encabezados) y sirve para informar el resultado.
 */
public record DivisionPlayerImportRowDTO(
        Integer rowNumber,
        String firstName,
        String lastName,
        LocalDate birthDate,
        String position,
        Integer jerseyNumber,
        String contactEmail,
        String contactPhone
) {
}
