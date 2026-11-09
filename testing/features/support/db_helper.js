import { createHash, randomBytes } from 'node:crypto';
import pg from 'pg';
import bcrypt from 'bcryptjs';

async function query(sql, params) {
  const client = new pg.Client({
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });
  await client.connect();
  try {
    return await client.query(sql, params);
  } finally {
    await client.end();
  }
}

/**
 * Crea la cuenta de jugador de una persona que ya existe, simulando la aceptacion de la invitacion por mail.
 *  No hace nada si la persona ya tiene cuenta.
 * Devuelve la cantidad de cuentas creadas (0 o 1).
 */
export async function createPlayerAccount(email, password) {
  const passwordHash = await bcrypt.hash(password, 10);
  const result = await query(
    `INSERT INTO users (id, login_email, password_hash, role, account_status, active, created_at, person_id)
     SELECT gen_random_uuid(), p.contact_email, $2, 'PLAYER', 'ACTIVE', true, now(), p.id
     FROM persons p
     WHERE p.contact_email = $1
     ON CONFLICT DO NOTHING`,
    [email, passwordHash],
  );
  return result.rowCount;
}

export async function personExists(email) {
  const result = await query('SELECT 1 FROM persons WHERE contact_email = $1', [email]);
  return result.rowCount > 0;
}

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

/**
 * Registra una invitación ya enviada para la persona (por email) en la división, como haría
 * POST /api/invitation/invite tras mandar el correo, reemplazando la anterior (es única por persona y división).
 * Con `rawToken` el enlace se puede canjear (el backend guarda su SHA-256); sin él, nadie puede canjearlo.
 */
export async function createSentInvitation(email, divisionId, { rawToken = randomBytes(32).toString('hex'), expiresInHours = 72 } = {}) {
  await query(
    `DELETE FROM invitations WHERE division_id = $2 AND person_id = (SELECT id FROM persons WHERE contact_email = $1)`,
    [email, divisionId],
  );
  await query(
    `WITH person AS (
       SELECT id, club_id FROM persons WHERE contact_email = $1
     ), token AS (
       INSERT INTO tokens (id, email, expires_at, hash, used)
       VALUES (gen_random_uuid(), $1, now() + make_interval(hours => $4::int), $3, false)
       RETURNING id
     )
     INSERT INTO invitations (id, sent_at, club_id, division_id, person_id, token_id)
     SELECT gen_random_uuid(), now(), person.club_id, $2, person.id, token.id
     FROM person, token`,
    [email, divisionId, sha256(rawToken), expiresInHours],
  );
}

/**
 * Crea (o reinicia) una cuenta activa sin persona, para probar flujos que cambian la contraseña
 * sin tocar las cuentas compartidas del seed.
 */
export async function upsertLoginAccount(email, password) {
  const passwordHash = await bcrypt.hash(password, 10);
  await query(
    `INSERT INTO users (id, login_email, password_hash, role, account_status, active, created_at)
     VALUES (gen_random_uuid(), $1, $2, 'COACH_ANALYST', 'ACTIVE', true, now())
     ON CONFLICT (login_email) DO UPDATE SET password_hash = EXCLUDED.password_hash, password_changed_at = NULL`,
    [email, passwordHash],
  );
  await query(`DELETE FROM tokens WHERE lower(email) = lower($1) AND purpose = 'PASSWORD_RESET'`, [email]);
}

/**
 * Registra un enlace de recupero ya enviado, como haría POST /api/auth/password-reset/request
 * tras mandar el correo (el backend guarda el SHA-256 del valor en crudo).
 */
export async function createPasswordResetToken(email, rawToken, { expiresInHours = 1, purpose = 'PASSWORD_RESET' } = {}) {
  await query(
    `INSERT INTO tokens (id, email, expires_at, hash, used, purpose)
     VALUES (gen_random_uuid(), $1, now() + make_interval(secs => $3::float * 3600), $2, false, $4)`,
    [email, sha256(rawToken), expiresInHours, purpose],
  );
}

/** Enlaces de recupero sin usar ni vencer de un correo. */
export async function countActivePasswordResetTokens(email) {
  const result = await query(
    `SELECT count(*)::int AS total FROM tokens
     WHERE lower(email) = lower($1) AND purpose = 'PASSWORD_RESET' AND used = false AND expires_at > now()`,
    [email],
  );
  return result.rows[0].total;
}
