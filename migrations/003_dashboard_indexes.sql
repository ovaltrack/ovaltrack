-- Índices para las consultas del Inicio: divisiones por club, jugadores por división y partidos por jugador.
-- Aditivo y seguro de repetir; coincide con los @Index de las entidades.
CREATE INDEX IF NOT EXISTS idx_divisions_club
    ON divisions (club_id);

CREATE INDEX IF NOT EXISTS idx_division_players_division
    ON division_players (division_id);

-- La columna division_id de matches_players referencia a division_players.
CREATE INDEX IF NOT EXISTS idx_matches_players_division_player
    ON matches_players (division_id);
