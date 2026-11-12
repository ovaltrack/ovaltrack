-- Restricción de zonas por tipo de evento: columna zone_rule (jsonb) del catálogo y reglas iniciales.
-- Idempotente: se puede ejecutar más de una vez.
ALTER TABLE event_types ADD COLUMN IF NOT EXISTS zone_rule JSONB;

-- zone_rule: zonas de la cancha donde puede ocurrir cada tipo (ver «zone_rule» en la cabecera del catálogo)
UPDATE event_types SET zone_rule = '{"columns":[6],"rowFrom":"zone"}'::jsonb WHERE code = 'TRY';
UPDATE event_types SET zone_rule = '{"columns":[6],"rows":[2]}'::jsonb WHERE code = 'PENALTY_TRY';
UPDATE event_types SET zone_rule = '{"columns":[2,3,4,5],"rowFrom":"zone"}'::jsonb WHERE code IN ('CONVERSION', 'PENALTY_KICK');
UPDATE event_types SET zone_rule = '{"columns":[2,3,4,5]}'::jsonb WHERE code IN ('DROP_GOAL', 'SCRUM', 'LINEOUT', 'MAUL', 'RUCK_OFFENSIVE', 'QUICK_PLAY');
