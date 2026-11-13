package com.ovaltrack.backend.person.business;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

import com.ovaltrack.backend.club.business.ClubService;
import com.ovaltrack.backend.club.domain.Club;
import com.ovaltrack.backend.division.repository.DivisionCoachRepository;
import com.ovaltrack.backend.division.repository.DivisionPlayerRepository;
import com.ovaltrack.backend.person.domain.Person;
import com.ovaltrack.backend.user.business.UserService;
import com.ovaltrack.backend.user.domain.User;
import com.ovaltrack.backend.user.domain.UserRole;

import lombok.RequiredArgsConstructor;

/**
 * Quién puede editar los datos de una persona:
 * <ul>
 *   <li>ADMIN_OVALTRACK: cualquiera.</li>
 *   <li>ADMIN_CLUB: cualquier persona de su club (jugadores, entrenadores y administradores).</li>
 *   <li>COACH_ANALYST: solo jugadores (cuenta PLAYER o persona sin cuenta) de las divisiones que entrena.</li>
 *   <li>El resto de los roles: nadie.</li>
 * </ul>
 * La pertenencia al club se toma de {@code Person.club}, igual que en las invitaciones.
 */
@Component
@RequiredArgsConstructor
public class PersonSecurityValidator {

    private final UserService userService;
    private final ClubService clubService;
    private final DivisionPlayerRepository divisionPlayerRepository;
    private final DivisionCoachRepository divisionCoachRepository;

    public void validateCanEditPerson(Person target, Authentication authentication) {
        User user = getAuthenticatedUser(authentication);
        if (user.getRole() == UserRole.ADMIN_OVALTRACK) {
            return;
        }

        if (user.getRole() != UserRole.ADMIN_CLUB && user.getRole() != UserRole.COACH_ANALYST) {
            throw new AccessDeniedException(
                    "Acceso denegado: solo el administrador del club o un entrenador pueden editar datos de personas");
        }

        Club userClub = clubService.findClubEntityForAuthenticatedUser(authentication);
        if (userClub == null || target.getClub() == null || !userClub.getId().equals(target.getClub().getId())) {
            throw new AccessDeniedException("Acceso denegado: la persona no pertenece a su club");
        }

        if (user.getRole() == UserRole.ADMIN_CLUB) {
            return;
        }

        User targetUser = userService.findUserByPersonId(target.getId());
        if (targetUser != null && targetUser.getRole() != UserRole.PLAYER) {
            throw new AccessDeniedException("Acceso denegado: un entrenador solo puede editar los datos de jugadores");
        }

        boolean coachesTarget = user.getPerson() != null
                && divisionPlayerRepository.findActiveByPersonId(target.getId()).stream()
                        .anyMatch(divisionPlayer -> divisionCoachRepository.existsActiveAssociation(
                                divisionPlayer.getDivision().getId(), user.getPerson().getId()));
        if (!coachesTarget) {
            throw new AccessDeniedException("Acceso denegado: el jugador no pertenece a una división que usted entrena");
        }
    }

    /** Mismo criterio que {@code DivisionSecurityValidator}: usuario autenticado, existente y activo. */
    private User getAuthenticatedUser(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            throw new AccessDeniedException("No autorizado: se requiere autenticación");
        }

        User user = userService.findUserByEmail(authentication.getName());
        if (user == null) {
            throw new AccessDeniedException("Acceso denegado: usuario no encontrado");
        }

        if (user.getActive() != null && !user.getActive()) {
            throw new AccessDeniedException("Acceso denegado: usuario inactivo");
        }

        return user;
    }
}
