# language: es
Característica: Importación del plantel de una división desde una planilla
  Como administrador de club o coach de la división
  Quiero cargar el plantel de una vez desde una planilla
  Para no dar de alta jugador por jugador, sin duplicar a los que ya están en el club

  # Se importa en M19 para no alterar el plantel de Primera que usan los partidos.
  # Cada fila se resuelve por separado: IMPORTED, DUPLICATE o INVALID (con la columna y el motivo).

  Escenario: El administrador de club importa una planilla con filas válidas, duplicadas e inválidas
    Dado que el administrador del club con email "admin_puerto@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Cuando importa en la division "M19" la planilla:
      | fila | nombre | apellido  | fechaNacimiento | puesto | dorsal | correo                   | telefono |
      | 2    | Tomás  | Importado | 2000-04-10      | Pilar  | 1      | tomas.importado@test.com | 77000001 |
      | 3    | Bruno  | Importado | 2010-06-20      | Wing   | 11     | bruno.importado@test.com | 77000002 |
      | 4    | Lucas  | Menor     | 2011-01-15      | Centro | 12     |                          |          |
      | 5    | Sin    | Puesto    | 1999-02-02      |        | 5      |                          |          |
      | 6    | Blue   | Album     | 1985-03-15      | Pilar  | 3      |                          |          |
      | 7    | Otro   | Nombre    | 1990-01-01      | Ala    | 6      | JUGADOR.DOS@test.com     |          |
      | 8    | tomás  | importado | 2000-04-10      | Pilar  | 1      |                          |          |
      | 9    | Nuevo  | Telefono  | 1995-05-05      | Hooker | 2      |                          | 12345678 |
      | 10   | Dorsal | Alto      | 1995-05-05      | Hooker | 120    |                          |          |
    Entonces el sistema responde con 200
    Y la importación informa 2 importados y 7 omitidos
    Y el resultado de la importación es:
      | fila | estado    | columna      | mensaje                                                               |
      | 2    | IMPORTED  |              |                                                                       |
      | 3    | IMPORTED  |              |                                                                       |
      | 4    | INVALID   | contactEmail | La persona es menor de edad, se requieren metodos de contacto validos. |
      | 5    | INVALID   | position     | La posicion del jugador es obligatoria                                |
      | 6    | DUPLICATE |              | Ya existe en el club: Blue Album (no está en esta división)           |
      | 7    | DUPLICATE | contactEmail | Ya existe en el club: Art Angels (no está en esta división)           |
      | 8    | DUPLICATE |              | Repetido en la planilla: es el mismo jugador de la fila 2             |
      | 9    | INVALID   | contactPhone | Teléfono ya registrado                                                |
      | 10   | INVALID   | jerseyNumber | El dorsal debe estar entre 1 y 99                                     |
    Y la division "M19" incluye a los jugadores:
      | nombre | apellido  | puesto | dorsal |
      | Tomás  | Importado | Pilar  | 1      |
      | Bruno  | Importado | Wing   | 11     |

  Escenario: Volver a importar la misma planilla no duplica a los jugadores
    Dado que el administrador del club con email "admin_puerto@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Cuando importa en la division "M19" la planilla:
      | fila | nombre | apellido  | fechaNacimiento | puesto | dorsal | correo                   | telefono |
      | 2    | Tomás  | Importado | 2000-04-10      | Pilar  | 1      | tomas.importado@test.com | 77000001 |
    Entonces el sistema responde con 200
    Y la importación informa 0 importados y 1 omitidos
    Y el resultado de la importación es:
      | fila | estado    | columna | mensaje                                                       |
      | 2    | DUPLICATE |         | Ya existe en el club: Tomás Importado (ya está en esta división) |

  Escenario: El coach revisa una planilla de su división sin crear jugadores
    Dado que el coach con email "felipe.conte@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Cuando revisa sin importar en la division "Primera" la planilla:
      | fila | nombre | apellido | fechaNacimiento | puesto   | dorsal | correo | telefono |
      | 2    | Coach  | Revisa   | 1992-08-08      | Apertura | 10     |        |          |
      | 3    | Blue   | Album    | 1985-03-15      | Pilar    | 3      |        |          |
    Entonces el sistema responde con 200
    Y la importación informa 1 importados y 1 omitidos
    Y el resultado de la importación es:
      | fila | estado    | columna | mensaje                                                     |
      | 2    | READY     |         |                                                             |
      | 3    | DUPLICATE |         | Ya existe en el club: Blue Album (ya está en esta división) |
    Y la division "Primera" no incluye al jugador "Coach" "Revisa"

  Esquema del escenario: Solo el administrador del club y el coach de la división pueden importar
    Dado que el usuario con email "<email>" y contraseña "PassSegura123!" ha iniciado sesión
    Cuando importa en la division "<division>" del club "<club>" una planilla de un jugador
    Entonces el sistema responde con 403 y "<mensaje>"
    Ejemplos:
      | email                 | club | division | mensaje                                                                               |
      | admin_puerto@test.com | TRC  | Primera  | Acceso denegado: la división no pertenece a su club                                    |
      | felipe.conte@test.com | PMRC | M19      | Acceso denegado: solo un entrenador asignado a esta división puede realizar esta acción |

  Escenario: El administrador de OvalTrack no puede importar planteles
    Dado que el administrador de OvalTrack ha iniciado sesión
    Cuando importa en la division "M19" del club "PMRC" una planilla de un jugador
    Entonces el sistema responde con 403 y "Acceso denegado: solo el administrador del club puede realizar esta acción"

  Escenario: Una planilla sin jugadores es rechazada
    Dado que el administrador del club con email "admin_puerto@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Cuando importa en la division "M19" una planilla sin filas
    Entonces el sistema responde con 409 y "La planilla no tiene jugadores para importar"
