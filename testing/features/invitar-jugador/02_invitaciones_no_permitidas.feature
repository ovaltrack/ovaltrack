# language: es
Característica: Invitaciones no permitidas
  Como administrador de club o entrenador
  Quiero que el sistema explique por qué no se puede invitar a un jugador
  Para corregir el dato o no enviar accesos innecesarios

  # Los envíos exitosos y el reenvío se prueban en InvitationServiceTest (sin servidor de mail).

  Antecedentes:
    Dado el jugador "Ana" "Invitable" con correo "ana.invitable@test.com" en la division "M19"
    Y el jugador "Pedro" "Concuenta" con correo "pedro.concuenta@test.com" y cuenta en la division "Primera"
    Y el jugador "Sol" "Sincorreo" sin correo en la division "M19"
    Y el jugador "Luis" "Repetido" con correo "felipe.conte@test.com" en la division "M19"

  Esquema del escenario: El administrador recibe un motivo claro al no poder invitar
    Dado que el administrador del club con email "admin_puerto@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Cuando invita a "<nombre>" "<apellido>"
    Entonces el sistema responde con 409 y "<mensaje>"

    Ejemplos:
      | nombre | apellido  | mensaje                                                                                    |
      | Pedro  | Concuenta | Pedro Concuenta ya tiene una cuenta vinculada.                                             |
      | Sol    | Sincorreo | Sol Sincorreo no tiene correo de contacto. Cargalo antes de invitarlo.                     |
      | Luis   | Repetido  | El correo felipe.conte@test.com ya es de otra cuenta. Actualizá el correo de contacto de Luis Repetido. |

  Escenario: Un entrenador no puede invitar a jugadores de divisiones que no entrena
    Dado que el coach con email "felipe.conte@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Cuando invita a "Ana" "Invitable"
    Entonces el sistema responde con 403 y "Solo podés invitar a jugadores de las divisiones que entrenás."

  Escenario: No se puede invitar a alguien que no juega en el club
    Dado que el administrador del club con email "admin_puerto@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Cuando invita a la persona con ID "00000000-0000-0000-0000-000000000000"
    Entonces el sistema responde con 404 y "No encontramos a ese jugador en tu club."

  Escenario: La invitación exige indicar el jugador
    Dado que el administrador del club con email "admin_puerto@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Cuando invita sin indicar el jugador
    Entonces el sistema responde con 409 y "Indicá a qué jugador querés invitar."

  Escenario: Un jugador no puede invitar
    Dado que el jugador con email "pedro.concuenta@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Cuando invita a "Ana" "Invitable"
    Entonces el sistema responde con 403

  Escenario: Ya no existen las consultas abiertas de invitaciones
    Dado que el administrador del club con email "admin_puerto@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Cuando consulta el listado general de invitaciones
    Entonces el sistema no responde 200
