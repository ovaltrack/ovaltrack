package com.ovaltrack.backend.division.business;

import java.util.UUID;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

import com.ovaltrack.backend.club.business.ClubService;
import com.ovaltrack.backend.club.domain.Club;
import com.ovaltrack.backend.division.domain.Division;
import com.ovaltrack.backend.division.repository.DivisionCoachRepository;
import com.ovaltrack.backend.user.business.UserService;
import com.ovaltrack.backend.user.domain.User;
import com.ovaltrack.backend.user.domain.UserRole;

import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
public class DivisionSecurityValidator {

    private final UserService userService;
    private final ClubService clubService;
    private final DivisionCoachRepository divisionCoachRepository;

    public void validateCanCreateDivision(UUID targetClubId, Authentication authentication) {
        User user = getAuthenticatedUser(authentication);
        if (user.getRole() == UserRole.ADMIN_OVALTRACK) {
            return;
        }

        if (user.getRole() != UserRole.ADMIN_CLUB) {
            throw new AccessDeniedException("Acceso denegado: solo el administrador del club puede crear divisiones");
        }

        Club userClub = clubService.findClubEntityForUser(user);
        if (userClub == null || (targetClubId != null && !userClub.getId().equals(targetClubId))) {
            throw new AccessDeniedException("Acceso denegado: no puede crear divisiones en otro club");
        }
    }

    public void validateCanAccessClubDivisions(UUID clubId, Authentication authentication) {
        User user = getAuthenticatedUser(authentication);
        if (user.getRole() == UserRole.ADMIN_OVALTRACK) {
            return;
        }

        if (user.getRole() == UserRole.PLAYER || user.getRole() == UserRole.NO_ROLE) {
            throw new AccessDeniedException("Acceso denegado: rol no autorizado");
        }

        Club userClub = clubService.findClubEntityForUser(user);
        if (userClub == null || (clubId != null && !userClub.getId().equals(clubId))) {
            throw new AccessDeniedException("Acceso denegado: no pertenece al club solicitado");
        }
    }

    public void validateCanAccessDivision(Division division, Authentication authentication) {
        if (division == null) {
            return;
        }

        User user = getAuthenticatedUser(authentication);
        if (user.getRole() == UserRole.ADMIN_OVALTRACK) {
            return;
        }

        if (user.getRole() == UserRole.PLAYER || user.getRole() == UserRole.NO_ROLE) {
            throw new AccessDeniedException("Acceso denegado: rol no autorizado");
        }

        Club userClub = clubService.findClubEntityForUser(user);
        if (userClub == null || division.getClub() == null || !userClub.getId().equals(division.getClub().getId())) {
            throw new AccessDeniedException("Acceso denegado: la división no pertenece a su club");
        }

        if (user.getRole() == UserRole.COACH_ANALYST) {
            if (user.getPerson() == null
                    || !divisionCoachRepository.existsActiveAssociation(division.getId(), user.getPerson().getId())) {
                throw new AccessDeniedException("Acceso denegado: no es entrenador asignado a esta división");
            }
        }
    }

    public void validateCanManageDivision(Division division, Authentication authentication) {
        if (division == null) {
            return;
        }

        User user = getAuthenticatedUser(authentication);
        if (user.getRole() == UserRole.ADMIN_OVALTRACK) {
            return;
        }

        if (user.getRole() != UserRole.ADMIN_CLUB) {
            throw new AccessDeniedException(
                    "Acceso denegado: solo el administrador de club puede modificar o eliminar divisiones");
        }

        Club userClub = clubService.findClubEntityForUser(user);
        if (userClub == null || division.getClub() == null || !userClub.getId().equals(division.getClub().getId())) {
            throw new AccessDeniedException("Acceso denegado: la división no pertenece a su club");
        }
    }

    public void validateCanManageDivisionPlayers(Division division, Authentication authentication) {
        if (division == null) {
            return;
        }

        User user = getAuthenticatedUser(authentication);
        if (user.getRole() == UserRole.ADMIN_OVALTRACK) {
            return;
        }

        if (user.getRole() == UserRole.ADMIN_CLUB) {
            Club userClub = clubService.findClubEntityForUser(user);
            if (userClub == null || division.getClub() == null
                    || !userClub.getId().equals(division.getClub().getId())) {
                throw new AccessDeniedException("Acceso denegado: la división no pertenece a su club");
            }
            return;
        }

        if (user.getRole() == UserRole.COACH_ANALYST) {
            Club userClub = clubService.findClubEntityForUser(user);
            if (userClub == null || division.getClub() == null
                    || !userClub.getId().equals(division.getClub().getId())) {
                throw new AccessDeniedException("Acceso denegado: la división no pertenece a su club");
            }
            if (user.getPerson() == null
                    || !divisionCoachRepository.existsActiveAssociation(division.getId(), user.getPerson().getId())) {
                throw new AccessDeniedException(
                        "Acceso denegado: solo un entrenador asignado a esta división puede realizar esta acción");
            }
            return;
        }

        throw new AccessDeniedException(
                "Acceso denegado: solo el administrador del club o el entrenador de la división pueden realizar esta acción");
    }

    public void validateCanManageDivisionCoaches(Division division, Authentication authentication) {
        if (division == null) {
            return;
        }

        User user = getAuthenticatedUser(authentication);
        if (user.getRole() == UserRole.ADMIN_OVALTRACK) {
            return;
        }

        if (user.getRole() != UserRole.ADMIN_CLUB) {
            throw new AccessDeniedException(
                    "Acceso denegado: solo el administrador del club puede gestionar entrenadores de división");
        }

        Club userClub = clubService.findClubEntityForUser(user);
        if (userClub == null || division.getClub() == null || !userClub.getId().equals(division.getClub().getId())) {
            throw new AccessDeniedException("Acceso denegado: la división no pertenece a su club");
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
