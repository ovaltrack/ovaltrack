# language: es
Característica: Gestión de personas
  Como administrador de club
  Quiero registrar, consultar, editar y eliminar personas
  Para mantener los datos de contacto de quienes forman parte del club

  # --- ALTA Y CONSULTA ---

  Escenario: El administrador de club registra una persona
    Dado que el administrador del club con email "admin_puerto@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Cuando registra a la persona "Persona" "Temporal" con email "persona.temporal@test.com" y fecha de nacimiento "1990-04-10"
    Entonces el sistema responde con 200
    Y la persona con email "persona.temporal@test.com" puede consultarse por su ID con nombre "Persona" "Temporal"

  Esquema del escenario: No se puede registrar una persona con datos inválidos
    Dado que el administrador del club con email "admin_puerto@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Cuando registra a la persona "<nombre>" "<apellido>" con email "<email>" y fecha de nacimiento "<fechaNacimiento>"
    Entonces el sistema responde con 409 y "<mensaje>"

    Ejemplos:
      | nombre   | apellido | email                     | fechaNacimiento | mensaje                                         |
      | Repetida | Persona  | persona.temporal@test.com | 1990-04-10      | El email de contacto ya se encuentra registrado |
      |          | Persona  | sin.nombre@test.com       | 1990-04-10      | El nombre es obligatorio                        |
      | Futura   | Persona  | persona.futura@test.com   | 2999-01-01      | La fecha de nacimiento debe ser en el pasado    |

  Escenario: Consulta de una persona inexistente
    Dado que el administrador del club con email "admin_puerto@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Cuando consulta la persona inexistente con ID "00000000-0000-0000-0000-000000000000"
    Entonces el sistema responde con 404 y "Persona no encontrada"

  Escenario: Consulta del listado de personas
    Dado que el administrador del club con email "admin_puerto@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Cuando consulta el listado de personas
    Entonces el sistema responde con 200
    Y el listado incluye a las personas con email "persona.temporal@test.com" y "jugador.uno@test.com"

  Escenario: Consulta de los jugadores de una división
    Dado que el administrador del club con email "admin_puerto@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Cuando consulta las personas que juegan en la division "Primera"
    Entonces el sistema responde con 200
    Y el listado incluye a las personas con email "jugador.uno@test.com" y "jugador.dos@test.com"

  Escenario: Consulta de los jugadores del club disponibles para otra división
    Dado que el administrador del club con email "admin_puerto@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Cuando consulta los jugadores del club "PMRC" que no juegan en la division "M19"
    Entonces el sistema responde con 200
    Y el listado incluye a las personas con email "jugador.uno@test.com" y "jugador.dos@test.com"

  # --- EDICIÓN ---

  Escenario: El administrador de club edita los datos de una persona
    Dado que el administrador del club con email "admin_puerto@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Cuando edita a la persona con email "persona.temporal@test.com" con apellido "Editada" y teléfono "+542804111111"
    Entonces el sistema responde con 200
    Y la persona con email "persona.temporal@test.com" puede consultarse por su ID con nombre "Persona" "Editada"

  Escenario: No se puede asignar a una persona el email de otra
    Dado que el administrador del club con email "admin_puerto@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Cuando cambia el email de la persona "persona.temporal@test.com" por "jugador.uno@test.com"
    Entonces el sistema responde con 409 y "El email de contacto ya está registrado por otra persona"

  # --- PERMISOS DE EDICIÓN ---
  # El ADMIN_CLUB edita a cualquier persona de su club; un COACH_ANALYST, solo a jugadores de las divisiones que entrena.

  Escenario: El entrenador edita los datos de un jugador de su división
    Dado que el coach con email "felipe.conte@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Cuando guarda sin cambios los datos de la persona con email "jugador.dos@test.com"
    Entonces el sistema responde con 200

  Escenario: El entrenador no puede editar los datos del administrador del club
    Dado que el coach con email "felipe.conte@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Cuando guarda sin cambios los datos de la persona con email "admin_puerto@test.com"
    Entonces el sistema responde con 403

  Escenario: El administrador de otro club no puede editar los datos de un jugador ajeno
    Dado que el administrador del club con email "admin_multiclub@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Cuando guarda sin cambios los datos de la persona con email "jugador.dos@test.com"
    Entonces el sistema responde con 403

  # --- ELIMINACIÓN ---

  Escenario: El administrador de club elimina una persona
    Dado que el administrador del club con email "admin_puerto@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Cuando elimina a la persona con email "persona.temporal@test.com"
    Entonces el sistema responde con 200 y "Persona eliminada correctamente"
    Y la persona eliminada ya no puede consultarse

  Escenario: Eliminación de una persona inexistente
    Dado que el administrador del club con email "admin_puerto@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Cuando elimina a la persona inexistente con ID "00000000-0000-0000-0000-000000000000"
    Entonces el sistema responde con 409 y "Persona no encontrada"
