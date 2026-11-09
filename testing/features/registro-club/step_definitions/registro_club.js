import { Given, When } from "@cucumber/cucumber";
import { makeHttpRequest } from "../../support/httpRequest.js";

// ============================ Registro de Admin del Club ============================

Given('que el usuario completa el formulario de registro con los datos {string}, {string}, {string}, {string}, {string}, {string}, {string}, {string} y {string}', function (nombre, apellido, email, contrasenia, fechaNacimiento, rol, nombreClub, ciudadClub, telefonoClub) {
  const adminData = {
    email: email,
    password: contrasenia,
    firstName: nombre,
    lastName: apellido,
    birthDate: fechaNacimiento,
    role: rol,
  };
  const clubData = {
    name: nombreClub,
    city: ciudadClub,
    contactEmail: email,
    contactPhone: telefonoClub,
  };
  this.clubRegistrationDTO = {
    admin: adminData,
    club: clubData,
  };
});


When(
  'presiona el boton {string} para dar de alta su club',
  async function (string1) {
      this.response = await makeHttpRequest('POST', 'api/auth/register-club', { ...this.clubRegistrationDTO, termsAccepted: this.termsAccepted ?? true });
  }
);

