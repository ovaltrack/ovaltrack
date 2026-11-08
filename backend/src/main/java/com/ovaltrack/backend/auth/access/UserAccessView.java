package com.ovaltrack.backend.auth.access;

import com.ovaltrack.backend.club.domain.ClubStatus;
import com.ovaltrack.backend.user.domain.UserRole;

/** Proyección mínima para revisar el acceso sin cargar las entidades. */
public interface UserAccessView {
    Boolean getActive();

    UserRole getRole();

    /** Estado del club de la persona; null si no tiene club. */
    ClubStatus getClubStatus();
}
