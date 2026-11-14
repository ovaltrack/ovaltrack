package com.ovaltrack.backend.common.mail.transport;

import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.ovaltrack.backend.common.config.exceptions.MailDeliveryException;
import com.ovaltrack.backend.common.mail.config.MailProperties;
import com.ovaltrack.backend.common.mail.dto.OutgoingMail;

/**
 * Envío por la API HTTP de Brevo (HTTPS, puerto 443): sirve donde el SMTP saliente está bloqueado.
 * Nunca loguea la API key ni el contenido del correo.
 */
@Component
@ConditionalOnProperty(prefix = "ovaltrack.mail", name = "provider", havingValue = "brevo", matchIfMissing = true)
public class BrevoMailTransport implements MailTransport {

    static final String SEND_PATH = "/smtp/email";
    static final String API_KEY_HEADER = "api-key";

    private static final Logger logger = LoggerFactory.getLogger(BrevoMailTransport.class);

    private final RestClient brevoRestClient;
    private final MailProperties props;

    public BrevoMailTransport(RestClient brevoRestClient, MailProperties props) {
        this.brevoRestClient = brevoRestClient;
        this.props = props;
    }

    @Override
    public void send(OutgoingMail mail) {
        try {
            brevoRestClient.post()
                    .uri(SEND_PATH)
                    .header(API_KEY_HEADER, props.brevo().apiKey())
                    .contentType(MediaType.APPLICATION_JSON)
                    .accept(MediaType.APPLICATION_JSON)
                    .body(toRequest(mail))
                    .retrieve()
                    .toBodilessEntity();
        } catch (RestClientResponseException e) {
            logger.error("Brevo rechazó el envío: HTTP {} {}", e.getStatusCode().value(), e.getResponseBodyAsString());
            throw new MailDeliveryException("El proveedor de correo rechazó el envío (HTTP " + e.getStatusCode().value() + ")", e);
        } catch (RestClientException e) {
            logger.error("No se pudo contactar a Brevo: {}", e.getMessage());
            throw new MailDeliveryException("No se pudo contactar al proveedor de correo", e);
        }
    }

    BrevoSendRequest toRequest(OutgoingMail mail) {
        return new BrevoSendRequest(
                new Contact(props.fromAddress(), props.fromName()),
                List.of(new Contact(mail.to(), mail.toName())),
                mail.subject(),
                mail.html());
    }

    /** Cuerpo de {@code POST /smtp/email}. */
    record BrevoSendRequest(Contact sender, List<Contact> to, String subject, String htmlContent) {
    }

    /** Remitente o destinatario; el nombre es opcional y no se envía si es nulo. */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    record Contact(String email, String name) {
    }
}
