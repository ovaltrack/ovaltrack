package com.ovaltrack.backend.common.mail.config;

import java.net.http.HttpClient;
import java.time.Duration;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.ClientHttpRequestFactory;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

/** Cliente HTTP de Brevo con timeouts; solo con {@code ovaltrack.mail.provider=brevo}. */
@Configuration
@ConditionalOnProperty(prefix = "ovaltrack.mail", name = "provider", havingValue = "brevo")
public class BrevoMailConfig {

    private static final Duration DEFAULT_CONNECT_TIMEOUT = Duration.ofSeconds(5);
    private static final Duration DEFAULT_READ_TIMEOUT = Duration.ofSeconds(10);

    @Bean
    RestClient brevoRestClient(MailProperties props) {
        MailProperties.Brevo brevo = props.brevo();
        if (brevo == null || isBlank(brevo.apiKey()))
            throw new IllegalStateException("Con MAIL_PROVIDER=brevo hay que definir BREVO_API_KEY");
        if (isBlank(brevo.baseUrl()))
            throw new IllegalStateException("Falta ovaltrack.mail.brevo.base-url");
        if (isBlank(props.fromAddress()))
            throw new IllegalStateException("Con MAIL_PROVIDER=brevo hay que definir MAIL_FROM_ADDRESS (remitente verificado)");

        return RestClient.builder()
                .baseUrl(brevo.baseUrl())
                .requestFactory(requestFactory(
                        orDefault(props.connectTimeout(), DEFAULT_CONNECT_TIMEOUT),
                        orDefault(props.readTimeout(), DEFAULT_READ_TIMEOUT)))
                .build();
    }

    private static ClientHttpRequestFactory requestFactory(Duration connect, Duration read) {
        HttpClient httpClient = HttpClient.newBuilder().connectTimeout(connect).build();
        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(httpClient);
        factory.setReadTimeout(read);
        return factory;
    }

    private static Duration orDefault(Duration value, Duration fallback) {
        return value != null ? value : fallback;
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
