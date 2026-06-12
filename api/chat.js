import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { google } from "googleapis";
import OpenAI from "openai";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..");
const promptPath = path.join(rootDir, "assistant", "instrucciones_finanzas.md");
const configPath = path.join(rootDir, "data", "finanzas_config.json");

const affirmative = /^(si|sí|confirmo|confirmar|guardar|dale|ok|correcto|afirmativo)\b/i;
const negative = /^(no|cancelar|cancela|descartar)\b/i;
const authHeaderName = "x-finanzas-password";

async function loadTextContext() {
  const [instructions, configRaw] = await Promise.all([
    fs.readFile(promptPath, "utf8"),
    fs.readFile(configPath, "utf8"),
  ]);
  return { instructions, config: JSON.parse(configRaw) };
}

function getModel() {
  if (!process.env.OPENAI_MODEL) {
    throw new Error("Falta OPENAI_MODEL en variables privadas.");
  }
  return process.env.OPENAI_MODEL;
}

function getSpreadsheetId(config) {
  return process.env.FINANZAS_SPREADSHEET_ID || config.spreadsheetId;
}

function getDashboardUrl(config) {
  const id = getSpreadsheetId(config);
  const gid = process.env.FINANZAS_DASHBOARD_GID || config.dashboardGid;
  return `https://docs.google.com/spreadsheets/d/${id}/edit#gid=${gid}`;
}

function isAuthorized(req) {
  if (!process.env.APP_PASSWORD) return true;
  const directPassword = req.headers[authHeaderName];
  const bearerPassword = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  return directPassword === process.env.APP_PASSWORD || bearerPassword === process.env.APP_PASSWORD;
}

function requireAuth(req, res) {
  if (isAuthorized(req)) return true;
  res.status(401).json({
    error: "Ingresa la contraseña de acceso.",
    authRequired: true,
  });
  return false;
}

function parseServiceAccount() {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    throw new Error("Falta GOOGLE_SERVICE_ACCOUNT_JSON en variables privadas.");
  }
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  if (credentials.private_key) {
    credentials.private_key = credentials.private_key.replace(/\\n/g, "\n");
  }
  return credentials;
}

async function getSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: parseServiceAccount(),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

function normalizeKind(kind = "") {
  return String(kind)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_");
}

