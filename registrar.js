#!/usr/bin/env node
// Guarda un registro en Google Sheets > Finanzas
// Uso: node registrar.js <tipo> <descripcion> <monto> [categoria] [fecha]
// Tipos: ingresos | gastos | deudas | cuentas_por_pagar | cuentas_por_cobrar

import { config } from "dotenv";
config();
import { google } from "googleapis";

const SPREADSHEET_ID = process.env.FINANZAS_SPREADSHEET_ID;

const SHEETS = {
  ingresos:           "Ingresos",
  gastos:             "Gastos",
  deudas:             "Deudas",
  cuentas_por_pagar:  "Cuentas por pagar",
  cuentas_por_cobrar: "Cuentas por cobrar",
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function parseArgs() {
  const [, , tipo, descripcion, monto, categoria, fecha] = process.argv;
  if (!tipo || !descripcion || !monto) {
    console.error("Uso: node registrar.js <tipo> <descripcion> <monto> [categoria] [fecha]");
    console.error("Tipos: " + Object.keys(SHEETS).join(" | "));
    process.exit(1);
  }
  return {
    tipo: tipo.toLowerCase(),
    descripcion,
    monto: Number(monto),
    categoria: categoria || "",
    fecha: fecha || today(),
  };
}

async function getSheetsClient() {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    throw new Error("Falta GOOGLE_SERVICE_ACCOUNT_JSON en el entorno.");
  }
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  if (credentials.private_key) {
    credentials.private_key = credentials.private_key.replace(/\\n/g, "\n");
  }
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

async function nextRow(sheets, sheetName) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${sheetName}'!A:A`,
  });
  return (res.data.values || []).length + 1;
}

async function main() {
  const { tipo, descripcion, monto, categoria, fecha } = parseArgs();
  const sheetName = SHEETS[tipo];
  if (!sheetName) {
    console.error(`Tipo desconocido: ${tipo}. Usa: ${Object.keys(SHEETS).join(", ")}`);
    process.exit(1);
  }
  if (!SPREADSHEET_ID) {
    throw new Error("Falta FINANZAS_SPREADSHEET_ID en el entorno.");
  }

  const sheets = await getSheetsClient();
  const row = await nextRow(sheets, sheetName);
  const values = [fecha, descripcion, monto, categoria];

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${sheetName}'!A${row}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [values] },
  });

  console.log(`✓ Guardado en "${sheetName}" fila ${row}: ${fecha} | ${descripcion} | Bs ${monto} | ${categoria}`);
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
