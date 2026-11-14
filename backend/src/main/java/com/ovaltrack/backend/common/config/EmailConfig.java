package com.ovaltrack.backend.common.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.DefaultResourceLoader;
import org.springframework.core.io.ResourceLoader;

import com.ovaltrack.backend.common.mail.config.MailProperties;

/** Registra {@link MailProperties}; el cliente de Brevo vive en {@code BrevoMailConfig}. */
@Configuration
@EnableConfigurationProperties(MailProperties.class)
public class EmailConfig {

    @Bean
    ResourceLoader resourceLoader() {
        return new DefaultResourceLoader();
    }
}
