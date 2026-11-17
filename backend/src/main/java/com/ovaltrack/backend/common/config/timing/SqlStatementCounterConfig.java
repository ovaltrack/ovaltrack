package com.ovaltrack.backend.common.config.timing;

import org.hibernate.cfg.AvailableSettings;
import org.springframework.boot.autoconfigure.orm.jpa.HibernatePropertiesCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Registra {@link SqlStatementCounter} en Hibernate para que cuente las consultas de cada pedido. */
@Configuration
public class SqlStatementCounterConfig {

    @Bean
    HibernatePropertiesCustomizer sqlStatementCounterCustomizer(SqlStatementCounter counter) {
        return properties -> properties.put(AvailableSettings.STATEMENT_INSPECTOR, counter);
    }
}
