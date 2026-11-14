package com.ovaltrack.backend.common.mail.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;

import com.ovaltrack.backend.club.domain.Club;
import com.ovaltrack.backend.common.config.exceptions.BusinessException;
import com.ovaltrack.backend.common.config.exceptions.MailDeliveryException;
import com.ovaltrack.backend.common.mail.dto.OutgoingMail;
import com.ovaltrack.backend.common.mail.transport.MailTransport;
import com.ovaltrack.backend.person.domain.Person;

@ExtendWith(MockitoExtension.class)
class EmailServiceImplTest {

    @Mock private MailTransport transport;
    @Mock private TemplateEngine templateEngine;

    private EmailServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new EmailServiceImpl(transport, templateEngine);
        ReflectionTestUtils.setField(service, "url", "https://app.test/invitation");
        ReflectionTestUtils.setField(service, "passwordResetUrl", "https://app.test/auth/reset-password");
    }

    private Person person() {
        return Person.builder()
                .firstName("Ana")
                .lastName("Pérez")
                .contactEmail("ana@club.test")
                .club(Club.builder().name("Club Test").build())
                .build();
    }

    @Test
    @DisplayName("la invitación arma el correo con el enlace y el token")
    void invitationBuildsLinkWithToken() throws Exception {
        ArgumentCaptor<Context> context = ArgumentCaptor.forClass(Context.class);
        when(templateEngine.process(eq("email"), context.capture())).thenReturn("<html>inv</html>");

        service.sendInvitation(person(), "abc123");

        ArgumentCaptor<OutgoingMail> mail = ArgumentCaptor.forClass(OutgoingMail.class);
        verify(transport).send(mail.capture());
        assertEquals(new OutgoingMail("ana@club.test", "Ana Pérez", "Unite a Ovaltrack!", "<html>inv</html>"),
                mail.getValue());
        assertEquals("https://app.test/invitation?token=abc123", context.getValue().getVariable("urlInvitation"));
        assertEquals("Club Test", context.getValue().getVariable("clubName"));
    }

    @Test
    @DisplayName("el recupero usa su plantilla y el enlace de reset")
    void passwordResetUsesResetTemplate() throws Exception {
        ArgumentCaptor<Context> context = ArgumentCaptor.forClass(Context.class);
        when(templateEngine.process(eq("password-reset"), context.capture())).thenReturn("<html>reset</html>");

        service.sendPasswordReset("ana@club.test", "Ana", "tok", "1 hora");

        ArgumentCaptor<OutgoingMail> mail = ArgumentCaptor.forClass(OutgoingMail.class);
        verify(transport).send(mail.capture());
        assertEquals("Restablecé tu contraseña de OvalTrack", mail.getValue().subject());
        assertEquals("<html>reset</html>", mail.getValue().html());
        assertEquals("https://app.test/auth/reset-password?token=tok", context.getValue().getVariable("urlReset"));
    }

    @Test
    @DisplayName("sin token no intenta enviar")
    void invitationWithoutTokenFails() {
        assertThrows(BusinessException.class, () -> service.sendInvitation(person(), null));
        verify(transport, never()).send(any());
    }

    @Test
    @DisplayName("un fallo del transporte llega como MailDeliveryException (502), sin envolver")
    void deliveryFailurePropagates() {
        when(templateEngine.process(eq("email"), any(Context.class))).thenReturn("<html/>");
        MailDeliveryException failure = new MailDeliveryException("caído", null);
        doThrow(failure).when(transport).send(any());

        MailDeliveryException error = assertThrows(MailDeliveryException.class,
                () -> service.sendInvitation(person(), "abc123"));
        assertSame(failure, error);
    }
}
