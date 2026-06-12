# Chat FINANZAS en la nube

Este paquete copia el hilo entrenado **FINANZAS** hacia una base lista para nube.

- Instrucciones del chat FINANZAS en `assistant/instrucciones_finanzas.md`
- Estructura del Google Sheet real en `data/finanzas_config.json`
- Mini chat web para abrir desde el telefono en `public/index.html`
- Funcion privada `api/chat.js` para llamar a OpenAI y Google Sheets sin exponer claves

## Como se usa

1. Sube esta carpeta a un proyecto en Vercel, Render o Railway.
2. Configura las variables privadas:
   - `OPENAI_API_KEY`
   - `OPENAI_MODEL`
   - `FINANZAS_SPREADSHEET_ID`
   - `FINANZAS_DASHBOARD_GID`
   - `APP_PASSWORD`
   - `GOOGLE_SERVICE_ACCOUNT_JSON`
3. Publica el proyecto.
4. Abre el enlace desde el telefono.

## Conexion con Google Sheets

Para que el chat pueda leer y guardar registros cuando la Mac este apagada:

1. Crea una cuenta de servicio en Google Cloud.
2. Copia su JSON completo en `GOOGLE_SERVICE_ACCOUNT_JSON`.
3. Comparte tu Google Sheet **Finanzas** con el email `client_email` de esa cuenta de servicio.
4. Dale permiso de editor si quieres que pueda registrar ingresos, gastos, deudas, intereses, cuentas por pagar y cuentas por cobrar.

Hoja actual:

https://docs.google.com/spreadsheets/d/1QT9X32gfCh8ca7ui4fhTDwl3dR4liRiFySX9Cji05pI/edit#gid=1866255223

## Comportamiento copiado del chat FINANZAS

- Cuando pides registrar algo, primero muestra **Borrador de registro**.
- Solo guarda cuando respondes **Si** o **Sí**.
- Si pides informe de Finanzas, muestra el boton del Dashboard.
- Usa las pestañas reales: Ingresos, Gastos, Deudas, Intereses, Cuentas por pagar, Cuentas por cobrar, Dashboard y Categorías.
- Respeta categorias y estados del archivo.

## Seguridad

No pongas la clave de OpenAI en `public/index.html`. La clave solo debe vivir como variable privada del servidor.

Configura `APP_PASSWORD` en Vercel para pedir contraseña antes de usar el chat. Si no configuras esa variable, el chat queda abierto para cualquiera que tenga el enlace.
