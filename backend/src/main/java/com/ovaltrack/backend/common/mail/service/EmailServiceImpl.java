package com.ovaltrack.backend.common.mail.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;

import com.ovaltrack.backend.common.config.exceptions.BusinessException;
import com.ovaltrack.backend.common.mail.dto.EmailDTO;
import com.ovaltrack.backend.common.mail.dto.OutgoingMail;
import com.ovaltrack.backend.common.mail.transport.MailTransport;
import com.ovaltrack.backend.person.domain.Person;

import jakarta.mail.MessagingException;
import lombok.RequiredArgsConstructor;

/**
 * Arma el contenido de cada correo con Thymeleaf y delega el envío en el {@link MailTransport} activo.
 * Si el envío falla, deja pasar la {@link com.ovaltrack.backend.common.config.exceptions.MailDeliveryException}.
 */
@Service
@RequiredArgsConstructor
public class EmailServiceImpl implements EmailService {

    private final MailTransport transport;
    private final TemplateEngine templateEngine;

    @Value("${invitation.url}")
    private String url;
    @Value("${password-reset.url}")
    private String passwordResetUrl;

    @Override
    public void sendEmail(EmailDTO email) throws MessagingException {
        Context context = new Context();
        context.setVariable("message", email.getContent());
        transport.send(new OutgoingMail(email.getTo(), null, email.getSubject(), render("email", context)));
    }

    @Override
    public void sendInvitation(Person person, String token) throws MessagingException {
        if (token == null)
            throw new BusinessException("El token vino nulo");
        if (person == null || person.getContactEmail() == null)
            throw new BusinessException("La persona vino nula");

        transport.send(new OutgoingMail(
                person.getContactEmail(),
                fullName(person),
                "Unite a Ovaltrack!",
                render("email", setVariables(person, token))));
    }

    @Override
    public void sendPasswordReset(String to, String userName, String rawToken, String expiresIn)
            throws MessagingException {
        if (to == null || to.isBlank())
            throw new BusinessException("El destinatario vino vacío");
        if (rawToken == null || rawToken.isBlank())
            throw new BusinessException("El token vino vacío");

        Context context = new Context();
        context.setVariable("userName", userName);
        context.setVariable("userEmail", to);
        context.setVariable("expiresIn", expiresIn);
        context.setVariable("urlReset", String.format("%s?token=%s", this.passwordResetUrl, rawToken));

        transport.send(new OutgoingMail(
                to,
                userName,
                "Restablecé tu contraseña de OvalTrack",
                render("password-reset", context)));
    }

    private Context setVariables(Person person, String token) {
        if (token.isBlank())
            throw new IllegalArgumentException("El token vino nula o vacia");

        Context context = new Context();
        context.setVariable("userName", fullName(person));
        context.setVariable("clubName", person.getClub().getName());
        context.setVariable("userEmail", person.getContactEmail());
        context.setVariable("urlInvitation", getUrlInvitationWithToken(token));
        return context;
    }

    private String fullName(Person person) {
        return person.getFirstName() + " " + person.getLastName();
    }

    private String getUrlInvitationWithToken(String token) {
        return String.format("%s?%s=%s", this.url, "token", token);
    }

    private String render(String template, Context context) {
        return templateEngine.process(template, context);
    }
}
