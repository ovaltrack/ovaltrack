# language: es
Característica: Cobertura de análisis de partidos finalizados
  Como entrenador o analista
  Quiero saber qué porcentaje de las jugadas de un partido ya tiene jugador asignado
  Para saber cuánto me falta analizar sin descargar todos los eventos

  Escenario: La cobertura cuenta los eventos con y sin jugador
    Dado que el coach con email "felipe.conte@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Y que existe un partido finalizado para la división "Primera" contra "Trelew Rugby Club"
    Y que se han registrado eventos con y sin jugador asignado para el partido
    Cuando consulta la cobertura del partido
    Entonces el sistema responde con 200
    Y la cobertura del partido es de 2 eventos, 1 sin jugador y 50 por ciento

  Escenario: El porcentaje se redondea como lo hace la pantalla
    Dado que el coach con email "felipe.conte@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Y que existe un partido finalizado para la división "Primera" contra "Calafate Rugby Club"
    Y que se han registrado los siguientes eventos en el partido:
      | tipo_evento       | posesion | tiempo_segundos | periodo | atributos |
      | Tackle completado | OWN      | 300             | 1       |           |
      | Tackle completado | OWN      | 360             | 1       |           |
      | Tackle completado | OWN      | 420             | 1       |           |
    Y que se asigna un jugador del plantel a un evento "Tackle completado"
    Cuando consulta la cobertura del partido
    Entonces el sistema responde con 200
    Y la cobertura del partido es de 3 eventos, 2 sin jugador y 33 por ciento

  Escenario: Un evento del rival sin jugador no cuenta como pendiente
    Dado que el coach con email "felipe.conte@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Y que existe un partido finalizado para la división "Primera" contra "Comodoro Rugby Club"
    Y que se han registrado los siguientes eventos en el partido:
      | tipo_evento       | posesion | tiempo_segundos | periodo | atributos |
      | Tackle completado | OPPONENT | 300             | 1       |           |
      | Tackle completado | OWN      | 360             | 1       |           |
    Cuando consulta la cobertura del partido
    Entonces el sistema responde con 200
    Y la cobertura del partido es de 2 eventos, 1 sin jugador y 50 por ciento

  Escenario: Un evento eliminado no cuenta
    Dado que el coach con email "felipe.conte@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Y que existe un partido finalizado para la división "Primera" contra "Bigornia Club"
    Y que se han registrado los siguientes eventos en el partido:
      | tipo_evento       | posesion | tiempo_segundos | periodo | atributos |
      | Tackle completado | OWN      | 300             | 1       |           |
      | Scrum             | NEUTRAL  | 600             | 1       | scrumResult=won_clean |
    Cuando el entrenador elimina el evento "Scrum"
    Y consulta la cobertura del partido
    Entonces el sistema responde con 200
    Y la cobertura del partido es de 1 eventos, 1 sin jugador y 0 por ciento

  @tipo_inactivo
  Escenario: Un evento de un tipo inactivo no cuenta
    Dado que el coach con email "felipe.conte@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Y que existe un partido finalizado para la división "Primera" contra "Trelew Rugby Club"
    Y que se han registrado los siguientes eventos en el partido:
      | tipo_evento       | posesion | tiempo_segundos | periodo | atributos |
      | Tackle completado | OWN      | 300             | 1       |           |
      | Scrum             | NEUTRAL  | 600             | 1       | scrumResult=won_clean |
    Y que el tipo de evento "Scrum" está inactivo
    Cuando consulta la cobertura del partido
    Entonces el sistema responde con 200
    Y la cobertura del partido es de 1 eventos, 1 sin jugador y 0 por ciento

  Escenario: Un partido sin eventos tiene cobertura completa
    Dado que el coach con email "felipe.conte@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Y que existe un partido finalizado para la división "Primera" contra "Calafate Rugby Club"
    Cuando consulta la cobertura del partido
    Entonces el sistema responde con 200
    Y la cobertura del partido es de 0 eventos, 0 sin jugador y 100 por ciento

  Escenario: Los partidos no finalizados se omiten de la respuesta
    Dado que el coach con email "felipe.conte@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Y que existe un partido finalizado para la división "Primera" contra "Comodoro Rugby Club"
    Y que existe además un partido en curso para la división "Primera" contra "Bigornia Club"
    Cuando consulta la cobertura de ambos partidos
    Entonces el sistema responde con 200
    Y la respuesta incluye solo la cobertura del partido finalizado

  Escenario: Un administrador de otro club no puede consultar la cobertura
    Dado que el coach con email "felipe.conte@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Y que existe un partido finalizado para la división "Primera" contra "Bigornia Club"
    Y que el usuario con email "admin_multiclub@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Cuando consulta la cobertura del partido
    Entonces el sistema responde con 403 y "Acceso denegado: solo el entrenador asignado o el administrador del club pueden gestionar este partido"

  Escenario: Un jugador no puede consultar la cobertura
    Dado que el coach con email "felipe.conte@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Y que existe un partido finalizado para la división "Primera" contra "Trelew Rugby Club"
    Y que el jugador con email "jugador.uno@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Cuando consulta la cobertura del partido
    Entonces el sistema responde con 403

  Escenario: Un partido inexistente no se encuentra
    Dado que el coach con email "felipe.conte@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Cuando consulta la cobertura de un partido inexistente
    Entonces el sistema responde con 404 y "Partido no encontrado"

  Escenario: No se pueden consultar más de 20 partidos a la vez
    Dado que el coach con email "felipe.conte@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Cuando consulta la cobertura de 21 partidos
    Entonces el sistema responde con 400 y "No se pueden consultar más de 20 partidos a la vez"
