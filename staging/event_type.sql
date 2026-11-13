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
--              closesTramo = true: después del evento el juego se reinicia, así que el tramo que lo contiene termina en su minuto.
--              Solo cuentan los tanteos que puntúan (un Kick H o un drop con wasSuccessful = false no cortan). Al guardar el evento el
--              backend acorta solo el tramo (TramoTrimmer) y lo que sigue queda como hueco.
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

ALTER TABLE event_types ADD COLUMN IF NOT EXISTS zone_rule JSONB;

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
-- closesTramo: después del evento el juego se reinicia (saque o salida de 22), así que el tramo que lo contiene termina en su minuto
UPDATE event_types SET zone_rule = '{"columns":[6],"rowFrom":"zone","closesTramo":true}'::jsonb WHERE code = 'TRY';
UPDATE event_types SET zone_rule = '{"columns":[6],"rows":[2],"closesTramo":true}'::jsonb WHERE code = 'PENALTY_TRY';
UPDATE event_types SET zone_rule = '{"columns":[2,3,4,5],"rowFrom":"zone","closesTramo":true}'::jsonb WHERE code = 'PENALTY_KICK';
UPDATE event_types SET zone_rule = '{"columns":[2,3,4,5],"closesTramo":true}'::jsonb WHERE code = 'DROP_GOAL';
UPDATE event_types SET zone_rule = '{"columns":[2,3,4,5],"rowFrom":"zone"}'::jsonb WHERE code = 'CONVERSION';
UPDATE event_types SET zone_rule = '{"columns":[2,3,4,5]}'::jsonb WHERE code IN ('SCRUM', 'LINEOUT', 'MAUL', 'RUCK_OFFENSIVE', 'QUICK_PLAY');
-- Kick-off / Salida: de centro (col. 3-4), de 22m (2-3) o drop-out de ingol (1-2); nunca desde el campo rival
UPDATE event_types SET zone_rule = '{"columns":[1,2,3,4]}'::jsonb WHERE code = 'RESTART_KICK';