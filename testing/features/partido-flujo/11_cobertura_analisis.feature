# language: es
Característica: Cobertura de análisis de partidos para el Inicio
  Como entrenador o analista
  Quiero conocer el % de jugadas con jugador asignado de varios partidos en una sola consulta
  Para ver el estado del análisis en el Inicio sin descargar la línea de eventos completa

  # --- HAPPY PATHS ---

  Escenario: Cobertura con jugadas propias con y sin jugador y jugadas del rival
    Dado que el coach con email "felipe.conte@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Y que existe un partido finalizado para la división "Primera" contra "Trelew Rugby Club"
    Y que se han registrado eventos con y sin jugador asignado para el partido
    Y que se han registrado los siguientes eventos en el partido:
      | tipo_evento       | posesion | tiempo_segundos | periodo | atributos |
      | Tackle completado | OPPONENT | 900             | 1       |           |
    Cuando el entrenador consulta la cobertura de análisis del partido
    Entonces el sistema responde con 200
    Y la cobertura del partido es de 3 jugadas, 1 sin jugador y 67 %

  Escenario: Las jugadas eliminadas no cuentan en la cobertura
    Dado que el coach con email "felipe.conte@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Y que existe un partido finalizado para la división "Primera" contra "Comodoro Rugby Club"
    Y que se han registrado los siguientes eventos en el partido:
      | tipo_evento       | posesion | tiempo_segundos | periodo | atributos   |
      | Try               | OWN      | 300             | 1       | zone=center |
      | Tackle completado | OPPONENT | 600             | 1       |             |
    Y el entrenador elimina el evento "Try"
    Cuando el entrenador consulta la cobertura de análisis del partido
    Entonces el sistema responde con 200
    Y la cobertura del partido es de 1 jugadas, 0 sin jugador y 100 %

  Escenario: Un partido sin jugadas cuenta como analizado por completo
    Dado que el coach con email "felipe.conte@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Y que existe un partido finalizado para la división "Primera" contra "Calafate Rugby Club"
    Cuando el entrenador consulta la cobertura de análisis del partido
    Entonces el sistema responde con 200
    Y la cobertura del partido es de 0 jugadas, 0 sin jugador y 100 %

  # --- SAD PATHS ---

  Escenario: Error de seguridad al consultar la cobertura de un partido de otro club
    Dado que el coach con email "felipe.conte@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Y que existe un partido finalizado para la división "Primera" contra "Bigornia Club"
    Cuando el administrador del club con email "admin_multiclub@test.com" y contraseña "PassSegura123!" consulta la cobertura de análisis del partido
    Entonces el sistema responde con 403 y "Acceso denegado: solo el entrenador asignado o el administrador del club pueden gestionar este partido"

  Escenario: Error al consultar la cobertura de un partido inexistente
    Dado que el coach con email "felipe.conte@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Cuando el entrenador consulta la cobertura de análisis de un partido que no existe
    Entonces el sistema responde con 409 y "Partido no encontrado"

  Escenario: Error al consultar la cobertura de demasiados partidos en un pedido
    Dado que el coach con email "felipe.conte@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Cuando el entrenador consulta la cobertura de análisis de 51 partidos
    Entonces el sistema responde con 409 y "Se puede consultar la cobertura de hasta 50 partidos por pedido"
