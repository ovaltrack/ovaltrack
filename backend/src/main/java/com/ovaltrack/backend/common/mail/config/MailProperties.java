package com.ovaltrack.backend.common.mail.config;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** Configuración del envío de correos (prefijo {@code ovaltrack.mail}). */
@ConfigurationProperties(prefix = "ovaltrack.mail")
public record MailProperties(
        String provider,
        String fromAddress,
        String fromName,
        Duration connectTimeout,
        Duration readTimeout,
        Brevo brevo) {

    /** Credenciales y URL de la API de Brevo; solo con {@code provider=brevo}. */
    public record Brevo(String apiKey, String baseUrl) {
    }
}
