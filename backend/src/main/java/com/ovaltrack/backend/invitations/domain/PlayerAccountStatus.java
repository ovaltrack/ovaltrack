package com.ovaltrack.backend.invitations.domain;

/** Situación de la cuenta de un jugador del club, vista desde las invitaciones. */
public enum PlayerAccountStatus {
    /** Ya tiene una cuenta vinculada: no hace falta invitarlo. */
    LINKED,
    /** Tiene un enlace vigente sin usar (se puede reenviar). */
    INVITED,
    /** El último enlace venció sin usarse. */
    EXPIRED,
    /** Nunca se lo invitó. */
    NOT_INVITED,
    /** No tiene correo de contacto: no se le puede enviar el enlace. */
    NO_EMAIL,
    /** Su correo de contacto ya es el correo de acceso de otra cuenta. */
    EMAIL_IN_USE;

    /** Estados desde los que se puede enviar (o reenviar) una invitación. */
    public boolean canInvite() {
        return this == NOT_INVITED || this == INVITED || this == EXPIRED;
    }
}
