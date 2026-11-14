package com.ovaltrack.backend.common.config;

import java.util.Properties;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.DefaultResourceLoader;
import org.springframework.core.io.ResourceLoader;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;

import com.ovaltrack.backend.common.config.exceptions.BusinessException;
import com.ovaltrack.backend.common.mail.config.MailProperties;

@Configuration
@EnableConfigurationProperties(MailProperties.class)
public class EmailConfig {

    @Value("${email.username}")
    private String email;
    @Value("${email.password}")
    private String password;

    private Properties getMailProperties() {
        Properties properties = new Properties();
        properties.put("mail.smtp.auth", "true");
        properties.put("mail.smtp.starttls.enable", "true");
        properties.put("mail.smtp.host", "smtp.gmail.com");
        properties.put("mail.smtp.port", "587");
        return properties;
    }

    /** Solo con SMTP: con un proveedor HTTP no se crea y no hacen falta las credenciales de email. */
    @Bean
    @ConditionalOnProperty(prefix = "ovaltrack.mail", name = "provider", havingValue = "smtp", matchIfMissing = true)
    JavaMailSender javaMailSender() {

        if (email == null || email.isBlank())
            throw new BusinessException("Debe ingresar un email en las variables email.username del email.properties");
        if (password == null || password.isBlank())
            throw new BusinessException(
                    "Debe ingresar un password en las variables email.password del email.properties");

        JavaMailSenderImpl mailSender = new JavaMailSenderImpl();
        mailSender.setJavaMailProperties(getMailProperties());
        mailSender.setUsername(email);
        mailSender.setPassword(password);

        return mailSender;
    }

    @Bean
    ResourceLoader resourceLoader() {
        return new DefaultResourceLoader();
    }
}
