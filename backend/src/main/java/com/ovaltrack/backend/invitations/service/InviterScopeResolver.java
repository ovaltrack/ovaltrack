package com.ovaltrack.backend.invitations.service;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

import com.ovaltrack.backend.club.business.ClubService;
import com.ovaltrack.backend.club.domain.Club;
import com.ovaltrack.backend.division.business.DivisionCoachService;
import com.ovaltrack.backend.user.business.UserService;
import com.ovaltrack.backend.user.domain.User;
import com.ovaltrack.backend.user.domain.UserRole;

import lombok.RequiredArgsConstructor;

/**
 * Resuelve el alcance de quien invita con las mismas reglas de aislamiento que las divisiones
 * (club propio; el entrenador, solo divisiones con asociación activa).
 */
@Component
@RequiredArgsConstructor
public class InviterScopeResolver {

    private final UserService userService;
    private final ClubService clubService;
    private final DivisionCoachService divisionCoachService;

    public InviterScope resolve(Authentication authentication) {
        User user = authentication == null ? null : userService.findUserByEmail(authentication.getName());
        if (user == null) {
            throw new AccessDeniedException("Iniciá sesión para gestionar invitaciones.");
        }
        if (user.getRole() != UserRole.ADMIN_CLUB && user.getRole() != UserRole.COACH_ANALYST) {
            throw new AccessDeniedException("Solo el administrador del club y los entrenadores pueden invitar jugadores.");
        }
        Club club = clubService.findClubEntityForAuthenticatedUser(authentication);
        if (club == null) {
            throw new AccessDeniedException("Tu cuenta no está asociada a un club.");
        }
        if (user.getRole() == UserRole.ADMIN_CLUB) {
            return new InviterScope(club, null);
        }
        if (user.getPerson() == null) {
            throw new AccessDeniedException("Tu cuenta de entrenador no tiene divisiones asignadas.");
        }
        return new InviterScope(club, divisionCoachService.findActiveDivisionIdsByCoach(user.getPerson().getId()));
    }
}
