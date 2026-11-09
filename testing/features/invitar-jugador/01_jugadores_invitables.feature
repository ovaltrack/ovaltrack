# language: es
Característica: Jugadores del club para invitar
  Como administrador de club o entrenador
  Quiero ver a los jugadores con el estado de su cuenta
  Para saber a quién invitar a crear su cuenta

  # Personas propias de estos escenarios (no se usan en el resto de la suite).
  # Ninguno envía correos: las invitaciones "enviadas" se insertan en la base.

  Antecedentes:
    Dado el jugador "Ana" "Invitable" con correo "ana.invitable@test.com" en la division "M19"
    Y el jugador "Pedro" "Concuenta" con correo "pedro.concuenta@test.com" y cuenta en la division "Primera"
    Y el jugador "Sol" "Sincorreo" sin correo en la division "M19"
    Y el jugador "Luis" "Repetido" con correo "felipe.conte@test.com" en la division "M19"
    Y el jugador "Eva" "Pendiente" con correo "eva.pendiente@test.com" en la division "M19"
    Y el jugador "Leo" "Vencido" con correo "leo.vencido@test.com" en la division "M19"
    Y "Eva" "Pendiente" tiene una invitación vigente
    Y "Leo" "Vencido" tiene una invitación vencida

  Escenario: El administrador ve a los jugadores del club con el estado de su cuenta
    Dado que el administrador del club con email "admin_puerto@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Cuando consulta los jugadores para invitar
    Entonces el sistema responde con 200
    Y los jugadores figuran con estos estados:
      | jugador          | estado       | division |
      | Ana Invitable    | NOT_INVITED  | M19      |
      | Pedro Concuenta  | LINKED       | Primera  |
      | Sol Sincorreo    | NO_EMAIL     | M19      |
      | Luis Repetido    | EMAIL_IN_USE | M19      |
      | Eva Pendiente    | INVITED      | M19      |
      | Leo Vencido      | EXPIRED      | M19      |
    Y "Eva" "Pendiente" figura con la fecha de envío y el vencimiento de su invitación

  Escenario: Un entrenador solo ve a los jugadores de las divisiones que entrena
    Dado que el coach con email "felipe.conte@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Cuando consulta los jugadores para invitar
    Entonces el sistema responde con 200
    Y la lista incluye a "Pedro Concuenta"
    Y la lista no incluye a "Ana Invitable"

  Escenario: Un jugador no puede consultar la lista
    Dado que el jugador con email "pedro.concuenta@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Cuando consulta los jugadores para invitar
    Entonces el sistema responde con 403

  Escenario: Sin sesión no se puede consultar la lista
    Dado un usuario sin sesión iniciada en la plataforma
    Cuando consulta los jugadores para invitar
    Entonces el sistema responde con 401
