# language: es
Característica: Edición y eliminación de eventos post-partido (HU 8.2)
  Como entrenador o analista
  Quiero poder editar o eliminar eventos registrados en un partido ya finalizado
  Para corregir errores de carga y mantener las estadísticas precisas

  # --- HAPPY PATHS ---

  Escenario: Asignación rápida de jugador a un evento sin asignar
    Dado que el coach con email "felipe.conte@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Y que existe un partido finalizado para la división "Primera" contra "Trelew Rugby Club"
    Y que se han registrado los siguientes eventos en el partido:
      | tipo_evento | posesion | tiempo_segundos | periodo | atributos   |
      | Try         | OWN      | 300             | 1       | zone=center |
    Cuando el entrenador edita el evento "Try" asignándole el jugador "Blue Album"
    Entonces el sistema responde con 200
    Y la línea de eventos refleja que el evento modificado está asignado a "Blue Album"

  Escenario: Edición del tipo de evento y equipo en posesión
    Dado que el coach con email "felipe.conte@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Y que existe un partido finalizado para la división "Primera" contra "Calafate Rugby Club"
    Y que se han registrado los siguientes eventos en el partido:
      | tipo_evento | posesion | tiempo_segundos | periodo | atributos             |
      | Scrum       | NEUTRAL  | 600             | 1       | scrumResult=won_clean |
    Cuando el entrenador edita el evento "Scrum" cambiándolo a "Line-out" con posesión "OWN"
    Entonces el sistema responde con 200
    Y la línea de eventos refleja el cambio de tipo a "Line-out" y posesión a "OWN"

  Escenario: Corrección del tiempo de un evento al segundo tiempo
    Dado que el coach con email "felipe.conte@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Y que existe un partido finalizado para la división "Primera" contra "Comodoro Rugby Club"
    Y que se han registrado los siguientes eventos en el partido:
      | tipo_evento | posesion | tiempo_segundos | periodo | atributos   |
      | Try         | OWN      | 300             | 1       | zone=center |
    Cuando el entrenador corrige el tiempo del evento "Try" al segundo 2700 del periodo 2
    Entonces el sistema responde con 200
    Y la línea de eventos muestra el evento modificado en el segundo 2700 del periodo 2

  Escenario: Al corregir el tiempo, el evento toma la zona del nuevo tramo
    Dado que el coach con email "felipe.conte@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Y que existe un partido finalizado para la división "Primera" contra "Deportivo Portugués"
    Y que el partido tiene asignada la zona fila 2 columna 3 en el periodo 1 entre el minuto 10 y el minuto 25
    Y que se han registrado los siguientes eventos en el partido:
      | tipo_evento       | posesion | tiempo_segundos | periodo | atributos |
      | Tackle completado | OWN      | 300             | 1       |           |
    Cuando el entrenador corrige el tiempo del evento "Tackle completado" al segundo 900 del periodo 1
    Entonces el sistema responde con 200
    Y el evento "Tackle completado" del minuto 15 del periodo 1 pertenece a la zona fila 2 columna 3

  Escenario: Eliminación lógica de un evento existente
    Dado que el coach con email "felipe.conte@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Y que existe un partido finalizado para la división "Primera" contra "Patoruzú Rugby Club"
    Y que se han registrado los siguientes eventos en el partido:
      | tipo_evento | posesion | tiempo_segundos | periodo | atributos             |
      | Line-out    | OWN      | 120             | 1       | lineResult=won_clean  |
      | Scrum       | NEUTRAL  | 600             | 1       | scrumResult=won_clean |
    Cuando el entrenador elimina el evento "Line-out"
    Entonces el sistema responde con 200
    Y al consultar la línea de eventos, la lista tiene un evento menos

  Escenario: Eliminación de un evento y recálculo del tanteador (E7/E9)
    Dado que el coach con email "felipe.conte@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Y que existe un partido finalizado para la división "Primera" contra "Comodoro Rugby Club"
    Y que se han registrado los siguientes eventos en el partido:
      | tipo_evento | posesion | tiempo_segundos | periodo | atributos   |
      | Try         | OWN      | 300             | 1       | zone=center |
    Y el tanteador propio del partido es 5
    Cuando el entrenador elimina el evento "Try"
    Entonces el sistema responde con 200
    Y el tanteador propio del partido es 0

  # --- SAD PATHS ---

  Escenario: Error al intentar asignar un jugador que no existe
    Dado que el coach con email "felipe.conte@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Y que existe un partido finalizado para la división "Primera" contra "Trelew Rugby Club"
    Y que se han registrado los siguientes eventos en el partido:
      | tipo_evento | posesion | tiempo_segundos | periodo | atributos   |
      | Try         | OWN      | 300             | 1       | zone=center |
    Cuando el entrenador intenta editar el evento "Try" asignándole un jugador fuera del plantel
    Entonces el sistema responde con 409 y "No se puede asignar un evento a un jugador que no existe"

  Escenario: Error al intentar enviar un tipo de evento inexistente
    Dado que el coach con email "felipe.conte@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Y que existe un partido finalizado para la división "Primera" contra "Trelew Rugby Club"
    Y que se han registrado los siguientes eventos en el partido:
      | tipo_evento | posesion | tiempo_segundos | periodo | atributos             |
      | Scrum       | NEUTRAL  | 100             | 1       | scrumResult=won_clean |
    Cuando el entrenador intenta editar el evento "Scrum" enviando un ID de tipo de evento inválido
    Entonces el sistema responde con 409 y "No se puede asociar un evento a un tipo de evento que no existe"

  Escenario: Error al corregir el tiempo de un evento fuera del primer tiempo
    Dado que el coach con email "felipe.conte@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Y que existe un partido finalizado para la división "Primera" contra "Trelew Rugby Club"
    Y que se han registrado los siguientes eventos en el partido:
      | tipo_evento | posesion | tiempo_segundos | periodo | atributos   |
      | Try         | OWN      | 300             | 1       | zone=center |
    Cuando el entrenador corrige el tiempo del evento "Try" al segundo 2500 del periodo 1
    Entonces el sistema responde con 409 y "El tiempo de juego del 1° Tiempo no puede exceder los 40 minutos"

  Escenario: Error al intentar eliminar un evento inexistente
    Dado que el coach con email "felipe.conte@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Cuando el entrenador intenta eliminar un evento con un ID que no existe
    Entonces el sistema responde con 409 y "No se puede eliminar un evento que no existe"

  Escenario: Error de seguridad al intentar eliminar un evento de otro club
    Dado que el coach con email "felipe.conte@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Y que existe un partido finalizado para la división "Primera" contra "Bigornia Club"
    Y que se han registrado los siguientes eventos en el partido:
      | tipo_evento | posesion | tiempo_segundos | periodo | atributos   |
      | Try         | OWN      | 300             | 1       | zone=center |
    Cuando el administrador del club con email "admin_multiclub@test.com" y contraseña "PassSegura123!" intenta eliminar el evento "Try"
    Entonces el sistema responde con 403 y "Acceso denegado: solo el entrenador asignado o el administrador del club pueden gestionar este partido"
