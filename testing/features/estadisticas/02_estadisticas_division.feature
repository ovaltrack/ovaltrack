# language: es
Característica: Estadísticas de una división
  Como entrenador o analista
  Quiero ver las estadísticas de los partidos finalizados de mi división en un rango de fechas
  Para seguir la evolución del equipo

  Antecedentes:
    Dado que el coach con email "felipe.conte@test.com" y contraseña "PassSegura123!" ha iniciado sesión

  Escenario: El rango del día del partido incluye sus estadísticas del partido completo
    Dado que existe un partido finalizado para la división "Primera" contra "Bigornia Club"
    Y que se han registrado los siguientes eventos en el partido:
      | tipo_evento | posesion | tiempo_segundos | periodo | atributos   |
      | Try         | OWN      | 300             | 1       | zone=left   |
      | Try         | OPPONENT | 900             | 1       | zone=center |
      | Try         | OWN      | 3000            | 2       | zone=right  |
    Cuando consulta las estadísticas de la division "Primera" del día del partido
    Entonces el sistema responde con 200
    Y la división informa solo el partido consultado contra "Bigornia Club"
    Y las estadísticas del partido de la división incluyen:
      | campo         | valor |
      | ownScore      | 10    |
      | opponentScore | 5     |
      | ownTries      | 2     |

  Escenario: Las estadísticas de la división reconocen los tipos del catálogo y los pateos errados
    Dado que existe un partido finalizado para la división "Primera" contra "Bigornia Club"
    Y que se han registrado los siguientes eventos en el partido:
      | tipo_evento            | posesion | tiempo_segundos | periodo | atributos           |
      | Try penal              | OWN      | 300             | 1       |                     |
      | Kick H (Penal a palos) | OWN      | 900             | 1       | wasSuccessful=true  |
      | Conversión             | OWN      | 1200            | 1       | wasSuccessful=false |
      | Drop goal              | OPPONENT | 1500            | 1       | wasSuccessful=true  |
      | Penal / Infracción     | OPPONENT | 1800            | 1       |                     |
      | Tarjeta Amarilla       | OWN      | 2100            | 1       |                     |
    Cuando consulta las estadísticas de la division "Primera" del día del partido
    Entonces el sistema responde con 200
    Y las estadísticas del partido de la división incluyen:
      | campo                     | valor |
      | ownScore                  | 10    |
      | opponentScore             | 3     |
      | ownTries                  | 1     |
      | ownPenalties              | 1     |
      | ownConversions            | 0     |
      | opponentDropGoals         | 1     |
      | opponentPenaltiesConceded | 1     |
      | ownYellowCards            | 1     |

  Escenario: Un rango que no contiene la fecha del partido lo excluye
    Dado que existe un partido finalizado para la división "Primera" contra "Bigornia Club"
    Cuando consulta las estadísticas de la division "Primera" del día siguiente al partido
    Entonces el sistema responde con 200
    Y la división no informa el partido consultado

  Escenario: El rango de fechas no puede estar invertido
    Cuando consulta las estadísticas de la division "Primera" entre el "2027-03-10" y el "2027-03-01"
    Entonces el sistema responde con 400 y "El rango de fechas es inválido: 'from' es posterior a 'to'"

  Escenario: Una división inexistente no tiene estadísticas
    Cuando consulta las estadísticas de una división inexistente
    Entonces el sistema responde con 404 y "División no encontrada"

  Escenario: Un jugador no puede ver las estadísticas de la división
    Dado que el jugador con email "jugador.uno@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Cuando consulta las estadísticas de la division "Primera" entre el "2027-03-01" y el "2027-03-10"
    Entonces el sistema responde con 403
