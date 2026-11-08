# language: es
Característica: Cambio de administrador de un club desde el panel de OvalTrack
  Como administrador de OvalTrack
  Quiero designar a un entrenador del club como su nuevo administrador
  Para que el club no quede sin alguien que pueda administrarlo

  # El nuevo admin se elige entre los entrenadores/analistas activos del club y pasa a ADMIN_CLUB;
  # el anterior pasa a COACH_ANALYST (solo puede haber un ADMIN_CLUB por club)

  Escenario: Los candidatos son solo los entrenadores activos del club
    Dado que el administrador de OvalTrack ha iniciado sesión
    Y que el club "Club Candidatos" de la ciudad "Trelew" está activo con el administrador "admin.candidatos@test.com"
    Y que el club "Club Candidatos" tiene la cuenta activa "coach.candidatos@test.com" con rol "COACH_ANALYST"
    Y que el club "Club Candidatos" tiene la cuenta inactiva "coach.baja.candidatos@test.com" con rol "COACH_ANALYST"
    Y que el club "Club Candidatos" tiene la cuenta activa "jugador.candidatos@test.com" con rol "PLAYER"
    Cuando consulta los candidatos a administrador del club "Club Candidatos"
    Entonces los candidatos son solo "coach.candidatos@test.com"

  Escenario: El administrador de OvalTrack cambia el administrador de un club
    Dado que el administrador de OvalTrack ha iniciado sesión
    Y que el club "Club Relevo" de la ciudad "Rawson" está activo con el administrador "admin.relevo@test.com"
    Y que el club "Club Relevo" tiene la cuenta activa "coach.relevo@test.com" con rol "COACH_ANALYST"
    Cuando designa a "coach.relevo@test.com" como administrador del club "Club Relevo"
    Entonces el sistema responde con 200 y "El administrador del club fue actualizado."
    Y el administrador del club "Club Relevo" es "coach.relevo@test.com"
    Y la cuenta "coach.relevo@test.com" tiene el rol "ADMIN_CLUB"
    Y la cuenta "admin.relevo@test.com" tiene el rol "COACH_ANALYST"
    Y la cuenta "coach.relevo@test.com" no figura entre las solicitudes de registro

  Escenario: El cambio de rol rige sin volver a iniciar sesión
    Dado que el administrador de OvalTrack ha iniciado sesión
    Y que el club "Club Relevo Sesion" de la ciudad "Gaiman" está activo con el administrador "admin.relevo.sesion@test.com"
    Y que el club "Club Relevo Sesion" tiene la cuenta activa "coach.relevo.sesion@test.com" con rol "COACH_ANALYST"
    Y que "admin.relevo.sesion@test.com" y "coach.relevo.sesion@test.com" tienen la sesión abierta
    Cuando designa a "coach.relevo.sesion@test.com" como administrador del club "Club Relevo Sesion"
    Entonces el sistema responde con 200
    Y con su sesión anterior "admin.relevo.sesion@test.com" ya no puede crear rivales
    Y con su sesión anterior "coach.relevo.sesion@test.com" puede crear rivales

  Escenario: No se puede designar a un entrenador de otro club
    Dado que el administrador de OvalTrack ha iniciado sesión
    Y que el club "Club Candidatos" de la ciudad "Trelew" está activo con el administrador "admin.candidatos@test.com"
    Y que el club "Club Ajeno" de la ciudad "Esquel" está activo con el administrador "admin.ajeno@test.com"
    Y que el club "Club Ajeno" tiene la cuenta activa "coach.ajeno@test.com" con rol "COACH_ANALYST"
    Cuando designa a "coach.ajeno@test.com" como administrador del club "Club Candidatos"
    Entonces el sistema responde con 409 y "El nuevo administrador tiene que pertenecer al club"

  Escenario: No se puede designar a un jugador
    Dado que el administrador de OvalTrack ha iniciado sesión
    Y que el club "Club Candidatos" de la ciudad "Trelew" está activo con el administrador "admin.candidatos@test.com"
    Y que el club "Club Candidatos" tiene la cuenta activa "jugador.candidatos@test.com" con rol "PLAYER"
    Cuando designa a "jugador.candidatos@test.com" como administrador del club "Club Candidatos"
    Entonces el sistema responde con 409 y "Solo un entrenador/analista del club puede ser su administrador"

  Escenario: No se puede designar a un entrenador con la cuenta inactiva
    Dado que el administrador de OvalTrack ha iniciado sesión
    Y que el club "Club Candidatos" de la ciudad "Trelew" está activo con el administrador "admin.candidatos@test.com"
    Y que el club "Club Candidatos" tiene la cuenta inactiva "coach.baja.candidatos@test.com" con rol "COACH_ANALYST"
    Cuando designa a "coach.baja.candidatos@test.com" como administrador del club "Club Candidatos"
    Entonces el sistema responde con 409 y "El nuevo administrador tiene que tener la cuenta activa"

  Escenario: No se puede designar al administrador actual
    Dado que el administrador de OvalTrack ha iniciado sesión
    Y que el club "Club Candidatos" de la ciudad "Trelew" está activo con el administrador "admin.candidatos@test.com"
    Cuando designa a "admin.candidatos@test.com" como administrador del club "Club Candidatos"
    Entonces el sistema responde con 409 y "El usuario ya es el administrador del club"

  Escenario: No se puede cambiar el administrador de un club pendiente
    Dado que el administrador de OvalTrack ha iniciado sesión
    Y que el club "Club En Espera" de la ciudad "Sarmiento" solicitó su alta con el administrador "admin.espera@test.com"
    Cuando designa a "admin.espera@test.com" como administrador del club "Club En Espera"
    Entonces el sistema responde con 409 y "El club todavía está pendiente de aprobación"

  Escenario: Cambio de administrador de un club inexistente
    Dado que el administrador de OvalTrack ha iniciado sesión
    Cuando designa un administrador al club inexistente con ID "00000000-0000-0000-0000-000000000000"
    Entonces el sistema responde con 409 y "El club no existe"

  # Alta directa con POST /user: una cuenta que nace activa no es una solicitud pendiente
  Escenario: Una cuenta de administrador creada activa no figura entre las solicitudes de registro
    Dado que el administrador de OvalTrack ha iniciado sesión
    Y que el club "Club Candidatos" de la ciudad "Trelew" está activo con el administrador "admin.candidatos@test.com"
    Y que el club "Club Candidatos" tiene la cuenta activa "admin.alta.directa@test.com" con rol "ADMIN_CLUB"
    Y que el club "Club Candidatos" tiene la cuenta inactiva "admin.alta.pendiente@test.com" con rol "ADMIN_CLUB"
    Entonces la cuenta "admin.alta.directa@test.com" no figura entre las solicitudes de registro
    Y la cuenta "admin.alta.pendiente@test.com" figura entre las solicitudes de registro
