/**
 * Datos de los textos legales. LEGAL_VERSION debe coincidir con
 * LegalTerms.CURRENT_VERSION del backend: al cambiar los textos se actualizan ambos
 * y los usuarios nuevos quedan registrados con la versión nueva.
 */
export const LEGAL_VERSION = '2026-11-08';
export const LEGAL_UPDATED_AT = '8 de noviembre de 2026';
export const LEGAL_PROVIDER = 'Equipo OvalTrack';
export const LEGAL_JURISDICTION = 'Puerto Madryn, Provincia del Chubut';
/** Correo para consultas y para ejercer los derechos sobre los datos personales. */
export const LEGAL_CONTACT_EMAIL = 'ovaltrack.contact@gmail.com';

export interface LegalSection {
  id: string;
  title: string;
}
