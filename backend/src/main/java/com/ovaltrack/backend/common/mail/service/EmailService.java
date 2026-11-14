package com.ovaltrack.backend.common.mail.service;

import com.ovaltrack.backend.common.mail.dto.EmailDTO;
import com.ovaltrack.backend.person.domain.Person;

/**
 * Correos de la aplicación. Si el envío falla lanza
 * {@link com.ovaltrack.backend.common.config.exceptions.MailDeliveryException} (502).
 */
public interface EmailService {
    public void sendEmail(EmailDTO email);

    public void sendInvitation(Person person, String hash);

    /** Envía el enlace para restablecer la contraseña al correo de acceso. */
    public void sendPasswordReset(String to, String userName, String rawToken, String expiresIn);
}
