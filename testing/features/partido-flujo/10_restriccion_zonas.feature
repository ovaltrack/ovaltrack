# language: es
@hu-restriccion-zonas
Característica: Restricción de zonas de la cancha según el tipo de evento
  Como analista
  Quiero que la aplicación restrinja las zonas donde un evento puede ocurrir según su tipo
  Para evitar incoherencias con las reglas del rugby (un try fuera del in-goal, un scrum en el in-goal, etc.)

  # Convenciones de esta característica:
  # - Cada tipo de evento declara en el catálogo una regla de zona (zoneRule): columnas permitidas, filas permitidas
  #   y, opcionalmente, el atributo del que sale la fila (rowFrom: left | center | right -> fila 1 | 2 | 3).
  # - Si la regla deja un eje con un único valor, el evento queda fijo en ese eje sin importar el tramo
  #   (zona fija). Si no, ese eje sale del tramo que contiene el minuto del evento.
  # - Los tramos no cambian: un try no se marca en un tramo, su zona sale de la regla.
  # - La regla se lee desde el equipo que ejecuta el evento: para el rival la celda se espeja
  #   (columna 6 <-> 1 y fila izquierda <-> derecha). Propio y neutral no se espejan.
  # - Un evento que el tramo deja en una celda prohibida para su tipo es rechazado (409), pero solo al editar
  #   zonas o al cargar/editar eventos post-partido. Los eventos de captura en vivo nunca se rechazan:
  #   si caen en una celda prohibida quedan sin zona.
  # - Un evento fuera de todo tramo queda sin zona salvo que su tipo tenga zona fija.
  # - Grilla 3x6 indexada desde 1: filas 1-3 = izquierda/centro/derecha, columnas 1-6 = in-goal propio ... in-goal rival.

  # --- HAPPY PATHS: catálogo ---

  Escenario: El catálogo expone la regla de zona de cada tipo de evento
    Dado que el coach con email "felipe.conte@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Cuando el entrenador consulta el catálogo de tipos de evento
    Entonces el sistema responde con código 200
    Y el tipo de evento "Try" declara la regla de zona:
      | columnas  | 6    |
      | filaDesde | zone |
    Y el tipo de evento "Try penal" declara la regla de zona:
      | columnas | 6 |
      | filas    | 2 |
    Y el tipo de evento "Scrum" declara la regla de zona:
      | columnas | 2,3,4,5 |
    Y el tipo de evento "Kick-off / Salida" declara la regla de zona:
      | columnas | 1,2,3,4 |
    Y el tipo de evento "Tackle completado" no declara regla de zona

  # --- HAPPY PATHS: zona fija ---

  Escenario: Un try propio queda en el in-goal rival del lado del apoyo, sin importar el tramo
    Dado que el coach con email "felipe.conte@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Y que existe un partido finalizado para la división "Primera" contra "Bigornia Club"
    Y que el partido tiene asignada la zona fila 2 columna 5 en el periodo 1 entre el minuto 20 y el minuto 25
    Cuando el entrenador agrega post-partido el evento "Try" con atributos "zone=right" para el equipo propio en el minuto 22 del periodo 1
    Entonces el sistema responde con código 200
    Y el evento "Try" del minuto 22 del periodo 1 pertenece a la zona fila 3 columna 6
    Cuando el entrenador consulta las zonas del partido
    Entonces la consulta devuelve 1 asignación de zona
    Y el resumen indica 1 evento en la fila 3 columna 6
    Y el resumen indica 0 eventos en la fila 2 columna 5
    Y el resumen indica 0 eventos sin zona

  Escenario: Un try del rival se espeja: queda en el in-goal propio y el lado se lee desde su ataque
    Dado que el coach con email "felipe.conte@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Y que existe un partido finalizado para la división "Primera" contra "Bigornia Club"
    Y que el partido tiene asignada la zona fila 2 columna 5 en el periodo 1 entre el minuto 20 y el minuto 25
    Cuando el entrenador agrega post-partido el evento "Try" con atributos "zone=left" para el equipo rival en el minuto 22 del periodo 1
    Entonces el sistema responde con código 200
    Y el evento "Try" del minuto 22 del periodo 1 pertenece a la zona fila 3 columna 1

  Escenario: Un try penal queda entre los palos del in-goal rival aunque no haya tramos
    Dado que el coach con email "felipe.conte@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Y que existe un partido finalizado para la división "Primera" contra "Bigornia Club"
    Cuando el entrenador agrega post-partido el evento "Try penal" para el equipo propio en el minuto 22 del periodo 1
    Entonces el sistema responde con código 200
    Y el evento "Try penal" del minuto 22 del periodo 1 pertenece a la zona fila 2 columna 6

  Escenario: Un evento de zona fija en un hueco entre tramos no cuenta como sin zona
    Dado que el coach con email "felipe.conte@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Y que existe un partido finalizado para la división "Primera" contra "Bigornia Club"
    Y que el partido tiene asignada la zona fila 2 columna 3 en el periodo 1 entre el minuto 0 y el minuto 10
    Cuando el entrenador agrega post-partido el evento "Try" con atributos "zone=center" para el equipo propio en el minuto 30 del periodo 1
    Y el entrenador consulta las zonas del partido
    Entonces el resumen indica 1 evento en la fila 2 columna 6
    Y el resumen indica 0 eventos sin zona

  Escenario: Al corregir el tiempo de un try, sigue en su zona fija
    Dado que el coach con email "felipe.conte@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Y que existe un partido finalizado para la división "Primera" contra "Bigornia Club"
    Y que el partido tiene asignada la zona fila 2 columna 3 en el periodo 1 entre el minuto 10 y el minuto 25
    Y que se han registrado los siguientes eventos en el partido:
      | tipo_evento | posesion | tiempo_segundos | periodo | atributos   |
      | Try         | OWN      | 300             | 1       | zone=center |
    Cuando el entrenador corrige el tiempo del evento "Try" al segundo 900 del periodo 1
    Entonces el sistema responde con código 200
    Y el evento "Try" del minuto 15 del periodo 1 pertenece a la zona fila 2 columna 6

  Escenario: Eliminar un tramo siempre se permite y el evento de zona fija conserva su zona
    Dado que el coach con email "felipe.conte@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Y que existe un partido finalizado para la división "Primera" contra "Bigornia Club"
    Y que el partido tiene asignada la zona fila 2 columna 5 en el periodo 1 entre el minuto 20 y el minuto 25
    Y el entrenador agrega post-partido el evento "Try" con atributos "zone=left" para el equipo propio en el minuto 22 del periodo 1
    Cuando el entrenador elimina la zona asignada
    Entonces el sistema responde con código 204
    Y el evento "Try" del minuto 22 del periodo 1 pertenece a la zona fila 1 columna 6

  # --- HAPPY PATHS: columna fija y fila del tramo ---

  Escenario: Una conversión toma la fila del lado de la patada y la columna del tramo
    Dado que el coach con email "felipe.conte@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Y que existe un partido finalizado para la división "Primera" contra "Bigornia Club"
    Y que el partido tiene asignada la zona fila 2 columna 5 en el periodo 1 entre el minuto 20 y el minuto 25
    Cuando el entrenador agrega post-partido el evento "Conversión" con atributos "wasSuccessful=true;zone=left" para el equipo propio en el minuto 22 del periodo 1
    Entonces el sistema responde con código 200
    Y el evento "Conversión" del minuto 22 del periodo 1 pertenece a la zona fila 1 columna 5

  # --- HAPPY PATHS: tipos permitidos en el campo de juego ---

  Escenario: Un scrum en el campo de juego se acepta y toma la zona del tramo
    Dado que el coach con email "felipe.conte@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Y que existe un partido finalizado para la división "Primera" contra "Bigornia Club"
    Y que el partido tiene asignada la zona fila 2 columna 4 en el periodo 1 entre el minuto 20 y el minuto 25
    Cuando el entrenador agrega post-partido el evento "Scrum" con atributos "scrumResult=won_clean" para el equipo propio en el minuto 22 del periodo 1
    Entonces el sistema responde con código 200
    Y el evento "Scrum" del minuto 22 del periodo 1 pertenece a la zona fila 2 columna 4

  Esquema del escenario: Un tipo sin restricción se acepta incluso en el in-goal
    Dado que el coach con email "felipe.conte@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Y que existe un partido finalizado para la división "Primera" contra "Bigornia Club"
    Y que el partido tiene asignada la zona fila 2 columna 6 en el periodo 1 entre el minuto 20 y el minuto 25
    Cuando el entrenador agrega post-partido el evento "<tipo>" para el equipo propio en el minuto 22 del periodo 1
    Entonces el sistema responde con código 200
    Y el evento "<tipo>" del minuto 22 del periodo 1 pertenece a la zona fila 2 columna 6

    Ejemplos:
      | tipo              |
      | Tackle completado |
      | Acarreo (Carry)   |

  # Un saque (salida de centro, de 22m o drop-out de ingol) nunca sale del campo rival: solo se restringe la columna.
  Escenario: Un kick-off propio se acepta en la mitad propia y toma la zona del tramo
    Dado que el coach con email "felipe.conte@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Y que existe un partido finalizado para la división "Primera" contra "Bigornia Club"
    Y que el partido tiene asignada la zona fila 2 columna 4 en el periodo 1 entre el minuto 20 y el minuto 25
    Cuando el entrenador agrega post-partido el evento "Kick-off / Salida" con atributos "outcome=received_clean" para el equipo propio en el minuto 22 del periodo 1
    Entonces el sistema responde con código 200
    Y el evento "Kick-off / Salida" del minuto 22 del periodo 1 pertenece a la zona fila 2 columna 4

  Escenario: El kick-off del rival tras un try nuestro se acepta aunque el tramo esté en el in-goal rival
    Dado que el coach con email "felipe.conte@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Y que existe un partido finalizado para la división "Primera" contra "Bigornia Club"
    Y que el partido tiene asignada la zona fila 2 columna 6 en el periodo 1 entre el minuto 20 y el minuto 25
    Cuando el entrenador agrega post-partido el evento "Kick-off / Salida" con atributos "outcome=received_clean" para el equipo rival en el minuto 22 del periodo 1
    Entonces el sistema responde con código 200
    Y el evento "Kick-off / Salida" del minuto 22 del periodo 1 pertenece a la zona fila 2 columna 6

  # --- HAPPY PATHS: lecturas derivadas ---

  Escenario: El resumen de zonas del partido refleja la zona fija de los eventos
    Dado que el coach con email "felipe.conte@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Y que existe un partido finalizado para la división "Primera" contra "Bigornia Club"
    Y que el partido tiene asignada la zona fila 2 columna 3 en el periodo 1 entre el minuto 0 y el minuto 40
    Y el entrenador agrega post-partido el evento "Try" con atributos "zone=center" para el equipo propio en el minuto 10 del periodo 1
    Y el entrenador agrega post-partido el evento "Tackle completado" para el equipo propio en el minuto 12 del periodo 1
    Cuando el entrenador consulta las zonas del partido
    Entonces el resumen indica 1 evento en la fila 2 columna 6
    Y el resumen indica 1 evento en la fila 2 columna 3
    Y el resumen indica 0 eventos sin zona

  Escenario: Las estadísticas del jugador ubican su try en la zona fija
    Dado que el coach con email "felipe.conte@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Y que existe un partido finalizado para la división "Primera" contra "Bigornia Club"
    Y que el partido tiene asignada la zona fila 2 columna 5 en el periodo 1 entre el minuto 0 y el minuto 40
    Y que se registraron los siguientes eventos de jugadores en el partido:
      | tipo_evento | jugador    | tiempo_segundos | periodo | atributos  |
      | Try         | Blue Album | 300             | 1       | zone=right |
    Cuando consulta las estadísticas de "Blue Album" en el partido
    Entonces el sistema responde con 200
    Y el mapa de zonas del jugador tiene 1 eventos en la celda fila 3 columna 6
    Y el mapa de zonas del jugador tiene 0 eventos en la celda fila 2 columna 5
    Y el mapa de zonas del jugador tiene 0 eventos sin zona

  # --- HAPPY PATHS: captura en vivo ---

  Escenario: Un evento cargado en vivo nunca se rechaza: si cae en una celda prohibida queda sin zona
    Dado que el coach con email "felipe.conte@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Y que existe un partido finalizado para la división "Primera" contra "Bigornia Club"
    Y que el partido tiene asignada la zona fila 2 columna 6 en el periodo 1 entre el minuto 20 y el minuto 25
    Cuando el entrenador registra en vivo el evento "Scrum" con atributos "scrumResult=won_clean" para el equipo propio en el minuto 22 del periodo 1
    Entonces el sistema responde con código 200
    Y el evento "Scrum" del minuto 22 del periodo 1 queda sin zona

  Escenario: Un evento restringido en un hueco entre tramos se acepta y queda sin zona
    Dado que el coach con email "felipe.conte@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Y que existe un partido finalizado para la división "Primera" contra "Bigornia Club"
    Y que el partido tiene asignada la zona fila 2 columna 6 en el periodo 1 entre el minuto 20 y el minuto 25
    Cuando el entrenador agrega post-partido el evento "Scrum" con atributos "scrumResult=won_clean" para el equipo propio en el minuto 30 del periodo 1
    Entonces el sistema responde con código 200
    Y el evento "Scrum" del minuto 30 del periodo 1 queda sin zona

  # --- SAD PATHS: alta post-partido ---

  Esquema del escenario: Un evento solo de campo de juego es rechazado en un tramo del in-goal
    Dado que el coach con email "felipe.conte@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Y que existe un partido finalizado para la división "Primera" contra "Bigornia Club"
    Y que el partido tiene asignada la zona fila 2 columna 6 en el periodo 1 entre el minuto 20 y el minuto 25
    Cuando el entrenador agrega post-partido el evento "<tipo>" con atributos "<atributos>" para el equipo propio en el minuto 22 del periodo 1
    Entonces el sistema responde con 409 y "<tipo> (1T 22:00) no puede quedar en C6 (tramo 1T 20'–25'): solo puede ocurrir en las columnas 2 a 5"

    Ejemplos:
      | tipo                   | atributos              |
      | Scrum                  | scrumResult=won_clean  |
      | Line-out               | lineResult=won_clean   |
      | Maul                   | maulOutcome=advanced   |
      | Drop goal              | wasSuccessful=true     |
      | Conversión             | wasSuccessful=true     |
      | Kick H (Penal a palos) | wasSuccessful=true     |
      | Ruck ofensivo          |                        |
      | Jugada rapida          |                        |

  Escenario: Un evento del segundo tiempo es rechazado con el tramo y el tiempo del segundo tiempo
    Dado que el coach con email "felipe.conte@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Y que existe un partido finalizado para la división "Primera" contra "Bigornia Club"
    Y que el partido tiene asignada la zona fila 3 columna 1 en el periodo 2 entre el minuto 60 y el minuto 70
    Cuando el entrenador agrega post-partido el evento "Line-out" con atributos "lineResult=won_clean" para el equipo propio en el minuto 65 del periodo 2
    Entonces el sistema responde con 409 y "Line-out (2T 65:00) no puede quedar en D1 (tramo 2T 60'–70'): solo puede ocurrir en las columnas 2 a 5"

  Escenario: El evento rechazado no se guarda
    Dado que el coach con email "felipe.conte@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Y que existe un partido finalizado para la división "Primera" contra "Bigornia Club"
    Y que el partido tiene asignada la zona fila 2 columna 6 en el periodo 1 entre el minuto 20 y el minuto 25
    Cuando el entrenador agrega post-partido el evento "Scrum" con atributos "scrumResult=won_clean" para el equipo propio en el minuto 22 del periodo 1
    Entonces el sistema rechaza la solicitud con código 409
    Cuando el entrenador consulta la línea de eventos del partido cerrado
    Entonces la línea de eventos no contiene eventos "Scrum"

  Escenario: Un kick-off propio en un tramo del campo rival es rechazado
    Dado que el coach con email "felipe.conte@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Y que existe un partido finalizado para la división "Primera" contra "Bigornia Club"
    Y que el partido tiene asignada la zona fila 2 columna 5 en el periodo 1 entre el minuto 20 y el minuto 25
    Cuando el entrenador agrega post-partido el evento "Kick-off / Salida" con atributos "outcome=received_clean" para el equipo propio en el minuto 22 del periodo 1
    Entonces el sistema responde con 409 y "Kick-off / Salida (1T 22:00) no puede quedar en C5 (tramo 1T 20'–25'): solo puede ocurrir en las columnas 1 a 4"

  Escenario: Un kick-off del rival en un tramo de nuestro in-goal es rechazado porque desde su lado sería el campo rival
    Dado que el coach con email "felipe.conte@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Y que existe un partido finalizado para la división "Primera" contra "Bigornia Club"
    Y que el partido tiene asignada la zona fila 2 columna 1 en el periodo 1 entre el minuto 20 y el minuto 25
    Cuando el entrenador agrega post-partido el evento "Kick-off / Salida" con atributos "outcome=received_clean" para el equipo rival en el minuto 22 del periodo 1
    Entonces el sistema responde con 409 y "Kick-off / Salida (1T 22:00) no puede quedar en C1 (tramo 1T 20'–25'): solo puede ocurrir en las columnas 1 a 4"

  # --- SAD PATHS: edición de eventos ---

  Escenario: Cambiar el tipo de un evento a uno restringido en un tramo del in-goal es rechazado
    Dado que el coach con email "felipe.conte@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Y que existe un partido finalizado para la división "Primera" contra "Bigornia Club"
    Y que el partido tiene asignada la zona fila 2 columna 6 en el periodo 1 entre el minuto 20 y el minuto 25
    Y el entrenador agrega post-partido el evento "Tackle completado" para el equipo propio en el minuto 22 del periodo 1
    Cuando el entrenador edita el evento "Tackle completado" cambiándolo a "Scrum" con atributos "scrumResult=won_clean"
    Entonces el sistema responde con 409 y "Scrum (1T 22:00) no puede quedar en C6 (tramo 1T 20'–25'): solo puede ocurrir en las columnas 2 a 5"

  Escenario: Corregir el tiempo de un evento hacia un tramo prohibido para su tipo es rechazado
    Dado que el coach con email "felipe.conte@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Y que existe un partido finalizado para la división "Primera" contra "Bigornia Club"
    Y que el partido tiene asignada la zona fila 2 columna 3 en el periodo 1 entre el minuto 10 y el minuto 25
    Y que el partido tiene asignada la zona fila 2 columna 1 en el periodo 1 entre el minuto 25 y el minuto 40
    Y que se han registrado los siguientes eventos en el partido:
      | tipo_evento | posesion | tiempo_segundos | periodo | atributos             |
      | Scrum       | OWN      | 720             | 1       | scrumResult=won_clean |
    Cuando el entrenador corrige el tiempo del evento "Scrum" al segundo 1800 del periodo 1
    Entonces el sistema responde con 409 y "Scrum (1T 30:00) no puede quedar en C1 (tramo 1T 25'–40'): solo puede ocurrir en las columnas 2 a 5"

  # --- SAD PATHS: edición de tramos ---

  Escenario: Crear un tramo que deja un evento en una celda prohibida para su tipo es rechazado
    Dado que el coach con email "felipe.conte@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Y que existe un partido finalizado para la división "Primera" contra "Bigornia Club"
    Y que se han registrado los siguientes eventos en el partido:
      | tipo_evento | posesion | tiempo_segundos | periodo | atributos             |
      | Scrum       | OWN      | 1320            | 1       | scrumResult=won_clean |
    Cuando el entrenador asigna la zona fila 2 columna 6 al periodo 1 entre el minuto 20 y el minuto 25
    Entonces el sistema responde con 409 y "Scrum (1T 22:00) no puede quedar en C6 (tramo 1T 20'–25'): solo puede ocurrir en las columnas 2 a 5"
    Cuando el entrenador consulta las zonas del partido
    Entonces la consulta devuelve 0 asignaciones de zona

  Escenario: Mover un tramo a una celda prohibida para un evento que contiene es rechazado
    Dado que el coach con email "felipe.conte@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Y que existe un partido finalizado para la división "Primera" contra "Bigornia Club"
    Y que el partido tiene asignada la zona fila 2 columna 3 en el periodo 1 entre el minuto 10 y el minuto 25
    Y que se han registrado los siguientes eventos en el partido:
      | tipo_evento | posesion | tiempo_segundos | periodo | atributos            |
      | Maul        | OWN      | 900             | 1       | maulOutcome=advanced |
    Cuando el entrenador modifica la zona asignada a fila 2 columna 1 entre el minuto 10 y el minuto 25
    Entonces el sistema responde con 409 y "Maul (1T 15:00) no puede quedar en C1 (tramo 1T 10'–25'): solo puede ocurrir en las columnas 2 a 5"

  Escenario: Ampliar un tramo del in-goal hasta un evento restringido es rechazado
    Dado que el coach con email "felipe.conte@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Y que existe un partido finalizado para la división "Primera" contra "Bigornia Club"
    Y que el partido tiene asignada la zona fila 2 columna 6 en el periodo 1 entre el minuto 30 y el minuto 35
    Y que se han registrado los siguientes eventos en el partido:
      | tipo_evento | posesion | tiempo_segundos | periodo | atributos            |
      | Line-out    | OWN      | 2280            | 1       | lineResult=won_clean |
    Cuando el entrenador modifica la zona asignada a fila 2 columna 6 entre el minuto 30 y el minuto 40
    Entonces el sistema responde con 409 y "Line-out (1T 38:00) no puede quedar en C6 (tramo 1T 30'–40'): solo puede ocurrir en las columnas 2 a 5"

  Escenario: Un tramo del in-goal que no contiene eventos restringidos se acepta
    Dado que el coach con email "felipe.conte@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Y que existe un partido finalizado para la división "Primera" contra "Bigornia Club"
    Y que se han registrado los siguientes eventos en el partido:
      | tipo_evento       | posesion | tiempo_segundos | periodo | atributos |
      | Tackle completado | OWN      | 1320            | 1       |           |
    Cuando el entrenador asigna la zona fila 2 columna 6 al periodo 1 entre el minuto 20 y el minuto 25
    Entonces el sistema responde con código 201

  # --- CORTE DE TRAMO: después de un try, un try penal, un Kick H o un drop el juego se reinicia ---
  # El tramo que contiene uno de esos eventos tiene que terminar en su minuto (fin = minuto del evento + 1).
  # Nunca se rechaza el evento: si un try se carga dentro de un tramo, el tramo queda cruzándolo hasta que se corte.

  Escenario: El catálogo indica qué tipos de evento cierran el tramo
    Dado que el coach con email "felipe.conte@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Cuando el entrenador consulta el catálogo de tipos de evento
    Entonces el sistema responde con código 200
    Y el tipo de evento "Try" cierra el tramo
    Y el tipo de evento "Try penal" cierra el tramo
    Y el tipo de evento "Kick H (Penal a palos)" cierra el tramo
    Y el tipo de evento "Drop goal" cierra el tramo
    Y el tipo de evento "Conversión" no cierra el tramo
    Y el tipo de evento "Scrum" no cierra el tramo
    Y el tipo de evento "Tackle completado" no cierra el tramo

  Escenario: Un tramo que termina en el minuto del try se acepta
    Dado que el coach con email "felipe.conte@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Y que existe un partido finalizado para la división "Primera" contra "Bigornia Club"
    Y que se han registrado los siguientes eventos en el partido:
      | tipo_evento | posesion | tiempo_segundos | periodo | atributos  |
      | Try         | OWN      | 1350            | 1       | zone=right |
    Cuando el entrenador asigna la zona fila 2 columna 5 al periodo 1 entre el minuto 20 y el minuto 23
    Entonces el sistema responde con código 201

  Escenario: Un tramo que empieza después del try se acepta
    Dado que el coach con email "felipe.conte@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Y que existe un partido finalizado para la división "Primera" contra "Bigornia Club"
    Y que se han registrado los siguientes eventos en el partido:
      | tipo_evento | posesion | tiempo_segundos | periodo | atributos  |
      | Try         | OWN      | 1350            | 1       | zone=right |
    Cuando el entrenador asigna la zona fila 2 columna 3 al periodo 1 entre el minuto 23 y el minuto 30
    Entonces el sistema responde con código 201

  Escenario: Un try en el tiempo añadido cierra el tramo que termina en el 40
    Dado que el coach con email "felipe.conte@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Y que existe un partido finalizado para la división "Primera" contra "Bigornia Club"
    # Solo la captura en vivo registra tiempo añadido (el alta post-partido no pasa del 40′ en el 1T)
    Y el entrenador registra en vivo el evento "Try" con atributos "zone=center" para el equipo propio en el minuto 43 del periodo 1
    Cuando el entrenador asigna la zona fila 2 columna 5 al periodo 1 entre el minuto 35 y el minuto 40
    Entonces el sistema responde con código 201

  Escenario: Cargar un try dentro de un tramo nunca se rechaza y el tramo no cambia
    Dado que el coach con email "felipe.conte@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Y que existe un partido finalizado para la división "Primera" contra "Bigornia Club"
    Y que el partido tiene asignada la zona fila 2 columna 5 en el periodo 1 entre el minuto 20 y el minuto 25
    Cuando el entrenador agrega post-partido el evento "Try" con atributos "zone=right" para el equipo propio en el minuto 22 del periodo 1
    Entonces el sistema responde con código 200
    Cuando el entrenador consulta las zonas del partido
    Entonces la consulta devuelve 1 asignación de zona

  Escenario: Cortar en el minuto del try un tramo que lo cruza se acepta
    Dado que el coach con email "felipe.conte@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Y que existe un partido finalizado para la división "Primera" contra "Bigornia Club"
    Y que el partido tiene asignada la zona fila 2 columna 5 en el periodo 1 entre el minuto 20 y el minuto 25
    Y que se han registrado los siguientes eventos en el partido:
      | tipo_evento | posesion | tiempo_segundos | periodo | atributos  |
      | Try         | OWN      | 1350            | 1       | zone=right |
    Cuando el entrenador modifica la zona asignada a fila 2 columna 5 entre el minuto 20 y el minuto 23
    Entonces el sistema responde con código 200

  Escenario: Crear un tramo que sigue después de un try es rechazado
    Dado que el coach con email "felipe.conte@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Y que existe un partido finalizado para la división "Primera" contra "Bigornia Club"
    Y que se han registrado los siguientes eventos en el partido:
      | tipo_evento | posesion | tiempo_segundos | periodo | atributos  |
      | Try         | OWN      | 1350            | 1       | zone=right |
    Cuando el entrenador asigna la zona fila 2 columna 5 al periodo 1 entre el minuto 20 y el minuto 25
    Entonces el sistema responde con 409 y "El tramo 1T 20'–25' no puede seguir después del Try (1T 22:30): terminalo en 23'"
    Cuando el entrenador consulta las zonas del partido
    Entonces la consulta devuelve 0 asignaciones de zona

  Escenario: El try del rival también cierra el tramo
    Dado que el coach con email "felipe.conte@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Y que existe un partido finalizado para la división "Primera" contra "Bigornia Club"
    Y que se han registrado los siguientes eventos en el partido:
      | tipo_evento | posesion | tiempo_segundos | periodo | atributos |
      | Try         | OPPONENT | 1350            | 1       | zone=left |
    Cuando el entrenador asigna la zona fila 2 columna 2 al periodo 1 entre el minuto 20 y el minuto 25
    Entonces el sistema responde con 409 y "El tramo 1T 20'–25' no puede seguir después del Try (1T 22:30): terminalo en 23'"

  Esquema del escenario: Un tanteo que reinicia el juego cierra el tramo
    Dado que el coach con email "felipe.conte@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Y que existe un partido finalizado para la división "Primera" contra "Bigornia Club"
    Y que se han registrado los siguientes eventos en el partido:
      | tipo_evento | posesion | tiempo_segundos | periodo | atributos   |
      | <tipo>      | OWN      | 1350            | 1       | <atributos> |
    Cuando el entrenador asigna la zona fila 2 columna 4 al periodo 1 entre el minuto 20 y el minuto 25
    Entonces el sistema responde con 409 y "El tramo 1T 20'–25' no puede seguir después del <tipo> (1T 22:30): terminalo en 23'"

    Ejemplos:
      | tipo                   | atributos           |
      | Try penal              |                     |
      | Kick H (Penal a palos) | wasSuccessful=true  |
      | Kick H (Penal a palos) | wasSuccessful=false |
      | Drop goal              | wasSuccessful=true  |

  Escenario: Ampliar un tramo más allá de un try es rechazado
    Dado que el coach con email "felipe.conte@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Y que existe un partido finalizado para la división "Primera" contra "Bigornia Club"
    Y que el partido tiene asignada la zona fila 2 columna 5 en el periodo 1 entre el minuto 20 y el minuto 23
    Y que se han registrado los siguientes eventos en el partido:
      | tipo_evento | posesion | tiempo_segundos | periodo | atributos  |
      | Try         | OWN      | 1350            | 1       | zone=right |
    Cuando el entrenador modifica la zona asignada a fila 2 columna 5 entre el minuto 20 y el minuto 25
    Entonces el sistema responde con 409 y "El tramo 1T 20'–25' no puede seguir después del Try (1T 22:30): terminalo en 23'"

  Escenario: Editar solo la celda de un tramo que cruza un try exige cortarlo
    Dado que el coach con email "felipe.conte@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Y que existe un partido finalizado para la división "Primera" contra "Bigornia Club"
    Y que el partido tiene asignada la zona fila 2 columna 5 en el periodo 1 entre el minuto 20 y el minuto 25
    Y que se han registrado los siguientes eventos en el partido:
      | tipo_evento | posesion | tiempo_segundos | periodo | atributos  |
      | Try         | OWN      | 1350            | 1       | zone=right |
    Cuando el entrenador modifica la zona asignada a fila 2 columna 4 entre el minuto 20 y el minuto 25
    Entonces el sistema responde con 409 y "El tramo 1T 20'–25' no puede seguir después del Try (1T 22:30): terminalo en 23'"

  Escenario: Un tramo con dos tries es rechazado por el primero
    Dado que el coach con email "felipe.conte@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Y que existe un partido finalizado para la división "Primera" contra "Bigornia Club"
    Y que se han registrado los siguientes eventos en el partido:
      | tipo_evento | posesion | tiempo_segundos | periodo | atributos  |
      | Try         | OWN      | 1260            | 1       | zone=left  |
      | Try         | OPPONENT | 1440            | 1       | zone=right |
    Cuando el entrenador asigna la zona fila 2 columna 4 al periodo 1 entre el minuto 20 y el minuto 25
    Entonces el sistema responde con 409 y "El tramo 1T 20'–25' no puede seguir después del Try (1T 21:00): terminalo en 22'"
