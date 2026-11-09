# language: es
Característica: Desactivación y reactivación de clubes desde el panel de OvalTrack
  Como administrador de OvalTrack
  Quiero desactivar un club y poder reactivarlo
  Para que sus miembros pierdan el acceso sin borrar los datos del club

  # Un club desactivado queda en estado REJECTED (el mismo que una solicitud rechazada)

  Escenario: El administrador de OvalTrack desactiva un club activo
    Dado que el administrador de OvalTrack ha iniciado sesión
    Y que el club "Club Desactivable" de la ciudad "Puerto Madryn" está activo con el administrador "admin.desactivable@test.com"
    Cuando desactiva el club "Club Desactivable"
    Entonces el sistema responde con 200 y "El club fue rechazado."
    Y el club "Club Desactivable" figura entre los clubes rechazados

  Escenario: Un miembro de un club desactivado no puede iniciar sesión
    Dado que el administrador de OvalTrack ha iniciado sesión
    Y que el club "Club Desactivable" de la ciudad "Puerto Madryn" está activo con el administrador "admin.desactivable@test.com"
    Y que el club "Club Desactivable" fue desactivado
    Cuando "admin.desactivable@test.com" intenta iniciar sesión
    Entonces el sistema responde con 403 y "Tu club no está activo. Contactá al administrador de la plataforma."

  Escenario: Un miembro con la sesión abierta pierde el acceso al desactivar su club
    Dado que el administrador de OvalTrack ha iniciado sesión
    Y que el club "Club Desactivable" de la ciudad "Puerto Madryn" está activo con el administrador "admin.desactivable@test.com"
    Y que "admin.desactivable@test.com" tiene la sesión abierta
    Y que el club "Club Desactivable" fue desactivado
    Cuando consulta su contexto con la sesión abierta
    Entonces el sistema responde con 401 y "Tu club no está activo. Contactá al administrador de la plataforma."

  Escenario: El administrador de OvalTrack reactiva un club desactivado
    Dado que el administrador de OvalTrack ha iniciado sesión
    Y que el club "Club Desactivable" de la ciudad "Puerto Madryn" está activo con el administrador "admin.desactivable@test.com"
    Y que el club "Club Desactivable" fue desactivado
    Cuando reactiva el club "Club Desactivable"
    Entonces el sistema responde con 200 y "El club fue reactivado."
    Y "admin.desactivable@test.com" puede iniciar sesión

  Escenario: Reactivación de un club que ya está activo
    Dado que el administrador de OvalTrack ha iniciado sesión
    Y que el club "Club Desactivable" de la ciudad "Puerto Madryn" está activo con el administrador "admin.desactivable@test.com"
    Cuando reactiva el club "Club Desactivable"
    Entonces el sistema responde con 409 y "Solo se puede reactivar un club inactivo"

  Escenario: Reactivación de un club cuyo administrador está inactivo
    Dado que el administrador de OvalTrack ha iniciado sesión
    Y que el club "Club Sin Admin" de la ciudad "Esquel" está activo con el administrador "admin.sinadmin@test.com"
    Y que el club "Club Sin Admin" fue desactivado
    Y que la cuenta "admin.sinadmin@test.com" fue desactivada
    Cuando reactiva el club "Club Sin Admin"
    Entonces el sistema responde con 409 y "El administrador del club debe estar activo para reactivarlo"

  Escenario: Reactivación de un club inexistente
    Dado que el administrador de OvalTrack ha iniciado sesión
    Cuando reactiva el club inexistente con ID "00000000-0000-0000-0000-000000000000"
    Entonces el sistema responde con 409 y "El club no existe"

  Escenario: Una cuenta desactivada con la sesión abierta pierde el acceso
    Dado que el administrador de OvalTrack ha iniciado sesión
    Y que el club "Club Cuenta Baja" de la ciudad "Sarmiento" está activo con el administrador "admin.cuentabaja@test.com"
    Y que "admin.cuentabaja@test.com" tiene la sesión abierta
    Y que la cuenta "admin.cuentabaja@test.com" fue desactivada
    Cuando consulta su contexto con la sesión abierta
    Entonces el sistema responde con 401 y "Tu cuenta no está activa."

  Escenario: Desactivar un club no afecta al administrador de OvalTrack
    Dado que el administrador de OvalTrack ha iniciado sesión
    Y que el club "Club Desactivable" de la ciudad "Puerto Madryn" está activo con el administrador "admin.desactivable@test.com"
    Y que el club "Club Desactivable" fue desactivado
    Cuando consulta los clubes revisados del panel
    Entonces el sistema responde con 200

  # Un token de una cuenta bloqueada no rompe las rutas públicas (p. ej. el registro de entrenador)
  Escenario: Una ruta pública sigue respondiendo con la sesión de una cuenta desactivada
    Dado que el administrador de OvalTrack ha iniciado sesión
    Y que el club "Club Cuenta Baja" de la ciudad "Sarmiento" está activo con el administrador "admin.cuentabaja@test.com"
    Y que "admin.cuentabaja@test.com" tiene la sesión abierta
    Y que la cuenta "admin.cuentabaja@test.com" fue desactivada
    Cuando consulta los clubes disponibles para registrarse con la sesión abierta
    Entonces el sistema responde con 200
