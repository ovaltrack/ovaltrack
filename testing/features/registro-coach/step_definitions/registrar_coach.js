import { Given, When } from "@cucumber/cucumber";
import { makeHttpRequest } from "../../support/httpRequest.js";

// <==================== Helpers ====================>

const findClub = async (nombreClub, ciudadClub) => {
  if (!nombreClub) return null;
  const response = await makeHttpRequest("GET", `club/search/${encodeURIComponent(nombreClub)}`);
  const clubs = response.body ?? [];
  return clubs.find((club) => club.name === nombreClub && club.city === ciudadClub) ?? null;
};

// <==================== Registro de coach ====================>

Given(
  'que el coach {string} {string} {string} {string} {string} quiere registrarse en el {string} {string} como {string}',
  async function (nombre, apellido, email, contrasenia, fechaNacimiento, nombreClub, ciudadClub, rol) {
    this.applicant = {
      email,
      password: contrasenia,
      requestedRole: rol,
      firstName: nombre,
      lastName: apellido,
      birthDate: fechaNacimiento || null,
    };
    this.club = await findClub(nombreClub, ciudadClub);

  },
);

When('el coach presiona el botón para enviar su solicitud', async function () {
  this.response = await makeHttpRequest("POST", "api/auth/register", {
    applicant: this.applicant,
    club: this.club ? { id: this.club.id } : null,
    termsAccepted: this.termsAccepted ?? true,
  });
});


