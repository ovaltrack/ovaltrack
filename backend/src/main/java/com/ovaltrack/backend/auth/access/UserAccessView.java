package com.ovaltrack.backend.auth.access;

import java.time.LocalDateTime;

import com.ovaltrack.backend.club.domain.ClubStatus;
import com.ovaltrack.backend.user.domain.UserRole;

/** Proyección mínima para revisar el acceso sin cargar las entidades. */
public interface UserAccessView {
    Boolean getActive();

    /** Correo de acceso actual: el token debe haberse emitido para este correo. */
    String getLoginEmail();

    UserRole getRole();

    /** Último cambio de contraseña; los tokens emitidos antes ya no sirven. */
    LocalDateTime getPasswordChangedAt();

    /** Estado del club de la persona; null si no tiene club. */
    ClubStatus getClubStatus();
}
