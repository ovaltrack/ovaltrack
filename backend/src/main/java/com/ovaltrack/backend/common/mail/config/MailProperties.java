package com.ovaltrack.backend.common.mail.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties (prefix = "ovaltrack.mail")
public record MailProperties(
    String provider,
    String fromAddress,
    String fromName
) {
    
}
