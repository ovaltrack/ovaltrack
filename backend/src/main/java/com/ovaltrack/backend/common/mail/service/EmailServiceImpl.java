package com.ovaltrack.backend.common.mail.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailAuthenticationException;
import org.springframework.mail.MailException;
import org.springframework.mail.MailSendException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;

import com.ovaltrack.backend.common.config.exceptions.BusinessException;
import com.ovaltrack.backend.common.mail.dto.EmailDTO;
import com.ovaltrack.backend.person.domain.Person;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;

@Service
public class EmailServiceImpl implements EmailService {

    private final JavaMailSender javaMailSender;
    private final TemplateEngine templateEngine;
    @Value("${invitation.url}")
    private String url;
    @Value("${password-reset.url}")
    private String passwordResetUrl;

    public EmailServiceImpl(final JavaMailSender javaMailSender, final TemplateEngine templateEngine) {
        this.javaMailSender = javaMailSender;
        this.templateEngine = templateEngine;
    }

    @Override
    public void sendEmail(EmailDTO email) throws MessagingException {
        try {
            MimeMessage message = javaMailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF8");
            helper.setTo(email.getTo());
            helper.setSubject(email.getSubject());
            // helper.setText(email.getContent());
            Context context = new Context();
            context.setVariable("message", email.getContent());

            String contentHTML = templateEngine.process("email", context);

            helper.setText(contentHTML, true);
            javaMailSender.send(message);

        } catch (MailAuthenticationException e) {
            throw new BusinessException(
                    "Error de Autentificacion, credenciales del email.properties invalidas: " + e.getMessage());
        } catch (MailSendException e) {
            throw new BusinessException("Error al enviar el email: " + e.getMessage());
        } catch (MailException e) {
            throw new BusinessException("Error al enviar el correo: " + e.getMessage());
        }
    }

    @Override
    public void sendInvitation(Person person, String token) throws MessagingException {
        try {
            if (token == null)
                throw new BusinessException("El token vino nulo");
            if (person == null ||
                    person.getContactEmail() == null)
                throw new BusinessException("La persona vino nula");

            MimeMessage message = javaMailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF8");
            helper.setTo(person.getContactEmail());
            helper.setSubject("Unite a Ovaltrack!");
            Context context = setVariables(person, token);

            String contentHTML = templateEngine.process("email", context);

            helper.setText(contentHTML, true);
            javaMailSender.send(message);

        } catch (MailAuthenticationException e) {
            throw new BusinessException(
                    "Error de Autentificacion, credenciales del email.properties invalidas: " + e.getMessage());
        } catch (MailSendException e) {
            throw new BusinessException("Error al enviar el email: " + e.getMessage());
        } catch (MailException e) {
            throw new BusinessException("Error al enviar el correo: " + e.getMessage());
        } catch (Exception e) {
            throw new BusinessException("Error al enviar el correo" + e.getMessage());
        }
    }

    @Override
    public void sendPasswordReset(String to, String userName, String rawToken, String expiresIn)
            throws MessagingException {
        if (to == null || to.isBlank())
            throw new BusinessException("El destinatario vino vacío");
        if (rawToken == null || rawToken.isBlank())
            throw new BusinessException("El token vino vacío");
        try {
            MimeMessage message = javaMailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF8");
            helper.setTo(to);
            helper.setSubject("Restablecé tu contraseña de OvalTrack");

            Context context = new Context();
            context.setVariable("userName", userName);
            context.setVariable("userEmail", to);
            context.setVariable("expiresIn", expiresIn);
            context.setVariable("urlReset", String.format("%s?token=%s", this.passwordResetUrl, rawToken));

            helper.setText(templateEngine.process("password-reset", context), true);
            javaMailSender.send(message);
        } catch (MailException e) {
            throw new BusinessException("Error al enviar el correo: " + e.getMessage());
        }
    }

    private Context setVariables(Person person, String token) {
        if (person == null)
            throw new IllegalArgumentException("Persona vino nula");
        if (token == null || token.isBlank())
            throw new IllegalArgumentException("El token vino nula o vacia");
        
        String userName = person.getFirstName() + " " + person.getLastName();
        Context context = new Context();
        context.setVariable("userName", userName);
        context.setVariable("clubName", person.getClub().getName());
        context.setVariable("userEmail", person.getContactEmail());
        context.setVariable("urlInvitation", getUrlInvitationWithToken(token));
        return context;
    }

    private String getUrlInvitationWithToken(String token) {
        return String.format("%s?%s=%s", this.url, "token", token);
    }

}
