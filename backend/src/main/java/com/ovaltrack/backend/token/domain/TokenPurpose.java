package com.ovaltrack.backend.token.domain;

/**
 * Para qué se emitió un token: un enlace de un flujo no sirve en el otro.
 * Los tokens anteriores a esta columna quedan en null y se tratan como invitaciones.
 */
public enum TokenPurpose {
    INVITATION,
    PASSWORD_RESET
}
