package com.ovaltrack.backend.auth.access;

import java.util.UUID;

import org.springframework.stereotype.Service;

import com.ovaltrack.backend.club.domain.ClubStatus;
import com.ovaltrack.backend.user.domain.UserRole;
import com.ovaltrack.backend.user.repository.UserRepository;

import lombok.RequiredArgsConstructor;

/**
 * Regla única de acceso: la cuenta debe estar activa y, si pertenece a un club,
 * el club no puede estar desactivado (REJECTED). Un club PENDING no bloquea.
 * La usan el login y el filtro JWT (una consulta liviana por request).
 */
@Service
@RequiredArgsConstructor
public class AccountAccessService {

    public static final String ACCOUNT_INACTIVE_MESSAGE = "Tu cuenta no está activa.";
    /**
     * Atributo del request con el motivo del bloqueo. El filtro JWT lo deja y sigue como anónimo:
     * las rutas públicas funcionan igual y el entry point lo usa como mensaje del 401 en las privadas.
     */
    public static final String DENIED_MESSAGE_ATTRIBUTE = "ovaltrack.accessDeniedMessage";
    public static final String CLUB_INACTIVE_MESSAGE = "Tu club no está activo. Contactá al administrador de la plataforma.";
    public static final String SESSION_EXPIRED_MESSAGE = "Tu sesión ya no es válida. Iniciá sesión de nuevo.";

    private final UserRepository userRepository;

    public AccessStatus check(UUID userId) {
        return decide(userId).status();
    }

    /**
     * Estado de acceso y rol actual de la cuenta. El filtro JWT usa este rol en vez del
     * del token, así un cambio de rol (p. ej. cambio de administrador) rige en el próximo request.
     */
    public AccessDecision decide(UUID userId) {
        return decide(userId, null);
    }

    /**
     * Igual que {@link #decide(UUID)}, y además exige que el token se haya emitido para el correo
     * de acceso actual: si la cuenta cambió su correo, los tokens anteriores dejan de servir.
     */
    public AccessDecision decide(UUID userId, String tokenEmail) {
        if (userId == null) {
            return new AccessDecision(AccessStatus.ACCOUNT_INACTIVE, null);
        }
        return userRepository.findAccessById(userId)
                .map(view -> new AccessDecision(evaluate(view, tokenEmail), view.getRole()))
                .orElse(new AccessDecision(AccessStatus.ACCOUNT_INACTIVE, null));
    }

    private static AccessStatus evaluate(UserAccessView view, String tokenEmail) {
        if (Boolean.FALSE.equals(view.getActive())) {
            return AccessStatus.ACCOUNT_INACTIVE;
        }
        if (tokenEmail != null && !tokenEmail.equalsIgnoreCase(view.getLoginEmail())) {
            return AccessStatus.SESSION_EXPIRED;
        }
        if (view.getRole() == UserRole.ADMIN_OVALTRACK) {
            return AccessStatus.ALLOWED;
        }
        return view.getClubStatus() == ClubStatus.REJECTED ? AccessStatus.CLUB_INACTIVE : AccessStatus.ALLOWED;
    }

    public static String messageFor(AccessStatus status) {
        return switch (status) {
            case CLUB_INACTIVE -> CLUB_INACTIVE_MESSAGE;
            case SESSION_EXPIRED -> SESSION_EXPIRED_MESSAGE;
            default -> ACCOUNT_INACTIVE_MESSAGE;
        };
    }
}
