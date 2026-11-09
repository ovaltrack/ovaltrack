package com.ovaltrack.backend.invitations.service;

import java.util.Set;
import java.util.UUID;

import com.ovaltrack.backend.club.domain.Club;
import com.ovaltrack.backend.division.domain.Division;

/**
 * Qué jugadores puede ver e invitar quien está autenticado: el admin, todo su club;
 * el entrenador, solo las divisiones que entrena.
 *
 * @param divisionIds divisiones permitidas; null = todas las del club
 */
public record InviterScope(Club club, Set<UUID> divisionIds) {

    public boolean covers(Division division) {
        if (division == null || division.getClub() == null || !club.getId().equals(division.getClub().getId())) {
            return false;
        }
        return divisionIds == null || divisionIds.contains(division.getId());
    }

    public boolean coversWholeClub() {
        return divisionIds == null;
    }
}
