import { When, Then } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { findDivisionByName } from "../../support/club_helper.js";
import { makeHttpRequest } from "../../support/httpRequest.js";

// Inicios de sesión: support/common_steps.js (administrador de club y "el sistema responde con ..."),
// creacion_jugadores.js (coach), autenticacion_steps.js (usuario genérico) y rechazo_activacion.js (OvalTrack).

// <==================== Helpers ====================>

// Las celdas vacías de la tabla se envían como null, igual que las celdas vacías de la planilla
const toImportRow = (row) => ({
  rowNumber: Number(row.fila),
  firstName: row.nombre || null,
  lastName: row.apellido || null,
  birthDate: row.fechaNacimiento || null,
  position: row.puesto || null,
  jerseyNumber: row.dorsal ? Number(row.dorsal) : null,
  contactEmail: row.correo || null,
  contactPhone: row.telefono || null,
});

const ONE_PLAYER_ROW = {
  rowNumber: 2,
  firstName: "Fuera",
  lastName: "DeAlcance",
  birthDate: "1990-01-01",
  position: "Pilar",
  jerseyNumber: null,
  contactEmail: null,
  contactPhone: null,
};

async function postImport(divisionId, rows, dryRun, token) {
  return makeHttpRequest("POST", "players/import", { divisionId, dryRun, rows }, token);
}

// División del club del usuario logueado (this.club). No se usa la caché por nombre de division_helper
// porque "Primera" existe en más de un club.
async function findOwnDivisionId(world, nombreDivision) {
  const division = await findDivisionByName(world.club.name, nombreDivision);
  return division.id;
}

async function findDivisionPlayers(world, nombreDivision) {
  const divisionId = await findOwnDivisionId(world, nombreDivision);
  const token = world.token;
  const response = await makeHttpRequest("GET", `players/with-user?divisionId=${divisionId}`, null, token);
  assert.equal(response.status, 200, `No se pudo obtener el plantel de ${nombreDivision}`);
  return response.body.filter((player) => player.endDate === null);
}

// <==================== Importar ====================>

When("importa en la division {string} la planilla:", async function (nombreDivision, dataTable) {
  const divisionId = await findOwnDivisionId(this, nombreDivision);
  this.response = await postImport(divisionId, dataTable.hashes().map(toImportRow), false, this.token);
});

When("revisa sin importar en la division {string} la planilla:", async function (nombreDivision, dataTable) {
  const divisionId = await findOwnDivisionId(this, nombreDivision);
  this.response = await postImport(divisionId, dataTable.hashes().map(toImportRow), true, this.token);
});

When(
  "importa en la division {string} del club {string} una planilla de un jugador",
  async function (nombreDivision, nombreClub) {
    const division = await findDivisionByName(nombreClub, nombreDivision);
    this.response = await postImport(division.id, [ONE_PLAYER_ROW], false, this.token);
  },
);

When("importa en la division {string} una planilla sin filas", async function (nombreDivision) {
  const divisionId = await findOwnDivisionId(this, nombreDivision);
  this.response = await postImport(divisionId, [], false, this.token);
});

// <==================== Resultado ====================>

Then("la importación informa {int} importados y {int} omitidos", function (importados, omitidos) {
  assert.equal(this.response.body.imported, importados, JSON.stringify(this.response.body.rows));
  assert.equal(this.response.body.skipped, omitidos);
});

Then("el resultado de la importación es:", function (dataTable) {
  const byRow = new Map(this.response.body.rows.map((row) => [row.rowNumber, row]));
  for (const expected of dataTable.hashes()) {
    const actual = byRow.get(Number(expected.fila));
    assert.ok(actual, `La respuesta no informa la fila ${expected.fila}`);
    assert.equal(actual.status, expected.estado, `Estado de la fila ${expected.fila}: ${actual.message}`);
    assert.equal(actual.field, expected.columna || null, `Columna de la fila ${expected.fila}`);
    assert.equal(actual.message, expected.mensaje || null, `Mensaje de la fila ${expected.fila}`);
    if (expected.estado === "IMPORTED") {
      assert.ok(actual.personId, `La fila ${expected.fila} no informa la persona creada`);
    }
  }
});

Then("la division {string} incluye a los jugadores:", async function (nombreDivision, dataTable) {
  const players = await findDivisionPlayers(this, nombreDivision);
  for (const expected of dataTable.hashes()) {
    const player = players.find(
      (p) => p.firstName === expected.nombre && p.lastName === expected.apellido,
    );
    assert.ok(player, `${expected.nombre} ${expected.apellido} no está en ${nombreDivision}`);
    assert.equal(player.position, expected.puesto);
    assert.equal(player.jerseyNumber, Number(expected.dorsal));
  }
});

Then(
  "la division {string} no incluye al jugador {string} {string}",
  async function (nombreDivision, nombre, apellido) {
    const players = await findDivisionPlayers(this, nombreDivision);
    assert.ok(
      !players.some((p) => p.firstName === nombre && p.lastName === apellido),
      `${nombre} ${apellido} no debería estar en ${nombreDivision}`,
    );
  },
);