function normalizeText(value = "") {
  return String(value)
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeCategory(kind, value, config) {
  if (!value) return "";
  const key = normalizeKind(kind);
  const allowed = key === "ingresos" ? config.categories.ingresos : config.categories.gastos;
  const clean = normalizeText(value).toLowerCase();
  const found = allowed?.find((item) => normalizeText(item).toLowerCase() === clean);
  if (found) return found;
  if (key === "ingresos" && clean.includes("vela")) return "Bellapro";
  return value;
}

function normalizeStatus(value, config) {
  if (!value) return "Pendiente";
  const clean = normalizeText(value).toLowerCase();
  const found = config.categories.estados.find((item) => normalizeText(item).toLowerCase() === clean);
  return found || value;
}

function formatMoney(value) {
  const number = Number(value || 0);
  return `Bs ${number.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPercent(value) {
  const number = Number(value || 0);
  if (number > 0 && number < 1) return `${(number * 100).toFixed(2)}%`;
  return `${number}%`;
}

function parseNumber(value) {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;

  const text = String(value)
    .trim()
    .replace(/\s+/g, "")
    .replace(/,/g, ".")
    .replace(/[^\d.-]/g, "");
  if (!text || text === "-" || text === "." || text === "-.") return undefined;

  const number = Number(text);
  return Number.isFinite(number) ? number : undefined;
}

function setNumber(target, field, ...values) {
  for (const value of values) {
    const number = parseNumber(value);
    if (number !== undefined) {
      target[field] = number;
      return;
    }
  }
  delete target[field];
}

function setNumberWithDefault(target, field, defaultValue, ...values) {
  for (const value of values) {
    const number = parseNumber(value);
    if (number !== undefined) {
      target[field] = number;
      return;
    }
  }
  target[field] = defaultValue;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function formatDraft(draft) {
  const kind = normalizeKind(draft.tipo);
  const lines = ["**Borrador de registro**", ""];

  if (kind === "ingresos") {
    lines.push(
      "**Tipo:** Ingresos",
      `**Fecha:** ${draft.fecha || todayIso()}`,
      `**Descripción:** ${draft.descripcion || ""}`,
      `**Monto:** ${formatMoney(draft.monto)}`,
      `**Categoría:** ${draft.categoria || ""}`,
    );
  } else if (kind === "gastos") {
    lines.push(
      "**Tipo:** Gastos",
      `**Fecha:** ${draft.fecha || todayIso()}`,
      `**Descripción:** ${draft.descripcion || ""}`,
      `**Monto:** ${formatMoney(draft.monto)}`,
      `**Categoría:** ${draft.categoria || ""}`,
    );
  } else if (kind === "deudas") {
    lines.push(
      "**Tipo:** Deudas",
      `**Fecha:** ${draft.fecha || todayIso()}`,
      `**Acreedor:** ${draft.acreedor || ""}`,
      `**Descripción:** ${draft.descripcion || ""}`,
      `**Monto inicial:** ${formatMoney(draft.monto_inicial)}`,
      `**Pagado:** ${formatMoney(draft.pagado || 0)}`,
      `**Saldo:** ${formatMoney((draft.monto_inicial || 0) - (draft.pagado || 0))}`,
      `**Tasa de interés mensual:** ${formatPercent(draft.tasa_interes_mensual || 0)}`,
      `**Estado:** ${draft.estado || "Pendiente"}`,
      `**Fecha vencimiento:** ${draft.fecha_vencimiento || "No indicada"}`,
    );
  } else if (kind === "intereses") {
    const interes = draft.interes_calculado ?? (Number(draft.capital || 0) * Number(draft.tasa || 0));
    lines.push(
      "**Tipo:** Intereses",
      `**Fecha:** ${draft.fecha || todayIso()}`,
      `**Descripción:** ${draft.descripcion || ""}`,
      `**Capital:** ${formatMoney(draft.capital)}`,
      `**Tasa:** ${formatPercent(draft.tasa || 0)}`,
      `**Interés calculado:** ${formatMoney(interes)}`,
      `**Estado:** ${draft.estado || "Pendiente"}`,
    );
  } else if (kind === "cuentas_por_pagar") {
    lines.push(
      "**Tipo:** Cuentas por pagar",
      `**Fecha:** ${draft.fecha || todayIso()}`,
      `**Proveedor:** ${draft.proveedor || ""}`,
      `**Descripción:** ${draft.descripcion || ""}`,
      `**Monto:** ${formatMoney(draft.monto)}`,
      `**Fecha vencimiento:** ${draft.fecha_vencimiento || ""}`,
      `**Estado:** ${draft.estado || "Pendiente"}`,
    );
  } else if (kind === "cuentas_por_cobrar") {
    lines.push(
      "**Tipo:** Cuentas por cobrar",
      `**Fecha:** ${draft.fecha || todayIso()}`,
      `**Cliente:** ${draft.cliente || ""}`,
      `**Descripción:** ${draft.descripcion || ""}`,
      `**Monto:** ${formatMoney(draft.monto)}`,
      `**Fecha vencimiento:** ${draft.fecha_vencimiento || ""}`,
      `**Estado:** ${draft.estado || "Pendiente"}`,
    );
  }

  lines.push("", "**¿Confirmo?** Sí / No");
  return lines.join("\n");
}

function normalizeDraft(draft, config) {
  const kind = normalizeKind(draft.tipo || draft.kind);
  const normalized = { ...draft, tipo: kind, fecha: draft.fecha || todayIso() };

  if (kind === "ingresos" || kind === "gastos") {
    setNumber(normalized, "monto", draft.monto);
    normalized.categoria = normalizeCategory(kind, draft.categoria, config);
  }

  if (kind === "deudas") {
    setNumber(normalized, "monto_inicial", draft.monto_inicial, draft.monto);
    setNumberWithDefault(normalized, "pagado", 0, draft.pagado);
    setNumberWithDefault(normalized, "tasa_interes_mensual", 0, draft.tasa_interes_mensual, draft.tasa);
    if (normalized.tasa_interes_mensual > 1) normalized.tasa_interes_mensual /= 100;
    normalized.estado = normalizeStatus(draft.estado, config);
  }

  if (kind === "intereses") {
    setNumber(normalized, "capital", draft.capital);
    setNumber(normalized, "tasa", draft.tasa);
    if (normalized.tasa > 1) normalized.tasa /= 100;
    const interes = parseNumber(draft.interes_calculado);
    if (interes !== undefined) {
      normalized.interes_calculado = interes;
    } else if (normalized.capital !== undefined && normalized.tasa !== undefined) {
      normalized.interes_calculado = normalized.capital * normalized.tasa;
    } else {
      delete normalized.interes_calculado;
    }
    normalized.estado = normalizeStatus(draft.estado, config);
  }

  if (kind === "cuentas_por_pagar" || kind === "cuentas_por_cobrar") {
    setNumber(normalized, "monto", draft.monto);
    normalized.estado = normalizeStatus(draft.estado, config);
  }

  return normalized;
}

function requiredFields(draft) {
  const kind = normalizeKind(draft.tipo);
  if (!kind) return ["tipo"];

  const fields = {
    ingresos: ["fecha", "descripcion", "monto", "categoria"],
    gastos: ["fecha", "descripcion", "monto", "categoria"],
    deudas: ["fecha", "acreedor", "descripcion", "monto_inicial", "estado"],
    intereses: ["fecha", "descripcion", "capital", "tasa", "estado"],
    cuentas_por_pagar: ["fecha", "proveedor", "descripcion", "monto", "fecha_vencimiento", "estado"],
    cuentas_por_cobrar: ["fecha", "cliente", "descripcion", "monto", "fecha_vencimiento", "estado"],
  }[kind];

  if (!fields) return ["tipo"];

  const positiveNumberFields = {
    ingresos: ["monto"],
    gastos: ["monto"],
    deudas: ["monto_inicial"],
    intereses: ["capital", "tasa"],
    cuentas_por_pagar: ["monto"],
    cuentas_por_cobrar: ["monto"],
  }[kind] || [];

  const missing = fields.filter((field) => draft[field] === undefined || draft[field] === null || draft[field] === "");
  for (const field of positiveNumberFields) {
    if (!missing.includes(field) && (!Number.isFinite(Number(draft[field])) || Number(draft[field]) <= 0)) {
      missing.push(field);
    }
  }
  return missing;
}

async function readDashboardSummary(config) {
  const sheets = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId(config);
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Dashboard!A3:B12",
  });
  return result.data.values || [];
}

async function nextRow(sheets, spreadsheetId, sheetName) {
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${sheetName}'!A:A`,
  });
  return (result.data.values || []).length + 1;
}

