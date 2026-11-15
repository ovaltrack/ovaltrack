# language: es
Característica: Guía de funcionalidades pendiente
  Como usuario con una cuenta recién creada
  Quiero que la guía de funcionalidades se abra sola una única vez
  Para conocer la aplicación sin que vuelva a aparecer en cada inicio de sesión

  Escenario: Una cuenta recién creada tiene la guía pendiente y deja de tenerla al marcarla vista
    Dado que el usuario "admin_puerto@test.com" con contraseña "PassSegura123!" inició sesión
    Cuando consulta su contexto
    Entonces el sistema responde con 200
    Y la guía figura pendiente
    Cuando marca la guía como vista
    Entonces el sistema responde con 204
    Cuando consulta su contexto
    Entonces la guía ya no figura pendiente

  Escenario: Marcar la guía como vista dos veces no falla
    Dado que el usuario "admin_puerto@test.com" con contraseña "PassSegura123!" inició sesión
    Cuando marca la guía como vista
    Entonces el sistema responde con 204
    Cuando consulta su contexto
    Entonces la guía ya no figura pendiente

  Escenario: Sin sesión no se puede marcar la guía
    Cuando un visitante sin sesión marca la guía como vista
    Entonces el sistema responde con 401
