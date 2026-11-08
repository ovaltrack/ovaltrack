package com.ovaltrack.backend.common.config.exceptions;

/** El club de la cuenta fue desactivado: se responde 403 en el login. */
public class ClubInactiveException extends RuntimeException {
    public ClubInactiveException(String message) {
        super(message);
    }
}
