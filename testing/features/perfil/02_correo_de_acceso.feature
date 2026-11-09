# language: es
Característica: Cambio del correo de acceso
  Como usuario de la aplicación
  Quiero cambiar el correo con el que inicio sesión, confirmándolo con mi contraseña
  Para seguir entrando a mi cuenta si cambio de correo

  # Corre al final de la suite (después de 01_perfil_usuario): cambia el correo de acceso de dos cuentas.

  Escenario: No se puede cambiar el correo con una contraseña incorrecta
    Dado que el usuario "felipe.conte@test.com" con contraseña "PassSegura123!" inició sesión
    Cuando cambia su correo de acceso a "felipe.nuevo@test.com" con la contraseña "ClaveEquivocada1"
    Entonces el sistema responde con 409 y "La contraseña actual no es correcta."

  Escenario: El correo nuevo no puede ser el mismo que el actual
    Dado que el usuario "felipe.conte@test.com" con contraseña "PassSegura123!" inició sesión
    Cuando cambia su correo de acceso a "FELIPE.CONTE@test.com" con la contraseña "PassSegura123!"
    Entonces el sistema responde con 409 y "El correo nuevo es igual al actual."

  Escenario: No se puede usar el correo de otra cuenta
    Dado que el usuario "felipe.conte@test.com" con contraseña "PassSegura123!" inició sesión
    Cuando cambia su correo de acceso a "admin_puerto@test.com" con la contraseña "PassSegura123!"
    Entonces el sistema responde con 409 y "Ese correo ya lo usa otra cuenta o persona."

  Escenario: El correo nuevo debe tener un formato válido
    Dado que el usuario "felipe.conte@test.com" con contraseña "PassSegura123!" inició sesión
    Cuando cambia su correo de acceso a "sin-arroba" con la contraseña "PassSegura123!"
    Entonces el sistema responde con 409 y "El formato del correo nuevo no es válido."

  Escenario: El entrenador cambia su correo de acceso y debe volver a iniciar sesión
    Dado que el usuario "felipe.conte@test.com" con contraseña "PassSegura123!" inició sesión
    Cuando cambia su correo de acceso a "felipe.nuevo@test.com" con la contraseña "PassSegura123!"
    Entonces el sistema responde con 200 y "Tu correo de acceso cambió. Iniciá sesión con el correo nuevo."
    Y con la sesión anterior el perfil responde 401 con "Tu sesión ya no es válida. Iniciá sesión de nuevo."
    Y no puede iniciar sesión con "felipe.conte@test.com" y contraseña "PassSegura123!"
    Y el usuario "felipe.nuevo@test.com" con contraseña "PassSegura123!" sigue pudiendo iniciar sesión
    Y su perfil muestra el correo de acceso "felipe.nuevo@test.com" y el contacto "felipe.nuevo@test.com"

  Escenario: Si el correo de contacto era distinto, no se modifica
    Dado que el usuario "jugador.temporal@test.com" con contraseña "PassSegura123!" inició sesión
    Cuando cambia su correo de acceso a "jugador.acceso@test.com" con la contraseña "PassSegura123!"
    Entonces el sistema responde con 200
    Y el usuario "jugador.acceso@test.com" con contraseña "PassSegura123!" sigue pudiendo iniciar sesión
    Y su perfil muestra el correo de acceso "jugador.acceso@test.com" y el contacto "jugador.temporal.nuevo@test.com"
