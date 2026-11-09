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

import com.ovaltrack.backend.auth.access.AccessDecision;
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

            // Token válido pero cuenta o club desactivados, o correo de acceso cambiado, después de emitirlo
            AccessDecision decision = accountAccessService.decide(parseUserId(claims.get("userId", String.class)), email);
            access = decision.status();

            if (decision.allowed() && email != null
                    && SecurityContextHolder.getContext().getAuthentication() == null) {
                // Rol vigente en la BD (no el del token), con prefijo ROLE_ (convención de Spring Security)
                var authorities = List.of(new SimpleGrantedAuthority("ROLE_" + decision.role().name()));

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
            // Sin autenticar: una ruta pública (p. ej. registration-options) responde igual que sin token;
            // una privada termina en el entry point, que responde 401 con este motivo.
            request.setAttribute(AccountAccessService.DENIED_MESSAGE_ATTRIBUTE, AccountAccessService.messageFor(access));
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