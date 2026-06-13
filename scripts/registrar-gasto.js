#!/usr/bin/env node
/**
 * Script para registrar un gasto directamente en Google Sheets.
 * Requiere las variables de entorno configuradas en .env:
 *   GOOGLE_SERVICE_ACCOUNT_JSON
 *   FINANZAS_SPREADSHEET_ID  (opcional, usa el ID por defecto si no se define)
 *
 * Uso:
 *   node --env-file=.env scripts/registrar-gasto.js
 */

import { google } from "googleapis";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.join(__dirname, "..", "data", "finanzas_config.json");

// ── Gasto a registrar ──────────────────────────────────────────────────────────
const GASTO = {
  fecha: new Date().toISOString().slice(0, 10), // hoy
  descripcion: "Comida",
  monto: 100,
  categoria: "Alimentacion",
};
// ──────────────────────────────────────────────────────────────────────────────

async function main() {
  const config = JSON.parse(await fs.readFile(configPath, "utf8"));
  const spreadsheetId =
    process.env.FINANZAS_SPREADSHEET_ID || config.spreadsheetId;

  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    console.error(
      "Error: falta la variable GOOGLE_SERVICE_ACCOUNT_JSON.\n" +
        "Crea un archivo .env con tus credenciales y ejecuta:\n" +
        "  node --env-file=.env scripts/registrar-gasto.js"
    );
    process.exit(1);
  }

  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  if (credentials.private_key) {
    credentials.private_key = credentials.private_key.replace(/\\n/g, "\n");
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });

  // Determinar la siguiente fila vacía
  const rangeCheck = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "'Gastos'!A:A",
  });
  const nextRow = (rangeCheck.data.values || []).length + 1;

  // Insertar el gasto
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'Gastos'!A${nextRow}`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [
        [GASTO.fecha, GASTO.descripcion, GASTO.monto, GASTO.categoria],
      ],
    },
  });

  console.log(`Gasto registrado en la fila ${nextRow}:`);
  console.log(
    `  Fecha:      ${GASTO.fecha}\n` +
      `  Descripcion: ${GASTO.descripcion}\n` +
      `  Monto:      ${GASTO.monto} Bs\n` +
      `  Categoria:  ${GASTO.categoria}`
  );
}

main().catch((err) => {
  console.error("Error al registrar el gasto:", err.message);
  process.exit(1);
});
