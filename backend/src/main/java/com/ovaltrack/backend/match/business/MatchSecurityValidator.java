package com.ovaltrack.backend.match.business;

import java.util.UUID;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

import com.ovaltrack.backend.club.business.ClubService;
import com.ovaltrack.backend.club.domain.Club;
import com.ovaltrack.backend.division.repository.DivisionCoachRepository;
import com.ovaltrack.backend.match.domain.Match;
import com.ovaltrack.backend.user.business.UserService;
import com.ovaltrack.backend.user.domain.User;
import com.ovaltrack.backend.user.domain.UserRole;

import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
public class MatchSecurityValidator {

    private final UserService userService;
    private final ClubService clubService;
    private final DivisionCoachRepository divisionCoachRepository;

    private static final String MANAGE_DENIED_MESSAGE =
            "Acceso denegado: solo el entrenador asignado o el administrador del club pueden gestionar este partido";

    private static final String VIEW_DENIED_MESSAGE = "Acceso denegado: el partido no pertenece a su club";

    public void validateCanManageMatch(Match match, Authentication authentication) {
        if (match == null) {
            return;
        }

        User user = getAuthenticatedUser(authentication);
        if (user.getRole() == UserRole.ADMIN_OVALTRACK) {
            return;
        }

        validateMatchBelongsToUserClub(match, authentication, MANAGE_DENIED_MESSAGE);

        if (user.getRole() == UserRole.ADMIN_CLUB) {
            return;
        }

        if (user.getRole() == UserRole.COACH_ANALYST) {
            if (user.getPerson() != null && divisionCoachRepository.existsActiveAssociation(
                    match.getDivision().getId(), user.getPerson().getId())) {
                return;
            }
        }

        throw new AccessDeniedException(MANAGE_DENIED_MESSAGE);
    }

    /** Solo exige que el partido sea del club del usuario; no pide ser entrenador ni administrador. */
    public void validateCanViewMatch(Match match, Authentication authentication) {
        if (match == null) {
            return;
        }

        User user = getAuthenticatedUser(authentication);
        if (user.getRole() == UserRole.ADMIN_OVALTRACK) {
            return;
        }

        validateMatchBelongsToUserClub(match, authentication, VIEW_DENIED_MESSAGE);
    }

    private void validateMatchBelongsToUserClub(Match match, Authentication authentication, String deniedMessage) {
        Club userClub = clubService.findClubEntityForAuthenticatedUser(authentication);
        if (match.getDivision() == null || match.getDivision().getClub() == null) {
            throw new AccessDeniedException(deniedMessage);
        }

        UUID matchClubId = match.getDivision().getClub().getId();
        if (userClub == null || !userClub.getId().equals(matchClubId)) {
            throw new AccessDeniedException(deniedMessage);
        }
    }

    private User getAuthenticatedUser(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            throw new AccessDeniedException("No autorizado: se requiere autenticación");
        }

        String email = authentication.getName();
        User user = userService.findUserByEmail(email);
        if (user == null) {
            throw new AccessDeniedException("Acceso denegado: usuario no encontrado");
        }

        if (user.getActive() != null && !user.getActive()) {
            throw new AccessDeniedException("Acceso denegado: usuario inactivo");
        }

        return user;
    }
}
