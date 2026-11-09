package com.ovaltrack.backend.common.config.exceptions;

/** No se pudo entregar un correo al servidor de mail. Se responde 502 con un mensaje para el usuario. */
public class MailDeliveryException extends RuntimeException {

    public MailDeliveryException(String message, Throwable cause) {
        super(message, cause);
    }
}