async function saveDraft(draft, config) {
  const sheets = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId(config);
  const kind = normalizeKind(draft.tipo);
  const tab = config.tabs[kind];
  if (!tab) throw new Error(`Tipo no soportado: ${draft.tipo}`);

  const missing = requiredFields(draft);
  if (missing.length) {
    throw new Error(`Faltan datos para guardar: ${missing.join(", ")}.`);
  }

  const row = await nextRow(sheets, spreadsheetId, tab.sheetName);
  let values;

  if (kind === "ingresos" || kind === "gastos") {
    values = [draft.fecha, draft.descripcion, draft.monto, draft.categoria];
  } else if (kind === "deudas") {
    values = [
      draft.fecha,
      draft.acreedor,
      draft.descripcion,
      draft.monto_inicial,
      draft.pagado || 0,
      `=IF(D${row}="","",D${row}-E${row})`,
      draft.tasa_interes_mensual,
      draft.estado || "Pendiente",
      draft.fecha_vencimiento || "",
    ];
  } else if (kind === "intereses") {
    values = [
      draft.fecha,
      draft.descripcion,
      draft.capital,
      draft.tasa,
      `=IF(C${row}="","",C${row}*D${row})`,
      draft.estado || "Pendiente",
    ];
  } else if (kind === "cuentas_por_pagar") {
    values = [
      draft.fecha,
      draft.proveedor,
      draft.descripcion,
      draft.monto,
      draft.fecha_vencimiento,
      draft.estado || "Pendiente",
      `=IF(E${row}="","",E${row}-TODAY())`,
    ];
  } else if (kind === "cuentas_por_cobrar") {
    values = [
      draft.fecha,
      draft.cliente,
      draft.descripcion,
      draft.monto,
      draft.fecha_vencimiento,
      draft.estado || "Pendiente",
      `=IF(E${row}="","",E${row}-TODAY())`,
    ];
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${tab.sheetName}'!A${row}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [values] },
  });

  return { sheetName: tab.sheetName, row };
}

function plainMessages(messages) {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter((message) => message && ["user", "assistant"].includes(message.role))
    .slice(-12)
    .map((message) => `${message.role.toUpperCase()}: ${message.content || ""}`)
    .join("\n");
}

function lastUser(messages) {
  return [...(messages || [])].reverse().find((message) => message.role === "user")?.content || "";
}

