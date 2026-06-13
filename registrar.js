#!/usr/bin/env node
/**
 * registrar.js — Guarda un registro en Google Sheets > Finanzas
 * Sigue el instructivo de la hoja "Instructivo" del libro.
 *
 * Uso directo (Claude lo llama internamente):
 *   node registrar.js <tipo> <campo=valor> [campo=valor ...]
 *
 * Tipos: ingreso | gasto | deuda | interes | cuenta_por_pagar | cuenta_por_cobrar
 */

import { config } from "dotenv";
config();
import { google } from "googleapis";

// ── Configuración ────────────────────────────────────────────────────────────

const SPREADSHEET_ID = process.env.FINANZAS_SPREADSHEET_ID;

const SHEET_MAP = {
  ingreso:           "Ingresos",
  gasto:             "Gastos",
  deuda:             "Deudas",
  interes:           "Intereses",
  cuenta_por_pagar:  "Cuentas por pagar",
  cuenta_por_cobrar: "Cuentas por cobrar",
};

// Columnas que se registran (excluye columnas con fórmula)
const COLUMNS = {
  ingreso:           ["Fecha", "Descripcion", "Monto", "Categoria"],
  gasto:             ["Fecha", "Descripcion", "Monto", "Categoria"],
  deuda:             ["Fecha", "Acreedor", "Descripcion", "Monto inicial", "Pagado", "Tasa interes mensual", "Estado", "Fecha vencimiento"],
  interes:           ["Fecha", "Descripcion", "Capital", "Tasa", "Estado"],
  cuenta_por_pagar:  ["Fecha", "Proveedor", "Descripcion", "Monto", "Fecha vencimiento", "Estado"],
  cuenta_por_cobrar: ["Fecha", "Cliente", "Descripcion", "Monto", "Fecha vencimiento", "Estado"],
};

// Columnas con fórmula (no se registran, solo se omiten)
const FORMULA_COLS = {
  deuda:            ["Saldo (col F)"],
  interes:          ["Interes calculado (col E)"],
  cuenta_por_pagar: ["Dias para vencer (col G)"],
  cuenta_por_cobrar:["Dias para vencer (col G)"],
};

const DEFAULTS = {
  ingreso:  { Fecha: today(), Descripcion: "Sin descripción", Monto: 0, Categoria: "Bellapro" },
  gasto:    { Fecha: today(), Descripcion: "Sin descripción", Monto: 0, Categoria: "Otros" },
  deuda:    { Fecha: today(), Acreedor: "Sin especificar", Descripcion: "Sin descripción", "Monto inicial": 0, Pagado: 0, "Tasa interes mensual": 0, Estado: "Pendiente", "Fecha vencimiento": "" },
  interes:  { Fecha: today(), Descripcion: "Interés", Capital: 0, Tasa: 0, Estado: "Pendiente" },
  cuenta_por_pagar:  { Fecha: today(), Proveedor: "Sin especificar", Descripcion: "Sin descripción", Monto: 0, "Fecha vencimiento": "", Estado: "Pendiente" },
  cuenta_por_cobrar: { Fecha: today(), Cliente: "Sin especificar", Descripcion: "Sin descripción", Monto: 0, "Fecha vencimiento": "", Estado: "Pendiente" },
};

// ── Utilidades ───────────────────────────────────────────────────────────────

function today() {
  return new Date().toISOString().slice(0, 10);
}

function parseArgs() {
  const args = process.argv.slice(2);
  if (!args.length) usage();
  const tipo = args[0].toLowerCase().replace(/ /g, "_");
  const fields = {};
  for (const arg of args.slice(1)) {
    const eq = arg.indexOf("=");
    if (eq === -1) { console.error(`Argumento inválido: ${arg}`); process.exit(1); }
    const key = arg.slice(0, eq).trim();
    const val = arg.slice(eq + 1).trim();
    fields[key] = val;
  }
  return { tipo, fields };
}

function usage() {
  console.error("Uso: node registrar.js <tipo> [campo=valor ...]");
  console.error("Tipos: " + Object.keys(SHEET_MAP).join(" | "));
  process.exit(1);
}

async function getSheetsClient() {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) throw new Error("Falta GOOGLE_SERVICE_ACCOUNT_JSON");
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  if (credentials.private_key) credentials.private_key = credentials.private_key.replace(/\\n/g, "\n");
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
  return google.sheets({ version: "v4", auth });
}

// Encuentra la siguiente fila vacía mirando solo columnas registrables (ignora fórmulas)
async function nextRow(sheets, sheetName) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${sheetName}'!A:A`,
  });
  return (res.data.values || []).length + 1;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const { tipo, fields } = parseArgs();
  const sheetName = SHEET_MAP[tipo];
  if (!sheetName) { console.error(`Tipo desconocido: ${tipo}`); process.exit(1); }
  if (!SPREADSHEET_ID) throw new Error("Falta FINANZAS_SPREADSHEET_ID");

  const cols = COLUMNS[tipo];
  const defaults = DEFAULTS[tipo];
  const formulaCols = FORMULA_COLS[tipo] || [];

  // Mezcla defaults + campos dictados
  const record = { ...defaults };
  for (const [k, v] of Object.entries(fields)) {
    // Busca la columna ignorando mayúsculas/espacios
    const match = cols.find(c => c.toLowerCase().replace(/ /g, "_") === k.toLowerCase().replace(/ /g, "_"));
    if (match) record[match] = v;
    else record[k] = v; // lo deja igual si no encuentra
  }

  // Valores aplicados por defecto
  const defaultsApplied = cols
    .filter(c => !fields[c] && !fields[c.toLowerCase().replace(/ /g, "_")])
    .map(c => `${c} = ${record[c] ?? ""}`);

  const sheets = await getSheetsClient();
  const row = await nextRow(sheets, sheetName);
  const values = cols.map(c => record[c] ?? "");

  // Mostrar borrador (sin Tipo ni Fila propuesta)
  const labelWidth = Math.max(...cols.map(c => c.length), "Hoja destino".length);
  const pad = (s) => s.padEnd(labelWidth);
  console.log("─────────────────────────────────────────────");
  console.log(`${pad("Hoja destino")}  :  ${sheetName}`);
  console.log("─────────────────────────────────────────────");
  cols.forEach((c, i) => console.log(`${pad(c)}  :  ${values[i]}`));
  if (formulaCols.length) {
    console.log("─────────────────────────────────────────────");
    console.log(`${pad("Col. con fórmula")}  :  ${formulaCols.join(", ")}`);
  }
  if (defaultsApplied.length) {
    console.log(`${pad("Defaults aplicados")}  :  ${defaultsApplied.join(" | ")}`);
  }
  console.log("─────────────────────────────────────────────");

  // Escribir en la hoja
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${sheetName}'!A${row}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [values] },
  });

  // Calcular total acumulado de la hoja
  const allRows = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${sheetName}'!C:C`,
  });
  const montoCol = (allRows.data.values || []).slice(1); // omite encabezado
  const total = montoCol.reduce((sum, r) => {
    const n = parseFloat(String(r[0] || "").replace(/[^0-9.-]/g, ""));
    return sum + (isNaN(n) ? 0 : n);
  }, 0);

  console.log(`✓ Registrado en "${sheetName}" fila ${row}`);
  console.log("─────────────────────────────────────────────");
  console.log(`${pad("Registro en fila")}  :  ${row}`);
  console.log(`${pad("Total acumulado")}   :  Bs ${total.toLocaleString("es-BO", { minimumFractionDigits: 2 })}`);
  console.log("─────────────────────────────────────────────");
}

main().catch(err => { console.error("Error:", err.message); process.exit(1); });
