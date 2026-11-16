# language: es
Característica: Partidos jugados por el jugador
  Como jugador de una división
  Quiero ver los partidos finalizados en los que estuve en la nómina
  Para seguir mi historial deportivo

  Escenario: El jugador ve los partidos finalizados en los que fue titular
    Dado que el coach con email "felipe.conte@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Y que existe un partido finalizado para la división "Primera" contra "Bigornia Club"
    Y que el jugador con email "jugador.uno@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Cuando consulta los partidos que jugó
    Entonces el sistema responde con 200
    Y la lista incluye el partido contra el rival de alias "BCR" con el rol "TITULAR"

  Escenario: El partido jugado informa cuándo terminó
    Dado que el coach con email "felipe.conte@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Y que existe un partido finalizado para la división "Primera" contra "Bigornia Club"
    Y que el jugador con email "jugador.uno@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Cuando consulta los partidos que jugó
    Entonces el sistema responde con 200
    Y el partido contra el rival de alias "BCR" informa su fecha de finalización

  Escenario: Un usuario que no integró ninguna nómina no tiene partidos jugados
    Dado que el coach con email "felipe.conte@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Cuando consulta los partidos que jugó
    Entonces el sistema responde con 200
    Y la lista de partidos jugados está vacía
