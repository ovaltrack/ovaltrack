# language: es
Característica: Nómina de un partido
  Como entrenador o analista de una división
  Quiero armar la nómina de 15 titulares y hasta 8 suplentes
  Para que la captura en vivo asigne los eventos a jugadores del partido

  Escenario: El entrenador guarda la nómina con los 15 titulares de la división
    Dado que el coach con email "felipe.conte@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Y que existe un partido programado para la división "Primera" contra "Patoruzú Rugby Club"
    Cuando intenta guardar el plantel con 15 titulares de la division
    Entonces el sistema responde con 200
    Y la nómina del partido tiene 15 titulares y 0 suplentes
    Y el detalle de la nómina muestra 15 titulares numerados desde el 1

  Escenario: Guardar la nómina completa pasa el partido de sin plantel a no iniciado
    Dado que el coach con email "felipe.conte@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Y que existe un partido programado para la división "Primera" contra "Patoruzú Rugby Club"
    Entonces el partido figura en estado "EMPTY_ROSTER"
    Cuando intenta guardar el plantel con 15 titulares de la division
    Entonces el partido figura en estado "NOT_STARTED"

  Escenario: Un partido sin nómina guardada devuelve la nómina vacía
    Dado que el coach con email "felipe.conte@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Y que existe un partido programado para la división "Primera" contra "Patoruzú Rugby Club"
    Entonces la nómina del partido tiene 0 titulares y 0 suplentes

  Escenario: La nómina exige exactamente 15 titulares
    Dado que el coach con email "felipe.conte@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Y que existe un partido programado para la división "Primera" contra "Patoruzú Rugby Club"
    Cuando intenta guardar el plantel con 14 titulares de la division
    Entonces el sistema responde con 409 y "El plantel debe tener exactamente 15 titulares"

  Escenario: La nómina no admite más de 8 suplentes
    Dado que el coach con email "felipe.conte@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Y que existe un partido programado para la división "Primera" contra "Patoruzú Rugby Club"
    Cuando intenta guardar un plantel con 9 suplentes
    Entonces el sistema responde con 409 y "El plantel no puede tener más de 8 suplentes"

  Escenario: Dos titulares no pueden tener el mismo número
    Dado que el coach con email "felipe.conte@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Y que existe un partido programado para la división "Primera" contra "Patoruzú Rugby Club"
    Cuando intenta guardar un plantel con dos titulares con el mismo número
    Entonces el sistema responde con 409 y "Los números del plantel no pueden repetirse"

  Escenario: No se puede incluir en la nómina a un jugador que no es de la división
    Dado que el coach con email "felipe.conte@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Y que existe un partido programado para la división "Primera" contra "Patoruzú Rugby Club"
    Cuando intenta guardar un plantel con un titular que no pertenece a la division
    Entonces el sistema responde con 409 y "El jugador no pertenece a la división del partido"

  Escenario: No se puede modificar la nómina de un partido ya iniciado
    Dado que el coach con email "felipe.conte@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Y que existe un partido programado para la división "Primera" contra "Patoruzú Rugby Club"
    Y que el partido está en curso
    Cuando intenta guardar el plantel con 15 titulares de la division
    Entonces el sistema responde con 409 y "No se puede modificar el plantel después de iniciar el partido"


  Escenario: Un administrador de otro club no puede consultar la nómina del partido
    Dado que el coach con email "felipe.conte@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Y que existe un partido programado para la división "Primera" contra "Patoruzú Rugby Club"
    Cuando el administrador del club con email "admin_multiclub@test.com" y contraseña "PassSegura123!" intenta consultar la nómina del partido
    Entonces el sistema responde con 403 y "Acceso denegado: el partido no pertenece a su club"

  Escenario: Un administrador de otro club no puede consultar el detalle de la nómina del partido
    Dado que el coach con email "felipe.conte@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Y que existe un partido programado para la división "Primera" contra "Patoruzú Rugby Club"
    Cuando el administrador del club con email "admin_multiclub@test.com" y contraseña "PassSegura123!" intenta consultar el detalle de la nómina del partido
    Entonces el sistema responde con 403 y "Acceso denegado: el partido no pertenece a su club"

  Escenario: Un administrador de otro club no puede guardar la nómina del partido
    Dado que el coach con email "felipe.conte@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Y que existe un partido programado para la división "Primera" contra "Patoruzú Rugby Club"
    Cuando el administrador del club con email "admin_multiclub@test.com" y contraseña "PassSegura123!" intenta guardar la nómina del partido
    Entonces el sistema responde con 403 y "Acceso denegado: solo el entrenador asignado o el administrador del club pueden gestionar este partido"
    Y la nómina del partido tiene 0 titulares y 0 suplentes
