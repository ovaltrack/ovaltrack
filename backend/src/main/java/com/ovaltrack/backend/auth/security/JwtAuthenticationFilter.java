package com.ovaltrack.backend.auth.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.UUID;

import com.ovaltrack.backend.auth.access.AccessStatus;
import com.ovaltrack.backend.auth.access.AccountAccessService;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final AccountAccessService accountAccessService;
    private final int TOKEN_START_INDEX = 7; 

    public JwtAuthenticationFilter(JwtService jwtService, AccountAccessService accountAccessService) {
        this.jwtService = jwtService;
        this.accountAccessService = accountAccessService;
    }

    /**
     * Intercepta cada solicitud HTTP una única vez.
     * Si contiene una cabecera Bearer válida, extrae el token, verifica la firma
     * e inyecta la autoridad con prefijo 'ROLE_' requerida por Spring Security.
     */
    @Override
    protected void doFilterInternal(HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {

        final String authHeader = request.getHeader("Authorization");

        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        final String token = authHeader.substring(TOKEN_START_INDEX); 
        AccessStatus access = AccessStatus.ALLOWED;
        try {
            var claims = jwtService.extractClaims(token);
            String email = claims.getSubject();
            String rol = claims.get("role", String.class);

            // Token válido pero cuenta o club desactivados después de emitirlo: se corta acá
            access = accountAccessService.check(parseUserId(claims.get("userId", String.class)));

            if (access == AccessStatus.ALLOWED && email != null
                    && SecurityContextHolder.getContext().getAuthentication() == null) {
                // Se registra la autoridad con prefijo ROLE_ (convención de Spring Security)
                var authorities = List.of(new SimpleGrantedAuthority("ROLE_" + rol));

                var authToken = new UsernamePasswordAuthenticationToken(email, null, authorities);
                authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));

                SecurityContextHolder.getContext().setAuthentication(authToken);
            }
        } catch (Exception e) {
            // Token vencido o firma inválida: continúa sin setear autenticación (dará
            // 401/403)
            // TODO: Capturar el error de forma valida, loggearlo en la aplicacion
        }

        if (access != AccessStatus.ALLOWED) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType("application/json");
            response.setCharacterEncoding("UTF-8");
            response.getWriter().write("{\"message\": \"" + AccountAccessService.messageFor(access) + "\"}");
            return;
        }

        filterChain.doFilter(request, response);
    }

    private static UUID parseUserId(String value) {
        try {
            return value == null ? null : UUID.fromString(value);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}