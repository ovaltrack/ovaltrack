package com.ovaltrack.backend.common.mail.service;

import com.ovaltrack.backend.common.mail.dto.EmailDTO;
import com.ovaltrack.backend.person.domain.Person;

import jakarta.mail.MessagingException;

public interface EmailService {
    public void sendEmail(EmailDTO email) throws MessagingException;

    public void sendInvitation(Person person, String hash) throws MessagingException;

    /** Envía el enlace para restablecer la contraseña al correo de acceso. */
    public void sendPasswordReset(String to, String userName, String rawToken, String expiresIn)
            throws MessagingException;
}
