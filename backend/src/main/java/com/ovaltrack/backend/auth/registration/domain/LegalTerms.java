package com.ovaltrack.backend.auth.registration.domain;

/**
 * Versión vigente de los Términos y Condiciones y de la Política de Privacidad.
 * Debe coincidir con LEGAL_VERSION del frontend (features/legal/legal-info.ts):
 * al cambiar los textos se actualizan ambas.
 */
public final class LegalTerms {

    public static final String CURRENT_VERSION = "2026-11-08";

    public static final String NOT_ACCEPTED_MESSAGE =
            "Tenés que aceptar los Términos y Condiciones y la Política de Privacidad.";

    private LegalTerms() {
    }
}
