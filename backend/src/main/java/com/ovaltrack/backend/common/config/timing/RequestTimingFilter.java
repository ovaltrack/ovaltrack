package com.ovaltrack.backend.common.config.timing;

import java.io.IOException;
import java.util.Locale;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.ContentCachingResponseWrapper;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import lombok.RequiredArgsConstructor;

/**
 * Diagnóstico de rendimiento: agrega {@code Server-Timing} a cada respuesta (tiempo dentro del backend,
 * incluidos seguridad y serialización, y cantidad de consultas SQL) y deja en el log los pedidos lentos.
 * La respuesta se guarda en memoria hasta el final para poder escribir el header después del cuerpo.
 * Corre después de CORS y antes de Spring Security.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 1)
@RequiredArgsConstructor
public class RequestTimingFilter extends OncePerRequestFilter {

    static final String HEADER = "Server-Timing";
    static final long SLOW_REQUEST_MS = 500;

    private static final Logger logger = LoggerFactory.getLogger(RequestTimingFilter.class);

    private final SqlStatementCounter sqlCounter;

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request, @NonNull HttpServletResponse response,
            @NonNull FilterChain chain) throws ServletException, IOException {
        ContentCachingResponseWrapper wrapper = new ContentCachingResponseWrapper(response);
        long start = System.nanoTime();
        sqlCounter.begin();
        try {
            chain.doFilter(request, wrapper);
        } finally {
            double millis = (System.nanoTime() - start) / 1_000_000.0;
            int queries = sqlCounter.end();
            wrapper.setHeader(HEADER, String.format(Locale.ROOT, "app;dur=%.1f, sql;desc=\"%d consultas\"", millis, queries));
            if (millis >= SLOW_REQUEST_MS) {
                logger.warn("Pedido lento: {} {} -> {} en {} ms con {} consultas SQL",
                        request.getMethod(), request.getRequestURI(), wrapper.getStatus(), Math.round(millis), queries);
            }
            wrapper.copyBodyToResponse();
        }
    }
}
