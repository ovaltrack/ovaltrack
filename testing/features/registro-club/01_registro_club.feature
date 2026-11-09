# language: es
Característica: Creación de Administradores de Club
Esquema del escenario: Registro de administradores base para los clubes
Dado que el usuario completa el formulario de registro con los datos "<nombre>", "<apellido>", "<email>", "<contrasenia>", "<fechaNacimiento>", "<rol>", "<nombreClub>", "<ciudadClub>" y "<telefonoClub>"
Cuando presiona el boton "Guardar" para dar de alta su club
Entonces el sistema responde con <estadoCodigo> y "<estadoTexto>"
Ejemplos: Alta de clubes
| nombre | apellido | email                    | contrasenia    | fechaNacimiento | rol        | nombreClub | ciudadClub    | telefonoClub  | estadoCodigo | estadoTexto                                                     |
| Admin  | Puerto   | admin_puerto@test.com    | PassSegura123! | 1980-01-01      | ADMIN_CLUB | PMRC       | Puerto Madryn | +542804010203 | 201          | Solicitud de registro creada con éxito. Pendiente de aprobación |
| Admin  | Multi    | admin_multiclub@test.com | PassSegura123! | 1980-01-01      | ADMIN_CLUB | TRC        | Trelew        | +542804010204 | 201          | Solicitud de registro creada con éxito. Pendiente de aprobación |
| test   | admin    | admin@test_no_active.com | PassSegura123! | 1980-01-01      | ADMIN_CLUB | RWS        | Rawson        | +542804010204 | 201          | Solicitud de registro creada con éxito. Pendiente de aprobación |
|        | Multi    | admin_multiclub@test.com | PassSegura123! | 1980-01-01      | ADMIN_CLUB | TRC        | Trelew        | +542804010204 | 409          | El nombre del usuario es obligatorio.                           |
| Admin  |          | admin_multiclub@test.com | PassSegura123! | 1980-01-01      | ADMIN_CLUB | TRC        | Trelew        | +542804010204 | 409          | El apellido del usuario es obligatorio.                         |
| Admin  | Multi    | YEET                     | PassSegura123! | 1980-01-01      | ADMIN_CLUB | TRC        | Trelew        | +542804010204 | 409          | El formato del email de contacto del club no es válido.         |
| Admin  | Multi    | admin_multiclub@test.com | pipo           | 1980-01-01      | ADMIN_CLUB | TRC        | Trelew        | +542804010204 | 409          | La contraseña debe tener al menos 8 caracteres.                 |
| Admin  | Multi    | admin_multiclub@test.com | PassSegura123! |                 | ADMIN_CLUB | TRC        | Trelew        | +542804010204 | 409          | La fecha de nacimiento es obligatoria.                          |
| Admin  | Multi    | admin_multiclub@test.com | PassSegura123! | 1980-01-01      | ADMIN_CLUB |            | Trelew        | +542804010204 | 409          | El nombre del club es obligatorio.                              |
| Admin  | Multi    | admin_multiclub@test.com | PassSegura123! | 1980-01-01      | ADMIN_CLUB | TRC        |               | +542804010204 | 409          | La ciudad del club es obligatoria.                              |
| Admin  | Puerto   | admin_puerto@test.com    | PassSegura123! | 1980-01-01      | ADMIN_CLUB | PMRC       | Puerto Madryn | +542804010203 | 409          | El email ya fue registrado con una cuenta                       |




Escenario: No se puede solicitar el alta del club sin aceptar los términos
Dado que el usuario completa el formulario de registro con los datos "Admin", "Sin Terminos", "admin_sin_terminos@test.com", "PassSegura123!", "1980-01-01", "ADMIN_CLUB", "Club Sin Terminos", "Puerto Madryn" y "+542804010299"
Y no acepta los términos y condiciones
Cuando presiona el boton "Guardar" para dar de alta su club
Entonces el sistema responde con 409 y "Tenés que aceptar los Términos y Condiciones y la Política de Privacidad."
