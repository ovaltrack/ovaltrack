package com.ovaltrack.backend.common.mail.transport;

import java.io.UnsupportedEncodingException;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Component;

import com.ovaltrack.backend.common.config.exceptions.MailDeliveryException;
import com.ovaltrack.backend.common.mail.config.MailProperties;
import com.ovaltrack.backend.common.mail.dto.OutgoingMail;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;

/** Envío por SMTP (desarrollo). Si no hay remitente configurado, usa la cuenta autenticada. */
@Component
@ConditionalOnProperty(prefix = "ovaltrack.mail", name = "provider", havingValue = "smtp", matchIfMissing = true)
@RequiredArgsConstructor
public class SmtpMailTransport implements MailTransport {

    private static final Logger logger = LoggerFactory.getLogger(SmtpMailTransport.class);

    private final JavaMailSender javaMailSender;
    private final MailProperties props;

    @Override
    public void send(OutgoingMail mail) {
        try {
            MimeMessage message = javaMailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF8");
            helper.setTo(mail.to());
            helper.setSubject(mail.subject());
            helper.setText(mail.html(), true);
            if (props.fromAddress() != null && !props.fromAddress().isBlank()) {
                helper.setFrom(props.fromAddress(), props.fromName());
            }
            javaMailSender.send(message);
        } catch (MessagingException | UnsupportedEncodingException | MailException e) {
            logger.error("Falló el envío por SMTP: {}", e.getMessage());
            throw new MailDeliveryException("No se pudo enviar el correo", e);
        }
    }
}
