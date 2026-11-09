# language: es
Característica: Perfil del usuario
  Como usuario de la aplicación
  Quiero ver la información de mi cuenta y de mi club, y editar mis datos de contacto
  Para tener a mano mi información y mantenerla actualizada

  # Corre al final de la suite: edita el contacto de un jugador y no debe afectar a otras características.

  Escenario: El administrador de club ve su cuenta, su club y las divisiones del club
    Dado que el usuario "admin_puerto@test.com" con contraseña "PassSegura123!" inició sesión
    Cuando consulta su perfil
    Entonces el sistema responde con 200
    Y el perfil muestra la cuenta "admin_puerto@test.com" con el rol "ADMIN_CLUB" y estado "ACTIVE"
    Y el perfil muestra a la persona "Admin" "Puerto"
    Y el perfil muestra el club "PMRC" de "Puerto Madryn" administrado por "Admin Puerto"
    Y el perfil incluye la división "M19"

  Escenario: Un entrenador ve sus datos personales y su club
    Dado que el usuario "felipe.conte@test.com" con contraseña "PassSegura123!" inició sesión
    Cuando consulta su perfil
    Entonces el sistema responde con 200
    Y el perfil muestra la cuenta "felipe.conte@test.com" con el rol "COACH_ANALYST" y estado "ACTIVE"
    Y el perfil muestra a la persona "Felipe" "Contepomi" nacida el "1977-10-20"
    Y el perfil muestra el club "PMRC" de "Puerto Madryn" administrado por "Admin Puerto"
    Y el perfil registra la aceptación de los términos

  Escenario: El administrador de OvalTrack no pertenece a ningún club
    Dado que el administrador de OvalTrack inició sesión
    Cuando consulta su perfil
    Entonces el sistema responde con 200
    Y el perfil no muestra club

  Escenario: Sin sesión no se puede consultar el perfil
    Cuando un visitante sin sesión consulta el perfil
    Entonces el sistema responde con 401

  Escenario: El jugador actualiza su correo y teléfono de contacto
    Dado que el usuario "jugador.temporal@test.com" con contraseña "PassSegura123!" inició sesión
    Cuando actualiza su contacto con el correo "jugador.temporal.nuevo@test.com" y el teléfono "+54 280 4111111"
    Entonces el sistema responde con 200
    Y el perfil muestra el contacto "jugador.temporal.nuevo@test.com" y "+54 280 4111111"
    Y el usuario "jugador.temporal@test.com" con contraseña "PassSegura123!" sigue pudiendo iniciar sesión

  Escenario: No se puede usar el correo de contacto de otra persona
    Dado que el usuario "jugador.temporal@test.com" con contraseña "PassSegura123!" inició sesión
    Cuando actualiza su contacto con el correo "felipe.conte@test.com" y el teléfono "+54 280 4111111"
    Entonces el sistema responde con 409 y "El correo de contacto ya lo usa otra persona."

  Escenario: El correo de contacto debe tener un formato válido
    Dado que el usuario "jugador.temporal@test.com" con contraseña "PassSegura123!" inició sesión
    Cuando actualiza su contacto con el correo "no-es-un-correo" y el teléfono ""
    Entonces el sistema responde con 409 y "El formato del correo de contacto no es válido."

  Escenario: Con el contacto cambiado, el club no puede volver a invitar al jugador que ya tiene cuenta
    Dado que el usuario "admin_puerto@test.com" con contraseña "PassSegura123!" inició sesión
    Cuando invita a la persona "jugador.temporal.nuevo@test.com" a crear su cuenta
    Entonces el sistema responde con 409 y "Jugador Temporal ya tiene una cuenta vinculada."

  Escenario: Con el contacto cambiado, un enlace de invitación no ofrece crear otra cuenta
    Dado que el usuario "admin_puerto@test.com" con contraseña "PassSegura123!" inició sesión
    Y que el jugador con email "jugador.temporal.nuevo@test.com" recibió una invitación a la division "M19" con el token "token-contacto-cambiado"
    Cuando valida el token de invitación "token-contacto-cambiado"
    Entonces el sistema responde con 409 y "Ya tenés una cuenta en OvalTrack. Iniciá sesión con tu correo."
