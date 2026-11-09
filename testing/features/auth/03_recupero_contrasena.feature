# language: es
Característica: Recupero de contraseña
  Como usuario de OvalTrack que olvidó su contraseña
  Quiero recibir un enlace de un solo uso para elegir una nueva
  Para volver a entrar sin depender de un administrador

  Antecedentes:
    Dado la cuenta "recupero@test.com" con la contraseña "ClaveVieja123"

  # --- SOLICITUD ---

  Escenario: Pedir el recupero de un correo sin cuenta responde igual que uno existente
    Cuando solicita recuperar la contraseña de la cuenta "nadie.recupero@test.com"
    Entonces el sistema responde con 202 y "Solicitud enviada correctamente"

  Escenario: Pedir el recupero genera un único enlace vigente
    Cuando solicita recuperar la contraseña de la cuenta "recupero@test.com"
    Y solicita recuperar la contraseña de la cuenta "recupero@test.com"
    Entonces el sistema responde con 202 y "Solicitud enviada correctamente"
    Y la cuenta "recupero@test.com" tiene 1 enlace de recupero vigente

  Escenario: Un correo con formato inválido es rechazado
    Cuando solicita recuperar la contraseña de la cuenta "no-es-un-correo"
    Entonces el sistema responde con 409 y "El formato del email es inválido"

  # --- VALIDACIÓN DEL ENLACE ---

  Escenario: Un enlace vigente es válido
    Dado un enlace de recupero "enlace-vigente-1" para "recupero@test.com"
    Cuando valida el enlace de recupero "enlace-vigente-1"
    Entonces el sistema responde con 200
    Y el enlace corresponde a la cuenta "recupero@test.com"

  Esquema del escenario: Un enlace que no sirve es rechazado con el mismo mensaje
    Dado un enlace de recupero "<enlace>" para "recupero@test.com" que <estado>
    Cuando valida el enlace de recupero "<enlace>"
    Entonces el sistema responde con 409 y "El enlace no es válido o ya venció. Pedí uno nuevo."

    Ejemplos:
      | enlace           | estado               |
      | enlace-vencido-1 | venció               |
      | enlace-invita-1  | es de una invitación |
      | enlace-inexist-1 | no existe            |

  # --- CAMBIO DE CONTRASEÑA ---

  Escenario: Restablecer la contraseña permite entrar con la nueva y no con la vieja
    Dado un enlace de recupero "enlace-cambio-1" para "recupero@test.com"
    Cuando restablece la contraseña con el enlace "enlace-cambio-1" y la contraseña "ClaveNueva456"
    Entonces el sistema responde con 200 y "Tu contraseña quedó actualizada. Iniciá sesión con la nueva."
    Y la cuenta "recupero@test.com" puede iniciar sesión con "ClaveNueva456"
    Y la cuenta "recupero@test.com" no puede iniciar sesión con "ClaveVieja123"

  Escenario: Restablecer la contraseña cierra las sesiones abiertas
    Dado que el usuario con email "recupero@test.com" y contraseña "ClaveVieja123" ha iniciado sesión
    Y un enlace de recupero "enlace-sesion-1" para "recupero@test.com"
    Cuando restablece la contraseña con el enlace "enlace-sesion-1" y la contraseña "ClaveNueva456"
    Y consulta los datos de su sesión
    Entonces el sistema responde con 401 y "Tu sesión ya no es válida. Iniciá sesión de nuevo."

  Escenario: Un enlace no se puede usar dos veces
    Dado un enlace de recupero "enlace-doble-1" para "recupero@test.com"
    Y restablece la contraseña con el enlace "enlace-doble-1" y la contraseña "ClaveNueva456"
    Cuando restablece la contraseña con el enlace "enlace-doble-1" y la contraseña "OtraClave789"
    Entonces el sistema responde con 409 y "El enlace no es válido o ya venció. Pedí uno nuevo."
    Y la cuenta "recupero@test.com" puede iniciar sesión con "ClaveNueva456"

  Esquema del escenario: Una contraseña que no cumple la política es rechazada
    Dado un enlace de recupero "enlace-debil-1" para "recupero@test.com"
    Cuando restablece la contraseña con el enlace "enlace-debil-1" y la contraseña "<contrasenia>"
    Entonces el sistema responde con 409 y "<mensaje>"
    Y la cuenta "recupero@test.com" puede iniciar sesión con "ClaveVieja123"

    Ejemplos:
      | contrasenia  | mensaje                                                |
      | corta1       | La contraseña debe tener entre 8 y 72 caracteres       |
      | sololetrass  | La contraseña debe incluir al menos una letra y un número |
