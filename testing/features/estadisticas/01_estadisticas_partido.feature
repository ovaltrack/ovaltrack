# language: es
Característica: Estadísticas de un partido
  Como entrenador o analista
  Quiero ver las estadísticas de un partido por período
  Para evaluar el rendimiento del equipo

  Antecedentes:
    Dado que el coach con email "felipe.conte@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Y que existe un partido finalizado para la división "Primera" contra "Bigornia Club"
    Y que se han registrado los siguientes eventos en el partido:
      | tipo_evento       | posesion | tiempo_segundos | periodo | atributos          |
      | Try               | OWN      | 300             | 1       | zone=left          |
      | Conversión        | OWN      | 360             | 1       | wasSuccessful=true |
      | Try               | OPPONENT | 900             | 1       | zone=center        |
      | Tackle completado | OWN      | 600             | 1       |                    |
      | Tackle completado | OWN      | 700             | 1       |                    |
      | Tackle fallado    | OWN      | 800             | 1       |                    |
      | Turnover          | OWN      | 1000            | 1       |                    |
      | Try               | OWN      | 3000            | 2       | zone=right         |

  Escenario: Estadísticas del primer tiempo
    Cuando consulta las estadísticas del periodo 1 del partido
    Entonces el sistema responde con 200
    Y las estadísticas incluyen:
      | campo                  | valor |
      | ownScore               | 7     |
      | opponentScore          | 5     |
      | ownTries               | 1     |
      | opponentTries          | 1     |
      | ownConversions         | 1     |
      | ownTacklesCompleted    | 2     |
      | ownTacklesMissed       | 1     |
      | ownTackleEffectiveness | 66.7  |
      | ownTurnoversWon        | 1     |

  Escenario: Estadísticas del segundo tiempo
    Cuando consulta las estadísticas del periodo 2 del partido
    Entonces el sistema responde con 200
    Y las estadísticas incluyen:
      | campo               | valor |
      | ownScore            | 5     |
      | opponentScore       | 0     |
      | ownTries            | 1     |
      | ownTacklesCompleted | 0     |

  Escenario: Sin indicar el período se informa el primer tiempo
    Cuando consulta las estadísticas del partido sin indicar el período
    Entonces el sistema responde con 200
    Y las estadísticas incluyen:
      | campo         | valor |
      | period        | 1     |
      | ownScore      | 7     |
      | opponentScore | 5     |

  Escenario: Un evento eliminado deja de contar en las estadísticas
    Cuando el entrenador elimina el último evento agregado
    Y consulta las estadísticas del periodo 2 del partido
    Entonces las estadísticas incluyen:
      | campo    | valor |
      | ownScore | 0     |
      | ownTries | 0     |

  Escenario: Un partido inexistente no tiene estadísticas
    Cuando consulta las estadísticas de un partido inexistente
    Entonces el sistema responde con 404 y "Partido no encontrado"

  Escenario: Un administrador de otro club no puede ver las estadísticas del partido
    Cuando el administrador del club con email "admin_multiclub@test.com" y contraseña "PassSegura123!" intenta consultar las estadísticas de ese partido
    Entonces el sistema responde con 403

  Escenario: Un jugador no puede ver las estadísticas del partido
    Dado que el jugador con email "jugador.uno@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Cuando consulta las estadísticas del periodo 1 del partido
    Entonces el sistema responde con 403

  Escenario: Las estadísticas exigen una sesión iniciada
    Dado un usuario sin sesión iniciada en la plataforma
    Cuando consulta las estadísticas del periodo 1 del partido
    Entonces el sistema responde con 401

  Escenario: Estadísticas avanzadas de un partido finalizado
    Dado que el partido tiene asignada la zona fila 2 columna 5 en el periodo 2 entre el minuto 45 y el minuto 51
    Cuando consulta las estadísticas avanzadas del partido
    Entonces el sistema responde con 200
    Y las estadísticas avanzadas informan el primer tiempo, el segundo tiempo y el partido completo
    Y las estadísticas avanzadas del período "1" incluyen:
      | campo               | propio | rival |
      | possessions         | 2      | 1     |
      | pointsPerPossession | 3.5    | 5     |
      | turnoverPossessions | 1      | 0     |
    Y las estadísticas avanzadas del período "completo" incluyen:
      | campo               | propio | rival |
      | possessions         | 3      | 1     |
      | pointsPerPossession | 4      | 5     |
    Y el origen de los tries del período "completo" es:
      | fuente  | propio | rival |
      | OTHER   | 2      | 0     |
      | RESTART | 0      | 1     |
    Y la zona roja del período "2" informa 1 visita propia con 5 puntos

  Escenario: Las estadísticas avanzadas exigen el partido finalizado
    Dado que existe otro partido no iniciado para la división "Primera" contra "Bigornia Club"
    Cuando consulta las estadísticas avanzadas del partido
    Entonces el sistema responde con 409 y "Las estadísticas avanzadas solo están disponibles con el partido finalizado"

  Escenario: Un administrador de otro club no puede ver las estadísticas avanzadas del partido
    Cuando el administrador del club con email "admin_multiclub@test.com" y contraseña "PassSegura123!" intenta consultar las estadísticas avanzadas de ese partido
    Entonces el sistema responde con 403
