package com.ovaltrack.backend.common.config.timing;

import org.hibernate.resource.jdbc.spi.StatementInspector;
import org.springframework.stereotype.Component;

/**
 * Cuenta las sentencias SQL que Hibernate prepara en el hilo del pedido; no modifica el SQL.
 * {@link RequestTimingFilter} abre y cierra la cuenta, así cada pedido informa sus consultas.
 */
@Component
public class SqlStatementCounter implements StatementInspector {

    private static final ThreadLocal<int[]> COUNT = new ThreadLocal<>();

    @Override
    public String inspect(String sql) {
        int[] count = COUNT.get();
        if (count != null) {
            count[0]++;
        }
        return sql;
    }

    public void begin() {
        COUNT.set(new int[1]);
    }

    /** Devuelve las sentencias contadas desde {@link #begin()} y libera el hilo. */
    public int end() {
        int[] count = COUNT.get();
        COUNT.remove();
        return count == null ? 0 : count[0];
    }
}
