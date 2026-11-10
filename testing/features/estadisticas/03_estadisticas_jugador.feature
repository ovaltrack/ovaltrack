# language: es
Característica: Estadísticas de un jugador
  Como jugador, entrenador o administrador del club
  Quiero ver las estadísticas de un jugador comparadas con el promedio del plantel de su división
  Para saber en qué está por encima o por debajo y en qué zonas de la cancha juega más

  Antecedentes:
    Dado que el coach con email "felipe.conte@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Y que existe un partido finalizado para la división "Primera" contra "Bigornia Club"
    Y que se registraron los siguientes eventos de jugadores en el partido:
      | tipo_evento       | jugador             | tiempo_segundos | periodo | atributos          |
      | Try               | Blue Album          | 300             | 1       | zone=left          |
      | Conversión        | Blue Album          | 360             | 1       | wasSuccessful=true |
      | Tackle completado | Blue Album          | 900             | 1       |                    |
      | Tackle completado | Blue Album          | 2700            | 2       |                    |
      | Tackle fallado    | Blue Album          | 3000            | 2       |                    |
      | Tackle completado | Art Angels          | 1200            | 1       |                    |

  Escenario: El entrenador ve lo que hizo el jugador en un partido comparado con el plantel de ese partido
    Cuando consulta las estadísticas de "Blue Album" en el partido
    Entonces el sistema responde con 200
    Y el partido del jugador informa un plantel de 15 jugadores
    Y las métricas del jugador en el partido incluyen:
      | campo              | valor |
      | points             | 7     |
      | tries              | 1     |
      | conversionsMade    | 1     |
      | conversionAttempts | 1     |
      | tacklesMade        | 2     |
      | tacklesMissed      | 1     |
      | actions            | 5     |
    Y la comparación con el plantel es:
      | metrica             | jugador | plantel | veredicto |
      | points              | 7       | 0.47    | ABOVE     |
      | tacklesMade         | 2       | 0.2     | ABOVE     |
      | tackleEffectiveness | 66.67   | 75      | BELOW     |
      | penaltiesConceded   | 0       | 0       | EQUAL     |
      | turnoversWon        | 0       | 0       | EQUAL     |

  Escenario: Los eventos del jugador se ubican en la zona del tramo asignado
    Dado que el partido tiene asignada la zona fila 1 columna 5 en el periodo 1 entre el minuto 0 y el minuto 40
    Cuando consulta las estadísticas de "Blue Album" en el partido
    Entonces el sistema responde con 200
    Y el mapa de zonas del jugador tiene 2 eventos en la celda fila 1 columna 5
    Y el mapa de zonas del jugador tiene 1 eventos en la celda fila 1 columna 6
    Y el mapa de zonas del jugador tiene 2 eventos sin zona

  Escenario: El entrenador ve las estadísticas generales del jugador en la temporada
    Cuando consulta las estadísticas generales de "Blue Album"
    Entonces el sistema responde con 200
    Y las estadísticas generales son de la división "Primera" en la temporada del partido
    Y la lista de partidos del jugador incluye el partido con 7 puntos y 2 tackles completados
    Y cada métrica comparada tiene un veredicto coherente con sus valores

  Escenario: El jugador ve sus propias estadísticas
    Dado que el jugador con email "jugador.uno@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Cuando consulta las estadísticas generales de "Blue Album"
    Entonces el sistema responde con 200
    Cuando consulta las estadísticas de "Blue Album" en el partido
    Entonces el sistema responde con 200

  Escenario: Un jugador no puede ver las estadísticas de otro jugador
    Dado que el jugador con email "jugador.uno@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Cuando consulta las estadísticas generales de "Art Angels"
    Entonces el sistema responde con 403 y "Acceso denegado: solo podés ver tus propias estadísticas"

  Escenario: Un administrador de otro club no puede ver las estadísticas del jugador
    Dado que el administrador del club con email "admin_multiclub@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Cuando consulta las estadísticas generales de "Blue Album"
    Entonces el sistema responde con 403 y "Acceso denegado: el jugador no pertenece a una división a su cargo"
    Cuando consulta las estadísticas de "Blue Album" en el partido
    Entonces el sistema responde con 403 y "Acceso denegado: la división no pertenece a su club"

  Escenario: Una persona que no integró el plantel no tiene estadísticas del partido
    Cuando consulta sus propias estadísticas en el partido
    Entonces el sistema responde con 404 y "El jugador no integró el plantel de ese partido"

  Escenario: Un partido inexistente no tiene estadísticas del jugador
    Cuando consulta las estadísticas de "Blue Album" en un partido inexistente
    Entonces el sistema responde con 404 y "Partido no encontrado"

  Escenario: Las estadísticas del jugador en un partido exigen el partido finalizado
    Dado que existe un partido en curso para la división "Primera" contra "Bigornia Club"
    Cuando consulta las estadísticas de "Blue Album" en el partido
    Entonces el sistema responde con 409 y "Las estadísticas del jugador solo están disponibles con el partido finalizado"
