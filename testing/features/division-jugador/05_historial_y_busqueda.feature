# language: es
Característica: Historial y búsqueda de jugadores de una división
  Como coach
  Quiero consultar jugadores actuales e históricos sin perder los casos con tildes
  Para encontrar rápidamente una persona de la división

  Escenario: La búsqueda de jugadores por nombre devuelve coincidencias
    Dado que el administrador del club con email "admin_puerto@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Cuando busca "Blue" entre los jugadores actuales de la division "Primera"
    Entonces el sistema responde con 200
    Y los resultados incluyen un jugador cuyo nombre contiene "Blue"

  Escenario: El endpoint de personas históricas devuelve personas de la división
    Dado que el administrador del club con email "admin_puerto@test.com" y contraseña "PassSegura123!" ha iniciado sesión
    Cuando consulta las personas con historial de la division "Primera"
    Entonces el sistema responde con 200
    Y la respuesta de historial contiene personas
