-- OvalTrack Data Seeder — staging unificado
-- =========================================
-- Unifica data_pmrc_completo.sql (base; incluye todo data_trelew.sql) y data.sql (dataset demo, IDs remapeados).
-- El catálogo de event_types es el de data_pmrc_completo.sql.
-- Uso: ./ds staging data_unificado.sql

ALTER TABLE matches_players ADD COLUMN IF NOT EXISTS slot_order INTEGER;
ALTER TABLE matches_players ADD COLUMN IF NOT EXISTS number INTEGER;
ALTER TABLE matches_players ADD COLUMN IF NOT EXISTS field_status VARCHAR(32);
ALTER TABLE matches_players ADD COLUMN IF NOT EXISTS field_slot INTEGER;

-- La tabla de zonas se crea aquí para que el staging pueda ejecutarse incluso antes
-- del primer arranque de Hibernate con ddl-auto=update.
CREATE TABLE IF NOT EXISTS match_zone_assignments (
    id UUID PRIMARY KEY,
    match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    period INTEGER NOT NULL,
    start_minute INTEGER NOT NULL,
    end_minute INTEGER NOT NULL,
    zone_row INTEGER NOT NULL,
    zone_col INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_zone_assignments_match ON match_zone_assignments (match_id);

TRUNCATE TABLE match_zone_assignments, events, matches_players, event_types, matches, opponents, division_players, division_coaches, divisions, clubs, users, persons RESTART IDENTITY CASCADE;

ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_status_check;
ALTER TABLE matches ADD CONSTRAINT matches_status_check CHECK (status IN ('EMPTY_ROSTER', 'NOT_STARTED', 'IN_PROGRESS', 'HALFTIME', 'FINISHED', 'CANCELLED'));

ALTER TABLE matches ADD COLUMN IF NOT EXISTS clock_elapsed_seconds INTEGER NOT NULL DEFAULT 0;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS clock_paused BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS clock_updated_at TIMESTAMP;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS current_possession VARCHAR(255) NOT NULL DEFAULT 'OWN';
ALTER TABLE matches ADD COLUMN IF NOT EXISTS home_score INTEGER NOT NULL DEFAULT 0;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS away_score INTEGER NOT NULL DEFAULT 0;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS started_at TIMESTAMP;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS finished_at TIMESTAMP;
ALTER TABLE events ADD COLUMN IF NOT EXISTS client_event_id UUID;
ALTER TABLE matches_players ADD COLUMN IF NOT EXISTS slot_order INTEGER;
-- Catálogo de eventos v3
ALTER TABLE event_types ADD COLUMN IF NOT EXISTS code VARCHAR(60);
CREATE UNIQUE INDEX IF NOT EXISTS uk_event_types_code ON event_types (code);
UPDATE event_types
SET template_event_fields = (
    SELECT jsonb_agg(
        CASE WHEN field->>'key' IN ('playerOutNumber', 'playerInNumber')
             THEN (field - 'max') || jsonb_build_object('min', 1)
             ELSE field END)
    FROM jsonb_array_elements(template_event_fields) AS field)
WHERE code = 'SUBSTITUTION';
UPDATE events
SET player_id = NULL
WHERE event_type_id IN (SELECT id FROM event_types WHERE code = 'SUBSTITUTION');
-- show_in_palette = false -> el tipo no aparece en la botonera en vivo (solo se crea como seguimiento o desde video)
ALTER TABLE event_types ADD COLUMN IF NOT EXISTS show_in_palette BOOLEAN NOT NULL DEFAULT TRUE;
-- follow_up_event_type_id -> tras registrar este tipo, la app pide automáticamente el evento de seguimiento
ALTER TABLE event_types ADD COLUMN IF NOT EXISTS follow_up_event_type_id UUID;
-- actor: quién ejecuta el evento (ATTACKING = equipo con la pelota, DEFENDING = equipo sin la pelota, CHOOSE = a elección)
ALTER TABLE event_types ADD COLUMN IF NOT EXISTS actor VARCHAR(10) NOT NULL DEFAULT 'ATTACKING';
-- possession_after: posesión resultante respecto del actor (KEEP = no cambia, ACTOR = queda en quien lo hizo, OTHER = pasa al rival)
ALTER TABLE event_types ADD COLUMN IF NOT EXISTS possession_after VARCHAR(10) NOT NULL DEFAULT 'KEEP';
-- follow_up_choices: eventos entre los que el analista elige al guardar este tipo (ej. cómo se juega un penal)
ALTER TABLE event_types ADD COLUMN IF NOT EXISTS follow_up_choices JSONB NOT NULL DEFAULT '[]';
-- zone_rule: restricción de zonas por tipo de evento (null = sin restricción)
ALTER TABLE event_types ADD COLUMN IF NOT EXISTS zone_rule JSONB;



-- =========================================
-- STAGING: Primera del Puerto Madryn Rugby Club (PMRC); Trelew Rugby Club es uno de los rivales
-- Snapshot de la BD del 19/10/2026 16:45 (2 partidos FINISHED, 167 eventos). Plantel de 23: 1-8 forwards, 9-15 backs, 16-21 forwards, 22-23 backs.
-- =========================================

-- =========================================
-- PERSONS (31 filas: 3 de staff + 27 jugadores + 1 admin OvalTrack)
-- =========================================

INSERT INTO persons (id, first_name, last_name, birth_date, contact_email, contact_phone, created_at) VALUES
    ('11111111-1111-1111-1111-000000000001', 'Carlos', 'Administrador', '1980-01-01', 'admin@club.com', '123456789', '2026-10-17 17:04:12.744'),
    ('11111111-1111-1111-1111-000000000002', 'Gonzalo', 'Entrenador', '1985-05-10', 'gonzalo@mail.com', '123456789', '2026-10-17 17:04:12.744'),
    ('11111111-1111-1111-1111-000000000003', 'Mario', 'Analista', '1982-11-20', 'coach2@ovaltrack.com', '123456789', '2026-10-17 17:04:12.744'),
    ('11111111-1111-1111-1111-000000000101', 'Matías', 'Salari', NULL, NULL, NULL, '2026-10-17 17:04:12.744'),
    ('11111111-1111-1111-1111-000000000102', 'Joaquín', 'Guerra', NULL, NULL, NULL, '2026-10-17 17:04:12.744'),
    ('11111111-1111-1111-1111-000000000103', 'Leonel', 'Llanquitru', NULL, NULL, NULL, '2026-10-17 17:04:12.744'),
    ('11111111-1111-1111-1111-000000000104', 'Luciano', 'Belmar', NULL, NULL, NULL, '2026-10-17 17:04:12.744'),
    ('11111111-1111-1111-1111-000000000105', 'Matías', 'Iribarra', NULL, NULL, NULL, '2026-10-17 17:04:12.744'),
    ('11111111-1111-1111-1111-000000000106', 'Gonzalo', 'Mangini', NULL, NULL, NULL, '2026-10-17 17:04:12.744'),
    ('11111111-1111-1111-1111-000000000107', 'Tomas', 'Luffi', NULL, NULL, NULL, '2026-10-17 17:04:12.744'),
    ('11111111-1111-1111-1111-000000000108', 'Nazareno', 'Rocha', NULL, NULL, NULL, '2026-10-17 17:04:12.744'),
    ('11111111-1111-1111-1111-000000000109', 'Ariel', 'Ferrufino', NULL, NULL, NULL, '2026-10-17 17:04:12.744'),
    ('11111111-1111-1111-1111-000000000110', 'Hernán', 'Vera', NULL, NULL, NULL, '2026-10-17 17:04:12.744'),
    ('11111111-1111-1111-1111-000000000111', 'Rodrigo', 'Aman', NULL, NULL, NULL, '2026-10-17 17:04:12.744'),
    ('11111111-1111-1111-1111-000000000112', 'Francisco', 'Peña', NULL, NULL, NULL, '2026-10-17 17:04:12.744'),
    ('11111111-1111-1111-1111-000000000113', 'Bautista', 'Mengoni', NULL, NULL, NULL, '2026-10-17 17:04:12.744'),
    ('11111111-1111-1111-1111-000000000114', 'Luciano', 'Balmaceda', NULL, NULL, NULL, '2026-10-17 17:04:12.744'),
    ('11111111-1111-1111-1111-000000000115', 'Bautista', 'Guerra', NULL, NULL, NULL, '2026-10-17 17:04:12.744'),
    ('11111111-1111-1111-1111-000000000116', 'Esteban', 'Ceballos', NULL, NULL, NULL, '2026-10-17 17:04:12.744'),
    ('11111111-1111-1111-1111-000000000117', 'Facundo', 'Gangas', NULL, NULL, NULL, '2026-10-17 17:04:12.744'),
    ('11111111-1111-1111-1111-000000000118', 'Alejandro', 'Cañiu', NULL, NULL, NULL, '2026-10-17 17:04:12.744'),
    ('11111111-1111-1111-1111-000000000119', 'Rodrigo', 'Silva', NULL, NULL, NULL, '2026-10-17 17:04:12.744'),
    ('11111111-1111-1111-1111-000000000120', 'Juan', 'Pistilli', NULL, NULL, NULL, '2026-10-17 17:04:12.744'),
    ('11111111-1111-1111-1111-000000000121', 'Manuel', 'Rocha', NULL, NULL, NULL, '2026-10-17 17:04:12.744'),
    ('11111111-1111-1111-1111-000000000122', 'Agustín', 'Albornoz', NULL, NULL, NULL, '2026-10-17 17:04:12.744'),
    ('11111111-1111-1111-1111-000000000123', 'Bruno', 'Carrizo', NULL, NULL, NULL, '2026-10-17 17:04:12.744'),
    ('11111111-1111-1111-1111-000000000124', 'Facundo', 'Soria', NULL, NULL, NULL, '2026-10-17 17:04:12.744'),
    ('11111111-1111-1111-1111-000000000125', 'Emiliano', 'Villegas', NULL, NULL, NULL, '2026-10-17 17:04:12.744'),
    ('11111111-1111-1111-1111-000000000126', 'Joaquín', 'Devitt', NULL, NULL, NULL, '2026-10-17 17:04:12.744'),
    ('11111111-1111-1111-1111-000000000127', 'Alejo', 'Zotelo', NULL, NULL, NULL, '2026-10-17 17:04:12.744'),
    ('b62a7203-3291-411b-a090-2e5b7e466c35', 'administrador', 'ovaltrack', NULL, 'admin@ovaltrack.com', '0123456789', '2026-10-17 19:04:52.314');


-- =========================================
-- USERS (admin club, entrenador, analista y admin OvalTrack)
-- =========================================

INSERT INTO users (id, login_email, password_hash, role, person_id, active, account_status, created_at) VALUES
    ('11111111-1111-1111-1111-000000000001', 'admin@club.com', '$2a$10$muT5CkR/ijOSgfmjvAWwNuYxVc6bZUKpt2inx5AXux7ukib9X3h6K', 'ADMIN_CLUB', '11111111-1111-1111-1111-000000000001', true, NULL, '2026-10-17 17:04:12.745'),
    ('11111111-1111-1111-1111-000000000002', 'gonzalo@mail.com', '$2a$10$EJRf2jQGFPYWYSL03J6rCe4v9v3dMxeyt/efj17fIzSgCO9Um1ImW', 'COACH_ANALYST', '11111111-1111-1111-1111-000000000002', true, NULL, '2026-10-17 17:04:12.745'),
    ('11111111-1111-1111-1111-000000000003', 'coach2@ovaltrack.com', '$2a$10$rfosuoBOENyuQRIy6eCSX.RVjuk2ZrLtlz7NdGpBlxrqviDJflWiG', 'COACH_ANALYST', '11111111-1111-1111-1111-000000000003', true, NULL, '2026-10-17 17:04:12.745'),
    ('c70c9d49-825f-4a03-9e2d-dfd52d054209', 'admin@ovaltrack.com', '$2a$10$EjrfTag1DZaSFbHLC7f3X.LiN4mPqkLCy69hzDFedyh399yzz01MG', 'ADMIN_OVALTRACK', 'b62a7203-3291-411b-a090-2e5b7e466c35', true, 'ACTIVE', '2026-10-17 19:04:52.322');


-- =========================================
-- CLUBS
-- =========================================

INSERT INTO clubs (id, name, created_at, status, admin_user_id, city, logo_url, contact_email, contact_phone) VALUES
    ('11111111-1111-1111-1111-000000000010', 'Puerto Madryn Rugby Club', '2026-10-17 17:04:12.746', 'ACTIVE', '11111111-1111-1111-1111-000000000001', 'Puerto Madryn', '/escudo.png', 'contacto@pmrc.com', '123456789');

-- Asociar las personas del club (el admin de OvalTrack no pertenece a ningún club)
UPDATE persons SET club_id = '11111111-1111-1111-1111-000000000010'
WHERE id <> 'b62a7203-3291-411b-a090-2e5b7e466c35';


-- =========================================
-- DIVISIONS
-- =========================================

INSERT INTO divisions (id, name, club_id, created_at, age_category, gender, active) VALUES
    ('11111111-1111-1111-1111-000000000020', 'Primera', '11111111-1111-1111-1111-000000000010', '2026-10-17 17:04:12.747', 'SENIOR', 'MALE', true);


-- =========================================
-- DIVISION_COACHES (Gonzalo entrena; Mario analiza el partido)
-- =========================================

INSERT INTO division_coaches (id, person_id, division_id, start_date, end_date) VALUES
    ('11111111-1111-1111-1111-000000000030', '11111111-1111-1111-1111-000000000002', '11111111-1111-1111-1111-000000000020', '2023-01-01', NULL),
    ('11111111-1111-1111-1111-000000000031', '11111111-1111-1111-1111-000000000003', '11111111-1111-1111-1111-000000000020', '2023-01-01', NULL);


-- =========================================
-- DIVISION_PLAYERS (27 jugadores de Primera: 23 convocables + 4 adicionales del plantel)
-- =========================================

INSERT INTO division_players (id, person_id, division_id, jersey_number, position, start_date, end_date) VALUES
    ('11111111-1111-1111-1111-000000000201', '11111111-1111-1111-1111-000000000101', '11111111-1111-1111-1111-000000000020', 1, 'Forward', '2023-01-01', NULL),
    ('11111111-1111-1111-1111-000000000202', '11111111-1111-1111-1111-000000000102', '11111111-1111-1111-1111-000000000020', 2, 'Forward', '2023-01-01', NULL),
    ('11111111-1111-1111-1111-000000000203', '11111111-1111-1111-1111-000000000103', '11111111-1111-1111-1111-000000000020', 3, 'Forward', '2023-01-01', NULL),
    ('11111111-1111-1111-1111-000000000204', '11111111-1111-1111-1111-000000000104', '11111111-1111-1111-1111-000000000020', 4, 'Forward', '2023-01-01', NULL),
    ('11111111-1111-1111-1111-000000000205', '11111111-1111-1111-1111-000000000105', '11111111-1111-1111-1111-000000000020', 5, 'Forward', '2023-01-01', NULL),
    ('11111111-1111-1111-1111-000000000206', '11111111-1111-1111-1111-000000000106', '11111111-1111-1111-1111-000000000020', 6, 'Forward', '2023-01-01', NULL),
    ('11111111-1111-1111-1111-000000000207', '11111111-1111-1111-1111-000000000107', '11111111-1111-1111-1111-000000000020', 7, 'Forward', '2023-01-01', NULL),
    ('11111111-1111-1111-1111-000000000208', '11111111-1111-1111-1111-000000000108', '11111111-1111-1111-1111-000000000020', 8, 'Forward', '2023-01-01', NULL),
    ('11111111-1111-1111-1111-000000000209', '11111111-1111-1111-1111-000000000109', '11111111-1111-1111-1111-000000000020', 9, 'Back', '2023-01-01', NULL),
    ('11111111-1111-1111-1111-000000000210', '11111111-1111-1111-1111-000000000110', '11111111-1111-1111-1111-000000000020', 10, 'Back', '2023-01-01', NULL),
    ('11111111-1111-1111-1111-000000000211', '11111111-1111-1111-1111-000000000111', '11111111-1111-1111-1111-000000000020', 11, 'Back', '2023-01-01', NULL),
    ('11111111-1111-1111-1111-000000000212', '11111111-1111-1111-1111-000000000112', '11111111-1111-1111-1111-000000000020', 12, 'Back', '2023-01-01', NULL),
    ('11111111-1111-1111-1111-000000000213', '11111111-1111-1111-1111-000000000113', '11111111-1111-1111-1111-000000000020', 13, 'Back', '2023-01-01', NULL),
    ('11111111-1111-1111-1111-000000000214', '11111111-1111-1111-1111-000000000114', '11111111-1111-1111-1111-000000000020', 14, 'Back', '2023-01-01', NULL),
    ('11111111-1111-1111-1111-000000000215', '11111111-1111-1111-1111-000000000115', '11111111-1111-1111-1111-000000000020', 15, 'Back', '2023-01-01', NULL),
    ('11111111-1111-1111-1111-000000000216', '11111111-1111-1111-1111-000000000116', '11111111-1111-1111-1111-000000000020', 16, 'Forward', '2023-01-01', NULL),
    ('11111111-1111-1111-1111-000000000217', '11111111-1111-1111-1111-000000000117', '11111111-1111-1111-1111-000000000020', 17, 'Forward', '2023-01-01', NULL),
    ('11111111-1111-1111-1111-000000000218', '11111111-1111-1111-1111-000000000118', '11111111-1111-1111-1111-000000000020', 18, 'Forward', '2023-01-01', NULL),
    ('11111111-1111-1111-1111-000000000219', '11111111-1111-1111-1111-000000000119', '11111111-1111-1111-1111-000000000020', 19, 'Forward', '2023-01-01', NULL),
    ('11111111-1111-1111-1111-000000000220', '11111111-1111-1111-1111-000000000120', '11111111-1111-1111-1111-000000000020', 20, 'Forward', '2023-01-01', NULL),
    ('11111111-1111-1111-1111-000000000221', '11111111-1111-1111-1111-000000000121', '11111111-1111-1111-1111-000000000020', 21, 'Forward', '2023-01-01', NULL),
    ('11111111-1111-1111-1111-000000000222', '11111111-1111-1111-1111-000000000122', '11111111-1111-1111-1111-000000000020', 22, 'Back', '2023-01-01', NULL),
    ('11111111-1111-1111-1111-000000000223', '11111111-1111-1111-1111-000000000123', '11111111-1111-1111-1111-000000000020', 23, 'Back', '2023-01-01', NULL),

    ('11111111-1111-1111-1111-000000000224', '11111111-1111-1111-1111-000000000124', '11111111-1111-1111-1111-000000000020', 24, 'Forward', '2023-01-01', NULL),
    ('11111111-1111-1111-1111-000000000225', '11111111-1111-1111-1111-000000000125', '11111111-1111-1111-1111-000000000020', 25, 'Forward', '2023-01-01', NULL),
    ('11111111-1111-1111-1111-000000000226', '11111111-1111-1111-1111-000000000126', '11111111-1111-1111-1111-000000000020', 26, 'Forward', '2023-01-01', NULL),
    ('11111111-1111-1111-1111-000000000227', '11111111-1111-1111-1111-000000000127', '11111111-1111-1111-1111-000000000020', 27, 'Back', '2023-01-01', NULL);


-- =========================================
-- OPPONENTS (Clubes rivales)
-- =========================================

INSERT INTO opponents (id, name, city, alias) VALUES
    ('22222222-1111-1111-1111-000000000001', 'Trelew Rugby Club', 'Trelew', 'TRC'),
    ('22222222-1111-1111-1111-000000000002', 'Bigornia Club', 'Rawson', 'BRC'),
    ('22222222-1111-1111-1111-000000000003', 'Chenque Rugby Club', 'Comodoro Rivadavia', 'CRC'),
    ('22222222-1111-1111-1111-000000000004', 'Patoruzú Rugby Club', 'Trelew', 'PRC'),
    ('22222222-1111-1111-1111-000000000005', 'Deportivo Portugués', 'Comodoro Rivadavia', 'DP'),
    ('22222222-1111-1111-1111-000000000006', 'Calafate Rugby Club', 'Comodoro Rivadavia', 'CalRC'),
    ('22222222-1111-1111-1111-000000000007', 'Comodoro Rugby Club', 'Comodoro Rivadavia', 'ComRC');


-- =========================================
-- MATCHES (2 partidos, ambos FINISHED, vs Trelew Rugby Club)
-- =========================================

INSERT INTO matches (id, date, division_id, opponent_id, status, current_period, clock_elapsed_seconds, clock_paused, clock_updated_at, current_possession, home_score, away_score, started_at, finished_at) VALUES
    ('24a0cbdc-4667-4099-b16f-abc64f388345', '2026-10-17 16:07:00.000', '11111111-1111-1111-1111-000000000020', '22222222-1111-1111-1111-000000000001', 'FINISHED', 2, 5367, true, '2026-10-17 20:50:50.294', 'OWN', 17, 43, '2026-10-17 19:08:47.833', '2026-10-17 20:50:50.470'),
    ('11111111-1111-1111-1111-000000000040', '2026-10-18 16:00:00.000', '11111111-1111-1111-1111-000000000020', '22222222-1111-1111-1111-000000000001', 'FINISHED', 2, 85973, true, '2026-10-18 16:58:10.369', 'OPPONENT', 3, 0, '2026-10-17 17:05:11.270', '2026-10-17 19:05:57.168');


-- =========================================
-- EVENT_TYPES (Catálogo Estándar de Tipos de Eventos, v3)
-- =========================================
-- template_event_fields es un ARRAY ORDENADO de campos:
--   key        identificador estable (clave dentro de events.attributes)
--   label      texto a mostrar
--   type       select | number | boolean
--   phase      'live' -> se pide al cargar el evento (un paso del modal) | 'post' -> se completa después, con el video
--   required   en 'live' es obligatorio (solo los number/slider pueden omitirse)
--   options    [{value, label, possession?}] solo para select; possession (KEEP | ACTOR | OTHER) define la
--              posesión resultante cuando se elige esa opción (pisa possession_after del tipo)
--   min/max/default   obligatorios en number (slider)
--   effects    solo boolean: "scoring" (si es false no suma puntos), "possession" (si es false la posesión no cambia)
--   trueLabel/falseLabel   textos de los botones de un boolean
--   followUps (en una opción) | follow_up_choices (en el tipo): lista de {code, label?, preset?}; al guardar el evento
--              se muestra una botonera con esos eventos (más «Nada más»). preset pre-llena campos en vivo del evento elegido
--              y salta ese paso. El equipo del evento elegido se resuelve con la posesión ya actualizada (actor).
--   zone_rule (jsonb, opcional) zonas de la cancha donde puede ocurrir el tipo, vistas desde el equipo que ejecuta el evento:
--              columns = columnas permitidas (1 = in-goal propio ... 6 = in-goal rival), rows = filas permitidas (1 izquierda, 2 centro, 3 derecha),
--              rowFrom = clave del atributo (left | center | right) de la que sale la fila. Un eje con un único valor queda fijo;
--              si no, sale del tramo del partido. Sin zone_rule el tipo no tiene restricción (se carga con los UPDATE de abajo).
-- Reglas del catálogo:
--   * Máximo 2 toques por evento en el modal: jugador (si requires_player) + 1 campo 'live'.
--   * Un solo tipo por acción; el resultado va en un campo, no en tipos duplicados.
--   * actor decide qué equipo se asigna: ATTACKING = el que tiene la pelota, DEFENDING = el otro, CHOOSE = el analista elige.
--   * Claves reservadas en attributes: playerNumber.
--   * Turnovers: 'Turnover ganado' (forzado, se acredita a quien lo gana) y 'Error de manejo' (no forzado, se carga a quien lo pierde).
--     Un turnover se registra una sola vez; los resultados de Maul/Scrum/Line-out ya cambian la posesión por sí solos.
-- Ajustes post piloto (v3.1): se quitó ENTRY_22; Kick H errado ya no conserva la posesión; Amarilla sin opciones en vivo (motivo en post);
--   Patada en juego 'Directa afuera' y '50/22' lanzan el line-out; Penal / Infracción con más motivos en el post;
--   penales de Scrum y Line-out lanzan Penal / Infracción con preset (scrum_illegal / lineout_foul);
--   Scrum y Line-out quedan con 4 opciones (Ganado, Perdido, Penal a favor, Penal en contra);
--   eventos legacy ...119 (Error de manejo) y ...121 (Otro cambio de posesión) migrados a TURNOVER_WON con el equipo invertido
--   (antes se acreditaban a quien perdía la pelota, ahora a quien la gana).
-- Pendientes: Cambio sin campos (cambia la lista de jugadores en cancha); elegir el evento siguiente tras un penal.

INSERT INTO event_types
(id, code, name, group_name, category, is_scoring, points,
 requires_player, is_active, show_in_palette, follow_up_event_type_id, actor, possession_after, follow_up_choices, template_event_fields, stat_view, created_at)
VALUES
(
    '550e8400-e29b-41d4-a716-446655440101',
    'TRY',
    'Try',
    'Puntuación',
    'ATTACK',
    true,
    5,
    true,
    true,
    true,
    '550e8400-e29b-41d4-a716-446655440102',
    'ATTACKING',
    'KEEP',
    $$[]$$::jsonb,
    $$[
      {
        "key": "zone",
        "label": "Zona de apoyo",
        "type": "select",
        "phase": "live",
        "required": true,
        "options": [
          {
            "value": "left",
            "label": "Izquierda"
          },
          {
            "value": "center",
            "label": "Centro"
          },
          {
            "value": "right",
            "label": "Derecha"
          }
        ]
      }
    ]$$::jsonb,
    $$["basic", "intermediate"]$$::jsonb,
    CURRENT_TIMESTAMP
),
(
    '550e8400-e29b-41d4-a716-446655440102',
    'CONVERSION',
    'Conversión',
    'Puntuación',
    'ATTACK',
    true,
    2,
    true,
    true,
    false,
    NULL,
    'ATTACKING',
    'OTHER',
    $$[]$$::jsonb,
    $$[
      {
        "key": "wasSuccessful",
        "label": "Resultado",
        "type": "boolean",
        "phase": "live",
        "required": true,
        "effects": [
          "scoring"
        ],
        "trueLabel": "Convertido",
        "falseLabel": "Errado"
      },
      {
        "key": "distanceMeters",
        "label": "Distancia (m)",
        "type": "number",
        "phase": "post",
        "required": false,
        "min": 0,
        "max": 80
      },
      {
        "key": "zone",
        "label": "Zona de patada",
        "type": "select",
        "phase": "post",
        "required": false,
        "options": [
          {
            "value": "left",
            "label": "Izquierda"
          },
          {
            "value": "center",
            "label": "Centro"
          },
          {
            "value": "right",
            "label": "Derecha"
          }
        ]
      }
    ]$$::jsonb,
    $$["basic", "intermediate"]$$::jsonb,
    CURRENT_TIMESTAMP
),
(
    '550e8400-e29b-41d4-a716-446655440103',
    'PENALTY_TRY',
    'Try penal',
    'Puntuación',
    'ATTACK',
    true,
    7,
    false,
    true,
    true,
    NULL,
    'ATTACKING',
    'OTHER',
    $$[]$$::jsonb,
    $$[
      {
        "key": "reason",
        "label": "Causa de sanción",
        "type": "select",
        "phase": "post",
        "required": false,
        "options": [
          {
            "value": "scrum_collapse",
            "label": "Derrumbe de scrum"
          },
          {
            "value": "maul_collapse",
            "label": "Derrumbe de maul"
          },
          {
            "value": "high_tackle_ingoal",
            "label": "Tackle alto / Infracción en ingoal"
          },
          {
            "value": "deliberate_knockon",
            "label": "Knock-on intencional"
          }
        ]
      }
    ]$$::jsonb,
    $$["basic", "intermediate"]$$::jsonb,
    CURRENT_TIMESTAMP
),
(
    '550e8400-e29b-41d4-a716-446655440104',
    'PENALTY_KICK',
    'Kick H (Penal a palos)',
    'Puntuación',
    'ATTACK',
    true,
    3,
    true,
    true,
    false,
    NULL,
    'ATTACKING',
    'OTHER',
    $$[]$$::jsonb,
    $$[
      {
        "key": "wasSuccessful",
        "label": "Resultado",
        "type": "boolean",
        "phase": "live",
        "required": true,
        "effects": [
          "scoring"
        ],
        "trueLabel": "Convertido",
        "falseLabel": "Errado"
      },
      {
        "key": "distanceMeters",
        "label": "Distancia (m)",
        "type": "number",
        "phase": "post",
        "required": false,
        "min": 0,
        "max": 80
      },
      {
        "key": "zone",
        "label": "Zona de patada",
        "type": "select",
        "phase": "post",
        "required": false,
        "options": [
          {
            "value": "left",
            "label": "Izquierda"
          },
          {
            "value": "center",
            "label": "Centro"
          },
          {
            "value": "right",
            "label": "Derecha"
          }
        ]
      }
    ]$$::jsonb,
    $$["basic", "intermediate"]$$::jsonb,
    CURRENT_TIMESTAMP
),
(
    '550e8400-e29b-41d4-a716-446655440105',
    'DROP_GOAL',
    'Drop goal',
    'Puntuación',
    'ATTACK',
    true,
    3,
    false,
    true,
    true,
    NULL,
    'ATTACKING',
    'OTHER',
    $$[]$$::jsonb,
    $$[
      {
        "key": "wasSuccessful",
        "label": "Resultado",
        "type": "boolean",
        "phase": "live",
        "required": true,
        "effects": [
          "scoring",
          "possession"
        ],
        "trueLabel": "Convertido",
        "falseLabel": "Errado"
      },
      {
        "key": "distanceMeters",
        "label": "Distancia (m)",
        "type": "number",
        "phase": "post",
        "required": false,
        "min": 0,
        "max": 80
      }
    ]$$::jsonb,
    $$["basic", "intermediate"]$$::jsonb,
    CURRENT_TIMESTAMP
),
(
    '550e8400-e29b-41d4-a716-446655440106',
    'CARRY',
    'Acarreo (Carry)',
    'Ataque',
    'ATTACK',
    false,
    0,
    false,
    true,
    false,
    NULL,
    'ATTACKING',
    'KEEP',
    $$[]$$::jsonb,
    $$[
      {
        "key": "metersGained",
        "label": "Metros ganados",
        "type": "number",
        "phase": "post",
        "required": false,
        "min": 0,
        "max": 50
      },
      {
        "key": "defendersBeaten",
        "label": "Defensores eludidos",
        "type": "number",
        "phase": "post",
        "required": false,
        "default": 0,
        "min": 0,
        "max": 6
      }
    ]$$::jsonb,
    $$[]$$::jsonb,
    CURRENT_TIMESTAMP
),
(
    '550e8400-e29b-41d4-a716-446655440107',
    'PASS_OFFLOAD',
    'Pase / Offload',
    'Ataque',
    'ATTACK',
    false,
    0,
    true,
    true,
    false,
    NULL,
    'ATTACKING',
    'KEEP',
    $$[]$$::jsonb,
    $$[
      {
        "key": "passType",
        "label": "Tipo de pase",
        "type": "select",
        "phase": "live",
        "required": true,
        "options": [
          {
            "value": "standard",
            "label": "Pase simple"
          },
          {
            "value": "offload",
            "label": "Offload en contacto"
          },
          {
            "value": "skip",
            "label": "Pase salteado"
          }
        ]
      },
      {
        "key": "isBadPass",
        "label": "Pase comprometido / impreciso",
        "type": "boolean",
        "phase": "post",
        "required": false
      }
    ]$$::jsonb,
    $$[]$$::jsonb,
    CURRENT_TIMESTAMP
),
(
    '550e8400-e29b-41d4-a716-446655440108',
    'RUCK_OFFENSIVE',
    'Ruck ofensivo',
    'Ataque',
    'ATTACK',
    false,
    0,
    false,
    true,
    true,
    NULL,
    'ATTACKING',
    'KEEP',
    $$[]$$::jsonb,
    $$[
      {
        "key": "speed",
        "label": "Velocidad de reciclaje",
        "type": "select",
        "phase": "post",
        "required": false,
        "options": [
          {
            "value": "fast",
            "label": "Rápido (<3s)"
          },
          {
            "value": "medium",
            "label": "Medio (3-6s)"
          },
          {
            "value": "slow",
            "label": "Lento (>6s)"
          }
        ]
      }
    ]$$::jsonb,
    $$[]$$::jsonb,
    CURRENT_TIMESTAMP
),
(
    '550e8400-e29b-41d4-a716-446655440109',
    'LINEBREAK',
    'Quiebre de línea',
    'Ataque',
    'ATTACK',
    false,
    0,
    false,
    true,
    true,
    NULL,
    'ATTACKING',
    'KEEP',
    $$[]$$::jsonb,
    $$[
      {
        "key": "metersGained",
        "label": "Metros netos",
        "type": "number",
        "phase": "post",
        "required": false,
        "min": 0,
        "max": 100
      }
    ]$$::jsonb,
    $$["intermediate"]$$::jsonb,
    CURRENT_TIMESTAMP
),
(
    '550e8400-e29b-41d4-a716-446655440110',
    'KICK_IN_PLAY',
    'Patada en juego',
    'Ataque',
    'ATTACK',
    false,
    0,
    false,
    true,
    true,
    NULL,
    'ATTACKING',
    'OTHER',
    $$[]$$::jsonb,
    $$[
      {
        "key": "kickType",
        "label": "Tipo de patada",
        "type": "select",
        "phase": "post",
        "required": true,
        "options": [
          {
            "value": "tactical",
            "label": "Táctica / Despeje"
          },
          {
            "value": "up_under",
            "label": "A cargar (Sombrerito/Bombazo)"
          },
          {
            "value": "grubber",
            "label": "Rastrón"
          },
          {
            "value": "50_22",
            "label": "Intento 50/22"
          }
        ]
      },
      {
        "key": "outcome",
        "label": "Resultado",
        "type": "select",
        "phase": "live",
        "required": false,
        "options": [
          {
            "value": "opp_possession",
            "label": "Perdida",
            "possession": "OTHER"
          },
          {
            "value": "retained",
            "label": "Recuperada",
            "possession": "KEEP"
          },

          {
            "value": "out_in_full",
            "label": "Directa afuera",
            "possession": "OTHER",
            "followUps": [
              {
                "code": "LINEOUT"
              }
            ]
          },
          {
            "value": "50/22",
            "label": "50/22",
            "possession": "KEEP",
            "followUps": [
              {
                "code": "LINEOUT"
              }
            ]
          }
        ]
      }
    ]$$::jsonb,
    $$["intermediate"]$$::jsonb,
    CURRENT_TIMESTAMP
),
(
    '550e8400-e29b-41d4-a716-446655440128',
    'KICK_TO_TOUCH',
    'Patada a touch',
    'Ataque',
    'ATTACK',
    false,
    0,
    false,
    true,
    false,
    NULL,
    'ATTACKING',
    'KEEP',
    $$[]$$::jsonb,
    $$[
      {
        "key": "kind",
        "label": "Tipo",
        "type": "select",
        "phase": "live",
        "required": true,
        "options": [
          {
            "value": "penalty_touch",
            "label": "Sale directo",
            "possession": "KEEP",
            "followUps":[
              {
                "code": "LINEOUT"
              }
            ]
          },
          {
            "value": "lost_onw",
            "label": "Recupera rival",
            "possession": "OTHER"
          },
          {
            "value": "won",
            "label": "Recupera propio",
            "possession": "KEEP"
          }
        ]
      }
    ]$$::jsonb,
    $$["intermediate"]$$::jsonb,
    CURRENT_TIMESTAMP
),
(
    '550e8400-e29b-41d4-a716-446655440111',
    'SCRUM',
    'Scrum',
    'Juego Fijo',
    'NEUTRAL',
    false,
    0,
    false,
    true,
    true,
    NULL,
    'ATTACKING',
    'KEEP',
    $$[]$$::jsonb,
    $$[
      {
        "key": "scrumResult",
        "label": "Resultado",
        "type": "select",
        "phase": "live",
        "required": true,
        "options": [
          {
            "value": "won_clean",
            "label": "Ganado",
            "possession": "KEEP"
          },
          {
            "value": "lost_own",
            "label": "Perdido",
            "possession": "OTHER"
          },
          {
            "value": "penalty_for",
            "label": "Penal a favor",
            "possession": "KEEP",
            "followUps": [
              {
                "code": "PENALTY_CONCEDED",
                "team": "OTHER",
                "preset": {
                  "penaltyType": "scrum_illegal"
                }
              }
            ]
          },
          {
            "value": "penalty_against",
            "label": "Penal en contra",
            "possession": "OTHER",
            "followUps": [
              {
                "code": "PENALTY_CONCEDED",
                "team": "SAME",
                "preset": {
                  "penaltyType": "scrum_illegal"
                }
              }
            ]
          }
        ]
      }
    ]$$::jsonb,
    $$["intermediate"]$$::jsonb,
    CURRENT_TIMESTAMP
),
(
    '550e8400-e29b-41d4-a716-446655440112',
    'LINEOUT',
    'Line-out',
    'Juego Fijo',
    'NEUTRAL',
    false,
    0,
    false,
    true,
    true,
    NULL,
    'ATTACKING',
    'KEEP',
    $$[]$$::jsonb,
    $$[
      {
        "key": "lineResult",
        "label": "Resultado",
        "type": "select",
        "phase": "live",
        "required": true,
        "options": [
          {
            "value": "won_clean",
            "label": "Ganado",
            "possession": "KEEP"
          },
          {
            "value": "lost",
            "label": "Perdido",
            "possession": "OTHER"
          },
          {
            "value": "penalty_for",
            "label": "Penal a favor",
            "possession": "KEEP",
            "followUps": [
              {
                "code": "PENALTY_CONCEDED",
                "team": "OTHER",
                "preset": {
                  "penaltyType": "lineout_foul"
                }
              }
            ]
          },
          {
            "value": "penalty_against",
            "label": "Penal en contra",
            "possession": "OTHER",
            "followUps": [
              {
                "code": "PENALTY_CONCEDED",
                "team": "SAME",
                "preset": {
                  "penaltyType": "lineout_foul"
                }
              }
            ]
          }
        ]
      },
      {
        "key": "jumpZone",
        "label": "Zona de salto",
        "type": "select",
        "phase": "post",
        "required": false,
        "options": [
          {
            "value": "front",
            "label": "Adelante (2)"
          },
          {
            "value": "middle",
            "label": "Medio (4)"
          },
          {
            "value": "back",
            "label": "Atrás (6)"
          }
        ]
      },
      {
        "key": "isMaulFormed",
        "label": "Generó Maul",
        "type": "boolean",
        "phase": "post",
        "required": false
      }
    ]$$::jsonb,
    $$["intermediate"]$$::jsonb,
    CURRENT_TIMESTAMP
),
(
    '550e8400-e29b-41d4-a716-446655440113',
    'RESTART_KICK',
    'Kick-off / Salida',
    'Juego Fijo',
    'NEUTRAL',
    false,
    0,
    true,
    true,
    true,
    NULL,
    'ATTACKING',
    'KEEP',
    $$[]$$::jsonb,
    $$[
      {
        "key": "outcome",
        "label": "Resultado",
        "type": "select",
        "phase": "live",
        "required": true,
        "options": [
          {
            "value": "received_clean",
            "label": "Recibida limpia",
            "possession": "OTHER"
          },
          {
            "value": "regained_attack",
            "label": "Recuperada",
            "possession": "KEEP"
          },
          {
            "value": "error_out_full",
            "label": "Directa afuera / No pasa 10m",
            "possession": "OTHER"
          }
        ]
      },
      {
        "key": "kickType",
        "label": "Tipo de salida",
        "type": "select",
        "phase": "post",
        "required": false,
        "options": [
          {
            "value": "halfway_start",
            "label": "Salida de centro (Mitad de cancha)"
          },
          {
            "value": "22m_drop",
            "label": "Salida de 22m"
          },
          {
            "value": "goalline_drop",
            "label": "Drop-out línea de ingol"
          }
        ]
      }
    ]$$::jsonb,
    $$[]$$::jsonb,
    CURRENT_TIMESTAMP
),
(
    '550e8400-e29b-41d4-a716-446655440114',
    'MAUL',
    'Maul',
    'Juego Fijo',
    'ATTACK',
    false,
    0,
    false,
    true,
    false,
    NULL,
    'ATTACKING',
    'KEEP',
    $$[]$$::jsonb,
    $$[
      {
        "key": "maulOutcome",
        "label": "Resultado del Maul",
        "type": "select",
        "phase": "live",
        "required": true,
        "options": [
          {
            "value": "advanced",
            "label": "Avanzó / Dominante",
            "possession": "KEEP"
          },
          {
            "value": "stopped",
            "label": "Detenido / Trabado",
            "possession": "KEEP"
          },
          {
            "value": "turnover_held",
            "label": "Pelota trabada (Turnover)",
            "possession": "OTHER"
          }
        ]
      },
      {
        "key": "metersGained",
        "label": "Metros de avance",
        "type": "number",
        "phase": "post",
        "required": false,
        "min": 0,
        "max": 30
      }
    ]$$::jsonb,
    $$[]$$::jsonb,
    CURRENT_TIMESTAMP
),
(
    '550e8400-e29b-41d4-a716-446655440129',
    'QUICK_PLAY',
    'Jugada rapida',
    'Juego Fijo',
    'ATTACK',
    false,
    0,
    false,
    true,
    false,
    NULL,
    'ATTACKING',
    'KEEP',
    $$[]$$::jsonb,
    $$[
      {
        "key": "quickPlayOutcome",
        "label": "Resultado",
        "type": "boolean",
        "phase": "post",
        "required": false,
        "trueLabel": "Postivo",
        "falseLabel": "Negativo"
      }
    ]$$::jsonb,
    $$["intermediate"]$$::jsonb,
    CURRENT_TIMESTAMP
),
(
    '550e8400-e29b-41d4-a716-446655440115',
    'TACKLE_MADE',
    'Tackle completado',
    'Defensa',
    'DEFENSE',
    false,
    0,
    true,
    true,
    false,
    NULL,
    'DEFENDING',
    'KEEP',
    $$[]$$::jsonb,
    $$[
      {
        "key": "assisted",
        "label": "Tackle asistido (2° defensor)",
        "type": "boolean",
        "phase": "post",
        "required": false
      }
    ]$$::jsonb,
    $$[]$$::jsonb,
    CURRENT_TIMESTAMP
),
(
    '550e8400-e29b-41d4-a716-446655440116',
    'TACKLE_MISSED',
    'Tackle fallado',
    'Defensa',
    'DEFENSE',
    false,
    0,
    true,
    true,
    false,
    NULL,
    'DEFENDING',
    'KEEP',
    $$[]$$::jsonb,
    $$[
      {
        "key": "failReason",
        "label": "Motivo",
        "type": "select",
        "phase": "post",
        "required": false,
        "options": [
          {
            "value": "missed",
            "label": "No llegó / Apenas tocó"
          },
          {
            "value": "bounced_off",
            "label": "Lo superaron con físico"
          },
          {
            "value": "late",
            "label": "Llegó tarde"
          },
          {
            "value": "footwork",
            "label": "Engañado por amague"
          }
        ]
      }
    ]$$::jsonb,
    $$[]$$::jsonb,
    CURRENT_TIMESTAMP
),
(
    '550e8400-e29b-41d4-a716-446655440117',
    'TURNOVER_WON',
    'Turnover',
    'Cambio de Posesión',
    'NEUTRAL',
    false,
    0,
    false,
    true,
    true,
    NULL,
    'DEFENDING',
    'ACTOR',
    $$[]$$::jsonb,
    $$[
      {
        "key": "stealType",
        "label": "Cómo lo ganó",
        "type": "select",
        "phase": "post",
        "required": true,
        "options": [
          {
            "value": "jackal_ruck",
            "label": "Pesca en Ruck"
          },
          {
            "value": "rip_standing",
            "label": "Arrancón de pelota"
          },
          {
            "value": "interception",
            "label": "Intercepción"
          },
          {
            "value": "other",
            "label": "Otro"
          },
          {
            "value": "knock_on",
            "label": "Knock-on (Caída adelante)"
          },
          {
            "value": "forward_pass",
            "label": "Pase hacia adelante"
          },
          {
            "value": "dropped_unforced",
            "label": "Caída no forzada"
          },
          {
            "value": "pushed_touch",
            "label": "Empujado a touch"
          },
          {
            "value": "held_ingoal",
            "label": "Trabado en ingoal"
          },
          {
            "value": "offensive_penalty",
            "label": "Penal del atacante"
          }
        ]
      }
    ]$$::jsonb,
    $$["intermediate"]$$::jsonb,
    CURRENT_TIMESTAMP
),
(
    '550e8400-e29b-41d4-a716-446655440120',
    'KICK_RECEPTION',
    'Recepción de patada',
    'Cambio de Posesión',
    'NEUTRAL',
    false,
    0,
    false,
    true,
    false,
    NULL,
    'ATTACKING',
    'KEEP',
    $$[]$$::jsonb,
    $$[
      {
        "key": "receptionQuality",
        "label": "Resultado recepción",
        "type": "select",
        "phase": "live",
        "required": true,
        "options": [
          {
            "value": "clean_mark",
            "label": "Atrapada limpia / Mark",
            "possession": "KEEP"
          },
          {
            "value": "contested_won",
            "label": "Disputada en aire (Ganada)",
            "possession": "KEEP"
          },
          {
            "value": "fumbled",
            "label": "Pelota suelta / Error",
            "possession": "OTHER"
          }
        ]
      }
    ]$$::jsonb,
    $$[]$$::jsonb,
    CURRENT_TIMESTAMP
),
(
    '550e8400-e29b-41d4-a716-446655440122',
    'PENALTY_CONCEDED',
    'Penal / Infracción',
    'Neutro',
    'NEUTRAL',
    false,
    0,
    false,
    true,
    true,
    NULL,
    'CHOOSE',
    'OTHER',
    $$[{"code": "PENALTY_KICK"}, {"code": "KICK_TO_TOUCH"}, {"code": "SCRUM"}, {"code": "QUICK_PLAY"}]$$::jsonb,
    $$[
      {
        "key": "penaltyType",
        "label": "Infracción",
        "type": "select",
        "phase": "post",
        "required": true,
        "options": [
          {
            "value": "offside",
            "label": "Offside"
          },
          {
            "value": "holding_on",
            "label": "Retención (No libera)"
          },
          {
            "value": "high_tackle",
            "label": "Tackle alto"
          },
          {
            "value": "scrum_illegal",
            "label": "Infracción Scrum"
          },
          {
            "value": "lineout_foul",
            "label": "Infracción Line-out"
          },
          {
            "value": "side_entry",
            "label": "Entrada de costado en Ruck"
          },
          {
            "value": "not_rolling_away",
            "label": "No rueda ni se aleja (Ruck)"
          },
          {
            "value": "maul_illegal",
            "label": "Derrumbe / infracción en Maul"
          },
          {
            "value": "hands_in_ruck",
            "label": "Manos en el ruck / juega la pelota en el suelo"
          },
          {
            "value": "dangerous_tackle",
            "label": "Tackle peligroso (sin brazos / en el aire)"
          },
          {
            "value": "late_tackle",
            "label": "Tackle tardío"
          },
          {
            "value": "obstruction",
            "label": "Obstrucción"
          },
          {
            "value": "deliberate_knock_on",
            "label": "Knock-on intencional"
          },
          {
            "value": "not_ten_meters",
            "label": "No retrocede los 10 m"
          },
          {
            "value": "foul_play",
            "label": "Juego sucio / peligroso"
          },
          {
            "value": "dissent",
            "label": "Protesta / Falta de respeto"
          },
          {
            "value": "time_wasting",
            "label": "Demora de juego"
          },
          {
            "value": "other",
            "label": "Otro"
          }
        ]
      }
    ]$$::jsonb,
    $$["basic", "intermediate"]$$::jsonb,
    CURRENT_TIMESTAMP
),
(
    '550e8400-e29b-41d4-a716-446655440123',
    'YELLOW_CARD',
    'Tarjeta Amarilla',
    'Neutro',
    'NEUTRAL',
    false,
    0,
    true,
    true,
    true,
    NULL,
    'CHOOSE',
    'KEEP',
    $$[]$$::jsonb,
    $$[
      {
        "key": "reason",
        "label": "Motivo",
        "type": "select",
        "phase": "post",
        "required": false,
        "options": [
          {
            "value": "high_tackle",
            "label": "Tackle alto / peligroso"
          },
          {
            "value": "repeated_infringements",
            "label": "Infracciones reiteradas"
          },
          {
            "value": "cynical_foul",
            "label": "Falta cínica / Cortó ataque claro"
          },
          {
            "value": "dissent",
            "label": "Protesta / Falta de respeto"
          }
        ]
      },
      {
        "key": "durationMinutes",
        "label": "Minutos de suspensión",
        "type": "number",
        "phase": "post",
        "required": false,
        "default": 10,
        "min": 1,
        "max": 20
      }
    ]$$::jsonb,
    $$["basic", "intermediate"]$$::jsonb,
    CURRENT_TIMESTAMP
),
(
    '550e8400-e29b-41d4-a716-446655440124',
    'RED_CARD',
    'Tarjeta Roja / Expulsión',
    'Neutro',
    'NEUTRAL',
    false,
    0,
    true,
    true,
    true,
    NULL,
    'CHOOSE',
    'KEEP',
    $$[]$$::jsonb,
    $$[
      {
        "key": "reason",
        "label": "Motivo",
        "type": "select",
        "phase": "post",
        "required": true,
        "options": [
          {
            "value": "foul_play",
            "label": "Juego sucio grave"
          },
          {
            "value": "head_contact",
            "label": "Contacto directo a la cabeza"
          },
          {
            "value": "second_yellow",
            "label": "Segunda amarilla"
          }
        ]
      }
    ]$$::jsonb,
    $$["basic", "intermediate"]$$::jsonb,
    CURRENT_TIMESTAMP
),
(
    '550e8400-e29b-41d4-a716-446655440125',
    'INJURY',
    'Lesión',
    'Neutro',
    'NEUTRAL',
    false,
    0,
    true,
    true,
    false,
    NULL,
    'CHOOSE',
    'KEEP',
    $$[]$$::jsonb,
    $$[
      {
        "key": "injuryArea",
        "label": "Zona del cuerpo",
        "type": "select",
        "phase": "post",
        "required": false,
        "options": [
          {
            "value": "head",
            "label": "Cabeza / Protocolo HIA"
          },
          {
            "value": "shoulder",
            "label": "Hombro"
          },
          {
            "value": "knee",
            "label": "Rodilla"
          },
          {
            "value": "ankle",
            "label": "Tobillo"
          },
          {
            "value": "muscle",
            "label": "Muscular"
          }
        ]
      }
    ]$$::jsonb,
    $$["basic", "intermediate"]$$::jsonb,
    CURRENT_TIMESTAMP
),
(
    '550e8400-e29b-41d4-a716-446655440126',
    'SUBSTITUTION',
    'Cambio / Sustitución',
    'Neutro',
    'NEUTRAL',
    false,
    0,
    false,
    true,
    true,
    NULL,
    'CHOOSE',
    'KEEP',
    $$[]$$::jsonb,
    $$[
      {"key":"playerOutNumber","label":"Jugador que sale","type":"number","phase":"live","required":true,"min":1},
      {"key":"playerInNumber","label":"Jugador que entra","type":"number","phase":"live","required":true,"min":1}
    ]$$::jsonb,
    $$["basic", "intermediate"]$$::jsonb,
    CURRENT_TIMESTAMP
);

-- zone_rule: zonas de la cancha donde puede ocurrir cada tipo (ver «zone_rule» en la cabecera del catálogo)
UPDATE event_types SET zone_rule = '{"columns":[6],"rowFrom":"zone"}'::jsonb WHERE code = 'TRY';
UPDATE event_types SET zone_rule = '{"columns":[6],"rows":[2]}'::jsonb WHERE code = 'PENALTY_TRY';
UPDATE event_types SET zone_rule = '{"columns":[2,3,4,5],"rowFrom":"zone"}'::jsonb WHERE code IN ('CONVERSION', 'PENALTY_KICK');
UPDATE event_types SET zone_rule = '{"columns":[2,3,4,5]}'::jsonb WHERE code IN ('DROP_GOAL', 'SCRUM', 'LINEOUT', 'MAUL', 'RUCK_OFFENSIVE', 'QUICK_PLAY');
-- Kick-off / Salida: de centro (col. 3-4), de 22m (2-3) o drop-out de ingol (1-2); nunca desde el campo rival
UPDATE event_types SET zone_rule = '{"columns":[1,2,3,4]}'::jsonb WHERE code = 'RESTART_KICK';


-- =========================================
-- MATCHES_PLAYERS (convocatoria: 46 filas = 2 partidos x 23; los 4 jugadores adicionales no integran estas convocatorias)
-- =========================================

INSERT INTO matches_players (id, role, division_id, match_id, slot_order, number, field_status, field_slot) VALUES
    ('4d99b258-692a-4245-920e-b548abb15283', 'TITULAR', '11111111-1111-1111-1111-000000000201', '11111111-1111-1111-1111-000000000040', 0, 1, 'EN_CANCHA', 1),
    ('f8c5e86b-e6f6-4c6b-87b4-c0b926fdd81d', 'TITULAR', '11111111-1111-1111-1111-000000000202', '11111111-1111-1111-1111-000000000040', 1, 2, 'EN_CANCHA', 2),
    ('3fb92fbb-6303-487b-aeb4-3395b24bf0fa', 'TITULAR', '11111111-1111-1111-1111-000000000203', '11111111-1111-1111-1111-000000000040', 2, 3, 'EN_CANCHA', 3),
    ('aa675eb8-be06-47ec-aa79-95336e847a79', 'TITULAR', '11111111-1111-1111-1111-000000000204', '11111111-1111-1111-1111-000000000040', 3, 4, 'EN_CANCHA', 4),
    ('a86a6ec8-f12f-47ed-9165-d705527c93e0', 'TITULAR', '11111111-1111-1111-1111-000000000205', '11111111-1111-1111-1111-000000000040', 4, 5, 'EN_CANCHA', 5),
    ('a17efbda-9ed4-46e4-9c40-7c0e52523e5e', 'TITULAR', '11111111-1111-1111-1111-000000000206', '11111111-1111-1111-1111-000000000040', 5, 6, 'EN_CANCHA', 6),
    ('0899126b-6186-4aae-b485-659bb83728ba', 'TITULAR', '11111111-1111-1111-1111-000000000207', '11111111-1111-1111-1111-000000000040', 6, 7, 'EN_CANCHA', 7),
    ('05537938-d4f4-4be3-b41e-89819205a0a9', 'TITULAR', '11111111-1111-1111-1111-000000000208', '11111111-1111-1111-1111-000000000040', 7, 8, 'EN_CANCHA', 8),
    ('4563b25c-c0c6-4427-8435-31e6e4db474e', 'TITULAR', '11111111-1111-1111-1111-000000000209', '11111111-1111-1111-1111-000000000040', 8, 9, 'EN_CANCHA', 9),
    ('f4f949d6-4ed1-411f-8065-48eed7c47145', 'TITULAR', '11111111-1111-1111-1111-000000000210', '11111111-1111-1111-1111-000000000040', 9, 10, 'EN_CANCHA', 10),
    ('234d98b2-c677-49f7-95f2-083a1a69662e', 'TITULAR', '11111111-1111-1111-1111-000000000211', '11111111-1111-1111-1111-000000000040', 10, 11, 'EN_CANCHA', 11),
    ('5fe97c71-8406-4a6f-9e8c-d225cb8ad15c', 'TITULAR', '11111111-1111-1111-1111-000000000212', '11111111-1111-1111-1111-000000000040', 11, 12, 'EN_CANCHA', 12),
    ('40fdae8d-90f1-4bf6-b11e-ce174fb56a8f', 'TITULAR', '11111111-1111-1111-1111-000000000213', '11111111-1111-1111-1111-000000000040', 12, 13, 'EN_CANCHA', 13),
    ('f60659b9-3e27-4d58-94dd-6c96d0bceff2', 'TITULAR', '11111111-1111-1111-1111-000000000214', '11111111-1111-1111-1111-000000000040', 13, 14, 'EN_CANCHA', 14),
    ('69e7f239-1d64-40cd-a8b3-c80c2311c3db', 'TITULAR', '11111111-1111-1111-1111-000000000215', '11111111-1111-1111-1111-000000000040', 14, 15, 'EN_CANCHA', 15),
    ('1456c7cf-97f9-47ec-b863-9f2795d18adc', 'SUPLENTE', '11111111-1111-1111-1111-000000000216', '11111111-1111-1111-1111-000000000040', 0, 16, 'EN_BANCO', NULL),
    ('47923278-c0b9-437c-ad01-80173786ffce', 'SUPLENTE', '11111111-1111-1111-1111-000000000217', '11111111-1111-1111-1111-000000000040', 1, 17, 'EN_BANCO', NULL),
    ('cfea35cc-f7f3-4be4-abdf-072fdf2e9e66', 'SUPLENTE', '11111111-1111-1111-1111-000000000218', '11111111-1111-1111-1111-000000000040', 2, 18, 'EN_BANCO', NULL),
    ('33f7219c-03c9-4326-8f2f-828668d9184a', 'SUPLENTE', '11111111-1111-1111-1111-000000000219', '11111111-1111-1111-1111-000000000040', 3, 19, 'EN_BANCO', NULL),
    ('a81f6ed8-1af7-4970-a6d6-ccbf860d44ae', 'SUPLENTE', '11111111-1111-1111-1111-000000000220', '11111111-1111-1111-1111-000000000040', 4, 20, 'EN_BANCO', NULL),
    ('13bef1b5-9523-4c98-9e90-981f9271fe95', 'SUPLENTE', '11111111-1111-1111-1111-000000000221', '11111111-1111-1111-1111-000000000040', 5, 21, 'EN_BANCO', NULL),
    ('c861b695-d6de-4698-a709-b0bf9691096e', 'SUPLENTE', '11111111-1111-1111-1111-000000000222', '11111111-1111-1111-1111-000000000040', 6, 22, 'EN_BANCO', NULL),
    ('f6456c6a-402c-4846-8717-5a2b9c03c50c', 'SUPLENTE', '11111111-1111-1111-1111-000000000223', '11111111-1111-1111-1111-000000000040', 7, 23, 'EN_BANCO', NULL),
    ('7cb9b794-6c76-4170-8f4f-ad6c7ca92281', 'TITULAR', '11111111-1111-1111-1111-000000000201', '24a0cbdc-4667-4099-b16f-abc64f388345', 0, 1, 'EN_CANCHA', 1),
    ('d27b5d34-715a-47ee-9e62-dae653e255a6', 'TITULAR', '11111111-1111-1111-1111-000000000202', '24a0cbdc-4667-4099-b16f-abc64f388345', 1, 2, 'EN_CANCHA', 2),
    ('e49abde5-3073-4028-a460-713e7477951b', 'TITULAR', '11111111-1111-1111-1111-000000000203', '24a0cbdc-4667-4099-b16f-abc64f388345', 2, 3, 'EN_CANCHA', 3),
    ('c3ee0e34-2bed-4c96-8304-b65e3e63c254', 'TITULAR', '11111111-1111-1111-1111-000000000204', '24a0cbdc-4667-4099-b16f-abc64f388345', 3, 4, 'EN_CANCHA', 4),
    ('5d78ab30-da1c-4b62-b8c8-7c1089ac5280', 'TITULAR', '11111111-1111-1111-1111-000000000205', '24a0cbdc-4667-4099-b16f-abc64f388345', 4, 5, 'EN_CANCHA', 5),
    ('6802ff65-17aa-41ac-bb72-61c70122c75c', 'TITULAR', '11111111-1111-1111-1111-000000000206', '24a0cbdc-4667-4099-b16f-abc64f388345', 5, 6, 'EN_CANCHA', 6),
    ('bf4ba7f9-c78a-40a2-95d5-7f7843863884', 'TITULAR', '11111111-1111-1111-1111-000000000207', '24a0cbdc-4667-4099-b16f-abc64f388345', 6, 7, 'EN_CANCHA', 7),
    ('a7a81e66-b81c-42f7-9833-8f5728f3c895', 'TITULAR', '11111111-1111-1111-1111-000000000208', '24a0cbdc-4667-4099-b16f-abc64f388345', 7, 8, 'EN_CANCHA', 8),
    ('81918007-c9a9-43a6-be68-77e1e2e8c3d9', 'TITULAR', '11111111-1111-1111-1111-000000000209', '24a0cbdc-4667-4099-b16f-abc64f388345', 8, 9, 'EN_CANCHA', 9),
    ('9a61a507-0993-42e8-a72c-3de4272931d0', 'TITULAR', '11111111-1111-1111-1111-000000000210', '24a0cbdc-4667-4099-b16f-abc64f388345', 9, 10, 'EN_CANCHA', 10),
    ('b2f25cb5-7cd9-436a-94eb-9023edd9b78b', 'TITULAR', '11111111-1111-1111-1111-000000000211', '24a0cbdc-4667-4099-b16f-abc64f388345', 10, 11, 'EN_CANCHA', 11),
    ('c0f37e44-4c52-482f-b095-d4fd162fab1f', 'TITULAR', '11111111-1111-1111-1111-000000000212', '24a0cbdc-4667-4099-b16f-abc64f388345', 11, 12, 'EN_CANCHA', 12),
    ('6df8d25d-5f3f-4435-bef7-efc82a2a0a58', 'TITULAR', '11111111-1111-1111-1111-000000000213', '24a0cbdc-4667-4099-b16f-abc64f388345', 12, 13, 'EN_CANCHA', 13),
    ('f2ca60ee-4042-44d8-8a62-ac974237243e', 'TITULAR', '11111111-1111-1111-1111-000000000214', '24a0cbdc-4667-4099-b16f-abc64f388345', 13, 14, 'EN_CANCHA', 14),
    ('acb0adc4-5468-4a59-ad33-9ad15bb8ab68', 'TITULAR', '11111111-1111-1111-1111-000000000215', '24a0cbdc-4667-4099-b16f-abc64f388345', 14, 15, 'EN_CANCHA', 15),
    ('b48660f6-0f48-4251-9202-4095c32506c2', 'SUPLENTE', '11111111-1111-1111-1111-000000000216', '24a0cbdc-4667-4099-b16f-abc64f388345', 0, 16, 'EN_BANCO', NULL),
    ('11dbea7c-deb1-4e79-b2da-11970948e1b3', 'SUPLENTE', '11111111-1111-1111-1111-000000000217', '24a0cbdc-4667-4099-b16f-abc64f388345', 1, 17, 'EN_BANCO', NULL),
    ('d2955557-c89b-4935-982a-6677e2b16e45', 'SUPLENTE', '11111111-1111-1111-1111-000000000218', '24a0cbdc-4667-4099-b16f-abc64f388345', 2, 18, 'EN_BANCO', NULL),
    ('93bdd4ee-be23-405a-a179-e1756c8aa5a5', 'SUPLENTE', '11111111-1111-1111-1111-000000000219', '24a0cbdc-4667-4099-b16f-abc64f388345', 3, 19, 'EN_BANCO', NULL),
    ('d5eb4604-28df-4b53-89b5-918873b16e86', 'SUPLENTE', '11111111-1111-1111-1111-000000000220', '24a0cbdc-4667-4099-b16f-abc64f388345', 4, 20, 'EN_BANCO', NULL),
    ('964e6586-03f5-4984-963c-99753321317a', 'SUPLENTE', '11111111-1111-1111-1111-000000000221', '24a0cbdc-4667-4099-b16f-abc64f388345', 5, 21, 'EN_BANCO', NULL),
    ('11ea507c-53e0-4aca-9e78-45cecab595fa', 'SUPLENTE', '11111111-1111-1111-1111-000000000222', '24a0cbdc-4667-4099-b16f-abc64f388345', 6, 22, 'EN_BANCO', NULL),
    ('7757e9c1-5a77-4cde-87a1-d7fec4164637', 'SUPLENTE', '11111111-1111-1111-1111-000000000223', '24a0cbdc-4667-4099-b16f-abc64f388345', 7, 23, 'EN_BANCO', NULL);
-- =========================================
-- EVENTS (167 eventos: 152 del partido 24a0cbdc… y 15 del 11111111…0040)
-- =========================================

INSERT INTO events (id, match_id, event_type_id, player_id, period, match_time, absolute_match_time, real_time, team_possession, attributes, origin, active, client_event_id, created_at, synchronized_at) VALUES
    ('0d4ed899-df2b-42d4-bd3d-6a10a27fc871', '11111111-1111-1111-1111-000000000040', '550e8400-e29b-41d4-a716-446655440110', '11111111-1111-1111-1111-000000000105', 1, 65, 65, '2026-10-17 17:06:17.235', 'OWN', '{"kickType": "up_under", "playerNumber": 5}'::jsonb, 'live-capture', true, '489682fd-9ffb-40d4-8c8b-53510ba20da0', '2026-10-17 17:06:17.279', '2026-10-17 17:06:17.274'),
    ('2792bf28-38c9-45eb-aa3e-e9cd2b01b363', '11111111-1111-1111-1111-000000000040', '550e8400-e29b-41d4-a716-446655440110', '11111111-1111-1111-1111-000000000109', 1, 152, 152, '2026-10-17 17:07:43.333', 'OWN', '{"kickType": "tactical", "playerNumber": 9}'::jsonb, 'live-capture', true, 'd02d6d5e-11f3-4898-a231-62d324a771be', '2026-10-17 17:07:43.362', '2026-10-17 17:07:43.360'),
    ('b1977aef-cc8c-4782-83ab-787ae75d284e', '11111111-1111-1111-1111-000000000040', '550e8400-e29b-41d4-a716-446655440110', '11111111-1111-1111-1111-000000000104', 1, 242, 242, '2026-10-17 17:09:13.654', 'OWN', '{"kickType": "up_under", "playerNumber": 4}'::jsonb, 'live-capture', true, 'ac7500ce-6f78-4c91-8fbc-da35d68be631', '2026-10-17 17:09:13.687', '2026-10-17 17:09:13.685'),
    ('51b9a6f4-6196-45af-a068-dde72ad9b34f', '11111111-1111-1111-1111-000000000040', '550e8400-e29b-41d4-a716-446655440110', NULL, 1, 426, 428, '2026-10-17 17:12:19.736', 'OPPONENT',     '{"outcome": "opp_possession"}'::jsonb, 'live-capture', true, '931be833-ca23-415c-9da8-2949e191481c', '2026-10-17 17:12:19.754', '2026-10-17 17:12:19.753'),
    ('5ce7a5ea-722c-4603-9339-528acee5b788', '11111111-1111-1111-1111-000000000040', '550e8400-e29b-41d4-a716-446655440122', NULL, 1, 505, 507, '2026-10-17 17:13:38.458', 'OPPONENT',     '{"penaltyType": "offside"}'::jsonb, 'live-capture', true, 'cd283e88-e286-46f3-bc86-02a1a3e382f4', '2026-10-17 17:13:38.480', '2026-10-17 17:13:38.479'),
    ('3be402d8-cfb2-4420-818d-f056a4d31462', '11111111-1111-1111-1111-000000000040', '550e8400-e29b-41d4-a716-446655440104', '11111111-1111-1111-1111-000000000110', 1, 510, 512, '2026-10-17 17:13:43.349', 'OWN', '{"playerNumber": 10, "wasSuccessful": true}'::jsonb, 'live-capture', true, 'b6a99249-28bb-40b1-a82d-baedb376f6c8', '2026-10-17 17:13:43.375', '2026-10-17 17:13:43.373'),
    ('88654ed2-f72b-4216-b967-25f104567fdd', '11111111-1111-1111-1111-000000000040', '550e8400-e29b-41d4-a716-446655440117', NULL, 1, 520, 522, '2026-10-17 17:13:53.673', 'OWN', NULL, 'live-capture', true, '31d266fd-432a-460d-837d-f77602f57991', '2026-10-17 17:13:53.698', '2026-10-17 17:13:53.697'),
    ('a308d767-4614-4296-9726-948c1a96b639', '11111111-1111-1111-1111-000000000040', '550e8400-e29b-41d4-a716-446655440120', '11111111-1111-1111-1111-000000000112', 1, 529, 530, '2026-10-17 17:14:02.268', 'OWN', '{"playerNumber": 12, "receptionQuality": "contested_won"}'::jsonb, 'live-capture', true, '58bbb5a6-3d35-4db0-a982-1cc9607be30c', '2026-10-17 17:14:02.293', '2026-10-17 17:14:02.291'),
    ('dea5b59b-ba43-4a80-bfd5-b27909590f40', '11111111-1111-1111-1111-000000000040', '550e8400-e29b-41d4-a716-446655440120', '11111111-1111-1111-1111-000000000113', 1, 538, 539, '2026-10-17 17:14:11.255', 'OWN', '{"playerNumber": 13, "receptionQuality": "contested_won"}'::jsonb, 'live-capture', true, '25c0d597-fed8-4230-b56e-1e0c9a313a15', '2026-10-17 17:14:11.283', '2026-10-17 17:14:11.281'),
    ('7ec5264d-abc9-4dce-83e5-b2dd10c57dae', '11111111-1111-1111-1111-000000000040', '550e8400-e29b-41d4-a716-446655440117', NULL, 1, 587, 590, '2026-10-17 17:15:01.337', 'OPPONENT', '{"stealType": "knock_on"}'::jsonb, 'live-capture', true, '5e7e5a3f-fa6c-49cf-9d7e-d5a3099ffc72', '2026-10-17 17:15:01.376', '2026-10-17 17:15:01.375'),
    ('169114b2-daea-4497-90f3-3a8589862040', '11111111-1111-1111-1111-000000000040', '550e8400-e29b-41d4-a716-446655440120', NULL, 1, 592, 595, '2026-10-17 17:15:06.458', 'OPPONENT', '{"receptionQuality": "contested_won"}'::jsonb, 'live-capture', true, 'cc6801ac-c471-401c-9aa1-443e601db20d', '2026-10-17 17:15:06.481', '2026-10-17 17:15:06.481'),
    ('23d3c1ff-ba3d-4a2e-9bc3-6bc8bdb50db4', '11111111-1111-1111-1111-000000000040', '550e8400-e29b-41d4-a716-446655440120', NULL, 1, 596, 599, '2026-10-17 17:15:10.688', 'OPPONENT', '{"receptionQuality": "fumbled"}'::jsonb, 'live-capture', true, 'ba60e223-2604-409d-951f-17e4f1006468', '2026-10-17 17:15:10.708', '2026-10-17 17:15:10.708'),
    ('6de3a0bb-b1a9-4a07-b276-3adba6a30f52', '11111111-1111-1111-1111-000000000040', '550e8400-e29b-41d4-a716-446655440120', NULL, 1, 599, 601, '2026-10-17 17:15:13.174', 'OWN', '{"receptionQuality": "clean_mark"}'::jsonb, 'live-capture', true, 'a6e41584-dba8-4159-ae49-84b3a318537a', '2026-10-17 17:15:13.196', '2026-10-17 17:15:13.196'),
    ('d01ea7d5-d54a-47ec-91e7-7774d2df55bb', '11111111-1111-1111-1111-000000000040', '550e8400-e29b-41d4-a716-446655440120', NULL, 1, 600, 603, '2026-10-17 17:15:14.401', 'OWN', '{"receptionQuality": "contested_won"}'::jsonb, 'live-capture', true, '92bd7a1f-aea1-4529-8df1-33d96a1a12b4', '2026-10-17 17:15:14.439', '2026-10-17 17:15:14.438'),
    ('66b21fe0-f37c-43ec-b2ce-b91a521b6f2e', '11111111-1111-1111-1111-000000000040', '550e8400-e29b-41d4-a716-446655440120', NULL, 1, 601, 604, '2026-10-17 17:15:16.073', 'OWN', '{"receptionQuality": "fumbled"}'::jsonb, 'live-capture', true, 'a562bcb2-c929-41fc-a935-7af79924f4ff', '2026-10-17 17:15:16.103', '2026-10-17 17:15:16.102'),
    ('fc933ab9-a894-45d9-ae9f-f5d2d224422b', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440112', NULL, 1, 16, 16, '2026-10-17 19:09:03.961', 'OWN', '{"lineResult": "lost"}'::jsonb, 'live-capture', true, 'c98778fc-d6a8-4d2e-ae72-15782cca80ae', '2026-10-17 19:09:04.025', '2026-10-17 19:09:04.018'),
    ('0f5f1814-99ae-4407-a1cd-6f3fc34dab12', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440122', NULL, 1, 50, 50, '2026-10-17 19:09:38.657', 'OWN', '{"penaltyType": "side_entry"}'::jsonb, 'live-capture', true, 'f5991201-2692-4759-83a4-f4b0c396dd6a', '2026-10-17 19:09:38.687', '2026-10-17 19:09:38.685'),
    ('ccb594f9-fb43-4b4f-b2e1-fd71629a74ae', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440128', NULL, 1, 57, 57, '2026-10-17 19:09:45.685', 'OPPONENT',     '{"kind": "penalty_touch"}'::jsonb, 'live-capture', true, '72f77134-6a18-4267-9d86-6c3d32125017', '2026-10-17 19:09:45.708', '2026-10-17 19:09:45.707'),
    ('333df087-35fa-4447-80e4-00ac37e7d887', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440112', NULL, 1, 71, 71, '2026-10-17 19:09:59.621', 'OPPONENT', '{"lineResult": "won_clean"}'::jsonb, 'live-capture', true, '6dc5fcff-2aca-4445-932f-bf724da35d65', '2026-10-17 19:09:59.660', '2026-10-17 19:09:59.659'),
    ('7effc9c5-9399-4160-ad2f-3b9646782ad7', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440117', NULL, 1, 130, 130, '2026-10-17 19:10:58.794', 'OWN', NULL, 'live-capture', true, '70e3857b-9a6b-4d2b-9093-21bdf352738a', '2026-10-17 19:10:58.823', '2026-10-17 19:10:58.821'),
    ('b2e6bb64-54b8-416e-8c55-20f6d587b4cd', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440110', NULL, 1, 142, 142, '2026-10-17 19:11:10.723', 'OWN', '{"outcome": "opp_possession"}'::jsonb, 'live-capture', true, '5372cec4-561c-40a1-a936-43bf2abea325', '2026-10-17 19:11:10.742', '2026-10-17 19:11:10.740'),
    ('816b4979-7b30-4a21-b62b-2be626ca5eeb', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440122', NULL, 1, 236, 236, '2026-10-17 19:12:44.225', 'OPPONENT', '{"penaltyType": "holding_on"}'::jsonb, 'live-capture', true, '62b81443-707a-4190-829a-2b24c2318a2d', '2026-10-17 19:12:44.278', '2026-10-17 19:12:44.276'),
    ('663620bd-51aa-487c-b8e1-ba65e41a7e3e', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440128', '11111111-1111-1111-1111-000000000110', 1, 244, 244, '2026-10-17 19:12:52.103', 'OWN', '{"kind": "penalty_touch", "playerNumber": 10}'::jsonb, 'live-capture', true, 'e842c36e-bbd7-425e-bf02-99080f1a2ba5', '2026-10-17 19:12:52.135', '2026-10-17 19:12:52.133'),
    ('b349ff8b-3e74-46f1-8034-5a160f7ac5a3', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440112', NULL, 1, 258, 258, '2026-10-17 19:13:06.574', 'OWN', '{"lineResult": "penalty_against"}'::jsonb, 'live-capture', true, '3ac1af9f-796d-48ba-986a-ddc1163534fb', '2026-10-17 19:13:06.610', '2026-10-17 19:13:06.607'),
    ('9b1188d9-b9c0-488e-91f0-50405c118a70', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440111', NULL, 1, 271, 271, '2026-10-17 19:13:19.615', 'OPPONENT', '{"scrumResult": "won_clean"}'::jsonb, 'live-capture', true, 'bce2f2d9-946e-407b-b47d-427b404a4848', '2026-10-17 19:13:19.648', '2026-10-17 19:13:19.646'),
    ('268519e9-fb87-4821-b61b-d36e809a4a63', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440101', NULL, 1, 281, 281, '2026-10-17 19:13:29.828', 'OPPONENT', '{"zone": "left"}'::jsonb, 'live-capture', true, '0476f0cd-b26b-47d1-8cd0-6c97f3ca570d', '2026-10-17 19:13:29.849', '2026-10-17 19:13:29.847'),
    ('2ed4f014-11e3-4063-809d-4b76b591a46c', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440102', NULL, 1, 337, 337, '2026-10-17 19:14:25.112', 'OPPONENT', '{"wasSuccessful": false}'::jsonb, 'live-capture', true, '1c04fc88-56a1-4492-b0a6-ae82d0e1571e', '2026-10-17 19:14:25.143', '2026-10-17 19:14:25.141'),
    ('ce96ce37-e347-44d9-a527-32bf68d4d0f4', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440113', '11111111-1111-1111-1111-000000000110', 1, 372, 372, '2026-10-17 19:15:00.481', 'OWN', '{"outcome": "received_clean", "playerNumber": 10}'::jsonb, 'live-capture', true, 'c6df7b78-01d5-45ea-97ac-79fbaddb9ca4', '2026-10-17 19:15:00.502', '2026-10-17 19:15:00.500'),
    ('874833c5-3f6c-468d-b989-b671692b15b5', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440117', NULL, 1, 411, 411, '2026-10-17 19:15:39.547', 'OWN', '{"stealType": "knock_on"}'::jsonb, 'live-capture', true, '8d86c8f8-a5ab-453f-8b5c-e49b0ee58db6', '2026-10-17 19:15:39.581', '2026-10-17 19:15:39.579'),
    ('16457158-73a2-4dfe-85ce-230f42d8b75c', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440111', NULL, 1, 434, 434, '2026-10-17 19:16:02.759', 'OWN', '{"scrumResult": "won_clean"}'::jsonb, 'live-capture', true, 'c876c450-9779-496f-884f-e1dd040f7b2b', '2026-10-17 19:16:02.789', '2026-10-17 19:16:02.787'),
    ('e00bf5ae-6426-4689-819b-2c11679ea261', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440117', NULL, 1, 489, 489, '2026-10-17 19:16:57.468', 'OPPONENT', NULL, 'live-capture', true, '234ed36f-7cf7-4048-858f-b93ec4c0ed87', '2026-10-17 19:16:57.498', '2026-10-17 19:16:57.496'),
    ('8137b9a0-0c17-4986-83b6-9fc24d523ef3', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440112', NULL, 1, 499, 499, '2026-10-17 19:17:07.388', 'OPPONENT', '{"lineResult": "won_clean"}'::jsonb, 'live-capture', true, 'b02178dd-6330-4de5-b02f-c28d89a3fd84', '2026-10-17 19:17:07.421', '2026-10-17 19:17:07.419'),
    ('f8860a64-dec6-4e15-985e-9ab7a1e0383d', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440109', NULL, 1, 503, 503, '2026-10-17 19:17:11.324', 'OPPONENT', NULL, 'live-capture', true, 'c4e33682-cbb3-4ebf-bd70-61341c947aad', '2026-10-17 19:17:11.352', '2026-10-17 19:17:11.350'),
    ('1ccf0cf7-7a24-4a5b-8773-f8897db68d46', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440109', NULL, 1, 508, 508, '2026-10-17 19:17:16.246', 'OPPONENT', NULL, 'live-capture', true, '2e0e7e76-afec-46de-98b1-70f843edbdc8', '2026-10-17 19:17:16.265', '2026-10-17 19:17:16.264'),
    ('0e479d93-9d65-4b29-8707-6a5dfeb7f46d', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440122', NULL, 1, 536, 536, '2026-10-17 19:17:43.880', 'OWN', '{"penaltyType": "offside"}'::jsonb, 'live-capture', true, '72f020a4-3796-46c3-8335-c44f1a38711a', '2026-10-17 19:17:43.924', '2026-10-17 19:17:43.922'),
    ('f9a5f63b-5a6d-4350-bde6-98d16b9d0f09', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440112', NULL, 1, 604, 604, '2026-10-17 19:18:52.632', 'OPPONENT', '{"lineResult": "won_clean"}'::jsonb, 'live-capture', true, '9f201871-4862-4c2c-9511-4fb34f111ac7', '2026-10-17 19:18:52.647', '2026-10-17 19:18:52.646'),
    ('7acb7a02-806a-4cfd-add3-e76beaa0cf97', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440101', NULL, 1, 672, 672, '2026-10-17 19:20:00.240', 'OPPONENT', '{"zone": "right"}'::jsonb, 'live-capture', true, 'bd9ab090-5869-4178-a7fa-13a580f13df9', '2026-10-17 19:20:00.270', '2026-10-17 19:20:00.267'),
    ('9a4135bd-7e33-485e-aecc-f422a8268ce3', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440102', NULL, 1, 712, 712, '2026-10-17 19:20:40.649', 'OPPONENT',     '{"wasSuccessful": false}'::jsonb, 'live-capture', true, 'dfa8a427-de6b-4e55-91ba-c31c8d282e13', '2026-10-17 19:20:40.673', '2026-10-17 19:20:40.671'),
    ('59760b74-a068-4ef2-a429-25ba124e6db2', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440113', '11111111-1111-1111-1111-000000000110', 1, 736, 755, '2026-10-17 19:21:22.923', 'OWN', '{"outcome": "received_clean", "playerNumber": 10}'::jsonb, 'live-capture', true, '8f04775d-e35a-4375-81d1-780f7146d208', '2026-10-17 19:21:22.982', '2026-10-17 19:21:22.979'),
    ('d2efb71d-b0dd-4043-b55b-b3652caca725', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440110', NULL, 1, 745, 764, '2026-10-17 19:21:31.970', 'OPPONENT', '{"outcome": "out_in_full"}'::jsonb, 'live-capture', true, 'db2bdacc-c1ae-4a53-84a2-a1dc4b5c7b10', '2026-10-17 19:21:32.004', '2026-10-17 19:21:32.003'),
    ('addbb3ab-64f1-420b-8ef8-52d85ae5a3a4', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440112', NULL, 1, 758, 776, '2026-10-17 19:21:44.262', 'OWN', '{"lineResult": "lost"}'::jsonb, 'live-capture', true, 'c0aaac52-8207-4506-b98e-093ce77f5bad', '2026-10-17 19:21:44.293', '2026-10-17 19:21:44.291'),
    ('bc61e2c0-0fce-4a6c-9c31-63f0f9635e9b', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440117', NULL, 1, 797, 815, '2026-10-17 19:22:23.204', 'OWN', NULL, 'live-capture', true, '4ddc326f-e430-4cfc-ba62-68b5ca64bafd', '2026-10-17 19:22:23.234', '2026-10-17 19:22:23.233'),
    ('94e0741f-fe2f-4238-a140-d89be7d1460b', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440112', NULL, 1, 822, 840, '2026-10-17 19:22:48.491', 'OPPONENT', '{"lineResult": "won_clean"}'::jsonb, 'live-capture', true, 'db2b6786-fcff-43f2-8172-a3330d3e5498', '2026-10-17 19:22:48.521', '2026-10-17 19:22:48.520'),
    ('86d12c3b-a92e-40eb-9f0a-97d048c29de5', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440122', NULL, 1, 840, 859, '2026-10-17 19:23:06.877', 'OPPONENT', '{"penaltyType": "side_entry"}'::jsonb, 'live-capture', true, 'f153332c-543c-4343-a180-5ad52e010b51', '2026-10-17 19:23:06.894', '2026-10-17 19:23:06.892'),
    ('6623b0d0-b93d-4872-9331-7adf83a3fe39', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440112', NULL, 1, 868, 887, '2026-10-17 19:23:35.068', 'OWN', '{"lineResult": "won_clean"}'::jsonb, 'live-capture', true, 'ca8635cf-c440-4bc7-ad5c-02c4666a3dea', '2026-10-17 19:23:35.098', '2026-10-17 19:23:35.096'),
    ('96dd4fcc-dd82-40f8-bf56-85e94f96089d', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440111', NULL, 1, 945, 963, '2026-10-17 19:24:51.632', 'OPPONENT', '{"scrumResult": "won_clean"}'::jsonb, 'live-capture', true, '07877dbb-3f24-4976-b311-13a1ae6b96fc', '2026-10-17 19:24:51.666', '2026-10-17 19:24:51.664'),
    ('62affbc0-e10f-4ac8-9d2b-6e65c2a46bc2', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440112', NULL, 1, 804, 823, '2026-10-17 19:22:30.984', 'OWN', '{"lineResult": "won_clean"}'::jsonb, 'live-capture', false, '1d40a228-7802-4762-8c06-334f1e109024', '2026-10-17 19:22:31.012', '2026-10-17 19:22:40.052'),
    ('6f5f94f1-6192-44c4-ac68-0940c0644184', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440128', NULL, 1, 848, 867, '2026-10-17 19:23:15.020', 'OWN', '{"kind": "penalty_touch"}'::jsonb, 'live-capture', true, '4e3b7dcf-52c3-4e70-9d08-e844774c2f6a', '2026-10-17 19:23:15.047', '2026-10-17 19:23:15.046'),
    ('7497a102-ee66-4104-98ea-f2dd2292af66', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440109', NULL, 1, 949, 967, '2026-10-17 19:24:55.294', 'OPPONENT', NULL, 'live-capture', true, 'f0483485-73b0-4738-9698-73bbb22f4a39', '2026-10-17 19:24:55.320', '2026-10-17 19:24:55.319'),
    ('27f8c773-5b46-48c4-ac7a-aa25d0e2e7ca', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440101', NULL, 1, 957, 975, '2026-10-17 19:25:03.230', 'OPPONENT',     '{"zone": "center"}'::jsonb, 'live-capture', true, '71b1a155-2588-4b03-8d9f-58053355d9ca', '2026-10-17 19:25:03.243', '2026-10-17 19:25:03.242'),
    ('2a0a3e21-1a15-4732-b8e7-d28e0f755252', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440102', NULL, 1, 985, 1003, '2026-10-17 19:25:31.134', 'OPPONENT',     '{"wasSuccessful": true}'::jsonb, 'live-capture', true, 'deae0cab-2d3d-4d2a-ba9b-a09c6c5bff1d', '2026-10-17 19:25:31.164', '2026-10-17 19:25:31.162'),
    ('e64ad6a3-90cc-49f5-af87-030cdba93cb4', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440113', NULL, 1, 1024, 1042, '2026-10-17 19:26:10.244', 'OWN', '{"outcome": "received_clean"}'::jsonb, 'live-capture', true, 'b41418fe-5747-46c2-8869-cf4418f7ae70', '2026-10-17 19:26:10.277', '2026-10-17 19:26:10.276'),
    ('864539bb-a515-48c2-8591-becb7de20404', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440117', NULL, 1, 1037, 1055, '2026-10-17 19:26:23.584', 'OWN', NULL, 'live-capture', true, '08e414eb-16fe-41f7-b4af-2e9f75caa810', '2026-10-17 19:26:23.612', '2026-10-17 19:26:23.610'),
    ('77d1cc01-abf8-41b6-9ea1-aa4cec5bc8b0', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440112', NULL, 1, 1069, 1087, '2026-10-17 19:26:55.291', 'OWN', '{"lineResult": "won_clean"}'::jsonb, 'live-capture', false, '64170d60-c613-4b85-a2b3-962e74e1edbd', '2026-10-17 19:26:55.321', '2026-10-17 19:27:05.143'),
    ('17e603b0-c85b-46ca-a32e-5b7f66c5dc10', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440112', NULL, 1, 1097, 1115, '2026-10-17 19:27:23.524', 'OWN', '{"lineResult": "penalty_against"}'::jsonb, 'live-capture', true, '21151ed0-8021-4962-a45c-46a8b61718fc', '2026-10-17 19:27:23.555', '2026-10-17 19:27:23.553'),
    ('bc4a7d05-27ad-4c88-bf72-fd3c3fb479e4', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440111', NULL, 1, 1111, 1130, '2026-10-17 19:27:37.947', 'OPPONENT', '{"scrumResult": "won_clean"}'::jsonb, 'live-capture', true, '46573d72-3a83-479f-9a7f-768d8ec1d403', '2026-10-17 19:27:37.976', '2026-10-17 19:27:37.975'),
    ('c9e3179e-c9d1-4725-be5b-5f378117c883', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440117', NULL, 1, 1150, 1169, '2026-10-17 19:28:17.110', 'OWN', NULL, 'live-capture', true, 'ce06c796-a298-4910-95bf-e4da28b0f2d3', '2026-10-17 19:28:17.122', '2026-10-17 19:28:17.121'),
    ('74abb56c-74b7-4891-8951-1899b29e146c', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440111', NULL, 1, 1208, 1227, '2026-10-17 19:29:15.058', 'OWN', '{"scrumResult": "won_clean"}'::jsonb, 'live-capture', true, '686d83b2-9234-422a-b434-bbb56c33ba32', '2026-10-17 19:29:15.087', '2026-10-17 19:29:15.086'),
    ('1c8c87a6-6620-46b0-90fa-4425d08a2f13', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440110', NULL, 1, 1218, 1237, '2026-10-17 19:29:25.110', 'OWN', '{"outcome": "out_in_full"}'::jsonb, 'live-capture', true, '96652771-060f-4c71-bc7e-88ae0cb3e7e4', '2026-10-17 19:29:25.140', '2026-10-17 19:29:25.139'),
    ('4c2840bb-3ae6-4147-8f14-bad215ff763b', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440112', NULL, 1, 1240, 1258, '2026-10-17 19:29:46.808', 'OPPONENT', '{"lineResult": "won_clean"}'::jsonb, 'live-capture', true, '2c0b6167-7701-4b66-9ed7-e80b0b0e6a1e', '2026-10-17 19:29:46.834', '2026-10-17 19:29:46.833'),
    ('4259a0a4-3c84-46be-9580-8a94e614d9c1', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440122', NULL, 1, 1342, 1360, '2026-10-17 19:31:28.456', 'OWN', '{"penaltyType": "high_tackle"}'::jsonb, 'live-capture', true, 'e3c1cee1-7976-4c05-ba2c-7ce45a89091c', '2026-10-17 19:31:28.480', '2026-10-17 19:31:28.478'),
    ('0a50db10-acf2-4262-9902-8bef47a65173', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440111', NULL, 1, 1389, 1407, '2026-10-17 19:32:15.704', 'OPPONENT', '{"scrumResult": "won_clean"}'::jsonb, 'live-capture', false, '02ea4a15-4f21-46c3-9101-939ae0c0d84f', '2026-10-17 19:32:15.731', '2026-10-17 19:32:21.440'),
    ('3acd4d52-bedd-4d99-acdc-b876389aa706', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440111', NULL, 1, 1401, 1419, '2026-10-17 19:32:27.797', 'OPPONENT', '{"scrumResult": "penalty_for"}'::jsonb, 'live-capture', true, 'dadc66dc-3e7e-4873-8333-41ccd02ea331', '2026-10-17 19:32:27.825', '2026-10-17 19:32:27.824'),
    ('1c6cc3ab-3dcf-4dc2-883c-65f37484772f', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440128', NULL, 1, 1414, 1432, '2026-10-17 19:32:40.423', 'OPPONENT', '{"kind": "penalty_touch"}'::jsonb, 'live-capture', true, 'd7e611b5-fcdf-4990-94e6-71d95b9380bb', '2026-10-17 19:32:40.445', '2026-10-17 19:32:40.444'),
    ('d3d87ed5-8d62-401b-bcba-d9680e5e47d7', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440117', NULL, 1, 1438, 1457, '2026-10-17 19:33:05.071', 'OWN', NULL, 'live-capture', true, 'da23f359-e2b3-406a-928d-28c1c2ea9269', '2026-10-17 19:33:05.094', '2026-10-17 19:33:05.092'),
    ('0ef9e8cb-c07e-41f9-bb8c-ed5561152dd1', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440122', NULL, 1, 1480, 1498, '2026-10-17 19:33:46.546', 'OWN', '{"penaltyType": "holding_on"}'::jsonb, 'live-capture', true, 'dc0d427b-c406-46a5-b121-1aaf22374bbc', '2026-10-17 19:33:46.571', '2026-10-17 19:33:46.570'),
    ('a3a27695-1755-4ca1-8f2d-bd27566c0493', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440128', NULL, 1, 1483, 1501, '2026-10-17 19:33:49.691', 'OPPONENT', '{"kind": "penalty_touch"}'::jsonb, 'live-capture', true, 'e4cd2594-78ce-4ceb-b393-b27ff46c5a47', '2026-10-17 19:33:49.717', '2026-10-17 19:33:49.713'),
    ('d430f6b6-4d6e-4baa-8d35-0b6e9f7c0c56', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440112', NULL, 1, 1505, 1523, '2026-10-17 19:34:11.802', 'OWN', '{"lineResult": "won_clean"}'::jsonb, 'live-capture', true, 'b9281d12-665f-4aba-b99a-2f8c4e29cbe2', '2026-10-17 19:34:11.828', '2026-10-17 19:34:11.827'),
    ('02da8979-0a13-4949-8f52-29ed77f13328', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440101', '11111111-1111-1111-1111-000000000108', 1, 1591, 1610, '2026-10-17 19:35:37.881', 'OWN', '{"zone": "center", "playerNumber": 8}'::jsonb, 'live-capture', false, '14755b6a-6560-41d5-b23c-a11ab35831c9', '2026-10-17 19:35:37.935', '2026-10-17 19:36:03.322'),
    ('5f432660-fe91-46cf-972f-1468f104ef0b', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440101', '11111111-1111-1111-1111-000000000108', 1, 1626, 1645, '2026-10-17 19:36:13.445', 'OWN', '{"zone": "center", "playerNumber": 8}'::jsonb, 'live-capture', true, 'e16e1651-8943-417a-be6a-21fc1783e31d', '2026-10-17 19:36:13.461', '2026-10-17 19:36:13.460'),
    ('8f41afd8-caed-4ee5-a339-ffa00f9b52fb', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440102', '11111111-1111-1111-1111-000000000115', 1, 1634, 1653, '2026-10-17 19:36:21.477', 'OWN', '{"playerNumber": 15, "wasSuccessful": true}'::jsonb, 'live-capture', true, 'dbd1e47b-45bc-4307-929a-21c039ef3d26', '2026-10-17 19:36:21.509', '2026-10-17 19:36:21.507'),
    ('abb49554-70d3-49f5-9c50-5d18e03ca1d5', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440110', NULL, 1, 1685, 1704, '2026-10-17 19:37:12.785', 'OPPONENT', '{"outcome": "opp_possession"}'::jsonb, 'live-capture', true, '9c8f21a2-1d5f-4cf7-bf3f-babbfa0f5d97', '2026-10-17 19:37:12.815', '2026-10-17 19:37:12.814'),
    ('f0b27c59-705f-41b0-a199-84d12d9d61b4', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440117', NULL, 1, 1741, 1760, '2026-10-17 19:38:08.723', 'OPPONENT', NULL, 'live-capture', true, '6a98e59c-f9e6-4e21-b1f2-ae1c511235f5', '2026-10-17 19:38:08.746', '2026-10-17 19:38:08.745'),
    ('fba9a95b-ee2f-4fcd-a4fd-9c1242e79871', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440109', NULL, 1, 1750, 1769, '2026-10-17 19:38:17.292', 'OPPONENT', NULL, 'live-capture', true, '1be0b9a5-d667-49c4-b7cf-da229a5cee5c', '2026-10-17 19:38:17.330', '2026-10-17 19:38:17.329'),
    ('59accf18-2fa5-4fce-b8b8-88dee2e3e1be', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440101', NULL, 1, 1768, 1787, '2026-10-17 19:38:35.297', 'OPPONENT', '{"zone": "left"}'::jsonb, 'live-capture', true, 'e7fc97d6-85d7-4c00-a6d4-b2bdc697ce24', '2026-10-17 19:38:35.325', '2026-10-17 19:38:35.324'),
    ('6b3bc139-df73-4564-94ec-56fbf2bf1851', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440102', NULL, 1, 1797, 1816, '2026-10-17 19:39:04.708', 'OPPONENT', '{"wasSuccessful": true}'::jsonb, 'live-capture', true, '56dd349c-9a0d-4ec4-80a2-44a610e9800d', '2026-10-17 19:39:04.731', '2026-10-17 19:39:04.730'),
    ('c321283e-17ca-4625-931d-cc5ea96b8843', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440113', NULL, 1, 1832, 1851, '2026-10-17 19:39:39.649', 'OWN', '{"outcome": "received_clean"}'::jsonb, 'live-capture', true, 'e3528565-e740-4008-9536-72e18354175f', '2026-10-17 19:39:39.685', '2026-10-17 19:39:39.684'),
    ('3b2b70be-dc8b-4845-a32c-c9c1cfc6bcb7', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440110', NULL, 1, 1845, 1864, '2026-10-17 19:39:52.539', 'OPPONENT', '{"outcome": "out_in_full"}'::jsonb, 'live-capture', true, '30cf2332-d2bd-4df3-b0f8-7209e492bffd', '2026-10-17 19:39:52.568', '2026-10-17 19:39:52.567'),
    ('a4099269-0fb1-4edf-90f4-e892212e8470', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440112', NULL, 1, 1868, 1887, '2026-10-17 19:40:15.511', 'OWN', '{"lineResult": "won_clean"}'::jsonb, 'live-capture', false, '4dd67b4d-e890-42c7-809a-e8025e32466b', '2026-10-17 19:40:15.543', '2026-10-17 19:40:29.715'),
    ('a10a32ed-976d-4e6c-8bba-ab278b78a8b6', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440112', NULL, 1, 1889, 1908, '2026-10-17 19:40:36.474', 'OWN', '{"lineResult": "penalty_against"}'::jsonb, 'live-capture', true, '981d4b3f-75fe-46b4-867d-43632da702a9', '2026-10-17 19:40:36.502', '2026-10-17 19:40:36.501'),
    ('7ed9326f-2ca1-4ecb-9bf4-99a796913cc7', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440128', NULL, 1, 1901, 1920, '2026-10-17 19:40:48.673', 'OPPONENT', '{"kind": "penalty_touch"}'::jsonb, 'live-capture', true, 'b4a5e716-b40b-4171-bc18-e832a988ee05', '2026-10-17 19:40:48.703', '2026-10-17 19:40:48.701'),
    ('67419d35-51bf-47af-a9b7-07b1640666b6', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440112', NULL, 1, 1931, 1950, '2026-10-17 19:41:18.389', 'OWN', '{"lineResult": "won_clean"}'::jsonb, 'live-capture', true, 'eb2fa1dd-bff3-4cef-a7ca-0404c8410549', '2026-10-17 19:41:18.416', '2026-10-17 19:41:18.415'),
    ('576f0252-cae4-4faf-9689-8e0ef1c2e877', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440122', NULL, 1, 1970, 1990, '2026-10-17 19:41:58.039', 'OPPONENT', '{"penaltyType": "offside"}'::jsonb, 'live-capture', true, '1fa1bbd0-1403-4505-8469-b8d85d601f83', '2026-10-17 19:41:58.066', '2026-10-17 19:41:58.065'),
    ('59e2aa19-b9b2-47a6-abee-785a7d0c7739', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440128', NULL, 1, 1975, 1994, '2026-10-17 19:42:02.638', 'OWN', '{"kind": "penalty_touch"}'::jsonb, 'live-capture', true, 'e12bf0a9-4f19-4565-b4d8-41de6c94e5e9', '2026-10-17 19:42:02.661', '2026-10-17 19:42:02.660'),
    ('76dc9c3c-99a2-4197-a700-2c1f90ffd7c5', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440112', NULL, 1, 2000, 2020, '2026-10-17 19:42:28.070', 'OWN', '{"lineResult": "won_clean"}'::jsonb, 'live-capture', false, 'ff166a1c-e410-4d38-a39e-cc1ce8389828', '2026-10-17 19:42:28.098', '2026-10-17 19:43:00.477'),
    ('2934a722-fda7-40e9-956f-74a888838123', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440112', NULL, 1, 2038, 2057, '2026-10-17 19:43:05.203', 'OWN', '{"lineResult": "penalty_against"}'::jsonb, 'live-capture', false, 'ed734daf-c62a-47f1-8593-fde568e623ed', '2026-10-17 19:43:05.252', '2026-10-17 19:43:27.488'),
    ('2b7898e2-4332-4ba9-aa6a-426e54162802', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440112', NULL, 1, 2074, 2094, '2026-10-17 19:43:41.925', 'OWN', '{"lineResult": "lost"}'::jsonb, 'live-capture', true, 'f2f05b27-1f1b-491c-ab68-a1c5e277a8e8', '2026-10-17 19:43:41.959', '2026-10-17 19:43:41.958'),
    ('77f5411e-b12e-4a2f-a037-9acec8568e08', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440110', NULL, 1, 2082, 2101, '2026-10-17 19:43:49.187', 'OPPONENT', '{"outcome": "out_in_full"}'::jsonb, 'live-capture', true, '42a1c7f8-c93f-4e70-a92c-2225b53a503c', '2026-10-17 19:43:49.214', '2026-10-17 19:43:49.212'),
    ('6db6b6f8-789d-4dcb-a26a-9067662a7a87', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440112', NULL, 1, 2088, 2107, '2026-10-17 19:43:55.766', 'OWN', '{"lineResult": "lost"}'::jsonb, 'live-capture', true, 'e1c0b4e6-0e7a-4d4b-8d5c-e99e033eb56f', '2026-10-17 19:43:55.793', '2026-10-17 19:43:55.792'),
    ('757d3167-3be7-485e-be82-cf4fe9b14ea8', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440109', NULL, 1, 2096, 2115, '2026-10-17 19:44:03.781', 'OPPONENT', NULL, 'live-capture', true, 'dee47cca-f474-485a-ae76-f6bc734f9cd0', '2026-10-17 19:44:03.804', '2026-10-17 19:44:03.803'),
    ('91e05c0c-d54a-4266-9966-a670b4958167', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440122', NULL, 1, 2340, 2469, '2026-10-17 19:49:57.399', 'OPPONENT', '{"penaltyType": "holding_on"}'::jsonb, 'live-capture', true, 'b457a55d-c59d-42a8-9418-c9ab839a06f0', '2026-10-17 19:49:57.413', '2026-10-17 19:49:57.412'),
    ('bedb4ea6-1fa9-42c9-b53a-2e08dcfcccd6', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440111', NULL, 1, 2384, 2513, '2026-10-17 19:50:41.689', 'OWN', '{"scrumResult": "won_clean"}'::jsonb, 'live-capture', true, '0670b402-d1c6-4c97-a5c8-fe1187a125d1', '2026-10-17 19:50:41.714', '2026-10-17 19:50:41.713'),
    ('a802f37d-a1e7-4e66-beea-b426d466a029', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440101', '11111111-1111-1111-1111-000000000110', 1, 2399, 2528, '2026-10-17 19:50:56.811', 'OWN', '{"zone": "left", "playerNumber": 10}'::jsonb, 'live-capture', true, '3f9b4bbe-ee9e-4583-90ff-5df2846a9a8b', '2026-10-17 19:50:56.826', '2026-10-17 19:50:56.825'),
    ('6a8384bb-794b-4e17-a6ce-0bda04236646', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440113', NULL, 2, 3186, 3426, '2026-10-17 20:05:54.038', 'OPPONENT', '{"outcome": "regained_attack"}'::jsonb, 'live-capture', false, 'dbe42bcc-23ca-4cb2-8285-debf04a90eb9', '2026-10-17 20:05:54.167', '2026-10-17 20:06:26.844'),
    ('c99799ca-ebe7-47cd-aabd-1e8a7120f518', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440117', NULL, 2, 3228, 3467, '2026-10-17 20:06:35.402', 'OPPONENT', '{"stealType": "knock_on"}'::jsonb, 'live-capture', false, '18c40e81-3590-471b-bd7a-6ead895c613a', '2026-10-17 20:06:35.533', '2026-10-17 20:06:51.205'),
    ('6389b6ba-b27a-4046-975a-a5b14a8be432', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440117', NULL, 1, 2098, 2117, '2026-10-17 19:44:05.681', 'OWN', NULL, 'live-capture', true, '0ee84640-e65c-4b83-8f29-cc82195ac0a9', '2026-10-17 19:44:05.705', '2026-10-17 19:44:05.704'),
    ('3c8b42c3-827d-4d8f-97b7-6b37fefbd06c', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440122', NULL, 1, 2138, 2157, '2026-10-17 19:44:45.329', 'OWN', '{"penaltyType": "holding_on"}'::jsonb, 'live-capture', true, '6013f173-2d26-4255-a74f-34a63d50b56b', '2026-10-17 19:44:45.357', '2026-10-17 19:44:45.355'),
    ('89d790a1-cd4e-489e-881d-9a5419a7b502', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440117', NULL, 1, 2171, 2191, '2026-10-17 19:45:18.991', 'OWN', NULL, 'live-capture', true, '66f2d832-99a9-4ec1-bbf7-8b6d7de4ed79', '2026-10-17 19:45:19.004', '2026-10-17 19:45:19.003'),
    ('04813272-23b1-4b3d-b84d-cb67376efeeb', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440111', NULL, 1, 2163, 2182, '2026-10-17 19:45:10.376', 'OPPONENT', '{"scrumResult": "penalty_for"}'::jsonb, 'live-capture', true, '99764f36-6d13-411a-b878-4a797ad176db', '2026-10-17 19:45:10.402', '2026-10-17 19:45:10.400'),
    ('99b5f2ab-fa7f-426d-949e-b03c1c09f7f4', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440126', '11111111-1111-1111-1111-000000000103', 1, 2255, 2347, '2026-10-17 19:47:55.074', 'OWN', '{"playerNumber": 3}'::jsonb, 'live-capture', true, '8209ecaa-8ffb-4605-8b05-76dc6efca711', '2026-10-17 19:47:55.090', '2026-10-17 19:47:55.089'),
    ('32108a69-5e97-41e8-ac57-cdf30ca0aaf7', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440111', NULL, 1, 2255, 2376, '2026-10-17 19:48:24.565', 'OWN', '{"scrumResult": "penalty_for"}'::jsonb, 'live-capture', true, '5de920dd-badc-4c54-9557-e537a47759ef', '2026-10-17 19:48:24.593', '2026-10-17 19:48:24.592'),
    ('2d1a824a-03c8-4d3c-9637-a546aa2dce3b', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440113', NULL, 2, 3225, 3464, '2026-10-17 20:06:32.718', 'OPPONENT', '{"outcome": "received_clean"}'::jsonb, 'live-capture', false, '3d7ef2b2-0598-44c2-85f7-c1c69e545a80', '2026-10-17 20:06:32.859', '2026-10-17 20:06:51.682'),
    ('57a0d980-8506-4c0f-a837-2cd59f2b55ac', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440113', NULL, 2, 3251, 3490, '2026-10-17 20:06:58.773', 'OPPONENT', '{"outcome": "regained_attack"}'::jsonb, 'live-capture', true, '777ec1e6-9e65-4a2a-a61f-4197e47e6d6b', '2026-10-17 20:06:58.816', '2026-10-17 20:06:58.815'),
    ('aca0d450-7294-4234-9f99-6d5d279fa596', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440117', NULL, 2, 3253, 3493, '2026-10-17 20:07:01.099', 'OWN', '{"stealType": "knock_on"}'::jsonb, 'live-capture', true, '452c08af-68e8-4a0c-9f4f-44e4b0f3d2fb', '2026-10-17 20:07:01.144', '2026-10-17 20:07:01.143'),
    ('e5e35c29-ba52-430c-a656-b67ca0ac4d4f', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440111', NULL, 2, 3256, 3496, '2026-10-17 20:07:04.016', 'OWN', '{"scrumResult": "won_clean"}'::jsonb, 'live-capture', true, '2c2d68ea-c54f-41f3-b121-96fdee0aee03', '2026-10-17 20:07:04.054', '2026-10-17 20:07:04.053'),
    ('25dbec95-1065-4cd1-a3ea-a0d33b76c04f', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440109', NULL, 2, 3260, 3499, '2026-10-17 20:07:07.235', 'OWN', NULL, 'live-capture', true, 'cf34c9ff-3d19-4c3f-81e2-81a9384328a2', '2026-10-17 20:07:07.272', '2026-10-17 20:07:07.271'),
    ('d153a9de-8007-48c6-a518-060d363b9e4d', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440122', NULL, 2, 3282, 3554, '2026-10-17 20:08:02.643', 'OPPONENT', '{"penaltyType": "high_tackle"}'::jsonb, 'live-capture', true, '80fcc6de-9845-4ced-afec-db622b2c3948', '2026-10-17 20:08:02.681', '2026-10-17 20:08:02.680'),
    ('a7a2989a-d4e2-49c7-b6bb-7b90b05826c1', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440111', NULL, 2, 3317, 3600, '2026-10-17 20:08:48.033', 'OWN', '{"scrumResult": "won_clean"}'::jsonb, 'live-capture', true, 'e28ddd2d-cea0-4e6d-93f8-c74812183561', '2026-10-17 20:08:48.075', '2026-10-17 20:08:48.074'),
    ('a6c7ba95-dd59-4d78-8e7b-9189a47cacbb', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440117', NULL, 2, 3326, 3609, '2026-10-17 20:08:56.919', 'OPPONENT', '{"stealType": "knock_on"}'::jsonb, 'live-capture', true, '5b5536f3-48bd-45b4-9e7f-b51ede1a4307', '2026-10-17 20:08:56.965', '2026-10-17 20:08:56.964'),
    ('08f8044f-48a2-4794-ae7d-4652b0659ef0', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440111', NULL, 2, 3373, 3656, '2026-10-17 20:09:44.164', 'OPPONENT', '{"scrumResult": "won_clean"}'::jsonb, 'live-capture', true, 'a8495707-9fba-480e-b752-dd882c586950', '2026-10-17 20:09:44.202', '2026-10-17 20:09:44.201'),
    ('4a85d6d3-c193-43cf-87a7-442fa94cf61e', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440122', NULL, 2, 3375, 3781, '2026-10-17 20:11:49.369', 'OWN', '{"penaltyType": "offside"}'::jsonb, 'live-capture', true, '02e9f707-515c-4f01-aa3f-668c6a163f19', '2026-10-17 20:11:49.430', '2026-10-17 20:11:49.429'),
    ('b10c9f04-e1ea-4881-85c4-741304ba9f7b', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440111', NULL, 2, 3375, 3802, '2026-10-17 20:12:10.253', 'OPPONENT', '{"scrumResult": "won_clean"}'::jsonb, 'live-capture', true, '42869bd9-6df8-49ac-b364-ff9bb8adcf25', '2026-10-17 20:12:10.334', '2026-10-17 20:12:10.333'),
    ('2cb40725-b1e8-4289-8582-f3dc90920bc8', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440122', NULL, 2, 3375, 3847, '2026-10-17 20:12:55.629', 'OPPONENT', '{"penaltyType": "side_entry"}'::jsonb, 'live-capture', true, '42f2227d-256d-4959-9a95-1ab4032d7326', '2026-10-17 20:12:55.675', '2026-10-17 20:12:55.673'),
    ('2c1074a7-2a01-438b-bd98-aff84ecc2f08', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440128', NULL, 2, 3375, 3854, '2026-10-17 20:13:02.708', 'OWN', '{"kind": "penalty_touch"}'::jsonb, 'live-capture', true, 'dd190dee-975a-415c-80d1-b0b6aba616b6', '2026-10-17 20:13:02.746', '2026-10-17 20:13:02.745'),
    ('77ece904-2e6a-4a11-b721-43d50d1ec583', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440112', NULL, 2, 3390, 3876, '2026-10-17 20:13:24.151', 'OWN', '{"lineResult": "won_clean"}'::jsonb, 'live-capture', true, '823c888b-bb95-43e9-bbcf-3c588a429815', '2026-10-17 20:13:24.194', '2026-10-17 20:13:24.193'),
    ('3e3f91ba-c109-41ab-9fcb-8d8a0ac566cf', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440117', NULL, 2, 3395, 3881, '2026-10-17 20:13:29.000', 'OPPONENT', NULL, 'live-capture', true, '4c467413-f5ad-4223-9604-c965e8d7afba', '2026-10-17 20:13:29.044', '2026-10-17 20:13:29.043'),
    ('0e3ee475-c8f1-4e0b-8535-63494146e6c1', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440117', NULL, 2, 3440, 3926, '2026-10-17 20:14:14.286', 'OPPONENT', NULL, 'live-capture', false, '0515c6a5-8914-4010-b825-c14aa8190c21', '2026-10-17 20:14:14.326', '2026-10-17 20:14:17.488'),
    ('280eb22d-7f91-4360-8a10-10264a136df6', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440117', NULL, 2, 3438, 3924, '2026-10-17 20:14:12.183', 'OWN', NULL, 'live-capture', false, 'a42a26a4-9123-4df4-962c-c3f30600b0bf', '2026-10-17 20:14:12.226', '2026-10-17 20:14:19.236'),
    ('b96c6703-07a3-40b6-9a39-a6dc982fd7f1', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440122', NULL, 2, 3452, 3937, '2026-10-17 20:14:25.698', 'OWN', '{"penaltyType": "offside"}'::jsonb, 'live-capture', true, 'd09fcf67-5621-4d15-a750-05f89ed32155', '2026-10-17 20:14:25.738', '2026-10-17 20:14:25.737'),
    ('36e9843f-4a98-4b30-b31e-db655a52412c', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440117', NULL, 2, 3492, 3977, '2026-10-17 20:15:05.685', 'OWN', NULL, 'live-capture', true, '50805859-eac5-4a76-bbb8-f4426ad241e7', '2026-10-17 20:15:05.726', '2026-10-17 20:15:05.725'),
    ('a194dd25-3fee-43f2-b296-43f62efd9334', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440111', NULL, 2, 3542, 4028, '2026-10-17 20:15:56.356', 'OWN', '{"scrumResult": "won_clean"}'::jsonb, 'live-capture', true, 'a4fffdcc-acb5-45d2-897d-8b04684cbce7', '2026-10-17 20:15:56.399', '2026-10-17 20:15:56.399'),
    ('43028091-1b63-499f-97bf-07278389d05f', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440111', NULL, 2, 3572, 4057, '2026-10-17 20:16:25.534', 'OWN', '{"scrumResult": "won_clean"}'::jsonb, 'live-capture', true, 'ee690c7c-4dfb-4fe1-b415-eff0c09d701f', '2026-10-17 20:16:25.555', '2026-10-17 20:16:25.555'),
    ('01b2671b-dcde-4396-9cb6-22154830d02a', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440110', NULL, 2, 3575, 4060, '2026-10-17 20:16:28.666', 'OWN', '{"outcome": "opp_possession"}'::jsonb, 'live-capture', true, '5798d5bd-2134-4bb6-9ea4-f59df59d919c', '2026-10-17 20:16:28.706', '2026-10-17 20:16:28.705'),
    ('b21f4616-32fa-4bbb-8112-6fd2b6961d04', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440117', NULL, 2, 3582, 4067, '2026-10-17 20:16:35.703', 'OWN', NULL, 'live-capture', true, '35ba1146-4a23-4555-b053-4b3333acd1d6', '2026-10-17 20:16:35.724', '2026-10-17 20:16:35.723'),
    ('a59394b7-3b82-431a-b211-838e0e1adb84', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440110', NULL, 2, 3606, 4091, '2026-10-17 20:16:59.786', 'OWN', '{"outcome": "opp_possession"}'::jsonb, 'live-capture', true, 'ea2da54d-c42a-4602-b52a-a10d88de9fed', '2026-10-17 20:16:59.822', '2026-10-17 20:16:59.822'),
    ('0535bad5-1921-4562-bc22-aedf68886938', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440117', NULL, 2, 3638, 4124, '2026-10-17 20:17:31.855', 'OWN', '{"stealType": "knock_on"}'::jsonb, 'live-capture', true, '0e12582b-3bf2-46bf-bf21-5cf4b31ad279', '2026-10-17 20:17:31.895', '2026-10-17 20:17:31.894'),
    ('c472deb3-2388-4c4f-b1e6-fca1cf87ce5a', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440111', NULL, 2, 3687, 4172, '2026-10-17 20:18:20.614', 'OWN', '{"scrumResult": "penalty_against"}'::jsonb, 'live-capture', true, '3d67706c-4d50-42f4-ab95-547f55d17c88', '2026-10-17 20:18:20.654', '2026-10-17 20:18:20.654'),
    ('2b97e11c-4f8a-4c55-ab4c-f46ed8fbb165', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440101', NULL, 2, 3719, 4204, '2026-10-17 20:18:52.519', 'OPPONENT', '{"zone": "right"}'::jsonb, 'live-capture', true, '502c4895-2925-4643-a09f-aa8618e68699', '2026-10-17 20:18:52.569', '2026-10-17 20:18:52.568'),
    ('47367576-7637-4c4e-a47c-44756bb138ea', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440102', NULL, 2, 3760, 4245, '2026-10-17 20:19:33.603', 'OPPONENT', '{"wasSuccessful": false}'::jsonb, 'live-capture', true, 'afc06a5e-a00b-4499-bd0e-cc6873fa94cc', '2026-10-17 20:19:33.637', '2026-10-17 20:19:33.636'),
    ('2256e660-290b-4b6a-ae1c-d68f6fab9fb3', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440113', '11111111-1111-1111-1111-000000000115', 2, 3796, 4281, '2026-10-17 20:20:09.613', 'OWN', '{"outcome": "received_clean", "playerNumber": 15}'::jsonb, 'live-capture', true, 'e4e5deca-8f7f-4096-9340-11dc865504e3', '2026-10-17 20:20:09.665', '2026-10-17 20:20:09.663'),
    ('33b2df09-a86c-4820-a4d3-3672d4572b66', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440109', NULL, 2, 3801, 4287, '2026-10-17 20:20:15.478', 'OPPONENT', NULL, 'live-capture', true, '260fe7a7-8779-4e8b-a198-25d9a6aac4f9', '2026-10-17 20:20:15.514', '2026-10-17 20:20:15.513'),
    ('efe27d2f-2110-4534-b16e-2f822aea30f2', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440101', NULL, 2, 3839, 4325, '2026-10-17 20:20:52.860', 'OPPONENT', '{"zone": "center"}'::jsonb, 'live-capture', true, '1cf0417a-a440-4fac-90e4-a28617cf2038', '2026-10-17 20:20:52.900', '2026-10-17 20:20:52.899'),
    ('04bc4695-93b1-4400-8ba1-5e35923f7736', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440102', NULL, 2, 3862, 4347, '2026-10-17 20:21:15.553', 'OPPONENT', '{"wasSuccessful": true}'::jsonb, 'live-capture', true, 'a7105af7-8763-4d25-a0f8-32e9de44d168', '2026-10-17 20:21:15.597', '2026-10-17 20:21:15.596'),
    ('4b6390b3-1047-4890-bf9d-96f186c59e25', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440113', NULL, 2, 3911, 4396, '2026-10-17 20:22:04.707', 'OWN', '{"outcome": "received_clean"}'::jsonb, 'live-capture', true, '49bc7d3a-6fb6-49c9-8f47-8e5be2946214', '2026-10-17 20:22:04.747', '2026-10-17 20:22:04.746'),
    ('8088b3b0-4fa6-46dc-849e-97df19b5718e', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440110', NULL, 2, 3915, 4401, '2026-10-17 20:22:09.239', 'OPPONENT', '{"outcome": "out_in_full"}'::jsonb, 'live-capture', true, '174de772-3e4c-439d-b7ef-39b67b36398a', '2026-10-17 20:22:09.278', '2026-10-17 20:22:09.277'),
    ('5ca5512c-f7ea-465d-9ec3-f80ddea00bc6', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440112', NULL, 2, 3933, 4418, '2026-10-17 20:22:26.750', 'OWN', '{"lineResult": "won_clean"}'::jsonb, 'live-capture', true, 'de2398b2-0d08-47ce-9b9d-1cf0259146cf', '2026-10-17 20:22:26.790', '2026-10-17 20:22:26.789'),
    ('418b867f-df31-40c5-aa28-58a18c0bb254', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440123', NULL, 2, 3986, 4471, '2026-10-17 20:23:19.550', 'OPPONENT', '{"reason": "cynical_foul"}'::jsonb, 'live-capture', true, 'a509e4e2-1826-44cf-a612-7ae7c3ea7430', '2026-10-17 20:23:19.575', '2026-10-17 20:23:19.574'),
    ('f6945b96-c0f9-4d51-8ab5-9956759e2680', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440122', NULL, 2, 3962, 4448, '2026-10-17 20:22:56.057', 'OPPONENT', '{"penaltyType": "offside"}'::jsonb, 'live-capture', false, '3a2e73a1-2726-4741-a87c-5fdbc535b05d', '2026-10-17 20:22:56.094', '2026-10-17 20:23:22.690'),
    ('28acbd01-45de-4ddc-9419-532a730bdda5', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440112', NULL, 2, 4040, 4526, '2026-10-17 20:24:14.005', 'OWN', '{"lineResult": "won_clean"}'::jsonb, 'live-capture', true, '03b14571-efa5-4891-b67b-ba6d5ce16613', '2026-10-17 20:24:14.047', '2026-10-17 20:24:14.046'),
    ('4aa4b444-6f77-48a5-a1d4-ff02a2662e98', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440101', NULL, 2, 4048, 4534, '2026-10-17 20:24:21.867', 'OWN', '{"zone": "left"}'::jsonb, 'live-capture', true, 'fb1e5c6d-efb1-470c-8d5c-d72de3b5ac84', '2026-10-17 20:24:21.899', '2026-10-17 20:24:21.898'),
    ('e4bab5fc-12dd-4272-8e61-c1a1e2790e8a', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440102', '11111111-1111-1111-1111-000000000115', 2, 4084, 4570, '2026-10-17 20:24:58.330', 'OWN', '{"playerNumber": 15, "wasSuccessful": false}'::jsonb, 'live-capture', true, '5d4854e7-8a6a-496e-8239-8bd6652545d0', '2026-10-17 20:24:58.382', '2026-10-17 20:24:58.380'),
    ('ec9c3932-e96c-4b53-a4b0-676e47943d31', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440113', NULL, 2, 4136, 4622, '2026-10-17 20:25:50.257', 'OPPONENT', '{"outcome": "regained_attack"}'::jsonb, 'live-capture', true, '810d763a-fc25-47f9-b036-6a912c4838a9', '2026-10-17 20:25:50.290', '2026-10-17 20:25:50.289'),
    ('c597bfe0-c39c-4535-84ac-1038d102b1b6', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440117', NULL, 2, 4141, 4626, '2026-10-17 20:25:54.698', 'OWN', '{"stealType": "knock_on"}'::jsonb, 'live-capture', true, 'e9cd1a54-b44b-4311-9ac5-a9c250ef1869', '2026-10-17 20:25:54.737', '2026-10-17 20:25:54.736'),
    ('dab1a9c1-b860-4912-8549-935f433f6952', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440128', '11111111-1111-1111-1111-000000000115', 2, 4264, 4749, '2026-10-17 20:27:57.783', 'OWN', '{"kind": "penalty_touch", "playerNumber": 15}'::jsonb, 'live-capture', true, '372f2f0c-f024-40a3-ba9e-7446dda00562', '2026-10-17 20:27:57.830', '2026-10-17 20:27:57.829'),
    ('72a29692-28b0-4586-8d23-b8a9e6eb51aa', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440110', NULL, 2, 4293, 4779, '2026-10-17 20:28:27.450', 'OPPONENT', '{"outcome": "out_in_full"}'::jsonb, 'live-capture', true, 'f5cf72b5-df43-471a-a883-de2b81ac2a1f', '2026-10-17 20:28:27.489', '2026-10-17 20:28:27.488'),
    ('e68fa5ca-84fb-4279-983b-a736abc75531', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440112', NULL, 2, 4317, 4803, '2026-10-17 20:28:51.340', 'OWN', '{"lineResult": "won_clean"}'::jsonb, 'live-capture', true, 'c26c94fb-4363-4847-8f8a-871bf39b5766', '2026-10-17 20:28:51.381', '2026-10-17 20:28:51.380'),
    ('669ec3c6-1606-4db9-a07b-298834479fd6', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440122', NULL, 2, 4383, 4869, '2026-10-17 20:29:57.040', 'OPPONENT', '{"penaltyType": "offside"}'::jsonb, 'live-capture', true, 'cbd645ce-da95-4a45-87be-a6eb57b5c843', '2026-10-17 20:29:57.075', '2026-10-17 20:29:57.074'),
    ('91061946-13c7-4eaf-9c54-8caa4716a750', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440122', NULL, 2, 4452, 4937, '2026-10-17 20:31:05.694', 'OWN', '{"penaltyType": "side_entry"}'::jsonb, 'live-capture', true, 'd9f22aae-e756-495c-a5fd-5e022be608b7', '2026-10-17 20:31:05.740', '2026-10-17 20:31:05.739'),
    ('eebc8376-4f57-40aa-acac-b69815fc9ab4', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440128', NULL, 2, 4460, 4945, '2026-10-17 20:31:13.639', 'OPPONENT', '{"kind": "penalty_touch"}'::jsonb, 'live-capture', true, '0ed7dfb8-e842-46f7-961e-7959d58c1577', '2026-10-17 20:31:13.682', '2026-10-17 20:31:13.680'),
    ('696a4f7e-e103-4cc4-9ae9-683750192e01', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440112', NULL, 2, 4495, 4980, '2026-10-17 20:31:48.667', 'OPPONENT', '{"lineResult": "penalty_against"}'::jsonb, 'live-capture', true, '26ed2c3f-a4c4-4591-88d2-4fc1cd08368b', '2026-10-17 20:31:48.714', '2026-10-17 20:31:48.712'),
    ('9134146b-33e3-4186-9fff-6f34372b9f20', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440101', NULL, 2, 4615, 5101, '2026-10-17 20:33:49.366', 'OPPONENT', '{"zone": "center"}'::jsonb, 'live-capture', true, 'bdbbb55a-157e-466e-8456-931b80a4c92f', '2026-10-17 20:33:49.400', '2026-10-17 20:33:49.399'),
    ('98841f97-b21f-4fd1-bb7f-d7c1d9d4ca60', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440111', NULL, 2, 4181, 4667, '2026-10-17 20:26:34.852', 'OWN', '{"scrumResult": "won_clean"}'::jsonb, 'live-capture', true, '43b8f1ee-a81e-4df6-b2fd-73dcc0504321', '2026-10-17 20:26:34.874', '2026-10-17 20:26:34.873'),
    ('abf84c34-046d-4f63-ab92-35e59f8c204f', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440111', NULL, 2, 4213, 4698, '2026-10-17 20:27:06.549', 'OWN', '{"scrumResult": "won_clean"}'::jsonb, 'live-capture', true, '9e43fda2-dbc4-400a-8377-63784e8f8316', '2026-10-17 20:27:06.592', '2026-10-17 20:27:06.591'),
    ('dbd44f46-6601-4c75-856b-1599c20e09cd', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440122', NULL, 2, 4252, 4738, '2026-10-17 20:27:46.244', 'OPPONENT', '{"penaltyType": "side_entry"}'::jsonb, 'live-capture', true, 'd5354757-743c-49c3-a11f-163e51659287', '2026-10-17 20:27:46.265', '2026-10-17 20:27:46.264'),
    ('844efaa7-bbfc-472f-90a6-64f5cf34f6ee', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440112', NULL, 2, 4291, 4777, '2026-10-17 20:28:24.925', 'OWN', '{"lineResult": "lost"}'::jsonb, 'live-capture', true, 'ad22a6ff-ce23-4bd0-8e25-e25fca75bac4', '2026-10-17 20:28:24.953', '2026-10-17 20:28:24.953'),
    ('d47c61f9-c8c9-4fbc-aee4-5521eb6bbfb7', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440128', NULL, 2, 4396, 4881, '2026-10-17 20:30:09.620', 'OWN', '{"kind": "penalty_touch"}'::jsonb, 'live-capture', true, 'ac77cbcb-898b-4fe7-a163-d2bf8b2e38ac', '2026-10-17 20:30:09.660', '2026-10-17 20:30:09.659'),
    ('c273a759-5592-45ca-a6a8-0a842857ca39', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440112', NULL, 2, 4418, 4903, '2026-10-17 20:30:31.794', 'OWN', '{"lineResult": "won_clean"}'::jsonb, 'live-capture', true, '9ce40357-07dc-4085-a796-655306777d76', '2026-10-17 20:30:31.837', '2026-10-17 20:30:31.836'),
    ('51d7a97b-6203-478b-ae52-b5ae3eee6148', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440122', NULL, 2, 4523, 5009, '2026-10-17 20:32:17.203', 'OWN', '{"penaltyType": "holding_on"}'::jsonb, 'live-capture', true, 'afd5b1c3-af30-432f-8873-e978553ceea0', '2026-10-17 20:32:17.239', '2026-10-17 20:32:17.238'),
    ('cac16e16-1b5f-44ba-aaa1-efa7ef5b5b6d', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440128', NULL, 2, 4535, 5021, '2026-10-17 20:32:29.313', 'OPPONENT', '{"kind": "penalty_touch"}'::jsonb, 'live-capture', true, 'a8f4d6b1-fee2-4bb4-9ba9-62d9ff35c4c8', '2026-10-17 20:32:29.349', '2026-10-17 20:32:29.348'),
    ('d42c57a2-dd27-4f70-bb27-9b38ee2b60b8', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440112', NULL, 2, 4563, 5049, '2026-10-17 20:32:57.189', 'OPPONENT', '{"lineResult": "won_clean"}'::jsonb, 'live-capture', true, '909fb632-406d-45ef-acd2-43b883f7f148', '2026-10-17 20:32:57.226', '2026-10-17 20:32:57.225'),
    ('4d73b98c-99f6-4f6d-8b45-c3fce5af3c88', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440109', NULL, 2, 4611, 5096, '2026-10-17 20:33:44.642', 'OPPONENT', NULL, 'live-capture', true, '2603af41-f12d-45c6-9ff3-14b29b5a6c35', '2026-10-17 20:33:44.682', '2026-10-17 20:33:44.681'),
    ('366e9773-8397-4046-ad04-fcf8064d9af4', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440102', NULL, 2, 4644, 5130, '2026-10-17 20:34:18.280', 'OPPONENT', '{"wasSuccessful": true}'::jsonb, 'live-capture', true, 'dd6cce09-efe2-4489-8aec-5f3a87c45cf1',     '2026-10-17 20:34:18.312', '2026-10-17 20:34:18.311'),
    ('0706f54a-b7f8-499e-a56f-5712911de60e', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440113', NULL, 2, 4688, 5173, '2026-10-17 20:35:01.597', 'OWN', '{"outcome": "received_clean"}'::jsonb, 'live-capture', true, '42265dcd-f282-4ee5-8cc8-347f60034f7e', '2026-10-17 20:35:01.639', '2026-10-17 20:35:01.638'),
    ('77c001ec-e397-4c22-a4d6-affdfce03d2c', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440110', NULL, 2, 4693, 5179, '2026-10-17 20:35:07.495', 'OPPONENT', '{"outcome": "out_in_full"}'::jsonb, 'live-capture', true, 'c574fd3e-baef-4ab2-82a2-2ec7faa6577e', '2026-10-17 20:35:07.535', '2026-10-17 20:35:07.534'),
    ('4b774604-9f6e-4b6e-bf19-0418bcede344', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440112', NULL, 2, 4721, 5206, '2026-10-17 20:35:34.757', 'OWN', '{"lineResult": "won_clean"}'::jsonb, 'live-capture', true, 'd496b1b3-ca1a-44d7-99ee-7748f1ddb4e4', '2026-10-17 20:35:34.797', '2026-10-17 20:35:34.796'),
    ('86a154a4-c2e4-45ad-8a6c-5040d5b00110', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440122', NULL, 2, 4758, 5244, '2026-10-17 20:36:12.347', 'OWN', '{"penaltyType": "holding_on"}'::jsonb, 'live-capture', true, 'c6719c2e-79c7-42f5-a572-0cee5c7d4725', '2026-10-17 20:36:12.381', '2026-10-17 20:36:12.380'),
    ('f29ab027-9476-4f76-a984-6217fb8d88c3', '24a0cbdc-4667-4099-b16f-abc64f388345', '550e8400-e29b-41d4-a716-446655440109', NULL, 2, 4770, 5256, '2026-10-17 20:36:23.955', 'OPPONENT', NULL, 'live-capture', true, 'dfee8a28-1bd0-4504-b7f7-061304738d81', '2026-10-17 20:36:23.995', '2026-10-17 20:36:23.995');


-- =========================================
-- NORMALIZACIÓN DEL ORDEN DEL PLANTEL
-- Se conserva la convocatoria original y se completa slot_order a partir del número
-- de camiseta para que las sustituciones puedan resolver titulares (0-14) y suplentes (0-7).
-- =========================================
WITH ranked_roster AS (
    SELECT
        mp.id,
        ROW_NUMBER() OVER (
            PARTITION BY mp.match_id, mp.role
            ORDER BY dp.jersey_number, mp.id
        ) - 1 AS slot_order
    FROM matches_players mp
    JOIN division_players dp ON dp.id = mp.division_id
)
UPDATE matches_players mp
SET slot_order = ranked_roster.slot_order
FROM ranked_roster
WHERE mp.id = ranked_roster.id;

-- =========================================
-- COMPLETADO POST-PARTIDO DE LOS DOS PARTIDOS ORIGINALES
-- Solo se agregan claves que faltaban. Los atributos live existentes se preservan.
-- =========================================
UPDATE events AS e
SET attributes = COALESCE(e.attributes, '{}'::jsonb) || v.delta
FROM (
    VALUES

        ('0d4ed899-df2b-42d4-bd3d-6a10a27fc871'::uuid, '{"outcome":"retained"}'::jsonb),
        ('2792bf28-38c9-45eb-aa3e-e9cd2b01b363'::uuid, '{"outcome":"opp_possession"}'::jsonb),
        ('b1977aef-cc8c-4782-83ab-787ae75d284e'::uuid, '{"outcome":"opp_possession"}'::jsonb),
        ('51b9a6f4-6196-45af-a068-dde72ad9b34f'::uuid, '{"kickType":"tactical"}'::jsonb),
        ('3be402d8-cfb2-4420-818d-f056a4d31462'::uuid, '{"distanceMeters":24,"zone":"right"}'::jsonb),
        ('88654ed2-f72b-4216-b967-25f104567fdd'::uuid, '{"stealType":"dropped_unforced"}'::jsonb),
        ('fc933ab9-a894-45d9-ae9f-f5d2d224422b'::uuid, '{"jumpZone":"front","isMaulFormed":true}'::jsonb),
        ('333df087-35fa-4447-80e4-00ac37e7d887'::uuid, '{"jumpZone":"back","isMaulFormed":true}'::jsonb),
        ('7effc9c5-9399-4160-ad2f-3b9646782ad7'::uuid, '{"stealType":"rip_standing"}'::jsonb),
        ('b2e6bb64-54b8-416e-8c55-20f6d587b4cd'::uuid, '{"kickType":"up_under"}'::jsonb),
        ('b349ff8b-3e74-46f1-8034-5a160f7ac5a3'::uuid, '{"jumpZone":"middle","isMaulFormed":true}'::jsonb),
        ('2ed4f014-11e3-4063-809d-4b76b591a46c'::uuid, '{"distanceMeters":22,"zone":"left"}'::jsonb),
        ('ce96ce37-e347-44d9-a527-32bf68d4d0f4'::uuid, '{"kickType":"22m_drop"}'::jsonb),
        ('e00bf5ae-6426-4689-819b-2c11679ea261'::uuid, '{"stealType":"jackal_ruck"}'::jsonb),
        ('8137b9a0-0c17-4986-83b6-9fc24d523ef3'::uuid, '{"jumpZone":"front","isMaulFormed":true}'::jsonb),
        ('f8860a64-dec6-4e15-985e-9ab7a1e0383d'::uuid, '{"metersGained":1}'::jsonb),
        ('1ccf0cf7-7a24-4a5b-8773-f8897db68d46'::uuid, '{"metersGained":17}'::jsonb),
        ('f9a5f63b-5a6d-4350-bde6-98d16b9d0f09'::uuid, '{"jumpZone":"back","isMaulFormed":true}'::jsonb),
        ('9a4135bd-7e33-485e-aecc-f422a8268ce3'::uuid, '{"distanceMeters":21,"zone":"right"}'::jsonb),
        ('59760b74-a068-4ef2-a429-25ba124e6db2'::uuid, '{"kickType":"22m_drop"}'::jsonb),
        ('d2efb71d-b0dd-4043-b55b-b3652caca725'::uuid, '{"kickType":"50_22"}'::jsonb),
        ('addbb3ab-64f1-420b-8ef8-52d85ae5a3a4'::uuid, '{"jumpZone":"back","isMaulFormed":false}'::jsonb),
        ('bc61e2c0-0fce-4a6c-9c31-63f0f9635e9b'::uuid, '{"stealType":"pushed_touch"}'::jsonb),
        ('94e0741f-fe2f-4238-a140-d89be7d1460b'::uuid, '{"jumpZone":"front","isMaulFormed":true}'::jsonb),
        ('6623b0d0-b93d-4872-9331-7adf83a3fe39'::uuid, '{"jumpZone":"front","isMaulFormed":false}'::jsonb),
        ('62affbc0-e10f-4ac8-9d2b-6e65c2a46bc2'::uuid, '{"jumpZone":"back","isMaulFormed":false}'::jsonb),
        ('7497a102-ee66-4104-98ea-f2dd2292af66'::uuid, '{"metersGained":10}'::jsonb),
        ('2a0a3e21-1a15-4732-b8e7-d28e0f755252'::uuid, '{"distanceMeters":43,"zone":"left"}'::jsonb),
        ('e64ad6a3-90cc-49f5-af87-030cdba93cb4'::uuid, '{"kickType":"halfway_start"}'::jsonb),
        ('864539bb-a515-48c2-8591-becb7de20404'::uuid, '{"stealType":"offensive_penalty"}'::jsonb),
        ('77d1cc01-abf8-41b6-9ea1-aa4cec5bc8b0'::uuid, '{"jumpZone":"back","isMaulFormed":true}'::jsonb),
        ('17e603b0-c85b-46ca-a32e-5b7f66c5dc10'::uuid, '{"jumpZone":"front","isMaulFormed":false}'::jsonb),
        ('c9e3179e-c9d1-4725-be5b-5f378117c883'::uuid, '{"stealType":"jackal_ruck"}'::jsonb),
        ('1c8c87a6-6620-46b0-90fa-4425d08a2f13'::uuid, '{"kickType":"tactical"}'::jsonb),
        ('4c2840bb-3ae6-4147-8f14-bad215ff763b'::uuid, '{"jumpZone":"back","isMaulFormed":false}'::jsonb),
        ('d3d87ed5-8d62-401b-bcba-d9680e5e47d7'::uuid, '{"stealType":"rip_standing"}'::jsonb),
        ('d430f6b6-4d6e-4baa-8d35-0b6e9f7c0c56'::uuid, '{"jumpZone":"middle","isMaulFormed":false}'::jsonb),
        ('8f41afd8-caed-4ee5-a339-ffa00f9b52fb'::uuid, '{"distanceMeters":42,"zone":"right"}'::jsonb),
        ('abb49554-70d3-49f5-9c50-5d18e03ca1d5'::uuid, '{"kickType":"50_22"}'::jsonb),
        ('f0b27c59-705f-41b0-a199-84d12d9d61b4'::uuid, '{"stealType":"offensive_penalty"}'::jsonb),
        ('fba9a95b-ee2f-4fcd-a4fd-9c1242e79871'::uuid, '{"metersGained":13}'::jsonb),
        ('6b3bc139-df73-4564-94ec-56fbf2bf1851'::uuid, '{"distanceMeters":40,"zone":"center"}'::jsonb),
        ('c321283e-17ca-4625-931d-cc5ea96b8843'::uuid, '{"kickType":"22m_drop"}'::jsonb),
        ('3b2b70be-dc8b-4845-a32c-c9c1cfc6bcb7'::uuid, '{"kickType":"tactical"}'::jsonb),
        ('a4099269-0fb1-4edf-90f4-e892212e8470'::uuid, '{"jumpZone":"back","isMaulFormed":true}'::jsonb),
        ('a10a32ed-976d-4e6c-8bba-ab278b78a8b6'::uuid, '{"jumpZone":"front","isMaulFormed":false}'::jsonb),
        ('67419d35-51bf-47af-a9b7-07b1640666b6'::uuid, '{"jumpZone":"front","isMaulFormed":false}'::jsonb),
        ('76dc9c3c-99a2-4197-a700-2c1f90ffd7c5'::uuid, '{"jumpZone":"back","isMaulFormed":true}'::jsonb),
        ('2934a722-fda7-40e9-956f-74a888838123'::uuid, '{"jumpZone":"back","isMaulFormed":false}'::jsonb),
        ('2b7898e2-4332-4ba9-aa6a-426e54162802'::uuid, '{"jumpZone":"middle","isMaulFormed":true}'::jsonb),
        ('77f5411e-b12e-4a2f-a037-9acec8568e08'::uuid, '{"kickType":"tactical"}'::jsonb),
        ('6db6b6f8-789d-4dcb-a26a-9067662a7a87'::uuid, '{"jumpZone":"middle","isMaulFormed":false}'::jsonb),
        ('757d3167-3be7-485e-be82-cf4fe9b14ea8'::uuid, '{"metersGained":12}'::jsonb),
        ('6a8384bb-794b-4e17-a6ce-0bda04236646'::uuid, '{"kickType":"goalline_drop"}'::jsonb),
        ('6389b6ba-b27a-4046-975a-a5b14a8be432'::uuid, '{"stealType":"jackal_ruck"}'::jsonb),
        ('89d790a1-cd4e-489e-881d-9a5419a7b502'::uuid, '{"stealType":"knock_on"}'::jsonb),
        ('99b5f2ab-fa7f-426d-949e-b03c1c09f7f4'::uuid, '{"playerOutNumber":3,"playerInNumber":16,"playerOutId":"11111111-1111-1111-1111-000000000103","playerInId":"11111111-1111-1111-1111-000000000116"}'::jsonb),
        ('2d1a824a-03c8-4d3c-9637-a546aa2dce3b'::uuid, '{"kickType":"halfway_start"}'::jsonb),
        ('57a0d980-8506-4c0f-a837-2cd59f2b55ac'::uuid, '{"kickType":"22m_drop"}'::jsonb),
        ('25dbec95-1065-4cd1-a3ea-a0d33b76c04f'::uuid, '{"metersGained":14}'::jsonb),
        ('77ece904-2e6a-4a11-b721-43d50d1ec583'::uuid, '{"jumpZone":"back","isMaulFormed":false}'::jsonb),
        ('3e3f91ba-c109-41ab-9fcb-8d8a0ac566cf'::uuid, '{"stealType":"dropped_unforced"}'::jsonb),
        ('0e3ee475-c8f1-4e0b-8535-63494146e6c1'::uuid, '{"stealType":"other"}'::jsonb),
        ('280eb22d-7f91-4360-8a10-10264a136df6'::uuid, '{"stealType":"forward_pass"}'::jsonb),
        ('36e9843f-4a98-4b30-b31e-db655a52412c'::uuid, '{"stealType":"jackal_ruck"}'::jsonb),
        ('01b2671b-dcde-4396-9cb6-22154830d02a'::uuid, '{"kickType":"tactical"}'::jsonb),
        ('b21f4616-32fa-4bbb-8112-6fd2b6961d04'::uuid, '{"stealType":"jackal_ruck"}'::jsonb),
        ('a59394b7-3b82-431a-b211-838e0e1adb84'::uuid, '{"kickType":"grubber"}'::jsonb),
        ('47367576-7637-4c4e-a47c-44756bb138ea'::uuid, '{"distanceMeters":34,"zone":"center"}'::jsonb),
        ('2256e660-290b-4b6a-ae1c-d68f6fab9fb3'::uuid, '{"kickType":"goalline_drop"}'::jsonb),
        ('33b2df09-a86c-4820-a4d3-3672d4572b66'::uuid, '{"metersGained":1}'::jsonb),
        ('04bc4695-93b1-4400-8ba1-5e35923f7736'::uuid, '{"distanceMeters":31,"zone":"center"}'::jsonb),
        ('4b6390b3-1047-4890-bf9d-96f186c59e25'::uuid, '{"kickType":"halfway_start"}'::jsonb),
        ('8088b3b0-4fa6-46dc-849e-97df19b5718e'::uuid, '{"kickType":"tactical"}'::jsonb),
        ('5ca5512c-f7ea-465d-9ec3-f80ddea00bc6'::uuid, '{"jumpZone":"back","isMaulFormed":false}'::jsonb),
        ('418b867f-df31-40c5-aa28-58a18c0bb254'::uuid, '{"durationMinutes":10}'::jsonb),
        ('28acbd01-45de-4ddc-9419-532a730bdda5'::uuid, '{"jumpZone":"back","isMaulFormed":true}'::jsonb),
        ('e4bab5fc-12dd-4272-8e61-c1a1e2790e8a'::uuid, '{"distanceMeters":35,"zone":"left"}'::jsonb),
        ('ec9c3932-e96c-4b53-a4b0-676e47943d31'::uuid, '{"kickType":"goalline_drop"}'::jsonb),
        ('72a29692-28b0-4586-8d23-b8a9e6eb51aa'::uuid, '{"kickType":"tactical"}'::jsonb),
        ('e68fa5ca-84fb-4279-983b-a736abc75531'::uuid, '{"jumpZone":"back","isMaulFormed":true}'::jsonb),
        ('696a4f7e-e103-4cc4-9ae9-683750192e01'::uuid, '{"jumpZone":"front","isMaulFormed":true}'::jsonb),
        ('844efaa7-bbfc-472f-90a6-64f5cf34f6ee'::uuid, '{"jumpZone":"middle","isMaulFormed":true}'::jsonb),
        ('c273a759-5592-45ca-a6a8-0a842857ca39'::uuid, '{"jumpZone":"back","isMaulFormed":true}'::jsonb),
        ('d42c57a2-dd27-4f70-bb27-9b38ee2b60b8'::uuid, '{"jumpZone":"front","isMaulFormed":false}'::jsonb),
        ('4d73b98c-99f6-4f6d-8b45-c3fce5af3c88'::uuid, '{"metersGained":7}'::jsonb),
        ('366e9773-8397-4046-ad04-fcf8064d9af4'::uuid, '{"distanceMeters":39,"zone":"right"}'::jsonb),
        ('0706f54a-b7f8-499e-a56f-5712911de60e'::uuid, '{"kickType":"22m_drop"}'::jsonb),
        ('77c001ec-e397-4c22-a4d6-affdfce03d2c'::uuid, '{"kickType":"grubber"}'::jsonb),
        ('4b774604-9f6e-4b6e-bf19-0418bcede344'::uuid, '{"jumpZone":"back","isMaulFormed":true}'::jsonb),
        ('f29ab027-9476-4f76-a984-6217fb8d88c3'::uuid, '{"metersGained":12}'::jsonb)

) AS v(id, delta)
WHERE e.id = v.id;

-- =========================================
-- CINCO PARTIDOS NUEVOS FINALIZADOS
-- Todos pertenecen a Primera del PMRC y utilizan rivales ya registrados.
-- =========================================
INSERT INTO matches
(id, date, division_id, opponent_id, status, current_period, clock_elapsed_seconds,
 clock_paused, clock_updated_at, current_possession, home_score, away_score, started_at, finished_at)
VALUES

    ('dd4e580d-b80a-50a1-a2de-c61737461705', '2026-08-23 15:30:00.000', '11111111-1111-1111-1111-000000000020', '22222222-1111-1111-1111-000000000002', 'FINISHED', 2, 4800, TRUE, '2026-08-23 17:06:00.000', 'OPPONENT', 24, 19, '2026-08-23 15:35:00.000', '2026-08-23 17:05:00.000'),
    ('a1eba5c7-5829-502d-8b07-3da0234883c6', '2026-08-30 15:30:00.000', '11111111-1111-1111-1111-000000000020', '22222222-1111-1111-1111-000000000003', 'FINISHED', 2, 4800, TRUE, '2026-08-30 17:06:00.000', 'OPPONENT', 31, 26, '2026-08-30 15:35:00.000', '2026-08-30 17:05:00.000'),
    ('f16dc0a8-76d3-5ff4-b472-fc80bcaaf4ca', '2026-09-06 15:30:00.000', '11111111-1111-1111-1111-000000000020', '22222222-1111-1111-1111-000000000004', 'FINISHED', 2, 4800, TRUE, '2026-09-06 17:06:00.000', 'OPPONENT', 17, 22, '2026-09-06 15:35:00.000', '2026-09-06 17:05:00.000'),
    ('18d2410f-2369-554e-ae72-b32cd1c33f2d', '2026-09-13 15:30:00.000', '11111111-1111-1111-1111-000000000020', '22222222-1111-1111-1111-000000000005', 'FINISHED', 2, 4800, TRUE, '2026-09-13 17:06:00.000', 'OWN', 28, 14, '2026-09-13 15:35:00.000', '2026-09-13 17:05:00.000'),
    ('8fa9735d-63cb-5489-8038-f33a1813d46a', '2026-09-20 15:30:00.000', '11111111-1111-1111-1111-000000000020', '22222222-1111-1111-1111-000000000006', 'FINISHED', 2, 4800, TRUE, '2026-09-20 17:06:00.000', 'OPPONENT', 19, 15, '2026-09-20 15:35:00.000', '2026-09-20 17:05:00.000');

-- =========================================
-- CONVOCATORIAS DE LOS CINCO PARTIDOS NUEVOS
-- 23 jugadores por partido: 15 titulares y 8 suplentes.
-- La rotación incluye a los 27 jugadores registrados en el plantel.
-- =========================================
INSERT INTO matches_players (id, role, division_id, match_id, slot_order, number, field_status, field_slot) VALUES
('a493977f-a2a7-5282-b3b2-b105d81c7894', 'TITULAR', '11111111-1111-1111-1111-000000000217', 'dd4e580d-b80a-50a1-a2de-c61737461705', 0, 1, 'EN_CANCHA', 1),
    ('7721a594-be83-54bd-a1b6-cb579f13aabf', 'TITULAR', '11111111-1111-1111-1111-000000000215', 'dd4e580d-b80a-50a1-a2de-c61737461705', 1, 2, 'EN_CANCHA', 2),
    ('0cc3dac9-7b2d-59e1-90ef-8d8131628140', 'TITULAR', '11111111-1111-1111-1111-000000000213', 'dd4e580d-b80a-50a1-a2de-c61737461705', 2, 3, 'EN_CANCHA', 3),
    ('85bc1ea7-3e9c-53bc-a8e4-179b80f8ecb2', 'TITULAR', '11111111-1111-1111-1111-000000000219', 'dd4e580d-b80a-50a1-a2de-c61737461705', 3, 4, 'EN_CANCHA', 4),
    ('d915f5a6-2cc1-519e-9379-589411f95d6c', 'TITULAR', '11111111-1111-1111-1111-000000000220', 'dd4e580d-b80a-50a1-a2de-c61737461705', 4, 5, 'EN_CANCHA', 5),
    ('0db779c5-89ea-50ae-9711-66774f81a2a2', 'TITULAR', '11111111-1111-1111-1111-000000000214', 'dd4e580d-b80a-50a1-a2de-c61737461705', 5, 6, 'EN_CANCHA', 6),
    ('b6c1d037-107a-5c06-96aa-01522f802b63', 'TITULAR', '11111111-1111-1111-1111-000000000212', 'dd4e580d-b80a-50a1-a2de-c61737461705', 6, 7, 'EN_CANCHA', 7),
    ('89bf194a-3041-51b4-99d1-43bd57dfaba9', 'TITULAR', '11111111-1111-1111-1111-000000000221', 'dd4e580d-b80a-50a1-a2de-c61737461705', 7, 8, 'EN_CANCHA', 8),
    ('6de2aeb7-dbc2-55ef-8919-bf3df3132d5a', 'TITULAR', '11111111-1111-1111-1111-000000000222', 'dd4e580d-b80a-50a1-a2de-c61737461705', 8, 9, 'EN_CANCHA', 9),
    ('3ca9254f-4919-50de-a792-5ca0cf0d791c', 'TITULAR', '11111111-1111-1111-1111-000000000203', 'dd4e580d-b80a-50a1-a2de-c61737461705', 9, 10, 'EN_CANCHA', 10),
    ('7c11ec5b-cb7d-5d0e-96a3-a32c4d8f0a6d', 'TITULAR', '11111111-1111-1111-1111-000000000218', 'dd4e580d-b80a-50a1-a2de-c61737461705', 10, 11, 'EN_CANCHA', 11),
    ('e4a033e5-b1ce-5e07-89a2-643f872b9a9c', 'TITULAR', '11111111-1111-1111-1111-000000000201', 'dd4e580d-b80a-50a1-a2de-c61737461705', 11, 12, 'EN_CANCHA', 12),
    ('bb8d99cb-d155-539b-a9b5-e7c04f164b77', 'TITULAR', '11111111-1111-1111-1111-000000000205', 'dd4e580d-b80a-50a1-a2de-c61737461705', 12, 13, 'EN_CANCHA', 13),
    ('8462ab3c-150a-5c95-9244-e2e1bb67cf56', 'TITULAR', '11111111-1111-1111-1111-000000000211', 'dd4e580d-b80a-50a1-a2de-c61737461705', 13, 14, 'EN_CANCHA', 14),
    ('ecc550c9-706a-5f47-ac04-4fe6c8a8da2d', 'TITULAR', '11111111-1111-1111-1111-000000000209', 'dd4e580d-b80a-50a1-a2de-c61737461705', 14, 15, 'EN_CANCHA', 15),
    ('2318ca5c-1d1b-50eb-9cca-d221cbb66ac8', 'SUPLENTE', '11111111-1111-1111-1111-000000000204', 'dd4e580d-b80a-50a1-a2de-c61737461705', 0, 16, 'EN_BANCO', NULL),
    ('32b4fbaa-e1d7-50f1-bcdd-eec62699d55e', 'SUPLENTE', '11111111-1111-1111-1111-000000000208', 'dd4e580d-b80a-50a1-a2de-c61737461705', 1, 17, 'EN_BANCO', NULL),
    ('a9725e4a-f9e0-53a1-aa7e-cbf99738dc45', 'SUPLENTE', '11111111-1111-1111-1111-000000000206', 'dd4e580d-b80a-50a1-a2de-c61737461705', 2, 18, 'EN_BANCO', NULL),
    ('b090e0fd-aa1f-583c-81ea-221532a4134f', 'SUPLENTE', '11111111-1111-1111-1111-000000000210', 'dd4e580d-b80a-50a1-a2de-c61737461705', 3, 19, 'EN_BANCO', NULL),
    ('e0cf4601-8b23-58dc-a821-e1a35a6e3b69', 'SUPLENTE', '11111111-1111-1111-1111-000000000216', 'dd4e580d-b80a-50a1-a2de-c61737461705', 4, 20, 'EN_BANCO', NULL),
    ('3d8a3255-ca04-5878-b483-3e4369e86775', 'SUPLENTE', '11111111-1111-1111-1111-000000000202', 'dd4e580d-b80a-50a1-a2de-c61737461705', 5, 21, 'EN_BANCO', NULL),
    ('86bae116-7c9f-5bd0-b78e-52a685362f81', 'SUPLENTE', '11111111-1111-1111-1111-000000000223', 'dd4e580d-b80a-50a1-a2de-c61737461705', 6, 22, 'EN_BANCO', NULL),
    ('91878fe8-0316-539f-8c35-ece521a02413', 'SUPLENTE', '11111111-1111-1111-1111-000000000207', 'dd4e580d-b80a-50a1-a2de-c61737461705', 7, 23, 'EN_BANCO', NULL),
    ('3035e5de-6d22-5749-8eaa-79cf10e71be8', 'TITULAR', '11111111-1111-1111-1111-000000000225', 'a1eba5c7-5829-502d-8b07-3da0234883c6', 0, 1, 'EN_CANCHA', 1),
    ('143972ce-a40a-5a39-b0d2-b53962b04182', 'TITULAR', '11111111-1111-1111-1111-000000000214', 'a1eba5c7-5829-502d-8b07-3da0234883c6', 1, 2, 'EN_CANCHA', 2),
    ('7eff84bf-91f8-5ef5-b647-1cb292868b15', 'TITULAR', '11111111-1111-1111-1111-000000000207', 'a1eba5c7-5829-502d-8b07-3da0234883c6', 2, 3, 'EN_CANCHA', 3),
    ('1dffd86f-0c3d-5926-b134-8283d1e41c02', 'TITULAR', '11111111-1111-1111-1111-000000000217', 'a1eba5c7-5829-502d-8b07-3da0234883c6', 3, 4, 'EN_CANCHA', 4),
    ('ed787d43-aae4-59fe-98e0-13930ad081bf', 'TITULAR', '11111111-1111-1111-1111-000000000202', 'a1eba5c7-5829-502d-8b07-3da0234883c6', 4, 5, 'EN_CANCHA', 5),
    ('67b81e23-c348-5155-bb58-bee7481a79ca', 'TITULAR', '11111111-1111-1111-1111-000000000205', 'a1eba5c7-5829-502d-8b07-3da0234883c6', 5, 6, 'EN_CANCHA', 6),
    ('2647b242-d431-5c32-af32-d788a024799b', 'TITULAR', '11111111-1111-1111-1111-000000000204', 'a1eba5c7-5829-502d-8b07-3da0234883c6', 6, 7, 'EN_CANCHA', 7),
    ('a42a4ae0-4781-5a41-a010-e3e27754f540', 'TITULAR', '11111111-1111-1111-1111-000000000221', 'a1eba5c7-5829-502d-8b07-3da0234883c6', 7, 8, 'EN_CANCHA', 8),
    ('b21dcfbb-8819-5630-bdac-73c5e470eb3e', 'TITULAR', '11111111-1111-1111-1111-000000000213', 'a1eba5c7-5829-502d-8b07-3da0234883c6', 8, 9, 'EN_CANCHA', 9),
    ('d3d530b9-429f-51e6-89fe-33b9b799f0cd', 'TITULAR', '11111111-1111-1111-1111-000000000210', 'a1eba5c7-5829-502d-8b07-3da0234883c6', 9, 10, 'EN_CANCHA', 10),
    ('63ff6665-cf99-5305-afb8-fa47c8e1a035', 'TITULAR', '11111111-1111-1111-1111-000000000215', 'a1eba5c7-5829-502d-8b07-3da0234883c6', 10, 11, 'EN_CANCHA', 11),
    ('04e2c6bf-5eca-5864-ba98-7238662072cd', 'TITULAR', '11111111-1111-1111-1111-000000000212', 'a1eba5c7-5829-502d-8b07-3da0234883c6', 11, 12, 'EN_CANCHA', 12),
    ('c08d7f0e-993e-54e3-ab82-cdd82157d332', 'TITULAR', '11111111-1111-1111-1111-000000000211', 'a1eba5c7-5829-502d-8b07-3da0234883c6', 12, 13, 'EN_CANCHA', 13),
    ('b432430a-5c3b-5e80-9bc6-2b6636efd399', 'TITULAR', '11111111-1111-1111-1111-000000000223', 'a1eba5c7-5829-502d-8b07-3da0234883c6', 13, 14, 'EN_CANCHA', 14),
    ('9df8427f-29af-57ed-883d-e16920e382e8', 'TITULAR', '11111111-1111-1111-1111-000000000224', 'a1eba5c7-5829-502d-8b07-3da0234883c6', 14, 15, 'EN_CANCHA', 15),
    ('bec0d1af-8cc1-5bb1-a816-424eb8ce6e2d', 'SUPLENTE', '11111111-1111-1111-1111-000000000227', 'a1eba5c7-5829-502d-8b07-3da0234883c6', 0, 16, 'EN_BANCO', NULL),
    ('de21fc73-87d8-5d8b-93e9-64dd059dbd0b', 'SUPLENTE', '11111111-1111-1111-1111-000000000219', 'a1eba5c7-5829-502d-8b07-3da0234883c6', 1, 17, 'EN_BANCO', NULL),
    ('17aca940-7cbb-5844-bd19-561ccf715281', 'SUPLENTE', '11111111-1111-1111-1111-000000000218', 'a1eba5c7-5829-502d-8b07-3da0234883c6', 2, 18, 'EN_BANCO', NULL),
    ('e62ce7f4-4b95-593d-be37-c77296e3e8d8', 'SUPLENTE', '11111111-1111-1111-1111-000000000203', 'a1eba5c7-5829-502d-8b07-3da0234883c6', 3, 19, 'EN_BANCO', NULL),
    ('314476b8-304f-50fc-aee4-54df876d809f', 'SUPLENTE', '11111111-1111-1111-1111-000000000226', 'a1eba5c7-5829-502d-8b07-3da0234883c6', 4, 20, 'EN_BANCO', NULL),
    ('2d338027-735a-5442-a6aa-5f577734b3e5', 'SUPLENTE', '11111111-1111-1111-1111-000000000220', 'a1eba5c7-5829-502d-8b07-3da0234883c6', 5, 21, 'EN_BANCO', NULL),
    ('bee0295d-f2b8-5e26-96e2-ca40ab737345', 'SUPLENTE', '11111111-1111-1111-1111-000000000208', 'a1eba5c7-5829-502d-8b07-3da0234883c6', 6, 22, 'EN_BANCO', NULL),
    ('a651dd4c-fd93-5ae9-8a94-06604cc217ea', 'SUPLENTE', '11111111-1111-1111-1111-000000000206', 'a1eba5c7-5829-502d-8b07-3da0234883c6', 7, 23, 'EN_BANCO', NULL),
    ('fda7f781-f4b9-579e-8860-638533fb9b9c', 'TITULAR', '11111111-1111-1111-1111-000000000212', 'f16dc0a8-76d3-5ff4-b472-fc80bcaaf4ca', 0, 1, 'EN_CANCHA', 1),
    ('7ace3908-aa6c-5af9-9568-329a88363661', 'TITULAR', '11111111-1111-1111-1111-000000000218', 'f16dc0a8-76d3-5ff4-b472-fc80bcaaf4ca', 1, 2, 'EN_CANCHA', 2),
    ('d9ed07f5-4d49-53f3-b2bc-22e94ccbc54c', 'TITULAR', '11111111-1111-1111-1111-000000000226', 'f16dc0a8-76d3-5ff4-b472-fc80bcaaf4ca', 2, 3, 'EN_CANCHA', 3),
    ('10f99331-ad35-5b1f-a999-0d1d477783b9', 'TITULAR', '11111111-1111-1111-1111-000000000203', 'f16dc0a8-76d3-5ff4-b472-fc80bcaaf4ca', 3, 4, 'EN_CANCHA', 4),
    ('0adef0c0-757e-5d24-bc2a-0324b4ec6f12', 'TITULAR', '11111111-1111-1111-1111-000000000204', 'f16dc0a8-76d3-5ff4-b472-fc80bcaaf4ca', 4, 5, 'EN_CANCHA', 5),
    ('207c1229-ced0-570e-9edb-95121ccea739', 'TITULAR', '11111111-1111-1111-1111-000000000211', 'f16dc0a8-76d3-5ff4-b472-fc80bcaaf4ca', 5, 6, 'EN_CANCHA', 6),
    ('ff203941-2a8f-5e38-80c9-b994c46071ff', 'TITULAR', '11111111-1111-1111-1111-000000000225', 'f16dc0a8-76d3-5ff4-b472-fc80bcaaf4ca', 6, 7, 'EN_CANCHA', 7),
    ('ff0bda81-58ac-5091-9209-c0409b8234d1', 'TITULAR', '11111111-1111-1111-1111-000000000209', 'f16dc0a8-76d3-5ff4-b472-fc80bcaaf4ca', 7, 8, 'EN_CANCHA', 8),
    ('c6eaae45-f207-5a24-aa96-454f87e22006', 'TITULAR', '11111111-1111-1111-1111-000000000222', 'f16dc0a8-76d3-5ff4-b472-fc80bcaaf4ca', 8, 9, 'EN_CANCHA', 9),
    ('5ed5926a-fef5-5edd-94ff-6bcef8699816', 'TITULAR', '11111111-1111-1111-1111-000000000221', 'f16dc0a8-76d3-5ff4-b472-fc80bcaaf4ca', 9, 10, 'EN_CANCHA', 10),
    ('1a6d5ba0-461d-5ae1-b51a-3a5933664c97', 'TITULAR', '11111111-1111-1111-1111-000000000205', 'f16dc0a8-76d3-5ff4-b472-fc80bcaaf4ca', 10, 11, 'EN_CANCHA', 11),
    ('11dadb01-f520-592c-81c5-1c9140ee6eb2', 'TITULAR', '11111111-1111-1111-1111-000000000227', 'f16dc0a8-76d3-5ff4-b472-fc80bcaaf4ca', 11, 12, 'EN_CANCHA', 12),
    ('5d635989-621d-5180-8b2f-5ca0efb3acf9', 'TITULAR', '11111111-1111-1111-1111-000000000214', 'f16dc0a8-76d3-5ff4-b472-fc80bcaaf4ca', 12, 13, 'EN_CANCHA', 13),
    ('729b95fe-0087-547a-bf42-df712ba79c82', 'TITULAR', '11111111-1111-1111-1111-000000000207', 'f16dc0a8-76d3-5ff4-b472-fc80bcaaf4ca', 13, 14, 'EN_CANCHA', 14),
    ('7f783658-4b3e-5c4c-b529-7fab8edc8576', 'TITULAR', '11111111-1111-1111-1111-000000000215', 'f16dc0a8-76d3-5ff4-b472-fc80bcaaf4ca', 14, 15, 'EN_CANCHA', 15),
    ('b9bcc73f-a4ff-55a8-8a79-a2fd7ab87ce5', 'SUPLENTE', '11111111-1111-1111-1111-000000000216', 'f16dc0a8-76d3-5ff4-b472-fc80bcaaf4ca', 0, 16, 'EN_BANCO', NULL),
    ('43e32071-6165-5c32-a89b-0ef3419d3b30', 'SUPLENTE', '11111111-1111-1111-1111-000000000220', 'f16dc0a8-76d3-5ff4-b472-fc80bcaaf4ca', 1, 17, 'EN_BANCO', NULL),
    ('b44234d2-bb15-5df1-b9a7-7c7f3cb3a26e', 'SUPLENTE', '11111111-1111-1111-1111-000000000219', 'f16dc0a8-76d3-5ff4-b472-fc80bcaaf4ca', 2, 18, 'EN_BANCO', NULL),
    ('6cb1eda5-c607-52e9-8c0d-6731b83f2bd3', 'SUPLENTE', '11111111-1111-1111-1111-000000000213', 'f16dc0a8-76d3-5ff4-b472-fc80bcaaf4ca', 3, 19, 'EN_BANCO', NULL),
    ('6963adf3-a8fc-511f-9fad-88805afebaf3', 'SUPLENTE', '11111111-1111-1111-1111-000000000224', 'f16dc0a8-76d3-5ff4-b472-fc80bcaaf4ca', 4, 20, 'EN_BANCO', NULL),
    ('26622d74-7a87-52f4-b858-77275ced5ebf', 'SUPLENTE', '11111111-1111-1111-1111-000000000201', 'f16dc0a8-76d3-5ff4-b472-fc80bcaaf4ca', 5, 21, 'EN_BANCO', NULL),
    ('4e1fae20-b041-59fb-8180-5a70ce142fb7', 'SUPLENTE', '11111111-1111-1111-1111-000000000208', 'f16dc0a8-76d3-5ff4-b472-fc80bcaaf4ca', 6, 22, 'EN_BANCO', NULL),
    ('2cce97eb-3431-5eda-a654-14dba19cc78a', 'SUPLENTE', '11111111-1111-1111-1111-000000000206', 'f16dc0a8-76d3-5ff4-b472-fc80bcaaf4ca', 7, 23, 'EN_BANCO', NULL),
    ('d8e83523-398b-51d9-9619-fdee7b9d5f14', 'TITULAR', '11111111-1111-1111-1111-000000000219', '18d2410f-2369-554e-ae72-b32cd1c33f2d', 0, 1, 'EN_CANCHA', 1),
    ('22033541-cb35-5717-97e2-abe2e1fc4396', 'TITULAR', '11111111-1111-1111-1111-000000000207', '18d2410f-2369-554e-ae72-b32cd1c33f2d', 1, 2, 'EN_CANCHA', 2),
    ('68dd733b-f968-5459-89a3-127d9d832b47', 'TITULAR', '11111111-1111-1111-1111-000000000209', '18d2410f-2369-554e-ae72-b32cd1c33f2d', 2, 3, 'EN_CANCHA', 3),
    ('b12def36-ee0f-50a2-a1a7-52f04b3fd4e9', 'TITULAR', '11111111-1111-1111-1111-000000000201', '18d2410f-2369-554e-ae72-b32cd1c33f2d', 3, 4, 'EN_CANCHA', 4),
    ('7f33ccc8-3301-567a-b4c1-1245d435b747', 'TITULAR', '11111111-1111-1111-1111-000000000205', '18d2410f-2369-554e-ae72-b32cd1c33f2d', 4, 5, 'EN_CANCHA', 5),
    ('2f215b01-1aef-5801-9a77-e4f48d90ec81', 'TITULAR', '11111111-1111-1111-1111-000000000215', '18d2410f-2369-554e-ae72-b32cd1c33f2d', 5, 6, 'EN_CANCHA', 6),
    ('159b266b-941e-5fa9-8c68-3bdf1c288b8d', 'TITULAR', '11111111-1111-1111-1111-000000000212', '18d2410f-2369-554e-ae72-b32cd1c33f2d', 6, 7, 'EN_CANCHA', 7),
    ('7ad09126-db37-5330-a2a2-bc5064fb721b', 'TITULAR', '11111111-1111-1111-1111-000000000220', '18d2410f-2369-554e-ae72-b32cd1c33f2d', 7, 8, 'EN_CANCHA', 8),
    ('24ff3e76-c046-5138-a796-f6caf4ac4e1c', 'TITULAR', '11111111-1111-1111-1111-000000000226', '18d2410f-2369-554e-ae72-b32cd1c33f2d', 8, 9, 'EN_CANCHA', 9),
    ('b81b14a1-1fd4-504b-b0be-aa998de876cf', 'TITULAR', '11111111-1111-1111-1111-000000000216', '18d2410f-2369-554e-ae72-b32cd1c33f2d', 9, 10, 'EN_CANCHA', 10),
    ('c7c18c6e-20ac-50a7-ae77-049b3b17e5b8', 'TITULAR', '11111111-1111-1111-1111-000000000210', '18d2410f-2369-554e-ae72-b32cd1c33f2d', 10, 11, 'EN_CANCHA', 11),
    ('94ce027f-de4f-559d-8021-1c2a86ee3acb', 'TITULAR', '11111111-1111-1111-1111-000000000223', '18d2410f-2369-554e-ae72-b32cd1c33f2d', 11, 12, 'EN_CANCHA', 12),
    ('acb8c535-fee6-5510-8278-850106781a19', 'TITULAR', '11111111-1111-1111-1111-000000000202', '18d2410f-2369-554e-ae72-b32cd1c33f2d', 12, 13, 'EN_CANCHA', 13),
    ('a5872d46-c749-5e3c-8157-5b9c62d9dc5f', 'TITULAR', '11111111-1111-1111-1111-000000000213', '18d2410f-2369-554e-ae72-b32cd1c33f2d', 13, 14, 'EN_CANCHA', 14),
    ('0a1873fd-06d2-5ddd-b8c3-c3c4a292d1df', 'TITULAR', '11111111-1111-1111-1111-000000000214', '18d2410f-2369-554e-ae72-b32cd1c33f2d', 14, 15, 'EN_CANCHA', 15),
    ('0baff144-c5a3-537c-8f30-3828ae80164b', 'SUPLENTE', '11111111-1111-1111-1111-000000000222', '18d2410f-2369-554e-ae72-b32cd1c33f2d', 0, 16, 'EN_BANCO', NULL),
    ('7285f8ed-dfde-564d-9b83-ed417b9211a9', 'SUPLENTE', '11111111-1111-1111-1111-000000000204', '18d2410f-2369-554e-ae72-b32cd1c33f2d', 1, 17, 'EN_BANCO', NULL),
    ('281db836-5660-58cb-a916-67a3841a6528', 'SUPLENTE', '11111111-1111-1111-1111-000000000225', '18d2410f-2369-554e-ae72-b32cd1c33f2d', 2, 18, 'EN_BANCO', NULL),
    ('a764fe74-d732-5833-b25e-c200fb5bddd3', 'SUPLENTE', '11111111-1111-1111-1111-000000000217', '18d2410f-2369-554e-ae72-b32cd1c33f2d', 3, 19, 'EN_BANCO', NULL),
    ('26a6ff30-ffd0-5d13-9de5-a461643471f2', 'SUPLENTE', '11111111-1111-1111-1111-000000000221', '18d2410f-2369-554e-ae72-b32cd1c33f2d', 4, 20, 'EN_BANCO', NULL),
    ('339cf9e5-d190-56fe-8632-1f11b3a4453d', 'SUPLENTE', '11111111-1111-1111-1111-000000000227', '18d2410f-2369-554e-ae72-b32cd1c33f2d', 5, 21, 'EN_BANCO', NULL),
    ('17c096d3-d666-56b2-92d2-61e51bb590cc', 'SUPLENTE', '11111111-1111-1111-1111-000000000206', '18d2410f-2369-554e-ae72-b32cd1c33f2d', 6, 22, 'EN_BANCO', NULL),
    ('d57a6ccd-6872-54ea-aa6e-7e4e051635d0', 'SUPLENTE', '11111111-1111-1111-1111-000000000208', '18d2410f-2369-554e-ae72-b32cd1c33f2d', 7, 23, 'EN_BANCO', NULL),
    ('a0fbc125-deaa-50b5-92c1-535946b8820d', 'TITULAR', '11111111-1111-1111-1111-000000000213', '8fa9735d-63cb-5489-8038-f33a1813d46a', 0, 1, 'EN_CANCHA', 1),
    ('465630ff-ec82-5a96-b44d-f7d9a896e4a1', 'TITULAR', '11111111-1111-1111-1111-000000000202', '8fa9735d-63cb-5489-8038-f33a1813d46a', 1, 2, 'EN_CANCHA', 2),
    ('dfbec866-0cb7-50dd-8341-861be6734dd9', 'TITULAR', '11111111-1111-1111-1111-000000000215', '8fa9735d-63cb-5489-8038-f33a1813d46a', 2, 3, 'EN_CANCHA', 3),
    ('1d4eb312-870c-562f-bbf2-f48c3e2b51c5', 'TITULAR', '11111111-1111-1111-1111-000000000216', '8fa9735d-63cb-5489-8038-f33a1813d46a', 3, 4, 'EN_CANCHA', 4),
    ('6ae98675-0161-5dfb-a904-89134311a343', 'TITULAR', '11111111-1111-1111-1111-000000000227', '8fa9735d-63cb-5489-8038-f33a1813d46a', 4, 5, 'EN_CANCHA', 5),
    ('3d34ebdb-4e7b-58a5-8014-b95b54247c80', 'TITULAR', '11111111-1111-1111-1111-000000000222', '8fa9735d-63cb-5489-8038-f33a1813d46a', 5, 6, 'EN_CANCHA', 6),
    ('b8506923-6544-5672-92cc-6c9482dd6d71', 'TITULAR', '11111111-1111-1111-1111-000000000205', '8fa9735d-63cb-5489-8038-f33a1813d46a', 6, 7, 'EN_CANCHA', 7),
    ('851f2b01-ce29-5ef1-bc9c-0ed17c01c1d5', 'TITULAR', '11111111-1111-1111-1111-000000000201', '8fa9735d-63cb-5489-8038-f33a1813d46a', 7, 8, 'EN_CANCHA', 8),
    ('7cea0c50-bf24-5cb3-9c5c-275025a2831e', 'TITULAR', '11111111-1111-1111-1111-000000000224', '8fa9735d-63cb-5489-8038-f33a1813d46a', 8, 9, 'EN_CANCHA', 9),
    ('f303dca4-827e-5768-aeac-d801631e2645', 'TITULAR', '11111111-1111-1111-1111-000000000208', '8fa9735d-63cb-5489-8038-f33a1813d46a', 9, 10, 'EN_CANCHA', 10),
    ('9599233b-29c5-5296-a1e1-81fbddd720a6', 'TITULAR', '11111111-1111-1111-1111-000000000221', '8fa9735d-63cb-5489-8038-f33a1813d46a', 10, 11, 'EN_CANCHA', 11),
    ('9a0a6ad1-9528-5661-a2b3-f8b1ad18ee4a', 'TITULAR', '11111111-1111-1111-1111-000000000223', '8fa9735d-63cb-5489-8038-f33a1813d46a', 11, 12, 'EN_CANCHA', 12),
    ('7a9504a0-36d6-5d5e-ab4f-348b1a63c9f4', 'TITULAR', '11111111-1111-1111-1111-000000000217', '8fa9735d-63cb-5489-8038-f33a1813d46a', 12, 13, 'EN_CANCHA', 13),
    ('687c187e-049e-5cee-8c46-223f56448e4c', 'TITULAR', '11111111-1111-1111-1111-000000000214', '8fa9735d-63cb-5489-8038-f33a1813d46a', 13, 14, 'EN_CANCHA', 14),
    ('c87814a1-c984-587d-8ebe-c65fbbbae941', 'TITULAR', '11111111-1111-1111-1111-000000000209', '8fa9735d-63cb-5489-8038-f33a1813d46a', 14, 15, 'EN_CANCHA', 15),
    ('d4df07b5-f7b0-5ae4-8010-a5a9594368a8', 'SUPLENTE', '11111111-1111-1111-1111-000000000226', '8fa9735d-63cb-5489-8038-f33a1813d46a', 0, 16, 'EN_BANCO', NULL),
    ('41f9fa53-1cf0-59df-b3d3-332aff5634b6', 'SUPLENTE', '11111111-1111-1111-1111-000000000207', '8fa9735d-63cb-5489-8038-f33a1813d46a', 1, 17, 'EN_BANCO', NULL),
    ('9a6279e7-ac81-54b0-ac04-8e32b1842ee6', 'SUPLENTE', '11111111-1111-1111-1111-000000000206', '8fa9735d-63cb-5489-8038-f33a1813d46a', 2, 18, 'EN_BANCO', NULL),
    ('df7bf675-3482-5910-a77c-d66738abed42', 'SUPLENTE', '11111111-1111-1111-1111-000000000218', '8fa9735d-63cb-5489-8038-f33a1813d46a', 3, 19, 'EN_BANCO', NULL),
    ('0a756920-6ffa-5f9e-abd0-5b4e81a8a86e', 'SUPLENTE', '11111111-1111-1111-1111-000000000220', '8fa9735d-63cb-5489-8038-f33a1813d46a', 4, 20, 'EN_BANCO', NULL),
    ('57c0ed15-fbcb-51b3-a5f8-5a57e4ba6233', 'SUPLENTE', '11111111-1111-1111-1111-000000000210', '8fa9735d-63cb-5489-8038-f33a1813d46a', 5, 21, 'EN_BANCO', NULL),
    ('933f30ed-0a19-5357-917c-42f6417c7289', 'SUPLENTE', '11111111-1111-1111-1111-000000000211', '8fa9735d-63cb-5489-8038-f33a1813d46a', 6, 22, 'EN_BANCO', NULL),
    ('75f67586-7f0e-5c63-a086-ab6eee42bf03', 'SUPLENTE', '11111111-1111-1111-1111-000000000203', '8fa9735d-63cb-5489-8038-f33a1813d46a', 7, 23, 'EN_BANCO', NULL);

-- =========================================
-- EVENTOS DE LOS CINCO PARTIDOS NUEVOS
-- Los atributos live se cargan con valores válidos del catálogo y los post se completan
-- como si el analista hubiera revisado el video luego del encuentro.
-- origin permanece en live-capture porque los eventos nacen de la toma en vivo.
-- =========================================
INSERT INTO events
(id, match_id, event_type_id, player_id, period, match_time, absolute_match_time,
 real_time, team_possession, attributes, origin, active, client_event_id, created_at, synchronized_at)
VALUES

    ('6bccfb88-02e1-5caa-bdf3-e74f68f70526', 'dd4e580d-b80a-50a1-a2de-c61737461705', '550e8400-e29b-41d4-a716-446655440111', NULL, 1, 102, 102, '2026-08-23 15:36:42.000', 'OPPONENT', '{"scrumResult":"won_clean"}'::jsonb, 'live-capture', TRUE, '688e10e5-0b0c-53a7-bd4a-16e250b16b5a', '2026-08-23 15:36:42.030', '2026-08-23 15:36:42.030'),
    ('8a763c1e-6788-5d94-8006-6183d26f5ec3', 'dd4e580d-b80a-50a1-a2de-c61737461705', '550e8400-e29b-41d4-a716-446655440101', '11111111-1111-1111-1111-000000000123', 1, 362, 362, '2026-08-23 15:41:02.000', 'OWN', '{"zone":"center","playerNumber":23}'::jsonb, 'live-capture', TRUE, 'f393b0d3-c2f6-52ff-b10a-9544b622f7af', '2026-08-23 15:41:02.030', '2026-08-23 15:41:02.030'),
    ('9fe40268-7ef6-5c91-b31f-57ba1cf0430e', 'dd4e580d-b80a-50a1-a2de-c61737461705', '550e8400-e29b-41d4-a716-446655440102', '11111111-1111-1111-1111-000000000110', 1, 400, 400, '2026-08-23 15:41:40.000', 'OWN', '{"wasSuccessful":true,"playerNumber":10,"distanceMeters":21,"zone":"right"}'::jsonb, 'live-capture', TRUE, '17ec41c3-4e42-52ec-b1d0-55fa8954cdbe', '2026-08-23 15:41:40.030', '2026-08-23 15:41:40.030'),
    ('751b96c3-9593-5858-b0fc-30b1077bd933', 'dd4e580d-b80a-50a1-a2de-c61737461705', '550e8400-e29b-41d4-a716-446655440112', '11111111-1111-1111-1111-000000000110', 1, 549, 549, '2026-08-23 15:44:09.000', 'OWN', '{"lineResult":"won_clean","playerNumber":10,"jumpZone":"front","isMaulFormed":false}'::jsonb, 'live-capture', TRUE, '96d67f2f-c792-5469-8dae-d2e552dfbc1c', '2026-08-23 15:44:09.030', '2026-08-23 15:44:09.030'),
    ('4197f534-1535-5d80-a56f-ee12cc751265', 'dd4e580d-b80a-50a1-a2de-c61737461705', '550e8400-e29b-41d4-a716-446655440122', NULL, 1, 637, 637, '2026-08-23 15:45:37.000', 'OWN', '{"penaltyType":"dangerous_tackle"}'::jsonb, 'live-capture', TRUE, '87f6e9f4-4e1e-5edd-947a-c6f262c77775', '2026-08-23 15:45:37.030', '2026-08-23 15:45:37.030'),
    ('fc1a7862-b8ee-57a1-959b-c9d59dfa0ed1', 'dd4e580d-b80a-50a1-a2de-c61737461705', '550e8400-e29b-41d4-a716-446655440110', '11111111-1111-1111-1111-000000000101', 1, 717, 717, '2026-08-23 15:46:57.000', 'OWN', '{"outcome":"out_in_full","playerNumber":1,"kickType":"up_under"}'::jsonb, 'live-capture', TRUE, '5bf27c3e-9221-5d96-bd4f-ecf751dcb50f', '2026-08-23 15:46:57.030', '2026-08-23 15:46:57.030'),
    ('17fb938a-6141-52a4-a909-ab826b89e6c0', 'dd4e580d-b80a-50a1-a2de-c61737461705', '550e8400-e29b-41d4-a716-446655440122', NULL, 1, 910, 910, '2026-08-23 15:50:10.000', 'OWN', '{"penaltyType":"maul_illegal"}'::jsonb, 'live-capture', TRUE, '525e7c85-9eeb-5d3a-aa41-d654d7796fcc', '2026-08-23 15:50:10.030', '2026-08-23 15:50:10.030'),
    ('b08c310f-7241-5ed8-81c3-2092ff1f5aa4', 'dd4e580d-b80a-50a1-a2de-c61737461705', '550e8400-e29b-41d4-a716-446655440101', '11111111-1111-1111-1111-000000000118', 1, 972, 972, '2026-08-23 15:51:12.000', 'OWN', '{"zone":"left","playerNumber":18}'::jsonb, 'live-capture', TRUE, 'd24eb65a-c904-5be0-b74e-50f3f75ccd03', '2026-08-23 15:51:12.030', '2026-08-23 15:51:12.030'),
    ('e099face-457d-55d1-9cd5-59f01fef740d', 'dd4e580d-b80a-50a1-a2de-c61737461705', '550e8400-e29b-41d4-a716-446655440102', '11111111-1111-1111-1111-000000000116', 1, 1018, 1018, '2026-08-23 15:51:58.000', 'OWN', '{"wasSuccessful":false,"playerNumber":16,"distanceMeters":37,"zone":"right"}'::jsonb, 'live-capture', TRUE, '31d85cbc-d34e-5fd3-b780-8dbd9b8b6e2e', '2026-08-23 15:51:58.030', '2026-08-23 15:51:58.030'),
    ('fef0a438-6794-5e99-9f63-ede27f692166', 'dd4e580d-b80a-50a1-a2de-c61737461705', '550e8400-e29b-41d4-a716-446655440115', NULL, 1, 1087, 1087, '2026-08-23 15:53:07.000', 'OPPONENT', '{"assisted":true}'::jsonb, 'live-capture', TRUE, '78ff5b37-66ad-51b4-9220-908905781004', '2026-08-23 15:53:07.030', '2026-08-23 15:53:07.030'),
    ('2e697351-7195-53fe-8a8c-4d69985880ea', 'dd4e580d-b80a-50a1-a2de-c61737461705', '550e8400-e29b-41d4-a716-446655440128', '11111111-1111-1111-1111-000000000106', 1, 1281, 1281, '2026-08-23 15:56:21.000', 'OWN', '{"kind":"won","playerNumber":6}'::jsonb, 'live-capture', TRUE, '195dceec-1c87-5333-86cb-1b0b8cf7219d', '2026-08-23 15:56:21.030', '2026-08-23 15:56:21.030'),
    ('db535501-d044-565f-905d-d03c1cd19a9d', 'dd4e580d-b80a-50a1-a2de-c61737461705', '550e8400-e29b-41d4-a716-446655440108', NULL, 1, 1328, 1328, '2026-08-23 15:57:08.000', 'OPPONENT', '{"speed":"medium"}'::jsonb, 'live-capture', TRUE, 'ba3d559c-f8b8-5471-a692-0c108bc7b49f', '2026-08-23 15:57:08.030', '2026-08-23 15:57:08.030'),
    ('6bcf5a8a-6288-5100-9afc-e460da1f85f1', 'dd4e580d-b80a-50a1-a2de-c61737461705', '550e8400-e29b-41d4-a716-446655440104', '11111111-1111-1111-1111-000000000102', 1, 1589, 1589, '2026-08-23 16:01:29.000', 'OWN', '{"wasSuccessful":false,"playerNumber":2,"distanceMeters":21,"zone":"right"}'::jsonb, 'live-capture', TRUE, 'f7e06298-7236-59ce-8f03-ce8f1e60b91b', '2026-08-23 16:01:29.030', '2026-08-23 16:01:29.030'),
    ('878bd104-de51-5299-9738-ba53e82806f1', 'dd4e580d-b80a-50a1-a2de-c61737461705', '550e8400-e29b-41d4-a716-446655440101', NULL, 1, 1685, 1685, '2026-08-23 16:03:05.000', 'OPPONENT', '{"zone":"right"}'::jsonb, 'live-capture', TRUE, '0f0a574b-afb2-5eca-a198-ece158f289b5', '2026-08-23 16:03:05.030', '2026-08-23 16:03:05.030'),
    ('2a6c3b01-0693-5ba9-a188-7acc298fad46', 'dd4e580d-b80a-50a1-a2de-c61737461705', '550e8400-e29b-41d4-a716-446655440102', NULL, 1, 1722, 1722, '2026-08-23 16:03:42.000', 'OPPONENT', '{"wasSuccessful":false,"distanceMeters":40,"zone":"center"}'::jsonb, 'live-capture', TRUE, '22d62b59-9ad7-5f89-a614-9fe83105ea84', '2026-08-23 16:03:42.030', '2026-08-23 16:03:42.030'),
    ('cd590d4e-173a-5404-a9e7-bde75b981949', 'dd4e580d-b80a-50a1-a2de-c61737461705', '550e8400-e29b-41d4-a716-446655440108', NULL, 1, 1813, 1813, '2026-08-23 16:05:13.000', 'OPPONENT', '{"speed":"fast"}'::jsonb, 'live-capture', TRUE, 'd231f7a2-86c0-5b6a-a4ec-6390e9703360', '2026-08-23 16:05:13.030', '2026-08-23 16:05:13.030'),
    ('8ee741d7-1a32-5af6-af42-0b8b43edc656', 'dd4e580d-b80a-50a1-a2de-c61737461705', '550e8400-e29b-41d4-a716-446655440116', '11111111-1111-1111-1111-000000000112', 1, 2061, 2061, '2026-08-23 16:09:21.000', 'OWN', '{"playerNumber":12,"failReason":"late"}'::jsonb, 'live-capture', TRUE, 'c7b1cad7-73c5-5401-bce6-8a95911e3494', '2026-08-23 16:09:21.030', '2026-08-23 16:09:21.030'),
    ('62764056-4079-50e8-9ee5-21ad906a9a4a', 'dd4e580d-b80a-50a1-a2de-c61737461705', '550e8400-e29b-41d4-a716-446655440117', '11111111-1111-1111-1111-000000000102', 1, 2183, 2183, '2026-08-23 16:11:23.000', 'OWN', '{"playerNumber":2,"stealType":"interception"}'::jsonb, 'live-capture', TRUE, 'bc9a352b-6a72-5111-8b54-b5be8639e4bf', '2026-08-23 16:11:23.030', '2026-08-23 16:11:23.030'),
    ('dac1ee6e-74e9-57ad-be35-6155bbe18b9d', 'dd4e580d-b80a-50a1-a2de-c61737461705', '550e8400-e29b-41d4-a716-446655440107', NULL, 1, 2313, 2313, '2026-08-23 16:13:33.000', 'OPPONENT', '{"passType":"skip","isBadPass":true}'::jsonb, 'live-capture', TRUE, '3ed7b40f-4e63-5a30-991b-20ac27d551c2', '2026-08-23 16:13:33.030', '2026-08-23 16:13:33.030'),
    ('70838b95-1fcf-5b1d-a16b-e1384ae8d9c7', 'dd4e580d-b80a-50a1-a2de-c61737461705', '550e8400-e29b-41d4-a716-446655440109', NULL, 1, 2375, 2375, '2026-08-23 16:14:35.000', 'OPPONENT', '{"metersGained":5}'::jsonb, 'live-capture', TRUE, 'c7a92d70-4456-595a-83cd-afdf02ff6d76', '2026-08-23 16:14:35.030', '2026-08-23 16:14:35.030'),
    ('0db0fe50-602b-5968-8eaa-b53ed3d2bdf1', 'dd4e580d-b80a-50a1-a2de-c61737461705', '550e8400-e29b-41d4-a716-446655440109', '11111111-1111-1111-1111-000000000104', 1, 2382, 2382, '2026-08-23 16:14:42.000', 'OWN', '{"playerNumber":4,"metersGained":1}'::jsonb, 'live-capture', TRUE, 'a77d1644-b59e-5e0b-8314-626407169a17', '2026-08-23 16:14:42.030', '2026-08-23 16:14:42.030'),
    ('4757e922-1038-56dc-9f1a-44b89c1a73ac', 'dd4e580d-b80a-50a1-a2de-c61737461705', '550e8400-e29b-41d4-a716-446655440101', NULL, 2, 2406, 2406, '2026-08-23 16:15:06.000', 'OPPONENT', '{"zone":"center"}'::jsonb, 'live-capture', TRUE, '05ec4bfd-65d9-5cf9-9645-17fee4e6541f', '2026-08-23 16:15:06.030', '2026-08-23 16:15:06.030'),
    ('afbedf7d-8765-5487-8d76-3ff246ae97db', 'dd4e580d-b80a-50a1-a2de-c61737461705', '550e8400-e29b-41d4-a716-446655440102', NULL, 2, 2453, 2453, '2026-08-23 16:15:53.000', 'OPPONENT', '{"wasSuccessful":true,"distanceMeters":37,"zone":"right"}'::jsonb, 'live-capture', TRUE, '2608ce2d-6081-5494-89d7-a888a428b7a7', '2026-08-23 16:15:53.030', '2026-08-23 16:15:53.030'),
    ('fae67301-6752-5547-9f02-2d8d8fd4347b', 'dd4e580d-b80a-50a1-a2de-c61737461705', '550e8400-e29b-41d4-a716-446655440111', NULL, 2, 2630, 2630, '2026-08-23 16:18:50.000', 'OPPONENT', '{"scrumResult":"penalty_against"}'::jsonb, 'live-capture', TRUE, 'f6f9f56c-2bd0-55a5-a64c-586bc6fea781', '2026-08-23 16:18:50.030', '2026-08-23 16:18:50.030'),
    ('206e6b61-6b6e-5f01-b518-701df9ad6069', 'dd4e580d-b80a-50a1-a2de-c61737461705', '550e8400-e29b-41d4-a716-446655440106', '11111111-1111-1111-1111-000000000118', 2, 2735, 2735, '2026-08-23 16:20:35.000', 'OWN', '{"playerNumber":18,"metersGained":4,"defendersBeaten":0}'::jsonb, 'live-capture', TRUE, 'ebd28544-1c0c-5d36-99b6-5a9184def3e3', '2026-08-23 16:20:35.030', '2026-08-23 16:20:35.030'),
    ('da4e505c-e5e7-5a75-bf30-f77497205491', 'dd4e580d-b80a-50a1-a2de-c61737461705', '550e8400-e29b-41d4-a716-446655440126', NULL, 2, 3000, 3000, '2026-08-23 16:25:00.000', 'OWN', '{"playerOutNumber":1,"playerInNumber":16,"playerOutId":"11111111-1111-1111-1111-000000000117","playerInId":"11111111-1111-1111-1111-000000000104"}'::jsonb, 'live-capture', TRUE, '95c0a62d-29cb-53e4-9744-1c8064468b6c', '2026-08-23 16:25:00.030', '2026-08-23 16:25:00.030'),
    ('f1765f56-9922-5f8e-b3d6-ef373fc6d2f0', 'dd4e580d-b80a-50a1-a2de-c61737461705', '550e8400-e29b-41d4-a716-446655440120', '11111111-1111-1111-1111-000000000101', 2, 3041, 3041, '2026-08-23 16:25:41.000', 'OWN', '{"receptionQuality":"fumbled","playerNumber":1}'::jsonb, 'live-capture', TRUE, '38621354-c168-5825-a919-c3f5ac87582e', '2026-08-23 16:25:41.030', '2026-08-23 16:25:41.030'),
    ('0cc8264f-a30f-5c45-a99e-251f889853b0', 'dd4e580d-b80a-50a1-a2de-c61737461705', '550e8400-e29b-41d4-a716-446655440106', NULL, 2, 3052, 3052, '2026-08-23 16:25:52.000', 'OPPONENT', '{"metersGained":15,"defendersBeaten":0}'::jsonb, 'live-capture', TRUE, '56267fa6-9fea-5072-abbc-1c0d0d5c9921', '2026-08-23 16:25:52.030', '2026-08-23 16:25:52.030'),
    ('a6d202cb-12f8-5221-9db4-c29f9cca0865', 'dd4e580d-b80a-50a1-a2de-c61737461705', '550e8400-e29b-41d4-a716-446655440120', NULL, 2, 3068, 3068, '2026-08-23 16:26:08.000', 'OPPONENT', '{"receptionQuality":"contested_won"}'::jsonb, 'live-capture', TRUE, 'c405843b-1ea8-5070-9f18-6de81aa02924', '2026-08-23 16:26:08.030', '2026-08-23 16:26:08.030'),
    ('cdeff0c0-7e09-5b0c-b438-69dfec3f4094', 'dd4e580d-b80a-50a1-a2de-c61737461705', '550e8400-e29b-41d4-a716-446655440101', '11111111-1111-1111-1111-000000000114', 2, 3130, 3130, '2026-08-23 16:27:10.000', 'OWN', '{"zone":"left","playerNumber":14}'::jsonb, 'live-capture', TRUE, 'd6cd185d-c502-5a21-9568-6750a861dec3', '2026-08-23 16:27:10.030', '2026-08-23 16:27:10.030'),
    ('2d8123c1-794a-5306-bc68-754cab224aed', 'dd4e580d-b80a-50a1-a2de-c61737461705', '550e8400-e29b-41d4-a716-446655440102', '11111111-1111-1111-1111-000000000102', 2, 3179, 3179, '2026-08-23 16:27:59.000', 'OWN', '{"wasSuccessful":false,"playerNumber":2,"distanceMeters":20,"zone":"left"}'::jsonb, 'live-capture', TRUE, '481802f1-d847-5101-8fb5-3cccfbeba34d', '2026-08-23 16:27:59.030', '2026-08-23 16:27:59.030'),
    ('4f915627-a5da-573e-9fdb-fdfe2ad2484f', 'dd4e580d-b80a-50a1-a2de-c61737461705', '550e8400-e29b-41d4-a716-446655440115', NULL, 2, 3358, 3358, '2026-08-23 16:30:58.000', 'OPPONENT', '{"assisted":true}'::jsonb, 'live-capture', TRUE, '85d99fc9-1630-5b04-a7ac-750a854ad957', '2026-08-23 16:30:58.030', '2026-08-23 16:30:58.030'),
    ('80bacf1e-8617-59aa-9ed6-23e847b035d1', 'dd4e580d-b80a-50a1-a2de-c61737461705', '550e8400-e29b-41d4-a716-446655440107', '11111111-1111-1111-1111-000000000115', 2, 3415, 3415, '2026-08-23 16:31:55.000', 'OWN', '{"passType":"offload","playerNumber":15,"isBadPass":true}'::jsonb, 'live-capture', TRUE, '9a9d47b4-fe4b-5e6f-b78a-d5cdbad9d9e5', '2026-08-23 16:31:55.030', '2026-08-23 16:31:55.030'),
    ('02acdc50-b34f-5477-9ff1-13835eb0abcc', 'dd4e580d-b80a-50a1-a2de-c61737461705', '550e8400-e29b-41d4-a716-446655440115', '11111111-1111-1111-1111-000000000115', 2, 3454, 3454, '2026-08-23 16:32:34.000', 'OWN', '{"playerNumber":15,"assisted":true}'::jsonb, 'live-capture', TRUE, 'e355fbdd-469a-5c07-8988-246fc2f3240b', '2026-08-23 16:32:34.030', '2026-08-23 16:32:34.030'),
    ('3bf8a709-1c1f-5a34-a974-6113aada01d5', 'dd4e580d-b80a-50a1-a2de-c61737461705', '550e8400-e29b-41d4-a716-446655440107', NULL, 2, 3492, 3492, '2026-08-23 16:33:12.000', 'OPPONENT', '{"passType":"skip","isBadPass":false}'::jsonb, 'live-capture', TRUE, '11988669-f9d1-5d97-b988-18c2e3a614c2', '2026-08-23 16:33:12.030', '2026-08-23 16:33:12.030'),
    ('bacd68a7-e526-5384-97fe-267e044d3b33', 'dd4e580d-b80a-50a1-a2de-c61737461705', '550e8400-e29b-41d4-a716-446655440115', '11111111-1111-1111-1111-000000000120', 2, 3496, 3496, '2026-08-23 16:33:16.000', 'OWN', '{"playerNumber":20,"assisted":false}'::jsonb, 'live-capture', TRUE, '4de701d6-a757-5036-a915-0de36d5f1e41', '2026-08-23 16:33:16.030', '2026-08-23 16:33:16.030'),
    ('bdd80ca6-8bac-5013-83ee-21f2e8284ea9', 'dd4e580d-b80a-50a1-a2de-c61737461705', '550e8400-e29b-41d4-a716-446655440101', NULL, 2, 3730, 3730, '2026-08-23 16:37:10.000', 'OPPONENT', '{"zone":"right"}'::jsonb, 'live-capture', TRUE, '139a4533-d8e3-59ea-8778-8bacfd6b8c1d', '2026-08-23 16:37:10.030', '2026-08-23 16:37:10.030'),
    ('efcc1428-e6a1-5da8-8c2b-9f74284921b0', 'dd4e580d-b80a-50a1-a2de-c61737461705', '550e8400-e29b-41d4-a716-446655440102', NULL, 2, 3768, 3768, '2026-08-23 16:37:48.000', 'OPPONENT', '{"wasSuccessful":true,"distanceMeters":24,"zone":"left"}'::jsonb, 'live-capture', TRUE, '2cc9a286-6679-58d7-8599-becfc9a5fe12', '2026-08-23 16:37:48.030', '2026-08-23 16:37:48.030'),
    ('a2e8c146-d46b-5a96-a46e-abef2052a2f3', 'dd4e580d-b80a-50a1-a2de-c61737461705', '550e8400-e29b-41d4-a716-446655440126', NULL, 2, 3900, 3900, '2026-08-23 16:40:00.000', 'OWN', '{"playerOutNumber":2,"playerInNumber":17,"playerOutId":"11111111-1111-1111-1111-000000000115","playerInId":"11111111-1111-1111-1111-000000000108"}'::jsonb, 'live-capture', TRUE, '35aea3f3-fdc7-53a1-bca0-4190f6fc8eca', '2026-08-23 16:40:00.030', '2026-08-23 16:40:00.030'),
    ('e8bab6b8-d591-5707-b6f3-fd2581e899cf', 'dd4e580d-b80a-50a1-a2de-c61737461705', '550e8400-e29b-41d4-a716-446655440106', '11111111-1111-1111-1111-000000000121', 2, 3972, 3972, '2026-08-23 16:41:12.000', 'OWN', '{"playerNumber":21,"metersGained":3,"defendersBeaten":0}'::jsonb, 'live-capture', TRUE, 'aaec9c4a-fcd7-573b-9f1a-5f574c0ebc78', '2026-08-23 16:41:12.030', '2026-08-23 16:41:12.030'),
    ('b8628afe-188d-53b3-9e97-d3d06013e1d9', 'dd4e580d-b80a-50a1-a2de-c61737461705', '550e8400-e29b-41d4-a716-446655440114', NULL, 2, 4227, 4227, '2026-08-23 16:45:27.000', 'OPPONENT', '{"maulOutcome":"turnover_held","metersGained":11}'::jsonb, 'live-capture', TRUE, '1bd6166b-96f4-5043-933e-f74fe062bc88', '2026-08-23 16:45:27.030', '2026-08-23 16:45:27.030'),
    ('cc523ef7-6385-512d-b1e8-c35f91efa454', 'dd4e580d-b80a-50a1-a2de-c61737461705', '550e8400-e29b-41d4-a716-446655440112', NULL, 2, 4278, 4278, '2026-08-23 16:46:18.000', 'OPPONENT', '{"lineResult":"penalty_for","jumpZone":"back","isMaulFormed":false}'::jsonb, 'live-capture', TRUE, 'f877c071-b7db-5fbf-9b47-f27c7dc98a00', '2026-08-23 16:46:18.030', '2026-08-23 16:46:18.030'),
    ('221d3945-779f-5039-bcf6-6d5f0f914b9e', 'dd4e580d-b80a-50a1-a2de-c61737461705', '550e8400-e29b-41d4-a716-446655440106', NULL, 2, 4429, 4429, '2026-08-23 16:48:49.000', 'OPPONENT', '{"metersGained":2,"defendersBeaten":0}'::jsonb, 'live-capture', TRUE, '8c52d6bf-4400-56c5-9a3c-4293b47a9e0e', '2026-08-23 16:48:49.030', '2026-08-23 16:48:49.030'),
    ('e8f65b68-6369-5788-8162-d3ad7956643d', 'dd4e580d-b80a-50a1-a2de-c61737461705', '550e8400-e29b-41d4-a716-446655440117', '11111111-1111-1111-1111-000000000110', 2, 4508, 4508, '2026-08-23 16:50:08.000', 'OWN', '{"playerNumber":10,"stealType":"dropped_unforced"}'::jsonb, 'live-capture', TRUE, '0248a351-5625-5d39-a9c4-9873ce031bca', '2026-08-23 16:50:08.030', '2026-08-23 16:50:08.030'),
    ('74388a05-1757-5e2e-af30-dcf21e3b71bd', 'dd4e580d-b80a-50a1-a2de-c61737461705', '550e8400-e29b-41d4-a716-446655440101', '11111111-1111-1111-1111-000000000120', 2, 4510, 4510, '2026-08-23 16:50:10.000', 'OWN', '{"zone":"right","playerNumber":20}'::jsonb, 'live-capture', TRUE, 'd1d741e8-8cf3-5c54-af74-e3d72984abf7', '2026-08-23 16:50:10.030', '2026-08-23 16:50:10.030'),
    ('965ad7a3-d2e3-5b11-b73a-90642ebb0bfd', 'dd4e580d-b80a-50a1-a2de-c61737461705', '550e8400-e29b-41d4-a716-446655440102', '11111111-1111-1111-1111-000000000117', 2, 4547, 4547, '2026-08-23 16:50:47.000', 'OWN', '{"wasSuccessful":true,"playerNumber":17,"distanceMeters":22,"zone":"center"}'::jsonb, 'live-capture', TRUE, 'bd02ede5-6a3d-5f82-84dc-fab40504e756', '2026-08-23 16:50:47.030', '2026-08-23 16:50:47.030'),
    ('4da85137-8a79-56ce-9462-a8fc8508f6f7', 'dd4e580d-b80a-50a1-a2de-c61737461705', '550e8400-e29b-41d4-a716-446655440113', NULL, 2, 4619, 4619, '2026-08-23 16:51:59.000', 'OPPONENT', '{"outcome":"received_clean","kickType":"halfway_start"}'::jsonb, 'live-capture', TRUE, '80c39bb9-85ae-50eb-b603-21adf81ec8a4', '2026-08-23 16:51:59.030', '2026-08-23 16:51:59.030'),
    ('f0452053-6b85-5c4d-a97e-6ccc8f05dad6', 'dd4e580d-b80a-50a1-a2de-c61737461705', '550e8400-e29b-41d4-a716-446655440129', NULL, 2, 4655, 4655, '2026-08-23 16:52:35.000', 'OPPONENT', '{"quickPlayOutcome":false}'::jsonb, 'live-capture', TRUE, '2b6f3ec3-7fc1-55e6-883f-2e587ae791e0', '2026-08-23 16:52:35.030', '2026-08-23 16:52:35.030'),
    ('a1e6b665-909b-5a25-8489-2469b0b7b7a4', 'dd4e580d-b80a-50a1-a2de-c61737461705', '550e8400-e29b-41d4-a716-446655440112', '11111111-1111-1111-1111-000000000121', 2, 4661, 4661, '2026-08-23 16:52:41.000', 'OWN', '{"lineResult":"penalty_for","playerNumber":21,"jumpZone":"front","isMaulFormed":false}'::jsonb, 'live-capture', TRUE, '2402d062-c389-548f-a2d8-4ed532935f7b', '2026-08-23 16:52:41.030', '2026-08-23 16:52:41.030'),
    ('d7d2624d-504a-5b21-a01f-05f38f4a80f3', 'dd4e580d-b80a-50a1-a2de-c61737461705', '550e8400-e29b-41d4-a716-446655440108', NULL, 2, 4665, 4665, '2026-08-23 16:52:45.000', 'OPPONENT', '{"speed":"medium"}'::jsonb, 'live-capture', TRUE, '68b095e8-86cc-5091-b1f7-516e31e7462a', '2026-08-23 16:52:45.030', '2026-08-23 16:52:45.030'),
    ('e798c2b0-91dd-539c-bec9-672d02711bca', 'dd4e580d-b80a-50a1-a2de-c61737461705', '550e8400-e29b-41d4-a716-446655440110', NULL, 2, 4672, 4672, '2026-08-23 16:52:52.000', 'OPPONENT', '{"outcome":"50/22","kickType":"up_under"}'::jsonb, 'live-capture', TRUE, 'dfbba531-bc65-5421-b3a2-629bbac06b17', '2026-08-23 16:52:52.030', '2026-08-23 16:52:52.030'),
    ('2bf44d33-508e-54ab-a37c-d13076b69081', 'a1eba5c7-5829-502d-8b07-3da0234883c6', '550e8400-e29b-41d4-a716-446655440115', '11111111-1111-1111-1111-000000000105', 1, 85, 85, '2026-08-30 15:36:25.000', 'OWN', '{"playerNumber":5,"assisted":false}'::jsonb, 'live-capture', TRUE, '2de7eecb-92a8-5499-b3fb-8b737309c4e8', '2026-08-30 15:36:25.030', '2026-08-30 15:36:25.030'),
    ('70dd541d-c5d3-5ac0-83b0-7b5226b1b8de', 'a1eba5c7-5829-502d-8b07-3da0234883c6', '550e8400-e29b-41d4-a716-446655440106', NULL, 1, 157, 157, '2026-08-30 15:37:37.000', 'OPPONENT', '{"metersGained":10,"defendersBeaten":0}'::jsonb, 'live-capture', TRUE, '39b43052-4d59-5d6b-bb9e-f46708719548', '2026-08-30 15:37:37.030', '2026-08-30 15:37:37.030'),
    ('c0767607-a276-57b8-963c-58b67bb5eee5', 'a1eba5c7-5829-502d-8b07-3da0234883c6', '550e8400-e29b-41d4-a716-446655440109', NULL, 1, 259, 259, '2026-08-30 15:39:19.000', 'OPPONENT', '{"metersGained":7}'::jsonb, 'live-capture', TRUE, '134f9dc3-0bed-5246-bb2e-beb8cea7824c', '2026-08-30 15:39:19.030', '2026-08-30 15:39:19.030'),
    ('7ea418bf-f3e9-5ba0-bec2-8e24fdb79e7b', 'a1eba5c7-5829-502d-8b07-3da0234883c6', '550e8400-e29b-41d4-a716-446655440101', NULL, 1, 303, 303, '2026-08-30 15:40:03.000', 'OPPONENT', '{"zone":"center"}'::jsonb, 'live-capture', TRUE, 'faa3430b-8f79-5092-9d12-1c515b88d7d7', '2026-08-30 15:40:03.030', '2026-08-30 15:40:03.030'),
    ('82b7f7fe-0e45-58f0-8d75-e89a662b1eef', 'a1eba5c7-5829-502d-8b07-3da0234883c6', '550e8400-e29b-41d4-a716-446655440102', NULL, 1, 353, 353, '2026-08-30 15:40:53.000', 'OPPONENT', '{"wasSuccessful":true,"distanceMeters":34,"zone":"left"}'::jsonb, 'live-capture', TRUE, '31bcf9d7-30ad-5c70-8308-346299d105cb', '2026-08-30 15:40:53.030', '2026-08-30 15:40:53.030'),
    ('a41a9e66-c880-5945-8241-77be66d635f0', 'a1eba5c7-5829-502d-8b07-3da0234883c6', '550e8400-e29b-41d4-a716-446655440116', '11111111-1111-1111-1111-000000000123', 1, 417, 417, '2026-08-30 15:41:57.000', 'OWN', '{"playerNumber":23,"failReason":"footwork"}'::jsonb, 'live-capture', TRUE, '0de7e90f-2994-561a-ad95-ea9837e5f139', '2026-08-30 15:41:57.030', '2026-08-30 15:41:57.030'),
    ('6da494dc-ca9b-55d7-a228-e93acbd5594c', 'a1eba5c7-5829-502d-8b07-3da0234883c6', '550e8400-e29b-41d4-a716-446655440117', NULL, 1, 432, 432, '2026-08-30 15:42:12.000', 'OPPONENT', '{"stealType":"jackal_ruck"}'::jsonb, 'live-capture', TRUE, '8d43cd76-28a8-59b3-9916-079f12d4c8eb', '2026-08-30 15:42:12.030', '2026-08-30 15:42:12.030'),
    ('4df7c7ec-22f8-517b-a3d6-0a978a8d10ab', 'a1eba5c7-5829-502d-8b07-3da0234883c6', '550e8400-e29b-41d4-a716-446655440108', NULL, 1, 535, 535, '2026-08-30 15:43:55.000', 'OPPONENT', '{"speed":"slow"}'::jsonb, 'live-capture', TRUE, '7ae61526-b085-558d-8717-93f01d358cfb', '2026-08-30 15:43:55.030', '2026-08-30 15:43:55.030'),
    ('172842cc-aaae-53e0-ac4e-55422df95ee6', 'a1eba5c7-5829-502d-8b07-3da0234883c6', '550e8400-e29b-41d4-a716-446655440120', '11111111-1111-1111-1111-000000000113', 1, 723, 723, '2026-08-30 15:47:03.000', 'OWN', '{"receptionQuality":"fumbled","playerNumber":13}'::jsonb, 'live-capture', TRUE, '3cb780ae-9317-5dc6-b2b7-5d5cbe3c019d', '2026-08-30 15:47:03.030', '2026-08-30 15:47:03.030'),
    ('411adeb1-dff9-5d9a-8942-083e54e556aa', 'a1eba5c7-5829-502d-8b07-3da0234883c6', '550e8400-e29b-41d4-a716-446655440111', '11111111-1111-1111-1111-000000000102', 1, 790, 790, '2026-08-30 15:48:10.000', 'OWN', '{"scrumResult":"penalty_for","playerNumber":2}'::jsonb, 'live-capture', TRUE, 'cd730b94-700f-5fd0-99bf-51c219f3ff49', '2026-08-30 15:48:10.030', '2026-08-30 15:48:10.030'),
    ('bc83ddd4-36ad-5282-becf-0240e8eb36ae', 'a1eba5c7-5829-502d-8b07-3da0234883c6', '550e8400-e29b-41d4-a716-446655440106', NULL, 1, 811, 811, '2026-08-30 15:48:31.000', 'OPPONENT', '{"metersGained":8,"defendersBeaten":0}'::jsonb, 'live-capture', TRUE, '3d6efdd0-1a32-5a35-bd33-415afd3ee32d', '2026-08-30 15:48:31.030', '2026-08-30 15:48:31.030'),
    ('ba1776ab-7771-5c68-8bf0-c63957fe7787', 'a1eba5c7-5829-502d-8b07-3da0234883c6', '550e8400-e29b-41d4-a716-446655440115', NULL, 1, 853, 853, '2026-08-30 15:49:13.000', 'OPPONENT', '{"assisted":true}'::jsonb, 'live-capture', TRUE, '08a57373-de1c-5a5c-a0da-fff18c23470c', '2026-08-30 15:49:13.030', '2026-08-30 15:49:13.030'),
    ('3a04a8b2-a059-5d57-83f7-36594e9dc97e', 'a1eba5c7-5829-502d-8b07-3da0234883c6', '550e8400-e29b-41d4-a716-446655440101', '11111111-1111-1111-1111-000000000126', 1, 902, 902, '2026-08-30 15:50:02.000', 'OWN', '{"zone":"center","playerNumber":26}'::jsonb, 'live-capture', TRUE, 'da2e3a40-d004-5873-9572-29e1e4791090', '2026-08-30 15:50:02.030', '2026-08-30 15:50:02.030'),
    ('fd6c4c9f-4355-5f40-967f-ac6395a7814c', 'a1eba5c7-5829-502d-8b07-3da0234883c6', '550e8400-e29b-41d4-a716-446655440102', '11111111-1111-1111-1111-000000000111', 1, 939, 939, '2026-08-30 15:50:39.000', 'OWN', '{"wasSuccessful":false,"playerNumber":11,"distanceMeters":45,"zone":"right"}'::jsonb, 'live-capture', TRUE, 'f8b11f98-4235-548a-895f-bf5f5c634515', '2026-08-30 15:50:39.030', '2026-08-30 15:50:39.030'),
    ('2bdbcd75-2575-5238-b966-828b12277efb', 'a1eba5c7-5829-502d-8b07-3da0234883c6', '550e8400-e29b-41d4-a716-446655440107', NULL, 1, 1112, 1112, '2026-08-30 15:53:32.000', 'OPPONENT', '{"passType":"offload","isBadPass":true}'::jsonb, 'live-capture', TRUE, '0d171fdc-cc53-5210-83bf-6e109e3355c6', '2026-08-30 15:53:32.030', '2026-08-30 15:53:32.030'),
    ('fa4195df-6252-53ef-b476-dc7e1e65d477', 'a1eba5c7-5829-502d-8b07-3da0234883c6', '550e8400-e29b-41d4-a716-446655440114', NULL, 1, 1235, 1235, '2026-08-30 15:55:35.000', 'OPPONENT', '{"maulOutcome":"stopped","metersGained":14}'::jsonb, 'live-capture', TRUE, '0417d88e-6bf4-5f21-bf08-f38a8f91e51a', '2026-08-30 15:55:35.030', '2026-08-30 15:55:35.030'),
    ('00fea498-94f0-5124-be53-aa0e276ea7b7', 'a1eba5c7-5829-502d-8b07-3da0234883c6', '550e8400-e29b-41d4-a716-446655440117', '11111111-1111-1111-1111-000000000110', 1, 1268, 1268, '2026-08-30 15:56:08.000', 'OWN', '{"playerNumber":10,"stealType":"held_ingoal"}'::jsonb, 'live-capture', TRUE, '69074f15-7fa7-532a-ac04-34db7ff5f631', '2026-08-30 15:56:08.030', '2026-08-30 15:56:08.030'),
    ('02b02b70-2da9-52c8-aa09-68bf32102a56', 'a1eba5c7-5829-502d-8b07-3da0234883c6', '550e8400-e29b-41d4-a716-446655440101', NULL, 1, 1339, 1339, '2026-08-30 15:57:19.000', 'OPPONENT', '{"zone":"right"}'::jsonb, 'live-capture', TRUE, '2366d27a-9d9c-5315-8ac2-9145a024d314', '2026-08-30 15:57:19.030', '2026-08-30 15:57:19.030'),
    ('3356feb1-700a-5883-8770-74f4b511ecb6', 'a1eba5c7-5829-502d-8b07-3da0234883c6', '550e8400-e29b-41d4-a716-446655440102', NULL, 1, 1385, 1385, '2026-08-30 15:58:05.000', 'OPPONENT', '{"wasSuccessful":false,"distanceMeters":35,"zone":"right"}'::jsonb, 'live-capture', TRUE, '1e6e4a4a-17e8-5d7a-a31a-b669c8b507bf', '2026-08-30 15:58:05.030', '2026-08-30 15:58:05.030'),
    ('19cfbba0-bec2-58f8-ae3c-04216438d3e9', 'a1eba5c7-5829-502d-8b07-3da0234883c6', '550e8400-e29b-41d4-a716-446655440110', NULL, 1, 1544, 1544, '2026-08-30 16:00:44.000', 'OWN', '{"outcome":"out_in_full","kickType":"50_22"}'::jsonb, 'live-capture', TRUE, 'ec232606-8d27-5867-8328-3f3cd782f2cd', '2026-08-30 16:00:44.030', '2026-08-30 16:00:44.030'),
    ('cbffbd04-f764-5f0e-b6b6-706ee810b496', 'a1eba5c7-5829-502d-8b07-3da0234883c6', '550e8400-e29b-41d4-a716-446655440107', NULL, 1, 1630, 1630, '2026-08-30 16:02:10.000', 'OPPONENT', '{"passType":"skip","isBadPass":true}'::jsonb, 'live-capture', TRUE, '96a16853-32c0-5a22-a85c-1fb86f44952a', '2026-08-30 16:02:10.030', '2026-08-30 16:02:10.030'),
    ('c1c91759-c9e5-5dfc-8175-7e10a02bfa03', 'a1eba5c7-5829-502d-8b07-3da0234883c6', '550e8400-e29b-41d4-a716-446655440108', NULL, 1, 1722, 1722, '2026-08-30 16:03:42.000', 'OWN', '{"speed":"medium"}'::jsonb, 'live-capture', TRUE, '90e9775c-4868-593f-97da-854e59b9cbda', '2026-08-30 16:03:42.030', '2026-08-30 16:03:42.030'),
    ('079565fb-affd-57a7-8eeb-c2b9b0fc525c', 'a1eba5c7-5829-502d-8b07-3da0234883c6', '550e8400-e29b-41d4-a716-446655440112', NULL, 1, 1771, 1771, '2026-08-30 16:04:31.000', 'OWN', '{"lineResult":"penalty_for","jumpZone":"back","isMaulFormed":false}'::jsonb, 'live-capture', TRUE, '81715aa7-07aa-5285-88aa-4836a0cd3466', '2026-08-30 16:04:31.030', '2026-08-30 16:04:31.030'),
    ('75e6ea06-3121-5ef5-bb4e-ac5f37d94232', 'a1eba5c7-5829-502d-8b07-3da0234883c6', '550e8400-e29b-41d4-a716-446655440128', NULL, 1, 1846, 1846, '2026-08-30 16:05:46.000', 'OPPONENT', '{"kind":"won"}'::jsonb, 'live-capture', TRUE, '7df454d6-6aee-5d16-aa02-0748fdb74843', '2026-08-30 16:05:46.030', '2026-08-30 16:05:46.030'),
    ('4d350196-4391-55ce-bb9e-77cfb1e00c74', 'a1eba5c7-5829-502d-8b07-3da0234883c6', '550e8400-e29b-41d4-a716-446655440101', '11111111-1111-1111-1111-000000000124', 1, 1864, 1864, '2026-08-30 16:06:04.000', 'OWN', '{"zone":"right","playerNumber":24}'::jsonb, 'live-capture', TRUE, '956131c9-ecf1-5258-8907-e5ca1de4eb6f', '2026-08-30 16:06:04.030', '2026-08-30 16:06:04.030'),
    ('5448de49-e309-5d8b-8ecc-441375eb8286', 'a1eba5c7-5829-502d-8b07-3da0234883c6', '550e8400-e29b-41d4-a716-446655440102', '11111111-1111-1111-1111-000000000126', 1, 1904, 1904, '2026-08-30 16:06:44.000', 'OWN', '{"wasSuccessful":true,"playerNumber":26,"distanceMeters":33,"zone":"center"}'::jsonb, 'live-capture', TRUE, '6cb7b4e2-510a-5f8e-95bd-3c434dd52640', '2026-08-30 16:06:44.030', '2026-08-30 16:06:44.030'),
    ('5c48f863-1b19-5153-92ec-93f5bd25c163', 'a1eba5c7-5829-502d-8b07-3da0234883c6', '550e8400-e29b-41d4-a716-446655440129', NULL, 1, 1966, 1966, '2026-08-30 16:07:46.000', 'OWN', '{"quickPlayOutcome":true}'::jsonb, 'live-capture', TRUE, '03240d26-72dd-5653-860b-e05f56530d14', '2026-08-30 16:07:46.030', '2026-08-30 16:07:46.030'),
    ('f34c2220-a488-5e5e-b226-c9db3a949347', 'a1eba5c7-5829-502d-8b07-3da0234883c6', '550e8400-e29b-41d4-a716-446655440101', NULL, 2, 2477, 2477, '2026-08-30 16:16:17.000', 'OPPONENT', '{"zone":"left"}'::jsonb, 'live-capture', TRUE, '0a14ccb2-38d9-52c8-a634-411e633766dc', '2026-08-30 16:16:17.030', '2026-08-30 16:16:17.030'),
    ('a859a30d-989c-568b-ac4d-6adf4247447f', 'a1eba5c7-5829-502d-8b07-3da0234883c6', '550e8400-e29b-41d4-a716-446655440102', NULL, 2, 2513, 2513, '2026-08-30 16:16:53.000', 'OPPONENT', '{"wasSuccessful":true,"distanceMeters":28,"zone":"left"}'::jsonb, 'live-capture', TRUE, '773892d9-c62b-58ed-b011-c9ee119e6fd6', '2026-08-30 16:16:53.030', '2026-08-30 16:16:53.030'),
    ('e5650071-2ada-596f-8d33-33690fbd3838', 'a1eba5c7-5829-502d-8b07-3da0234883c6', '550e8400-e29b-41d4-a716-446655440107', NULL, 2, 2660, 2660, '2026-08-30 16:19:20.000', 'OPPONENT', '{"passType":"skip","isBadPass":false}'::jsonb, 'live-capture', TRUE, '3e9071fa-6b0d-5065-b40c-e0da947cf70c', '2026-08-30 16:19:20.030', '2026-08-30 16:19:20.030'),
    ('b64568a0-f962-5ed2-b1a2-745c6c72f9ff', 'a1eba5c7-5829-502d-8b07-3da0234883c6', '550e8400-e29b-41d4-a716-446655440101', '11111111-1111-1111-1111-000000000112', 2, 2946, 2946, '2026-08-30 16:24:06.000', 'OWN', '{"zone":"center","playerNumber":12}'::jsonb, 'live-capture', TRUE, '333520d9-9e31-5e92-a0f9-787a81b43130', '2026-08-30 16:24:06.030', '2026-08-30 16:24:06.030'),
    ('4773e29c-a40e-503f-b0ae-a5640d7b952f', 'a1eba5c7-5829-502d-8b07-3da0234883c6', '550e8400-e29b-41d4-a716-446655440102', '11111111-1111-1111-1111-000000000103', 2, 2990, 2990, '2026-08-30 16:24:50.000', 'OWN', '{"wasSuccessful":false,"playerNumber":3,"distanceMeters":36,"zone":"center"}'::jsonb, 'live-capture', TRUE, '0208dc57-8b95-5e17-81ec-ae404072317a', '2026-08-30 16:24:50.030', '2026-08-30 16:24:50.030'),
    ('a5616792-4ed4-5244-932c-904fd6814b0a', 'a1eba5c7-5829-502d-8b07-3da0234883c6', '550e8400-e29b-41d4-a716-446655440126', NULL, 2, 3000, 3000, '2026-08-30 16:25:00.000', 'OWN', '{"playerOutNumber":1,"playerInNumber":16,"playerOutId":"11111111-1111-1111-1111-000000000125","playerInId":"11111111-1111-1111-1111-000000000127"}'::jsonb, 'live-capture', TRUE, '621ddb98-b0e3-503b-afb1-b6caa4e90f87', '2026-08-30 16:25:00.030', '2026-08-30 16:25:00.030'),
    ('ed9d6024-009c-5eb4-8a82-6bdaf10eb206', 'a1eba5c7-5829-502d-8b07-3da0234883c6', '550e8400-e29b-41d4-a716-446655440108', '11111111-1111-1111-1111-000000000108', 2, 3072, 3072, '2026-08-30 16:26:12.000', 'OWN', '{"playerNumber":8,"speed":"slow"}'::jsonb, 'live-capture', TRUE, 'b6211dcd-57ff-5428-a40b-e66c5217a6fc', '2026-08-30 16:26:12.030', '2026-08-30 16:26:12.030'),
    ('87bf1a0a-b3ab-51c5-9058-67d8f425da53', 'a1eba5c7-5829-502d-8b07-3da0234883c6', '550e8400-e29b-41d4-a716-446655440113', NULL, 2, 3227, 3227, '2026-08-30 16:28:47.000', 'OPPONENT', '{"outcome":"error_out_full","kickType":"goalline_drop"}'::jsonb, 'live-capture', TRUE, '5e6e19ca-c10d-5ac7-87a5-de91621f3da1', '2026-08-30 16:28:47.030', '2026-08-30 16:28:47.030'),
    ('7499d29c-1dfb-5107-9cff-620f0bafedda', 'a1eba5c7-5829-502d-8b07-3da0234883c6', '550e8400-e29b-41d4-a716-446655440112', NULL, 2, 3246, 3246, '2026-08-30 16:29:06.000', 'OPPONENT', '{"lineResult":"lost","jumpZone":"middle","isMaulFormed":false}'::jsonb, 'live-capture', TRUE, '7c843d98-4b84-5955-bac3-ded1a7a9a09f', '2026-08-30 16:29:06.030', '2026-08-30 16:29:06.030'),
    ('d3518691-0ea6-5c2d-96d0-6973837c9179', 'a1eba5c7-5829-502d-8b07-3da0234883c6', '550e8400-e29b-41d4-a716-446655440122', NULL, 2, 3312, 3312, '2026-08-30 16:30:12.000', 'OWN', '{"penaltyType":"time_wasting"}'::jsonb, 'live-capture', TRUE, 'd70b215b-ec6e-5587-96c4-fc1d670cd3a8', '2026-08-30 16:30:12.030', '2026-08-30 16:30:12.030'),
    ('b142064e-fb4b-5412-9a06-b573a41db0f7', 'a1eba5c7-5829-502d-8b07-3da0234883c6', '550e8400-e29b-41d4-a716-446655440123', NULL, 2, 3369, 3369, '2026-08-30 16:31:09.000', 'OPPONENT', '{"reason":"repeated_infringements","durationMinutes":10}'::jsonb, 'live-capture', TRUE, '00acd6ae-9dca-5cdf-b112-c498f916e1c0', '2026-08-30 16:31:09.030', '2026-08-30 16:31:09.030'),
    ('5c3abbcd-fe2a-51a3-aeb6-6d90f7cfc72b', 'a1eba5c7-5829-502d-8b07-3da0234883c6', '550e8400-e29b-41d4-a716-446655440101', '11111111-1111-1111-1111-000000000105', 2, 3420, 3420, '2026-08-30 16:32:00.000', 'OWN', '{"zone":"center","playerNumber":5}'::jsonb, 'live-capture', TRUE, 'f203a92c-5b41-5843-a442-bb0fa46c86c1', '2026-08-30 16:32:00.030', '2026-08-30 16:32:00.030'),
    ('541fdffd-60d6-5758-8ebc-46da9b544159', 'a1eba5c7-5829-502d-8b07-3da0234883c6', '550e8400-e29b-41d4-a716-446655440102', '11111111-1111-1111-1111-000000000121', 2, 3466, 3466, '2026-08-30 16:32:46.000', 'OWN', '{"wasSuccessful":true,"playerNumber":21,"distanceMeters":22,"zone":"left"}'::jsonb, 'live-capture', TRUE, '939b6088-1023-5977-b10c-db6736a9c905', '2026-08-30 16:32:46.030', '2026-08-30 16:32:46.030'),
    ('04f89ee0-b952-5866-80a9-641f0dcfc29f', 'a1eba5c7-5829-502d-8b07-3da0234883c6', '550e8400-e29b-41d4-a716-446655440110', NULL, 2, 3624, 3624, '2026-08-30 16:35:24.000', 'OPPONENT', '{"outcome":"out_in_full","kickType":"up_under"}'::jsonb, 'live-capture', TRUE, 'f9fde728-0eeb-53fb-8ed9-776dc80ba23e', '2026-08-30 16:35:24.030', '2026-08-30 16:35:24.030'),
    ('25c68607-8c18-5175-87f4-1edcb54684bf', 'a1eba5c7-5829-502d-8b07-3da0234883c6', '550e8400-e29b-41d4-a716-446655440106', '11111111-1111-1111-1111-000000000118', 2, 3713, 3713, '2026-08-30 16:36:53.000', 'OWN', '{"playerNumber":18,"metersGained":11,"defendersBeaten":0}'::jsonb, 'live-capture', TRUE, 'fa333ddb-3b35-5f7f-855b-d27ad80bbf10', '2026-08-30 16:36:53.030', '2026-08-30 16:36:53.030'),
    ('57a38a8a-1ec4-540e-9777-68031771565c', 'a1eba5c7-5829-502d-8b07-3da0234883c6', '550e8400-e29b-41d4-a716-446655440111', NULL, 2, 3733, 3733, '2026-08-30 16:37:13.000', 'OPPONENT', '{"scrumResult":"lost_own"}'::jsonb, 'live-capture', TRUE, 'a7a6a0fe-6299-549d-a472-def15b9a006f', '2026-08-30 16:37:13.030', '2026-08-30 16:37:13.030'),
    ('b3dd5423-5394-50fd-9a75-330bb0c51052', 'a1eba5c7-5829-502d-8b07-3da0234883c6', '550e8400-e29b-41d4-a716-446655440106', NULL, 2, 3795, 3795, '2026-08-30 16:38:15.000', 'OWN', '{"metersGained":3,"defendersBeaten":0}'::jsonb, 'live-capture', TRUE, 'edf9321a-c8ed-59a6-88e9-d6ad456917ca', '2026-08-30 16:38:15.030', '2026-08-30 16:38:15.030'),
    ('ca328ee6-f817-5407-afe5-7e56a17d84ae', 'a1eba5c7-5829-502d-8b07-3da0234883c6', '550e8400-e29b-41d4-a716-446655440126', NULL, 2, 3900, 3900, '2026-08-30 16:40:00.000', 'OWN', '{"playerOutNumber":2,"playerInNumber":17,"playerOutId":"11111111-1111-1111-1111-000000000114","playerInId":"11111111-1111-1111-1111-000000000119"}'::jsonb, 'live-capture', TRUE, '9cc26758-a126-57d6-b299-003af54ceddc', '2026-08-30 16:40:00.030', '2026-08-30 16:40:00.030'),
    ('3c642b34-ea51-5b5e-92e3-e0db52b77df0', 'a1eba5c7-5829-502d-8b07-3da0234883c6', '550e8400-e29b-41d4-a716-446655440101', NULL, 2, 3911, 3911, '2026-08-30 16:40:11.000', 'OPPONENT', '{"zone":"right"}'::jsonb, 'live-capture', TRUE, '53a8319f-184b-5870-bd08-8c187f22da64', '2026-08-30 16:40:11.030', '2026-08-30 16:40:11.030'),
    ('3642b84f-5ea9-5018-b3a7-38fe2dd73854', 'a1eba5c7-5829-502d-8b07-3da0234883c6', '550e8400-e29b-41d4-a716-446655440102', NULL, 2, 3946, 3946, '2026-08-30 16:40:46.000', 'OPPONENT', '{"wasSuccessful":true,"distanceMeters":26,"zone":"left"}'::jsonb, 'live-capture', TRUE, '43d1d00b-76a1-573a-b560-b5a82b034ee5', '2026-08-30 16:40:46.030', '2026-08-30 16:40:46.030'),
    ('c6cfb180-6928-5673-901f-e0b48451583b', 'a1eba5c7-5829-502d-8b07-3da0234883c6', '550e8400-e29b-41d4-a716-446655440115', NULL, 2, 4266, 4266, '2026-08-30 16:46:06.000', 'OPPONENT', '{"assisted":true}'::jsonb, 'live-capture', TRUE, 'b72f5fa0-8c89-52f0-a80f-c778f9bd9d0d', '2026-08-30 16:46:06.030', '2026-08-30 16:46:06.030'),
    ('fbe045c1-2a19-5710-a53c-052c0dcb14bf', 'a1eba5c7-5829-502d-8b07-3da0234883c6', '550e8400-e29b-41d4-a716-446655440112', NULL, 2, 4315, 4315, '2026-08-30 16:46:55.000', 'OPPONENT', '{"lineResult":"lost","jumpZone":"middle","isMaulFormed":false}'::jsonb, 'live-capture', TRUE, '063a251c-231a-5698-bae2-35bf095097a3', '2026-08-30 16:46:55.030', '2026-08-30 16:46:55.030'),
    ('78b21271-ca34-529a-9fae-736bde5400a1', 'a1eba5c7-5829-502d-8b07-3da0234883c6', '550e8400-e29b-41d4-a716-446655440120', '11111111-1111-1111-1111-000000000118', 2, 4343, 4343, '2026-08-30 16:47:23.000', 'OWN', '{"receptionQuality":"clean_mark","playerNumber":18}'::jsonb, 'live-capture', TRUE, '9aabf1c0-2e6e-5f83-b550-41231e320bc7', '2026-08-30 16:47:23.030', '2026-08-30 16:47:23.030'),
    ('b1541964-587c-5680-ae15-a43518ae89d2', 'a1eba5c7-5829-502d-8b07-3da0234883c6', '550e8400-e29b-41d4-a716-446655440115', NULL, 2, 4344, 4344, '2026-08-30 16:47:24.000', 'OPPONENT', '{"assisted":false}'::jsonb, 'live-capture', TRUE, '691ea9a7-c5f1-5bd2-8309-9ec13ad3a9d9', '2026-08-30 16:47:24.030', '2026-08-30 16:47:24.030'),
    ('bfe1dfa7-af86-5ee6-959c-3553dd4f6a6c', 'a1eba5c7-5829-502d-8b07-3da0234883c6', '550e8400-e29b-41d4-a716-446655440122', NULL, 2, 4351, 4351, '2026-08-30 16:47:31.000', 'OPPONENT', '{"penaltyType":"scrum_illegal"}'::jsonb, 'live-capture', TRUE, 'e3b1f265-8386-5f99-8d89-1fc6a8145789', '2026-08-30 16:47:31.030', '2026-08-30 16:47:31.030'),
    ('0e454dea-9af1-50f9-ae5f-2b4390106018', 'a1eba5c7-5829-502d-8b07-3da0234883c6', '550e8400-e29b-41d4-a716-446655440109', '11111111-1111-1111-1111-000000000126', 2, 4424, 4424, '2026-08-30 16:48:44.000', 'OWN', '{"playerNumber":26,"metersGained":2}'::jsonb, 'live-capture', TRUE, '07562b81-5141-54be-8082-6347db6e06cb', '2026-08-30 16:48:44.030', '2026-08-30 16:48:44.030'),
    ('47a76f70-4ca1-53d2-a259-bb4d1744e9da', 'a1eba5c7-5829-502d-8b07-3da0234883c6', '550e8400-e29b-41d4-a716-446655440101', '11111111-1111-1111-1111-000000000120', 2, 4562, 4562, '2026-08-30 16:51:02.000', 'OWN', '{"zone":"left","playerNumber":20}'::jsonb, 'live-capture', TRUE, 'dab4278a-34b1-5e55-b8f0-167bcd32a432', '2026-08-30 16:51:02.030', '2026-08-30 16:51:02.030'),
    ('55d354cb-609d-5442-b14f-9fcdbba8214f', 'a1eba5c7-5829-502d-8b07-3da0234883c6', '550e8400-e29b-41d4-a716-446655440102', '11111111-1111-1111-1111-000000000106', 2, 4609, 4609, '2026-08-30 16:51:49.000', 'OWN', '{"wasSuccessful":true,"playerNumber":6,"distanceMeters":21,"zone":"left"}'::jsonb, 'live-capture', TRUE, '29e54dd3-c5bf-53bb-9c06-79dff7f6f714', '2026-08-30 16:51:49.030', '2026-08-30 16:51:49.030'),
    ('bfe0f5d6-6fda-545a-a0ae-61ce8af1697a', 'f16dc0a8-76d3-5ff4-b472-fc80bcaaf4ca', '550e8400-e29b-41d4-a716-446655440115', '11111111-1111-1111-1111-000000000125', 1, 163, 163, '2026-09-06 15:37:43.000', 'OWN', '{"playerNumber":25,"assisted":true}'::jsonb, 'live-capture', TRUE, 'd3ace68d-eeaf-55b7-b41e-03bf5061a1f6', '2026-09-06 15:37:43.030', '2026-09-06 15:37:43.030'),
    ('17873e68-24e6-5193-9c3e-64bc3daec73f', 'f16dc0a8-76d3-5ff4-b472-fc80bcaaf4ca', '550e8400-e29b-41d4-a716-446655440106', '11111111-1111-1111-1111-000000000125', 1, 166, 166, '2026-09-06 15:37:46.000', 'OWN', '{"playerNumber":25,"metersGained":18,"defendersBeaten":0}'::jsonb, 'live-capture', TRUE, '2366aa4e-26c1-56eb-a9aa-26be481a0420', '2026-09-06 15:37:46.030', '2026-09-06 15:37:46.030'),
    ('a6eb4d4e-20a1-5a6a-a57e-80e197199469', 'f16dc0a8-76d3-5ff4-b472-fc80bcaaf4ca', '550e8400-e29b-41d4-a716-446655440108', NULL, 1, 183, 183, '2026-09-06 15:38:03.000', 'OWN', '{"speed":"medium"}'::jsonb, 'live-capture', TRUE, '721a6dbd-f5da-5613-8b53-da99c76a0d94', '2026-09-06 15:38:03.030', '2026-09-06 15:38:03.030'),
    ('52a5bad8-d900-5094-8a5a-b24a2e0fc61c', 'f16dc0a8-76d3-5ff4-b472-fc80bcaaf4ca', '550e8400-e29b-41d4-a716-446655440112', '11111111-1111-1111-1111-000000000119', 1, 254, 254, '2026-09-06 15:39:14.000', 'OWN', '{"lineResult":"penalty_against","playerNumber":19,"jumpZone":"front","isMaulFormed":true}'::jsonb, 'live-capture', TRUE, 'ba0c55f3-01ae-5f59-8e3d-0fa88240ec72', '2026-09-06 15:39:14.030', '2026-09-06 15:39:14.030'),
    ('78aca627-dc07-5675-943d-cdd4587245e9', 'f16dc0a8-76d3-5ff4-b472-fc80bcaaf4ca', '550e8400-e29b-41d4-a716-446655440101', '11111111-1111-1111-1111-000000000105', 1, 257, 257, '2026-09-06 15:39:17.000', 'OWN', '{"zone":"left","playerNumber":5}'::jsonb, 'live-capture', TRUE, 'c67fa8d1-ccd1-5e02-8b40-c395f849a3ff', '2026-09-06 15:39:17.030', '2026-09-06 15:39:17.030'),
    ('8d8ad156-9d4d-5936-b35c-2915e0ccd483', 'f16dc0a8-76d3-5ff4-b472-fc80bcaaf4ca', '550e8400-e29b-41d4-a716-446655440102', '11111111-1111-1111-1111-000000000108', 1, 301, 301, '2026-09-06 15:40:01.000', 'OWN', '{"wasSuccessful":false,"playerNumber":8,"distanceMeters":26,"zone":"right"}'::jsonb, 'live-capture', TRUE, '3d6d6ba9-033d-5379-860d-ece39650a049', '2026-09-06 15:40:01.030', '2026-09-06 15:40:01.030'),
    ('d354ba2d-fb65-5123-9c87-fd3e3e8c3d49', 'f16dc0a8-76d3-5ff4-b472-fc80bcaaf4ca', '550e8400-e29b-41d4-a716-446655440107', NULL, 1, 669, 669, '2026-09-06 15:46:09.000', 'OPPONENT', '{"passType":"standard","isBadPass":false}'::jsonb, 'live-capture', TRUE, '37da921e-6e0a-58a6-a862-1861121d41dd', '2026-09-06 15:46:09.030', '2026-09-06 15:46:09.030'),
    ('a88ab4c8-80ef-5beb-bccb-0b084f0b7ea4', 'f16dc0a8-76d3-5ff4-b472-fc80bcaaf4ca', '550e8400-e29b-41d4-a716-446655440101', '11111111-1111-1111-1111-000000000126', 1, 1204, 1204, '2026-09-06 15:55:04.000', 'OWN', '{"zone":"center","playerNumber":26}'::jsonb, 'live-capture', TRUE, '5e4b9c92-f4ec-5e8f-b97c-cf9b283eafc4', '2026-09-06 15:55:04.030', '2026-09-06 15:55:04.030'),
    ('78ced7ac-a556-5512-b74e-8f49f3e5dd30', 'f16dc0a8-76d3-5ff4-b472-fc80bcaaf4ca', '550e8400-e29b-41d4-a716-446655440102', '11111111-1111-1111-1111-000000000125', 1, 1248, 1248, '2026-09-06 15:55:48.000', 'OWN', '{"wasSuccessful":false,"playerNumber":25,"distanceMeters":26,"zone":"left"}'::jsonb, 'live-capture', TRUE, 'fc6d73ae-ee36-5e42-bd51-fba4cc0450cf', '2026-09-06 15:55:48.030', '2026-09-06 15:55:48.030'),
    ('27feac1f-c3d9-564c-b8d4-ee13b015beee', 'f16dc0a8-76d3-5ff4-b472-fc80bcaaf4ca', '550e8400-e29b-41d4-a716-446655440106', '11111111-1111-1111-1111-000000000124', 1, 1534, 1534, '2026-09-06 16:00:34.000', 'OWN', '{"playerNumber":24,"metersGained":14,"defendersBeaten":0}'::jsonb, 'live-capture', TRUE, 'f4b3166f-6f4b-5173-8957-2d88627bc97f', '2026-09-06 16:00:34.030', '2026-09-06 16:00:34.030'),
    ('d4686559-7654-5763-ab27-60ae8f711aab', 'f16dc0a8-76d3-5ff4-b472-fc80bcaaf4ca', '550e8400-e29b-41d4-a716-446655440112', NULL, 1, 1548, 1548, '2026-09-06 16:00:48.000', 'OWN', '{"lineResult":"lost","jumpZone":"front","isMaulFormed":true}'::jsonb, 'live-capture', TRUE, 'b0cdc5f1-3be8-5a04-ac40-319c93d8aa6e', '2026-09-06 16:00:48.030', '2026-09-06 16:00:48.030'),
    ('4cb98c36-ac28-575a-b3f2-e3a9e2823746', 'f16dc0a8-76d3-5ff4-b472-fc80bcaaf4ca', '550e8400-e29b-41d4-a716-446655440107', '11111111-1111-1111-1111-000000000106', 1, 1552, 1552, '2026-09-06 16:00:52.000', 'OWN', '{"passType":"skip","playerNumber":6,"isBadPass":true}'::jsonb, 'live-capture', TRUE, '07a758b7-9706-5c3d-b0c1-5058844416ac', '2026-09-06 16:00:52.030', '2026-09-06 16:00:52.030'),
    ('ed0147b2-4aa9-5143-b940-5c58171bd5d3', 'f16dc0a8-76d3-5ff4-b472-fc80bcaaf4ca', '550e8400-e29b-41d4-a716-446655440111', NULL, 1, 1668, 1668, '2026-09-06 16:02:48.000', 'OPPONENT', '{"scrumResult":"penalty_against"}'::jsonb, 'live-capture', TRUE, 'e9d0f9ff-16f0-5463-b097-3a3811afbfe2', '2026-09-06 16:02:48.030', '2026-09-06 16:02:48.030'),
    ('7285a3a5-4f30-5e1d-8c4b-35177e4c584b', 'f16dc0a8-76d3-5ff4-b472-fc80bcaaf4ca', '550e8400-e29b-41d4-a716-446655440110', '11111111-1111-1111-1111-000000000113', 1, 1711, 1711, '2026-09-06 16:03:31.000', 'OWN', '{"outcome":"retained","playerNumber":13,"kickType":"up_under"}'::jsonb, 'live-capture', TRUE, 'e5fa37cc-d015-5464-8298-08dc0a91c2f8', '2026-09-06 16:03:31.030', '2026-09-06 16:03:31.030'),
    ('cb0e088d-fcef-5f63-aea6-455581ae07ab', 'f16dc0a8-76d3-5ff4-b472-fc80bcaaf4ca', '550e8400-e29b-41d4-a716-446655440106', NULL, 1, 1723, 1723, '2026-09-06 16:03:43.000', 'OWN', '{"metersGained":9,"defendersBeaten":0}'::jsonb, 'live-capture', TRUE, '506d1802-3292-5a25-9333-adfb5db4977f', '2026-09-06 16:03:43.030', '2026-09-06 16:03:43.030'),
    ('f49c61a6-6bb9-5422-a344-9dfb8246eb3d', 'f16dc0a8-76d3-5ff4-b472-fc80bcaaf4ca', '550e8400-e29b-41d4-a716-446655440107', NULL, 1, 1778, 1778, '2026-09-06 16:04:38.000', 'OPPONENT', '{"passType":"offload","isBadPass":false}'::jsonb, 'live-capture', TRUE, '6ae5b77f-2f8a-59e4-843e-26ae6ab0e9c7', '2026-09-06 16:04:38.030', '2026-09-06 16:04:38.030'),
    ('acef0ab0-7d42-5e02-87aa-d911c1805503', 'f16dc0a8-76d3-5ff4-b472-fc80bcaaf4ca', '550e8400-e29b-41d4-a716-446655440129', '11111111-1111-1111-1111-000000000113', 1, 1782, 1782, '2026-09-06 16:04:42.000', 'OWN', '{"playerNumber":13,"quickPlayOutcome":true}'::jsonb, 'live-capture', TRUE, '6e099089-e06b-5880-ad0c-572cdf360b6e', '2026-09-06 16:04:42.030', '2026-09-06 16:04:42.030'),
    ('5547ffad-4485-5616-a907-614ed28c69a5', 'f16dc0a8-76d3-5ff4-b472-fc80bcaaf4ca', '550e8400-e29b-41d4-a716-446655440101', NULL, 1, 1981, 1981, '2026-09-06 16:08:01.000', 'OPPONENT', '{"zone":"center"}'::jsonb, 'live-capture', TRUE, '7f5adae1-78af-5d7a-82f2-89d01b616984', '2026-09-06 16:08:01.030', '2026-09-06 16:08:01.030'),
    ('ce428741-f1ff-58dc-bf75-c19f2f53bc23', 'f16dc0a8-76d3-5ff4-b472-fc80bcaaf4ca', '550e8400-e29b-41d4-a716-446655440102', NULL, 1, 2031, 2031, '2026-09-06 16:08:51.000', 'OPPONENT', '{"wasSuccessful":false,"distanceMeters":28,"zone":"center"}'::jsonb, 'live-capture', TRUE, 'fe878975-da1f-5796-99a9-39390d40195e', '2026-09-06 16:08:51.030', '2026-09-06 16:08:51.030'),
    ('4b61c93e-e349-5156-ac71-8e6137583dc3', 'f16dc0a8-76d3-5ff4-b472-fc80bcaaf4ca', '550e8400-e29b-41d4-a716-446655440120', '11111111-1111-1111-1111-000000000104', 1, 2125, 2125, '2026-09-06 16:10:25.000', 'OWN', '{"receptionQuality":"contested_won","playerNumber":4}'::jsonb, 'live-capture', TRUE, 'dc4a5904-3509-5a1a-9c67-9dcd2583576e', '2026-09-06 16:10:25.030', '2026-09-06 16:10:25.030'),
    ('be8ec0d3-bcda-5ddf-a64f-adb70ae7c5f8', 'f16dc0a8-76d3-5ff4-b472-fc80bcaaf4ca', '550e8400-e29b-41d4-a716-446655440109', NULL, 1, 2141, 2141, '2026-09-06 16:10:41.000', 'OPPONENT', '{"metersGained":14}'::jsonb, 'live-capture', TRUE, 'a0b7ccfd-1b7d-582f-b8dd-73878b277de2', '2026-09-06 16:10:41.030', '2026-09-06 16:10:41.030'),
    ('3350f3aa-6ed1-58a2-bf23-470c8556b209', 'f16dc0a8-76d3-5ff4-b472-fc80bcaaf4ca', '550e8400-e29b-41d4-a716-446655440115', '11111111-1111-1111-1111-000000000112', 1, 2295, 2295, '2026-09-06 16:13:15.000', 'OWN', '{"playerNumber":12,"assisted":true}'::jsonb, 'live-capture', TRUE, '2aaba33a-0416-5fd6-8bb2-d76dcb20a0ee', '2026-09-06 16:13:15.030', '2026-09-06 16:13:15.030'),
    ('dda3b51e-a684-576f-984e-5ba6b582f65e', 'f16dc0a8-76d3-5ff4-b472-fc80bcaaf4ca', '550e8400-e29b-41d4-a716-446655440104', NULL, 1, 2360, 2360, '2026-09-06 16:14:20.000', 'OPPONENT', '{"wasSuccessful":true,"distanceMeters":37,"zone":"center"}'::jsonb, 'live-capture', TRUE, '68ee0af9-531a-578b-92b7-55a4b2e4281e', '2026-09-06 16:14:20.030', '2026-09-06 16:14:20.030'),
    ('286a39b9-07b8-5bf2-abb6-ec3e6e5c6109', 'f16dc0a8-76d3-5ff4-b472-fc80bcaaf4ca', '550e8400-e29b-41d4-a716-446655440113', '11111111-1111-1111-1111-000000000118', 2, 2431, 2431, '2026-09-06 16:15:31.000', 'OWN', '{"outcome":"regained_attack","playerNumber":18,"kickType":"22m_drop"}'::jsonb, 'live-capture', TRUE, 'e7a29290-4353-5d03-872d-bed8a79283b8', '2026-09-06 16:15:31.030', '2026-09-06 16:15:31.030'),
    ('610e8a31-1d5f-5afb-80de-ee50a46da97a', 'f16dc0a8-76d3-5ff4-b472-fc80bcaaf4ca', '550e8400-e29b-41d4-a716-446655440112', NULL, 2, 2541, 2541, '2026-09-06 16:17:21.000', 'OWN', '{"lineResult":"lost","jumpZone":"back","isMaulFormed":false}'::jsonb, 'live-capture', TRUE, 'c8b326fc-6356-5fa4-a3e1-60bf3495a26a', '2026-09-06 16:17:21.030', '2026-09-06 16:17:21.030'),
    ('9dfbf049-bbc7-585f-acfc-0506c1b61382', 'f16dc0a8-76d3-5ff4-b472-fc80bcaaf4ca', '550e8400-e29b-41d4-a716-446655440114', NULL, 2, 2639, 2639, '2026-09-06 16:18:59.000', 'OPPONENT', '{"maulOutcome":"advanced","metersGained":13}'::jsonb, 'live-capture', TRUE, '3615a3e2-1306-5901-976d-e290845bc122', '2026-09-06 16:18:59.030', '2026-09-06 16:18:59.030'),
    ('b011c78a-5451-5d34-a25a-c6bbc21526e6', 'f16dc0a8-76d3-5ff4-b472-fc80bcaaf4ca', '550e8400-e29b-41d4-a716-446655440105', NULL, 2, 2874, 2874, '2026-09-06 16:22:54.000', 'OWN', '{"wasSuccessful":false,"distanceMeters":27}'::jsonb, 'live-capture', TRUE, '99cab17a-ebfb-5c87-8f55-be9e35657337', '2026-09-06 16:22:54.030', '2026-09-06 16:22:54.030'),
    ('aa7879ea-5289-5f5d-a1e9-30c982e786af', 'f16dc0a8-76d3-5ff4-b472-fc80bcaaf4ca', '550e8400-e29b-41d4-a716-446655440101', NULL, 2, 2900, 2900, '2026-09-06 16:23:20.000', 'OPPONENT', '{"zone":"right"}'::jsonb, 'live-capture', TRUE, '2b42eb9c-dd1f-5e33-9d45-3aeeb42609fa', '2026-09-06 16:23:20.030', '2026-09-06 16:23:20.030'),
    ('dbedfad5-4864-5afa-a789-74deb355ee79', 'f16dc0a8-76d3-5ff4-b472-fc80bcaaf4ca', '550e8400-e29b-41d4-a716-446655440102', NULL, 2, 2947, 2947, '2026-09-06 16:24:07.000', 'OPPONENT', '{"wasSuccessful":true,"distanceMeters":27,"zone":"left"}'::jsonb, 'live-capture', TRUE, 'b64cbba6-7356-5b7c-9ede-6dd4017e070c', '2026-09-06 16:24:07.030', '2026-09-06 16:24:07.030'),
    ('c21545d4-645b-56cc-a1bb-3c5742c7013f', 'f16dc0a8-76d3-5ff4-b472-fc80bcaaf4ca', '550e8400-e29b-41d4-a716-446655440126', NULL, 2, 3000, 3000, '2026-09-06 16:25:00.000', 'OWN', '{"playerOutNumber":1,"playerInNumber":16,"playerOutId":"11111111-1111-1111-1111-000000000112","playerInId":"11111111-1111-1111-1111-000000000116"}'::jsonb, 'live-capture', TRUE, '6d92b6b7-f3f4-59a5-877a-59d3d88c223f', '2026-09-06 16:25:00.030', '2026-09-06 16:25:00.030'),
    ('f822ab99-0ee9-5937-a1c6-fee0d4382cdb', 'f16dc0a8-76d3-5ff4-b472-fc80bcaaf4ca', '550e8400-e29b-41d4-a716-446655440128', '11111111-1111-1111-1111-000000000108', 2, 3035, 3035, '2026-09-06 16:25:35.000', 'OWN', '{"kind":"won","playerNumber":8}'::jsonb, 'live-capture', TRUE, '0ed5d5de-1958-5b9a-9a3a-35d2e01aab65', '2026-09-06 16:25:35.030', '2026-09-06 16:25:35.030'),
    ('3f2b608c-7031-5fc2-8bdd-98d8102914cb', 'f16dc0a8-76d3-5ff4-b472-fc80bcaaf4ca', '550e8400-e29b-41d4-a716-446655440117', NULL, 2, 3221, 3221, '2026-09-06 16:28:41.000', 'OWN', '{"stealType":"rip_standing"}'::jsonb, 'live-capture', TRUE, 'ae36842d-c645-508f-bb63-1dffa06c0f12', '2026-09-06 16:28:41.030', '2026-09-06 16:28:41.030'),
    ('2c322cad-98d7-53de-bd4a-8a33eec66449', 'f16dc0a8-76d3-5ff4-b472-fc80bcaaf4ca', '550e8400-e29b-41d4-a716-446655440108', '11111111-1111-1111-1111-000000000121', 2, 3228, 3228, '2026-09-06 16:28:48.000', 'OWN', '{"playerNumber":21,"speed":"medium"}'::jsonb, 'live-capture', TRUE, 'af615e5d-e048-5315-9d03-c4992314abf9', '2026-09-06 16:28:48.030', '2026-09-06 16:28:48.030'),
    ('d305bdf7-2eb6-5973-ad69-53642cdcec7b', 'f16dc0a8-76d3-5ff4-b472-fc80bcaaf4ca', '550e8400-e29b-41d4-a716-446655440120', NULL, 2, 3319, 3319, '2026-09-06 16:30:19.000', 'OWN', '{"receptionQuality":"fumbled"}'::jsonb, 'live-capture', TRUE, '1a5f424b-d298-54bb-8b07-26a74c0d07eb', '2026-09-06 16:30:19.030', '2026-09-06 16:30:19.030'),
    ('6b04de26-e1b8-5bd3-afa0-821d34eb0864', 'f16dc0a8-76d3-5ff4-b472-fc80bcaaf4ca', '550e8400-e29b-41d4-a716-446655440106', '11111111-1111-1111-1111-000000000122', 2, 3328, 3328, '2026-09-06 16:30:28.000', 'OWN', '{"playerNumber":22,"metersGained":17,"defendersBeaten":0}'::jsonb, 'live-capture', TRUE, '503b06c6-c61c-5cc2-a43f-edce8d36207f', '2026-09-06 16:30:28.030', '2026-09-06 16:30:28.030'),
    ('72ee16ed-a49d-5486-bfe5-8a3ae8935c90', 'f16dc0a8-76d3-5ff4-b472-fc80bcaaf4ca', '550e8400-e29b-41d4-a716-446655440109', '11111111-1111-1111-1111-000000000122', 2, 3500, 3500, '2026-09-06 16:33:20.000', 'OWN', '{"playerNumber":22,"metersGained":18}'::jsonb, 'live-capture', TRUE, '2e39d638-00e5-5d42-a516-4d72e3bbe90e', '2026-09-06 16:33:20.030', '2026-09-06 16:33:20.030'),
    ('896fbf19-f649-5aa9-afe2-326cb831c995', 'f16dc0a8-76d3-5ff4-b472-fc80bcaaf4ca', '550e8400-e29b-41d4-a716-446655440116', NULL, 2, 3556, 3556, '2026-09-06 16:34:16.000', 'OPPONENT', '{"failReason":"bounced_off"}'::jsonb, 'live-capture', TRUE, '5f1b3480-07fe-5b43-b5c3-bdc92371e023', '2026-09-06 16:34:16.030', '2026-09-06 16:34:16.030'),
    ('375039df-66a8-55a1-9395-7fd5e90c137d', 'f16dc0a8-76d3-5ff4-b472-fc80bcaaf4ca', '550e8400-e29b-41d4-a716-446655440117', NULL, 2, 3571, 3571, '2026-09-06 16:34:31.000', 'OWN', '{"stealType":"dropped_unforced"}'::jsonb, 'live-capture', TRUE, '80168499-de34-5270-943c-ebf90dbcc380', '2026-09-06 16:34:31.030', '2026-09-06 16:34:31.030'),
    ('14cb857a-22f9-50b6-a53c-a0d2fde08247', 'f16dc0a8-76d3-5ff4-b472-fc80bcaaf4ca', '550e8400-e29b-41d4-a716-446655440115', '11111111-1111-1111-1111-000000000101', 2, 3582, 3582, '2026-09-06 16:34:42.000', 'OWN', '{"playerNumber":1,"assisted":true}'::jsonb, 'live-capture', TRUE, '84fdb104-b8d0-5dc2-9e79-df90c499df00', '2026-09-06 16:34:42.030', '2026-09-06 16:34:42.030'),
    ('e86a5053-96fc-5bfc-ad53-9dd8c474e37b', 'f16dc0a8-76d3-5ff4-b472-fc80bcaaf4ca', '550e8400-e29b-41d4-a716-446655440101', '11111111-1111-1111-1111-000000000120', 2, 3677, 3677, '2026-09-06 16:36:17.000', 'OWN', '{"zone":"right","playerNumber":20}'::jsonb, 'live-capture', TRUE, 'f9a69a55-0e1f-59b4-be9e-7f6a325d0c2b', '2026-09-06 16:36:17.030', '2026-09-06 16:36:17.030'),
    ('ef976350-ba2c-5e72-949b-fe971f9a6ab7', 'f16dc0a8-76d3-5ff4-b472-fc80bcaaf4ca', '550e8400-e29b-41d4-a716-446655440102', '11111111-1111-1111-1111-000000000109', 2, 3715, 3715, '2026-09-06 16:36:55.000', 'OWN', '{"wasSuccessful":true,"playerNumber":9,"distanceMeters":36,"zone":"right"}'::jsonb, 'live-capture', TRUE, '35cad7f0-5095-545c-ac21-d027e818c252', '2026-09-06 16:36:55.030', '2026-09-06 16:36:55.030'),
    ('1bd32999-44a3-5360-90cc-06d7586a3325', 'f16dc0a8-76d3-5ff4-b472-fc80bcaaf4ca', '550e8400-e29b-41d4-a716-446655440122', '11111111-1111-1111-1111-000000000127', 2, 3842, 3842, '2026-09-06 16:39:02.000', 'OWN', '{"playerNumber":27,"penaltyType":"obstruction"}'::jsonb, 'live-capture', TRUE, 'e388d751-3ad5-5755-bd77-6d01bb407a20', '2026-09-06 16:39:02.030', '2026-09-06 16:39:02.030'),
    ('80efae9b-5087-58fb-9ddb-346ff24a61c4', 'f16dc0a8-76d3-5ff4-b472-fc80bcaaf4ca', '550e8400-e29b-41d4-a716-446655440126', NULL, 2, 3900, 3900, '2026-09-06 16:40:00.000', 'OWN', '{"playerOutNumber":2,"playerInNumber":17,"playerOutId":"11111111-1111-1111-1111-000000000118","playerInId":"11111111-1111-1111-1111-000000000120"}'::jsonb, 'live-capture', TRUE, 'ba14da8a-5273-5a4b-8223-9efa3606c608', '2026-09-06 16:40:00.030', '2026-09-06 16:40:00.030'),
    ('4900611c-63d8-5baa-9e2f-57c2b7db4fbe', 'f16dc0a8-76d3-5ff4-b472-fc80bcaaf4ca', '550e8400-e29b-41d4-a716-446655440108', NULL, 2, 3905, 3905, '2026-09-06 16:40:05.000', 'OPPONENT', '{"speed":"slow"}'::jsonb, 'live-capture', TRUE, '7deee8ee-f856-53e7-8cde-c84bd820f404', '2026-09-06 16:40:05.030', '2026-09-06 16:40:05.030'),
    ('6011fc9d-e0a0-5e85-bb34-ecfc7408fea5', 'f16dc0a8-76d3-5ff4-b472-fc80bcaaf4ca', '550e8400-e29b-41d4-a716-446655440122', NULL, 2, 4202, 4202, '2026-09-06 16:45:02.000', 'OPPONENT', '{"penaltyType":"dissent"}'::jsonb, 'live-capture', TRUE, 'f6a88f61-cf82-5143-a1e3-810dbac3198e', '2026-09-06 16:45:02.030', '2026-09-06 16:45:02.030'),
    ('c7056509-14cb-58de-b1a2-dac11a62dcb3', 'f16dc0a8-76d3-5ff4-b472-fc80bcaaf4ca', '550e8400-e29b-41d4-a716-446655440115', '11111111-1111-1111-1111-000000000121', 2, 4265, 4265, '2026-09-06 16:46:05.000', 'OWN', '{"playerNumber":21,"assisted":false}'::jsonb, 'live-capture', TRUE, 'a32c6b26-c2ed-5ae7-85b9-9f4a9419b816', '2026-09-06 16:46:05.030', '2026-09-06 16:46:05.030'),
    ('604f1196-a3e2-5c95-94f7-d02722d5a03f', 'f16dc0a8-76d3-5ff4-b472-fc80bcaaf4ca', '550e8400-e29b-41d4-a716-446655440101', NULL, 2, 4448, 4448, '2026-09-06 16:49:08.000', 'OPPONENT', '{"zone":"right"}'::jsonb, 'live-capture', TRUE, 'f9afa74f-a182-552d-aeb0-b5bc502c1a46', '2026-09-06 16:49:08.030', '2026-09-06 16:49:08.030'),
    ('90dcee59-f4a7-59d4-959b-530ef863b8c6', 'f16dc0a8-76d3-5ff4-b472-fc80bcaaf4ca', '550e8400-e29b-41d4-a716-446655440102', NULL, 2, 4483, 4483, '2026-09-06 16:49:43.000', 'OPPONENT', '{"wasSuccessful":true,"distanceMeters":39,"zone":"center"}'::jsonb, 'live-capture', TRUE, '985ce747-94a7-5813-b2ba-41c547ef8059', '2026-09-06 16:49:43.030', '2026-09-06 16:49:43.030'),
    ('648496a8-a050-517b-ac99-fed20ddc9e46', 'f16dc0a8-76d3-5ff4-b472-fc80bcaaf4ca', '550e8400-e29b-41d4-a716-446655440111', '11111111-1111-1111-1111-000000000120', 2, 4573, 4573, '2026-09-06 16:51:13.000', 'OWN', '{"scrumResult":"penalty_for","playerNumber":20}'::jsonb, 'live-capture', TRUE, '15fedb2a-3527-5b75-947d-ec260bf30da2', '2026-09-06 16:51:13.030', '2026-09-06 16:51:13.030'),
    ('aa41aa73-b109-58a2-a177-156353dff615', 'f16dc0a8-76d3-5ff4-b472-fc80bcaaf4ca', '550e8400-e29b-41d4-a716-446655440110', '11111111-1111-1111-1111-000000000106', 2, 4719, 4719, '2026-09-06 16:53:39.000', 'OWN', '{"outcome":"out_in_full","playerNumber":6,"kickType":"grubber"}'::jsonb, 'live-capture', TRUE, '96e1f280-c622-5323-9c90-aa8838039717', '2026-09-06 16:53:39.030', '2026-09-06 16:53:39.030'),
    ('4da34486-48de-51f5-9099-1fbfbd135466', '18d2410f-2369-554e-ae72-b32cd1c33f2d', '550e8400-e29b-41d4-a716-446655440115', '11111111-1111-1111-1111-000000000114', 1, 233, 233, '2026-09-13 15:38:53.000', 'OWN', '{"playerNumber":14,"assisted":true}'::jsonb, 'live-capture', TRUE, '21e5bda5-d2a7-522c-a2a6-4c263456b75b', '2026-09-13 15:38:53.030', '2026-09-13 15:38:53.030'),
    ('0d3c6006-5fcc-5af7-833f-4f81e72c9410', '18d2410f-2369-554e-ae72-b32cd1c33f2d', '550e8400-e29b-41d4-a716-446655440122', NULL, 1, 267, 267, '2026-09-13 15:39:27.000', 'OPPONENT', '{"penaltyType":"not_ten_meters"}'::jsonb, 'live-capture', TRUE, 'deecd4bf-64b8-5c2b-a296-f433b06c2bc6', '2026-09-13 15:39:27.030', '2026-09-13 15:39:27.030'),
    ('7176e8a5-c3da-53d8-996b-53633477f2d8', '18d2410f-2369-554e-ae72-b32cd1c33f2d', '550e8400-e29b-41d4-a716-446655440101', '11111111-1111-1111-1111-000000000112', 1, 311, 311, '2026-09-13 15:40:11.000', 'OWN', '{"zone":"left","playerNumber":12}'::jsonb, 'live-capture', TRUE, '21e95616-e42b-5575-a8de-aa6908911cef', '2026-09-13 15:40:11.030', '2026-09-13 15:40:11.030'),
    ('3806962a-0db2-52da-9603-a860c0f770b5', '18d2410f-2369-554e-ae72-b32cd1c33f2d', '550e8400-e29b-41d4-a716-446655440102', '11111111-1111-1111-1111-000000000126', 1, 348, 348, '2026-09-13 15:40:48.000', 'OWN', '{"wasSuccessful":true,"playerNumber":26,"distanceMeters":36,"zone":"right"}'::jsonb, 'live-capture', TRUE, '3ac245d3-2d83-52a2-af4c-3e44c2cd6033', '2026-09-13 15:40:48.030', '2026-09-13 15:40:48.030'),
    ('17f2656e-317e-5fb9-8cb3-b5c32bc4f94d', '18d2410f-2369-554e-ae72-b32cd1c33f2d', '550e8400-e29b-41d4-a716-446655440115', NULL, 1, 508, 508, '2026-09-13 15:43:28.000', 'OPPONENT', '{"assisted":false}'::jsonb, 'live-capture', TRUE, '7e212d7d-735b-5b2a-a618-27b1228ebf92', '2026-09-13 15:43:28.030', '2026-09-13 15:43:28.030'),
    ('95a43dce-448b-5f13-9d7e-8f1f2532f784', '18d2410f-2369-554e-ae72-b32cd1c33f2d', '550e8400-e29b-41d4-a716-446655440106', NULL, 1, 570, 570, '2026-09-13 15:44:30.000', 'OPPONENT', '{"metersGained":4,"defendersBeaten":0}'::jsonb, 'live-capture', TRUE, 'f21da235-2901-52dc-a42b-b8858b88326f', '2026-09-13 15:44:30.030', '2026-09-13 15:44:30.030'),
    ('ec5f7a66-0507-5f41-aa13-f6c42b407584', '18d2410f-2369-554e-ae72-b32cd1c33f2d', '550e8400-e29b-41d4-a716-446655440115', '11111111-1111-1111-1111-000000000112', 1, 1028, 1028, '2026-09-13 15:52:08.000', 'OWN', '{"playerNumber":12,"assisted":false}'::jsonb, 'live-capture', TRUE, '5571a1f6-7562-5519-a57e-6de81298f8a7', '2026-09-13 15:52:08.030', '2026-09-13 15:52:08.030'),
    ('f2a55184-e9d4-5a39-8356-78a8d0ea2508', '18d2410f-2369-554e-ae72-b32cd1c33f2d', '550e8400-e29b-41d4-a716-446655440107', NULL, 1, 1030, 1030, '2026-09-13 15:52:10.000', 'OPPONENT', '{"passType":"offload","isBadPass":false}'::jsonb, 'live-capture', TRUE, '234f6235-6f09-583b-8ad5-eac1b2682ae4', '2026-09-13 15:52:10.030', '2026-09-13 15:52:10.030'),
    ('481c4501-1b94-5549-9069-dfd6ef1821f3', '18d2410f-2369-554e-ae72-b32cd1c33f2d', '550e8400-e29b-41d4-a716-446655440114', '11111111-1111-1111-1111-000000000102', 1, 1031, 1031, '2026-09-13 15:52:11.000', 'OWN', '{"maulOutcome":"advanced","playerNumber":2,"metersGained":7}'::jsonb, 'live-capture', TRUE, '5612a39a-4fa2-53b0-85ea-26858c307e06', '2026-09-13 15:52:11.030', '2026-09-13 15:52:11.030'),
    ('6803d790-94b6-5eb8-9258-3abcd0e1532b', '18d2410f-2369-554e-ae72-b32cd1c33f2d', '550e8400-e29b-41d4-a716-446655440101', NULL, 1, 1089, 1089, '2026-09-13 15:53:09.000', 'OPPONENT', '{"zone":"right"}'::jsonb, 'live-capture', TRUE, '02094ffd-18df-529f-9f66-8b5c9005ee91', '2026-09-13 15:53:09.030', '2026-09-13 15:53:09.030'),
    ('e34ca320-b7e9-54e2-b1fb-c8a12ea1048a', '18d2410f-2369-554e-ae72-b32cd1c33f2d', '550e8400-e29b-41d4-a716-446655440102', NULL, 1, 1126, 1126, '2026-09-13 15:53:46.000', 'OPPONENT', '{"wasSuccessful":true,"distanceMeters":21,"zone":"left"}'::jsonb, 'live-capture', TRUE, 'eb3599b3-b423-5c7e-9753-9ec14a0164f5', '2026-09-13 15:53:46.030', '2026-09-13 15:53:46.030'),
    ('be090d58-f2a2-5bf0-b794-5b629b899340', '18d2410f-2369-554e-ae72-b32cd1c33f2d', '550e8400-e29b-41d4-a716-446655440113', NULL, 1, 1336, 1336, '2026-09-13 15:57:16.000', 'OPPONENT', '{"outcome":"error_out_full","kickType":"halfway_start"}'::jsonb, 'live-capture', TRUE, 'cf94f182-2dcd-586b-95fa-dfd7021620af', '2026-09-13 15:57:16.030', '2026-09-13 15:57:16.030'),
    ('615d3993-9401-5367-be90-df5a495109bc', '18d2410f-2369-554e-ae72-b32cd1c33f2d', '550e8400-e29b-41d4-a716-446655440110', '11111111-1111-1111-1111-000000000122', 1, 1616, 1616, '2026-09-13 16:01:56.000', 'OWN', '{"outcome":"opp_possession","playerNumber":22,"kickType":"up_under"}'::jsonb, 'live-capture', TRUE, '8b24f822-f07b-5ca1-b434-7c266a714d56', '2026-09-13 16:01:56.030', '2026-09-13 16:01:56.030'),
    ('f96cc847-b9ad-5b07-9fc7-89c9ca79627c', '18d2410f-2369-554e-ae72-b32cd1c33f2d', '550e8400-e29b-41d4-a716-446655440115', '11111111-1111-1111-1111-000000000116', 1, 1629, 1629, '2026-09-13 16:02:09.000', 'OWN', '{"playerNumber":16,"assisted":false}'::jsonb, 'live-capture', TRUE, 'b331ec1c-d47e-5b62-a07f-2614cc10f556', '2026-09-13 16:02:09.030', '2026-09-13 16:02:09.030'),
    ('fe7bdd16-9a3b-5039-91ae-49f3aab4bb6a', '18d2410f-2369-554e-ae72-b32cd1c33f2d', '550e8400-e29b-41d4-a716-446655440108', '11111111-1111-1111-1111-000000000121', 1, 1646, 1646, '2026-09-13 16:02:26.000', 'OWN', '{"playerNumber":21,"speed":"slow"}'::jsonb, 'live-capture', TRUE, '0340cf43-bb7e-5819-ae28-d8b5bcde7515', '2026-09-13 16:02:26.030', '2026-09-13 16:02:26.030'),
    ('5be010ea-2e91-59b4-a20a-2c91b6dbedaa', '18d2410f-2369-554e-ae72-b32cd1c33f2d', '550e8400-e29b-41d4-a716-446655440112', '11111111-1111-1111-1111-000000000119', 1, 1718, 1718, '2026-09-13 16:03:38.000', 'OWN', '{"lineResult":"penalty_for","playerNumber":19,"jumpZone":"middle","isMaulFormed":true}'::jsonb, 'live-capture', TRUE, 'c7a5352f-475b-50be-90d0-0e8ae71b5b84', '2026-09-13 16:03:38.030', '2026-09-13 16:03:38.030'),
    ('ff5e31d7-648a-51e3-b219-04d6a0e5f046', '18d2410f-2369-554e-ae72-b32cd1c33f2d', '550e8400-e29b-41d4-a716-446655440101', '11111111-1111-1111-1111-000000000121', 1, 2057, 2057, '2026-09-13 16:09:17.000', 'OWN', '{"zone":"center","playerNumber":21}'::jsonb, 'live-capture', TRUE, '201f201e-2564-57cf-9052-d07ca41b81d4', '2026-09-13 16:09:17.030', '2026-09-13 16:09:17.030'),
    ('6d1a3ce2-7aed-5a42-8c4e-a6d2cdb5072e', '18d2410f-2369-554e-ae72-b32cd1c33f2d', '550e8400-e29b-41d4-a716-446655440102', '11111111-1111-1111-1111-000000000112', 1, 2106, 2106, '2026-09-13 16:10:06.000', 'OWN', '{"wasSuccessful":true,"playerNumber":12,"distanceMeters":25,"zone":"left"}'::jsonb, 'live-capture', TRUE, '60a01377-56fe-5c5e-9cc4-8aad2d832083', '2026-09-13 16:10:06.030', '2026-09-13 16:10:06.030'),
    ('89657143-41ff-5bbf-bf38-db87acc958c8', '18d2410f-2369-554e-ae72-b32cd1c33f2d', '550e8400-e29b-41d4-a716-446655440106', NULL, 1, 2388, 2388, '2026-09-13 16:14:48.000', 'OPPONENT', '{"metersGained":3,"defendersBeaten":0}'::jsonb, 'live-capture', TRUE, '2884b0a9-9dc4-56f9-828f-5e2fa9b1c1ea', '2026-09-13 16:14:48.030', '2026-09-13 16:14:48.030'),
    ('c83602b9-8490-5bef-92ad-ebd16e0f82ed', '18d2410f-2369-554e-ae72-b32cd1c33f2d', '550e8400-e29b-41d4-a716-446655440108', NULL, 2, 2416, 2416, '2026-09-13 16:15:16.000', 'OPPONENT', '{"speed":"fast"}'::jsonb, 'live-capture', TRUE, '453842f1-5da5-5c87-94c4-251dddb4056a', '2026-09-13 16:15:16.030', '2026-09-13 16:15:16.030'),
    ('7925a874-2638-53c8-b84d-c242d622ed81', '18d2410f-2369-554e-ae72-b32cd1c33f2d', '550e8400-e29b-41d4-a716-446655440125', '11111111-1111-1111-1111-000000000104', 2, 2505, 2505, '2026-09-13 16:16:45.000', 'OWN', '{"playerNumber":4,"injuryArea":"muscle"}'::jsonb, 'live-capture', TRUE, '1d2c01bb-45f9-577e-8015-f674b391d3b2', '2026-09-13 16:16:45.030', '2026-09-13 16:16:45.030'),
    ('b1cceb8b-266e-5494-8464-01c5622d1dc3', '18d2410f-2369-554e-ae72-b32cd1c33f2d', '550e8400-e29b-41d4-a716-446655440112', '11111111-1111-1111-1111-000000000121', 2, 2550, 2550, '2026-09-13 16:17:30.000', 'OWN', '{"lineResult":"penalty_for","playerNumber":21,"jumpZone":"front","isMaulFormed":false}'::jsonb, 'live-capture', TRUE, '69367c23-b85f-5311-9387-2201c104885d', '2026-09-13 16:17:30.030', '2026-09-13 16:17:30.030'),
    ('c2f3590a-0205-5d19-b82f-207f3b35abd5', '18d2410f-2369-554e-ae72-b32cd1c33f2d', '550e8400-e29b-41d4-a716-446655440120', NULL, 2, 2588, 2588, '2026-09-13 16:18:08.000', 'OPPONENT', '{"receptionQuality":"clean_mark"}'::jsonb, 'live-capture', TRUE, 'c81ab04c-6c4a-50ad-b3cc-90b317a5b251', '2026-09-13 16:18:08.030', '2026-09-13 16:18:08.030'),
    ('35bc1ddb-e0b1-5d21-a412-f10ac4224fd5', '18d2410f-2369-554e-ae72-b32cd1c33f2d', '550e8400-e29b-41d4-a716-446655440117', NULL, 2, 2680, 2680, '2026-09-13 16:19:40.000', 'OPPONENT', '{"stealType":"held_ingoal"}'::jsonb, 'live-capture', TRUE, '15775882-f25e-545b-8382-26ff53ca9c2c', '2026-09-13 16:19:40.030', '2026-09-13 16:19:40.030'),
    ('6930fcad-e614-5e7e-9f53-b0f5d450fc41', '18d2410f-2369-554e-ae72-b32cd1c33f2d', '550e8400-e29b-41d4-a716-446655440107', '11111111-1111-1111-1111-000000000120', 2, 2719, 2719, '2026-09-13 16:20:19.000', 'OWN', '{"passType":"standard","playerNumber":20,"isBadPass":false}'::jsonb, 'live-capture', TRUE, 'a7f16c16-ba0b-5622-aba9-112ee603b1da', '2026-09-13 16:20:19.030', '2026-09-13 16:20:19.030'),
    ('d341231b-340a-5a71-bc7f-59fd3eb27f2d', '18d2410f-2369-554e-ae72-b32cd1c33f2d', '550e8400-e29b-41d4-a716-446655440101', '11111111-1111-1111-1111-000000000109', 2, 2887, 2887, '2026-09-13 16:23:07.000', 'OWN', '{"zone":"center","playerNumber":9}'::jsonb, 'live-capture', TRUE, '28b2e951-1e40-5676-aa49-51b8ec18a418', '2026-09-13 16:23:07.030', '2026-09-13 16:23:07.030'),
    ('3d6e6554-d478-526f-9d43-9f70ea18a6da', '18d2410f-2369-554e-ae72-b32cd1c33f2d', '550e8400-e29b-41d4-a716-446655440102', '11111111-1111-1111-1111-000000000112', 2, 2926, 2926, '2026-09-13 16:23:46.000', 'OWN', '{"wasSuccessful":true,"playerNumber":12,"distanceMeters":43,"zone":"right"}'::jsonb, 'live-capture', TRUE, '43b23d2b-6d7b-5aa9-925f-2245b4d9b1f2', '2026-09-13 16:23:46.030', '2026-09-13 16:23:46.030'),
    ('32309d44-76a6-5f5e-81ca-581fa722113a', '18d2410f-2369-554e-ae72-b32cd1c33f2d', '550e8400-e29b-41d4-a716-446655440126', NULL, 2, 3000, 3000, '2026-09-13 16:25:00.000', 'OWN', '{"playerOutNumber":1,"playerInNumber":16,"playerOutId":"11111111-1111-1111-1111-000000000119","playerInId":"11111111-1111-1111-1111-000000000122"}'::jsonb, 'live-capture', TRUE, '9b4dc6ee-6ce5-5edf-8161-a6323db3979a', '2026-09-13 16:25:00.030', '2026-09-13 16:25:00.030'),
    ('e9656c54-31b5-5374-b497-87f67cbc3bc3', '18d2410f-2369-554e-ae72-b32cd1c33f2d', '550e8400-e29b-41d4-a716-446655440128', NULL, 2, 3026, 3026, '2026-09-13 16:25:26.000', 'OPPONENT', '{"kind":"won"}'::jsonb, 'live-capture', TRUE, 'be61856f-fc0a-5af0-836b-2205531792be', '2026-09-13 16:25:26.030', '2026-09-13 16:25:26.030'),
    ('ff1b7058-c76b-5d74-b2bd-896a02d60525', '18d2410f-2369-554e-ae72-b32cd1c33f2d', '550e8400-e29b-41d4-a716-446655440112', NULL, 2, 3160, 3160, '2026-09-13 16:27:40.000', 'OPPONENT', '{"lineResult":"penalty_for","jumpZone":"middle","isMaulFormed":true}'::jsonb, 'live-capture', TRUE, 'd0df1acc-27f5-5b37-97b0-1a4f94a0179d', '2026-09-13 16:27:40.030', '2026-09-13 16:27:40.030'),
    ('ca7ee2eb-855f-5c24-966c-64e7daf757ab', '18d2410f-2369-554e-ae72-b32cd1c33f2d', '550e8400-e29b-41d4-a716-446655440111', NULL, 2, 3315, 3315, '2026-09-13 16:30:15.000', 'OPPONENT', '{"scrumResult":"lost_own"}'::jsonb, 'live-capture', TRUE, '46e453c1-1d1a-504c-a193-d2815466f2d9', '2026-09-13 16:30:15.030', '2026-09-13 16:30:15.030'),
    ('707c263e-1142-5d22-8890-0e62d90b4b96', '18d2410f-2369-554e-ae72-b32cd1c33f2d', '550e8400-e29b-41d4-a716-446655440110', NULL, 2, 3322, 3322, '2026-09-13 16:30:22.000', 'OPPONENT', '{"outcome":"retained","kickType":"tactical"}'::jsonb, 'live-capture', TRUE, 'd91113a4-a183-5b41-bc31-dbaa00a511cc', '2026-09-13 16:30:22.030', '2026-09-13 16:30:22.030'),
    ('d3facb97-3685-5fa1-8a07-7d7cf6604db6', '18d2410f-2369-554e-ae72-b32cd1c33f2d', '550e8400-e29b-41d4-a716-446655440106', NULL, 2, 3398, 3398, '2026-09-13 16:31:38.000', 'OPPONENT', '{"metersGained":13,"defendersBeaten":0}'::jsonb, 'live-capture', TRUE, 'a090769a-11d5-57aa-80f7-3b3c77ba6fd8', '2026-09-13 16:31:38.030', '2026-09-13 16:31:38.030'),
    ('8e70532b-585e-597c-9f29-57fbd6712741', '18d2410f-2369-554e-ae72-b32cd1c33f2d', '550e8400-e29b-41d4-a716-446655440120', NULL, 2, 3503, 3503, '2026-09-13 16:33:23.000', 'OPPONENT', '{"receptionQuality":"clean_mark"}'::jsonb, 'live-capture', TRUE, '10267e07-dec9-5b00-8861-2c15855dffe9', '2026-09-13 16:33:23.030', '2026-09-13 16:33:23.030'),
    ('26c4d2f5-dcac-5d6d-a6a9-6907833520b9', '18d2410f-2369-554e-ae72-b32cd1c33f2d', '550e8400-e29b-41d4-a716-446655440109', '11111111-1111-1111-1111-000000000114', 2, 3518, 3518, '2026-09-13 16:33:38.000', 'OWN', '{"playerNumber":14,"metersGained":9}'::jsonb, 'live-capture', TRUE, 'f150ffd8-7136-5d34-b74e-0062cc697eb0', '2026-09-13 16:33:38.030', '2026-09-13 16:33:38.030'),
    ('9e306e7b-e1d0-5e40-8fab-4c331b3f689e', '18d2410f-2369-554e-ae72-b32cd1c33f2d', '550e8400-e29b-41d4-a716-446655440111', NULL, 2, 3561, 3561, '2026-09-13 16:34:21.000', 'OWN', '{"scrumResult":"won_clean"}'::jsonb, 'live-capture', TRUE, '2932c093-c14b-51b4-8c36-367db0cce1ab', '2026-09-13 16:34:21.030', '2026-09-13 16:34:21.030'),
    ('13bbb770-01ed-529e-a975-43210c245d1d', '18d2410f-2369-554e-ae72-b32cd1c33f2d', '550e8400-e29b-41d4-a716-446655440106', NULL, 2, 3623, 3623, '2026-09-13 16:35:23.000', 'OWN', '{"metersGained":11,"defendersBeaten":0}'::jsonb, 'live-capture', TRUE, 'fc8efc10-c51a-5d99-9271-1716c75aa3c2', '2026-09-13 16:35:23.030', '2026-09-13 16:35:23.030'),
    ('c8cb84f7-2439-5d17-a1aa-ce0ea06489c7', '18d2410f-2369-554e-ae72-b32cd1c33f2d', '550e8400-e29b-41d4-a716-446655440116', '11111111-1111-1111-1111-000000000116', 2, 3628, 3628, '2026-09-13 16:35:28.000', 'OWN', '{"playerNumber":16,"failReason":"footwork"}'::jsonb, 'live-capture', TRUE, 'da565240-891b-535c-a04d-dc7ceee7d710', '2026-09-13 16:35:28.030', '2026-09-13 16:35:28.030'),
    ('80cd60b1-b4e5-5f51-94ff-a5c83090173f', '18d2410f-2369-554e-ae72-b32cd1c33f2d', '550e8400-e29b-41d4-a716-446655440101', NULL, 2, 3729, 3729, '2026-09-13 16:37:09.000', 'OPPONENT', '{"zone":"center"}'::jsonb, 'live-capture', TRUE, '7b310548-09d0-526b-a97b-4bb2668d6a4d', '2026-09-13 16:37:09.030', '2026-09-13 16:37:09.030'),
    ('a1633e05-5ba1-5c1c-b260-a45c589b535b', '18d2410f-2369-554e-ae72-b32cd1c33f2d', '550e8400-e29b-41d4-a716-446655440102', NULL, 2, 3774, 3774, '2026-09-13 16:37:54.000', 'OPPONENT', '{"wasSuccessful":true,"distanceMeters":39,"zone":"left"}'::jsonb, 'live-capture', TRUE, 'f0789568-3697-5b74-849b-3d23e7a6f732', '2026-09-13 16:37:54.030', '2026-09-13 16:37:54.030'),
    ('1d6c820e-81fa-5053-8312-16aaae5d1135', '18d2410f-2369-554e-ae72-b32cd1c33f2d', '550e8400-e29b-41d4-a716-446655440107', NULL, 2, 3849, 3849, '2026-09-13 16:39:09.000', 'OPPONENT', '{"passType":"offload","isBadPass":false}'::jsonb, 'live-capture', TRUE, 'cfe489e5-7690-5d18-b36c-764cf627d22f', '2026-09-13 16:39:09.030', '2026-09-13 16:39:09.030'),
    ('82eb6f12-c89f-551b-bdb0-cdfb868bf53f', '18d2410f-2369-554e-ae72-b32cd1c33f2d', '550e8400-e29b-41d4-a716-446655440126', NULL, 2, 3900, 3900, '2026-09-13 16:40:00.000', 'OWN', '{"playerOutNumber":2,"playerInNumber":17,"playerOutId":"11111111-1111-1111-1111-000000000107","playerInId":"11111111-1111-1111-1111-000000000104"}'::jsonb, 'live-capture', TRUE, '180e8c78-5313-5c65-b3ac-b921100754c7', '2026-09-13 16:40:00.030', '2026-09-13 16:40:00.030'),
    ('7ad8dc17-aa6d-5d84-8f95-54e70d19cedb', '18d2410f-2369-554e-ae72-b32cd1c33f2d', '550e8400-e29b-41d4-a716-446655440108', '11111111-1111-1111-1111-000000000113', 2, 4005, 4005, '2026-09-13 16:41:45.000', 'OWN', '{"playerNumber":13,"speed":"fast"}'::jsonb, 'live-capture', TRUE, '9c577f24-7c1f-52d0-b512-84dc0a90b680', '2026-09-13 16:41:45.030', '2026-09-13 16:41:45.030'),
    ('4004e422-f532-5ce9-93d5-286cdee575fd', '18d2410f-2369-554e-ae72-b32cd1c33f2d', '550e8400-e29b-41d4-a716-446655440109', NULL, 2, 4289, 4289, '2026-09-13 16:46:29.000', 'OPPONENT', '{"metersGained":12}'::jsonb, 'live-capture', TRUE, 'c0f5f8de-9a1b-5f9b-8c3d-a75845747445', '2026-09-13 16:46:29.030', '2026-09-13 16:46:29.030'),
    ('f313453c-1c1e-5a9b-b69e-2ae76ee30776', '18d2410f-2369-554e-ae72-b32cd1c33f2d', '550e8400-e29b-41d4-a716-446655440129', NULL, 2, 4436, 4436, '2026-09-13 16:48:56.000', 'OPPONENT', '{"quickPlayOutcome":true}'::jsonb, 'live-capture', TRUE, 'd2b48c0b-45c4-5dcc-9d5b-555af0826555', '2026-09-13 16:48:56.030', '2026-09-13 16:48:56.030'),
    ('627a30d2-8f39-5609-bab3-fb9111ac5e0b', '18d2410f-2369-554e-ae72-b32cd1c33f2d', '550e8400-e29b-41d4-a716-446655440101', '11111111-1111-1111-1111-000000000109', 2, 4441, 4441, '2026-09-13 16:49:01.000', 'OWN', '{"zone":"right","playerNumber":9}'::jsonb, 'live-capture', TRUE, 'b05f5d68-7c33-5e44-83bc-f897cb407521', '2026-09-13 16:49:01.030', '2026-09-13 16:49:01.030'),
    ('2de3f078-9000-5df0-ba76-7385def569ae', '18d2410f-2369-554e-ae72-b32cd1c33f2d', '550e8400-e29b-41d4-a716-446655440102', '11111111-1111-1111-1111-000000000115', 2, 4484, 4484, '2026-09-13 16:49:44.000', 'OWN', '{"wasSuccessful":true,"playerNumber":15,"distanceMeters":33,"zone":"left"}'::jsonb, 'live-capture', TRUE, '6ae37ea5-8208-51a5-a0e4-72ce1a2f9463', '2026-09-13 16:49:44.030', '2026-09-13 16:49:44.030'),
    ('2845c57b-0c6b-5a38-a6f9-09272d86944c', '18d2410f-2369-554e-ae72-b32cd1c33f2d', '550e8400-e29b-41d4-a716-446655440117', '11111111-1111-1111-1111-000000000117', 2, 4604, 4604, '2026-09-13 16:51:44.000', 'OWN', '{"playerNumber":17,"stealType":"knock_on"}'::jsonb, 'live-capture', TRUE, '51ec02aa-3c1e-52cf-a169-37d61f829fe3', '2026-09-13 16:51:44.030', '2026-09-13 16:51:44.030'),
    ('c34ec99c-c9cc-58c7-932f-27c00690b157', '18d2410f-2369-554e-ae72-b32cd1c33f2d', '550e8400-e29b-41d4-a716-446655440122', NULL, 2, 4653, 4653, '2026-09-13 16:52:33.000', 'OPPONENT', '{"penaltyType":"not_ten_meters"}'::jsonb, 'live-capture', TRUE, '11b1ab44-58e2-5c01-81a1-7f978485bedd', '2026-09-13 16:52:33.030', '2026-09-13 16:52:33.030'),
    ('01a359a4-c6fb-5e16-a82a-f4fe63c97b47', '8fa9735d-63cb-5489-8038-f33a1813d46a', '550e8400-e29b-41d4-a716-446655440115', '11111111-1111-1111-1111-000000000117', 1, 49, 49, '2026-09-20 15:35:49.000', 'OWN', '{"playerNumber":17,"assisted":true}'::jsonb, 'live-capture', TRUE, '7c19e606-054e-5155-b42f-99134df94347', '2026-09-20 15:35:49.030', '2026-09-20 15:35:49.030'),
    ('b9a08dea-2780-5540-a403-ca7570c051ae', '8fa9735d-63cb-5489-8038-f33a1813d46a', '550e8400-e29b-41d4-a716-446655440115', NULL, 1, 263, 263, '2026-09-20 15:39:23.000', 'OPPONENT', '{"assisted":true}'::jsonb, 'live-capture', TRUE, 'f1925c40-b05d-5d27-9842-9e99fe84ce04', '2026-09-20 15:39:23.030', '2026-09-20 15:39:23.030'),
    ('044569c3-3dce-5911-879e-553d6effb582', '8fa9735d-63cb-5489-8038-f33a1813d46a', '550e8400-e29b-41d4-a716-446655440101', '11111111-1111-1111-1111-000000000101', 1, 319, 319, '2026-09-20 15:40:19.000', 'OWN', '{"zone":"center","playerNumber":1}'::jsonb, 'live-capture', TRUE, '1c0eac6e-caed-591b-b6ea-e8bd9c0a8334', '2026-09-20 15:40:19.030', '2026-09-20 15:40:19.030'),
    ('d791a078-10d6-52f7-b741-e89aaadfa042', '8fa9735d-63cb-5489-8038-f33a1813d46a', '550e8400-e29b-41d4-a716-446655440102', '11111111-1111-1111-1111-000000000127', 1, 360, 360, '2026-09-20 15:41:00.000', 'OWN', '{"wasSuccessful":false,"playerNumber":27,"distanceMeters":23,"zone":"center"}'::jsonb, 'live-capture', TRUE, '0193b145-b1d3-544a-9b17-e5f26958f293', '2026-09-20 15:41:00.030', '2026-09-20 15:41:00.030'),
    ('33b695f9-bc05-5ff0-94bd-ee341076360b', '8fa9735d-63cb-5489-8038-f33a1813d46a', '550e8400-e29b-41d4-a716-446655440107', '11111111-1111-1111-1111-000000000106', 1, 469, 469, '2026-09-20 15:42:49.000', 'OWN', '{"passType":"standard","playerNumber":6,"isBadPass":true}'::jsonb, 'live-capture', TRUE, '57404491-07bd-50fe-abd4-3fb7639d162d', '2026-09-20 15:42:49.030', '2026-09-20 15:42:49.030'),
    ('ff078ff0-2c2f-50b2-9b74-284251668832', '8fa9735d-63cb-5489-8038-f33a1813d46a', '550e8400-e29b-41d4-a716-446655440112', '11111111-1111-1111-1111-000000000102', 1, 541, 541, '2026-09-20 15:44:01.000', 'OWN', '{"lineResult":"penalty_against","playerNumber":2,"jumpZone":"middle","isMaulFormed":false}'::jsonb, 'live-capture', TRUE, '0295737f-22f1-5fa3-b0bc-759ff4d7ff1f', '2026-09-20 15:44:01.030', '2026-09-20 15:44:01.030'),
    ('427c5327-3311-53e9-850b-0a3ec5ad2499', '8fa9735d-63cb-5489-8038-f33a1813d46a', '550e8400-e29b-41d4-a716-446655440106', '11111111-1111-1111-1111-000000000123', 1, 671, 671, '2026-09-20 15:46:11.000', 'OWN', '{"playerNumber":23,"metersGained":7,"defendersBeaten":0}'::jsonb, 'live-capture', TRUE, 'b1131991-dbcf-566e-8f85-964f3bcdc677', '2026-09-20 15:46:11.030', '2026-09-20 15:46:11.030'),
    ('eee0f192-6bc9-5dac-b671-f4f79bf291b0', '8fa9735d-63cb-5489-8038-f33a1813d46a', '550e8400-e29b-41d4-a716-446655440104', NULL, 1, 1069, 1069, '2026-09-20 15:52:49.000', 'OPPONENT', '{"wasSuccessful":false,"distanceMeters":24,"zone":"left"}'::jsonb, 'live-capture', TRUE, 'a91518fe-bc87-52bd-bd60-e0480997fd1e', '2026-09-20 15:52:49.030', '2026-09-20 15:52:49.030'),
    ('ef27363b-b643-526b-9768-aa4428fb4f54', '8fa9735d-63cb-5489-8038-f33a1813d46a', '550e8400-e29b-41d4-a716-446655440101', '11111111-1111-1111-1111-000000000123', 1, 1087, 1087, '2026-09-20 15:53:07.000', 'OWN', '{"zone":"right","playerNumber":23}'::jsonb, 'live-capture', TRUE, 'ae6e34c3-3edb-54c3-afd7-42dcc34043e7', '2026-09-20 15:53:07.030', '2026-09-20 15:53:07.030'),
    ('e51732aa-896d-5524-8c12-121187d47fd3', '8fa9735d-63cb-5489-8038-f33a1813d46a', '550e8400-e29b-41d4-a716-446655440102', '11111111-1111-1111-1111-000000000124', 1, 1134, 1134, '2026-09-20 15:53:54.000', 'OWN', '{"wasSuccessful":true,"playerNumber":24,"distanceMeters":37,"zone":"center"}'::jsonb, 'live-capture', TRUE, 'fb333918-2d02-58d6-9858-9c131bd5bd1f', '2026-09-20 15:53:54.030', '2026-09-20 15:53:54.030'),
    ('5d3a7f67-6cb2-5be9-a3c0-6f35dd8b4d13', '8fa9735d-63cb-5489-8038-f33a1813d46a', '550e8400-e29b-41d4-a716-446655440115', NULL, 1, 1190, 1190, '2026-09-20 15:54:50.000', 'OPPONENT', '{"assisted":true}'::jsonb, 'live-capture', TRUE, '5d5a55d2-ee7d-583d-9dd9-1e68c89864a9', '2026-09-20 15:54:50.030', '2026-09-20 15:54:50.030'),
    ('8c017e77-19af-5650-9fa0-36f7b8cc32fd', '8fa9735d-63cb-5489-8038-f33a1813d46a', '550e8400-e29b-41d4-a716-446655440106', NULL, 1, 1299, 1299, '2026-09-20 15:56:39.000', 'OPPONENT', '{"metersGained":2,"defendersBeaten":0}'::jsonb, 'live-capture', TRUE, 'c4baaf34-14cd-5aff-974d-b97197a8572b', '2026-09-20 15:56:39.030', '2026-09-20 15:56:39.030'),
    ('5d8ad634-ab14-5909-a39d-2e8d37b11408', '8fa9735d-63cb-5489-8038-f33a1813d46a', '550e8400-e29b-41d4-a716-446655440108', NULL, 1, 1352, 1352, '2026-09-20 15:57:32.000', 'OPPONENT', '{"speed":"medium"}'::jsonb, 'live-capture', TRUE, 'a4b27d2c-de18-55e8-ba74-2a608fd7ca40', '2026-09-20 15:57:32.030', '2026-09-20 15:57:32.030'),
    ('b7189626-1ec2-5b70-8fcf-9e7d05d029de', '8fa9735d-63cb-5489-8038-f33a1813d46a', '550e8400-e29b-41d4-a716-446655440117', '11111111-1111-1111-1111-000000000121', 1, 1438, 1438, '2026-09-20 15:58:58.000', 'OWN', '{"playerNumber":21,"stealType":"knock_on"}'::jsonb, 'live-capture', TRUE, 'd6ce6722-9262-54d2-a93d-27c9383e8383', '2026-09-20 15:58:58.030', '2026-09-20 15:58:58.030'),
    ('a9351ac5-79b9-52b2-8864-7339b3412a3e', '8fa9735d-63cb-5489-8038-f33a1813d46a', '550e8400-e29b-41d4-a716-446655440110', NULL, 1, 1546, 1546, '2026-09-20 16:00:46.000', 'OPPONENT', '{"outcome":"opp_possession","kickType":"tactical"}'::jsonb, 'live-capture', TRUE, '76e8fe6f-1820-5e72-a7a3-54cdfd56bcda', '2026-09-20 16:00:46.030', '2026-09-20 16:00:46.030'),
    ('afd8d717-1e51-5ca0-b0ad-bd2c240741fa', '8fa9735d-63cb-5489-8038-f33a1813d46a', '550e8400-e29b-41d4-a716-446655440107', '11111111-1111-1111-1111-000000000107', 1, 1659, 1659, '2026-09-20 16:02:39.000', 'OWN', '{"passType":"standard","playerNumber":7,"isBadPass":false}'::jsonb, 'live-capture', TRUE, 'cc3160b5-c354-5f27-b75e-2db2ca271739', '2026-09-20 16:02:39.030', '2026-09-20 16:02:39.030'),
    ('59643522-9729-5e69-a69a-0ee4b13a9247', '8fa9735d-63cb-5489-8038-f33a1813d46a', '550e8400-e29b-41d4-a716-446655440117', '11111111-1111-1111-1111-000000000122', 1, 1692, 1692, '2026-09-20 16:03:12.000', 'OWN', '{"playerNumber":22,"stealType":"interception"}'::jsonb, 'live-capture', TRUE, 'ab2f6608-c56f-5b3b-8116-9ec4f2d1469f', '2026-09-20 16:03:12.030', '2026-09-20 16:03:12.030'),
    ('50d730d8-f57c-557c-be9d-cac929a48098', '8fa9735d-63cb-5489-8038-f33a1813d46a', '550e8400-e29b-41d4-a716-446655440112', '11111111-1111-1111-1111-000000000107', 1, 1794, 1794, '2026-09-20 16:04:54.000', 'OWN', '{"lineResult":"penalty_for","playerNumber":7,"jumpZone":"front","isMaulFormed":false}'::jsonb, 'live-capture', TRUE, '78d5e9b8-24b3-57b9-91be-0e63e2e48a1c', '2026-09-20 16:04:54.030', '2026-09-20 16:04:54.030'),
    ('8eab8ca3-a512-5e46-8fa0-4e125398dbb4', '8fa9735d-63cb-5489-8038-f33a1813d46a', '550e8400-e29b-41d4-a716-446655440107', NULL, 1, 1813, 1813, '2026-09-20 16:05:13.000', 'OPPONENT', '{"passType":"skip","isBadPass":true}'::jsonb, 'live-capture', TRUE, '4f2cb260-189e-582b-800b-7f112d696617', '2026-09-20 16:05:13.030', '2026-09-20 16:05:13.030'),
    ('199aa9ca-80c6-5678-8dc6-a9ab09b0e27c', '8fa9735d-63cb-5489-8038-f33a1813d46a', '550e8400-e29b-41d4-a716-446655440101', NULL, 1, 1986, 1986, '2026-09-20 16:08:06.000', 'OPPONENT', '{"zone":"center"}'::jsonb, 'live-capture', TRUE, '48eb00fb-05f4-5cc4-a1f3-abc71a83c7d4', '2026-09-20 16:08:06.030', '2026-09-20 16:08:06.030'),
    ('64d396c6-5f7b-5440-90ff-2f2e48d60b1e', '8fa9735d-63cb-5489-8038-f33a1813d46a', '550e8400-e29b-41d4-a716-446655440102', NULL, 1, 2031, 2031, '2026-09-20 16:08:51.000', 'OPPONENT', '{"wasSuccessful":false,"distanceMeters":40,"zone":"left"}'::jsonb, 'live-capture', TRUE, '462a0dbf-aa67-5a2f-9ea5-97d0502816a5', '2026-09-20 16:08:51.030', '2026-09-20 16:08:51.030'),
    ('06714101-e3a3-53f8-9d0c-a9a1cfafa6cc', '8fa9735d-63cb-5489-8038-f33a1813d46a', '550e8400-e29b-41d4-a716-446655440109', '11111111-1111-1111-1111-000000000122', 1, 2244, 2244, '2026-09-20 16:12:24.000', 'OWN', '{"playerNumber":22,"metersGained":8}'::jsonb, 'live-capture', TRUE, 'bd08fdd9-5c8c-547d-a085-1ba48efcd5ab', '2026-09-20 16:12:24.030', '2026-09-20 16:12:24.030'),
    ('43b9c885-6d0a-570a-9dbe-3f0122971e43', '8fa9735d-63cb-5489-8038-f33a1813d46a', '550e8400-e29b-41d4-a716-446655440106', '11111111-1111-1111-1111-000000000101', 1, 2326, 2326, '2026-09-20 16:13:46.000', 'OWN', '{"playerNumber":1,"metersGained":6,"defendersBeaten":0}'::jsonb, 'live-capture', TRUE, '53afa76d-9a38-57dd-bfef-561ab4a550d9', '2026-09-20 16:13:46.030', '2026-09-20 16:13:46.030'),
    ('81cce29c-a5a1-5ea6-af89-ab5ae06f4f89', '8fa9735d-63cb-5489-8038-f33a1813d46a', '550e8400-e29b-41d4-a716-446655440122', NULL, 2, 2435, 2435, '2026-09-20 16:15:35.000', 'OPPONENT', '{"penaltyType":"not_rolling_away"}'::jsonb, 'live-capture', TRUE, '59c99af2-5688-551f-ad2d-f05684afe4a2', '2026-09-20 16:15:35.030', '2026-09-20 16:15:35.030'),
    ('69ae65fd-03b5-5b06-af82-c44ff24dbc0b', '8fa9735d-63cb-5489-8038-f33a1813d46a', '550e8400-e29b-41d4-a716-446655440129', NULL, 2, 2593, 2593, '2026-09-20 16:18:13.000', 'OPPONENT', '{"quickPlayOutcome":false}'::jsonb, 'live-capture', TRUE, '1456ebcd-0cd8-5ad9-bd28-2b4234be1194', '2026-09-20 16:18:13.030', '2026-09-20 16:18:13.030'),
    ('23be717d-b42b-5c81-a700-9ac8cad9cddc', '8fa9735d-63cb-5489-8038-f33a1813d46a', '550e8400-e29b-41d4-a716-446655440120', '11111111-1111-1111-1111-000000000117', 2, 2607, 2607, '2026-09-20 16:18:27.000', 'OWN', '{"receptionQuality":"fumbled","playerNumber":17}'::jsonb, 'live-capture', TRUE, 'd8b3f5a2-dbbc-58aa-8ebd-931266fabc81', '2026-09-20 16:18:27.030', '2026-09-20 16:18:27.030'),
    ('86a271f7-2d2e-5f15-96b6-3048ee107dac', '8fa9735d-63cb-5489-8038-f33a1813d46a', '550e8400-e29b-41d4-a716-446655440101', NULL, 2, 2767, 2767, '2026-09-20 16:21:07.000', 'OPPONENT', '{"zone":"left"}'::jsonb, 'live-capture', TRUE, 'af1f8afd-03e3-5c40-84b7-7f14720286cb', '2026-09-20 16:21:07.030', '2026-09-20 16:21:07.030'),
    ('acdf4ced-a1cd-5336-b492-13f943d94a03', '8fa9735d-63cb-5489-8038-f33a1813d46a', '550e8400-e29b-41d4-a716-446655440102', NULL, 2, 2802, 2802, '2026-09-20 16:21:42.000', 'OPPONENT', '{"wasSuccessful":false,"distanceMeters":35,"zone":"center"}'::jsonb, 'live-capture', TRUE, '1019257f-10ef-517f-a5b5-69134604ccc7', '2026-09-20 16:21:42.030', '2026-09-20 16:21:42.030'),
    ('7370cb64-2a91-5701-bc6e-2f0043609834', '8fa9735d-63cb-5489-8038-f33a1813d46a', '550e8400-e29b-41d4-a716-446655440128', NULL, 2, 2925, 2925, '2026-09-20 16:23:45.000', 'OPPONENT', '{"kind":"penalty_touch"}'::jsonb, 'live-capture', TRUE, '420b1462-9b87-5305-a038-7fd98bff59f4', '2026-09-20 16:23:45.030', '2026-09-20 16:23:45.030'),
    ('8c234787-944d-5a9c-8315-9586f1e89fdf', '8fa9735d-63cb-5489-8038-f33a1813d46a', '550e8400-e29b-41d4-a716-446655440126', NULL, 2, 3000, 3000, '2026-09-20 16:25:00.000', 'OWN', '{"playerOutNumber":1,"playerInNumber":16,"playerOutId":"11111111-1111-1111-1111-000000000113","playerInId":"11111111-1111-1111-1111-000000000126"}'::jsonb, 'live-capture', TRUE, 'ac38a088-911a-5492-850c-88aab0bc6400', '2026-09-20 16:25:00.030', '2026-09-20 16:25:00.030'),
    ('05733921-9465-527d-a402-3ad2e8ee6827', '8fa9735d-63cb-5489-8038-f33a1813d46a', '550e8400-e29b-41d4-a716-446655440115', '11111111-1111-1111-1111-000000000123', 2, 3020, 3020, '2026-09-20 16:25:20.000', 'OWN', '{"playerNumber":23,"assisted":false}'::jsonb, 'live-capture', TRUE, '3d015222-b602-53a0-a14a-79dbeb952f53', '2026-09-20 16:25:20.030', '2026-09-20 16:25:20.030'),
    ('9e20f97d-8a21-5749-b504-8aad9c83a083', '8fa9735d-63cb-5489-8038-f33a1813d46a', '550e8400-e29b-41d4-a716-446655440111', '11111111-1111-1111-1111-000000000111', 2, 3037, 3037, '2026-09-20 16:25:37.000', 'OWN', '{"scrumResult":"penalty_for","playerNumber":11}'::jsonb, 'live-capture', TRUE, '4dd7c098-55b0-542f-958d-945962aa8ec5', '2026-09-20 16:25:37.030', '2026-09-20 16:25:37.030'),
    ('be39f214-eb4d-51b8-bd7a-42340efb0bab', '8fa9735d-63cb-5489-8038-f33a1813d46a', '550e8400-e29b-41d4-a716-446655440108', '11111111-1111-1111-1111-000000000122', 2, 3122, 3122, '2026-09-20 16:27:02.000', 'OWN', '{"playerNumber":22,"speed":"medium"}'::jsonb, 'live-capture', TRUE, 'e3969187-d89b-5b1d-bc99-58f34c96fd16', '2026-09-20 16:27:02.030', '2026-09-20 16:27:02.030'),
    ('ec2963e3-a0fe-58df-9a17-091e2bb54806', '8fa9735d-63cb-5489-8038-f33a1813d46a', '550e8400-e29b-41d4-a716-446655440114', '11111111-1111-1111-1111-000000000103', 2, 3319, 3319, '2026-09-20 16:30:19.000', 'OWN', '{"maulOutcome":"advanced","playerNumber":3,"metersGained":3}'::jsonb, 'live-capture', TRUE, 'eb3176b3-558a-58cb-b98e-f144657df142', '2026-09-20 16:30:19.030', '2026-09-20 16:30:19.030'),
    ('71b3b4d1-f20c-5ee0-9a13-1c362d0e1840', '8fa9735d-63cb-5489-8038-f33a1813d46a', '550e8400-e29b-41d4-a716-446655440101', '11111111-1111-1111-1111-000000000127', 2, 3662, 3662, '2026-09-20 16:36:02.000', 'OWN', '{"zone":"right","playerNumber":27}'::jsonb, 'live-capture', TRUE, '1e45aa0b-390c-558b-aeba-c23192ba0f9f', '2026-09-20 16:36:02.030', '2026-09-20 16:36:02.030'),
    ('c2cc1dde-56eb-5cd2-a807-44845a84b08e', '8fa9735d-63cb-5489-8038-f33a1813d46a', '550e8400-e29b-41d4-a716-446655440102', '11111111-1111-1111-1111-000000000122', 2, 3703, 3703, '2026-09-20 16:36:43.000', 'OWN', '{"wasSuccessful":true,"playerNumber":22,"distanceMeters":40,"zone":"center"}'::jsonb, 'live-capture', TRUE, 'ecbb6437-b23d-55a4-b781-dfbd8e1e6f37', '2026-09-20 16:36:43.030', '2026-09-20 16:36:43.030'),
    ('20c30ea1-c722-58cd-9787-16321391de5c', '8fa9735d-63cb-5489-8038-f33a1813d46a', '550e8400-e29b-41d4-a716-446655440111', '11111111-1111-1111-1111-000000000105', 2, 3851, 3851, '2026-09-20 16:39:11.000', 'OWN', '{"scrumResult":"penalty_against","playerNumber":5}'::jsonb, 'live-capture', TRUE, '5e3076b2-9337-5b73-aba5-c33ab148f8a4', '2026-09-20 16:39:11.030', '2026-09-20 16:39:11.030'),
    ('82a8e4dc-d9f5-5abb-875e-18b7e3c49cbd', '8fa9735d-63cb-5489-8038-f33a1813d46a', '550e8400-e29b-41d4-a716-446655440108', NULL, 2, 3866, 3866, '2026-09-20 16:39:26.000', 'OPPONENT', '{"speed":"fast"}'::jsonb, 'live-capture', TRUE, '3f02fabc-a130-5d78-be4f-0cb83b18e3a4', '2026-09-20 16:39:26.030', '2026-09-20 16:39:26.030'),
    ('acc25fe7-f7c4-564f-ae6b-49de4e5b927d', '8fa9735d-63cb-5489-8038-f33a1813d46a', '550e8400-e29b-41d4-a716-446655440116', NULL, 2, 3868, 3868, '2026-09-20 16:39:28.000', 'OPPONENT', '{"failReason":"bounced_off"}'::jsonb, 'live-capture', TRUE, '91a7ae28-6549-5f25-aa22-b4d0e7dc2575', '2026-09-20 16:39:28.030', '2026-09-20 16:39:28.030'),
    ('0f7ff29e-90b4-5424-bee8-5cd75a4defde', '8fa9735d-63cb-5489-8038-f33a1813d46a', '550e8400-e29b-41d4-a716-446655440126', NULL, 2, 3900, 3900, '2026-09-20 16:40:00.000', 'OWN', '{"playerOutNumber":2,"playerInNumber":17,"playerOutId":"11111111-1111-1111-1111-000000000102","playerInId":"11111111-1111-1111-1111-000000000107"}'::jsonb, 'live-capture', TRUE, 'a38d9ee6-ea66-579a-ac91-999367882c0f', '2026-09-20 16:40:00.030', '2026-09-20 16:40:00.030'),
    ('9b572f3f-3c01-5168-b0cb-f7d0f0a2c9b6', '8fa9735d-63cb-5489-8038-f33a1813d46a', '550e8400-e29b-41d4-a716-446655440113', NULL, 2, 3932, 3932, '2026-09-20 16:40:32.000', 'OPPONENT', '{"outcome":"regained_attack","kickType":"22m_drop"}'::jsonb, 'live-capture', TRUE, 'df652d05-5f95-50f9-918b-7577ff2d1b1a', '2026-09-20 16:40:32.030', '2026-09-20 16:40:32.030'),
    ('932359cc-3259-583a-8d37-b296be1977ea', '8fa9735d-63cb-5489-8038-f33a1813d46a', '550e8400-e29b-41d4-a716-446655440112', NULL, 2, 4042, 4042, '2026-09-20 16:42:22.000', 'OPPONENT', '{"lineResult":"penalty_against","jumpZone":"middle","isMaulFormed":true}'::jsonb, 'live-capture', TRUE, '6402fc79-d689-5269-83fc-d6eb700d92b2', '2026-09-20 16:42:22.030', '2026-09-20 16:42:22.030'),
    ('0505bcb1-dcfb-505e-8878-8c4183a48444', '8fa9735d-63cb-5489-8038-f33a1813d46a', '550e8400-e29b-41d4-a716-446655440120', '11111111-1111-1111-1111-000000000106', 2, 4196, 4196, '2026-09-20 16:44:56.000', 'OWN', '{"receptionQuality":"clean_mark","playerNumber":6}'::jsonb, 'live-capture', TRUE, '24430a51-ccc9-5b1d-8db3-0b61539c881e', '2026-09-20 16:44:56.030', '2026-09-20 16:44:56.030'),
    ('094d7b51-29a7-54fe-b8ad-0bd2ee622650', '8fa9735d-63cb-5489-8038-f33a1813d46a', '550e8400-e29b-41d4-a716-446655440109', NULL, 2, 4469, 4469, '2026-09-20 16:49:29.000', 'OPPONENT', '{"metersGained":15}'::jsonb, 'live-capture', TRUE, 'a98b2d15-0f9d-5ac4-81e8-f92f03cae3a5', '2026-09-20 16:49:29.030', '2026-09-20 16:49:29.030'),
    ('2de75fc2-8bcc-5d2a-aba2-f49af1092e94', '8fa9735d-63cb-5489-8038-f33a1813d46a', '550e8400-e29b-41d4-a716-446655440110', NULL, 2, 4499, 4499, '2026-09-20 16:49:59.000', 'OPPONENT', '{"outcome":"out_in_full","kickType":"tactical"}'::jsonb, 'live-capture', TRUE, 'f773a831-a7c6-5f44-b3f5-0b297906ec52', '2026-09-20 16:49:59.030', '2026-09-20 16:49:59.030'),
    ('5bbf9c52-1123-5837-afed-02e168c9082a', '8fa9735d-63cb-5489-8038-f33a1813d46a', '550e8400-e29b-41d4-a716-446655440101', NULL, 2, 4578, 4578, '2026-09-20 16:51:18.000', 'OPPONENT', '{"zone":"center"}'::jsonb, 'live-capture', TRUE, 'a7d97d77-a850-5bc8-89e0-f3596456f52b', '2026-09-20 16:51:18.030', '2026-09-20 16:51:18.030'),
    ('45a5324e-456b-5220-b931-1f82d8451199', '8fa9735d-63cb-5489-8038-f33a1813d46a', '550e8400-e29b-41d4-a716-446655440102', NULL, 2, 4616, 4616, '2026-09-20 16:51:56.000', 'OPPONENT', '{"wasSuccessful":false,"distanceMeters":45,"zone":"center"}'::jsonb, 'live-capture', TRUE, '24ea1b7a-4801-5d8e-974d-b131f40cb7c0', '2026-09-20 16:51:56.030', '2026-09-20 16:51:56.030'),
    ('a0e80bf9-f5e8-5794-8961-dec69b54bb04', '8fa9735d-63cb-5489-8038-f33a1813d46a', '550e8400-e29b-41d4-a716-446655440106', '11111111-1111-1111-1111-000000000115', 2, 4701, 4701, '2026-09-20 16:53:21.000', 'OWN', '{"playerNumber":15,"metersGained":12,"defendersBeaten":0}'::jsonb, 'live-capture', TRUE, '41b5d677-7e9d-50d6-be7b-8ee8cdfe7e54', '2026-09-20 16:53:21.030', '2026-09-20 16:53:21.030'),
    ('14578ee4-0097-5f3b-ac07-8a40871aee26', '8fa9735d-63cb-5489-8038-f33a1813d46a', '550e8400-e29b-41d4-a716-446655440122', '11111111-1111-1111-1111-000000000108', 2, 4736, 4736, '2026-09-20 16:53:56.000', 'OWN', '{"playerNumber":8,"penaltyType":"dissent"}'::jsonb, 'live-capture', TRUE, 'a7749055-749a-5f7c-90bd-4f31682cc87d', '2026-09-20 16:53:56.030', '2026-09-20 16:53:56.030');

-- =========================================
-- ASIGNACIONES DE ZONAS POST-PARTIDO
-- Se divide cada tiempo en cuatro tramos de diez minutos, sin solapamientos.
-- La grilla respeta las 3 filas x 6 columnas definidas por ZoneGrid.
-- =========================================
INSERT INTO match_zone_assignments
(id, match_id, period, start_minute, end_minute, zone_row, zone_col)
VALUES

    ('097f1f34-6e51-5ca2-a697-55379224d977', '24a0cbdc-4667-4099-b16f-abc64f388345', 1, 0, 10, 2, 3),
    ('f7d79487-4331-5c1b-8fa2-8a315a921540', '24a0cbdc-4667-4099-b16f-abc64f388345', 1, 10, 20, 1, 4),
    ('bd68c031-b54c-5219-8c44-20804510a89b', '24a0cbdc-4667-4099-b16f-abc64f388345', 1, 20, 30, 3, 4),
    ('6c9cfeb1-ae15-5b54-9ecb-15416dbc8a45', '24a0cbdc-4667-4099-b16f-abc64f388345', 1, 30, 40, 2, 5),
    ('b23dd6e2-4191-5834-a91a-c85648d46e53', '24a0cbdc-4667-4099-b16f-abc64f388345', 2, 40, 50, 2, 4),
    ('bfb406b5-dd1f-5a27-bf1d-8331770110b5', '24a0cbdc-4667-4099-b16f-abc64f388345', 2, 50, 60, 3, 5),
    ('ffe9eafd-f2a2-5e5b-b3ae-71d2993ffe2d', '24a0cbdc-4667-4099-b16f-abc64f388345', 2, 60, 70, 1, 5),
    ('aa7a6a71-8051-5c65-91be-c3d3def9122b', '24a0cbdc-4667-4099-b16f-abc64f388345', 2, 70, 80, 2, 6),
    ('1f82eb7e-fa5f-5685-b83e-c509fa47f17f', '11111111-1111-1111-1111-000000000040', 1, 0, 10, 2, 2),
    ('d72b23ba-edad-5382-b810-88738e910d1b', '11111111-1111-1111-1111-000000000040', 1, 10, 20, 3, 3),
    ('b0138d3a-0a65-5d7e-b31f-6027cca22be2', '11111111-1111-1111-1111-000000000040', 1, 20, 30, 1, 4),
    ('d9c02402-be6d-5184-9d5b-431dfd5f3df4', '11111111-1111-1111-1111-000000000040', 1, 30, 40, 2, 5),
    ('9f23064e-76cc-529e-8e2e-940a2f266ca6', '11111111-1111-1111-1111-000000000040', 2, 40, 50, 3, 4),
    ('523beb50-29e9-5cf3-ad95-1c8e3712caa7', '11111111-1111-1111-1111-000000000040', 2, 50, 60, 1, 5),
    ('1b72aa7c-245c-5bbb-a09e-77a8392a737e', '11111111-1111-1111-1111-000000000040', 2, 60, 70, 2, 6),
    ('58601942-7cf4-55f6-b5da-a46b6296ae66', '11111111-1111-1111-1111-000000000040', 2, 70, 80, 2, 5),
    ('f4564d4f-7954-5cc5-963b-00223acdb264', 'dd4e580d-b80a-50a1-a2de-c61737461705', 1, 0, 10, 1, 3),
    ('859d77fb-7e9c-59b2-8d5f-2a7a2e7bd8d6', 'dd4e580d-b80a-50a1-a2de-c61737461705', 1, 10, 20, 2, 4),
    ('e2b01e7a-e37a-5d9b-937c-d3c684d4d9f6', 'dd4e580d-b80a-50a1-a2de-c61737461705', 1, 20, 30, 3, 5),
    ('db5b09a1-13fd-5fb3-8d3a-241da45b13b2', 'dd4e580d-b80a-50a1-a2de-c61737461705', 1, 30, 40, 2, 6),
    ('f07aa9ce-2304-5577-8c36-755a034b4c2c', 'dd4e580d-b80a-50a1-a2de-c61737461705', 2, 40, 50, 2, 4),
    ('656e6567-ac2a-50d0-ac9a-f46c4f166ac7', 'dd4e580d-b80a-50a1-a2de-c61737461705', 2, 50, 60, 1, 5),
    ('98ad738e-d302-503a-8dee-c3c33762aaf0', 'dd4e580d-b80a-50a1-a2de-c61737461705', 2, 60, 70, 3, 5),
    ('9ec15634-9815-5fd6-834a-3cd54f393bce', 'dd4e580d-b80a-50a1-a2de-c61737461705', 2, 70, 80, 2, 6),
    ('86f45caf-9035-56a9-b8ab-68689613a3b4', 'a1eba5c7-5829-502d-8b07-3da0234883c6', 1, 0, 10, 3, 2),
    ('77bd9ade-aba3-5562-a040-362fd481879b', 'a1eba5c7-5829-502d-8b07-3da0234883c6', 1, 10, 20, 2, 3),
    ('1c887c3f-4389-5edb-a31b-5cafaa75cec4', 'a1eba5c7-5829-502d-8b07-3da0234883c6', 1, 20, 30, 1, 4),
    ('5f7ca712-d60c-5a36-8b62-29ecf63677d5', 'a1eba5c7-5829-502d-8b07-3da0234883c6', 1, 30, 40, 3, 5),
    ('593aa258-1bed-5568-a7a9-736df589e638', 'a1eba5c7-5829-502d-8b07-3da0234883c6', 2, 40, 50, 2, 4),
    ('98f24913-1571-52e9-b8f4-7673c8f00a31', 'a1eba5c7-5829-502d-8b07-3da0234883c6', 2, 50, 60, 1, 5),
    ('3e0b3626-82bb-5c8f-bf35-54ff4cb05f4f', 'a1eba5c7-5829-502d-8b07-3da0234883c6', 2, 60, 70, 3, 6),
    ('c0fcf97b-61c1-570b-bf67-6c6ba81cc81f', 'a1eba5c7-5829-502d-8b07-3da0234883c6', 2, 70, 80, 2, 5),
    ('561f6be6-8eca-5a48-8470-e43a6248a3ae', 'f16dc0a8-76d3-5ff4-b472-fc80bcaaf4ca', 1, 0, 10, 2, 3),
    ('7e9336f9-a8f0-57e9-ad4f-665ea193ca8b', 'f16dc0a8-76d3-5ff4-b472-fc80bcaaf4ca', 1, 10, 20, 3, 4),
    ('ff00c734-9e76-5621-bf97-7de4d1248337', 'f16dc0a8-76d3-5ff4-b472-fc80bcaaf4ca', 1, 20, 30, 1, 5),
    ('c629f04f-ddb7-51ef-868d-c6b67ce49a5e', 'f16dc0a8-76d3-5ff4-b472-fc80bcaaf4ca', 1, 30, 40, 2, 6),
    ('ee3c977d-2073-5648-8b92-ff3f11121f97', 'f16dc0a8-76d3-5ff4-b472-fc80bcaaf4ca', 2, 40, 50, 1, 4),
    ('6f37176f-2446-517d-a457-5fe5cf7793fc', 'f16dc0a8-76d3-5ff4-b472-fc80bcaaf4ca', 2, 50, 60, 3, 5),
    ('be8586e6-867e-50a6-8a93-2ce4a8e354c2', 'f16dc0a8-76d3-5ff4-b472-fc80bcaaf4ca', 2, 60, 70, 2, 6),
    ('6e092038-487a-5584-a0b4-f253d501e77d', 'f16dc0a8-76d3-5ff4-b472-fc80bcaaf4ca', 2, 70, 80, 2, 5),
    ('0ac2bd41-8a0e-5f1d-ad99-9397d790fbc7', '18d2410f-2369-554e-ae72-b32cd1c33f2d', 1, 0, 10, 1, 2),
    ('f971546e-c419-5ce2-bbd1-19ddb644c64b', '18d2410f-2369-554e-ae72-b32cd1c33f2d', 1, 10, 20, 2, 3),
    ('0ab580ac-be64-5c40-b798-5be19334e0a4', '18d2410f-2369-554e-ae72-b32cd1c33f2d', 1, 20, 30, 3, 4),
    ('9d557156-e618-542e-8a6e-02cde59a157e', '18d2410f-2369-554e-ae72-b32cd1c33f2d', 1, 30, 40, 2, 5),
    ('228cb4a5-523b-5821-a41a-ec4845356461', '18d2410f-2369-554e-ae72-b32cd1c33f2d', 2, 40, 50, 3, 4),
    ('84dbe47c-256b-50b3-bccd-ebab06b0fe29', '18d2410f-2369-554e-ae72-b32cd1c33f2d', 2, 50, 60, 2, 5),
    ('d9fd8b72-54de-5e6b-9f7d-bc3cd517a1b4', '18d2410f-2369-554e-ae72-b32cd1c33f2d', 2, 60, 70, 1, 6),
    ('af667e42-24be-5d3b-89ca-92eaba1f8013', '18d2410f-2369-554e-ae72-b32cd1c33f2d', 2, 70, 80, 2, 6),
    ('4b1f633b-c966-5184-b99e-8c9aeaa285b9', '8fa9735d-63cb-5489-8038-f33a1813d46a', 1, 0, 10, 2, 2),
    ('e1621f18-ee7b-5e16-8ae2-b1feb3fd8898', '8fa9735d-63cb-5489-8038-f33a1813d46a', 1, 10, 20, 1, 3),
    ('cc2c94b7-3eaa-5d96-bb15-e1c9f11b721e', '8fa9735d-63cb-5489-8038-f33a1813d46a', 1, 20, 30, 3, 4),
    ('228043a7-ca0f-5a27-a57c-e908a858b990', '8fa9735d-63cb-5489-8038-f33a1813d46a', 1, 30, 40, 2, 5),
    ('d3ef7890-aef2-5719-b33e-62281ca337c6', '8fa9735d-63cb-5489-8038-f33a1813d46a', 2, 40, 50, 1, 4),
    ('47098384-8136-5e62-ad19-b3d36a371bcd', '8fa9735d-63cb-5489-8038-f33a1813d46a', 2, 50, 60, 2, 5),
    ('f19ba00a-e958-5cf3-bbc5-626da9d28504', '8fa9735d-63cb-5489-8038-f33a1813d46a', 2, 60, 70, 3, 6),
    ('5137985b-5969-52b2-8175-f9963d0cf684', '8fa9735d-63cb-5489-8038-f33a1813d46a', 2, 70, 80, 2, 6);

-- =========================================
-- FIN DEL STAGING
-- Resumen:
--   7 partidos finalizados (2 originales + 5 nuevos)
--   421 eventos en total (167 originales + 254 nuevos)
--   7 partidos con asignaciones de zonas post-partido
-- =========================================


-- #########################################################################
-- DATASET DEMO (ex data.sql) — jugadores ficticios, división M19 y partidos 040–048
-- Los IDs que en data.sql chocaban con el plantel real del PMRC se remapearon a prefijo 33333333-…
-- (personas 101–137, usuarios de jugadores, division_players 200–236, partidos 040–048 y el coach de M19).
-- Se reutilizan del bloque PMRC: club ...010, Primera ...020, staff ...001–003 y los rivales 22222222-….
-- Catálogo: se usa el de PMRC (v3.1). Eventos legacy de data.sql migrados:
--   HANDLING_ERROR (...119) -> TURNOVER_WON (...117) con el equipo invertido, sin jugador y errorType -> stealType;
--   ENTRY_22 (...127) eliminados (el tipo ya no existe).
-- #########################################################################

INSERT INTO persons (id, first_name, last_name, birth_date, contact_email, contact_phone, created_at) VALUES
    -- 1: Administrador del Club
    -- 2: Entrenador Gonzalo
    -- 3: Segundo Entrenador / Analista
    -- 4 a 15: 12 Jugadores que SI tienen cuenta de usuario
    ('33333333-1111-1111-1111-000000000101', 'Agustin', 'Creevy', '1995-03-15', 'player1@ovaltrack.com', '123456789', CURRENT_TIMESTAMP),
    ('33333333-1111-1111-1111-000000000102', 'Julian', 'Montoya', '1996-04-20', 'player2@ovaltrack.com', '123456789', CURRENT_TIMESTAMP),
    ('33333333-1111-1111-1111-000000000103', 'Tomas', 'Lavanini', '1997-01-11', 'player3@ovaltrack.com', '123456789', CURRENT_TIMESTAMP),
    ('33333333-1111-1111-1111-000000000104', 'Guido', 'Petti', '1998-07-08', 'player4@ovaltrack.com', '123456789', CURRENT_TIMESTAMP),
    ('33333333-1111-1111-1111-000000000105', 'Pablo', 'Matera', '1999-02-14', 'player5@ovaltrack.com', '123456789', CURRENT_TIMESTAMP),
    ('33333333-1111-1111-1111-000000000106', 'Marcos', 'Kremer', '2000-06-25', 'player6@ovaltrack.com', '123456789', CURRENT_TIMESTAMP),
    ('33333333-1111-1111-1111-000000000107', 'Facundo', 'Isa', '1996-09-21', 'player7@ovaltrack.com', '123456789', CURRENT_TIMESTAMP),
    ('33333333-1111-1111-1111-000000000108', 'Gonzalo', 'Bertranou', '1997-12-31', 'player8@ovaltrack.com', '123456789', CURRENT_TIMESTAMP),
    ('33333333-1111-1111-1111-000000000109', 'Nicolas', 'Sanchez', '1995-10-26', 'player9@ovaltrack.com', '123456789', CURRENT_TIMESTAMP),
    ('33333333-1111-1111-1111-000000000110', 'Santiago', 'Carreras', '1998-05-01', 'player10@ovaltrack.com', '123456789', CURRENT_TIMESTAMP),
    ('33333333-1111-1111-1111-000000000111', 'Emiliano', 'Boffelli', '1999-01-16', 'player11@ovaltrack.com', '123456789', CURRENT_TIMESTAMP),
    ('33333333-1111-1111-1111-000000000112', 'Mateo', 'Carreras', '2000-12-17', 'player12@ovaltrack.com', '123456789', CURRENT_TIMESTAMP),
    -- 16 a 30: 15 Personas/Jugadores que NO tienen cuenta de usuario
    ('33333333-1111-1111-1111-000000000113', 'Juan', 'Perez', '2001-03-01', 'juan.perez@madryn.com', '123456789', CURRENT_TIMESTAMP),
    ('33333333-1111-1111-1111-000000000114', 'Lucas', 'Gomez', '2001-04-12', 'lucas.gomez@madryn.com', '123456789', CURRENT_TIMESTAMP),
    ('33333333-1111-1111-1111-000000000115', 'Martin', 'Rodriguez', '2002-05-18', 'martin.rodriguez@madryn.com', '123456789', CURRENT_TIMESTAMP),
    ('33333333-1111-1111-1111-000000000116', 'Joaquin', 'Lopez', '2002-08-22', 'joaquin.lopez@madryn.com', '123456789', CURRENT_TIMESTAMP),
    ('33333333-1111-1111-1111-000000000117', 'Franco', 'Diaz', '2003-01-30', 'franco.diaz@madryn.com', '123456789', CURRENT_TIMESTAMP),
    ('33333333-1111-1111-1111-000000000118', 'Bautista', 'Alvarez', '2003-06-14', 'bautista.alvarez@madryn.com', '123456789', CURRENT_TIMESTAMP),
    ('33333333-1111-1111-1111-000000000119', 'Tomas', 'Romero', '2003-09-09', 'tomas.romero@madryn.com', '123456789', CURRENT_TIMESTAMP),
    ('33333333-1111-1111-1111-000000000120', 'Ignacio', 'Sosa', '2004-02-11', 'ignacio.sosa@madryn.com', '123456789', CURRENT_TIMESTAMP),
    ('33333333-1111-1111-1111-000000000121', 'Santiago', 'Torres', '2004-07-19', 'santiago.torres@madryn.com', '123456789', CURRENT_TIMESTAMP),
    ('33333333-1111-1111-1111-000000000122', 'Manuel', 'Ruiz', '2004-11-05', 'manuel.ruiz@madryn.com', '123456789', CURRENT_TIMESTAMP),
    ('33333333-1111-1111-1111-000000000123', 'Felipe', 'Benitez', '2005-01-25', 'felipe.benitez@madryn.com', '123456789', CURRENT_TIMESTAMP),
    ('33333333-1111-1111-1111-000000000124', 'Ramiro', 'Castro', '2005-04-16', 'ramiro.castro@madryn.com', '123456789', CURRENT_TIMESTAMP),
    ('33333333-1111-1111-1111-000000000125', 'Esteban', 'Morales', '2005-08-03', 'esteban.morales@madryn.com', '123456789', CURRENT_TIMESTAMP),
    ('33333333-1111-1111-1111-000000000126', 'Lautaro', 'Gutierrez', '2005-10-10', 'lautaro.gutierrez@madryn.com', '123456789', CURRENT_TIMESTAMP),
    ('33333333-1111-1111-1111-000000000127', 'Valentin', 'Ortiz', '2005-12-28', 'valentin.ortiz@madryn.com', '123456789', CURRENT_TIMESTAMP),
    ('33333333-1111-1111-1111-000000000128', 'Rodrigo', 'Isgro', '1999-03-24', 'player13@ovaltrack.com', '123456789', CURRENT_TIMESTAMP),
    ('33333333-1111-1111-1111-000000000129', 'Lucio', 'Cinti', '2000-02-23', 'player14@ovaltrack.com', '123456789', CURRENT_TIMESTAMP),
    ('33333333-1111-1111-1111-000000000130', 'Matias', 'Moroni', '1991-03-29', 'player15@ovaltrack.com', '123456789', CURRENT_TIMESTAMP),
    ('33333333-1111-1111-1111-000000000131', 'Bautista', 'Delguy', '1997-04-22', 'player16@ovaltrack.com', '123456789', CURRENT_TIMESTAMP),
    ('33333333-1111-1111-1111-000000000132', 'Juan Cruz', 'Mallia', '1996-09-11', 'player17@ovaltrack.com', '123456789', CURRENT_TIMESTAMP),
    ('33333333-1111-1111-1111-000000000133', 'Thomas', 'Gallo', '1999-04-30', 'player18@ovaltrack.com', '123456789', CURRENT_TIMESTAMP),
    ('33333333-1111-1111-1111-000000000134', 'Ignacio', 'Ruiz', '2001-01-03', 'player19@ovaltrack.com', '123456789', CURRENT_TIMESTAMP),
    ('33333333-1111-1111-1111-000000000135', 'Joel', 'Sclavi', '1994-06-25', 'player20@ovaltrack.com', '123456789', CURRENT_TIMESTAMP),
    ('33333333-1111-1111-1111-000000000136', 'Pedro', 'Rubiolo', '2002-12-21', 'player21@ovaltrack.com', '123456789', CURRENT_TIMESTAMP),
    ('33333333-1111-1111-1111-000000000137', 'Rodrigo', 'Bruni', '1993-09-03', 'player22@ovaltrack.com', '123456789', CURRENT_TIMESTAMP);


-- =========================================
-- USERS (15 cuentas de usuario en total)
-- =========================================


-- Las personas del dataset demo también pertenecen al PMRC
UPDATE persons SET club_id = '11111111-1111-1111-1111-000000000010'
WHERE id::text LIKE '33333333-%';

-- Cuentas de jugadores del dataset demo (password: '123456')
INSERT INTO users (id, login_email, password_hash, role, person_id, active, created_at) VALUES
    -- 1: Admin de Club (password: 'administrador')
    -- 2: Entrenador Gonzalo (password: '12345678')
    -- 3: Segundo Entrenador / Analista (password: '123456')
    -- 4 a 15: 12 Jugadores con cuenta (password: '123456')
    ('33333333-1111-1111-1111-000000000101', 'player1@ovaltrack.com', '$2a$10$rfosuoBOENyuQRIy6eCSX.RVjuk2ZrLtlz7NdGpBlxrqviDJflWiG', 'PLAYER', '33333333-1111-1111-1111-000000000101', true, CURRENT_TIMESTAMP),
    ('33333333-1111-1111-1111-000000000102', 'player2@ovaltrack.com', '$2a$10$rfosuoBOENyuQRIy6eCSX.RVjuk2ZrLtlz7NdGpBlxrqviDJflWiG', 'PLAYER', '33333333-1111-1111-1111-000000000102', true, CURRENT_TIMESTAMP),
    ('33333333-1111-1111-1111-000000000103', 'player3@ovaltrack.com', '$2a$10$rfosuoBOENyuQRIy6eCSX.RVjuk2ZrLtlz7NdGpBlxrqviDJflWiG', 'PLAYER', '33333333-1111-1111-1111-000000000103', true, CURRENT_TIMESTAMP),
    ('33333333-1111-1111-1111-000000000104', 'player4@ovaltrack.com', '$2a$10$rfosuoBOENyuQRIy6eCSX.RVjuk2ZrLtlz7NdGpBlxrqviDJflWiG', 'PLAYER', '33333333-1111-1111-1111-000000000104', true, CURRENT_TIMESTAMP),
    ('33333333-1111-1111-1111-000000000105', 'player5@ovaltrack.com', '$2a$10$rfosuoBOENyuQRIy6eCSX.RVjuk2ZrLtlz7NdGpBlxrqviDJflWiG', 'PLAYER', '33333333-1111-1111-1111-000000000105', true, CURRENT_TIMESTAMP),
    ('33333333-1111-1111-1111-000000000106', 'player6@ovaltrack.com', '$2a$10$rfosuoBOENyuQRIy6eCSX.RVjuk2ZrLtlz7NdGpBlxrqviDJflWiG', 'PLAYER', '33333333-1111-1111-1111-000000000106', true, CURRENT_TIMESTAMP),
    ('33333333-1111-1111-1111-000000000107', 'player7@ovaltrack.com', '$2a$10$rfosuoBOENyuQRIy6eCSX.RVjuk2ZrLtlz7NdGpBlxrqviDJflWiG', 'PLAYER', '33333333-1111-1111-1111-000000000107', true, CURRENT_TIMESTAMP),
    ('33333333-1111-1111-1111-000000000108', 'player8@ovaltrack.com', '$2a$10$rfosuoBOENyuQRIy6eCSX.RVjuk2ZrLtlz7NdGpBlxrqviDJflWiG', 'PLAYER', '33333333-1111-1111-1111-000000000108', true, CURRENT_TIMESTAMP),
    ('33333333-1111-1111-1111-000000000109', 'player9@ovaltrack.com', '$2a$10$rfosuoBOENyuQRIy6eCSX.RVjuk2ZrLtlz7NdGpBlxrqviDJflWiG', 'PLAYER', '33333333-1111-1111-1111-000000000109', true, CURRENT_TIMESTAMP),
    ('33333333-1111-1111-1111-000000000110', 'player10@ovaltrack.com', '$2a$10$rfosuoBOENyuQRIy6eCSX.RVjuk2ZrLtlz7NdGpBlxrqviDJflWiG', 'PLAYER', '33333333-1111-1111-1111-000000000110', true, CURRENT_TIMESTAMP),
    ('33333333-1111-1111-1111-000000000111', 'player11@ovaltrack.com', '$2a$10$rfosuoBOENyuQRIy6eCSX.RVjuk2ZrLtlz7NdGpBlxrqviDJflWiG', 'PLAYER', '33333333-1111-1111-1111-000000000111', true, CURRENT_TIMESTAMP),
    ('33333333-1111-1111-1111-000000000112', 'player12@ovaltrack.com', '$2a$10$rfosuoBOENyuQRIy6eCSX.RVjuk2ZrLtlz7NdGpBlxrqviDJflWiG', 'PLAYER', '33333333-1111-1111-1111-000000000112', true, CURRENT_TIMESTAMP),
    ('33333333-1111-1111-1111-000000000128', 'player13@ovaltrack.com', '$2a$10$rfosuoBOENyuQRIy6eCSX.RVjuk2ZrLtlz7NdGpBlxrqviDJflWiG', 'PLAYER', '33333333-1111-1111-1111-000000000128', true, CURRENT_TIMESTAMP),
    ('33333333-1111-1111-1111-000000000129', 'player14@ovaltrack.com', '$2a$10$rfosuoBOENyuQRIy6eCSX.RVjuk2ZrLtlz7NdGpBlxrqviDJflWiG', 'PLAYER', '33333333-1111-1111-1111-000000000129', true, CURRENT_TIMESTAMP),
    ('33333333-1111-1111-1111-000000000130', 'player15@ovaltrack.com', '$2a$10$rfosuoBOENyuQRIy6eCSX.RVjuk2ZrLtlz7NdGpBlxrqviDJflWiG', 'PLAYER', '33333333-1111-1111-1111-000000000130', true, CURRENT_TIMESTAMP),
    ('33333333-1111-1111-1111-000000000131', 'player16@ovaltrack.com', '$2a$10$rfosuoBOENyuQRIy6eCSX.RVjuk2ZrLtlz7NdGpBlxrqviDJflWiG', 'PLAYER', '33333333-1111-1111-1111-000000000131', true, CURRENT_TIMESTAMP),
    ('33333333-1111-1111-1111-000000000132', 'player17@ovaltrack.com', '$2a$10$rfosuoBOENyuQRIy6eCSX.RVjuk2ZrLtlz7NdGpBlxrqviDJflWiG', 'PLAYER', '33333333-1111-1111-1111-000000000132', true, CURRENT_TIMESTAMP),
    ('33333333-1111-1111-1111-000000000133', 'player18@ovaltrack.com', '$2a$10$rfosuoBOENyuQRIy6eCSX.RVjuk2ZrLtlz7NdGpBlxrqviDJflWiG', 'PLAYER', '33333333-1111-1111-1111-000000000133', true, CURRENT_TIMESTAMP),
    ('33333333-1111-1111-1111-000000000134', 'player19@ovaltrack.com', '$2a$10$rfosuoBOENyuQRIy6eCSX.RVjuk2ZrLtlz7NdGpBlxrqviDJflWiG', 'PLAYER', '33333333-1111-1111-1111-000000000134', true, CURRENT_TIMESTAMP),
    ('33333333-1111-1111-1111-000000000135', 'player20@ovaltrack.com', '$2a$10$rfosuoBOENyuQRIy6eCSX.RVjuk2ZrLtlz7NdGpBlxrqviDJflWiG', 'PLAYER', '33333333-1111-1111-1111-000000000135', true, CURRENT_TIMESTAMP),
    ('33333333-1111-1111-1111-000000000136', 'player21@ovaltrack.com', '$2a$10$rfosuoBOENyuQRIy6eCSX.RVjuk2ZrLtlz7NdGpBlxrqviDJflWiG', 'PLAYER', '33333333-1111-1111-1111-000000000136', true, CURRENT_TIMESTAMP),
    ('33333333-1111-1111-1111-000000000137', 'player22@ovaltrack.com', '$2a$10$rfosuoBOENyuQRIy6eCSX.RVjuk2ZrLtlz7NdGpBlxrqviDJflWiG', 'PLAYER', '33333333-1111-1111-1111-000000000137', true, CURRENT_TIMESTAMP);


-- =========================================
-- CLUBS
-- =========================================


-- División M19 (Mario Analista la entrena; en Primera sigue como analista)
INSERT INTO divisions (id, name, club_id, created_at, age_category, gender, active) VALUES
    ('11111111-1111-1111-1111-000000000021', 'M19', '11111111-1111-1111-1111-000000000010', CURRENT_TIMESTAMP, 'U20', 'MALE', true);


-- =========================================
-- DIVISION_COACHES (Entrenadores por División)
-- =========================================


INSERT INTO division_coaches (id, person_id, division_id, start_date, end_date) VALUES
    ('33333333-1111-1111-1111-000000000031', '11111111-1111-1111-1111-000000000003', '11111111-1111-1111-1111-000000000021', '2023-01-01', NULL);


-- =========================================
-- DIVISION_PLAYERS (Jugadores por División)
-- =========================================


-- Plantel demo: Primera (25 jugadores ficticios) y M19 (12)
INSERT INTO division_players (id, person_id, division_id, jersey_number, position, start_date, end_date) VALUES
    -- Jugadores en Primera (15 jugadores)
    ('33333333-1111-1111-1111-000000000200', '33333333-1111-1111-1111-000000000101', '11111111-1111-1111-1111-000000000020', 1, 'Forward', '2023-01-01', NULL),
    ('33333333-1111-1111-1111-000000000201', '33333333-1111-1111-1111-000000000102', '11111111-1111-1111-1111-000000000020', 2, 'Forward', '2023-01-01', NULL),
    ('33333333-1111-1111-1111-000000000202', '33333333-1111-1111-1111-000000000103', '11111111-1111-1111-1111-000000000020', 3, 'Forward', '2023-01-01', NULL),
    ('33333333-1111-1111-1111-000000000203', '33333333-1111-1111-1111-000000000104', '11111111-1111-1111-1111-000000000020', 4, 'Forward', '2023-01-01', NULL),
    ('33333333-1111-1111-1111-000000000204', '33333333-1111-1111-1111-000000000105', '11111111-1111-1111-1111-000000000020', 5, 'Forward', '2023-01-01', NULL),
    ('33333333-1111-1111-1111-000000000205', '33333333-1111-1111-1111-000000000106', '11111111-1111-1111-1111-000000000020', 6, 'Forward', '2023-01-01', NULL),
    ('33333333-1111-1111-1111-000000000206', '33333333-1111-1111-1111-000000000107', '11111111-1111-1111-1111-000000000020', 7, 'Forward', '2023-01-01', NULL),
    ('33333333-1111-1111-1111-000000000207', '33333333-1111-1111-1111-000000000108', '11111111-1111-1111-1111-000000000020', 8, 'Forward', '2023-01-01', NULL),
    ('33333333-1111-1111-1111-000000000208', '33333333-1111-1111-1111-000000000109', '11111111-1111-1111-1111-000000000020', 9, 'Back', '2023-01-01', NULL),
    ('33333333-1111-1111-1111-000000000209', '33333333-1111-1111-1111-000000000110', '11111111-1111-1111-1111-000000000020', 10, 'Back', '2023-01-01', NULL),
    ('33333333-1111-1111-1111-000000000210', '33333333-1111-1111-1111-000000000111', '11111111-1111-1111-1111-000000000020', 11, 'Back', '2023-01-01', NULL),
    ('33333333-1111-1111-1111-000000000211', '33333333-1111-1111-1111-000000000112', '11111111-1111-1111-1111-000000000020', 12, 'Back', '2023-01-01', NULL),
    ('33333333-1111-1111-1111-000000000212', '33333333-1111-1111-1111-000000000113', '11111111-1111-1111-1111-000000000020', 13, 'Back', '2023-01-01', NULL),
    ('33333333-1111-1111-1111-000000000213', '33333333-1111-1111-1111-000000000114', '11111111-1111-1111-1111-000000000020', 14, 'Back', '2023-01-01', NULL),
    ('33333333-1111-1111-1111-000000000214', '33333333-1111-1111-1111-000000000115', '11111111-1111-1111-1111-000000000020', 15, 'Back', '2023-01-01', NULL),
    ('33333333-1111-1111-1111-000000000227', '33333333-1111-1111-1111-000000000128', '11111111-1111-1111-1111-000000000020', 16, 'Forward', '2023-01-01', NULL),
    ('33333333-1111-1111-1111-000000000228', '33333333-1111-1111-1111-000000000129', '11111111-1111-1111-1111-000000000020', 17, 'Forward', '2023-01-01', NULL),
    ('33333333-1111-1111-1111-000000000229', '33333333-1111-1111-1111-000000000130', '11111111-1111-1111-1111-000000000020', 18, 'Forward', '2023-01-01', NULL),
    ('33333333-1111-1111-1111-000000000230', '33333333-1111-1111-1111-000000000131', '11111111-1111-1111-1111-000000000020', 19, 'Forward', '2023-01-01', NULL),
    ('33333333-1111-1111-1111-000000000231', '33333333-1111-1111-1111-000000000132', '11111111-1111-1111-1111-000000000020', 20, 'Forward', '2023-01-01', NULL),
    ('33333333-1111-1111-1111-000000000232', '33333333-1111-1111-1111-000000000133', '11111111-1111-1111-1111-000000000020', 21, 'Back', '2023-01-01', NULL),
    ('33333333-1111-1111-1111-000000000233', '33333333-1111-1111-1111-000000000134', '11111111-1111-1111-1111-000000000020', 22, 'Back', '2023-01-01', NULL),
    ('33333333-1111-1111-1111-000000000234', '33333333-1111-1111-1111-000000000135', '11111111-1111-1111-1111-000000000020', 23, 'Back', '2023-01-01', NULL),
    ('33333333-1111-1111-1111-000000000235', '33333333-1111-1111-1111-000000000136', '11111111-1111-1111-1111-000000000020', 24, 'Back', '2023-01-01', NULL),
    ('33333333-1111-1111-1111-000000000236', '33333333-1111-1111-1111-000000000137', '11111111-1111-1111-1111-000000000020', 25, 'Back', '2023-01-01', NULL),
    -- Jugadores en M19 (12 jugadores)
    ('33333333-1111-1111-1111-000000000215', '33333333-1111-1111-1111-000000000116', '11111111-1111-1111-1111-000000000021', 1, 'Forward', '2023-01-01', NULL),
    ('33333333-1111-1111-1111-000000000216', '33333333-1111-1111-1111-000000000117', '11111111-1111-1111-1111-000000000021', 2, 'Forward', '2023-01-01', NULL),
    ('33333333-1111-1111-1111-000000000217', '33333333-1111-1111-1111-000000000118', '11111111-1111-1111-1111-000000000021', 3, 'Forward', '2023-01-01', NULL),
    ('33333333-1111-1111-1111-000000000218', '33333333-1111-1111-1111-000000000119', '11111111-1111-1111-1111-000000000021', 4, 'Forward', '2023-01-01', NULL),
    ('33333333-1111-1111-1111-000000000219', '33333333-1111-1111-1111-000000000120', '11111111-1111-1111-1111-000000000021', 5, 'Forward', '2023-01-01', NULL),
    ('33333333-1111-1111-1111-000000000220', '33333333-1111-1111-1111-000000000121', '11111111-1111-1111-1111-000000000021', 6, 'Forward', '2023-01-01', NULL),
    ('33333333-1111-1111-1111-000000000221', '33333333-1111-1111-1111-000000000122', '11111111-1111-1111-1111-000000000021', 7, 'Forward', '2023-01-01', NULL),
    ('33333333-1111-1111-1111-000000000222', '33333333-1111-1111-1111-000000000123', '11111111-1111-1111-1111-000000000021', 8, 'Forward', '2023-01-01', NULL),
    ('33333333-1111-1111-1111-000000000223', '33333333-1111-1111-1111-000000000124', '11111111-1111-1111-1111-000000000021', 9, 'Back', '2023-01-01', NULL),
    ('33333333-1111-1111-1111-000000000224', '33333333-1111-1111-1111-000000000125', '11111111-1111-1111-1111-000000000021', 10, 'Back', '2023-01-01', NULL),
    ('33333333-1111-1111-1111-000000000225', '33333333-1111-1111-1111-000000000126', '11111111-1111-1111-1111-000000000021', 11, 'Back', '2023-01-01', NULL),
    ('33333333-1111-1111-1111-000000000226', '33333333-1111-1111-1111-000000000127', '11111111-1111-1111-1111-000000000021', 12, 'Back', '2023-01-01', NULL);



-- =========================================
-- OPPONENTS (Clubes rivales)
-- =========================================


INSERT INTO matches (
  id, date, division_id, opponent_id, status, current_period,
  clock_elapsed_seconds, clock_paused, clock_updated_at,
  current_possession, home_score, away_score, started_at, finished_at
) VALUES
    -- 1: Trelew RC
  ('33333333-1111-1111-1111-000000000040', '2026-09-28 15:30:00', '11111111-1111-1111-1111-000000000020', '22222222-1111-1111-1111-000000000001', 'FINISHED', 2, 4800, true, CURRENT_TIMESTAMP, 'OWN', 0, 0, '2026-09-28 15:30:00', '2026-09-28 17:30:00'),
    -- 2: Bigornia Club
  ('33333333-1111-1111-1111-000000000041', '2026-10-05 16:00:00', '11111111-1111-1111-1111-000000000020', '22222222-1111-1111-1111-000000000002', 'NOT_STARTED', 1, 0, true, NULL, 'OWN', 0, 0, NULL, NULL),
    -- 3: Chenque RC
  ('33333333-1111-1111-1111-000000000042', '2026-09-28 14:00:00', '11111111-1111-1111-1111-000000000020', '22222222-1111-1111-1111-000000000003', 'FINISHED', 2, 4800, true, CURRENT_TIMESTAMP, 'OWN', 0, 0, '2026-09-28 14:00:00', '2026-09-28 16:00:00'),
    -- 4: Patoruzú RC
  ('33333333-1111-1111-1111-000000000043', '2026-09-28 16:45:00', '11111111-1111-1111-1111-000000000020', '22222222-1111-1111-1111-000000000004', 'FINISHED', 2, 4800, true, CURRENT_TIMESTAMP, 'OWN', 0, 0, '2026-09-28 16:45:00', '2026-09-28 18:45:00'),
    -- 5: Deportivo Portugués
  ('33333333-1111-1111-1111-000000000044', '2026-09-21 15:30:00', '11111111-1111-1111-1111-000000000020', '22222222-1111-1111-1111-000000000005', 'FINISHED', 2, 4800, true, CURRENT_TIMESTAMP, 'OWN', 0, 0, '2026-09-21 15:30:00', '2026-09-21 17:30:00'),
    -- 6: Calafate RC
  ('33333333-1111-1111-1111-000000000045', '2026-10-12 14:00:00', '11111111-1111-1111-1111-000000000021', '22222222-1111-1111-1111-000000000006', 'NOT_STARTED', 1, 0, true, NULL, 'OWN', 0, 0, NULL, NULL),
    -- 7: Comodoro Rugby Club
  ('33333333-1111-1111-1111-000000000046', CURRENT_DATE + TIME '15:30', '11111111-1111-1111-1111-000000000020', '22222222-1111-1111-1111-000000000007', 'HALFTIME', 1, 2400, true, CURRENT_TIMESTAMP, 'OWN', 21, 13, CURRENT_DATE + TIME '15:30', NULL);



-- =========================================
-- EVENT_TYPES (Catálogo Estándar de Tipos de Eventos, v3)
-- =========================================
-- template_event_fields es un ARRAY ORDENADO de campos:
--   key        identificador estable (clave dentro de events.attributes)
--   label      texto a mostrar
--   type       select | number | boolean
--   phase      'live' -> se pide al cargar el evento (un paso del modal) | 'post' -> se completa después, con el video
--   required   en 'live' es obligatorio (solo los number/slider pueden omitirse)
--   options    [{value, label, possession?}] solo para select; possession (KEEP | ACTOR | OTHER) define la
--              posesión resultante cuando se elige esa opción (pisa possession_after del tipo)
--   min/max/default   obligatorios en number (slider)
--   effects    solo boolean: "scoring" (si es false no suma puntos), "possession" (si es false la posesión no cambia)
--   trueLabel/falseLabel   textos de los botones de un boolean
--   followUps (en una opción) | follow_up_choices (en el tipo): lista de {code, label?, preset?}; al guardar el evento
--              se muestra una botonera con esos eventos (más «Nada más»). preset pre-llena campos en vivo del evento elegido
--              y salta ese paso. El equipo del evento elegido se resuelve con la posesión ya actualizada (actor).
-- Reglas del catálogo:
--   * Máximo 2 toques por evento en el modal: jugador (si requires_player) + 1 campo 'live'.
--   * Un solo tipo por acción; el resultado va en un campo, no en tipos duplicados.
--   * actor decide qué equipo se asigna: ATTACKING = el que tiene la pelota, DEFENDING = el otro, CHOOSE = el analista elige.
--   * Claves reservadas en attributes: playerNumber.
--   * Turnovers: 'Turnover ganado' (forzado, se acredita a quien lo gana) y 'Error de manejo' (no forzado, se carga a quien lo pierde).
--     Un turnover se registra una sola vez; los resultados de Maul/Scrum/Line-out ya cambian la posesión por sí solos.
-- Pendientes: Cambio sin campos (cambia la lista de jugadores en cancha); elegir el evento siguiente tras un penal.


    -- Eventos para Partido 5: Deportivo Portugués (FINISHED, 80 min reloj, finalizado a las 2h reales)
INSERT INTO events (id, match_id, player_id, event_type_id, team_possession, match_time, absolute_match_time, real_time, period, origin, active, created_at, synchronized_at) VALUES
    ('2dc019ed-223b-4c38-ac4c-ded58efd8e29', '33333333-1111-1111-1111-000000000044', NULL, '550e8400-e29b-41d4-a716-446655440112', 'OPPONENT', 44, 58, '2026-09-21 15:30:58', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('cef3334a-c0bc-4a7b-ace8-736d6e5bad65', '33333333-1111-1111-1111-000000000044', NULL, '550e8400-e29b-41d4-a716-446655440104', 'OPPONENT', 78, 103, '2026-09-21 15:31:43', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('180cdf49-b829-4d08-aadf-71f69983a651', '33333333-1111-1111-1111-000000000044', NULL, '550e8400-e29b-41d4-a716-446655440101', 'OPPONENT', 153, 203, '2026-09-21 15:33:23', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('91bafd3c-06a8-4358-9b13-eeb98d38ac93', '33333333-1111-1111-1111-000000000044', NULL, '550e8400-e29b-41d4-a716-446655440122', 'OWN', 156, 207, '2026-09-21 15:33:27', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('5df3b1ae-520d-4c4c-976c-5e1f239a3da3', '33333333-1111-1111-1111-000000000044', '33333333-1111-1111-1111-000000000105', '550e8400-e29b-41d4-a716-446655440115', 'NEUTRAL', 185, 246, '2026-09-21 15:34:06', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('69c9c5b1-083f-4289-83d7-e4c50da153bf', '33333333-1111-1111-1111-000000000044', '33333333-1111-1111-1111-000000000105', '550e8400-e29b-41d4-a716-446655440122', 'OWN', 431, 579, '2026-09-21 15:39:39', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('f549de96-7e3c-4ed6-a5af-017bdc386bc0', '33333333-1111-1111-1111-000000000044', '33333333-1111-1111-1111-000000000109', '550e8400-e29b-41d4-a716-446655440101', 'OWN', 576, 777, '2026-09-21 15:42:57', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('df2c2461-664a-490f-bab8-7d57dd508388', '33333333-1111-1111-1111-000000000044', '33333333-1111-1111-1111-000000000102', '550e8400-e29b-41d4-a716-446655440122', 'NEUTRAL', 677, 915, '2026-09-21 15:45:15', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('9ec5309b-402f-4d9c-a69c-e9a01d245857', '33333333-1111-1111-1111-000000000044', '33333333-1111-1111-1111-000000000101', '550e8400-e29b-41d4-a716-446655440101', 'OWN', 949, 1289, '2026-09-21 15:51:29', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('2e3bc95b-49a5-492e-b13e-2125a9a721e8', '33333333-1111-1111-1111-000000000044', NULL, '550e8400-e29b-41d4-a716-446655440112', 'OPPONENT', 1035, 1407, '2026-09-21 15:53:27', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('aa55efec-95f0-46be-b7d1-70ab1bfb5414', '33333333-1111-1111-1111-000000000044', '33333333-1111-1111-1111-000000000112', '550e8400-e29b-41d4-a716-446655440122', 'NEUTRAL', 1041, 1415, '2026-09-21 15:53:35', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('82622c32-386c-4175-ae66-e654f338b029', '33333333-1111-1111-1111-000000000044', NULL, '550e8400-e29b-41d4-a716-446655440117', 'OPPONENT', 1082, 1472, '2026-09-21 15:54:32', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('a2442cae-f008-4dcc-8bf0-90d04f488a33', '33333333-1111-1111-1111-000000000044', NULL, '550e8400-e29b-41d4-a716-446655440122', 'OPPONENT', 1231, 1677, '2026-09-21 15:57:57', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('5ed1910b-8815-4703-9b64-81969f95c317', '33333333-1111-1111-1111-000000000044', NULL, '550e8400-e29b-41d4-a716-446655440104', 'OPPONENT', 1308, 1784, '2026-09-21 15:59:44', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('ed1a63fc-fe74-48be-9737-b18fcfdc8ae6', '33333333-1111-1111-1111-000000000044', NULL, '550e8400-e29b-41d4-a716-446655440122', 'OWN', 1315, 1794, '2026-09-21 15:59:54', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('8aab944d-0352-47fe-bd90-0c8fe90d2b63', '33333333-1111-1111-1111-000000000044', '33333333-1111-1111-1111-000000000105', '550e8400-e29b-41d4-a716-446655440101', 'OWN', 1347, 1838, '2026-09-21 16:00:38', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('39dc8574-bbdc-46cd-9f45-9b51ac01030e', '33333333-1111-1111-1111-000000000044', NULL, '550e8400-e29b-41d4-a716-446655440117', 'OPPONENT', 1381, 1885, '2026-09-21 16:01:25', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('974c7cd8-6a60-4bd6-8a17-0c012f4f34c0', '33333333-1111-1111-1111-000000000044', NULL, '550e8400-e29b-41d4-a716-446655440112', 'OPPONENT', 1391, 1899, '2026-09-21 16:01:39', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('e41031fb-54b2-41a7-ba04-4128a1d7b190', '33333333-1111-1111-1111-000000000044', '33333333-1111-1111-1111-000000000112', '550e8400-e29b-41d4-a716-446655440112', 'NEUTRAL', 1482, 2025, '2026-09-21 16:03:45', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('31446a7c-1f14-424a-b639-19243e021d0f', '33333333-1111-1111-1111-000000000044', '33333333-1111-1111-1111-000000000104', '550e8400-e29b-41d4-a716-446655440116', 'NEUTRAL', 1488, 2033, '2026-09-21 16:03:53', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('a187ff91-4923-4b3c-b794-30356cb9f19c', '33333333-1111-1111-1111-000000000044', NULL, '550e8400-e29b-41d4-a716-446655440104', 'OPPONENT', 1740, 2382, '2026-09-21 16:09:42', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('c0cc46c0-1842-4d36-b47a-757db0860097', '33333333-1111-1111-1111-000000000044', '33333333-1111-1111-1111-000000000101', '550e8400-e29b-41d4-a716-446655440115', 'NEUTRAL', 1861, 2550, '2026-09-21 16:12:30', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('a463bb0b-44b6-4458-994b-993b9d5e61e2', '33333333-1111-1111-1111-000000000044', NULL, '550e8400-e29b-41d4-a716-446655440112', 'OPPONENT', 1970, 2701, '2026-09-21 16:15:01', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('9f75da86-23a7-44a4-b54a-6cc8bdcf3013', '33333333-1111-1111-1111-000000000044', '33333333-1111-1111-1111-000000000110', '550e8400-e29b-41d4-a716-446655440111', 'OWN', 2058, 2824, '2026-09-21 16:17:04', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('c47eca79-18be-4106-b001-500e25070681', '33333333-1111-1111-1111-000000000044', '33333333-1111-1111-1111-000000000104', '550e8400-e29b-41d4-a716-446655440104', 'OWN', 2142, 2941, '2026-09-21 16:19:01', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('c3f3ce42-f32b-43e9-be3d-b060adec5408', '33333333-1111-1111-1111-000000000044', NULL, '550e8400-e29b-41d4-a716-446655440122', 'OWN', 2196, 3016, '2026-09-21 16:20:16', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('4ad44d4e-77a7-4d38-8d30-77d51bd1b87c', '33333333-1111-1111-1111-000000000044', '33333333-1111-1111-1111-000000000112', '550e8400-e29b-41d4-a716-446655440117', 'NEUTRAL', 2364, 3250, '2026-09-21 16:24:10', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('194e28dd-09af-4295-96b6-620c931557ff', '33333333-1111-1111-1111-000000000044', NULL, '550e8400-e29b-41d4-a716-446655440115', 'OPPONENT', 2428, 4035, '2026-09-21 16:37:15', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('4455830d-ac42-4bc2-900e-403ffa8c4216', '33333333-1111-1111-1111-000000000044', NULL, '550e8400-e29b-41d4-a716-446655440111', 'OPPONENT', 2485, 4109, '2026-09-21 16:38:29', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('dfc3a67c-199c-41d1-8235-d5fcec97ebfc', '33333333-1111-1111-1111-000000000044', NULL, '550e8400-e29b-41d4-a716-446655440117', 'OWN', 2819, 4547, '2026-09-21 16:45:47', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('1afc98eb-4aa7-4a71-bec0-4254686ca5e7', '33333333-1111-1111-1111-000000000044', '33333333-1111-1111-1111-000000000103', '550e8400-e29b-41d4-a716-446655440116', 'NEUTRAL', 2868, 4612, '2026-09-21 16:46:52', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('a65cb958-0706-4a9e-b9df-326f243aeb89', '33333333-1111-1111-1111-000000000044', NULL, '550e8400-e29b-41d4-a716-446655440122', 'OPPONENT', 2974, 4752, '2026-09-21 16:49:12', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('bf3ae683-d161-43ad-abca-c778b59d4afd', '33333333-1111-1111-1111-000000000044', '33333333-1111-1111-1111-000000000106', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 3054, 4858, '2026-09-21 16:50:58', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('879c1eb6-1d8c-4f65-9ecd-4af69018fdd3', '33333333-1111-1111-1111-000000000044', NULL, '550e8400-e29b-41d4-a716-446655440115', 'OPPONENT', 3102, 4922, '2026-09-21 16:52:02', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('43bd7d0c-f830-4de3-89a2-d7ef79ad9af2', '33333333-1111-1111-1111-000000000044', NULL, '550e8400-e29b-41d4-a716-446655440122', 'OPPONENT', 3436, 5367, '2026-09-21 16:59:27', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('a577a61f-14be-46bb-8cfc-8c048431033f', '33333333-1111-1111-1111-000000000044', '33333333-1111-1111-1111-000000000109', '550e8400-e29b-41d4-a716-446655440117', 'OWN', 3540, 5506, '2026-09-21 17:01:46', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('c042f22b-6ae4-4a71-8acf-932966773f00', '33333333-1111-1111-1111-000000000044', NULL, '550e8400-e29b-41d4-a716-446655440104', 'OPPONENT', 3556, 5528, '2026-09-21 17:02:08', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('d9614121-923a-4b13-8de1-c77d6c435e1e', '33333333-1111-1111-1111-000000000044', '33333333-1111-1111-1111-000000000108', '550e8400-e29b-41d4-a716-446655440122', 'OWN', 3586, 5568, '2026-09-21 17:02:48', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('aad5245f-688a-48a5-8785-c6d52e1e7bc7', '33333333-1111-1111-1111-000000000044', NULL, '550e8400-e29b-41d4-a716-446655440116', 'OPPONENT', 3678, 5691, '2026-09-21 17:04:51', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('d490971f-b027-456e-84ba-f4e7767f4adc', '33333333-1111-1111-1111-000000000044', '33333333-1111-1111-1111-000000000104', '550e8400-e29b-41d4-a716-446655440112', 'NEUTRAL', 3815, 5874, '2026-09-21 17:07:54', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('17c68ea6-3dfd-4d71-bdfa-4376646de749', '33333333-1111-1111-1111-000000000044', '33333333-1111-1111-1111-000000000104', '550e8400-e29b-41d4-a716-446655440117', 'NEUTRAL', 3850, 5921, '2026-09-21 17:08:41', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('669ec581-5412-4b1f-963c-f7dd3b721d61', '33333333-1111-1111-1111-000000000044', NULL, '550e8400-e29b-41d4-a716-446655440122', 'OPPONENT', 3951, 6057, '2026-09-21 17:10:57', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('bef0980c-9ee1-4401-9070-b877fe511ab8', '33333333-1111-1111-1111-000000000044', '33333333-1111-1111-1111-000000000105', '550e8400-e29b-41d4-a716-446655440116', 'OWN', 3980, 6096, '2026-09-21 17:11:36', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('dc7fd442-2faf-4c71-b73e-4712eeac9e12', '33333333-1111-1111-1111-000000000044', NULL, '550e8400-e29b-41d4-a716-446655440116', 'OPPONENT', 4088, 6241, '2026-09-21 17:14:01', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('7ff293bc-cdec-4b67-8679-c25d81ad914d', '33333333-1111-1111-1111-000000000044', '33333333-1111-1111-1111-000000000107', '550e8400-e29b-41d4-a716-446655440101', 'OWN', 4183, 6369, '2026-09-21 17:16:09', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('02d72880-4f32-448a-87a3-ddf4d60e062b', '33333333-1111-1111-1111-000000000044', '33333333-1111-1111-1111-000000000107', '550e8400-e29b-41d4-a716-446655440111', 'NEUTRAL', 4191, 6379, '2026-09-21 17:16:19', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('0ff1a8c5-d3c5-4ff5-9117-ec15f1d1c03a', '33333333-1111-1111-1111-000000000044', NULL, '550e8400-e29b-41d4-a716-446655440101', 'OPPONENT', 4316, 6548, '2026-09-21 17:19:08', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('5d24aba0-8595-4b02-8e03-6f6e5dc7b0ee', '33333333-1111-1111-1111-000000000044', NULL, '550e8400-e29b-41d4-a716-446655440117', 'OPPONENT', 4599, 6929, '2026-09-21 17:25:29', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('29a69428-66af-4aa8-a19a-fb5c8eb01cce', '33333333-1111-1111-1111-000000000044', '33333333-1111-1111-1111-000000000112', '550e8400-e29b-41d4-a716-446655440117', 'NEUTRAL', 4670, 7025, '2026-09-21 17:27:05', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('2313cc2f-efab-4959-a793-eb9f77a22942', '33333333-1111-1111-1111-000000000044', NULL, '550e8400-e29b-41d4-a716-446655440104', 'OPPONENT', 4778, 7170, '2026-09-21 17:29:30', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

    -- Eventos para Partido 7: Comodoro Rugby Club (HALFTIME)
INSERT INTO events (id, match_id, player_id, event_type_id, team_possession, match_time, real_time, period, origin, active, created_at, synchronized_at) VALUES
    ('22222222-2222-2222-2222-000000000001', '33333333-1111-1111-1111-000000000046', '33333333-1111-1111-1111-000000000105', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 25, '2026-10-09 15:30:25', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-000000000002', '33333333-1111-1111-1111-000000000046', '33333333-1111-1111-1111-000000000106', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 48, '2026-10-09 15:30:48', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-000000000003', '33333333-1111-1111-1111-000000000046', NULL, '550e8400-e29b-41d4-a716-446655440117', 'OPPONENT', 80, '2026-10-09 15:31:20', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-000000000004', '33333333-1111-1111-1111-000000000046', '33333333-1111-1111-1111-000000000107', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 115, '2026-10-09 15:31:55', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-000000000005', '33333333-1111-1111-1111-000000000046', NULL, '550e8400-e29b-41d4-a716-446655440111', 'NEUTRAL', 145, '2026-10-09 15:32:25', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-000000000006', '33333333-1111-1111-1111-000000000046', '33333333-1111-1111-1111-000000000103', '550e8400-e29b-41d4-a716-446655440116', 'OWN', 178, '2026-10-09 15:32:58', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-000000000007', '33333333-1111-1111-1111-000000000046', NULL, '550e8400-e29b-41d4-a716-446655440122', 'OWN', 210, '2026-10-09 15:33:30', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-000000000008', '33333333-1111-1111-1111-000000000046', NULL, '550e8400-e29b-41d4-a716-446655440112', 'NEUTRAL', 245, '2026-10-09 15:34:05', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-000000000009', '33333333-1111-1111-1111-000000000046', '33333333-1111-1111-1111-000000000104', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 280, '2026-10-09 15:34:40', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-000000000010', '33333333-1111-1111-1111-000000000046', '33333333-1111-1111-1111-000000000101', '550e8400-e29b-41d4-a716-446655440117', 'OWN', 310, '2026-10-09 15:35:10', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-000000000011', '33333333-1111-1111-1111-000000000046', NULL, '550e8400-e29b-41d4-a716-446655440122', 'OWN', 355, '2026-10-09 15:35:55', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-000000000012', '33333333-1111-1111-1111-000000000046', NULL, '550e8400-e29b-41d4-a716-446655440104', 'OPPONENT', 390, '2026-10-09 15:36:30', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-000000000013', '33333333-1111-1111-1111-000000000046', NULL, '550e8400-e29b-41d4-a716-446655440112', 'NEUTRAL', 430, '2026-10-09 15:37:10', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-000000000014', '33333333-1111-1111-1111-000000000046', '33333333-1111-1111-1111-000000000102', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 455, '2026-10-09 15:37:35', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-000000000015', '33333333-1111-1111-1111-000000000046', '33333333-1111-1111-1111-000000000108', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 490, '2026-10-09 15:38:10', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-000000000016', '33333333-1111-1111-1111-000000000046', '33333333-1111-1111-1111-000000000107', '550e8400-e29b-41d4-a716-446655440116', 'OWN', 520, '2026-10-09 15:38:40', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-000000000017', '33333333-1111-1111-1111-000000000046', NULL, '550e8400-e29b-41d4-a716-446655440117', 'OPPONENT', 555, '2026-10-09 15:39:15', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-000000000018', '33333333-1111-1111-1111-000000000046', '33333333-1111-1111-1111-000000000106', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 585, '2026-10-09 15:39:45', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-000000000019', '33333333-1111-1111-1111-000000000046', NULL, '550e8400-e29b-41d4-a716-446655440111', 'NEUTRAL', 615, '2026-10-09 15:40:15', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-000000000020', '33333333-1111-1111-1111-000000000046', '33333333-1111-1111-1111-000000000105', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 645, '2026-10-09 15:40:45', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-000000000021', '33333333-1111-1111-1111-000000000046', NULL, '550e8400-e29b-41d4-a716-446655440122', 'OPPONENT', 675, '2026-10-09 15:41:15', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-000000000022', '33333333-1111-1111-1111-000000000046', NULL, '550e8400-e29b-41d4-a716-446655440112', 'NEUTRAL', 705, '2026-10-09 15:41:45', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-000000000023', '33333333-1111-1111-1111-000000000046', '33333333-1111-1111-1111-000000000112', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 735, '2026-10-09 15:42:15', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-000000000024', '33333333-1111-1111-1111-000000000046', '33333333-1111-1111-1111-000000000110', '550e8400-e29b-41d4-a716-446655440101', 'OWN', 755, '2026-10-09 15:42:35', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-000000000025', '33333333-1111-1111-1111-000000000046', '33333333-1111-1111-1111-000000000109', '550e8400-e29b-41d4-a716-446655440102', 'OWN', 795, '2026-10-09 15:43:15', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-000000000026', '33333333-1111-1111-1111-000000000046', '33333333-1111-1111-1111-000000000111', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 830, '2026-10-09 15:43:50', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-000000000027', '33333333-1111-1111-1111-000000000046', '33333333-1111-1111-1111-000000000105', '550e8400-e29b-41d4-a716-446655440117', 'OWN', 860, '2026-10-09 15:44:20', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-000000000028', '33333333-1111-1111-1111-000000000046', NULL, '550e8400-e29b-41d4-a716-446655440111', 'NEUTRAL', 890, '2026-10-09 15:44:50', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-000000000029', '33333333-1111-1111-1111-000000000046', '33333333-1111-1111-1111-000000000101', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 920, '2026-10-09 15:45:20', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-000000000030', '33333333-1111-1111-1111-000000000046', '33333333-1111-1111-1111-000000000106', '550e8400-e29b-41d4-a716-446655440116', 'OWN', 955, '2026-10-09 15:45:55', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-000000000031', '33333333-1111-1111-1111-000000000046', NULL, '550e8400-e29b-41d4-a716-446655440122', 'OWN', 985, '2026-10-09 15:46:25', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-000000000032', '33333333-1111-1111-1111-000000000046', NULL, '550e8400-e29b-41d4-a716-446655440101', 'OPPONENT', 1020, '2026-10-09 15:47:00', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-000000000033', '33333333-1111-1111-1111-000000000046', NULL, '550e8400-e29b-41d4-a716-446655440102', 'OPPONENT', 1065, '2026-10-09 15:47:45', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-000000000034', '33333333-1111-1111-1111-000000000046', NULL, '550e8400-e29b-41d4-a716-446655440112', 'NEUTRAL', 1110, '2026-10-09 15:48:30', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-000000000035', '33333333-1111-1111-1111-000000000046', '33333333-1111-1111-1111-000000000107', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 1135, '2026-10-09 15:48:55', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-000000000036', '33333333-1111-1111-1111-000000000046', '33333333-1111-1111-1111-000000000105', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 1170, '2026-10-09 15:49:30', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-000000000037', '33333333-1111-1111-1111-000000000046', NULL, '550e8400-e29b-41d4-a716-446655440117', 'OPPONENT', 1200, '2026-10-09 15:50:00', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-000000000038', '33333333-1111-1111-1111-000000000046', NULL, '550e8400-e29b-41d4-a716-446655440111', 'NEUTRAL', 1230, '2026-10-09 15:50:30', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-000000000039', '33333333-1111-1111-1111-000000000046', '33333333-1111-1111-1111-000000000103', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 1260, '2026-10-09 15:51:00', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-000000000040', '33333333-1111-1111-1111-000000000046', NULL, '550e8400-e29b-41d4-a716-446655440122', 'OPPONENT', 1295, '2026-10-09 15:51:35', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-000000000041', '33333333-1111-1111-1111-000000000046', '33333333-1111-1111-1111-000000000109', '550e8400-e29b-41d4-a716-446655440104', 'OWN', 1330, '2026-10-09 15:52:10', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-000000000042', '33333333-1111-1111-1111-000000000046', NULL, '550e8400-e29b-41d4-a716-446655440112', 'NEUTRAL', 1370, '2026-10-09 15:52:50', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-000000000043', '33333333-1111-1111-1111-000000000046', '33333333-1111-1111-1111-000000000102', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 1400, '2026-10-09 15:53:20', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-000000000044', '33333333-1111-1111-1111-000000000046', '33333333-1111-1111-1111-000000000104', '550e8400-e29b-41d4-a716-446655440116', 'OWN', 1430, '2026-10-09 15:53:50', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-000000000045', '33333333-1111-1111-1111-000000000046', '33333333-1111-1111-1111-000000000107', '550e8400-e29b-41d4-a716-446655440117', 'OWN', 1460, '2026-10-09 15:54:20', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-000000000046', '33333333-1111-1111-1111-000000000046', '33333333-1111-1111-1111-000000000114', '550e8400-e29b-41d4-a716-446655440125', 'OWN', 1495, '2026-10-09 15:54:55', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-000000000047', '33333333-1111-1111-1111-000000000046', NULL, '550e8400-e29b-41d4-a716-446655440111', 'NEUTRAL', 1525, '2026-10-09 15:55:25', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-000000000048', '33333333-1111-1111-1111-000000000046', '33333333-1111-1111-1111-000000000108', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 1560, '2026-10-09 15:56:00', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-000000000049', '33333333-1111-1111-1111-000000000046', '33333333-1111-1111-1111-000000000105', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 1590, '2026-10-09 15:56:30', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-000000000050', '33333333-1111-1111-1111-000000000046', '33333333-1111-1111-1111-000000000109', '550e8400-e29b-41d4-a716-446655440105', 'OWN', 1630, '2026-10-09 15:57:10', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-000000000051', '33333333-1111-1111-1111-000000000046', NULL, '550e8400-e29b-41d4-a716-446655440112', 'NEUTRAL', 1670, '2026-10-09 15:57:50', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-000000000052', '33333333-1111-1111-1111-000000000046', '33333333-1111-1111-1111-000000000106', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 1700, '2026-10-09 15:58:20', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-000000000053', '33333333-1111-1111-1111-000000000046', NULL, '550e8400-e29b-41d4-a716-446655440122', 'OPPONENT', 1735, '2026-10-09 15:58:55', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-000000000054', '33333333-1111-1111-1111-000000000046', '33333333-1111-1111-1111-000000000115', '550e8400-e29b-41d4-a716-446655440116', 'OWN', 1765, '2026-10-09 15:59:25', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-000000000055', '33333333-1111-1111-1111-000000000046', NULL, '550e8400-e29b-41d4-a716-446655440111', 'NEUTRAL', 1800, '2026-10-09 16:00:00', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-000000000056', '33333333-1111-1111-1111-000000000046', NULL, '550e8400-e29b-41d4-a716-446655440122', 'OWN', 1830, '2026-10-09 16:00:30', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-000000000057', '33333333-1111-1111-1111-000000000046', NULL, '550e8400-e29b-41d4-a716-446655440104', 'OPPONENT', 1865, '2026-10-09 16:01:05', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-000000000058', '33333333-1111-1111-1111-000000000046', NULL, '550e8400-e29b-41d4-a716-446655440112', 'NEUTRAL', 1900, '2026-10-09 16:01:40', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-000000000059', '33333333-1111-1111-1111-000000000046', '33333333-1111-1111-1111-000000000107', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 1925, '2026-10-09 16:02:05', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-000000000060', '33333333-1111-1111-1111-000000000046', '33333333-1111-1111-1111-000000000105', '550e8400-e29b-41d4-a716-446655440123', 'OWN', 1955, '2026-10-09 16:02:35', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-000000000061', '33333333-1111-1111-1111-000000000046', '33333333-1111-1111-1111-000000000111', '550e8400-e29b-41d4-a716-446655440101', 'OWN', 1985, '2026-10-09 16:03:05', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-000000000062', '33333333-1111-1111-1111-000000000046', NULL, '550e8400-e29b-41d4-a716-446655440123', 'OPPONENT', 2020, '2026-10-09 16:03:40', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-000000000063', '33333333-1111-1111-1111-000000000046', '33333333-1111-1111-1111-000000000110', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 2050, '2026-10-09 16:04:10', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-000000000064', '33333333-1111-1111-1111-000000000046', '33333333-1111-1111-1111-000000000101', '550e8400-e29b-41d4-a716-446655440117', 'OWN', 2080, '2026-10-09 16:04:40', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-000000000065', '33333333-1111-1111-1111-000000000046', '33333333-1111-1111-1111-000000000112', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 2110, '2026-10-09 16:05:10', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-000000000066', '33333333-1111-1111-1111-000000000046', NULL, '550e8400-e29b-41d4-a716-446655440111', 'NEUTRAL', 2145, '2026-10-09 16:05:45', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-000000000067', '33333333-1111-1111-1111-000000000046', '33333333-1111-1111-1111-000000000104', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 2175, '2026-10-09 16:06:15', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-000000000068', '33333333-1111-1111-1111-000000000046', NULL, '550e8400-e29b-41d4-a716-446655440125', 'OPPONENT', 2205, '2026-10-09 16:06:45', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-000000000069', '33333333-1111-1111-1111-000000000046', NULL, '550e8400-e29b-41d4-a716-446655440112', 'NEUTRAL', 2235, '2026-10-09 16:07:15', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-000000000070', '33333333-1111-1111-1111-000000000046', '33333333-1111-1111-1111-000000000102', '550e8400-e29b-41d4-a716-446655440116', 'OWN', 2265, '2026-10-09 16:07:45', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-000000000071', '33333333-1111-1111-1111-000000000046', '33333333-1111-1111-1111-000000000108', '550e8400-e29b-41d4-a716-446655440117', 'OWN', 2295, '2026-10-09 16:08:15', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-000000000072', '33333333-1111-1111-1111-000000000046', NULL, '550e8400-e29b-41d4-a716-446655440122', 'OPPONENT', 2320, '2026-10-09 16:08:40', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-000000000073', '33333333-1111-1111-1111-000000000046', '33333333-1111-1111-1111-000000000111', '550e8400-e29b-41d4-a716-446655440104', 'OWN', 2350, '2026-10-09 16:09:10', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-000000000074', '33333333-1111-1111-1111-000000000046', '33333333-1111-1111-1111-000000000106', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 2375, '2026-10-09 16:09:35', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-000000000075', '33333333-1111-1111-1111-000000000046', '33333333-1111-1111-1111-000000000107', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 2395, '2026-10-09 16:09:55', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);


-- =========================================
-- ROSTERS (Jugadores Asignados a Partidos)
-- =========================================
INSERT INTO matches_players (id, role, division_id, match_id, slot_order, number, field_status, field_slot) VALUES
    ('55555555-5555-5555-5555-000000400000', 'TITULAR', '33333333-1111-1111-1111-000000000200', '33333333-1111-1111-1111-000000000040', 0, 1, 'EN_CANCHA', 1),
    ('55555555-5555-5555-5555-000000400001', 'TITULAR', '33333333-1111-1111-1111-000000000201', '33333333-1111-1111-1111-000000000040', 1, 2, 'EN_CANCHA', 2),
    ('55555555-5555-5555-5555-000000400002', 'TITULAR', '33333333-1111-1111-1111-000000000202', '33333333-1111-1111-1111-000000000040', 2, 3, 'EN_CANCHA', 3),
    ('55555555-5555-5555-5555-000000400003', 'TITULAR', '33333333-1111-1111-1111-000000000203', '33333333-1111-1111-1111-000000000040', 3, 4, 'EN_CANCHA', 4),
    ('55555555-5555-5555-5555-000000400004', 'TITULAR', '33333333-1111-1111-1111-000000000204', '33333333-1111-1111-1111-000000000040', 4, 5, 'EN_CANCHA', 5),
    ('55555555-5555-5555-5555-000000400005', 'TITULAR', '33333333-1111-1111-1111-000000000205', '33333333-1111-1111-1111-000000000040', 5, 6, 'EN_CANCHA', 6),
    ('55555555-5555-5555-5555-000000400006', 'TITULAR', '33333333-1111-1111-1111-000000000206', '33333333-1111-1111-1111-000000000040', 6, 7, 'EN_CANCHA', 7),
    ('55555555-5555-5555-5555-000000400007', 'TITULAR', '33333333-1111-1111-1111-000000000207', '33333333-1111-1111-1111-000000000040', 7, 8, 'EN_CANCHA', 8),
    ('55555555-5555-5555-5555-000000400008', 'TITULAR', '33333333-1111-1111-1111-000000000208', '33333333-1111-1111-1111-000000000040', 8, 9, 'EN_CANCHA', 9),
    ('55555555-5555-5555-5555-000000400009', 'TITULAR', '33333333-1111-1111-1111-000000000209', '33333333-1111-1111-1111-000000000040', 9, 10, 'EN_CANCHA', 10),
    ('55555555-5555-5555-5555-000000400010', 'TITULAR', '33333333-1111-1111-1111-000000000210', '33333333-1111-1111-1111-000000000040', 10, 11, 'EN_CANCHA', 11),
    ('55555555-5555-5555-5555-000000400011', 'TITULAR', '33333333-1111-1111-1111-000000000211', '33333333-1111-1111-1111-000000000040', 11, 12, 'EN_CANCHA', 12),
    ('55555555-5555-5555-5555-000000400012', 'TITULAR', '33333333-1111-1111-1111-000000000212', '33333333-1111-1111-1111-000000000040', 12, 13, 'EN_CANCHA', 13),
    ('55555555-5555-5555-5555-000000400013', 'TITULAR', '33333333-1111-1111-1111-000000000213', '33333333-1111-1111-1111-000000000040', 13, 14, 'EN_CANCHA', 14),
    ('55555555-5555-5555-5555-000000400014', 'TITULAR', '33333333-1111-1111-1111-000000000214', '33333333-1111-1111-1111-000000000040', 14, 15, 'EN_CANCHA', 15),
    ('55555555-5555-5555-5555-000000400015', 'SUPLENTE', '33333333-1111-1111-1111-000000000215', '33333333-1111-1111-1111-000000000040', 0, 16, 'EN_BANCO', NULL),
    ('55555555-5555-5555-5555-000000400016', 'SUPLENTE', '33333333-1111-1111-1111-000000000216', '33333333-1111-1111-1111-000000000040', 1, 17, 'EN_BANCO', NULL),
    ('55555555-5555-5555-5555-000000400017', 'SUPLENTE', '33333333-1111-1111-1111-000000000217', '33333333-1111-1111-1111-000000000040', 2, 18, 'EN_BANCO', NULL),
    ('55555555-5555-5555-5555-000000400018', 'SUPLENTE', '33333333-1111-1111-1111-000000000218', '33333333-1111-1111-1111-000000000040', 3, 19, 'EN_BANCO', NULL),
    ('55555555-5555-5555-5555-000000400019', 'SUPLENTE', '33333333-1111-1111-1111-000000000219', '33333333-1111-1111-1111-000000000040', 4, 20, 'EN_BANCO', NULL),
    ('55555555-5555-5555-5555-000000400020', 'SUPLENTE', '33333333-1111-1111-1111-000000000220', '33333333-1111-1111-1111-000000000040', 5, 21, 'EN_BANCO', NULL),
    ('55555555-5555-5555-5555-000000400021', 'SUPLENTE', '33333333-1111-1111-1111-000000000221', '33333333-1111-1111-1111-000000000040', 6, 22, 'EN_BANCO', NULL),
    ('55555555-5555-5555-5555-000000400022', 'SUPLENTE', '33333333-1111-1111-1111-000000000222', '33333333-1111-1111-1111-000000000040', 7, 23, 'EN_BANCO', NULL),
    ('55555555-5555-5555-5555-000000430000', 'TITULAR', '33333333-1111-1111-1111-000000000200', '33333333-1111-1111-1111-000000000043', 0, 1, 'EN_CANCHA', 1),
    ('55555555-5555-5555-5555-000000430001', 'TITULAR', '33333333-1111-1111-1111-000000000201', '33333333-1111-1111-1111-000000000043', 1, 2, 'EN_CANCHA', 2),
    ('55555555-5555-5555-5555-000000430002', 'TITULAR', '33333333-1111-1111-1111-000000000202', '33333333-1111-1111-1111-000000000043', 2, 3, 'EN_CANCHA', 3),
    ('55555555-5555-5555-5555-000000430003', 'TITULAR', '33333333-1111-1111-1111-000000000203', '33333333-1111-1111-1111-000000000043', 3, 4, 'EN_CANCHA', 4),
    ('55555555-5555-5555-5555-000000430004', 'TITULAR', '33333333-1111-1111-1111-000000000204', '33333333-1111-1111-1111-000000000043', 4, 5, 'EN_CANCHA', 5),
    ('55555555-5555-5555-5555-000000430005', 'TITULAR', '33333333-1111-1111-1111-000000000205', '33333333-1111-1111-1111-000000000043', 5, 6, 'EN_CANCHA', 6),
    ('55555555-5555-5555-5555-000000430006', 'TITULAR', '33333333-1111-1111-1111-000000000206', '33333333-1111-1111-1111-000000000043', 6, 7, 'EN_CANCHA', 7),
    ('55555555-5555-5555-5555-000000430007', 'TITULAR', '33333333-1111-1111-1111-000000000207', '33333333-1111-1111-1111-000000000043', 7, 8, 'EN_CANCHA', 8),
    ('55555555-5555-5555-5555-000000430008', 'TITULAR', '33333333-1111-1111-1111-000000000208', '33333333-1111-1111-1111-000000000043', 8, 9, 'EN_CANCHA', 9),
    ('55555555-5555-5555-5555-000000430009', 'TITULAR', '33333333-1111-1111-1111-000000000209', '33333333-1111-1111-1111-000000000043', 9, 10, 'EN_CANCHA', 10),
    ('55555555-5555-5555-5555-000000430010', 'TITULAR', '33333333-1111-1111-1111-000000000210', '33333333-1111-1111-1111-000000000043', 10, 11, 'EN_CANCHA', 11),
    ('55555555-5555-5555-5555-000000430011', 'TITULAR', '33333333-1111-1111-1111-000000000211', '33333333-1111-1111-1111-000000000043', 11, 12, 'EN_CANCHA', 12),
    ('55555555-5555-5555-5555-000000430012', 'TITULAR', '33333333-1111-1111-1111-000000000212', '33333333-1111-1111-1111-000000000043', 12, 13, 'EN_CANCHA', 13),
    ('55555555-5555-5555-5555-000000430013', 'TITULAR', '33333333-1111-1111-1111-000000000213', '33333333-1111-1111-1111-000000000043', 13, 14, 'EN_CANCHA', 14),
    ('55555555-5555-5555-5555-000000430014', 'TITULAR', '33333333-1111-1111-1111-000000000214', '33333333-1111-1111-1111-000000000043', 14, 15, 'EN_CANCHA', 15),
    ('55555555-5555-5555-5555-000000430015', 'SUPLENTE', '33333333-1111-1111-1111-000000000215', '33333333-1111-1111-1111-000000000043', 0, 16, 'EN_BANCO', NULL),
    ('55555555-5555-5555-5555-000000430016', 'SUPLENTE', '33333333-1111-1111-1111-000000000216', '33333333-1111-1111-1111-000000000043', 1, 17, 'EN_BANCO', NULL),
    ('55555555-5555-5555-5555-000000430017', 'SUPLENTE', '33333333-1111-1111-1111-000000000217', '33333333-1111-1111-1111-000000000043', 2, 18, 'EN_BANCO', NULL),
    ('55555555-5555-5555-5555-000000430018', 'SUPLENTE', '33333333-1111-1111-1111-000000000218', '33333333-1111-1111-1111-000000000043', 3, 19, 'EN_BANCO', NULL),
    ('55555555-5555-5555-5555-000000430019', 'SUPLENTE', '33333333-1111-1111-1111-000000000219', '33333333-1111-1111-1111-000000000043', 4, 20, 'EN_BANCO', NULL),
    ('55555555-5555-5555-5555-000000430020', 'SUPLENTE', '33333333-1111-1111-1111-000000000220', '33333333-1111-1111-1111-000000000043', 5, 21, 'EN_BANCO', NULL),
    ('55555555-5555-5555-5555-000000430021', 'SUPLENTE', '33333333-1111-1111-1111-000000000221', '33333333-1111-1111-1111-000000000043', 6, 22, 'EN_BANCO', NULL),
    ('55555555-5555-5555-5555-000000430022', 'SUPLENTE', '33333333-1111-1111-1111-000000000222', '33333333-1111-1111-1111-000000000043', 7, 23, 'EN_BANCO', NULL),
    ('55555555-5555-5555-5555-000000410000', 'TITULAR', '33333333-1111-1111-1111-000000000200', '33333333-1111-1111-1111-000000000041', 0, 1, 'EN_CANCHA', 1),
    ('55555555-5555-5555-5555-000000410001', 'TITULAR', '33333333-1111-1111-1111-000000000201', '33333333-1111-1111-1111-000000000041', 1, 2, 'EN_CANCHA', 2),
    ('55555555-5555-5555-5555-000000410002', 'TITULAR', '33333333-1111-1111-1111-000000000202', '33333333-1111-1111-1111-000000000041', 2, 3, 'EN_CANCHA', 3),
    ('55555555-5555-5555-5555-000000410003', 'TITULAR', '33333333-1111-1111-1111-000000000203', '33333333-1111-1111-1111-000000000041', 3, 4, 'EN_CANCHA', 4),
    ('55555555-5555-5555-5555-000000410004', 'TITULAR', '33333333-1111-1111-1111-000000000204', '33333333-1111-1111-1111-000000000041', 4, 5, 'EN_CANCHA', 5),
    ('55555555-5555-5555-5555-000000410005', 'TITULAR', '33333333-1111-1111-1111-000000000205', '33333333-1111-1111-1111-000000000041', 5, 6, 'EN_CANCHA', 6),
    ('55555555-5555-5555-5555-000000410006', 'TITULAR', '33333333-1111-1111-1111-000000000206', '33333333-1111-1111-1111-000000000041', 6, 7, 'EN_CANCHA', 7),
    ('55555555-5555-5555-5555-000000410007', 'TITULAR', '33333333-1111-1111-1111-000000000207', '33333333-1111-1111-1111-000000000041', 7, 8, 'EN_CANCHA', 8),
    ('55555555-5555-5555-5555-000000410008', 'TITULAR', '33333333-1111-1111-1111-000000000208', '33333333-1111-1111-1111-000000000041', 8, 9, 'EN_CANCHA', 9),
    ('55555555-5555-5555-5555-000000410009', 'TITULAR', '33333333-1111-1111-1111-000000000209', '33333333-1111-1111-1111-000000000041', 9, 10, 'EN_CANCHA', 10),
    ('55555555-5555-5555-5555-000000410010', 'TITULAR', '33333333-1111-1111-1111-000000000210', '33333333-1111-1111-1111-000000000041', 10, 11, 'EN_CANCHA', 11),
    ('55555555-5555-5555-5555-000000410011', 'TITULAR', '33333333-1111-1111-1111-000000000211', '33333333-1111-1111-1111-000000000041', 11, 12, 'EN_CANCHA', 12),
    ('55555555-5555-5555-5555-000000410012', 'TITULAR', '33333333-1111-1111-1111-000000000212', '33333333-1111-1111-1111-000000000041', 12, 13, 'EN_CANCHA', 13),
    ('55555555-5555-5555-5555-000000410013', 'TITULAR', '33333333-1111-1111-1111-000000000213', '33333333-1111-1111-1111-000000000041', 13, 14, 'EN_CANCHA', 14),
    ('55555555-5555-5555-5555-000000410014', 'TITULAR', '33333333-1111-1111-1111-000000000214', '33333333-1111-1111-1111-000000000041', 14, 15, 'EN_CANCHA', 15),
    ('55555555-5555-5555-5555-000000410015', 'SUPLENTE', '33333333-1111-1111-1111-000000000215', '33333333-1111-1111-1111-000000000041', 0, 16, 'EN_BANCO', NULL),
    ('55555555-5555-5555-5555-000000410016', 'SUPLENTE', '33333333-1111-1111-1111-000000000216', '33333333-1111-1111-1111-000000000041', 1, 17, 'EN_BANCO', NULL),
    ('55555555-5555-5555-5555-000000410017', 'SUPLENTE', '33333333-1111-1111-1111-000000000217', '33333333-1111-1111-1111-000000000041', 2, 18, 'EN_BANCO', NULL),
    ('55555555-5555-5555-5555-000000410018', 'SUPLENTE', '33333333-1111-1111-1111-000000000218', '33333333-1111-1111-1111-000000000041', 3, 19, 'EN_BANCO', NULL),
    ('55555555-5555-5555-5555-000000410019', 'SUPLENTE', '33333333-1111-1111-1111-000000000219', '33333333-1111-1111-1111-000000000041', 4, 20, 'EN_BANCO', NULL),
    ('55555555-5555-5555-5555-000000410020', 'SUPLENTE', '33333333-1111-1111-1111-000000000220', '33333333-1111-1111-1111-000000000041', 5, 21, 'EN_BANCO', NULL),
    ('55555555-5555-5555-5555-000000410021', 'SUPLENTE', '33333333-1111-1111-1111-000000000221', '33333333-1111-1111-1111-000000000041', 6, 22, 'EN_BANCO', NULL),
    ('55555555-5555-5555-5555-000000410022', 'SUPLENTE', '33333333-1111-1111-1111-000000000222', '33333333-1111-1111-1111-000000000041', 7, 23, 'EN_BANCO', NULL),
    ('55555555-5555-5555-5555-000000420000', 'TITULAR', '33333333-1111-1111-1111-000000000200', '33333333-1111-1111-1111-000000000042', 0, 1, 'EN_CANCHA', 1),
    ('55555555-5555-5555-5555-000000420001', 'TITULAR', '33333333-1111-1111-1111-000000000201', '33333333-1111-1111-1111-000000000042', 1, 2, 'EN_CANCHA', 2),
    ('55555555-5555-5555-5555-000000420002', 'TITULAR', '33333333-1111-1111-1111-000000000202', '33333333-1111-1111-1111-000000000042', 2, 3, 'EN_CANCHA', 3),
    ('55555555-5555-5555-5555-000000420003', 'TITULAR', '33333333-1111-1111-1111-000000000203', '33333333-1111-1111-1111-000000000042', 3, 4, 'EN_CANCHA', 4),
    ('55555555-5555-5555-5555-000000420004', 'TITULAR', '33333333-1111-1111-1111-000000000204', '33333333-1111-1111-1111-000000000042', 4, 5, 'EN_CANCHA', 5),
    ('55555555-5555-5555-5555-000000420005', 'TITULAR', '33333333-1111-1111-1111-000000000205', '33333333-1111-1111-1111-000000000042', 5, 6, 'EN_CANCHA', 6),
    ('55555555-5555-5555-5555-000000420006', 'TITULAR', '33333333-1111-1111-1111-000000000206', '33333333-1111-1111-1111-000000000042', 6, 7, 'EN_CANCHA', 7),
    ('55555555-5555-5555-5555-000000420007', 'TITULAR', '33333333-1111-1111-1111-000000000207', '33333333-1111-1111-1111-000000000042', 7, 8, 'EN_CANCHA', 8),
    ('55555555-5555-5555-5555-000000420008', 'TITULAR', '33333333-1111-1111-1111-000000000208', '33333333-1111-1111-1111-000000000042', 8, 9, 'EN_CANCHA', 9),
    ('55555555-5555-5555-5555-000000420009', 'TITULAR', '33333333-1111-1111-1111-000000000209', '33333333-1111-1111-1111-000000000042', 9, 10, 'EN_CANCHA', 10),
    ('55555555-5555-5555-5555-000000420010', 'TITULAR', '33333333-1111-1111-1111-000000000210', '33333333-1111-1111-1111-000000000042', 10, 11, 'EN_CANCHA', 11),
    ('55555555-5555-5555-5555-000000420011', 'TITULAR', '33333333-1111-1111-1111-000000000211', '33333333-1111-1111-1111-000000000042', 11, 12, 'EN_CANCHA', 12),
    ('55555555-5555-5555-5555-000000420012', 'TITULAR', '33333333-1111-1111-1111-000000000212', '33333333-1111-1111-1111-000000000042', 12, 13, 'EN_CANCHA', 13),
    ('55555555-5555-5555-5555-000000420013', 'TITULAR', '33333333-1111-1111-1111-000000000213', '33333333-1111-1111-1111-000000000042', 13, 14, 'EN_CANCHA', 14),
    ('55555555-5555-5555-5555-000000420014', 'TITULAR', '33333333-1111-1111-1111-000000000214', '33333333-1111-1111-1111-000000000042', 14, 15, 'EN_CANCHA', 15),
    ('55555555-5555-5555-5555-000000420015', 'SUPLENTE', '33333333-1111-1111-1111-000000000215', '33333333-1111-1111-1111-000000000042', 0, 16, 'EN_BANCO', NULL),
    ('55555555-5555-5555-5555-000000420016', 'SUPLENTE', '33333333-1111-1111-1111-000000000216', '33333333-1111-1111-1111-000000000042', 1, 17, 'EN_BANCO', NULL),
    ('55555555-5555-5555-5555-000000420017', 'SUPLENTE', '33333333-1111-1111-1111-000000000217', '33333333-1111-1111-1111-000000000042', 2, 18, 'EN_BANCO', NULL),
    ('55555555-5555-5555-5555-000000420018', 'SUPLENTE', '33333333-1111-1111-1111-000000000218', '33333333-1111-1111-1111-000000000042', 3, 19, 'EN_BANCO', NULL),
    ('55555555-5555-5555-5555-000000420019', 'SUPLENTE', '33333333-1111-1111-1111-000000000219', '33333333-1111-1111-1111-000000000042', 4, 20, 'EN_BANCO', NULL),
    ('55555555-5555-5555-5555-000000420020', 'SUPLENTE', '33333333-1111-1111-1111-000000000220', '33333333-1111-1111-1111-000000000042', 5, 21, 'EN_BANCO', NULL),
    ('55555555-5555-5555-5555-000000420021', 'SUPLENTE', '33333333-1111-1111-1111-000000000221', '33333333-1111-1111-1111-000000000042', 6, 22, 'EN_BANCO', NULL),
    ('55555555-5555-5555-5555-000000420022', 'SUPLENTE', '33333333-1111-1111-1111-000000000222', '33333333-1111-1111-1111-000000000042', 7, 23, 'EN_BANCO', NULL),
    ('55555555-5555-5555-5555-000000440000', 'TITULAR', '33333333-1111-1111-1111-000000000200', '33333333-1111-1111-1111-000000000044', 0, 1, 'EN_CANCHA', 1),
    ('55555555-5555-5555-5555-000000440001', 'TITULAR', '33333333-1111-1111-1111-000000000201', '33333333-1111-1111-1111-000000000044', 1, 2, 'EN_CANCHA', 2),
    ('55555555-5555-5555-5555-000000440002', 'TITULAR', '33333333-1111-1111-1111-000000000202', '33333333-1111-1111-1111-000000000044', 2, 3, 'EN_CANCHA', 3),
    ('55555555-5555-5555-5555-000000440003', 'TITULAR', '33333333-1111-1111-1111-000000000203', '33333333-1111-1111-1111-000000000044', 3, 4, 'EN_CANCHA', 4),
    ('55555555-5555-5555-5555-000000440004', 'TITULAR', '33333333-1111-1111-1111-000000000204', '33333333-1111-1111-1111-000000000044', 4, 5, 'EN_CANCHA', 5),
    ('55555555-5555-5555-5555-000000440005', 'TITULAR', '33333333-1111-1111-1111-000000000205', '33333333-1111-1111-1111-000000000044', 5, 6, 'EN_CANCHA', 6),
    ('55555555-5555-5555-5555-000000440006', 'TITULAR', '33333333-1111-1111-1111-000000000206', '33333333-1111-1111-1111-000000000044', 6, 7, 'EN_CANCHA', 7),
    ('55555555-5555-5555-5555-000000440007', 'TITULAR', '33333333-1111-1111-1111-000000000207', '33333333-1111-1111-1111-000000000044', 7, 8, 'EN_CANCHA', 8),
    ('55555555-5555-5555-5555-000000440008', 'TITULAR', '33333333-1111-1111-1111-000000000208', '33333333-1111-1111-1111-000000000044', 8, 9, 'EN_CANCHA', 9),
    ('55555555-5555-5555-5555-000000440009', 'TITULAR', '33333333-1111-1111-1111-000000000209', '33333333-1111-1111-1111-000000000044', 9, 10, 'EN_CANCHA', 10),
    ('55555555-5555-5555-5555-000000440010', 'TITULAR', '33333333-1111-1111-1111-000000000210', '33333333-1111-1111-1111-000000000044', 10, 11, 'EN_CANCHA', 11),
    ('55555555-5555-5555-5555-000000440011', 'TITULAR', '33333333-1111-1111-1111-000000000211', '33333333-1111-1111-1111-000000000044', 11, 12, 'EN_CANCHA', 12),
    ('55555555-5555-5555-5555-000000440012', 'TITULAR', '33333333-1111-1111-1111-000000000212', '33333333-1111-1111-1111-000000000044', 12, 13, 'EN_CANCHA', 13),
    ('55555555-5555-5555-5555-000000440013', 'TITULAR', '33333333-1111-1111-1111-000000000213', '33333333-1111-1111-1111-000000000044', 13, 14, 'EN_CANCHA', 14),
    ('55555555-5555-5555-5555-000000440014', 'TITULAR', '33333333-1111-1111-1111-000000000214', '33333333-1111-1111-1111-000000000044', 14, 15, 'EN_CANCHA', 15),
    ('55555555-5555-5555-5555-000000440015', 'SUPLENTE', '33333333-1111-1111-1111-000000000215', '33333333-1111-1111-1111-000000000044', 0, 16, 'EN_BANCO', NULL),
    ('55555555-5555-5555-5555-000000440016', 'SUPLENTE', '33333333-1111-1111-1111-000000000216', '33333333-1111-1111-1111-000000000044', 1, 17, 'EN_BANCO', NULL),
    ('55555555-5555-5555-5555-000000440017', 'SUPLENTE', '33333333-1111-1111-1111-000000000217', '33333333-1111-1111-1111-000000000044', 2, 18, 'EN_BANCO', NULL),
    ('55555555-5555-5555-5555-000000440018', 'SUPLENTE', '33333333-1111-1111-1111-000000000218', '33333333-1111-1111-1111-000000000044', 3, 19, 'EN_BANCO', NULL),
    ('55555555-5555-5555-5555-000000440019', 'SUPLENTE', '33333333-1111-1111-1111-000000000219', '33333333-1111-1111-1111-000000000044', 4, 20, 'EN_BANCO', NULL),
    ('55555555-5555-5555-5555-000000440020', 'SUPLENTE', '33333333-1111-1111-1111-000000000220', '33333333-1111-1111-1111-000000000044', 5, 21, 'EN_BANCO', NULL),
    ('55555555-5555-5555-5555-000000440021', 'SUPLENTE', '33333333-1111-1111-1111-000000000221', '33333333-1111-1111-1111-000000000044', 6, 22, 'EN_BANCO', NULL),
    ('55555555-5555-5555-5555-000000440022', 'SUPLENTE', '33333333-1111-1111-1111-000000000222', '33333333-1111-1111-1111-000000000044', 7, 23, 'EN_BANCO', NULL),
    ('55555555-5555-5555-5555-000000450000', 'TITULAR', '33333333-1111-1111-1111-000000000200', '33333333-1111-1111-1111-000000000045', 0, 1, 'EN_CANCHA', 1),
    ('55555555-5555-5555-5555-000000450001', 'TITULAR', '33333333-1111-1111-1111-000000000201', '33333333-1111-1111-1111-000000000045', 1, 2, 'EN_CANCHA', 2),
    ('55555555-5555-5555-5555-000000450002', 'TITULAR', '33333333-1111-1111-1111-000000000202', '33333333-1111-1111-1111-000000000045', 2, 3, 'EN_CANCHA', 3),
    ('55555555-5555-5555-5555-000000450003', 'TITULAR', '33333333-1111-1111-1111-000000000203', '33333333-1111-1111-1111-000000000045', 3, 4, 'EN_CANCHA', 4),
    ('55555555-5555-5555-5555-000000450004', 'TITULAR', '33333333-1111-1111-1111-000000000204', '33333333-1111-1111-1111-000000000045', 4, 5, 'EN_CANCHA', 5),
    ('55555555-5555-5555-5555-000000450005', 'TITULAR', '33333333-1111-1111-1111-000000000205', '33333333-1111-1111-1111-000000000045', 5, 6, 'EN_CANCHA', 6),
    ('55555555-5555-5555-5555-000000450006', 'TITULAR', '33333333-1111-1111-1111-000000000206', '33333333-1111-1111-1111-000000000045', 6, 7, 'EN_CANCHA', 7),
    ('55555555-5555-5555-5555-000000450007', 'TITULAR', '33333333-1111-1111-1111-000000000207', '33333333-1111-1111-1111-000000000045', 7, 8, 'EN_CANCHA', 8),
    ('55555555-5555-5555-5555-000000450008', 'TITULAR', '33333333-1111-1111-1111-000000000208', '33333333-1111-1111-1111-000000000045', 8, 9, 'EN_CANCHA', 9),
    ('55555555-5555-5555-5555-000000450009', 'TITULAR', '33333333-1111-1111-1111-000000000209', '33333333-1111-1111-1111-000000000045', 9, 10, 'EN_CANCHA', 10),
    ('55555555-5555-5555-5555-000000450010', 'TITULAR', '33333333-1111-1111-1111-000000000210', '33333333-1111-1111-1111-000000000045', 10, 11, 'EN_CANCHA', 11),
    ('55555555-5555-5555-5555-000000450011', 'TITULAR', '33333333-1111-1111-1111-000000000211', '33333333-1111-1111-1111-000000000045', 11, 12, 'EN_CANCHA', 12),
    ('55555555-5555-5555-5555-000000450012', 'TITULAR', '33333333-1111-1111-1111-000000000212', '33333333-1111-1111-1111-000000000045', 12, 13, 'EN_CANCHA', 13),
    ('55555555-5555-5555-5555-000000450013', 'TITULAR', '33333333-1111-1111-1111-000000000213', '33333333-1111-1111-1111-000000000045', 13, 14, 'EN_CANCHA', 14),
    ('55555555-5555-5555-5555-000000450014', 'TITULAR', '33333333-1111-1111-1111-000000000214', '33333333-1111-1111-1111-000000000045', 14, 15, 'EN_CANCHA', 15),
    ('55555555-5555-5555-5555-000000450015', 'SUPLENTE', '33333333-1111-1111-1111-000000000215', '33333333-1111-1111-1111-000000000045', 0, 16, 'EN_BANCO', NULL),
    ('55555555-5555-5555-5555-000000450016', 'SUPLENTE', '33333333-1111-1111-1111-000000000216', '33333333-1111-1111-1111-000000000045', 1, 17, 'EN_BANCO', NULL),
    ('55555555-5555-5555-5555-000000450017', 'SUPLENTE', '33333333-1111-1111-1111-000000000217', '33333333-1111-1111-1111-000000000045', 2, 18, 'EN_BANCO', NULL),
    ('55555555-5555-5555-5555-000000450018', 'SUPLENTE', '33333333-1111-1111-1111-000000000218', '33333333-1111-1111-1111-000000000045', 3, 19, 'EN_BANCO', NULL),
    ('55555555-5555-5555-5555-000000450019', 'SUPLENTE', '33333333-1111-1111-1111-000000000219', '33333333-1111-1111-1111-000000000045', 4, 20, 'EN_BANCO', NULL),
    ('55555555-5555-5555-5555-000000450020', 'SUPLENTE', '33333333-1111-1111-1111-000000000220', '33333333-1111-1111-1111-000000000045', 5, 21, 'EN_BANCO', NULL),
    ('55555555-5555-5555-5555-000000450021', 'SUPLENTE', '33333333-1111-1111-1111-000000000221', '33333333-1111-1111-1111-000000000045', 6, 22, 'EN_BANCO', NULL),
    ('55555555-5555-5555-5555-000000450022', 'SUPLENTE', '33333333-1111-1111-1111-000000000222', '33333333-1111-1111-1111-000000000045', 7, 23, 'EN_BANCO', NULL),
    ('55555555-5555-5555-5555-000000460000', 'TITULAR', '33333333-1111-1111-1111-000000000200', '33333333-1111-1111-1111-000000000046', 0, 1, 'EN_CANCHA', 1),
    ('55555555-5555-5555-5555-000000460001', 'TITULAR', '33333333-1111-1111-1111-000000000201', '33333333-1111-1111-1111-000000000046', 1, 2, 'EN_CANCHA', 2),
    ('55555555-5555-5555-5555-000000460002', 'TITULAR', '33333333-1111-1111-1111-000000000202', '33333333-1111-1111-1111-000000000046', 2, 3, 'EN_CANCHA', 3),
    ('55555555-5555-5555-5555-000000460003', 'TITULAR', '33333333-1111-1111-1111-000000000203', '33333333-1111-1111-1111-000000000046', 3, 4, 'EN_CANCHA', 4),
    ('55555555-5555-5555-5555-000000460004', 'TITULAR', '33333333-1111-1111-1111-000000000204', '33333333-1111-1111-1111-000000000046', 4, 5, 'EN_CANCHA', 5),
    ('55555555-5555-5555-5555-000000460005', 'TITULAR', '33333333-1111-1111-1111-000000000205', '33333333-1111-1111-1111-000000000046', 5, 6, 'EN_CANCHA', 6),
    ('55555555-5555-5555-5555-000000460006', 'TITULAR', '33333333-1111-1111-1111-000000000206', '33333333-1111-1111-1111-000000000046', 6, 7, 'EN_CANCHA', 7),
    ('55555555-5555-5555-5555-000000460007', 'TITULAR', '33333333-1111-1111-1111-000000000207', '33333333-1111-1111-1111-000000000046', 7, 8, 'EN_CANCHA', 8),
    ('55555555-5555-5555-5555-000000460008', 'TITULAR', '33333333-1111-1111-1111-000000000208', '33333333-1111-1111-1111-000000000046', 8, 9, 'EN_CANCHA', 9),
    ('55555555-5555-5555-5555-000000460009', 'TITULAR', '33333333-1111-1111-1111-000000000209', '33333333-1111-1111-1111-000000000046', 9, 10, 'EN_CANCHA', 10),
    ('55555555-5555-5555-5555-000000460010', 'TITULAR', '33333333-1111-1111-1111-000000000210', '33333333-1111-1111-1111-000000000046', 10, 11, 'EN_CANCHA', 11),
    ('55555555-5555-5555-5555-000000460011', 'TITULAR', '33333333-1111-1111-1111-000000000211', '33333333-1111-1111-1111-000000000046', 11, 12, 'EN_CANCHA', 12),
    ('55555555-5555-5555-5555-000000460012', 'TITULAR', '33333333-1111-1111-1111-000000000212', '33333333-1111-1111-1111-000000000046', 12, 13, 'EN_CANCHA', 13),
    ('55555555-5555-5555-5555-000000460013', 'TITULAR', '33333333-1111-1111-1111-000000000213', '33333333-1111-1111-1111-000000000046', 13, 14, 'EN_CANCHA', 14),
    ('55555555-5555-5555-5555-000000460014', 'TITULAR', '33333333-1111-1111-1111-000000000214', '33333333-1111-1111-1111-000000000046', 14, 15, 'EN_CANCHA', 15),
    ('55555555-5555-5555-5555-000000460015', 'SUPLENTE', '33333333-1111-1111-1111-000000000215', '33333333-1111-1111-1111-000000000046', 0, 16, 'EN_BANCO', NULL),
    ('55555555-5555-5555-5555-000000460016', 'SUPLENTE', '33333333-1111-1111-1111-000000000216', '33333333-1111-1111-1111-000000000046', 1, 17, 'EN_BANCO', NULL),
    ('55555555-5555-5555-5555-000000460017', 'SUPLENTE', '33333333-1111-1111-1111-000000000217', '33333333-1111-1111-1111-000000000046', 2, 18, 'EN_BANCO', NULL),
    ('55555555-5555-5555-5555-000000460018', 'SUPLENTE', '33333333-1111-1111-1111-000000000218', '33333333-1111-1111-1111-000000000046', 3, 19, 'EN_BANCO', NULL),
    ('55555555-5555-5555-5555-000000460019', 'SUPLENTE', '33333333-1111-1111-1111-000000000219', '33333333-1111-1111-1111-000000000046', 4, 20, 'EN_BANCO', NULL),
    ('55555555-5555-5555-5555-000000460020', 'SUPLENTE', '33333333-1111-1111-1111-000000000220', '33333333-1111-1111-1111-000000000046', 5, 21, 'EN_BANCO', NULL),
    ('55555555-5555-5555-5555-000000460021', 'SUPLENTE', '33333333-1111-1111-1111-000000000221', '33333333-1111-1111-1111-000000000046', 6, 22, 'EN_BANCO', NULL),
    ('55555555-5555-5555-5555-000000460022', 'SUPLENTE', '33333333-1111-1111-1111-000000000222', '33333333-1111-1111-1111-000000000046', 7, 23, 'EN_BANCO', NULL);

-- =========================================
-- DEMO EVENTS (Nuevos)
-- =========================================
INSERT INTO events (id, match_id, player_id, event_type_id, team_possession, match_time, real_time, period, origin, active, created_at, synchronized_at) VALUES
    ('44444444-4444-4444-4444-000000005000', '33333333-1111-1111-1111-000000000040', '33333333-1111-1111-1111-000000000112', '550e8400-e29b-41d4-a716-446655440112', 'OWN', 0, '2026-10-15 15:30:00', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005001', '33333333-1111-1111-1111-000000000040', NULL, '550e8400-e29b-41d4-a716-446655440116', 'OPPONENT', 40, '2026-10-15 15:30:40', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005002', '33333333-1111-1111-1111-000000000040', NULL, '550e8400-e29b-41d4-a716-446655440117', 'OPPONENT', 80, '2026-10-15 15:31:20', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005003', '33333333-1111-1111-1111-000000000040', '33333333-1111-1111-1111-000000000107', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 120, '2026-10-15 15:32:00', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005004', '33333333-1111-1111-1111-000000000040', NULL, '550e8400-e29b-41d4-a716-446655440115', 'OPPONENT', 160, '2026-10-15 15:32:40', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005005', '33333333-1111-1111-1111-000000000040', NULL, '550e8400-e29b-41d4-a716-446655440115', 'OPPONENT', 200, '2026-10-15 15:33:20', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005006', '33333333-1111-1111-1111-000000000040', '33333333-1111-1111-1111-000000000103', '550e8400-e29b-41d4-a716-446655440112', 'OWN', 240, '2026-10-15 15:34:00', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005007', '33333333-1111-1111-1111-000000000040', NULL, '550e8400-e29b-41d4-a716-446655440117', 'OPPONENT', 280, '2026-10-15 15:34:40', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005008', '33333333-1111-1111-1111-000000000040', NULL, '550e8400-e29b-41d4-a716-446655440117', 'OPPONENT', 320, '2026-10-15 15:35:20', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005009', '33333333-1111-1111-1111-000000000040', NULL, '550e8400-e29b-41d4-a716-446655440116', 'OPPONENT', 360, '2026-10-15 15:36:00', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005010', '33333333-1111-1111-1111-000000000040', '33333333-1111-1111-1111-000000000111', '550e8400-e29b-41d4-a716-446655440112', 'OWN', 400, '2026-10-15 15:36:40', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005011', '33333333-1111-1111-1111-000000000040', NULL, '550e8400-e29b-41d4-a716-446655440112', 'OPPONENT', 440, '2026-10-15 15:37:20', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005012', '33333333-1111-1111-1111-000000000040', NULL, '550e8400-e29b-41d4-a716-446655440116', 'OPPONENT', 480, '2026-10-15 15:38:00', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005013', '33333333-1111-1111-1111-000000000040', '33333333-1111-1111-1111-000000000111', '550e8400-e29b-41d4-a716-446655440116', 'OWN', 520, '2026-10-15 15:38:40', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005014', '33333333-1111-1111-1111-000000000040', '33333333-1111-1111-1111-000000000106', '550e8400-e29b-41d4-a716-446655440116', 'OWN', 560, '2026-10-15 15:39:20', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005015', '33333333-1111-1111-1111-000000000040', NULL, '550e8400-e29b-41d4-a716-446655440116', 'OPPONENT', 600, '2026-10-15 15:40:00', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005016', '33333333-1111-1111-1111-000000000040', '33333333-1111-1111-1111-000000000112', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 640, '2026-10-15 15:40:40', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005017', '33333333-1111-1111-1111-000000000040', NULL, '550e8400-e29b-41d4-a716-446655440101', 'OPPONENT', 680, '2026-10-15 15:41:20', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005018', '33333333-1111-1111-1111-000000000040', '33333333-1111-1111-1111-000000000103', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 720, '2026-10-15 15:42:00', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005019', '33333333-1111-1111-1111-000000000040', NULL, '550e8400-e29b-41d4-a716-446655440117', 'OPPONENT', 760, '2026-10-15 15:42:40', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005020', '33333333-1111-1111-1111-000000000040', '33333333-1111-1111-1111-000000000115', '550e8400-e29b-41d4-a716-446655440117', 'OWN', 800, '2026-10-15 15:43:20', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005021', '33333333-1111-1111-1111-000000000040', NULL, '550e8400-e29b-41d4-a716-446655440101', 'OPPONENT', 840, '2026-10-15 15:44:00', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005022', '33333333-1111-1111-1111-000000000040', NULL, '550e8400-e29b-41d4-a716-446655440115', 'OPPONENT', 880, '2026-10-15 15:44:40', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005023', '33333333-1111-1111-1111-000000000040', NULL, '550e8400-e29b-41d4-a716-446655440112', 'OPPONENT', 920, '2026-10-15 15:45:20', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005024', '33333333-1111-1111-1111-000000000040', NULL, '550e8400-e29b-41d4-a716-446655440112', 'OPPONENT', 960, '2026-10-15 15:46:00', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005025', '33333333-1111-1111-1111-000000000040', '33333333-1111-1111-1111-000000000109', '550e8400-e29b-41d4-a716-446655440112', 'OWN', 1000, '2026-10-15 15:46:40', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005026', '33333333-1111-1111-1111-000000000040', '33333333-1111-1111-1111-000000000110', '550e8400-e29b-41d4-a716-446655440101', 'OWN', 1040, '2026-10-15 15:47:20', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005027', '33333333-1111-1111-1111-000000000040', '33333333-1111-1111-1111-000000000105', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 1080, '2026-10-15 15:48:00', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005028', '33333333-1111-1111-1111-000000000040', '33333333-1111-1111-1111-000000000101', '550e8400-e29b-41d4-a716-446655440101', 'OWN', 1120, '2026-10-15 15:48:40', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005029', '33333333-1111-1111-1111-000000000040', '33333333-1111-1111-1111-000000000105', '550e8400-e29b-41d4-a716-446655440101', 'OWN', 1160, '2026-10-15 15:49:20', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005030', '33333333-1111-1111-1111-000000000040', '33333333-1111-1111-1111-000000000110', '550e8400-e29b-41d4-a716-446655440112', 'OWN', 1200, '2026-10-15 15:50:00', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005031', '33333333-1111-1111-1111-000000000040', '33333333-1111-1111-1111-000000000101', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 1240, '2026-10-15 15:50:40', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005032', '33333333-1111-1111-1111-000000000040', NULL, '550e8400-e29b-41d4-a716-446655440116', 'OPPONENT', 1280, '2026-10-15 15:51:20', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005033', '33333333-1111-1111-1111-000000000040', NULL, '550e8400-e29b-41d4-a716-446655440117', 'OPPONENT', 1320, '2026-10-15 15:52:00', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005034', '33333333-1111-1111-1111-000000000040', '33333333-1111-1111-1111-000000000111', '550e8400-e29b-41d4-a716-446655440117', 'OWN', 1360, '2026-10-15 15:52:40', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005035', '33333333-1111-1111-1111-000000000040', NULL, '550e8400-e29b-41d4-a716-446655440117', 'OPPONENT', 1400, '2026-10-15 15:53:20', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005036', '33333333-1111-1111-1111-000000000040', '33333333-1111-1111-1111-000000000107', '550e8400-e29b-41d4-a716-446655440116', 'OWN', 1440, '2026-10-15 15:54:00', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005037', '33333333-1111-1111-1111-000000000040', NULL, '550e8400-e29b-41d4-a716-446655440112', 'OPPONENT', 1480, '2026-10-15 15:54:40', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005038', '33333333-1111-1111-1111-000000000040', '33333333-1111-1111-1111-000000000106', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 1520, '2026-10-15 15:55:20', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005039', '33333333-1111-1111-1111-000000000040', NULL, '550e8400-e29b-41d4-a716-446655440117', 'OPPONENT', 1560, '2026-10-15 15:56:00', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005040', '33333333-1111-1111-1111-000000000043', '33333333-1111-1111-1111-000000000105', '550e8400-e29b-41d4-a716-446655440112', 'OWN', 0, '2026-10-14 15:30:00', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005041', '33333333-1111-1111-1111-000000000043', NULL, '550e8400-e29b-41d4-a716-446655440101', 'OPPONENT', 35, '2026-10-14 15:30:35', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005042', '33333333-1111-1111-1111-000000000043', '33333333-1111-1111-1111-000000000103', '550e8400-e29b-41d4-a716-446655440101', 'OWN', 70, '2026-10-14 15:31:10', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005043', '33333333-1111-1111-1111-000000000043', '33333333-1111-1111-1111-000000000111', '550e8400-e29b-41d4-a716-446655440112', 'OWN', 105, '2026-10-14 15:31:45', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005044', '33333333-1111-1111-1111-000000000043', NULL, '550e8400-e29b-41d4-a716-446655440115', 'OPPONENT', 140, '2026-10-14 15:32:20', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005045', '33333333-1111-1111-1111-000000000043', '33333333-1111-1111-1111-000000000115', '550e8400-e29b-41d4-a716-446655440117', 'OWN', 175, '2026-10-14 15:32:55', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005046', '33333333-1111-1111-1111-000000000043', NULL, '550e8400-e29b-41d4-a716-446655440115', 'OPPONENT', 210, '2026-10-14 15:33:30', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005047', '33333333-1111-1111-1111-000000000043', NULL, '550e8400-e29b-41d4-a716-446655440116', 'OPPONENT', 245, '2026-10-14 15:34:05', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005048', '33333333-1111-1111-1111-000000000043', '33333333-1111-1111-1111-000000000109', '550e8400-e29b-41d4-a716-446655440112', 'OWN', 280, '2026-10-14 15:34:40', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005049', '33333333-1111-1111-1111-000000000043', NULL, '550e8400-e29b-41d4-a716-446655440112', 'OPPONENT', 315, '2026-10-14 15:35:15', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005050', '33333333-1111-1111-1111-000000000043', NULL, '550e8400-e29b-41d4-a716-446655440117', 'OPPONENT', 350, '2026-10-14 15:35:50', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005051', '33333333-1111-1111-1111-000000000043', '33333333-1111-1111-1111-000000000104', '550e8400-e29b-41d4-a716-446655440117', 'OWN', 385, '2026-10-14 15:36:25', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005052', '33333333-1111-1111-1111-000000000043', '33333333-1111-1111-1111-000000000113', '550e8400-e29b-41d4-a716-446655440101', 'OWN', 420, '2026-10-14 15:37:00', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005053', '33333333-1111-1111-1111-000000000043', '33333333-1111-1111-1111-000000000108', '550e8400-e29b-41d4-a716-446655440101', 'OWN', 455, '2026-10-14 15:37:35', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005054', '33333333-1111-1111-1111-000000000043', '33333333-1111-1111-1111-000000000109', '550e8400-e29b-41d4-a716-446655440112', 'OWN', 490, '2026-10-14 15:38:10', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005055', '33333333-1111-1111-1111-000000000043', '33333333-1111-1111-1111-000000000108', '550e8400-e29b-41d4-a716-446655440112', 'OWN', 525, '2026-10-14 15:38:45', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005056', '33333333-1111-1111-1111-000000000043', NULL, '550e8400-e29b-41d4-a716-446655440101', 'OPPONENT', 560, '2026-10-14 15:39:20', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005057', '33333333-1111-1111-1111-000000000043', NULL, '550e8400-e29b-41d4-a716-446655440115', 'OPPONENT', 595, '2026-10-14 15:39:55', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005058', '33333333-1111-1111-1111-000000000043', NULL, '550e8400-e29b-41d4-a716-446655440116', 'OPPONENT', 630, '2026-10-14 15:40:30', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005059', '33333333-1111-1111-1111-000000000043', '33333333-1111-1111-1111-000000000111', '550e8400-e29b-41d4-a716-446655440116', 'OWN', 665, '2026-10-14 15:41:05', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005060', '33333333-1111-1111-1111-000000000043', '33333333-1111-1111-1111-000000000115', '550e8400-e29b-41d4-a716-446655440101', 'OWN', 700, '2026-10-14 15:41:40', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005061', '33333333-1111-1111-1111-000000000043', '33333333-1111-1111-1111-000000000103', '550e8400-e29b-41d4-a716-446655440112', 'OWN', 735, '2026-10-14 15:42:15', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005062', '33333333-1111-1111-1111-000000000043', NULL, '550e8400-e29b-41d4-a716-446655440101', 'OPPONENT', 770, '2026-10-14 15:42:50', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005063', '33333333-1111-1111-1111-000000000043', '33333333-1111-1111-1111-000000000105', '550e8400-e29b-41d4-a716-446655440112', 'OWN', 805, '2026-10-14 15:43:25', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005064', '33333333-1111-1111-1111-000000000043', '33333333-1111-1111-1111-000000000113', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 840, '2026-10-14 15:44:00', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005065', '33333333-1111-1111-1111-000000000043', NULL, '550e8400-e29b-41d4-a716-446655440117', 'OPPONENT', 875, '2026-10-14 15:44:35', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005066', '33333333-1111-1111-1111-000000000043', '33333333-1111-1111-1111-000000000114', '550e8400-e29b-41d4-a716-446655440101', 'OWN', 910, '2026-10-14 15:45:10', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005067', '33333333-1111-1111-1111-000000000043', NULL, '550e8400-e29b-41d4-a716-446655440117', 'OPPONENT', 945, '2026-10-14 15:45:45', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005068', '33333333-1111-1111-1111-000000000043', NULL, '550e8400-e29b-41d4-a716-446655440112', 'OPPONENT', 980, '2026-10-14 15:46:20', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005069', '33333333-1111-1111-1111-000000000043', '33333333-1111-1111-1111-000000000106', '550e8400-e29b-41d4-a716-446655440116', 'OWN', 1015, '2026-10-14 15:46:55', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005070', '33333333-1111-1111-1111-000000000043', '33333333-1111-1111-1111-000000000106', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 1050, '2026-10-14 15:47:30', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005071', '33333333-1111-1111-1111-000000000043', NULL, '550e8400-e29b-41d4-a716-446655440112', 'OPPONENT', 1085, '2026-10-14 15:48:05', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005072', '33333333-1111-1111-1111-000000000043', '33333333-1111-1111-1111-000000000102', '550e8400-e29b-41d4-a716-446655440112', 'OWN', 1120, '2026-10-14 15:48:40', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005073', '33333333-1111-1111-1111-000000000043', '33333333-1111-1111-1111-000000000109', '550e8400-e29b-41d4-a716-446655440117', 'OWN', 1155, '2026-10-14 15:49:15', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005074', '33333333-1111-1111-1111-000000000043', '33333333-1111-1111-1111-000000000115', '550e8400-e29b-41d4-a716-446655440116', 'OWN', 1190, '2026-10-14 15:49:50', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005075', '33333333-1111-1111-1111-000000000043', '33333333-1111-1111-1111-000000000105', '550e8400-e29b-41d4-a716-446655440117', 'OWN', 1225, '2026-10-14 15:50:25', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005076', '33333333-1111-1111-1111-000000000043', '33333333-1111-1111-1111-000000000109', '550e8400-e29b-41d4-a716-446655440116', 'OWN', 1260, '2026-10-14 15:51:00', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005077', '33333333-1111-1111-1111-000000000043', '33333333-1111-1111-1111-000000000104', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 1295, '2026-10-14 15:51:35', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005078', '33333333-1111-1111-1111-000000000043', NULL, '550e8400-e29b-41d4-a716-446655440101', 'OPPONENT', 1330, '2026-10-14 15:52:10', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005079', '33333333-1111-1111-1111-000000000043', '33333333-1111-1111-1111-000000000108', '550e8400-e29b-41d4-a716-446655440117', 'OWN', 1365, '2026-10-14 15:52:45', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005080', '33333333-1111-1111-1111-000000000043', '33333333-1111-1111-1111-000000000114', '550e8400-e29b-41d4-a716-446655440117', 'OWN', 1400, '2026-10-14 15:53:20', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005081', '33333333-1111-1111-1111-000000000043', '33333333-1111-1111-1111-000000000112', '550e8400-e29b-41d4-a716-446655440112', 'OWN', 1435, '2026-10-14 15:53:55', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005082', '33333333-1111-1111-1111-000000000043', NULL, '550e8400-e29b-41d4-a716-446655440117', 'OPPONENT', 1470, '2026-10-14 15:54:30', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005083', '33333333-1111-1111-1111-000000000043', NULL, '550e8400-e29b-41d4-a716-446655440117', 'OPPONENT', 1505, '2026-10-14 15:55:05', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005084', '33333333-1111-1111-1111-000000000043', '33333333-1111-1111-1111-000000000114', '550e8400-e29b-41d4-a716-446655440117', 'OWN', 1540, '2026-10-14 15:55:40', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005085', '33333333-1111-1111-1111-000000000043', '33333333-1111-1111-1111-000000000107', '550e8400-e29b-41d4-a716-446655440112', 'OWN', 1575, '2026-10-14 15:56:15', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005086', '33333333-1111-1111-1111-000000000043', NULL, '550e8400-e29b-41d4-a716-446655440112', 'OPPONENT', 1610, '2026-10-14 15:56:50', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005087', '33333333-1111-1111-1111-000000000043', NULL, '550e8400-e29b-41d4-a716-446655440115', 'OPPONENT', 1645, '2026-10-14 15:57:25', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005088', '33333333-1111-1111-1111-000000000043', '33333333-1111-1111-1111-000000000104', '550e8400-e29b-41d4-a716-446655440112', 'OWN', 1680, '2026-10-14 15:58:00', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005089', '33333333-1111-1111-1111-000000000043', NULL, '550e8400-e29b-41d4-a716-446655440117', 'OPPONENT', 1715, '2026-10-14 15:58:35', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005090', '33333333-1111-1111-1111-000000000043', '33333333-1111-1111-1111-000000000105', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 1750, '2026-10-14 15:59:10', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005091', '33333333-1111-1111-1111-000000000043', '33333333-1111-1111-1111-000000000110', '550e8400-e29b-41d4-a716-446655440117', 'OWN', 1785, '2026-10-14 15:59:45', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005092', '33333333-1111-1111-1111-000000000043', '33333333-1111-1111-1111-000000000110', '550e8400-e29b-41d4-a716-446655440101', 'OWN', 1820, '2026-10-14 16:00:20', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005093', '33333333-1111-1111-1111-000000000043', NULL, '550e8400-e29b-41d4-a716-446655440117', 'OPPONENT', 1855, '2026-10-14 16:00:55', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005094', '33333333-1111-1111-1111-000000000043', '33333333-1111-1111-1111-000000000108', '550e8400-e29b-41d4-a716-446655440117', 'OWN', 1890, '2026-10-14 16:01:30', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005095', '33333333-1111-1111-1111-000000000043', NULL, '550e8400-e29b-41d4-a716-446655440112', 'OPPONENT', 1925, '2026-10-14 16:02:05', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005096', '33333333-1111-1111-1111-000000000043', '33333333-1111-1111-1111-000000000112', '550e8400-e29b-41d4-a716-446655440101', 'OWN', 1960, '2026-10-14 16:02:40', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005097', '33333333-1111-1111-1111-000000000043', '33333333-1111-1111-1111-000000000110', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 1995, '2026-10-14 16:03:15', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005098', '33333333-1111-1111-1111-000000000043', NULL, '550e8400-e29b-41d4-a716-446655440112', 'OPPONENT', 2030, '2026-10-14 16:03:50', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005099', '33333333-1111-1111-1111-000000000043', NULL, '550e8400-e29b-41d4-a716-446655440116', 'OPPONENT', 2065, '2026-10-14 16:04:25', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005100', '33333333-1111-1111-1111-000000000043', '33333333-1111-1111-1111-000000000112', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 2100, '2026-10-14 16:05:00', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005101', '33333333-1111-1111-1111-000000000043', NULL, '550e8400-e29b-41d4-a716-446655440115', 'OPPONENT', 2135, '2026-10-14 16:05:35', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005102', '33333333-1111-1111-1111-000000000043', '33333333-1111-1111-1111-000000000112', '550e8400-e29b-41d4-a716-446655440112', 'OWN', 2170, '2026-10-14 16:06:10', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005103', '33333333-1111-1111-1111-000000000043', NULL, '550e8400-e29b-41d4-a716-446655440116', 'OPPONENT', 2205, '2026-10-14 16:06:45', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005104', '33333333-1111-1111-1111-000000000043', NULL, '550e8400-e29b-41d4-a716-446655440116', 'OPPONENT', 2240, '2026-10-14 16:07:20', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005105', '33333333-1111-1111-1111-000000000043', '33333333-1111-1111-1111-000000000108', '550e8400-e29b-41d4-a716-446655440112', 'OWN', 2275, '2026-10-14 16:07:55', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005106', '33333333-1111-1111-1111-000000000043', NULL, '550e8400-e29b-41d4-a716-446655440116', 'OPPONENT', 2310, '2026-10-14 16:08:30', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005107', '33333333-1111-1111-1111-000000000043', NULL, '550e8400-e29b-41d4-a716-446655440117', 'OPPONENT', 2345, '2026-10-14 16:09:05', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005108', '33333333-1111-1111-1111-000000000043', NULL, '550e8400-e29b-41d4-a716-446655440116', 'OPPONENT', 2380, '2026-10-14 16:09:40', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005109', '33333333-1111-1111-1111-000000000043', '33333333-1111-1111-1111-000000000108', '550e8400-e29b-41d4-a716-446655440116', 'OWN', 2415, '2026-10-14 16:10:15', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005110', '33333333-1111-1111-1111-000000000043', '33333333-1111-1111-1111-000000000115', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 2450, '2026-10-14 16:10:50', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005111', '33333333-1111-1111-1111-000000000043', '33333333-1111-1111-1111-000000000115', '550e8400-e29b-41d4-a716-446655440101', 'OWN', 2485, '2026-10-14 16:11:25', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005112', '33333333-1111-1111-1111-000000000043', NULL, '550e8400-e29b-41d4-a716-446655440116', 'OPPONENT', 2520, '2026-10-14 16:12:00', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005113', '33333333-1111-1111-1111-000000000043', NULL, '550e8400-e29b-41d4-a716-446655440112', 'OPPONENT', 2555, '2026-10-14 16:12:35', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005114', '33333333-1111-1111-1111-000000000043', '33333333-1111-1111-1111-000000000112', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 2590, '2026-10-14 16:13:10', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005115', '33333333-1111-1111-1111-000000000043', NULL, '550e8400-e29b-41d4-a716-446655440112', 'OPPONENT', 2625, '2026-10-14 16:13:45', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005116', '33333333-1111-1111-1111-000000000043', '33333333-1111-1111-1111-000000000114', '550e8400-e29b-41d4-a716-446655440101', 'OWN', 2660, '2026-10-14 16:14:20', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005117', '33333333-1111-1111-1111-000000000043', NULL, '550e8400-e29b-41d4-a716-446655440116', 'OPPONENT', 2695, '2026-10-14 16:14:55', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005118', '33333333-1111-1111-1111-000000000043', '33333333-1111-1111-1111-000000000112', '550e8400-e29b-41d4-a716-446655440117', 'OWN', 2730, '2026-10-14 16:15:30', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005119', '33333333-1111-1111-1111-000000000043', NULL, '550e8400-e29b-41d4-a716-446655440116', 'OPPONENT', 2765, '2026-10-14 16:16:05', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005120', '33333333-1111-1111-1111-000000000043', '33333333-1111-1111-1111-000000000103', '550e8400-e29b-41d4-a716-446655440112', 'OWN', 2800, '2026-10-14 16:16:40', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005121', '33333333-1111-1111-1111-000000000043', '33333333-1111-1111-1111-000000000111', '550e8400-e29b-41d4-a716-446655440116', 'OWN', 2835, '2026-10-14 16:17:15', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005122', '33333333-1111-1111-1111-000000000043', NULL, '550e8400-e29b-41d4-a716-446655440117', 'OPPONENT', 2870, '2026-10-14 16:17:50', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005123', '33333333-1111-1111-1111-000000000043', '33333333-1111-1111-1111-000000000112', '550e8400-e29b-41d4-a716-446655440116', 'OWN', 2905, '2026-10-14 16:18:25', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005124', '33333333-1111-1111-1111-000000000043', '33333333-1111-1111-1111-000000000104', '550e8400-e29b-41d4-a716-446655440112', 'OWN', 2940, '2026-10-14 16:19:00', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005125', '33333333-1111-1111-1111-000000000043', NULL, '550e8400-e29b-41d4-a716-446655440117', 'OPPONENT', 2975, '2026-10-14 16:19:35', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005126', '33333333-1111-1111-1111-000000000043', NULL, '550e8400-e29b-41d4-a716-446655440117', 'OPPONENT', 3010, '2026-10-14 16:20:10', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005127', '33333333-1111-1111-1111-000000000043', NULL, '550e8400-e29b-41d4-a716-446655440112', 'OPPONENT', 3045, '2026-10-14 16:20:45', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005128', '33333333-1111-1111-1111-000000000043', '33333333-1111-1111-1111-000000000103', '550e8400-e29b-41d4-a716-446655440112', 'OWN', 3080, '2026-10-14 16:21:20', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005129', '33333333-1111-1111-1111-000000000043', NULL, '550e8400-e29b-41d4-a716-446655440115', 'OPPONENT', 3115, '2026-10-14 16:21:55', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005130', '33333333-1111-1111-1111-000000000043', '33333333-1111-1111-1111-000000000105', '550e8400-e29b-41d4-a716-446655440112', 'OWN', 3150, '2026-10-14 16:22:30', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005131', '33333333-1111-1111-1111-000000000043', NULL, '550e8400-e29b-41d4-a716-446655440101', 'OPPONENT', 3185, '2026-10-14 16:23:05', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005132', '33333333-1111-1111-1111-000000000043', NULL, '550e8400-e29b-41d4-a716-446655440115', 'OPPONENT', 3220, '2026-10-14 16:23:40', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005133', '33333333-1111-1111-1111-000000000043', '33333333-1111-1111-1111-000000000104', '550e8400-e29b-41d4-a716-446655440112', 'OWN', 3255, '2026-10-14 16:24:15', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005134', '33333333-1111-1111-1111-000000000043', NULL, '550e8400-e29b-41d4-a716-446655440101', 'OPPONENT', 3290, '2026-10-14 16:24:50', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005135', '33333333-1111-1111-1111-000000000043', NULL, '550e8400-e29b-41d4-a716-446655440101', 'OPPONENT', 3325, '2026-10-14 16:25:25', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005136', '33333333-1111-1111-1111-000000000043', '33333333-1111-1111-1111-000000000113', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 3360, '2026-10-14 16:26:00', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005137', '33333333-1111-1111-1111-000000000043', '33333333-1111-1111-1111-000000000110', '550e8400-e29b-41d4-a716-446655440116', 'OWN', 3395, '2026-10-14 16:26:35', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005138', '33333333-1111-1111-1111-000000000043', NULL, '550e8400-e29b-41d4-a716-446655440115', 'OPPONENT', 3430, '2026-10-14 16:27:10', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005139', '33333333-1111-1111-1111-000000000043', NULL, '550e8400-e29b-41d4-a716-446655440117', 'OPPONENT', 3465, '2026-10-14 16:27:45', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005140', '33333333-1111-1111-1111-000000000043', NULL, '550e8400-e29b-41d4-a716-446655440115', 'OPPONENT', 3500, '2026-10-14 16:28:20', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005141', '33333333-1111-1111-1111-000000000043', '33333333-1111-1111-1111-000000000109', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 3535, '2026-10-14 16:28:55', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005142', '33333333-1111-1111-1111-000000000043', NULL, '550e8400-e29b-41d4-a716-446655440112', 'OPPONENT', 3570, '2026-10-14 16:29:30', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005143', '33333333-1111-1111-1111-000000000043', NULL, '550e8400-e29b-41d4-a716-446655440112', 'OPPONENT', 3605, '2026-10-14 16:30:05', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005144', '33333333-1111-1111-1111-000000000043', '33333333-1111-1111-1111-000000000112', '550e8400-e29b-41d4-a716-446655440117', 'OWN', 3640, '2026-10-14 16:30:40', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005145', '33333333-1111-1111-1111-000000000043', NULL, '550e8400-e29b-41d4-a716-446655440116', 'OPPONENT', 3675, '2026-10-14 16:31:15', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005146', '33333333-1111-1111-1111-000000000043', '33333333-1111-1111-1111-000000000105', '550e8400-e29b-41d4-a716-446655440101', 'OWN', 3710, '2026-10-14 16:31:50', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005147', '33333333-1111-1111-1111-000000000043', NULL, '550e8400-e29b-41d4-a716-446655440117', 'OPPONENT', 3745, '2026-10-14 16:32:25', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005148', '33333333-1111-1111-1111-000000000043', NULL, '550e8400-e29b-41d4-a716-446655440115', 'OPPONENT', 3780, '2026-10-14 16:33:00', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005149', '33333333-1111-1111-1111-000000000043', '33333333-1111-1111-1111-000000000115', '550e8400-e29b-41d4-a716-446655440116', 'OWN', 3815, '2026-10-14 16:33:35', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005150', '33333333-1111-1111-1111-000000000043', '33333333-1111-1111-1111-000000000115', '550e8400-e29b-41d4-a716-446655440112', 'OWN', 3850, '2026-10-14 16:34:10', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005151', '33333333-1111-1111-1111-000000000043', NULL, '550e8400-e29b-41d4-a716-446655440112', 'OPPONENT', 3885, '2026-10-14 16:34:45', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005152', '33333333-1111-1111-1111-000000000043', '33333333-1111-1111-1111-000000000111', '550e8400-e29b-41d4-a716-446655440101', 'OWN', 3920, '2026-10-14 16:35:20', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005153', '33333333-1111-1111-1111-000000000043', '33333333-1111-1111-1111-000000000104', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 3955, '2026-10-14 16:35:55', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005154', '33333333-1111-1111-1111-000000000043', '33333333-1111-1111-1111-000000000113', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 3990, '2026-10-14 16:36:30', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005155', '33333333-1111-1111-1111-000000000043', NULL, '550e8400-e29b-41d4-a716-446655440101', 'OPPONENT', 4025, '2026-10-14 16:37:05', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005156', '33333333-1111-1111-1111-000000000043', '33333333-1111-1111-1111-000000000103', '550e8400-e29b-41d4-a716-446655440116', 'OWN', 4060, '2026-10-14 16:37:40', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005157', '33333333-1111-1111-1111-000000000043', NULL, '550e8400-e29b-41d4-a716-446655440116', 'OPPONENT', 4095, '2026-10-14 16:38:15', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005158', '33333333-1111-1111-1111-000000000043', '33333333-1111-1111-1111-000000000114', '550e8400-e29b-41d4-a716-446655440101', 'OWN', 4130, '2026-10-14 16:38:50', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007000', '33333333-1111-1111-1111-000000000042', '33333333-1111-1111-1111-000000000105', '550e8400-e29b-41d4-a716-446655440116', 'OWN', 0, '2026-09-28 14:00:00', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007001', '33333333-1111-1111-1111-000000000042', NULL, '550e8400-e29b-41d4-a716-446655440112', 'OPPONENT', 25, '2026-09-28 14:00:25', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007002', '33333333-1111-1111-1111-000000000042', '33333333-1111-1111-1111-000000000105', '550e8400-e29b-41d4-a716-446655440101', 'OWN', 50, '2026-09-28 14:00:50', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007003', '33333333-1111-1111-1111-000000000042', '33333333-1111-1111-1111-000000000110', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 72, '2026-09-28 14:01:12', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007004', '33333333-1111-1111-1111-000000000042', '33333333-1111-1111-1111-000000000106', '550e8400-e29b-41d4-a716-446655440112', 'OWN', 97, '2026-09-28 14:01:37', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007005', '33333333-1111-1111-1111-000000000042', NULL, '550e8400-e29b-41d4-a716-446655440112', 'OPPONENT', 122, '2026-09-28 14:02:02', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007006', '33333333-1111-1111-1111-000000000042', '33333333-1111-1111-1111-000000000104', '550e8400-e29b-41d4-a716-446655440112', 'OWN', 144, '2026-09-28 14:02:24', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007007', '33333333-1111-1111-1111-000000000042', '33333333-1111-1111-1111-000000000104', '550e8400-e29b-41d4-a716-446655440112', 'OWN', 169, '2026-09-28 14:02:49', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007008', '33333333-1111-1111-1111-000000000042', '33333333-1111-1111-1111-000000000106', '550e8400-e29b-41d4-a716-446655440116', 'OWN', 194, '2026-09-28 14:03:14', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007009', '33333333-1111-1111-1111-000000000042', NULL, '550e8400-e29b-41d4-a716-446655440112', 'OPPONENT', 216, '2026-09-28 14:03:36', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007010', '33333333-1111-1111-1111-000000000042', '33333333-1111-1111-1111-000000000115', '550e8400-e29b-41d4-a716-446655440101', 'OWN', 241, '2026-09-28 14:04:01', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007011', '33333333-1111-1111-1111-000000000042', NULL, '550e8400-e29b-41d4-a716-446655440112', 'OPPONENT', 266, '2026-09-28 14:04:26', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007012', '33333333-1111-1111-1111-000000000042', NULL, '550e8400-e29b-41d4-a716-446655440112', 'OPPONENT', 288, '2026-09-28 14:04:48', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007013', '33333333-1111-1111-1111-000000000042', '33333333-1111-1111-1111-000000000105', '550e8400-e29b-41d4-a716-446655440117', 'OWN', 313, '2026-09-28 14:05:13', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007014', '33333333-1111-1111-1111-000000000042', NULL, '550e8400-e29b-41d4-a716-446655440101', 'OPPONENT', 338, '2026-09-28 14:05:38', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007015', '33333333-1111-1111-1111-000000000042', '33333333-1111-1111-1111-000000000111', '550e8400-e29b-41d4-a716-446655440101', 'OWN', 360, '2026-09-28 14:06:00', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007016', '33333333-1111-1111-1111-000000000042', NULL, '550e8400-e29b-41d4-a716-446655440101', 'OPPONENT', 385, '2026-09-28 14:06:25', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007017', '33333333-1111-1111-1111-000000000042', NULL, '550e8400-e29b-41d4-a716-446655440117', 'OPPONENT', 410, '2026-09-28 14:06:50', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007018', '33333333-1111-1111-1111-000000000042', '33333333-1111-1111-1111-000000000101', '550e8400-e29b-41d4-a716-446655440116', 'OWN', 432, '2026-09-28 14:07:12', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007019', '33333333-1111-1111-1111-000000000042', NULL, '550e8400-e29b-41d4-a716-446655440116', 'OPPONENT', 457, '2026-09-28 14:07:37', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007020', '33333333-1111-1111-1111-000000000042', NULL, '550e8400-e29b-41d4-a716-446655440112', 'OPPONENT', 482, '2026-09-28 14:08:02', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007021', '33333333-1111-1111-1111-000000000042', '33333333-1111-1111-1111-000000000109', '550e8400-e29b-41d4-a716-446655440117', 'OWN', 504, '2026-09-28 14:08:24', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007022', '33333333-1111-1111-1111-000000000042', NULL, '550e8400-e29b-41d4-a716-446655440112', 'OPPONENT', 529, '2026-09-28 14:08:49', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007023', '33333333-1111-1111-1111-000000000042', NULL, '550e8400-e29b-41d4-a716-446655440117', 'OPPONENT', 554, '2026-09-28 14:09:14', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007024', '33333333-1111-1111-1111-000000000042', '33333333-1111-1111-1111-000000000109', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 576, '2026-09-28 14:09:36', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007025', '33333333-1111-1111-1111-000000000042', NULL, '550e8400-e29b-41d4-a716-446655440112', 'OPPONENT', 601, '2026-09-28 14:10:01', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007026', '33333333-1111-1111-1111-000000000042', '33333333-1111-1111-1111-000000000105', '550e8400-e29b-41d4-a716-446655440117', 'OWN', 626, '2026-09-28 14:10:26', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007027', '33333333-1111-1111-1111-000000000042', NULL, '550e8400-e29b-41d4-a716-446655440116', 'OPPONENT', 648, '2026-09-28 14:10:48', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007028', '33333333-1111-1111-1111-000000000042', NULL, '550e8400-e29b-41d4-a716-446655440112', 'OPPONENT', 673, '2026-09-28 14:11:13', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007029', '33333333-1111-1111-1111-000000000042', '33333333-1111-1111-1111-000000000109', '550e8400-e29b-41d4-a716-446655440101', 'OWN', 698, '2026-09-28 14:11:38', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007030', '33333333-1111-1111-1111-000000000042', NULL, '550e8400-e29b-41d4-a716-446655440116', 'OPPONENT', 720, '2026-09-28 14:12:00', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007031', '33333333-1111-1111-1111-000000000042', '33333333-1111-1111-1111-000000000113', '550e8400-e29b-41d4-a716-446655440116', 'OWN', 745, '2026-09-28 14:12:25', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007032', '33333333-1111-1111-1111-000000000042', NULL, '550e8400-e29b-41d4-a716-446655440112', 'OPPONENT', 770, '2026-09-28 14:12:50', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007033', '33333333-1111-1111-1111-000000000042', NULL, '550e8400-e29b-41d4-a716-446655440116', 'OPPONENT', 792, '2026-09-28 14:13:12', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007034', '33333333-1111-1111-1111-000000000042', NULL, '550e8400-e29b-41d4-a716-446655440116', 'OPPONENT', 817, '2026-09-28 14:13:37', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007035', '33333333-1111-1111-1111-000000000042', NULL, '550e8400-e29b-41d4-a716-446655440115', 'OPPONENT', 842, '2026-09-28 14:14:02', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007036', '33333333-1111-1111-1111-000000000042', NULL, '550e8400-e29b-41d4-a716-446655440115', 'OPPONENT', 864, '2026-09-28 14:14:24', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007037', '33333333-1111-1111-1111-000000000042', '33333333-1111-1111-1111-000000000110', '550e8400-e29b-41d4-a716-446655440116', 'OWN', 889, '2026-09-28 14:14:49', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007038', '33333333-1111-1111-1111-000000000042', NULL, '550e8400-e29b-41d4-a716-446655440116', 'OPPONENT', 914, '2026-09-28 14:15:14', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007039', '33333333-1111-1111-1111-000000000042', '33333333-1111-1111-1111-000000000115', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 936, '2026-09-28 14:15:36', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007040', '33333333-1111-1111-1111-000000000042', NULL, '550e8400-e29b-41d4-a716-446655440115', 'OPPONENT', 961, '2026-09-28 14:16:01', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007041', '33333333-1111-1111-1111-000000000042', NULL, '550e8400-e29b-41d4-a716-446655440112', 'OPPONENT', 986, '2026-09-28 14:16:26', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007042', '33333333-1111-1111-1111-000000000042', NULL, '550e8400-e29b-41d4-a716-446655440112', 'OPPONENT', 1008, '2026-09-28 14:16:48', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007043', '33333333-1111-1111-1111-000000000042', '33333333-1111-1111-1111-000000000105', '550e8400-e29b-41d4-a716-446655440117', 'OWN', 1033, '2026-09-28 14:17:13', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007044', '33333333-1111-1111-1111-000000000042', '33333333-1111-1111-1111-000000000108', '550e8400-e29b-41d4-a716-446655440117', 'OWN', 1058, '2026-09-28 14:17:38', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007045', '33333333-1111-1111-1111-000000000042', '33333333-1111-1111-1111-000000000111', '550e8400-e29b-41d4-a716-446655440116', 'OWN', 1080, '2026-09-28 14:18:00', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007046', '33333333-1111-1111-1111-000000000042', NULL, '550e8400-e29b-41d4-a716-446655440101', 'OPPONENT', 1105, '2026-09-28 14:18:25', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007047', '33333333-1111-1111-1111-000000000042', '33333333-1111-1111-1111-000000000106', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 1130, '2026-09-28 14:18:50', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007048', '33333333-1111-1111-1111-000000000042', NULL, '550e8400-e29b-41d4-a716-446655440101', 'OPPONENT', 1152, '2026-09-28 14:19:12', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007049', '33333333-1111-1111-1111-000000000042', NULL, '550e8400-e29b-41d4-a716-446655440115', 'OPPONENT', 1177, '2026-09-28 14:19:37', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007050', '33333333-1111-1111-1111-000000000042', '33333333-1111-1111-1111-000000000108', '550e8400-e29b-41d4-a716-446655440116', 'OWN', 1202, '2026-09-28 14:20:02', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007051', '33333333-1111-1111-1111-000000000042', NULL, '550e8400-e29b-41d4-a716-446655440112', 'OPPONENT', 1224, '2026-09-28 14:20:24', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007052', '33333333-1111-1111-1111-000000000042', NULL, '550e8400-e29b-41d4-a716-446655440117', 'OPPONENT', 1249, '2026-09-28 14:20:49', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007053', '33333333-1111-1111-1111-000000000042', NULL, '550e8400-e29b-41d4-a716-446655440117', 'OPPONENT', 1274, '2026-09-28 14:21:14', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007054', '33333333-1111-1111-1111-000000000042', '33333333-1111-1111-1111-000000000109', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 1296, '2026-09-28 14:21:36', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007055', '33333333-1111-1111-1111-000000000042', '33333333-1111-1111-1111-000000000104', '550e8400-e29b-41d4-a716-446655440116', 'OWN', 1321, '2026-09-28 14:22:01', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007056', '33333333-1111-1111-1111-000000000042', NULL, '550e8400-e29b-41d4-a716-446655440116', 'OPPONENT', 1346, '2026-09-28 14:22:26', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007057', '33333333-1111-1111-1111-000000000042', NULL, '550e8400-e29b-41d4-a716-446655440116', 'OPPONENT', 1368, '2026-09-28 14:22:48', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007058', '33333333-1111-1111-1111-000000000042', NULL, '550e8400-e29b-41d4-a716-446655440117', 'OPPONENT', 1393, '2026-09-28 14:23:13', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007059', '33333333-1111-1111-1111-000000000042', NULL, '550e8400-e29b-41d4-a716-446655440112', 'OPPONENT', 1418, '2026-09-28 14:23:38', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007060', '33333333-1111-1111-1111-000000000042', '33333333-1111-1111-1111-000000000110', '550e8400-e29b-41d4-a716-446655440116', 'OWN', 1440, '2026-09-28 14:24:00', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007061', '33333333-1111-1111-1111-000000000042', '33333333-1111-1111-1111-000000000111', '550e8400-e29b-41d4-a716-446655440117', 'OWN', 1465, '2026-09-28 14:24:25', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007062', '33333333-1111-1111-1111-000000000042', NULL, '550e8400-e29b-41d4-a716-446655440115', 'OPPONENT', 1490, '2026-09-28 14:24:50', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007063', '33333333-1111-1111-1111-000000000042', '33333333-1111-1111-1111-000000000111', '550e8400-e29b-41d4-a716-446655440116', 'OWN', 1512, '2026-09-28 14:25:12', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007064', '33333333-1111-1111-1111-000000000042', '33333333-1111-1111-1111-000000000110', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 1537, '2026-09-28 14:25:37', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007065', '33333333-1111-1111-1111-000000000042', NULL, '550e8400-e29b-41d4-a716-446655440115', 'OPPONENT', 1562, '2026-09-28 14:26:02', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007066', '33333333-1111-1111-1111-000000000042', '33333333-1111-1111-1111-000000000114', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 1584, '2026-09-28 14:26:24', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007067', '33333333-1111-1111-1111-000000000042', '33333333-1111-1111-1111-000000000104', '550e8400-e29b-41d4-a716-446655440116', 'OWN', 1609, '2026-09-28 14:26:49', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007068', '33333333-1111-1111-1111-000000000042', NULL, '550e8400-e29b-41d4-a716-446655440116', 'OPPONENT', 1634, '2026-09-28 14:27:14', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007069', '33333333-1111-1111-1111-000000000042', '33333333-1111-1111-1111-000000000101', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 1656, '2026-09-28 14:27:36', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007070', '33333333-1111-1111-1111-000000000042', NULL, '550e8400-e29b-41d4-a716-446655440115', 'OPPONENT', 1681, '2026-09-28 14:28:01', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007071', '33333333-1111-1111-1111-000000000042', '33333333-1111-1111-1111-000000000103', '550e8400-e29b-41d4-a716-446655440117', 'OWN', 1706, '2026-09-28 14:28:26', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007072', '33333333-1111-1111-1111-000000000042', NULL, '550e8400-e29b-41d4-a716-446655440101', 'OPPONENT', 1728, '2026-09-28 14:28:48', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007073', '33333333-1111-1111-1111-000000000042', NULL, '550e8400-e29b-41d4-a716-446655440112', 'OPPONENT', 1753, '2026-09-28 14:29:13', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007074', '33333333-1111-1111-1111-000000000042', '33333333-1111-1111-1111-000000000102', '550e8400-e29b-41d4-a716-446655440117', 'OWN', 1778, '2026-09-28 14:29:38', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007075', '33333333-1111-1111-1111-000000000042', NULL, '550e8400-e29b-41d4-a716-446655440116', 'OPPONENT', 1800, '2026-09-28 14:30:00', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007076', '33333333-1111-1111-1111-000000000042', '33333333-1111-1111-1111-000000000115', '550e8400-e29b-41d4-a716-446655440116', 'OWN', 1825, '2026-09-28 14:30:25', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007077', '33333333-1111-1111-1111-000000000042', NULL, '550e8400-e29b-41d4-a716-446655440117', 'OPPONENT', 1850, '2026-09-28 14:30:50', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007078', '33333333-1111-1111-1111-000000000042', '33333333-1111-1111-1111-000000000101', '550e8400-e29b-41d4-a716-446655440117', 'OWN', 1872, '2026-09-28 14:31:12', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007079', '33333333-1111-1111-1111-000000000042', NULL, '550e8400-e29b-41d4-a716-446655440117', 'OPPONENT', 1897, '2026-09-28 14:31:37', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007080', '33333333-1111-1111-1111-000000000042', NULL, '550e8400-e29b-41d4-a716-446655440116', 'OPPONENT', 1922, '2026-09-28 14:32:02', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007081', '33333333-1111-1111-1111-000000000042', '33333333-1111-1111-1111-000000000107', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 1944, '2026-09-28 14:32:24', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007082', '33333333-1111-1111-1111-000000000042', NULL, '550e8400-e29b-41d4-a716-446655440117', 'OPPONENT', 1969, '2026-09-28 14:32:49', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007083', '33333333-1111-1111-1111-000000000042', '33333333-1111-1111-1111-000000000105', '550e8400-e29b-41d4-a716-446655440101', 'OWN', 1994, '2026-09-28 14:33:14', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007084', '33333333-1111-1111-1111-000000000042', NULL, '550e8400-e29b-41d4-a716-446655440112', 'OPPONENT', 2016, '2026-09-28 14:33:36', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007085', '33333333-1111-1111-1111-000000000042', NULL, '550e8400-e29b-41d4-a716-446655440116', 'OPPONENT', 2041, '2026-09-28 14:34:01', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007086', '33333333-1111-1111-1111-000000000042', '33333333-1111-1111-1111-000000000101', '550e8400-e29b-41d4-a716-446655440117', 'OWN', 2066, '2026-09-28 14:34:26', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007087', '33333333-1111-1111-1111-000000000042', '33333333-1111-1111-1111-000000000109', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 2088, '2026-09-28 14:34:48', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007088', '33333333-1111-1111-1111-000000000042', NULL, '550e8400-e29b-41d4-a716-446655440101', 'OPPONENT', 2113, '2026-09-28 14:35:13', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007089', '33333333-1111-1111-1111-000000000042', NULL, '550e8400-e29b-41d4-a716-446655440116', 'OPPONENT', 2138, '2026-09-28 14:35:38', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007090', '33333333-1111-1111-1111-000000000042', NULL, '550e8400-e29b-41d4-a716-446655440116', 'OPPONENT', 2160, '2026-09-28 14:36:00', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007091', '33333333-1111-1111-1111-000000000042', '33333333-1111-1111-1111-000000000115', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 2185, '2026-09-28 14:36:25', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007092', '33333333-1111-1111-1111-000000000042', NULL, '550e8400-e29b-41d4-a716-446655440101', 'OPPONENT', 2210, '2026-09-28 14:36:50', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007093', '33333333-1111-1111-1111-000000000042', '33333333-1111-1111-1111-000000000103', '550e8400-e29b-41d4-a716-446655440116', 'OWN', 2232, '2026-09-28 14:37:12', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007094', '33333333-1111-1111-1111-000000000042', '33333333-1111-1111-1111-000000000104', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 2257, '2026-09-28 14:37:37', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007095', '33333333-1111-1111-1111-000000000042', NULL, '550e8400-e29b-41d4-a716-446655440112', 'OPPONENT', 2282, '2026-09-28 14:38:02', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007096', '33333333-1111-1111-1111-000000000042', '33333333-1111-1111-1111-000000000115', '550e8400-e29b-41d4-a716-446655440117', 'OWN', 2304, '2026-09-28 14:38:24', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007097', '33333333-1111-1111-1111-000000000042', NULL, '550e8400-e29b-41d4-a716-446655440116', 'OPPONENT', 2329, '2026-09-28 14:38:49', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007098', '33333333-1111-1111-1111-000000000042', NULL, '550e8400-e29b-41d4-a716-446655440117', 'OPPONENT', 2354, '2026-09-28 14:39:14', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000007099', '33333333-1111-1111-1111-000000000042', '33333333-1111-1111-1111-000000000109', '550e8400-e29b-41d4-a716-446655440112', 'OWN', 2376, '2026-09-28 14:39:36', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000005159', '33333333-1111-1111-1111-000000000043', NULL, '550e8400-e29b-41d4-a716-446655440117', 'OPPONENT', 4165, '2026-10-14 16:39:25', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);


-- =========================================

-- =========================================
-- NUEVO PARTIDO FINALIZADO (300 EVENTOS, 60 PENDIENTES)
-- =========================================
INSERT INTO matches (id, date, division_id, opponent_id, status, current_period, clock_elapsed_seconds, clock_paused, clock_updated_at, current_possession, home_score, away_score, started_at, finished_at) VALUES
('33333333-1111-1111-1111-000000000047', '2026-09-10 15:30:00', '11111111-1111-1111-1111-000000000020', '22222222-1111-1111-1111-000000000002', 'FINISHED', 2, 4800, true, CURRENT_TIMESTAMP, 'OWN', 0, 0, '2026-09-10 15:30:00', '2026-09-10 17:15:00');

INSERT INTO matches_players (id, role, division_id, match_id, slot_order, number, field_status, field_slot) VALUES
    ('55555555-5555-5555-5555-000000470000', 'TITULAR', '33333333-1111-1111-1111-000000000200', '33333333-1111-1111-1111-000000000047', 0, 1, 'EN_CANCHA', 1),
    ('55555555-5555-5555-5555-000000470001', 'TITULAR', '33333333-1111-1111-1111-000000000201', '33333333-1111-1111-1111-000000000047', 1, 2, 'EN_CANCHA', 2),
    ('55555555-5555-5555-5555-000000470002', 'TITULAR', '33333333-1111-1111-1111-000000000202', '33333333-1111-1111-1111-000000000047', 2, 3, 'EN_CANCHA', 3),
    ('55555555-5555-5555-5555-000000470003', 'TITULAR', '33333333-1111-1111-1111-000000000203', '33333333-1111-1111-1111-000000000047', 3, 4, 'EN_CANCHA', 4),
    ('55555555-5555-5555-5555-000000470004', 'TITULAR', '33333333-1111-1111-1111-000000000204', '33333333-1111-1111-1111-000000000047', 4, 5, 'EN_CANCHA', 5),
    ('55555555-5555-5555-5555-000000470005', 'TITULAR', '33333333-1111-1111-1111-000000000205', '33333333-1111-1111-1111-000000000047', 5, 6, 'EN_CANCHA', 6),
    ('55555555-5555-5555-5555-000000470006', 'TITULAR', '33333333-1111-1111-1111-000000000206', '33333333-1111-1111-1111-000000000047', 6, 7, 'EN_CANCHA', 7),
    ('55555555-5555-5555-5555-000000470007', 'TITULAR', '33333333-1111-1111-1111-000000000207', '33333333-1111-1111-1111-000000000047', 7, 8, 'EN_CANCHA', 8),
    ('55555555-5555-5555-5555-000000470008', 'TITULAR', '33333333-1111-1111-1111-000000000208', '33333333-1111-1111-1111-000000000047', 8, 9, 'EN_CANCHA', 9),
    ('55555555-5555-5555-5555-000000470009', 'TITULAR', '33333333-1111-1111-1111-000000000209', '33333333-1111-1111-1111-000000000047', 9, 10, 'EN_CANCHA', 10),
    ('55555555-5555-5555-5555-000000470010', 'TITULAR', '33333333-1111-1111-1111-000000000210', '33333333-1111-1111-1111-000000000047', 10, 11, 'EN_CANCHA', 11),
    ('55555555-5555-5555-5555-000000470011', 'TITULAR', '33333333-1111-1111-1111-000000000211', '33333333-1111-1111-1111-000000000047', 11, 12, 'EN_CANCHA', 12),
    ('55555555-5555-5555-5555-000000470012', 'TITULAR', '33333333-1111-1111-1111-000000000212', '33333333-1111-1111-1111-000000000047', 12, 13, 'EN_CANCHA', 13),
    ('55555555-5555-5555-5555-000000470013', 'TITULAR', '33333333-1111-1111-1111-000000000213', '33333333-1111-1111-1111-000000000047', 13, 14, 'EN_CANCHA', 14),
    ('55555555-5555-5555-5555-000000470014', 'TITULAR', '33333333-1111-1111-1111-000000000214', '33333333-1111-1111-1111-000000000047', 14, 15, 'EN_CANCHA', 15),
    ('55555555-5555-5555-5555-000000470015', 'SUPLENTE', '33333333-1111-1111-1111-000000000215', '33333333-1111-1111-1111-000000000047', 0, 16, 'EN_BANCO', NULL),
    ('55555555-5555-5555-5555-000000470016', 'SUPLENTE', '33333333-1111-1111-1111-000000000216', '33333333-1111-1111-1111-000000000047', 1, 17, 'EN_BANCO', NULL),
    ('55555555-5555-5555-5555-000000470017', 'SUPLENTE', '33333333-1111-1111-1111-000000000217', '33333333-1111-1111-1111-000000000047', 2, 18, 'EN_BANCO', NULL),
    ('55555555-5555-5555-5555-000000470018', 'SUPLENTE', '33333333-1111-1111-1111-000000000218', '33333333-1111-1111-1111-000000000047', 3, 19, 'EN_BANCO', NULL),
    ('55555555-5555-5555-5555-000000470019', 'SUPLENTE', '33333333-1111-1111-1111-000000000219', '33333333-1111-1111-1111-000000000047', 4, 20, 'EN_BANCO', NULL),
    ('55555555-5555-5555-5555-000000470020', 'SUPLENTE', '33333333-1111-1111-1111-000000000220', '33333333-1111-1111-1111-000000000047', 5, 21, 'EN_BANCO', NULL),
    ('55555555-5555-5555-5555-000000470021', 'SUPLENTE', '33333333-1111-1111-1111-000000000221', '33333333-1111-1111-1111-000000000047', 6, 22, 'EN_BANCO', NULL),
    ('55555555-5555-5555-5555-000000470022', 'SUPLENTE', '33333333-1111-1111-1111-000000000222', '33333333-1111-1111-1111-000000000047', 7, 23, 'EN_BANCO', NULL);

INSERT INTO events (id, match_id, player_id, event_type_id, team_possession, match_time, real_time, period, origin, active, created_at, synchronized_at) VALUES
    ('44444444-4444-4444-4444-000000008000', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000110', '550e8400-e29b-41d4-a716-446655440117', 'OWN', 0, '2026-09-10 15:30:00', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008001', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440116', 'OPPONENT', 17, '2026-09-10 15:30:17', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008002', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440116', 'OPPONENT', 34, '2026-09-10 15:30:34', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008003', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440116', 'OPPONENT', 48, '2026-09-10 15:30:48', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008004', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440115', 'OWN', 65, '2026-09-10 15:31:05', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008005', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000103', '550e8400-e29b-41d4-a716-446655440101', 'OWN', 82, '2026-09-10 15:31:22', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008006', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440115', 'OPPONENT', 96, '2026-09-10 15:31:36', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008007', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000105', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 113, '2026-09-10 15:31:53', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008008', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440115', 'OPPONENT', 130, '2026-09-10 15:32:10', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008009', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000103', '550e8400-e29b-41d4-a716-446655440112', 'OWN', 144, '2026-09-10 15:32:24', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008010', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000111', '550e8400-e29b-41d4-a716-446655440117', 'OWN', 161, '2026-09-10 15:32:41', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008011', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440116', 'OPPONENT', 178, '2026-09-10 15:32:58', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008012', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440112', 'OPPONENT', 192, '2026-09-10 15:33:12', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008013', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440101', 'OPPONENT', 209, '2026-09-10 15:33:29', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008014', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440116', 'OPPONENT', 226, '2026-09-10 15:33:46', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008015', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440101', 'OWN', 240, '2026-09-10 15:34:00', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008016', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440117', 'OPPONENT', 257, '2026-09-10 15:34:17', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008017', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440115', 'OPPONENT', 274, '2026-09-10 15:34:34', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008018', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440115', 'OPPONENT', 288, '2026-09-10 15:34:48', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008019', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440101', 'OPPONENT', 305, '2026-09-10 15:35:05', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008020', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440116', 'OPPONENT', 322, '2026-09-10 15:35:22', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008021', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000115', '550e8400-e29b-41d4-a716-446655440117', 'OWN', 336, '2026-09-10 15:35:36', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008022', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000111', '550e8400-e29b-41d4-a716-446655440101', 'OWN', 353, '2026-09-10 15:35:53', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008023', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000111', '550e8400-e29b-41d4-a716-446655440101', 'OWN', 370, '2026-09-10 15:36:10', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008024', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440112', 'OWN', 384, '2026-09-10 15:36:24', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008025', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000101', '550e8400-e29b-41d4-a716-446655440116', 'OWN', 401, '2026-09-10 15:36:41', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008026', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440117', 'OPPONENT', 418, '2026-09-10 15:36:58', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008027', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440116', 'OPPONENT', 432, '2026-09-10 15:37:12', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008028', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440112', 'OWN', 449, '2026-09-10 15:37:29', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008029', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000113', '550e8400-e29b-41d4-a716-446655440101', 'OWN', 466, '2026-09-10 15:37:46', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008030', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440117', 'OWN', 480, '2026-09-10 15:38:00', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008031', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440115', 'OPPONENT', 497, '2026-09-10 15:38:17', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008032', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000110', '550e8400-e29b-41d4-a716-446655440112', 'OWN', 514, '2026-09-10 15:38:34', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008033', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000105', '550e8400-e29b-41d4-a716-446655440101', 'OWN', 528, '2026-09-10 15:38:48', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008034', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440116', 'OWN', 545, '2026-09-10 15:39:05', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008035', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000114', '550e8400-e29b-41d4-a716-446655440101', 'OWN', 562, '2026-09-10 15:39:22', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008036', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440112', 'OWN', 576, '2026-09-10 15:39:36', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008037', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000110', '550e8400-e29b-41d4-a716-446655440112', 'OWN', 593, '2026-09-10 15:39:53', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008038', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440115', 'OWN', 610, '2026-09-10 15:40:10', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008039', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440101', 'OPPONENT', 624, '2026-09-10 15:40:24', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008040', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000107', '550e8400-e29b-41d4-a716-446655440112', 'OWN', 641, '2026-09-10 15:40:41', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008041', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440101', 'OPPONENT', 658, '2026-09-10 15:40:58', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008042', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000114', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 672, '2026-09-10 15:41:12', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008043', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440116', 'OPPONENT', 689, '2026-09-10 15:41:29', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008044', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000104', '550e8400-e29b-41d4-a716-446655440101', 'OWN', 706, '2026-09-10 15:41:46', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008045', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440116', 'OPPONENT', 720, '2026-09-10 15:42:00', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008046', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440101', 'OPPONENT', 737, '2026-09-10 15:42:17', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008047', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440101', 'OPPONENT', 754, '2026-09-10 15:42:34', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008048', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440112', 'OPPONENT', 768, '2026-09-10 15:42:48', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008049', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440116', 'OWN', 785, '2026-09-10 15:43:05', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008050', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440116', 'OWN', 802, '2026-09-10 15:43:22', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008051', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000113', '550e8400-e29b-41d4-a716-446655440116', 'OWN', 816, '2026-09-10 15:43:36', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008052', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000107', '550e8400-e29b-41d4-a716-446655440112', 'OWN', 833, '2026-09-10 15:43:53', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008053', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000115', '550e8400-e29b-41d4-a716-446655440101', 'OWN', 850, '2026-09-10 15:44:10', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008054', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000114', '550e8400-e29b-41d4-a716-446655440101', 'OWN', 864, '2026-09-10 15:44:24', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008055', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440112', 'OPPONENT', 881, '2026-09-10 15:44:41', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008056', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440115', 'OWN', 898, '2026-09-10 15:44:58', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008057', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440101', 'OWN', 912, '2026-09-10 15:45:12', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008058', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000109', '550e8400-e29b-41d4-a716-446655440101', 'OWN', 929, '2026-09-10 15:45:29', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008059', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440101', 'OPPONENT', 946, '2026-09-10 15:45:46', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008060', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440117', 'OPPONENT', 960, '2026-09-10 15:46:00', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008061', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000105', '550e8400-e29b-41d4-a716-446655440101', 'OWN', 977, '2026-09-10 15:46:17', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008062', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440112', 'OPPONENT', 994, '2026-09-10 15:46:34', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008063', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000106', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 1008, '2026-09-10 15:46:48', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008064', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440101', 'OPPONENT', 1025, '2026-09-10 15:47:05', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008065', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000107', '550e8400-e29b-41d4-a716-446655440117', 'OWN', 1042, '2026-09-10 15:47:22', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008066', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440101', 'OPPONENT', 1056, '2026-09-10 15:47:36', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008067', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440101', 'OPPONENT', 1073, '2026-09-10 15:47:53', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008068', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000108', '550e8400-e29b-41d4-a716-446655440116', 'OWN', 1090, '2026-09-10 15:48:10', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008069', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000109', '550e8400-e29b-41d4-a716-446655440101', 'OWN', 1104, '2026-09-10 15:48:24', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008070', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440116', 'OPPONENT', 1121, '2026-09-10 15:48:41', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008071', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000111', '550e8400-e29b-41d4-a716-446655440112', 'OWN', 1138, '2026-09-10 15:48:58', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008072', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440101', 'OWN', 1152, '2026-09-10 15:49:12', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008073', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440101', 'OPPONENT', 1169, '2026-09-10 15:49:29', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008074', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000102', '550e8400-e29b-41d4-a716-446655440117', 'OWN', 1186, '2026-09-10 15:49:46', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008075', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000102', '550e8400-e29b-41d4-a716-446655440116', 'OWN', 1200, '2026-09-10 15:50:00', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008076', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000104', '550e8400-e29b-41d4-a716-446655440116', 'OWN', 1217, '2026-09-10 15:50:17', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008077', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440116', 'OWN', 1234, '2026-09-10 15:50:34', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008078', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440112', 'OPPONENT', 1248, '2026-09-10 15:50:48', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008079', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000110', '550e8400-e29b-41d4-a716-446655440112', 'OWN', 1265, '2026-09-10 15:51:05', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008080', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440112', 'OPPONENT', 1282, '2026-09-10 15:51:22', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008081', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440115', 'OPPONENT', 1296, '2026-09-10 15:51:36', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008082', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440112', 'OWN', 1313, '2026-09-10 15:51:53', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008083', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000114', '550e8400-e29b-41d4-a716-446655440116', 'OWN', 1330, '2026-09-10 15:52:10', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008084', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440115', 'OWN', 1344, '2026-09-10 15:52:24', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008085', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440101', 'OPPONENT', 1361, '2026-09-10 15:52:41', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008086', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000113', '550e8400-e29b-41d4-a716-446655440117', 'OWN', 1378, '2026-09-10 15:52:58', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008087', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440112', 'OPPONENT', 1392, '2026-09-10 15:53:12', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008088', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000102', '550e8400-e29b-41d4-a716-446655440116', 'OWN', 1409, '2026-09-10 15:53:29', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008089', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440101', 'OPPONENT', 1426, '2026-09-10 15:53:46', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008090', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440112', 'OPPONENT', 1440, '2026-09-10 15:54:00', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008091', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000101', '550e8400-e29b-41d4-a716-446655440117', 'OWN', 1457, '2026-09-10 15:54:17', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008092', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440117', 'OPPONENT', 1474, '2026-09-10 15:54:34', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008093', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000107', '550e8400-e29b-41d4-a716-446655440112', 'OWN', 1488, '2026-09-10 15:54:48', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008094', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000112', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 1505, '2026-09-10 15:55:05', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008095', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000114', '550e8400-e29b-41d4-a716-446655440101', 'OWN', 1522, '2026-09-10 15:55:22', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008096', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000110', '550e8400-e29b-41d4-a716-446655440101', 'OWN', 1536, '2026-09-10 15:55:36', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008097', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440115', 'OPPONENT', 1553, '2026-09-10 15:55:53', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008098', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440115', 'OPPONENT', 1570, '2026-09-10 15:56:10', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008099', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000109', '550e8400-e29b-41d4-a716-446655440116', 'OWN', 1584, '2026-09-10 15:56:24', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008100', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440112', 'OPPONENT', 1601, '2026-09-10 15:56:41', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008101', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440112', 'OPPONENT', 1618, '2026-09-10 15:56:58', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008102', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440115', 'OWN', 1632, '2026-09-10 15:57:12', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008103', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000109', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 1649, '2026-09-10 15:57:29', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008104', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440101', 'OWN', 1666, '2026-09-10 15:57:46', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008105', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440101', 'OPPONENT', 1680, '2026-09-10 15:58:00', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008106', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000108', '550e8400-e29b-41d4-a716-446655440101', 'OWN', 1697, '2026-09-10 15:58:17', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008107', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440116', 'OPPONENT', 1714, '2026-09-10 15:58:34', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008108', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000106', '550e8400-e29b-41d4-a716-446655440117', 'OWN', 1728, '2026-09-10 15:58:48', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008109', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000107', '550e8400-e29b-41d4-a716-446655440101', 'OWN', 1745, '2026-09-10 15:59:05', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008110', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440112', 'OPPONENT', 1762, '2026-09-10 15:59:22', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008111', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440115', 'OPPONENT', 1776, '2026-09-10 15:59:36', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008112', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440101', 'OWN', 1793, '2026-09-10 15:59:53', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008113', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000101', '550e8400-e29b-41d4-a716-446655440112', 'OWN', 1810, '2026-09-10 16:00:10', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008114', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000110', '550e8400-e29b-41d4-a716-446655440117', 'OWN', 1824, '2026-09-10 16:00:24', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008115', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000112', '550e8400-e29b-41d4-a716-446655440117', 'OWN', 1841, '2026-09-10 16:00:41', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008116', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440112', 'OPPONENT', 1858, '2026-09-10 16:00:58', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008117', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440117', 'OPPONENT', 1872, '2026-09-10 16:01:12', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008118', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440115', 'OPPONENT', 1889, '2026-09-10 16:01:29', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008119', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440112', 'OWN', 1906, '2026-09-10 16:01:46', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008120', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000109', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 1920, '2026-09-10 16:02:00', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008121', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440117', 'OPPONENT', 1937, '2026-09-10 16:02:17', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008122', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440112', 'OWN', 1954, '2026-09-10 16:02:34', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008123', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000102', '550e8400-e29b-41d4-a716-446655440101', 'OWN', 1968, '2026-09-10 16:02:48', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008124', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440117', 'OPPONENT', 1985, '2026-09-10 16:03:05', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008125', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000105', '550e8400-e29b-41d4-a716-446655440117', 'OWN', 2002, '2026-09-10 16:03:22', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008126', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440101', 'OPPONENT', 2016, '2026-09-10 16:03:36', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008127', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000106', '550e8400-e29b-41d4-a716-446655440117', 'OWN', 2033, '2026-09-10 16:03:53', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008128', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440112', 'OWN', 2050, '2026-09-10 16:04:10', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008129', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000115', '550e8400-e29b-41d4-a716-446655440112', 'OWN', 2064, '2026-09-10 16:04:24', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008130', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440116', 'OWN', 2081, '2026-09-10 16:04:41', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008131', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440115', 'OWN', 2098, '2026-09-10 16:04:58', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008132', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000109', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 2112, '2026-09-10 16:05:12', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008133', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000102', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 2129, '2026-09-10 16:05:29', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008134', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440112', 'OPPONENT', 2146, '2026-09-10 16:05:46', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008135', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440117', 'OPPONENT', 2160, '2026-09-10 16:06:00', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008136', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000107', '550e8400-e29b-41d4-a716-446655440116', 'OWN', 2177, '2026-09-10 16:06:17', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008137', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440101', 'OWN', 2194, '2026-09-10 16:06:34', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008138', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000102', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 2208, '2026-09-10 16:06:48', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008139', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440115', 'OPPONENT', 2225, '2026-09-10 16:07:05', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008140', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440117', 'OWN', 2242, '2026-09-10 16:07:22', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008141', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000105', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 2256, '2026-09-10 16:07:36', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008142', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440101', 'OPPONENT', 2273, '2026-09-10 16:07:53', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008143', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000101', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 2290, '2026-09-10 16:08:10', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008144', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000114', '550e8400-e29b-41d4-a716-446655440101', 'OWN', 2304, '2026-09-10 16:08:24', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008145', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000105', '550e8400-e29b-41d4-a716-446655440117', 'OWN', 2321, '2026-09-10 16:08:41', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008146', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440115', 'OPPONENT', 2338, '2026-09-10 16:08:58', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008147', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440115', 'OPPONENT', 2352, '2026-09-10 16:09:12', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008148', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440116', 'OWN', 2369, '2026-09-10 16:09:29', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008149', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440101', 'OPPONENT', 2386, '2026-09-10 16:09:46', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008150', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440117', 'OWN', 2400, '2026-09-10 16:10:00', 1, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008151', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440112', 'OPPONENT', 2417, '2026-09-10 16:10:17', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008152', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440115', 'OWN', 2434, '2026-09-10 16:10:34', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008153', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440116', 'OPPONENT', 2448, '2026-09-10 16:10:48', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008154', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440115', 'OWN', 2465, '2026-09-10 16:11:05', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008155', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440112', 'OPPONENT', 2482, '2026-09-10 16:11:22', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008156', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000107', '550e8400-e29b-41d4-a716-446655440101', 'OWN', 2496, '2026-09-10 16:11:36', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008157', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000106', '550e8400-e29b-41d4-a716-446655440101', 'OWN', 2513, '2026-09-10 16:11:53', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008158', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000105', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 2530, '2026-09-10 16:12:10', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008159', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440117', 'OPPONENT', 2544, '2026-09-10 16:12:24', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008160', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440116', 'OPPONENT', 2561, '2026-09-10 16:12:41', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008161', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440112', 'OPPONENT', 2578, '2026-09-10 16:12:58', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008162', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440116', 'OWN', 2592, '2026-09-10 16:13:12', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008163', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440115', 'OPPONENT', 2609, '2026-09-10 16:13:29', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008164', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000103', '550e8400-e29b-41d4-a716-446655440101', 'OWN', 2626, '2026-09-10 16:13:46', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008165', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000106', '550e8400-e29b-41d4-a716-446655440101', 'OWN', 2640, '2026-09-10 16:14:00', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008166', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440101', 'OPPONENT', 2657, '2026-09-10 16:14:17', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008167', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000109', '550e8400-e29b-41d4-a716-446655440117', 'OWN', 2674, '2026-09-10 16:14:34', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008168', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000109', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 2688, '2026-09-10 16:14:48', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008169', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000112', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 2705, '2026-09-10 16:15:05', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008170', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440112', 'OPPONENT', 2722, '2026-09-10 16:15:22', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008171', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000111', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 2736, '2026-09-10 16:15:36', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008172', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000102', '550e8400-e29b-41d4-a716-446655440116', 'OWN', 2753, '2026-09-10 16:15:53', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008173', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440116', 'OPPONENT', 2770, '2026-09-10 16:16:10', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008174', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000113', '550e8400-e29b-41d4-a716-446655440116', 'OWN', 2784, '2026-09-10 16:16:24', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008175', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440112', 'OWN', 2801, '2026-09-10 16:16:41', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008176', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440101', 'OPPONENT', 2818, '2026-09-10 16:16:58', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008177', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440117', 'OPPONENT', 2832, '2026-09-10 16:17:12', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008178', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440112', 'OPPONENT', 2849, '2026-09-10 16:17:29', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008179', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000113', '550e8400-e29b-41d4-a716-446655440101', 'OWN', 2866, '2026-09-10 16:17:46', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008180', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000113', '550e8400-e29b-41d4-a716-446655440117', 'OWN', 2880, '2026-09-10 16:18:00', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008181', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000115', '550e8400-e29b-41d4-a716-446655440117', 'OWN', 2897, '2026-09-10 16:18:17', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008182', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440116', 'OPPONENT', 2914, '2026-09-10 16:18:34', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008183', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000103', '550e8400-e29b-41d4-a716-446655440101', 'OWN', 2928, '2026-09-10 16:18:48', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008184', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440116', 'OPPONENT', 2945, '2026-09-10 16:19:05', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008185', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440112', 'OWN', 2962, '2026-09-10 16:19:22', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008186', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000104', '550e8400-e29b-41d4-a716-446655440101', 'OWN', 2976, '2026-09-10 16:19:36', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008187', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440115', 'OWN', 2993, '2026-09-10 16:19:53', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008188', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440116', 'OWN', 3010, '2026-09-10 16:20:10', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008189', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440112', 'OWN', 3024, '2026-09-10 16:20:24', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008190', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440112', 'OWN', 3041, '2026-09-10 16:20:41', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008191', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000105', '550e8400-e29b-41d4-a716-446655440101', 'OWN', 3058, '2026-09-10 16:20:58', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008192', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000101', '550e8400-e29b-41d4-a716-446655440116', 'OWN', 3072, '2026-09-10 16:21:12', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008193', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440112', 'OPPONENT', 3089, '2026-09-10 16:21:29', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008194', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440101', 'OWN', 3106, '2026-09-10 16:21:46', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008195', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440112', 'OPPONENT', 3120, '2026-09-10 16:22:00', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008196', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000102', '550e8400-e29b-41d4-a716-446655440101', 'OWN', 3137, '2026-09-10 16:22:17', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008197', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440101', 'OWN', 3154, '2026-09-10 16:22:34', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008198', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440101', 'OPPONENT', 3168, '2026-09-10 16:22:48', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008199', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440101', 'OPPONENT', 3185, '2026-09-10 16:23:05', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008200', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000101', '550e8400-e29b-41d4-a716-446655440112', 'OWN', 3202, '2026-09-10 16:23:22', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008201', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440112', 'OWN', 3216, '2026-09-10 16:23:36', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008202', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440116', 'OWN', 3233, '2026-09-10 16:23:53', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008203', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440116', 'OWN', 3250, '2026-09-10 16:24:10', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008204', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440101', 'OWN', 3264, '2026-09-10 16:24:24', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008205', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000107', '550e8400-e29b-41d4-a716-446655440116', 'OWN', 3281, '2026-09-10 16:24:41', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008206', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440101', 'OWN', 3298, '2026-09-10 16:24:58', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008207', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000102', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 3312, '2026-09-10 16:25:12', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008208', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440116', 'OPPONENT', 3329, '2026-09-10 16:25:29', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008209', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440116', 'OWN', 3346, '2026-09-10 16:25:46', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008210', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440115', 'OPPONENT', 3360, '2026-09-10 16:26:00', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008211', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440116', 'OPPONENT', 3377, '2026-09-10 16:26:17', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008212', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000112', '550e8400-e29b-41d4-a716-446655440116', 'OWN', 3394, '2026-09-10 16:26:34', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008213', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000112', '550e8400-e29b-41d4-a716-446655440116', 'OWN', 3408, '2026-09-10 16:26:48', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008214', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440117', 'OPPONENT', 3425, '2026-09-10 16:27:05', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008215', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440117', 'OPPONENT', 3442, '2026-09-10 16:27:22', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008216', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440115', 'OWN', 3456, '2026-09-10 16:27:36', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008217', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440101', 'OPPONENT', 3473, '2026-09-10 16:27:53', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008218', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440116', 'OPPONENT', 3490, '2026-09-10 16:28:10', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008219', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000110', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 3504, '2026-09-10 16:28:24', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008220', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440117', 'OWN', 3521, '2026-09-10 16:28:41', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008221', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440101', 'OPPONENT', 3538, '2026-09-10 16:28:58', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008222', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440112', 'OWN', 3552, '2026-09-10 16:29:12', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008223', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440112', 'OWN', 3569, '2026-09-10 16:29:29', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008224', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440112', 'OPPONENT', 3586, '2026-09-10 16:29:46', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008225', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440115', 'OPPONENT', 3600, '2026-09-10 16:30:00', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008226', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000104', '550e8400-e29b-41d4-a716-446655440116', 'OWN', 3617, '2026-09-10 16:30:17', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008227', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440112', 'OPPONENT', 3634, '2026-09-10 16:30:34', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008228', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440115', 'OPPONENT', 3648, '2026-09-10 16:30:48', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008229', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000104', '550e8400-e29b-41d4-a716-446655440116', 'OWN', 3665, '2026-09-10 16:31:05', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008230', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000103', '550e8400-e29b-41d4-a716-446655440117', 'OWN', 3682, '2026-09-10 16:31:22', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008231', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440115', 'OPPONENT', 3696, '2026-09-10 16:31:36', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008232', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000110', '550e8400-e29b-41d4-a716-446655440112', 'OWN', 3713, '2026-09-10 16:31:53', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008233', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440112', 'OPPONENT', 3730, '2026-09-10 16:32:10', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008234', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440116', 'OWN', 3744, '2026-09-10 16:32:24', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008235', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000108', '550e8400-e29b-41d4-a716-446655440117', 'OWN', 3761, '2026-09-10 16:32:41', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008236', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000108', '550e8400-e29b-41d4-a716-446655440112', 'OWN', 3778, '2026-09-10 16:32:58', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008237', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000113', '550e8400-e29b-41d4-a716-446655440101', 'OWN', 3792, '2026-09-10 16:33:12', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008238', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440116', 'OPPONENT', 3809, '2026-09-10 16:33:29', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008239', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000110', '550e8400-e29b-41d4-a716-446655440117', 'OWN', 3826, '2026-09-10 16:33:46', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008240', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440115', 'OPPONENT', 3840, '2026-09-10 16:34:00', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008241', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000107', '550e8400-e29b-41d4-a716-446655440112', 'OWN', 3857, '2026-09-10 16:34:17', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008242', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440117', 'OPPONENT', 3874, '2026-09-10 16:34:34', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008243', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440101', 'OPPONENT', 3888, '2026-09-10 16:34:48', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008244', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000111', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 3905, '2026-09-10 16:35:05', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008245', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000106', '550e8400-e29b-41d4-a716-446655440112', 'OWN', 3922, '2026-09-10 16:35:22', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008246', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000105', '550e8400-e29b-41d4-a716-446655440112', 'OWN', 3936, '2026-09-10 16:35:36', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008247', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440116', 'OPPONENT', 3953, '2026-09-10 16:35:53', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008248', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000102', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 3970, '2026-09-10 16:36:10', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008249', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000111', '550e8400-e29b-41d4-a716-446655440117', 'OWN', 3984, '2026-09-10 16:36:24', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008250', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440116', 'OWN', 4001, '2026-09-10 16:36:41', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008251', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440117', 'OPPONENT', 4018, '2026-09-10 16:36:58', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008252', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000113', '550e8400-e29b-41d4-a716-446655440116', 'OWN', 4032, '2026-09-10 16:37:12', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008253', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000111', '550e8400-e29b-41d4-a716-446655440112', 'OWN', 4049, '2026-09-10 16:37:29', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008254', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440112', 'OWN', 4066, '2026-09-10 16:37:46', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008255', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000115', '550e8400-e29b-41d4-a716-446655440117', 'OWN', 4080, '2026-09-10 16:38:00', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008256', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440116', 'OPPONENT', 4097, '2026-09-10 16:38:17', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008257', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440116', 'OPPONENT', 4114, '2026-09-10 16:38:34', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008258', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440117', 'OWN', 4128, '2026-09-10 16:38:48', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008259', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000104', '550e8400-e29b-41d4-a716-446655440117', 'OWN', 4145, '2026-09-10 16:39:05', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008260', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440115', 'OPPONENT', 4162, '2026-09-10 16:39:22', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008261', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440115', 'OPPONENT', 4176, '2026-09-10 16:39:36', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008262', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000110', '550e8400-e29b-41d4-a716-446655440101', 'OWN', 4193, '2026-09-10 16:39:53', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008263', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000108', '550e8400-e29b-41d4-a716-446655440116', 'OWN', 4210, '2026-09-10 16:40:10', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008264', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440112', 'OPPONENT', 4224, '2026-09-10 16:40:24', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008265', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440101', 'OPPONENT', 4241, '2026-09-10 16:40:41', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008266', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440117', 'OPPONENT', 4258, '2026-09-10 16:40:58', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008267', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440117', 'OPPONENT', 4272, '2026-09-10 16:41:12', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008268', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000112', '550e8400-e29b-41d4-a716-446655440112', 'OWN', 4289, '2026-09-10 16:41:29', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008269', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440117', 'OWN', 4306, '2026-09-10 16:41:46', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008270', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440117', 'OWN', 4320, '2026-09-10 16:42:00', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008271', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440117', 'OPPONENT', 4337, '2026-09-10 16:42:17', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008272', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440101', 'OPPONENT', 4354, '2026-09-10 16:42:34', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008273', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000112', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 4368, '2026-09-10 16:42:48', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008274', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000102', '550e8400-e29b-41d4-a716-446655440117', 'OWN', 4385, '2026-09-10 16:43:05', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008275', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440117', 'OWN', 4402, '2026-09-10 16:43:22', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008276', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440115', 'OWN', 4416, '2026-09-10 16:43:36', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008277', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000113', '550e8400-e29b-41d4-a716-446655440101', 'OWN', 4433, '2026-09-10 16:43:53', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008278', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440115', 'OPPONENT', 4450, '2026-09-10 16:44:10', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008279', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000107', '550e8400-e29b-41d4-a716-446655440112', 'OWN', 4464, '2026-09-10 16:44:24', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008280', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440112', 'OPPONENT', 4481, '2026-09-10 16:44:41', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008281', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440115', 'OPPONENT', 4498, '2026-09-10 16:44:58', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008282', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440112', 'OWN', 4512, '2026-09-10 16:45:12', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008283', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440112', 'OWN', 4529, '2026-09-10 16:45:29', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008284', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440112', 'OWN', 4546, '2026-09-10 16:45:46', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008285', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440101', 'OPPONENT', 4560, '2026-09-10 16:46:00', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008286', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000106', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 4577, '2026-09-10 16:46:17', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008287', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000108', '550e8400-e29b-41d4-a716-446655440112', 'OWN', 4594, '2026-09-10 16:46:34', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008288', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000106', '550e8400-e29b-41d4-a716-446655440116', 'OWN', 4608, '2026-09-10 16:46:48', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008289', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000105', '550e8400-e29b-41d4-a716-446655440116', 'OWN', 4625, '2026-09-10 16:47:05', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008290', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000104', '550e8400-e29b-41d4-a716-446655440117', 'OWN', 4642, '2026-09-10 16:47:22', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008291', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000109', '550e8400-e29b-41d4-a716-446655440116', 'OWN', 4656, '2026-09-10 16:47:36', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008292', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440112', 'OPPONENT', 4673, '2026-09-10 16:47:53', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008293', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440116', 'OPPONENT', 4690, '2026-09-10 16:48:10', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008294', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440112', 'OPPONENT', 4704, '2026-09-10 16:48:24', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008295', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440116', 'OPPONENT', 4721, '2026-09-10 16:48:41', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008296', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000111', '550e8400-e29b-41d4-a716-446655440116', 'OWN', 4738, '2026-09-10 16:48:58', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008297', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440117', 'OPPONENT', 4752, '2026-09-10 16:49:12', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008298', '33333333-1111-1111-1111-000000000047', NULL, '550e8400-e29b-41d4-a716-446655440117', 'OPPONENT', 4769, '2026-09-10 16:49:29', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000008299', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000107', '550e8400-e29b-41d4-a716-446655440101', 'OWN', 4786, '2026-09-10 16:49:46', 2, 'APP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- =========================================
-- PARTIDO FINALIZADO CON 500 EVENTOS (CATALOGO V3 / TRELEW)
-- =========================================
INSERT INTO matches (id, date, division_id, opponent_id, status, current_period, clock_elapsed_seconds, clock_paused, clock_updated_at, current_possession, home_score, away_score, started_at, finished_at) VALUES
('33333333-1111-1111-1111-000000000048', '2026-10-17 15:30:00', '11111111-1111-1111-1111-000000000020', '22222222-1111-1111-1111-000000000001', 'FINISHED', 2, 4800, true, CURRENT_TIMESTAMP, 'OWN', 32, 21, '2026-10-17 15:30:00', '2026-10-17 17:15:00');

INSERT INTO matches_players (id, role, division_id, match_id, slot_order, number, field_status, field_slot) VALUES
    ('55555555-5555-5555-5555-000000480000', 'TITULAR', '33333333-1111-1111-1111-000000000200', '33333333-1111-1111-1111-000000000048', 0, 1, 'EN_CANCHA', 1),
    ('55555555-5555-5555-5555-000000480001', 'TITULAR', '33333333-1111-1111-1111-000000000201', '33333333-1111-1111-1111-000000000048', 1, 2, 'EN_CANCHA', 2),
    ('55555555-5555-5555-5555-000000480002', 'TITULAR', '33333333-1111-1111-1111-000000000202', '33333333-1111-1111-1111-000000000048', 2, 3, 'EN_CANCHA', 3),
    ('55555555-5555-5555-5555-000000480003', 'TITULAR', '33333333-1111-1111-1111-000000000203', '33333333-1111-1111-1111-000000000048', 3, 4, 'EN_CANCHA', 4),
    ('55555555-5555-5555-5555-000000480004', 'TITULAR', '33333333-1111-1111-1111-000000000204', '33333333-1111-1111-1111-000000000048', 4, 5, 'EN_CANCHA', 5),
    ('55555555-5555-5555-5555-000000480005', 'TITULAR', '33333333-1111-1111-1111-000000000205', '33333333-1111-1111-1111-000000000048', 5, 6, 'EN_CANCHA', 6),
    ('55555555-5555-5555-5555-000000480006', 'TITULAR', '33333333-1111-1111-1111-000000000206', '33333333-1111-1111-1111-000000000048', 6, 7, 'EN_CANCHA', 7),
    ('55555555-5555-5555-5555-000000480007', 'TITULAR', '33333333-1111-1111-1111-000000000207', '33333333-1111-1111-1111-000000000048', 7, 8, 'EN_CANCHA', 8),
    ('55555555-5555-5555-5555-000000480008', 'TITULAR', '33333333-1111-1111-1111-000000000208', '33333333-1111-1111-1111-000000000048', 8, 9, 'EN_CANCHA', 9),
    ('55555555-5555-5555-5555-000000480009', 'TITULAR', '33333333-1111-1111-1111-000000000209', '33333333-1111-1111-1111-000000000048', 9, 10, 'EN_CANCHA', 10),
    ('55555555-5555-5555-5555-000000480010', 'TITULAR', '33333333-1111-1111-1111-000000000210', '33333333-1111-1111-1111-000000000048', 10, 11, 'EN_CANCHA', 11),
    ('55555555-5555-5555-5555-000000480011', 'TITULAR', '33333333-1111-1111-1111-000000000211', '33333333-1111-1111-1111-000000000048', 11, 12, 'EN_CANCHA', 12),
    ('55555555-5555-5555-5555-000000480012', 'TITULAR', '33333333-1111-1111-1111-000000000212', '33333333-1111-1111-1111-000000000048', 12, 13, 'EN_CANCHA', 13),
    ('55555555-5555-5555-5555-000000480013', 'TITULAR', '33333333-1111-1111-1111-000000000213', '33333333-1111-1111-1111-000000000048', 13, 14, 'EN_CANCHA', 14),
    ('55555555-5555-5555-5555-000000480014', 'TITULAR', '33333333-1111-1111-1111-000000000214', '33333333-1111-1111-1111-000000000048', 14, 15, 'EN_CANCHA', 15),
    ('55555555-5555-5555-5555-000000480015', 'SUPLENTE', '33333333-1111-1111-1111-000000000227', '33333333-1111-1111-1111-000000000048', 0, 16, 'EN_BANCO', NULL),
    ('55555555-5555-5555-5555-000000480016', 'SUPLENTE', '33333333-1111-1111-1111-000000000228', '33333333-1111-1111-1111-000000000048', 1, 17, 'EN_BANCO', NULL),
    ('55555555-5555-5555-5555-000000480017', 'SUPLENTE', '33333333-1111-1111-1111-000000000229', '33333333-1111-1111-1111-000000000048', 2, 18, 'EN_BANCO', NULL),
    ('55555555-5555-5555-5555-000000480018', 'SUPLENTE', '33333333-1111-1111-1111-000000000230', '33333333-1111-1111-1111-000000000048', 3, 19, 'EN_BANCO', NULL),
    ('55555555-5555-5555-5555-000000480019', 'SUPLENTE', '33333333-1111-1111-1111-000000000231', '33333333-1111-1111-1111-000000000048', 4, 20, 'EN_BANCO', NULL),
    ('55555555-5555-5555-5555-000000480020', 'SUPLENTE', '33333333-1111-1111-1111-000000000232', '33333333-1111-1111-1111-000000000048', 5, 21, 'EN_BANCO', NULL),
    ('55555555-5555-5555-5555-000000480021', 'SUPLENTE', '33333333-1111-1111-1111-000000000233', '33333333-1111-1111-1111-000000000048', 6, 22, 'EN_BANCO', NULL),
    ('55555555-5555-5555-5555-000000480022', 'SUPLENTE', '33333333-1111-1111-1111-000000000234', '33333333-1111-1111-1111-000000000048', 7, 23, 'EN_BANCO', NULL);

INSERT INTO events (id, match_id, player_id, event_type_id, team_possession, match_time, absolute_match_time, real_time, period, origin, active, attributes, created_at, synchronized_at) VALUES
    ('44444444-4444-4444-4444-000000009000', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000102', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 33, 33, '2026-10-17 15:30:33', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009001', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000112', '550e8400-e29b-41d4-a716-446655440107', 'OWN', 39, 39, '2026-10-17 15:30:39', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009002', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440107', 'OPPONENT', 72, 72, '2026-10-17 15:31:12', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009003', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000113', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 84, 84, '2026-10-17 15:31:24', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009004', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440107', 'OWN', 93, 93, '2026-10-17 15:31:33', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009005', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440108', 'OPPONENT', 115, 115, '2026-10-17 15:31:55', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009006', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440115', 'OPPONENT', 126, 126, '2026-10-17 15:32:06', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009007', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000105', '550e8400-e29b-41d4-a716-446655440117', 'OWN', 133, 133, '2026-10-17 15:32:13', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009008', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440107', 'OPPONENT', 135, 135, '2026-10-17 15:32:15', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009009', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000106', '550e8400-e29b-41d4-a716-446655440106', 'OWN', 162, 162, '2026-10-17 15:32:42', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009010', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440122', 'OPPONENT', 181, 181, '2026-10-17 15:33:01', 1, 'APP', true, '{"infringement": "offside"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009011', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000110', '550e8400-e29b-41d4-a716-446655440113', 'OWN', 185, 185, '2026-10-17 15:33:05', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009012', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440108', 'OPPONENT', 194, 194, '2026-10-17 15:33:14', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009013', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000112', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 211, 211, '2026-10-17 15:33:31', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009014', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440115', 'OPPONENT', 218, 218, '2026-10-17 15:33:38', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009015', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440115', 'OPPONENT', 222, 222, '2026-10-17 15:33:42', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009016', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440111', 'OPPONENT', 223, 223, '2026-10-17 15:33:43', 1, 'APP', true, '{"outcome": "won"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009017', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440114', 'OPPONENT', 232, 232, '2026-10-17 15:33:52', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009018', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000107', '550e8400-e29b-41d4-a716-446655440106', 'OWN', 238, 238, '2026-10-17 15:33:58', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009019', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440106', 'OWN', 241, 241, '2026-10-17 15:34:01', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009020', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440106', 'OPPONENT', 253, 253, '2026-10-17 15:34:13', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009022', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440122', 'OPPONENT', 268, 268, '2026-10-17 15:34:28', 1, 'APP', true, '{"infringement": "offside"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009023', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000111', '550e8400-e29b-41d4-a716-446655440116', 'OWN', 277, 277, '2026-10-17 15:34:37', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009024', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440115', 'OWN', 282, 282, '2026-10-17 15:34:42', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009025', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000114', '550e8400-e29b-41d4-a716-446655440101', 'OWN', 287, 287, '2026-10-17 15:34:47', 1, 'APP', true, '{"zone": "center"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009026', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000110', '550e8400-e29b-41d4-a716-446655440102', 'OWN', 293, 293, '2026-10-17 15:34:53', 1, 'APP', true, '{"wasSuccessful": true}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009027', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000102', '550e8400-e29b-41d4-a716-446655440108', 'OWN', 303, 303, '2026-10-17 15:35:03', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009028', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000115', '550e8400-e29b-41d4-a716-446655440107', 'OWN', 309, 309, '2026-10-17 15:35:09', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009029', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000106', '550e8400-e29b-41d4-a716-446655440108', 'OWN', 311, 311, '2026-10-17 15:35:11', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009030', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000114', '550e8400-e29b-41d4-a716-446655440117', 'OWN', 316, 316, '2026-10-17 15:35:16', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009031', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440112', 'OPPONENT', 320, 320, '2026-10-17 15:35:20', 1, 'APP', true, '{"lineResult": "won_clean"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009032', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000114', '550e8400-e29b-41d4-a716-446655440110', 'OWN', 322, 322, '2026-10-17 15:35:22', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009033', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000114', '550e8400-e29b-41d4-a716-446655440106', 'OWN', 326, 326, '2026-10-17 15:35:26', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009034', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000107', '550e8400-e29b-41d4-a716-446655440111', 'OWN', 330, 330, '2026-10-17 15:35:30', 1, 'APP', true, '{"outcome": "won"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009035', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440110', 'OPPONENT', 338, 338, '2026-10-17 15:35:38', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009036', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440115', 'OPPONENT', 342, 342, '2026-10-17 15:35:42', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009037', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000106', '550e8400-e29b-41d4-a716-446655440120', 'OWN', 355, 355, '2026-10-17 15:35:55', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009038', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440106', 'OPPONENT', 357, 357, '2026-10-17 15:35:57', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009039', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440112', 'OPPONENT', 368, 368, '2026-10-17 15:36:08', 1, 'APP', true, '{"lineResult": "won_clean"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009040', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440108', 'OPPONENT', 377, 377, '2026-10-17 15:36:17', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009041', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000114', '550e8400-e29b-41d4-a716-446655440107', 'OWN', 381, 381, '2026-10-17 15:36:21', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009042', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000112', '550e8400-e29b-41d4-a716-446655440106', 'OWN', 383, 383, '2026-10-17 15:36:23', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009043', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440108', 'OPPONENT', 389, 389, '2026-10-17 15:36:29', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009044', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000115', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 397, 397, '2026-10-17 15:36:37', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009045', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440117', 'OPPONENT', 403, 403, '2026-10-17 15:36:43', 1, 'APP', true, '{"stealType": "knock_on"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009046', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000112', '550e8400-e29b-41d4-a716-446655440107', 'OWN', 414, 414, '2026-10-17 15:36:54', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009047', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440115', 'OPPONENT', 429, 429, '2026-10-17 15:37:09', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009048', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440107', 'OPPONENT', 432, 432, '2026-10-17 15:37:12', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009049', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440117', 'OPPONENT', 441, 441, '2026-10-17 15:37:21', 1, 'APP', true, '{"stealType": "knock_on"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009050', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440117', 'OWN', 450, 450, '2026-10-17 15:37:30', 1, 'APP', true, '{"stealType": "knock_on"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009051', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440111', 'OPPONENT', 451, 451, '2026-10-17 15:37:31', 1, 'APP', true, '{"outcome": "won"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009052', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440112', 'OPPONENT', 454, 454, '2026-10-17 15:37:34', 1, 'APP', true, '{"lineResult": "won_clean"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009053', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440120', 'OPPONENT', 462, 462, '2026-10-17 15:37:42', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009054', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000115', '550e8400-e29b-41d4-a716-446655440107', 'OWN', 473, 473, '2026-10-17 15:37:53', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009055', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000109', '550e8400-e29b-41d4-a716-446655440106', 'OWN', 474, 474, '2026-10-17 15:37:54', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009056', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000109', '550e8400-e29b-41d4-a716-446655440107', 'OWN', 475, 475, '2026-10-17 15:37:55', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009057', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000102', '550e8400-e29b-41d4-a716-446655440108', 'OWN', 476, 476, '2026-10-17 15:37:56', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009058', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000104', '550e8400-e29b-41d4-a716-446655440108', 'OWN', 478, 478, '2026-10-17 15:37:58', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009059', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440106', 'OPPONENT', 479, 479, '2026-10-17 15:37:59', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009060', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000111', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 499, 499, '2026-10-17 15:38:19', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009061', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440108', 'OWN', 508, 508, '2026-10-17 15:38:28', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009062', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440111', 'OPPONENT', 524, 524, '2026-10-17 15:38:44', 1, 'APP', true, '{"outcome": "won"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009063', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000111', '550e8400-e29b-41d4-a716-446655440120', 'OWN', 527, 527, '2026-10-17 15:38:47', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009064', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440109', 'OPPONENT', 537, 537, '2026-10-17 15:38:57', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009065', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000105', '550e8400-e29b-41d4-a716-446655440108', 'OWN', 540, 540, '2026-10-17 15:39:00', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009066', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000104', '550e8400-e29b-41d4-a716-446655440116', 'OWN', 570, 570, '2026-10-17 15:39:30', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009067', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440113', 'OPPONENT', 589, 589, '2026-10-17 15:39:49', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009068', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440106', 'OPPONENT', 594, 594, '2026-10-17 15:39:54', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009069', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440115', 'OWN', 607, 607, '2026-10-17 15:40:07', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009070', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440108', 'OPPONENT', 612, 612, '2026-10-17 15:40:12', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009071', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000114', '550e8400-e29b-41d4-a716-446655440107', 'OWN', 615, 615, '2026-10-17 15:40:15', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009072', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440108', 'OPPONENT', 626, 626, '2026-10-17 15:40:26', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009073', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440108', 'OWN', 633, 633, '2026-10-17 15:40:33', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009074', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440107', 'OWN', 634, 634, '2026-10-17 15:40:34', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009075', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000102', '550e8400-e29b-41d4-a716-446655440111', 'OWN', 641, 641, '2026-10-17 15:40:41', 1, 'APP', true, '{"outcome": "won"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009076', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000107', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 645, 645, '2026-10-17 15:40:45', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009077', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000109', '550e8400-e29b-41d4-a716-446655440107', 'OWN', 652, 652, '2026-10-17 15:40:52', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009078', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000113', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 696, 696, '2026-10-17 15:41:36', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009079', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000102', '550e8400-e29b-41d4-a716-446655440108', 'OWN', 711, 711, '2026-10-17 15:41:51', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009080', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440104', 'OPPONENT', 718, 718, '2026-10-17 15:41:58', 1, 'APP', true, '{"wasSuccessful": true, "distanceMeters": 32}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009081', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000112', '550e8400-e29b-41d4-a716-446655440107', 'OWN', 721, 721, '2026-10-17 15:42:01', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009082', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440107', 'OPPONENT', 727, 727, '2026-10-17 15:42:07', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009083', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000103', '550e8400-e29b-41d4-a716-446655440106', 'OWN', 733, 733, '2026-10-17 15:42:13', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009084', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440116', 'OPPONENT', 746, 746, '2026-10-17 15:42:26', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009085', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000112', '550e8400-e29b-41d4-a716-446655440106', 'OWN', 751, 751, '2026-10-17 15:42:31', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009086', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440108', 'OPPONENT', 802, 802, '2026-10-17 15:43:22', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009087', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440108', 'OPPONENT', 816, 816, '2026-10-17 15:43:36', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009088', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000111', '550e8400-e29b-41d4-a716-446655440107', 'OWN', 845, 845, '2026-10-17 15:44:05', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009089', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440107', 'OPPONENT', 873, 873, '2026-10-17 15:44:33', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009090', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000101', '550e8400-e29b-41d4-a716-446655440108', 'OWN', 879, 879, '2026-10-17 15:44:39', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009091', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440107', 'OPPONENT', 888, 888, '2026-10-17 15:44:48', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009092', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000109', '550e8400-e29b-41d4-a716-446655440107', 'OWN', 889, 889, '2026-10-17 15:44:49', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009093', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440110', 'OPPONENT', 890, 890, '2026-10-17 15:44:50', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009094', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000106', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 911, 911, '2026-10-17 15:45:11', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009095', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000113', '550e8400-e29b-41d4-a716-446655440106', 'OWN', 915, 915, '2026-10-17 15:45:15', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009096', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000101', '550e8400-e29b-41d4-a716-446655440106', 'OWN', 926, 926, '2026-10-17 15:45:26', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009097', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000105', '550e8400-e29b-41d4-a716-446655440106', 'OWN', 934, 934, '2026-10-17 15:45:34', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009098', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000111', '550e8400-e29b-41d4-a716-446655440107', 'OWN', 943, 943, '2026-10-17 15:45:43', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009099', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440106', 'OPPONENT', 950, 950, '2026-10-17 15:45:50', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009100', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000111', '550e8400-e29b-41d4-a716-446655440107', 'OWN', 975, 975, '2026-10-17 15:46:15', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009101', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000107', '550e8400-e29b-41d4-a716-446655440106', 'OWN', 982, 982, '2026-10-17 15:46:22', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009102', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000103', '550e8400-e29b-41d4-a716-446655440108', 'OWN', 1004, 1004, '2026-10-17 15:46:44', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009103', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000104', '550e8400-e29b-41d4-a716-446655440120', 'OWN', 1052, 1052, '2026-10-17 15:47:32', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009104', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440109', 'OPPONENT', 1054, 1054, '2026-10-17 15:47:34', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009105', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000109', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 1056, 1056, '2026-10-17 15:47:36', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009106', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000112', '550e8400-e29b-41d4-a716-446655440107', 'OWN', 1094, 1094, '2026-10-17 15:48:14', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009107', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000113', '550e8400-e29b-41d4-a716-446655440107', 'OWN', 1103, 1103, '2026-10-17 15:48:23', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009108', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000103', '550e8400-e29b-41d4-a716-446655440112', 'OWN', 1122, 1122, '2026-10-17 15:48:42', 1, 'APP', true, '{"lineResult": "won_clean"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009109', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440117', 'OPPONENT', 1126, 1126, '2026-10-17 15:48:46', 1, 'APP', true, '{"stealType": "knock_on"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009110', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000103', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 1127, 1127, '2026-10-17 15:48:47', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009111', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000109', '550e8400-e29b-41d4-a716-446655440128', 'OWN', 1133, 1133, '2026-10-17 15:48:53', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009112', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000110', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 1134, 1134, '2026-10-17 15:48:54', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009113', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440106', 'OPPONENT', 1149, 1149, '2026-10-17 15:49:09', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009114', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000107', '550e8400-e29b-41d4-a716-446655440108', 'OWN', 1168, 1168, '2026-10-17 15:49:28', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009115', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000113', '550e8400-e29b-41d4-a716-446655440107', 'OWN', 1183, 1183, '2026-10-17 15:49:43', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009116', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000111', '550e8400-e29b-41d4-a716-446655440116', 'OWN', 1186, 1186, '2026-10-17 15:49:46', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009117', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000104', '550e8400-e29b-41d4-a716-446655440122', 'OWN', 1193, 1193, '2026-10-17 15:49:53', 1, 'APP', true, '{"infringement": "offside"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009118', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000108', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 1215, 1215, '2026-10-17 15:50:15', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009119', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440106', 'OPPONENT', 1242, 1242, '2026-10-17 15:50:42', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009120', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000103', '550e8400-e29b-41d4-a716-446655440112', 'OWN', 1243, 1243, '2026-10-17 15:50:43', 1, 'APP', true, '{"lineResult": "won_clean"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009121', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440106', 'OPPONENT', 1248, 1248, '2026-10-17 15:50:48', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009122', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000104', '550e8400-e29b-41d4-a716-446655440108', 'OWN', 1271, 1271, '2026-10-17 15:51:11', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009123', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440115', 'OPPONENT', 1273, 1273, '2026-10-17 15:51:13', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009124', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000108', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 1278, 1278, '2026-10-17 15:51:18', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009125', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440115', 'OPPONENT', 1279, 1279, '2026-10-17 15:51:19', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009126', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440108', 'OPPONENT', 1284, 1284, '2026-10-17 15:51:24', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009127', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000114', '550e8400-e29b-41d4-a716-446655440110', 'OWN', 1287, 1287, '2026-10-17 15:51:27', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009128', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000105', '550e8400-e29b-41d4-a716-446655440108', 'OWN', 1288, 1288, '2026-10-17 15:51:28', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009129', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000108', '550e8400-e29b-41d4-a716-446655440108', 'OWN', 1290, 1290, '2026-10-17 15:51:30', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009131', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000111', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 1327, 1327, '2026-10-17 15:52:07', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009132', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440106', 'OPPONENT', 1331, 1331, '2026-10-17 15:52:11', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009133', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440108', 'OWN', 1334, 1334, '2026-10-17 15:52:14', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009134', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000109', '550e8400-e29b-41d4-a716-446655440107', 'OWN', 1336, 1336, '2026-10-17 15:52:16', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009135', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000111', '550e8400-e29b-41d4-a716-446655440101', 'OWN', 1338, 1338, '2026-10-17 15:52:18', 1, 'APP', true, '{"zone": "left"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009136', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000110', '550e8400-e29b-41d4-a716-446655440102', 'OWN', 1339, 1339, '2026-10-17 15:52:19', 1, 'APP', true, '{"wasSuccessful": true}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009137', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440115', 'OPPONENT', 1351, 1351, '2026-10-17 15:52:31', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009138', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440107', 'OPPONENT', 1358, 1358, '2026-10-17 15:52:38', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009139', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000115', '550e8400-e29b-41d4-a716-446655440120', 'OWN', 1372, 1372, '2026-10-17 15:52:52', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009140', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440108', 'OWN', 1396, 1396, '2026-10-17 15:53:16', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009141', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000108', '550e8400-e29b-41d4-a716-446655440108', 'OWN', 1398, 1398, '2026-10-17 15:53:18', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009142', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000105', '550e8400-e29b-41d4-a716-446655440112', 'OWN', 1399, 1399, '2026-10-17 15:53:19', 1, 'APP', true, '{"lineResult": "won_clean"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009143', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440107', 'OPPONENT', 1404, 1404, '2026-10-17 15:53:24', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009144', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440110', 'OPPONENT', 1421, 1421, '2026-10-17 15:53:41', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009145', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000103', '550e8400-e29b-41d4-a716-446655440108', 'OWN', 1439, 1439, '2026-10-17 15:53:59', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009146', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440117', 'OPPONENT', 1442, 1442, '2026-10-17 15:54:02', 1, 'APP', true, '{"stealType": "knock_on"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009147', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000108', '550e8400-e29b-41d4-a716-446655440108', 'OWN', 1445, 1445, '2026-10-17 15:54:05', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009148', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000111', '550e8400-e29b-41d4-a716-446655440107', 'OWN', 1446, 1446, '2026-10-17 15:54:06', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009149', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000110', '550e8400-e29b-41d4-a716-446655440106', 'OWN', 1448, 1448, '2026-10-17 15:54:08', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009150', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000105', '550e8400-e29b-41d4-a716-446655440106', 'OWN', 1449, 1449, '2026-10-17 15:54:09', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009151', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440108', 'OPPONENT', 1456, 1456, '2026-10-17 15:54:16', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009152', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000111', '550e8400-e29b-41d4-a716-446655440106', 'OWN', 1458, 1458, '2026-10-17 15:54:18', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009153', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000107', '550e8400-e29b-41d4-a716-446655440117', 'OWN', 1490, 1490, '2026-10-17 15:54:50', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009154', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000114', '550e8400-e29b-41d4-a716-446655440128', 'OWN', 1513, 1513, '2026-10-17 15:55:13', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009155', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440122', 'OPPONENT', 1518, 1518, '2026-10-17 15:55:18', 1, 'APP', true, '{"infringement": "offside"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009156', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000105', '550e8400-e29b-41d4-a716-446655440106', 'OWN', 1523, 1523, '2026-10-17 15:55:23', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009157', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440111', 'OPPONENT', 1534, 1534, '2026-10-17 15:55:34', 1, 'APP', true, '{"outcome": "won"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009158', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440106', 'OPPONENT', 1541, 1541, '2026-10-17 15:55:41', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009159', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440106', 'OWN', 1548, 1548, '2026-10-17 15:55:48', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009160', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440106', 'OPPONENT', 1565, 1565, '2026-10-17 15:56:05', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009161', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440112', 'OWN', 1568, 1568, '2026-10-17 15:56:08', 1, 'APP', true, '{"lineResult": "won_clean"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009162', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440115', 'OPPONENT', 1626, 1626, '2026-10-17 15:57:06', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009163', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440108', 'OPPONENT', 1629, 1629, '2026-10-17 15:57:09', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009164', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440120', 'OPPONENT', 1634, 1634, '2026-10-17 15:57:14', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009165', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000108', '550e8400-e29b-41d4-a716-446655440108', 'OWN', 1641, 1641, '2026-10-17 15:57:21', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009166', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000114', '550e8400-e29b-41d4-a716-446655440106', 'OWN', 1648, 1648, '2026-10-17 15:57:28', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009167', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000111', '550e8400-e29b-41d4-a716-446655440110', 'OWN', 1649, 1649, '2026-10-17 15:57:29', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009168', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440115', 'OPPONENT', 1653, 1653, '2026-10-17 15:57:33', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009169', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440122', 'OPPONENT', 1664, 1664, '2026-10-17 15:57:44', 1, 'APP', true, '{"infringement": "offside"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009170', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000110', '550e8400-e29b-41d4-a716-446655440107', 'OWN', 1667, 1667, '2026-10-17 15:57:47', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009171', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000107', '550e8400-e29b-41d4-a716-446655440106', 'OWN', 1690, 1690, '2026-10-17 15:58:10', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009172', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440106', 'OWN', 1702, 1702, '2026-10-17 15:58:22', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009173', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000115', '550e8400-e29b-41d4-a716-446655440107', 'OWN', 1704, 1704, '2026-10-17 15:58:24', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009174', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000108', '550e8400-e29b-41d4-a716-446655440108', 'OWN', 1711, 1711, '2026-10-17 15:58:31', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009175', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440101', 'OPPONENT', 1718, 1718, '2026-10-17 15:58:38', 1, 'APP', true, '{"zone": "right"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009176', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000109', '550e8400-e29b-41d4-a716-446655440110', 'OWN', 1727, 1727, '2026-10-17 15:58:47', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009177', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000104', '550e8400-e29b-41d4-a716-446655440106', 'OWN', 1732, 1732, '2026-10-17 15:58:52', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009178', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000107', '550e8400-e29b-41d4-a716-446655440106', 'OWN', 1740, 1740, '2026-10-17 15:59:00', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009179', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440107', 'OPPONENT', 1744, 1744, '2026-10-17 15:59:04', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009180', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000106', '550e8400-e29b-41d4-a716-446655440108', 'OWN', 1754, 1754, '2026-10-17 15:59:14', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009181', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440117', 'OWN', 1756, 1756, '2026-10-17 15:59:16', 1, 'APP', true, '{"stealType": "knock_on"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009182', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000110', '550e8400-e29b-41d4-a716-446655440120', 'OWN', 1765, 1765, '2026-10-17 15:59:25', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009183', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440115', 'OWN', 1766, 1766, '2026-10-17 15:59:26', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009184', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000111', '550e8400-e29b-41d4-a716-446655440110', 'OWN', 1768, 1768, '2026-10-17 15:59:28', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009185', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000105', '550e8400-e29b-41d4-a716-446655440114', 'OWN', 1769, 1769, '2026-10-17 15:59:29', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009186', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000101', '550e8400-e29b-41d4-a716-446655440108', 'OWN', 1770, 1770, '2026-10-17 15:59:30', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009187', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440107', 'OPPONENT', 1771, 1771, '2026-10-17 15:59:31', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009188', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440115', 'OWN', 1776, 1776, '2026-10-17 15:59:36', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009189', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440122', 'OPPONENT', 1792, 1792, '2026-10-17 15:59:52', 1, 'APP', true, '{"infringement": "offside"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009190', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000115', '550e8400-e29b-41d4-a716-446655440107', 'OWN', 1794, 1794, '2026-10-17 15:59:54', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009191', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000111', '550e8400-e29b-41d4-a716-446655440106', 'OWN', 1796, 1796, '2026-10-17 15:59:56', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009192', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000107', '550e8400-e29b-41d4-a716-446655440112', 'OWN', 1809, 1809, '2026-10-17 16:00:09', 1, 'APP', true, '{"lineResult": "won_clean"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009193', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000105', '550e8400-e29b-41d4-a716-446655440106', 'OWN', 1818, 1818, '2026-10-17 16:00:18', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009194', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440106', 'OWN', 1819, 1819, '2026-10-17 16:00:19', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009195', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000101', '550e8400-e29b-41d4-a716-446655440122', 'OWN', 1822, 1822, '2026-10-17 16:00:22', 1, 'APP', true, '{"infringement": "offside"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009196', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000110', '550e8400-e29b-41d4-a716-446655440106', 'OWN', 1824, 1824, '2026-10-17 16:00:24', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009197', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000114', '550e8400-e29b-41d4-a716-446655440106', 'OWN', 1844, 1844, '2026-10-17 16:00:44', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009198', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440123', 'OPPONENT', 1846, 1846, '2026-10-17 16:00:46', 1, 'APP', true, '{"reason": "Tackle peligroso"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009199', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000110', '550e8400-e29b-41d4-a716-446655440104', 'OWN', 1857, 1857, '2026-10-17 16:00:57', 1, 'APP', true, '{"wasSuccessful": true, "distanceMeters": 38}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009200', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000111', '550e8400-e29b-41d4-a716-446655440116', 'OWN', 1859, 1859, '2026-10-17 16:00:59', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009202', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000113', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 1866, 1866, '2026-10-17 16:01:06', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009203', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440116', 'OPPONENT', 1884, 1884, '2026-10-17 16:01:24', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009204', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440117', 'OPPONENT', 1891, 1891, '2026-10-17 16:01:31', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009205', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440115', 'OWN', 1892, 1892, '2026-10-17 16:01:32', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009206', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440116', 'OPPONENT', 1899, 1899, '2026-10-17 16:01:39', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009207', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000112', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 1908, 1908, '2026-10-17 16:01:48', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009208', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000109', '550e8400-e29b-41d4-a716-446655440107', 'OWN', 1928, 1928, '2026-10-17 16:02:08', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009209', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440110', 'OPPONENT', 1950, 1950, '2026-10-17 16:02:30', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009210', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000115', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 1958, 1958, '2026-10-17 16:02:38', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009211', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000108', '550e8400-e29b-41d4-a716-446655440108', 'OWN', 1969, 1969, '2026-10-17 16:02:49', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009212', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440106', 'OPPONENT', 1983, 1983, '2026-10-17 16:03:03', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009213', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440107', 'OPPONENT', 1997, 1997, '2026-10-17 16:03:17', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009214', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000105', '550e8400-e29b-41d4-a716-446655440108', 'OWN', 2001, 2001, '2026-10-17 16:03:21', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009215', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440107', 'OWN', 2016, 2016, '2026-10-17 16:03:36', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009216', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000113', '550e8400-e29b-41d4-a716-446655440106', 'OWN', 2031, 2031, '2026-10-17 16:03:51', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009217', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000104', '550e8400-e29b-41d4-a716-446655440108', 'OWN', 2045, 2045, '2026-10-17 16:04:05', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009218', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000113', '550e8400-e29b-41d4-a716-446655440109', 'OWN', 2057, 2057, '2026-10-17 16:04:17', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009219', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000115', '550e8400-e29b-41d4-a716-446655440109', 'OWN', 2071, 2071, '2026-10-17 16:04:31', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009220', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440115', 'OPPONENT', 2078, 2078, '2026-10-17 16:04:38', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009221', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000111', '550e8400-e29b-41d4-a716-446655440107', 'OWN', 2084, 2084, '2026-10-17 16:04:44', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009222', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440115', 'OPPONENT', 2086, 2086, '2026-10-17 16:04:46', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009223', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000104', '550e8400-e29b-41d4-a716-446655440117', 'OWN', 2096, 2096, '2026-10-17 16:04:56', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009224', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000111', '550e8400-e29b-41d4-a716-446655440106', 'OWN', 2098, 2098, '2026-10-17 16:04:58', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009225', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440128', 'OPPONENT', 2106, 2106, '2026-10-17 16:05:06', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009226', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000104', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 2110, 2110, '2026-10-17 16:05:10', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009228', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000105', '550e8400-e29b-41d4-a716-446655440106', 'OWN', 2154, 2154, '2026-10-17 16:05:54', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009229', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440106', 'OPPONENT', 2162, 2162, '2026-10-17 16:06:02', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009230', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000103', '550e8400-e29b-41d4-a716-446655440112', 'OWN', 2166, 2166, '2026-10-17 16:06:06', 1, 'APP', true, '{"lineResult": "won_clean"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009231', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440113', 'OPPONENT', 2180, 2180, '2026-10-17 16:06:20', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009232', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000102', '550e8400-e29b-41d4-a716-446655440108', 'OWN', 2181, 2181, '2026-10-17 16:06:21', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009233', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440107', 'OPPONENT', 2189, 2189, '2026-10-17 16:06:29', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009234', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000115', '550e8400-e29b-41d4-a716-446655440116', 'OWN', 2254, 2254, '2026-10-17 16:07:34', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009235', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440125', 'OPPONENT', 2266, 2266, '2026-10-17 16:07:46', 1, 'APP', true, '{"severity": "minor"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009236', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000111', '550e8400-e29b-41d4-a716-446655440113', 'OWN', 2286, 2286, '2026-10-17 16:08:06', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009237', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440106', 'OPPONENT', 2288, 2288, '2026-10-17 16:08:08', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009238', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440108', 'OPPONENT', 2296, 2296, '2026-10-17 16:08:16', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009239', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000114', '550e8400-e29b-41d4-a716-446655440107', 'OWN', 2305, 2305, '2026-10-17 16:08:25', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009240', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000109', '550e8400-e29b-41d4-a716-446655440107', 'OWN', 2308, 2308, '2026-10-17 16:08:28', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009241', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440114', 'OWN', 2317, 2317, '2026-10-17 16:08:37', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009242', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000105', '550e8400-e29b-41d4-a716-446655440120', 'OWN', 2320, 2320, '2026-10-17 16:08:40', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009243', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000113', '550e8400-e29b-41d4-a716-446655440116', 'OWN', 2327, 2327, '2026-10-17 16:08:47', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009244', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000112', '550e8400-e29b-41d4-a716-446655440107', 'OWN', 2332, 2332, '2026-10-17 16:08:52', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009245', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000109', '550e8400-e29b-41d4-a716-446655440107', 'OWN', 2356, 2356, '2026-10-17 16:09:16', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009246', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000113', '550e8400-e29b-41d4-a716-446655440107', 'OWN', 2359, 2359, '2026-10-17 16:09:19', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009247', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440115', 'OPPONENT', 2366, 2366, '2026-10-17 16:09:26', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009248', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000106', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 2375, 2375, '2026-10-17 16:09:35', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009249', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000112', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 2381, 2381, '2026-10-17 16:09:41', 1, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009250', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000104', '550e8400-e29b-41d4-a716-446655440108', 'OWN', 2414, 2414, '2026-10-17 16:20:14', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009251', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440117', 'OPPONENT', 2429, 2429, '2026-10-17 16:20:29', 2, 'APP', true, '{"stealType": "knock_on"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009252', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000107', '550e8400-e29b-41d4-a716-446655440114', 'OWN', 2474, 2474, '2026-10-17 16:21:14', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009253', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000114', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 2475, 2475, '2026-10-17 16:21:15', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009254', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440108', 'OPPONENT', 2482, 2482, '2026-10-17 16:21:22', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009255', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000113', '550e8400-e29b-41d4-a716-446655440106', 'OWN', 2485, 2485, '2026-10-17 16:21:25', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009256', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440106', 'OPPONENT', 2491, 2491, '2026-10-17 16:21:31', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009257', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440108', 'OPPONENT', 2517, 2517, '2026-10-17 16:21:57', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009258', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440116', 'OPPONENT', 2523, 2523, '2026-10-17 16:22:03', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009259', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000109', '550e8400-e29b-41d4-a716-446655440106', 'OWN', 2557, 2557, '2026-10-17 16:22:37', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009260', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000111', '550e8400-e29b-41d4-a716-446655440107', 'OWN', 2559, 2559, '2026-10-17 16:22:39', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009261', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440107', 'OPPONENT', 2562, 2562, '2026-10-17 16:22:42', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009262', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000102', '550e8400-e29b-41d4-a716-446655440122', 'OWN', 2564, 2564, '2026-10-17 16:22:44', 2, 'APP', true, '{"infringement": "offside"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009263', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440116', 'OPPONENT', 2568, 2568, '2026-10-17 16:22:48', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009264', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000115', '550e8400-e29b-41d4-a716-446655440110', 'OWN', 2576, 2576, '2026-10-17 16:22:56', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009265', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000107', '550e8400-e29b-41d4-a716-446655440112', 'OWN', 2579, 2579, '2026-10-17 16:22:59', 2, 'APP', true, '{"lineResult": "won_clean"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009266', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440107', 'OPPONENT', 2586, 2586, '2026-10-17 16:23:06', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009267', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000101', '550e8400-e29b-41d4-a716-446655440106', 'OWN', 2587, 2587, '2026-10-17 16:23:07', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009268', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440116', 'OPPONENT', 2589, 2589, '2026-10-17 16:23:09', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009269', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440122', 'OPPONENT', 2603, 2603, '2026-10-17 16:23:23', 2, 'APP', true, '{"infringement": "offside"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009270', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440117', 'OPPONENT', 2621, 2621, '2026-10-17 16:23:41', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009271', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440115', 'OPPONENT', 2622, 2622, '2026-10-17 16:23:42', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009272', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000105', '550e8400-e29b-41d4-a716-446655440108', 'OWN', 2626, 2626, '2026-10-17 16:23:46', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009273', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000102', '550e8400-e29b-41d4-a716-446655440108', 'OWN', 2661, 2661, '2026-10-17 16:24:21', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009274', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440117', 'OWN', 2665, 2665, '2026-10-17 16:24:25', 2, 'APP', true, '{"stealType": "knock_on"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009275', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440104', 'OPPONENT', 2666, 2666, '2026-10-17 16:24:26', 2, 'APP', true, '{"wasSuccessful": true, "distanceMeters": 28}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009276', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000108', '550e8400-e29b-41d4-a716-446655440120', 'OWN', 2677, 2677, '2026-10-17 16:24:37', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009277', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440113', 'OPPONENT', 2684, 2684, '2026-10-17 16:24:44', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009278', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440106', 'OPPONENT', 2685, 2685, '2026-10-17 16:24:45', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009279', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000106', '550e8400-e29b-41d4-a716-446655440112', 'OWN', 2724, 2724, '2026-10-17 16:25:24', 2, 'APP', true, '{"lineResult": "won_clean"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009280', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440106', 'OPPONENT', 2732, 2732, '2026-10-17 16:25:32', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009281', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000111', '550e8400-e29b-41d4-a716-446655440106', 'OWN', 2741, 2741, '2026-10-17 16:25:41', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009282', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000105', '550e8400-e29b-41d4-a716-446655440108', 'OWN', 2742, 2742, '2026-10-17 16:25:42', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009283', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000113', '550e8400-e29b-41d4-a716-446655440110', 'OWN', 2746, 2746, '2026-10-17 16:25:46', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009284', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440108', 'OPPONENT', 2751, 2751, '2026-10-17 16:25:51', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009285', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440106', 'OPPONENT', 2753, 2753, '2026-10-17 16:25:53', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009286', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000107', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 2755, 2755, '2026-10-17 16:25:55', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009287', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440107', 'OWN', 2758, 2758, '2026-10-17 16:25:58', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009288', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000106', '550e8400-e29b-41d4-a716-446655440112', 'OWN', 2783, 2783, '2026-10-17 16:26:23', 2, 'APP', true, '{"lineResult": "won_clean"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009289', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440117', 'OPPONENT', 2790, 2790, '2026-10-17 16:26:30', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009290', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000102', '550e8400-e29b-41d4-a716-446655440108', 'OWN', 2795, 2795, '2026-10-17 16:26:35', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009291', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000114', '550e8400-e29b-41d4-a716-446655440107', 'OWN', 2813, 2813, '2026-10-17 16:26:53', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009292', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440107', 'OWN', 2822, 2822, '2026-10-17 16:27:02', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009293', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000104', '550e8400-e29b-41d4-a716-446655440116', 'OWN', 2828, 2828, '2026-10-17 16:27:08', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009294', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440106', 'OPPONENT', 2831, 2831, '2026-10-17 16:27:11', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009295', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440108', 'OPPONENT', 2832, 2832, '2026-10-17 16:27:12', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009296', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000112', '550e8400-e29b-41d4-a716-446655440110', 'OWN', 2862, 2862, '2026-10-17 16:27:42', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009297', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000101', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 2863, 2863, '2026-10-17 16:27:43', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009298', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000110', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 2907, 2907, '2026-10-17 16:28:27', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009299', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000115', '550e8400-e29b-41d4-a716-446655440106', 'OWN', 2917, 2917, '2026-10-17 16:28:37', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009300', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440108', 'OPPONENT', 2918, 2918, '2026-10-17 16:28:38', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009301', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440107', 'OPPONENT', 2931, 2931, '2026-10-17 16:28:51', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009302', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440111', 'OWN', 2936, 2936, '2026-10-17 16:28:56', 2, 'APP', true, '{"outcome": "won"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009303', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000109', '550e8400-e29b-41d4-a716-446655440106', 'OWN', 2944, 2944, '2026-10-17 16:29:04', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009304', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000106', '550e8400-e29b-41d4-a716-446655440112', 'OWN', 2954, 2954, '2026-10-17 16:29:14', 2, 'APP', true, '{"lineResult": "won_clean"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009305', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000104', '550e8400-e29b-41d4-a716-446655440108', 'OWN', 2960, 2960, '2026-10-17 16:29:20', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009306', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440113', 'OWN', 2971, 2971, '2026-10-17 16:29:31', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009307', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000114', '550e8400-e29b-41d4-a716-446655440110', 'OWN', 2974, 2974, '2026-10-17 16:29:34', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009308', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000102', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 2976, 2976, '2026-10-17 16:29:36', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009310', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000112', '550e8400-e29b-41d4-a716-446655440101', 'OWN', 2996, 2996, '2026-10-17 16:29:56', 2, 'APP', true, '{"zone": "center"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009311', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000110', '550e8400-e29b-41d4-a716-446655440102', 'OWN', 3006, 3006, '2026-10-17 16:30:06', 2, 'APP', true, '{"wasSuccessful": true}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009312', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440110', 'OPPONENT', 3011, 3011, '2026-10-17 16:30:11', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009313', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440120', 'OWN', 3020, 3020, '2026-10-17 16:30:20', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009314', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000111', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 3023, 3023, '2026-10-17 16:30:23', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009315', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000115', '550e8400-e29b-41d4-a716-446655440107', 'OWN', 3025, 3025, '2026-10-17 16:30:25', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009316', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000108', '550e8400-e29b-41d4-a716-446655440117', 'OWN', 3039, 3039, '2026-10-17 16:30:39', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009317', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000115', '550e8400-e29b-41d4-a716-446655440106', 'OWN', 3042, 3042, '2026-10-17 16:30:42', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009318', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000112', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 3058, 3058, '2026-10-17 16:30:58', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009319', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440115', 'OPPONENT', 3064, 3064, '2026-10-17 16:31:04', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009320', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440108', 'OWN', 3071, 3071, '2026-10-17 16:31:11', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009321', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440115', 'OPPONENT', 3072, 3072, '2026-10-17 16:31:12', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009322', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440113', 'OPPONENT', 3086, 3086, '2026-10-17 16:31:26', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009323', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000105', '550e8400-e29b-41d4-a716-446655440108', 'OWN', 3114, 3114, '2026-10-17 16:31:54', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009324', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440106', 'OWN', 3125, 3125, '2026-10-17 16:32:05', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009325', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000111', '550e8400-e29b-41d4-a716-446655440106', 'OWN', 3146, 3146, '2026-10-17 16:32:26', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009326', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440107', 'OPPONENT', 3148, 3148, '2026-10-17 16:32:28', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009327', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000107', '550e8400-e29b-41d4-a716-446655440108', 'OWN', 3154, 3154, '2026-10-17 16:32:34', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009328', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000102', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 3173, 3173, '2026-10-17 16:32:53', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009329', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000110', '550e8400-e29b-41d4-a716-446655440107', 'OWN', 3175, 3175, '2026-10-17 16:32:55', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009330', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000109', '550e8400-e29b-41d4-a716-446655440110', 'OWN', 3179, 3179, '2026-10-17 16:32:59', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009331', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000101', '550e8400-e29b-41d4-a716-446655440106', 'OWN', 3190, 3190, '2026-10-17 16:33:10', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009332', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440115', 'OPPONENT', 3194, 3194, '2026-10-17 16:33:14', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009333', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440108', 'OWN', 3202, 3202, '2026-10-17 16:33:22', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009334', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000105', '550e8400-e29b-41d4-a716-446655440116', 'OWN', 3225, 3225, '2026-10-17 16:33:45', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009335', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000128', '550e8400-e29b-41d4-a716-446655440126', 'OWN', 3233, 3233, '2026-10-17 16:33:53', 2, 'APP', true, '{"subType": "tactical"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009336', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000130', '550e8400-e29b-41d4-a716-446655440126', 'OWN', 3285, 3285, '2026-10-17 16:34:45', 2, 'APP', true, '{"subType": "tactical"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009337', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000108', '550e8400-e29b-41d4-a716-446655440120', 'OWN', 3291, 3291, '2026-10-17 16:34:51', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009338', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000102', '550e8400-e29b-41d4-a716-446655440120', 'OWN', 3317, 3317, '2026-10-17 16:35:17', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009339', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440107', 'OPPONENT', 3327, 3327, '2026-10-17 16:35:27', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009340', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000102', '550e8400-e29b-41d4-a716-446655440108', 'OWN', 3335, 3335, '2026-10-17 16:35:35', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009341', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440106', 'OPPONENT', 3366, 3366, '2026-10-17 16:36:06', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009342', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440108', 'OPPONENT', 3373, 3373, '2026-10-17 16:36:13', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009343', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440106', 'OPPONENT', 3380, 3380, '2026-10-17 16:36:20', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009344', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000104', '550e8400-e29b-41d4-a716-446655440120', 'OWN', 3381, 3381, '2026-10-17 16:36:21', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009345', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000130', '550e8400-e29b-41d4-a716-446655440111', 'OWN', 3384, 3384, '2026-10-17 16:36:24', 2, 'APP', true, '{"outcome": "won"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009346', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440115', 'OPPONENT', 3387, 3387, '2026-10-17 16:36:27', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009347', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440106', 'OPPONENT', 3393, 3393, '2026-10-17 16:36:33', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009348', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000112', '550e8400-e29b-41d4-a716-446655440107', 'OWN', 3395, 3395, '2026-10-17 16:36:35', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009349', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000112', '550e8400-e29b-41d4-a716-446655440107', 'OWN', 3398, 3398, '2026-10-17 16:36:38', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009350', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000106', '550e8400-e29b-41d4-a716-446655440108', 'OWN', 3422, 3422, '2026-10-17 16:37:02', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009351', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000111', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 3432, 3432, '2026-10-17 16:37:12', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009352', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000112', '550e8400-e29b-41d4-a716-446655440117', 'OWN', 3440, 3440, '2026-10-17 16:37:20', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009353', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000107', '550e8400-e29b-41d4-a716-446655440108', 'OWN', 3445, 3445, '2026-10-17 16:37:25', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009354', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440117', 'OPPONENT', 3446, 3446, '2026-10-17 16:37:26', 2, 'APP', true, '{"stealType": "knock_on"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009355', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440108', 'OWN', 3456, 3456, '2026-10-17 16:37:36', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009356', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440115', 'OPPONENT', 3500, 3500, '2026-10-17 16:38:20', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009357', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000114', '550e8400-e29b-41d4-a716-446655440128', 'OWN', 3525, 3525, '2026-10-17 16:38:45', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009358', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440108', 'OPPONENT', 3527, 3527, '2026-10-17 16:38:47', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009359', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000114', '550e8400-e29b-41d4-a716-446655440107', 'OWN', 3562, 3562, '2026-10-17 16:39:22', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009360', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000106', '550e8400-e29b-41d4-a716-446655440123', 'OWN', 3566, 3566, '2026-10-17 16:39:26', 2, 'APP', true, '{"reason": "Infracción reiterada"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009361', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000110', '550e8400-e29b-41d4-a716-446655440109', 'OWN', 3571, 3571, '2026-10-17 16:39:31', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009362', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440107', 'OWN', 3575, 3575, '2026-10-17 16:39:35', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009363', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440120', 'OPPONENT', 3579, 3579, '2026-10-17 16:39:39', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009364', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440115', 'OPPONENT', 3583, 3583, '2026-10-17 16:39:43', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009365', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440106', 'OPPONENT', 3588, 3588, '2026-10-17 16:39:48', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009366', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440107', 'OPPONENT', 3601, 3601, '2026-10-17 16:40:01', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009367', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440109', 'OPPONENT', 3609, 3609, '2026-10-17 16:40:09', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009368', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440107', 'OPPONENT', 3619, 3619, '2026-10-17 16:40:19', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009369', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000112', '550e8400-e29b-41d4-a716-446655440107', 'OWN', 3641, 3641, '2026-10-17 16:40:41', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009370', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440110', 'OPPONENT', 3673, 3673, '2026-10-17 16:41:13', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009371', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000111', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 3675, 3675, '2026-10-17 16:41:15', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009372', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440106', 'OPPONENT', 3676, 3676, '2026-10-17 16:41:16', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009373', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000102', '550e8400-e29b-41d4-a716-446655440108', 'OWN', 3678, 3678, '2026-10-17 16:41:18', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009374', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000115', '550e8400-e29b-41d4-a716-446655440107', 'OWN', 3700, 3700, '2026-10-17 16:41:40', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009375', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440107', 'OPPONENT', 3713, 3713, '2026-10-17 16:41:53', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009376', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000112', '550e8400-e29b-41d4-a716-446655440107', 'OWN', 3724, 3724, '2026-10-17 16:42:04', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009377', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440107', 'OPPONENT', 3753, 3753, '2026-10-17 16:42:33', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009378', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440106', 'OWN', 3758, 3758, '2026-10-17 16:42:38', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009379', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440108', 'OPPONENT', 3767, 3767, '2026-10-17 16:42:47', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009380', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440122', 'OPPONENT', 3769, 3769, '2026-10-17 16:42:49', 2, 'APP', true, '{"infringement": "offside"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009381', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440115', 'OPPONENT', 3773, 3773, '2026-10-17 16:42:53', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009382', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000113', '550e8400-e29b-41d4-a716-446655440109', 'OWN', 3778, 3778, '2026-10-17 16:42:58', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009383', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000107', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 3781, 3781, '2026-10-17 16:43:01', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009384', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000105', '550e8400-e29b-41d4-a716-446655440106', 'OWN', 3787, 3787, '2026-10-17 16:43:07', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009385', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000131', '550e8400-e29b-41d4-a716-446655440126', 'OWN', 3793, 3793, '2026-10-17 16:43:13', 2, 'APP', true, '{"subType": "tactical"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009386', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000109', '550e8400-e29b-41d4-a716-446655440107', 'OWN', 3794, 3794, '2026-10-17 16:43:14', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009387', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000112', '550e8400-e29b-41d4-a716-446655440106', 'OWN', 3796, 3796, '2026-10-17 16:43:16', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009388', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440106', 'OPPONENT', 3807, 3807, '2026-10-17 16:43:27', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009389', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000111', '550e8400-e29b-41d4-a716-446655440128', 'OWN', 3814, 3814, '2026-10-17 16:43:34', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009390', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440107', 'OPPONENT', 3820, 3820, '2026-10-17 16:43:40', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009391', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000104', '550e8400-e29b-41d4-a716-446655440108', 'OWN', 3839, 3839, '2026-10-17 16:43:59', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009392', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440106', 'OPPONENT', 3840, 3840, '2026-10-17 16:44:00', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009393', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440112', 'OWN', 3851, 3851, '2026-10-17 16:44:11', 2, 'APP', true, '{"lineResult": "won_clean"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009394', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440115', 'OPPONENT', 3853, 3853, '2026-10-17 16:44:13', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009395', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000108', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 3870, 3870, '2026-10-17 16:44:30', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009396', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440115', 'OPPONENT', 3885, 3885, '2026-10-17 16:44:45', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009397', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000108', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 3890, 3890, '2026-10-17 16:44:50', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009398', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440107', 'OPPONENT', 3893, 3893, '2026-10-17 16:44:53', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009399', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440108', 'OWN', 3898, 3898, '2026-10-17 16:44:58', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009400', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000104', '550e8400-e29b-41d4-a716-446655440117', 'OWN', 3900, 3900, '2026-10-17 16:45:00', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009401', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000106', '550e8400-e29b-41d4-a716-446655440108', 'OWN', 3912, 3912, '2026-10-17 16:45:12', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009402', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000102', '550e8400-e29b-41d4-a716-446655440106', 'OWN', 3914, 3914, '2026-10-17 16:45:14', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009403', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000106', '550e8400-e29b-41d4-a716-446655440108', 'OWN', 3915, 3915, '2026-10-17 16:45:15', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009404', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000113', '550e8400-e29b-41d4-a716-446655440110', 'OWN', 3928, 3928, '2026-10-17 16:45:28', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009405', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000109', '550e8400-e29b-41d4-a716-446655440125', 'OWN', 3935, 3935, '2026-10-17 16:45:35', 2, 'APP', true, '{"severity": "minor"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009406', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000133', '550e8400-e29b-41d4-a716-446655440126', 'OWN', 3937, 3937, '2026-10-17 16:45:37', 2, 'APP', true, '{"subType": "injury"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009407', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000106', '550e8400-e29b-41d4-a716-446655440111', 'OWN', 3939, 3939, '2026-10-17 16:45:39', 2, 'APP', true, '{"outcome": "won"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009408', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440114', 'OPPONENT', 3943, 3943, '2026-10-17 16:45:43', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009409', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440107', 'OWN', 3950, 3950, '2026-10-17 16:45:50', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009410', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000128', '550e8400-e29b-41d4-a716-446655440111', 'OWN', 3951, 3951, '2026-10-17 16:45:51', 2, 'APP', true, '{"outcome": "won"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009411', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000107', '550e8400-e29b-41d4-a716-446655440116', 'OWN', 3972, 3972, '2026-10-17 16:46:12', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009412', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000131', '550e8400-e29b-41d4-a716-446655440106', 'OWN', 3982, 3982, '2026-10-17 16:46:22', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009413', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440107', 'OPPONENT', 3989, 3989, '2026-10-17 16:46:29', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009415', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440122', 'OPPONENT', 3992, 3992, '2026-10-17 16:46:32', 2, 'APP', true, '{"infringement": "offside"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009416', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440115', 'OPPONENT', 3994, 3994, '2026-10-17 16:46:34', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009417', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000102', '550e8400-e29b-41d4-a716-446655440114', 'OWN', 4007, 4007, '2026-10-17 16:46:47', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009418', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000108', '550e8400-e29b-41d4-a716-446655440108', 'OWN', 4013, 4013, '2026-10-17 16:46:53', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009419', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000133', '550e8400-e29b-41d4-a716-446655440107', 'OWN', 4031, 4031, '2026-10-17 16:47:11', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009420', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000104', '550e8400-e29b-41d4-a716-446655440111', 'OWN', 4039, 4039, '2026-10-17 16:47:19', 2, 'APP', true, '{"outcome": "won"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009421', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000128', '550e8400-e29b-41d4-a716-446655440112', 'OWN', 4046, 4046, '2026-10-17 16:47:26', 2, 'APP', true, '{"lineResult": "won_clean"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009422', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000128', '550e8400-e29b-41d4-a716-446655440112', 'OWN', 4082, 4082, '2026-10-17 16:48:02', 2, 'APP', true, '{"lineResult": "won_clean"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009423', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000106', '550e8400-e29b-41d4-a716-446655440112', 'OWN', 4090, 4090, '2026-10-17 16:48:10', 2, 'APP', true, '{"lineResult": "won_clean"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009424', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000104', '550e8400-e29b-41d4-a716-446655440113', 'OWN', 4107, 4107, '2026-10-17 16:48:27', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009425', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440101', 'OPPONENT', 4114, 4114, '2026-10-17 16:48:34', 2, 'APP', true, '{"zone": "center"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009426', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440102', 'OPPONENT', 4122, 4122, '2026-10-17 16:48:42', 2, 'APP', true, '{"wasSuccessful": true}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009427', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440108', 'OPPONENT', 4127, 4127, '2026-10-17 16:48:47', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009428', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440107', 'OPPONENT', 4141, 4141, '2026-10-17 16:49:01', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009429', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440107', 'OPPONENT', 4142, 4142, '2026-10-17 16:49:02', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009430', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440107', 'OPPONENT', 4146, 4146, '2026-10-17 16:49:06', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009431', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440106', 'OWN', 4166, 4166, '2026-10-17 16:49:26', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009432', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000110', '550e8400-e29b-41d4-a716-446655440107', 'OWN', 4197, 4197, '2026-10-17 16:49:57', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009433', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440115', 'OPPONENT', 4199, 4199, '2026-10-17 16:49:59', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009435', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000113', '550e8400-e29b-41d4-a716-446655440122', 'OWN', 4201, 4201, '2026-10-17 16:50:01', 2, 'APP', true, '{"infringement": "offside"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009436', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440108', 'OPPONENT', 4207, 4207, '2026-10-17 16:50:07', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009437', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440106', 'OPPONENT', 4209, 4209, '2026-10-17 16:50:09', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009438', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000110', '550e8400-e29b-41d4-a716-446655440120', 'OWN', 4212, 4212, '2026-10-17 16:50:12', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009439', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000104', '550e8400-e29b-41d4-a716-446655440106', 'OWN', 4227, 4227, '2026-10-17 16:50:27', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009440', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000134', '550e8400-e29b-41d4-a716-446655440126', 'OWN', 4245, 4245, '2026-10-17 16:50:45', 2, 'APP', true, '{"subType": "tactical"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009441', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000135', '550e8400-e29b-41d4-a716-446655440126', 'OWN', 4246, 4246, '2026-10-17 16:50:46', 2, 'APP', true, '{"subType": "tactical"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009442', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000102', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 4248, 4248, '2026-10-17 16:50:48', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009443', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440107', 'OPPONENT', 4250, 4250, '2026-10-17 16:50:50', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009444', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000115', '550e8400-e29b-41d4-a716-446655440107', 'OWN', 4253, 4253, '2026-10-17 16:50:53', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009445', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440106', 'OPPONENT', 4255, 4255, '2026-10-17 16:50:55', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009446', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440106', 'OPPONENT', 4280, 4280, '2026-10-17 16:51:20', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009447', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440110', 'OPPONENT', 4282, 4282, '2026-10-17 16:51:22', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009448', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000115', '550e8400-e29b-41d4-a716-446655440107', 'OWN', 4299, 4299, '2026-10-17 16:51:39', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009449', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000135', '550e8400-e29b-41d4-a716-446655440107', 'OWN', 4303, 4303, '2026-10-17 16:51:43', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009450', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440116', 'OPPONENT', 4311, 4311, '2026-10-17 16:51:51', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009451', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000110', '550e8400-e29b-41d4-a716-446655440107', 'OWN', 4329, 4329, '2026-10-17 16:52:09', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009452', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000110', '550e8400-e29b-41d4-a716-446655440106', 'OWN', 4333, 4333, '2026-10-17 16:52:13', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009453', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440112', 'OPPONENT', 4343, 4343, '2026-10-17 16:52:23', 2, 'APP', true, '{"lineResult": "won_clean"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009454', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000104', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 4347, 4347, '2026-10-17 16:52:27', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009455', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000114', '550e8400-e29b-41d4-a716-446655440106', 'OWN', 4356, 4356, '2026-10-17 16:52:36', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009456', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440117', 'OPPONENT', 4368, 4368, '2026-10-17 16:52:48', 2, 'APP', true, '{"stealType": "knock_on"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009457', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000114', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 4376, 4376, '2026-10-17 16:52:56', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009458', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440107', 'OPPONENT', 4399, 4399, '2026-10-17 16:53:19', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009459', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000104', '550e8400-e29b-41d4-a716-446655440108', 'OWN', 4440, 4440, '2026-10-17 16:54:00', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009460', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000106', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 4445, 4445, '2026-10-17 16:54:05', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009461', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440107', 'OWN', 4455, 4455, '2026-10-17 16:54:15', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009462', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000130', '550e8400-e29b-41d4-a716-446655440108', 'OWN', 4461, 4461, '2026-10-17 16:54:21', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009463', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000128', '550e8400-e29b-41d4-a716-446655440108', 'OWN', 4464, 4464, '2026-10-17 16:54:24', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009464', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000131', '550e8400-e29b-41d4-a716-446655440108', 'OWN', 4467, 4467, '2026-10-17 16:54:27', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009465', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440104', 'OPPONENT', 4474, 4474, '2026-10-17 16:54:34', 2, 'APP', true, '{"wasSuccessful": true, "distanceMeters": 42}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009466', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000114', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 4486, 4486, '2026-10-17 16:54:46', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009467', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440122', 'OPPONENT', 4487, 4487, '2026-10-17 16:54:47', 2, 'APP', true, '{"infringement": "offside"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009468', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440107', 'OPPONENT', 4490, 4490, '2026-10-17 16:54:50', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009469', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440116', 'OPPONENT', 4510, 4510, '2026-10-17 16:55:10', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009470', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440122', 'OPPONENT', 4518, 4518, '2026-10-17 16:55:18', 2, 'APP', true, '{"infringement": "offside"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009471', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440115', 'OPPONENT', 4519, 4519, '2026-10-17 16:55:19', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009472', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440115', 'OWN', 4521, 4521, '2026-10-17 16:55:21', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009473', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000130', '550e8400-e29b-41d4-a716-446655440108', 'OWN', 4534, 4534, '2026-10-17 16:55:34', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009474', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440111', 'OPPONENT', 4549, 4549, '2026-10-17 16:55:49', 2, 'APP', true, '{"outcome": "won"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009475', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000130', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 4552, 4552, '2026-10-17 16:55:52', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009476', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440106', 'OPPONENT', 4554, 4554, '2026-10-17 16:55:54', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009477', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000135', '550e8400-e29b-41d4-a716-446655440107', 'OWN', 4562, 4562, '2026-10-17 16:56:02', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009478', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000110', '550e8400-e29b-41d4-a716-446655440104', 'OWN', 4564, 4564, '2026-10-17 16:56:04', 2, 'APP', true, '{"wasSuccessful": true, "distanceMeters": 35}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009479', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000131', '550e8400-e29b-41d4-a716-446655440106', 'OWN', 4568, 4568, '2026-10-17 16:56:08', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009480', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000115', '550e8400-e29b-41d4-a716-446655440107', 'OWN', 4569, 4569, '2026-10-17 16:56:09', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009481', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440115', 'OPPONENT', 4595, 4595, '2026-10-17 16:56:35', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009482', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440117', 'OPPONENT', 4603, 4603, '2026-10-17 16:56:43', 2, 'APP', true, '{"stealType": "knock_on"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009484', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440106', 'OPPONENT', 4632, 4632, '2026-10-17 16:57:12', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009485', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000133', '550e8400-e29b-41d4-a716-446655440128', 'OWN', 4636, 4636, '2026-10-17 16:57:16', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009486', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000134', '550e8400-e29b-41d4-a716-446655440120', 'OWN', 4644, 4644, '2026-10-17 16:57:24', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009487', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440116', 'OWN', 4655, 4655, '2026-10-17 16:57:35', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009488', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000114', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 4677, 4677, '2026-10-17 16:57:57', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009489', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000128', '550e8400-e29b-41d4-a716-446655440106', 'OWN', 4678, 4678, '2026-10-17 16:57:58', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009490', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000130', '550e8400-e29b-41d4-a716-446655440115', 'OWN', 4679, 4679, '2026-10-17 16:57:59', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009491', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440108', 'OPPONENT', 4693, 4693, '2026-10-17 16:58:13', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009492', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000133', '550e8400-e29b-41d4-a716-446655440101', 'OWN', 4697, 4697, '2026-10-17 16:58:17', 2, 'APP', true, '{"zone": "right"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009493', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440106', 'OPPONENT', 4744, 4744, '2026-10-17 16:59:04', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009494', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440117', 'OWN', 4745, 4745, '2026-10-17 16:59:05', 2, 'APP', true, '{"stealType": "knock_on"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009495', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440106', 'OPPONENT', 4749, 4749, '2026-10-17 16:59:09', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009496', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440115', 'OPPONENT', 4763, 4763, '2026-10-17 16:59:23', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009497', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000133', '550e8400-e29b-41d4-a716-446655440109', 'OWN', 4785, 4785, '2026-10-17 16:59:45', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009498', '33333333-1111-1111-1111-000000000048', '33333333-1111-1111-1111-000000000134', '550e8400-e29b-41d4-a716-446655440107', 'OWN', 4791, 4791, '2026-10-17 16:59:51', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-000000009499', '33333333-1111-1111-1111-000000000048', NULL, '550e8400-e29b-41d4-a716-446655440106', 'OPPONENT', 4794, 4794, '2026-10-17 16:59:54', 2, 'APP', true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- RECALCULO DE MARCADORES (solo partidos del dataset demo; los del PMRC conservan su snapshot)
UPDATE matches m
SET 
  home_score = COALESCE((
    SELECT SUM(et.points) 
    FROM events e 
    JOIN event_types et ON e.event_type_id = et.id 
    WHERE e.match_id = m.id 
      AND e.team_possession = 'OWN' 
      AND e.active = true 
      AND et.is_scoring = true
  ), 0),
  away_score = COALESCE((
    SELECT SUM(et.points) 
    FROM events e 
    JOIN event_types et ON e.event_type_id = et.id 
    WHERE e.match_id = m.id 
      AND e.team_possession = 'OPPONENT' 
      AND e.active = true 
      AND et.is_scoring = true
  ), 0)
WHERE m.id IN ('33333333-1111-1111-1111-000000000040', '33333333-1111-1111-1111-000000000041', '33333333-1111-1111-1111-000000000042', '33333333-1111-1111-1111-000000000043', '33333333-1111-1111-1111-000000000044', '33333333-1111-1111-1111-000000000045', '33333333-1111-1111-1111-000000000046', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000048');

-- absolute_match_time para eventos del dataset demo que no lo traían
UPDATE events
SET absolute_match_time = match_time
WHERE absolute_match_time IS NULL AND match_id IN ('33333333-1111-1111-1111-000000000040', '33333333-1111-1111-1111-000000000041', '33333333-1111-1111-1111-000000000042', '33333333-1111-1111-1111-000000000043', '33333333-1111-1111-1111-000000000044', '33333333-1111-1111-1111-000000000045', '33333333-1111-1111-1111-000000000046', '33333333-1111-1111-1111-000000000047', '33333333-1111-1111-1111-000000000048');

-- =========================================
-- ZONAS DE CANCHA (tramos) — solo partidos FINISHED
-- =========================================
-- Solo se cargan tramos: los eventos (jugadores, posesión, atributos, tiempos) quedan tal como están en el seed.
-- Grilla fija 3x6: zone_row 1=izquierda 2=centro 3=derecha; zone_col 1=in-goal propio ... 6=in-goal rival.
-- Rangos semiabiertos [start_minute, end_minute): 1T 0–40, 2T 40–80, sin solapes dentro del mismo período.
-- La zona de un evento se deriva del tramo (EventZoneResolver). Para que lo que fija una posición caiga donde corresponde,
-- esos eventos tienen su propio tramo de 1 minuto: Try propio -> in-goal rival (col 6); Try rival -> nuestro in-goal (col 1);
-- Conversión / ingreso a 22 / patada a los palos -> cerca de esa zona; Kick-off -> campo medio (col 3/4).
-- En el partido 48 la fila del tramo coincide con el lado del try (attributes.zone: left/center/right = fila 1/2/3).
-- Límite: dos eventos contradictorios dentro del MISMO minuto comparten tramo; gana el de mayor prioridad
-- (Try > Conversión > Ingreso a 22 > Kick H > Kick-off). Quedan así sin cumplir su regla:
--   * 48: ingreso rival a 22 a 4'17" y a 49'47", y Kick-off propio a 49'31" y a 68'27'' (todos pegados a un try propio o rival).
--   * 47: 6 tries que caen en el mismo minuto que un try del otro equipo.
--   * Partido 48 vs Trelew RC (ganado 32–21): el juego se concentra en campo rival (cols 4–6). Huecos: 23'–27' y 58'–62'.
--   * Partido 47 vs Bigornia Club (ganado, 300 eventos): cobertura total 0'–80' ("Partido completo").
--   * Partido 44 vs Deportivo Portugués (perdido 23–25): el juego se queda en campo propio (cols 1–3). Huecos: 30'–35' y 61'–68'.
INSERT INTO match_zone_assignments (id, match_id, period, start_minute, end_minute, zone_row, zone_col) VALUES
    ('55555555-5555-5555-5555-000000000001', '33333333-1111-1111-1111-000000000048', 1, 0, 4, 2, 3),
    ('55555555-5555-5555-5555-000000000002', '33333333-1111-1111-1111-000000000048', 1, 4, 5, 2, 6),
    ('55555555-5555-5555-5555-000000000003', '33333333-1111-1111-1111-000000000048', 1, 5, 6, 2, 3),
    ('55555555-5555-5555-5555-000000000004', '33333333-1111-1111-1111-000000000048', 1, 6, 9, 2, 4),
    ('55555555-5555-5555-5555-000000000005', '33333333-1111-1111-1111-000000000048', 1, 9, 10, 2, 3),
    ('55555555-5555-5555-5555-000000000006', '33333333-1111-1111-1111-000000000048', 1, 10, 11, 2, 4),
    ('55555555-5555-5555-5555-000000000007', '33333333-1111-1111-1111-000000000048', 1, 11, 12, 2, 2),
    ('55555555-5555-5555-5555-000000000008', '33333333-1111-1111-1111-000000000048', 1, 12, 18, 1, 4),
    ('55555555-5555-5555-5555-000000000009', '33333333-1111-1111-1111-000000000048', 1, 18, 22, 3, 5),
    ('55555555-5555-5555-5555-000000000010', '33333333-1111-1111-1111-000000000048', 1, 22, 23, 1, 6),
    ('55555555-5555-5555-5555-000000000011', '33333333-1111-1111-1111-000000000048', 1, 27, 28, 3, 4),
    ('55555555-5555-5555-5555-000000000012', '33333333-1111-1111-1111-000000000048', 1, 28, 29, 3, 1),
    ('55555555-5555-5555-5555-000000000013', '33333333-1111-1111-1111-000000000048', 1, 29, 30, 3, 4),
    ('55555555-5555-5555-5555-000000000014', '33333333-1111-1111-1111-000000000048', 1, 30, 32, 3, 5),
    ('55555555-5555-5555-5555-000000000015', '33333333-1111-1111-1111-000000000048', 1, 32, 33, 3, 4),
    ('55555555-5555-5555-5555-000000000016', '33333333-1111-1111-1111-000000000048', 1, 33, 36, 2, 5),
    ('55555555-5555-5555-5555-000000000017', '33333333-1111-1111-1111-000000000048', 1, 36, 37, 2, 3),
    ('55555555-5555-5555-5555-000000000018', '33333333-1111-1111-1111-000000000048', 1, 37, 38, 2, 5),
    ('55555555-5555-5555-5555-000000000019', '33333333-1111-1111-1111-000000000048', 1, 38, 39, 2, 3),
    ('55555555-5555-5555-5555-000000000020', '33333333-1111-1111-1111-000000000048', 1, 39, 40, 2, 5),
    ('55555555-5555-5555-5555-000000000021', '33333333-1111-1111-1111-000000000048', 2, 40, 46, 2, 3),
    ('55555555-5555-5555-5555-000000000022', '33333333-1111-1111-1111-000000000048', 2, 46, 49, 2, 4),
    ('55555555-5555-5555-5555-000000000023', '33333333-1111-1111-1111-000000000048', 2, 49, 51, 2, 6),
    ('55555555-5555-5555-5555-000000000024', '33333333-1111-1111-1111-000000000048', 2, 51, 52, 2, 3),
    ('55555555-5555-5555-5555-000000000025', '33333333-1111-1111-1111-000000000048', 2, 52, 53, 2, 4),
    ('55555555-5555-5555-5555-000000000026', '33333333-1111-1111-1111-000000000048', 2, 53, 58, 1, 5),
    ('55555555-5555-5555-5555-000000000027', '33333333-1111-1111-1111-000000000048', 2, 62, 68, 2, 5),
    ('55555555-5555-5555-5555-000000000028', '33333333-1111-1111-1111-000000000048', 2, 68, 69, 2, 1),
    ('55555555-5555-5555-5555-000000000029', '33333333-1111-1111-1111-000000000048', 2, 69, 70, 2, 5),
    ('55555555-5555-5555-5555-000000000030', '33333333-1111-1111-1111-000000000048', 2, 70, 71, 2, 2),
    ('55555555-5555-5555-5555-000000000031', '33333333-1111-1111-1111-000000000048', 2, 71, 72, 2, 5),
    ('55555555-5555-5555-5555-000000000032', '33333333-1111-1111-1111-000000000048', 2, 72, 74, 2, 3),
    ('55555555-5555-5555-5555-000000000033', '33333333-1111-1111-1111-000000000048', 2, 74, 75, 2, 2),
    ('55555555-5555-5555-5555-000000000034', '33333333-1111-1111-1111-000000000048', 2, 75, 76, 2, 3),
    ('55555555-5555-5555-5555-000000000035', '33333333-1111-1111-1111-000000000048', 2, 76, 77, 2, 5),
    ('55555555-5555-5555-5555-000000000036', '33333333-1111-1111-1111-000000000048', 2, 77, 78, 2, 3),
    ('55555555-5555-5555-5555-000000000037', '33333333-1111-1111-1111-000000000048', 2, 78, 79, 3, 6),
    ('55555555-5555-5555-5555-000000000038', '33333333-1111-1111-1111-000000000048', 2, 79, 80, 2, 3),
    ('55555555-5555-5555-5555-000000001000', '33333333-1111-1111-1111-000000000047', 1, 0, 1, 2, 2),
    ('55555555-5555-5555-5555-000000001001', '33333333-1111-1111-1111-000000000047', 1, 1, 2, 2, 6),
    ('55555555-5555-5555-5555-000000001002', '33333333-1111-1111-1111-000000000047', 1, 2, 3, 2, 2),
    ('55555555-5555-5555-5555-000000001003', '33333333-1111-1111-1111-000000000047', 1, 3, 4, 1, 1),
    ('55555555-5555-5555-5555-000000001004', '33333333-1111-1111-1111-000000000047', 1, 4, 5, 3, 6),
    ('55555555-5555-5555-5555-000000001005', '33333333-1111-1111-1111-000000000047', 1, 5, 6, 1, 1),
    ('55555555-5555-5555-5555-000000001006', '33333333-1111-1111-1111-000000000047', 1, 6, 8, 2, 6),
    ('55555555-5555-5555-5555-000000001007', '33333333-1111-1111-1111-000000000047', 1, 8, 9, 3, 6),
    ('55555555-5555-5555-5555-000000001008', '33333333-1111-1111-1111-000000000047', 1, 9, 10, 2, 6),
    ('55555555-5555-5555-5555-000000001009', '33333333-1111-1111-1111-000000000047', 1, 10, 11, 3, 1),
    ('55555555-5555-5555-5555-000000001010', '33333333-1111-1111-1111-000000000047', 1, 11, 12, 2, 6),
    ('55555555-5555-5555-5555-000000001011', '33333333-1111-1111-1111-000000000047', 1, 12, 13, 1, 1),
    ('55555555-5555-5555-5555-000000001012', '33333333-1111-1111-1111-000000000047', 1, 13, 14, 2, 3),
    ('55555555-5555-5555-5555-000000001013', '33333333-1111-1111-1111-000000000047', 1, 14, 15, 2, 6),
    ('55555555-5555-5555-5555-000000001014', '33333333-1111-1111-1111-000000000047', 1, 15, 16, 3, 6),
    ('55555555-5555-5555-5555-000000001015', '33333333-1111-1111-1111-000000000047', 1, 16, 17, 1, 6),
    ('55555555-5555-5555-5555-000000001016', '33333333-1111-1111-1111-000000000047', 1, 17, 18, 1, 1),
    ('55555555-5555-5555-5555-000000001017', '33333333-1111-1111-1111-000000000047', 1, 18, 20, 3, 6),
    ('55555555-5555-5555-5555-000000001018', '33333333-1111-1111-1111-000000000047', 1, 20, 22, 3, 4),
    ('55555555-5555-5555-5555-000000001019', '33333333-1111-1111-1111-000000000047', 1, 22, 23, 1, 1),
    ('55555555-5555-5555-5555-000000001020', '33333333-1111-1111-1111-000000000047', 1, 23, 24, 2, 1),
    ('55555555-5555-5555-5555-000000001021', '33333333-1111-1111-1111-000000000047', 1, 24, 25, 2, 4),
    ('55555555-5555-5555-5555-000000001022', '33333333-1111-1111-1111-000000000047', 1, 25, 26, 2, 6),
    ('55555555-5555-5555-5555-000000001023', '33333333-1111-1111-1111-000000000047', 1, 26, 27, 2, 4),
    ('55555555-5555-5555-5555-000000001024', '33333333-1111-1111-1111-000000000047', 1, 27, 28, 2, 6),
    ('55555555-5555-5555-5555-000000001025', '33333333-1111-1111-1111-000000000047', 1, 28, 29, 3, 1),
    ('55555555-5555-5555-5555-000000001026', '33333333-1111-1111-1111-000000000047', 1, 29, 30, 1, 6),
    ('55555555-5555-5555-5555-000000001027', '33333333-1111-1111-1111-000000000047', 1, 30, 32, 1, 5),
    ('55555555-5555-5555-5555-000000001028', '33333333-1111-1111-1111-000000000047', 1, 32, 33, 3, 6),
    ('55555555-5555-5555-5555-000000001029', '33333333-1111-1111-1111-000000000047', 1, 33, 34, 3, 1),
    ('55555555-5555-5555-5555-000000001030', '33333333-1111-1111-1111-000000000047', 1, 34, 36, 1, 5),
    ('55555555-5555-5555-5555-000000001031', '33333333-1111-1111-1111-000000000047', 1, 36, 37, 2, 6),
    ('55555555-5555-5555-5555-000000001032', '33333333-1111-1111-1111-000000000047', 1, 37, 38, 1, 1),
    ('55555555-5555-5555-5555-000000001033', '33333333-1111-1111-1111-000000000047', 1, 38, 39, 3, 6),
    ('55555555-5555-5555-5555-000000001034', '33333333-1111-1111-1111-000000000047', 1, 39, 40, 2, 1),
    ('55555555-5555-5555-5555-000000001035', '33333333-1111-1111-1111-000000000047', 2, 40, 41, 2, 4),
    ('55555555-5555-5555-5555-000000001036', '33333333-1111-1111-1111-000000000047', 2, 41, 42, 3, 6),
    ('55555555-5555-5555-5555-000000001037', '33333333-1111-1111-1111-000000000047', 2, 42, 43, 2, 4),
    ('55555555-5555-5555-5555-000000001038', '33333333-1111-1111-1111-000000000047', 2, 43, 44, 2, 6),
    ('55555555-5555-5555-5555-000000001039', '33333333-1111-1111-1111-000000000047', 2, 44, 45, 3, 6),
    ('55555555-5555-5555-5555-000000001040', '33333333-1111-1111-1111-000000000047', 2, 45, 46, 2, 4),
    ('55555555-5555-5555-5555-000000001041', '33333333-1111-1111-1111-000000000047', 2, 46, 47, 2, 1),
    ('55555555-5555-5555-5555-000000001042', '33333333-1111-1111-1111-000000000047', 2, 47, 48, 2, 6),
    ('55555555-5555-5555-5555-000000001043', '33333333-1111-1111-1111-000000000047', 2, 48, 50, 3, 6),
    ('55555555-5555-5555-5555-000000001044', '33333333-1111-1111-1111-000000000047', 2, 50, 52, 2, 6),
    ('55555555-5555-5555-5555-000000001045', '33333333-1111-1111-1111-000000000047', 2, 52, 53, 1, 6),
    ('55555555-5555-5555-5555-000000001046', '33333333-1111-1111-1111-000000000047', 2, 53, 54, 1, 1),
    ('55555555-5555-5555-5555-000000001047', '33333333-1111-1111-1111-000000000047', 2, 54, 55, 3, 6),
    ('55555555-5555-5555-5555-000000001048', '33333333-1111-1111-1111-000000000047', 2, 55, 57, 2, 5),
    ('55555555-5555-5555-5555-000000001049', '33333333-1111-1111-1111-000000000047', 2, 57, 58, 1, 1),
    ('55555555-5555-5555-5555-000000001050', '33333333-1111-1111-1111-000000000047', 2, 58, 59, 2, 1),
    ('55555555-5555-5555-5555-000000001051', '33333333-1111-1111-1111-000000000047', 2, 59, 63, 2, 5),
    ('55555555-5555-5555-5555-000000001052', '33333333-1111-1111-1111-000000000047', 2, 63, 64, 3, 6),
    ('55555555-5555-5555-5555-000000001053', '33333333-1111-1111-1111-000000000047', 2, 64, 65, 3, 1),
    ('55555555-5555-5555-5555-000000001054', '33333333-1111-1111-1111-000000000047', 2, 65, 69, 1, 4),
    ('55555555-5555-5555-5555-000000001055', '33333333-1111-1111-1111-000000000047', 2, 69, 70, 1, 6),
    ('55555555-5555-5555-5555-000000001056', '33333333-1111-1111-1111-000000000047', 2, 70, 71, 1, 1),
    ('55555555-5555-5555-5555-000000001057', '33333333-1111-1111-1111-000000000047', 2, 71, 72, 1, 4),
    ('55555555-5555-5555-5555-000000001058', '33333333-1111-1111-1111-000000000047', 2, 72, 73, 2, 1),
    ('55555555-5555-5555-5555-000000001059', '33333333-1111-1111-1111-000000000047', 2, 73, 74, 1, 6),
    ('55555555-5555-5555-5555-000000001060', '33333333-1111-1111-1111-000000000047', 2, 74, 76, 2, 3),
    ('55555555-5555-5555-5555-000000001061', '33333333-1111-1111-1111-000000000047', 2, 76, 77, 3, 1),
    ('55555555-5555-5555-5555-000000001062', '33333333-1111-1111-1111-000000000047', 2, 77, 79, 2, 3),
    ('55555555-5555-5555-5555-000000001063', '33333333-1111-1111-1111-000000000047', 2, 79, 80, 2, 6),
    ('55555555-5555-5555-5555-000000002000', '33333333-1111-1111-1111-000000000044', 1, 0, 1, 2, 3),
    ('55555555-5555-5555-5555-000000002001', '33333333-1111-1111-1111-000000000044', 1, 1, 2, 2, 2),
    ('55555555-5555-5555-5555-000000002002', '33333333-1111-1111-1111-000000000044', 1, 2, 3, 2, 1),
    ('55555555-5555-5555-5555-000000002003', '33333333-1111-1111-1111-000000000044', 1, 3, 9, 2, 3),
    ('55555555-5555-5555-5555-000000002004', '33333333-1111-1111-1111-000000000044', 1, 9, 10, 3, 6),
    ('55555555-5555-5555-5555-000000002005', '33333333-1111-1111-1111-000000000044', 1, 10, 12, 2, 3),
    ('55555555-5555-5555-5555-000000002006', '33333333-1111-1111-1111-000000000044', 1, 12, 15, 3, 2),
    ('55555555-5555-5555-5555-000000002007', '33333333-1111-1111-1111-000000000044', 1, 15, 16, 2, 6),
    ('55555555-5555-5555-5555-000000002008', '33333333-1111-1111-1111-000000000044', 1, 16, 22, 3, 2),
    ('55555555-5555-5555-5555-000000002009', '33333333-1111-1111-1111-000000000044', 1, 22, 23, 2, 6),
    ('55555555-5555-5555-5555-000000002010', '33333333-1111-1111-1111-000000000044', 1, 23, 29, 2, 3),
    ('55555555-5555-5555-5555-000000002011', '33333333-1111-1111-1111-000000000044', 1, 29, 30, 2, 2),
    ('55555555-5555-5555-5555-000000002012', '33333333-1111-1111-1111-000000000044', 1, 35, 36, 2, 5),
    ('55555555-5555-5555-5555-000000002013', '33333333-1111-1111-1111-000000000044', 1, 36, 40, 2, 3),
    ('55555555-5555-5555-5555-000000002014', '33333333-1111-1111-1111-000000000044', 2, 40, 52, 2, 2),
    ('55555555-5555-5555-5555-000000002015', '33333333-1111-1111-1111-000000000044', 2, 52, 59, 1, 3),
    ('55555555-5555-5555-5555-000000002016', '33333333-1111-1111-1111-000000000044', 2, 59, 60, 1, 2),
    ('55555555-5555-5555-5555-000000002017', '33333333-1111-1111-1111-000000000044', 2, 60, 61, 1, 3),
    ('55555555-5555-5555-5555-000000002018', '33333333-1111-1111-1111-000000000044', 2, 68, 69, 2, 3),
    ('55555555-5555-5555-5555-000000002019', '33333333-1111-1111-1111-000000000044', 2, 69, 70, 1, 6),
    ('55555555-5555-5555-5555-000000002020', '33333333-1111-1111-1111-000000000044', 2, 70, 71, 2, 3),
    ('55555555-5555-5555-5555-000000002021', '33333333-1111-1111-1111-000000000044', 2, 71, 72, 2, 1),
    ('55555555-5555-5555-5555-000000002022', '33333333-1111-1111-1111-000000000044', 2, 72, 79, 2, 3),
    ('55555555-5555-5555-5555-000000002023', '33333333-1111-1111-1111-000000000044', 2, 79, 80, 2, 2);

-- =========================================
-- NOTAS DE EVENTOS (post-partido / Eventos) — solo partidos FINISHED
-- =========================================
-- Cada fila elige el evento n-ésimo (idx, base 0, por match_time) de un tipo y posesión dentro del partido,
-- así no depende de los UUID de los eventos.
UPDATE events e
SET note = n.note
FROM (VALUES
    -- Partido 48
    ('33333333-1111-1111-1111-000000000048', 'Try',                        'OWN',      0, 'Try tras tres fases de ruck cerca de la línea; el pack sostuvo el ritmo.'),
    ('33333333-1111-1111-1111-000000000048', 'Try',                        'OWN',      1, 'Salida de line-out ganado y continuidad por el centro.'),
    ('33333333-1111-1111-1111-000000000048', 'Try',                        'OWN',      2, 'Continuidad tras un ruck veloz; el apoyo llegó en el momento justo.'),
    ('33333333-1111-1111-1111-000000000048', 'Try',                        'OWN',      3, 'Lectura rápida del hueco en la defensa rival.'),
    ('33333333-1111-1111-1111-000000000048', 'Try',                        'OPPONENT', 0, 'La línea defensiva se abrió hacia el lado ciego.'),
    ('33333333-1111-1111-1111-000000000048', 'Try',                        'OPPONENT', 1, 'Try rival en la segunda parte; no se cerró el espacio tras el ruck.'),
    ('33333333-1111-1111-1111-000000000048', 'Conversión',                 'OWN',      0, 'Conversión acertada.'),
    ('33333333-1111-1111-1111-000000000048', 'Tarjeta Amarilla',           'OWN',      0, 'Infracción reiterada en el ruck; se defendió 10 minutos con uno menos.'),
    ('33333333-1111-1111-1111-000000000048', 'Tarjeta Amarilla',           'OPPONENT', 0, 'Tackle alto; aprovechamos la superioridad numérica.'),
    ('33333333-1111-1111-1111-000000000048', 'Lesión',                     'OWN',      0, 'Golpe en la rodilla; revisar con el kinesiólogo antes del próximo partido.'),
    ('33333333-1111-1111-1111-000000000048', 'Quiebre de línea',           'OWN',      0, 'Quiebre por el canal exterior; faltó apoyo cercano para finalizar la jugada.'),
    ('33333333-1111-1111-1111-000000000048', 'Quiebre de línea',           'OWN',      1, 'Buen ángulo de carrera del centro, con el pase en el momento justo.'),
    ('33333333-1111-1111-1111-000000000048', 'Penal / Infracción',         'OPPONENT', 0, 'Penal por fuera de juego.'),
    ('33333333-1111-1111-1111-000000000048', 'Scrum',                      'OWN',      0, 'Scrum estable; pelota ganada.'),
    ('33333333-1111-1111-1111-000000000048', 'Cambio / Sustitución',       'OWN',      0, 'Ingresa un jugador del banco por cansancio.'),
    ('33333333-1111-1111-1111-000000000048', 'Patada a touch',             'OWN',      0, 'Patada a touch que ganó territorio.'),
    ('33333333-1111-1111-1111-000000000048', 'Turnover',                    'OWN',      0, 'Robo en el ruck defensivo.'),
    ('33333333-1111-1111-1111-000000000048', 'Maul',                       'OWN',      0, 'Maul avanzado con buena coordinación del pack.'),
    -- Partido 47
    ('33333333-1111-1111-1111-000000000047', 'Try',                        'OWN',      0, 'Primer try del partido.'),
    ('33333333-1111-1111-1111-000000000047', 'Try',                        'OWN',      1, 'Try con buen apoyo interior.'),
    ('33333333-1111-1111-1111-000000000047', 'Try',                        'OPPONENT', 0, 'Try rival tras un tackle fallado.'),
    ('33333333-1111-1111-1111-000000000047', 'Line-out',                   'OWN',      0, 'Señal de salto clara; lanzamiento al segunda línea.'),
    ('33333333-1111-1111-1111-000000000047', 'Tackle fallado',             'OWN',      0, 'Tackle fallado por llegar con la cadera alta.'),
    ('33333333-1111-1111-1111-000000000047', 'Turnover',                    'OWN',      0, 'Turnover ganado con presión inmediata sobre el portador.'),
    ('33333333-1111-1111-1111-000000000047', 'Turnover',                    'OPPONENT', 0, 'Pérdida en el contacto; faltó limpiar el ruck.'),
    -- Partido 44
    ('33333333-1111-1111-1111-000000000044', 'Try',                        'OWN',      0, 'Primer try propio del partido.'),
    ('33333333-1111-1111-1111-000000000044', 'Try',                        'OPPONENT', 0, 'Try rival temprano; no se ordenó la defensa.'),
    ('33333333-1111-1111-1111-000000000044', 'Penal / Infracción',         'OWN',      0, 'Penal por no soltar en el tackle.'),
    ('33333333-1111-1111-1111-000000000044', 'Scrum',                      'OWN',      0, 'Scrum estable.'),
    ('33333333-1111-1111-1111-000000000044', 'Kick H (Penal a palos)',     'OWN',      0, 'Pateo a los palos por una infracción en campo rival.'),
    ('33333333-1111-1111-1111-000000000044', 'Line-out',                   'OPPONENT', 0, 'Line-out rival: faltó marcar al saltador.')
) AS n(match_id, type_name, possession, idx, note)
CROSS JOIN LATERAL (
    SELECT ev.id
    FROM events ev
    JOIN event_types et ON et.id = ev.event_type_id
    WHERE ev.match_id = n.match_id::uuid
      AND et.name = n.type_name
      AND ev.team_possession = n.possession
      AND ev.active = true
    ORDER BY ev.match_time, ev.id
    LIMIT 1 OFFSET n.idx
) t
WHERE e.id = t.id;



UPDATE event_types
SET template_event_fields = (
    SELECT jsonb_agg(
        CASE WHEN field->>'key' IN ('playerOutNumber', 'playerInNumber')
             THEN (field - 'max') || jsonb_build_object('min', 1)
             ELSE field END)
    FROM jsonb_array_elements(template_event_fields) AS field)
WHERE code = 'SUBSTITUTION';

UPDATE events
SET player_id = NULL
WHERE event_type_id IN (SELECT id FROM event_types WHERE code = 'SUBSTITUTION');
