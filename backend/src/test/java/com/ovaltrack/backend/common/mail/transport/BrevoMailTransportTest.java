package com.ovaltrack.backend.common.mail.transport;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withBadRequest;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withException;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;

import java.net.SocketTimeoutException;
import java.time.Duration;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import com.ovaltrack.backend.common.config.exceptions.MailDeliveryException;
import com.ovaltrack.backend.common.mail.config.MailProperties;
import com.ovaltrack.backend.common.mail.dto.OutgoingMail;

class BrevoMailTransportTest {

    private static final String BASE_URL = "https://api.brevo.test/v3";
    private static final String SEND_URL = BASE_URL + "/smtp/email";

    private MockRestServiceServer server;
    private BrevoMailTransport transport;

    @BeforeEach
    void setUp() {
        RestClient.Builder builder = RestClient.builder().baseUrl(BASE_URL);
        server = MockRestServiceServer.bindTo(builder).build();
        MailProperties props = new MailProperties("brevo", "no-reply@ovaltrack.test", "OvalTrack",
                Duration.ofSeconds(5), Duration.ofSeconds(10),
                new MailProperties.Brevo("test-key", BASE_URL));
        transport = new BrevoMailTransport(builder.build(), props);
    }

    @Test
    @DisplayName("envía remitente, destinatario, asunto y HTML con la API key en el header")
    void sendsExpectedRequest() {
        server.expect(requestTo(SEND_URL))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header("api-key", "test-key"))
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(content().json("""
                        {
                          "sender": {"email": "no-reply@ovaltrack.test", "name": "OvalTrack"},
                          "to": [{"email": "ana@club.test", "name": "Ana Pérez"}],
                          "subject": "Unite a Ovaltrack!",
                          "htmlContent": "<p>Hola</p>"
                        }
                        """, true))
                .andRespond(withStatus(HttpStatus.CREATED)
                        .contentType(MediaType.APPLICATION_JSON)
                        .body("{\"messageId\":\"<abc@brevo>\"}"));

        assertDoesNotThrow(() -> transport.send(
                new OutgoingMail("ana@club.test", "Ana Pérez", "Unite a Ovaltrack!", "<p>Hola</p>")));
        server.verify();
    }

    @Test
    @DisplayName("sin nombre de destinatario no manda el campo name")
    void omitsNullRecipientName() {
        server.expect(requestTo(SEND_URL))
                .andExpect(content().json("""
                        {
                          "sender": {"email": "no-reply@ovaltrack.test", "name": "OvalTrack"},
                          "to": [{"email": "ana@club.test"}],
                          "subject": "Asunto",
                          "htmlContent": "<p>x</p>"
                        }
                        """, true))
                .andRespond(withStatus(HttpStatus.CREATED));

        transport.send(new OutgoingMail("ana@club.test", null, "Asunto", "<p>x</p>"));
        server.verify();
    }

    @Test
    @DisplayName("un 4xx de Brevo termina en MailDeliveryException con el status")
    void throwsMailDeliveryOn4xx() {
        server.expect(requestTo(SEND_URL))
                .andRespond(withBadRequest()
                        .contentType(MediaType.APPLICATION_JSON)
                        .body("{\"code\":\"invalid_parameter\",\"message\":\"sender not valid\"}"));

        MailDeliveryException error = assertThrows(MailDeliveryException.class, () -> transport.send(
                new OutgoingMail("ana@club.test", "Ana", "Asunto", "<p>x</p>")));
        assertTrue(error.getMessage().contains("400"));
    }

    @Test
    @DisplayName("un timeout o error de red termina en MailDeliveryException")
    void throwsMailDeliveryOnNetworkError() {
        server.expect(requestTo(SEND_URL))
                .andRespond(withException(new SocketTimeoutException("read timed out")));

        assertThrows(MailDeliveryException.class, () -> transport.send(
                new OutgoingMail("ana@club.test", "Ana", "Asunto", "<p>x</p>")));
    }
}
