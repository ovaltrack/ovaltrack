package com.ovaltrack.backend.common.mail.config;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

import com.ovaltrack.backend.common.config.EmailConfig;
import com.ovaltrack.backend.common.mail.transport.BrevoMailTransport;
import com.ovaltrack.backend.common.mail.transport.LogMailTransport;
import com.ovaltrack.backend.common.mail.transport.MailTransport;

/** Qué transporte se crea según {@code ovaltrack.mail.provider}. */
class MailConfigTest {

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withUserConfiguration(EmailConfig.class, BrevoMailConfig.class,
                    BrevoMailTransport.class, LogMailTransport.class);

    private static final String[] BREVO_OK = {
            "ovaltrack.mail.from-address=no-reply@ovaltrack.test",
            "ovaltrack.mail.brevo.api-key=test-key",
            "ovaltrack.mail.brevo.base-url=https://api.brevo.test/v3" };

    @Test
    @DisplayName("sin proveedor: Brevo por defecto")
    void brevoByDefault() {
        runner.withPropertyValues(BREVO_OK)
                .run(context -> {
                    assertThat(context).hasSingleBean(MailTransport.class);
                    assertThat(context).hasSingleBean(BrevoMailTransport.class);
                });
    }

    @Test
    @DisplayName("brevo: crea BrevoMailTransport")
    void brevoProvider() {
        runner.withPropertyValues(BREVO_OK)
                .withPropertyValues("ovaltrack.mail.provider=brevo")
                .run(context -> {
                    assertThat(context).hasSingleBean(MailTransport.class);
                    assertThat(context).hasSingleBean(BrevoMailTransport.class);
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
    @DisplayName("log: solo loguea y no necesita credenciales")
    void logProvider() {
        runner.withPropertyValues("ovaltrack.mail.provider=log")
                .run(context -> {
                    assertThat(context).hasSingleBean(MailTransport.class);
                    assertThat(context).hasSingleBean(LogMailTransport.class);
                    assertThat(context).doesNotHaveBean(BrevoMailTransport.class);
                });
    }
}
