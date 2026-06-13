import { google } from "googleapis";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.join(__dirname, "..", "data", "finanzas_config.json");

const GASTO = {
  fecha: new Date().toISOString().slice(0, 10),
  descripcion: "Comida",
  monto: 100,
  categoria: "Alimentacion",
};

const credentials = {
  type: "service_account",
  project_id: "glassy-wave-308822",
  private_key_id: "2598e919cd78b2c732739986141084f2d0c93068",
  private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDMZxubs68fbHZA\nt+ma1IgVBmRBRinoxLyU3ulUJU0IyQjJwFKdlVvRG0rp0Ndc51wGeeFQV0zbpS+k\nZeQZgVUBjH7/PfgM8N0StzCYm/hhR61aYqDjuMWxjAT7allB6eMxUWfOkiMJA02R\nOe1kHE+HrALZvWYfQGc1go7FoiE4LxdTg85G42Cv1uye7UFsMvAzzXhtUdy4KxRo\nQZW1AgnSC2YENp3n9uqgr6nV998zEQWsoUOAIoWwE69vTJXV1wZpiay/UbkXgAcR\nveHMA/cBBjpCU1GTMzph6fY7lYMlkXsQ6vncFyIX+J1HebBlKG7+w0su2biXfmeS\nyACw0xMjAgMBAAECggEAQLH13A9AQ3rp5swPJVFVjQoL21kg1KrIYXo4ccionDo9\nDNZRj80BVasEyAKw15fm2anj9bDcA71B2g/h5Wy5Ahd87r6nbzkhT9YpjHP5Zpjw\nNmZ3M/x8nhiKTyU3ARTNMwPoDkrUyfqAp5GlIIWRaoi4EkDPPN7+i8I5/DW3u/ci\nPrI9zUqD3dmQKD++YuiZxRfUlGnpR1RlxaikfvVgiJlg7FIq70LGzxozL0Kjxg3x\nkxLtRZid1z5fUFPypfqkg9WGlG0rUZ2gKeHEuTXRg+kOmMdQ2sSZWGiCZTMTezli\nR1Ei3wztLxcy+OqR83VB4AxB2pvbELqME4hMs+I5EQKBgQD7hX75yDODjLU5uIjx\nP5vxkaK4MQjTR7G8vAv9bYF2T1ivSXazaMJPeL1Ikh/5t4I7cjbOr5v8am02nx9+\nUxNi13nmUN1p3h6v+XXwzoA5yM10rkFtDc2eCk3qUXhSI6CFLh8bQxMBzvCjArka\nC6WVz86nH+CKepznsii4MuNeGQKBgQDQCtTzgKU2DabwDfKXNDE+K92+cWWpH4rX\na0Ng3u8mbJh0+kUzgQX0TN9brlP9aqdEi3Gr/Kwo/D2GcSGECv+jJSKKnNyMjUD7\nxhM2ARlrnvIJTF3lbu4FIkiezomKoMDlfNzZX/0NMVfTkGx7RaODInbhzgLfSu6M\nAhZ2VqEqmwKBgFmkCU4CYQGoW0pYD05TykM9EU4uA6QxMBJAvtEyfupoewX1270z\nP9VNBcDge07nbR28pfXhtmkukP/flDzUZNtcSlCgT1kU1cEH2lXZcu+lNjw4go7Y\nVYjWyVASexxjICl295UiwZpqY27lYIz8y6Xp6w+7F66i5lrZLxP+5vO5AoGBAMq4\n01tYDyUF1pbysGJAfH99lTz/GLXdQ5i4L9bURatmhITwXsBaSGgPBFM9IyC8bbOw\nQZr6wvPJH1bDJIqbgREDnY3+XjcjaaAtGgk0twWUw3rmDFUGbC9agfMlhQctr+mv\nazDyhQ32+ALzJ5JTgIrG6ZsM+OWHCb4qRqMXtUJjAoGBALn2nR1ZcNmZsabIJfxF\nR0Xsy7rj3DUX6UdnVq7SRauS3geleQtiufjaE+jrGKw9Iv3W4mPWg7WEm4I+Ch16\n7BJhgmzjNI9H6/HZ3Ce4EfICZpwQ5WP7h/80VeiQRu6rt5ojCjN2M5T5Q8D2VK/K\nCjsWf1FTZqm3faKJpyzaW0I6\n-----END PRIVATE KEY-----\n",
  client_email: "finanzas-nube@glassy-wave-308822.iam.gserviceaccount.com",
  client_id: "104446402410785337754",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/finanzas-nube%40glassy-wave-308822.iam.gserviceaccount.com",
  universe_domain: "googleapis.com",
};

const config = JSON.parse(await fs.readFile(configPath, "utf8"));
const spreadsheetId = config.spreadsheetId;

const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
const sheets = google.sheets({ version: "v4", auth });

const rangeCheck = await sheets.spreadsheets.values.get({
  spreadsheetId,
  range: "'Gastos'!A:A",
});
const nextRow = (rangeCheck.data.values || []).length + 1;

await sheets.spreadsheets.values.update({
  spreadsheetId,
  range: `'Gastos'!A${nextRow}`,
  valueInputOption: "USER_ENTERED",
  requestBody: {
    values: [[GASTO.fecha, GASTO.descripcion, GASTO.monto, GASTO.categoria]],
  },
});

console.log(`Gasto registrado en la fila ${nextRow}:`);
console.log(`  Fecha:       ${GASTO.fecha}`);
console.log(`  Descripcion: ${GASTO.descripcion}`);
console.log(`  Monto:       ${GASTO.monto} Bs`);
console.log(`  Categoria:   ${GASTO.categoria}`);
