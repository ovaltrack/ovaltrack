-- Restricción de zonas por tipo de evento: columna zone_rule (jsonb) del catálogo y reglas iniciales.
-- Idempotente: se puede ejecutar más de una vez.
ALTER TABLE event_types ADD COLUMN IF NOT EXISTS zone_rule JSONB;

-- zone_rule: zonas de la cancha donde puede ocurrir cada tipo (ver «zone_rule» en la cabecera del catálogo)
-- closesTramo: después del evento el juego se reinicia (saque o salida de 22), así que el tramo que lo contiene termina en su minuto
UPDATE event_types SET zone_rule = '{"columns":[6],"rowFrom":"zone","closesTramo":true}'::jsonb WHERE code = 'TRY';
UPDATE event_types SET zone_rule = '{"columns":[6],"rows":[2],"closesTramo":true}'::jsonb WHERE code = 'PENALTY_TRY';
UPDATE event_types SET zone_rule = '{"columns":[2,3,4,5],"rowFrom":"zone","closesTramo":true}'::jsonb WHERE code = 'PENALTY_KICK';
UPDATE event_types SET zone_rule = '{"columns":[2,3,4,5],"closesTramo":true}'::jsonb WHERE code = 'DROP_GOAL';
UPDATE event_types SET zone_rule = '{"columns":[2,3,4,5],"rowFrom":"zone"}'::jsonb WHERE code = 'CONVERSION';
UPDATE event_types SET zone_rule = '{"columns":[2,3,4,5]}'::jsonb WHERE code IN ('SCRUM', 'LINEOUT', 'MAUL', 'RUCK_OFFENSIVE', 'QUICK_PLAY');
-- Kick-off / Salida: de centro (col. 3-4), de 22m (2-3) o drop-out de ingol (1-2); nunca desde el campo rival
UPDATE event_types SET zone_rule = '{"columns":[1,2,3,4]}'::jsonb WHERE code = 'RESTART_KICK';
