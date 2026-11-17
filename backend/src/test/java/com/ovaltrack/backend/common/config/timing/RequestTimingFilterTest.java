package com.ovaltrack.backend.common.config.timing;

import static org.junit.jupiter.api.Assertions.*;

import java.nio.charset.StandardCharsets;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import jakarta.servlet.FilterChain;

class RequestTimingFilterTest {

    private final SqlStatementCounter counter = new SqlStatementCounter();
    private final RequestTimingFilter filter = new RequestTimingFilter(counter);

    @Test
    @DisplayName("Agrega Server-Timing con la duración y las consultas del pedido, después del cuerpo")
    void addsServerTimingAfterBody() throws Exception {
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = (req, res) -> {
            counter.inspect("select 1");
            counter.inspect("select 2");
            res.getOutputStream().write("{\"ok\":true}".getBytes(StandardCharsets.UTF_8));
            res.flushBuffer();
        };

        filter.doFilter(new MockHttpServletRequest("GET", "/matches/division"), response, chain);

        String header = response.getHeader(RequestTimingFilter.HEADER);
        assertNotNull(header);
        assertTrue(header.matches("app;dur=\\d+\\.\\d, sql;desc=\"2 consultas\""), header);
        assertEquals("{\"ok\":true}", response.getContentAsString());
    }

    @Test
    @DisplayName("Cada pedido arranca su cuenta de consultas en cero")
    void countsPerRequest() throws Exception {
        filter.doFilter(new MockHttpServletRequest("GET", "/a"), new MockHttpServletResponse(), (req, res) -> counter.inspect("select 1"));
        MockHttpServletResponse second = new MockHttpServletResponse();

        filter.doFilter(new MockHttpServletRequest("GET", "/b"), second, (req, res) -> { });

        assertTrue(second.getHeader(RequestTimingFilter.HEADER).endsWith("sql;desc=\"0 consultas\""));
    }

    @Test
    @DisplayName("Fuera de un pedido el contador no cuenta y devuelve el SQL sin cambios")
    void inspectorOutsideRequest() {
        assertEquals("select 1", counter.inspect("select 1"));
        assertEquals(0, counter.end());
    }
}
