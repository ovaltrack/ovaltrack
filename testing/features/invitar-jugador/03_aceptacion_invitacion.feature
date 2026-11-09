# language: es
Característica: Aceptación de invitaciones
  Como jugador invitado a una división
  Quiero validar mi enlace de invitación y crear mi cuenta
  Para ingresar a la aplicación sin esperar la aprobación del club

  # La invitación se inserta en la base con un token conocido: enviarla por la API exige un servidor de mail.
  # Todos los escenarios usan a la misma persona (una invitación es única por persona y división).

  Antecedentes:
    Dado que el administrador del club con email "admin_puerto@test.com" y contraseña "PassSegura123!" ha iniciado sesión

  Escenario: Un enlace vigente permite crear la cuenta del jugador invitado
    Dado que el jugador con email "jugador.temporal@test.com" recibió una invitación a la division "M19" con el token "token-vigente"
    Cuando valida el token de invitación "token-vigente"
    Entonces el sistema responde con 200
    Y la validación indica la acción "CREATE_ACCOUNT" para la persona "jugador.temporal@test.com" en la division "M19"

  Escenario: Un enlace inexistente es rechazado
    Cuando valida el token de invitación "token-que-nunca-se-envio"
    Entonces el sistema responde con 409 y "Token no encontrado."

  Escenario: Un enlace vencido es rechazado
    Dado que el jugador con email "jugador.temporal@test.com" recibió una invitación vencida a la division "M19" con el token "token-vencido"
    Cuando valida el token de invitación "token-vencido"
    Entonces el sistema responde con 409 y "Este enlace venció."

  Escenario: No se puede crear la cuenta con una contraseña sin números
    Dado que el jugador con email "jugador.temporal@test.com" recibió una invitación a la division "M19" con el token "token-contrasena"
    Cuando se registra con el token "token-contrasena" y la contraseña "SoloLetrasLargas"
    Entonces el sistema responde con 409 y "La contraseña debe incluir al menos una letra y un número"

  Escenario: No se puede crear la cuenta sin aceptar los términos
    Dado que el jugador con email "jugador.temporal@test.com" recibió una invitación a la division "M19" con el token "token-sin-terminos"
    Y no acepta los términos y condiciones
    Cuando se registra con el token "token-sin-terminos" y la contraseña "PassSegura123!"
    Entonces el sistema responde con 409 y "Tenés que aceptar los Términos y Condiciones y la Política de Privacidad."

  Escenario: El jugador crea su cuenta desde la invitación y el enlace deja de ser válido
    Dado que el jugador con email "jugador.temporal@test.com" recibió una invitación a la division "M19" con el token "token-registro"
    Cuando se registra con el token "token-registro" y la contraseña "PassSegura123!"
    Entonces el sistema responde con 201 y "Cuenta creada con éxito"
    Y el jugador inicia sesión con email "jugador.temporal@test.com" y contraseña "PassSegura123!"
    Y la cuenta tiene el rol "PLAYER"
    Y el enlace "token-registro" ya no es válido

  Escenario: Un usuario sin sesión no puede consultar una invitación por su ID
    Dado un usuario sin sesión iniciada en la plataforma
    Cuando consulta una invitación con un ID cualquiera
    Entonces el sistema responde con 401