function outputText(response) {
  if (response.output_text) return response.output_text;
  const parts = [];
  for (const item of response.output || []) {
    for (const content of item.content || []) {
      if (content.text) parts.push(content.text);
    }
  }
  return parts.join("\n").trim();
}

function parseJsonResponse(text) {
  const clean = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  return JSON.parse(clean);
}

async function draftFromModel(messages, instructions, config, pendingDraft) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.responses.create({
    model: getModel(),
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: `${instructions}

Convierte el ultimo pedido de registro en JSON estricto. Si no es registro, devuelve {"intent":"chat"}.
Tipos permitidos: ingresos, gastos, deudas, intereses, cuentas_por_pagar, cuentas_por_cobrar.
Usa fecha ISO yyyy-mm-dd. Si no hay fecha, usa ${todayIso()}.
Si hay un borrador pendiente y el usuario corrige o completa un dato, conserva los datos anteriores y devuelve el borrador completo actualizado.
No incluyas markdown.`,
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: `Contexto de conversacion:\n${plainMessages(messages)}\n\nBorrador pendiente:\n${JSON.stringify(pendingDraft || null)}\n\nCategorias y estructura:\n${JSON.stringify(config)}`,
          },
        ],
      },
    ],
  });

  return parseJsonResponse(outputText(response));
}

async function chatAnswer(messages, instructions, config) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const dashboardUrl = getDashboardUrl(config);
  let dashboardSummary = [];
  if (/informe|dashboard|finanzas/i.test(lastUser(messages))) {
    try {
      dashboardSummary = await readDashboardSummary(config);
    } catch {
      dashboardSummary = [];
    }
  }

  const response = await client.responses.create({
    model: getModel(),
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: `${instructions}

URL del Dashboard: ${dashboardUrl}
Resumen Dashboard: ${JSON.stringify(dashboardSummary)}
Si el usuario pide informe de Finanzas, incluye exactamente este enlace Markdown: [Ver Dashboard de Finanzas](${dashboardUrl}).`,
          },
        ],
      },
      ...messages.slice(-12).map((message) => ({
        role: message.role,
        content: [{ type: "input_text", text: String(message.content || "") }],
      })),
    ],
  });

  return outputText(response);
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    res.status(200).json({ authRequired: Boolean(process.env.APP_PASSWORD) });
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Metodo no permitido" });
    return;
  }

  if (!requireAuth(req, res)) return;

  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("Falta OPENAI_API_KEY en variables privadas.");
    }

    const { instructions, config } = await loadTextContext();
    const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    const pendingDraft = req.body?.pendingDraft || null;
    const text = lastUser(messages).trim();

    if (!text) {
      res.status(400).json({ error: "Envia al menos un mensaje." });
      return;
    }

    if (pendingDraft && affirmative.test(text)) {
      const normalized = normalizeDraft(pendingDraft, config);
      const saved = await saveDraft(normalized, config);
      res.status(200).json({
        reply: `Listo, ya registré en **Finanzas > ${saved.sheetName}**, fila ${saved.row}.\n\n${formatDraft(normalized).replace("**¿Confirmo?** Sí / No", "")}`,
        pendingDraft: null,
      });
      return;
    }

    if (pendingDraft && negative.test(text)) {
      res.status(200).json({ reply: "Perfecto, descarté el borrador. No guardé nada.", pendingDraft: null });
      return;
    }

    const draftResponse = await draftFromModel(messages, instructions, config, pendingDraft);
    if (draftResponse.intent !== "chat") {
      const sourceDraft = pendingDraft ? { ...pendingDraft, ...(draftResponse.draft || draftResponse) } : draftResponse.draft || draftResponse;
      const draft = normalizeDraft(sourceDraft, config);
      const missing = requiredFields(draft);
      if (missing.length) {
        res.status(200).json({
          reply: `Me falta este dato para preparar el registro: **${missing.join(", ")}**.`,
          pendingDraft: draft,
        });
        return;
      }

      res.status(200).json({ reply: formatDraft(draft), pendingDraft: draft });
      return;
    }

    if (pendingDraft) {
      res.status(200).json({
        reply: "Aún tengo un borrador pendiente. Responde **Sí** para guardarlo, **No** para descartarlo, o dime qué dato quieres cambiar.",
        pendingDraft,
      });
      return;
    }

    const reply = await chatAnswer(messages, instructions, config);
    res.status(200).json({ reply, pendingDraft: null });
  } catch (error) {
    res.status(500).json({ error: error.message || "Error desconocido" });
  }
}
