import { Resend } from 'resend';

// Inicializácia klienta s API kľúčom z premenných prostredia
// Ak premenná chýba, inicializujeme s prázdnym reťazcom, aby aplikácia nepadla (zlyhá až samotné odoslanie)
export const resend = new Resend(process.env.RESEND_API_KEY || 're_missing_key');
