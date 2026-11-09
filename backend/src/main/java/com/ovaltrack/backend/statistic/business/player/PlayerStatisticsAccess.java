package com.ovaltrack.backend.statistic.business.player;

import com.ovaltrack.backend.division.business.DivisionSecurityValidator;
import com.ovaltrack.backend.division.domain.Division;
import com.ovaltrack.backend.user.business.UserService;
import com.ovaltrack.backend.user.domain.User;
import com.ovaltrack.backend.user.domain.UserRole;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

/**
 * Quién puede ver las estadísticas de un jugador: el propio jugador, o el staff que ya puede acceder a la división
 * (se delega en {@link DivisionSecurityValidator}, sin cambiar sus reglas).
 */
@Component
@RequiredArgsConstructor
public class PlayerStatisticsAccess {

    private final UserService userService;
    private final DivisionSecurityValidator divisionSecurityValidator;

    /** Usuario autenticado que consulta las estadísticas de `personId`; un jugador solo puede ver las suyas. */
    public Viewer viewerOf(UUID personId, Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            throw new AccessDeniedException("No autorizado: se requiere autenticación");
        }
        User user = userService.findUserByEmail(authentication.getName());
        if (user == null || Boolean.FALSE.equals(user.getActive())) {
            throw new AccessDeniedException("Acceso denegado: usuario no encontrado o inactivo");
        }
        boolean self = user.getPerson() != null && personId.equals(user.getPerson().getId());
        if (user.getRole() == UserRole.NO_ROLE || (user.getRole() == UserRole.PLAYER && !self)) {
            throw new AccessDeniedException("Acceso denegado: solo podés ver tus propias estadísticas");
        }
        return new Viewer(user.getRole() == UserRole.PLAYER, authentication);
    }

    /** Divisiones (de las del jugador) que este usuario puede ver. */
    public List<Division> accessible(Viewer viewer, Collection<Division> divisions) {
        return divisions.stream().filter(division -> canAccess(viewer, division)).toList();
    }

    public void validate(Viewer viewer, Division division) {
        if (!viewer.self()) {
            divisionSecurityValidator.validateCanAccessDivision(division, viewer.authentication());
        }
    }

    private boolean canAccess(Viewer viewer, Division division) {
        try {
            validate(viewer, division);
            return true;
        } catch (AccessDeniedException e) {
            return false;
        }
    }

    /** `self`: el jugador consulta sus propias estadísticas (no aplica la validación de staff). */
    public record Viewer(boolean self, Authentication authentication) {
    }
}
