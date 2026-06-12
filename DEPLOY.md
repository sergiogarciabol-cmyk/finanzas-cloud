# Publicar FINANZAS

## Variables privadas necesarias

Configura estas variables en Vercel, Render o Railway:

- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `FINANZAS_SPREADSHEET_ID`
- `FINANZAS_DASHBOARD_GID`
- `APP_PASSWORD`
- `GOOGLE_SERVICE_ACCOUNT_JSON`

## Valores ya conocidos

- `OPENAI_MODEL`: `gpt-5`
- `FINANZAS_SPREADSHEET_ID`: `1QT9X32gfCh8ca7ui4fhTDwl3dR4liRiFySX9Cji05pI`
- `FINANZAS_DASHBOARD_GID`: `1866255223`
- `APP_PASSWORD`: una contraseña privada que solo tu conozcas

## Paso de Google Sheets

La variable `GOOGLE_SERVICE_ACCOUNT_JSON` debe venir de una cuenta de servicio de Google Cloud. Despues de crearla, comparte tu hoja Finanzas con el email `client_email` de esa cuenta y dale permiso de editor.

Hoja:
https://docs.google.com/spreadsheets/d/1QT9X32gfCh8ca7ui4fhTDwl3dR4liRiFySX9Cji05pI/edit#gid=1866255223

## Despliegue recomendado

Usar Vercel:

1. Crear un proyecto nuevo.
2. Subir esta carpeta.
3. Configurar las variables privadas.
4. Deploy.
5. Abrir el enlace desde el telefono.
6. En el telefono, toca Compartir > Agregar a pantalla de inicio para abrirlo como app.
