package com.ovaltrack.backend.common.mail.config;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.mail.javamail.JavaMailSender;

import com.ovaltrack.backend.common.config.EmailConfig;
import com.ovaltrack.backend.common.mail.transport.BrevoMailTransport;
import com.ovaltrack.backend.common.mail.transport.LogMailTransport;
import com.ovaltrack.backend.common.mail.transport.MailTransport;
import com.ovaltrack.backend.common.mail.transport.SmtpMailTransport;

/** Qué transporte se crea según {@code ovaltrack.mail.provider}, y que con Brevo no hace falta SMTP. */
class MailConfigTest {

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withUserConfiguration(EmailConfig.class, BrevoMailConfig.class,
                    SmtpMailTransport.class, BrevoMailTransport.class, LogMailTransport.class);

    @Test
    @DisplayName("smtp: crea JavaMailSender y SmtpMailTransport")
    void smtpProvider() {
        runner.withPropertyValues("ovaltrack.mail.provider=smtp",
                        "email.username=dev@ovaltrack.test", "email.password=secreto-de-prueba")
                .run(context -> {
                    assertThat(context).hasSingleBean(MailTransport.class);
                    assertThat(context).hasSingleBean(SmtpMailTransport.class);
                    assertThat(context).hasSingleBean(JavaMailSender.class);
                });
    }

    @Test
    @DisplayName("brevo: crea BrevoMailTransport sin JavaMailSender ni credenciales SMTP")
    void brevoProvider() {
        runner.withPropertyValues("ovaltrack.mail.provider=brevo",
                        "ovaltrack.mail.from-address=no-reply@ovaltrack.test",
                        "ovaltrack.mail.brevo.api-key=test-key",
                        "ovaltrack.mail.brevo.base-url=https://api.brevo.test/v3",
                        "email.username=", "email.password=")
                .run(context -> {
                    assertThat(context).hasNotFailed();
                    assertThat(context).hasSingleBean(MailTransport.class);
                    assertThat(context).hasSingleBean(BrevoMailTransport.class);
                    assertThat(context).doesNotHaveBean(JavaMailSender.class);
                });
    }

    @Test
    @DisplayName("brevo sin API key: el arranque falla con un mensaje claro")
    void brevoWithoutApiKeyFails() {
        runner.withPropertyValues("ovaltrack.mail.provider=brevo",
                        "ovaltrack.mail.from-address=no-reply@ovaltrack.test",
                        "ovaltrack.mail.brevo.api-key=")
                .run(context -> assertThat(context).hasFailed()
                        .getFailure().rootCause().hasMessageContaining("BREVO_API_KEY"));
    }

    @Test
    @DisplayName("log: solo loguea, sin JavaMailSender")
    void logProvider() {
        runner.withPropertyValues("ovaltrack.mail.provider=log", "email.username=", "email.password=")
                .run(context -> {
                    assertThat(context).hasSingleBean(LogMailTransport.class);
                    assertThat(context).doesNotHaveBean(JavaMailSender.class);
                });
    }
}
