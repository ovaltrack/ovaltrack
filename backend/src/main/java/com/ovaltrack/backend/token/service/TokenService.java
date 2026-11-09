package com.ovaltrack.backend.token.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.HexFormat;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import com.ovaltrack.backend.common.config.exceptions.BusinessException;
import com.ovaltrack.backend.token.domain.Token;
import com.ovaltrack.backend.token.domain.TokenPurpose;
import com.ovaltrack.backend.token.repository.TokenRepository;

import jakarta.transaction.Transactional;
import lombok.AllArgsConstructor;

@Service
@AllArgsConstructor
public class TokenService {

    public record IssuedToken(Token token, String rawValue) {
    }

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final Logger logger = LoggerFactory.getLogger(TokenService.class);
    private TokenRepository repository;

    public IssuedToken create(String email, Duration timeToLive, String rawValue) {
        return create(email, timeToLive, rawValue, TokenPurpose.INVITATION);
    }

    public IssuedToken create(String email, Duration timeToLive, String rawValue, TokenPurpose purpose) {
        if (purpose == null) {
            throw new BusinessException("El propósito del token no puede ser nulo");
        }
        if (email == null || email.isBlank()) {
            throw new BusinessException("El email no puede ser nulo");
        }
        if (timeToLive == null) {
            throw new BusinessException("La tiempo de vida del token no puede ser nulo");
        }
        logger.info("Iniciando creación de token para el email: {} con tiempo de vida: {}", email, timeToLive);
        if (rawValue == null || rawValue.isBlank()) {
            rawValue = generateRawValue();
        }
        Token token = new Token();
        token.setHash(hash(rawValue));
        token.setEmail(email);
        token.setExpiresAt(LocalDateTime.now().plus(timeToLive));
        token.setUsed(false);
        token.setPurpose(purpose);

        Token savedToken = this.save(token);
        logger.info("Token creado y guardado exitosamente para el email: {}", email);

        return new IssuedToken(savedToken, rawValue);
    }

    /**
     * - 32 bytes aleatorios en Base64 URL: 43 caracteres alfanuméricos (más '-' y
     * '_').
     */
    public String generateRawValue() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    /**
     * - SHA-256 en hexadecimal: 64 caracteres, calza con length = 64 de la columna.
     */
    private String hash(String rawValue) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(rawValue.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            logger.error("Error crítico: Algoritmo SHA-256 no disponible al intentar hashear el token", e);
            throw new IllegalStateException("SHA-256 no disponible", e);
        }
    }

    @Transactional
    public Token save(Token token) {
        if (token == null) {
            logger.warn("Se intentó guardar un token nulo");
            return null;
        }
        logger.info("Guardando token en la base de datos para el email: {}", token.getEmail());
        return repository.save(token);
    }

    /** Busca un token vigente a partir del valor en crudo recibido en el enlace. */
    public Token findUsable(String rawValue) {
        logger.info("Buscando token vigente a partir del valor en crudo");
        String hashedToken = hash(rawValue);
        Token token = repository.findByHash(hashedToken);

        if (token == null) {
            logger.warn("No se encontró ningún token asociado al hash provisto");
        } else {
            logger.info("Token encontrado exitosamente para el email: {}", token.getEmail());
        }

        return token;
    }

    @Transactional
    public void consume(String rawValue) {
        if (rawValue == null || rawValue.isBlank())
            throw new BusinessException("El valor del token vino nulo o vacio");
        logger.info("Intentando consumir (marcar como usado) el token");
        String hashedToken = hash(rawValue);

        int updatedRows = repository.markAsUsed(hashedToken, LocalDateTime.now());
        if (updatedRows == 0) {
            logger.warn("Fallo al consumir el token: El enlace ya fue utilizado o venció");
            throw new BusinessException("Este enlace ya fue utilizado o venció.");
        }

        logger.info("Token consumido exitosamente");
    }

    /**
     * Token vigente (sin usar y sin vencer) emitido para ese propósito; null si no hay.
     * No distingue "no existe", "vencido" o "de otro flujo": el llamador responde un único mensaje.
     */
    public Token findActive(String rawValue, TokenPurpose purpose) {
        if (rawValue == null || rawValue.isBlank()) {
            return null;
        }
        Token token = repository.findByHash(hash(rawValue));
        if (token == null || !token.isFor(purpose) || token.isUsed()
                || !token.getExpiresAt().isAfter(LocalDateTime.now())) {
            return null;
        }
        return token;
    }

    /** Marca como usado un token vigente de ese propósito; false si ya se usó, venció o es de otro flujo. */
    @Transactional
    public boolean consume(String rawValue, TokenPurpose purpose) {
        if (rawValue == null || rawValue.isBlank()) {
            return false;
        }
        return repository.markAsUsed(hash(rawValue), purpose, LocalDateTime.now()) == 1;
    }

    @Transactional
    public int revokeActive(String email, TokenPurpose purpose) {
        return repository.revokeActive(email, purpose);
    }
}