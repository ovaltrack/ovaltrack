package com.ovaltrack.backend.auth.access;

/** Resultado de revisar si una cuenta puede usar la plataforma en este momento. */
public enum AccessStatus {
    ALLOWED,
    /** La cuenta no existe o está inactiva. */
    ACCOUNT_INACTIVE,
    /** La cuenta está activa pero su club fue desactivado (REJECTED). */
    CLUB_INACTIVE,
    /** El token se emitió para un correo de acceso que la cuenta ya no tiene (cambió el correo). */
    SESSION_EXPIRED
}
