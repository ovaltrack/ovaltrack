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
    public static final String CLUB_INACTIVE_MESSAGE = "Tu club no está activo. Contactá al administrador de la plataforma.";

    private final UserRepository userRepository;

    public AccessStatus check(UUID userId) {
        if (userId == null) {
            return AccessStatus.ACCOUNT_INACTIVE;
        }
        return userRepository.findAccessById(userId)
                .map(AccountAccessService::evaluate)
                .orElse(AccessStatus.ACCOUNT_INACTIVE);
    }

    private static AccessStatus evaluate(UserAccessView view) {
        if (Boolean.FALSE.equals(view.getActive())) {
            return AccessStatus.ACCOUNT_INACTIVE;
        }
        if (view.getRole() == UserRole.ADMIN_OVALTRACK) {
            return AccessStatus.ALLOWED;
        }
        return view.getClubStatus() == ClubStatus.REJECTED ? AccessStatus.CLUB_INACTIVE : AccessStatus.ALLOWED;
    }

    public static String messageFor(AccessStatus status) {
        return status == AccessStatus.CLUB_INACTIVE ? CLUB_INACTIVE_MESSAGE : ACCOUNT_INACTIVE_MESSAGE;
    }
}
