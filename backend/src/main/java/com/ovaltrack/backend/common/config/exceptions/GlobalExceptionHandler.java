package com.ovaltrack.backend.common.config.exceptions;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.NoHandlerFoundException;

import com.ovaltrack.backend.common.dto.response.MessageResponse;

import org.springframework.http.converter.HttpMessageNotReadableException;

@RestControllerAdvice
public class GlobalExceptionHandler {

        public static final String UNAUTHORIZED_MESSAGE = "No autorizado: se requiere autenticación";

        @ExceptionHandler(DataIntegrityViolationException.class)
        public ResponseEntity<MessageResponse> handleDataIntegrityViolation(
                        DataIntegrityViolationException exception) {
                return ResponseEntity.status(HttpStatus.CONFLICT)
                                .body(new MessageResponse(
                                                "No se pudo guardar la información porque viola una restricción de datos."));
        }

        @ExceptionHandler(AccessDeniedException.class)
        public ResponseEntity<MessageResponse> handleAccessDenied(AccessDeniedException ex) {
                Authentication auth = SecurityContextHolder.getContext().getAuthentication();
                if (auth == null || !auth.isAuthenticated() || auth instanceof AnonymousAuthenticationToken
                                || "anonymousUser".equals(auth.getPrincipal())) {
                        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                                        .body(new MessageResponse(UNAUTHORIZED_MESSAGE));
                }
                String message = (ex.getMessage() != null && !ex.getMessage().equals("Access Denied")
                                && !ex.getMessage().isBlank())
                                                ? ex.getMessage()
                                                : "Acceso denegado: solo el administrador del club puede realizar esta acción";
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                                .body(new MessageResponse(message));
        }

        @ExceptionHandler(AuthenticationException.class)
        public ResponseEntity<MessageResponse> handleAuthenticationException(AuthenticationException ex) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                                .body(new MessageResponse(UNAUTHORIZED_MESSAGE));
        }

        @ExceptionHandler(EntityNotFoundException.class)
        public ResponseEntity<MessageResponse> handleEntityNotFound(EntityNotFoundException ex) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                                .body(new MessageResponse(ex.getMessage()));
        }

        @ExceptionHandler(BusinessException.class)
        public ResponseEntity<MessageResponse> handleBusinessException(BusinessException ex) {
                return ResponseEntity.status(HttpStatus.CONFLICT)
                                .body(new MessageResponse(ex.getMessage()));
        }

        @ExceptionHandler(UserDeactivatedException.class)
        public ResponseEntity<MessageResponse> handleUserDeactivatedException(UserDeactivatedException ex) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                                .body(new MessageResponse(ex.getMessage()));
        }

        @ExceptionHandler(ClubInactiveException.class)
        public ResponseEntity<MessageResponse> handleClubInactiveException(ClubInactiveException ex) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                                .body(new MessageResponse(ex.getMessage()));
        }

        /** Falla de @Valid: se informa el mensaje del primer campo inválido. */
        @ExceptionHandler(MethodArgumentNotValidException.class)
        public ResponseEntity<MessageResponse> handleMethodArgumentNotValid(MethodArgumentNotValidException ex) {
                FieldError fieldError = ex.getBindingResult().getFieldError();
                String message = fieldError != null ? fieldError.getDefaultMessage() : "Datos inválidos";
                return ResponseEntity.status(HttpStatus.CONFLICT)
                                .body(new MessageResponse(message));
        }

        @ExceptionHandler(HttpMessageNotReadableException.class)
        public ResponseEntity<MessageResponse> handleHttpMessageNotReadable(
                        HttpMessageNotReadableException ex) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                                .body(new MessageResponse("El cuerpo de la solicitud no contiene un JSON válido."));
        }

        @ExceptionHandler(NoHandlerFoundException.class)
        public ResponseEntity<MessageResponse> notFoundException(NoHandlerFoundException ex) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                                .body(new MessageResponse(ex.getMessage()));
        }

        @ExceptionHandler(IllegalArgumentException.class)
        public ResponseEntity<MessageResponse> handleIllegalArgumentException(
                        IllegalArgumentException ex) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                                .body(new MessageResponse(
                                                ex.getMessage() != null ? ex.getMessage() : "Parámetro inválido."));
        }
}
