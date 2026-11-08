package com.ovaltrack.backend.auth.access;

import com.ovaltrack.backend.user.domain.UserRole;

/** Resultado del control de acceso más el rol vigente en la BD (null si no hay cuenta). */
public record AccessDecision(AccessStatus status, UserRole role) {
    public boolean allowed() {
        return status == AccessStatus.ALLOWED;
    }
}
