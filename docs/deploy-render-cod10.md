# Desplegar OpenWA en Render (Codigo 10)

Guía para tener WhatsApp **24/7 en la nube** sin usar la laptop.

## Arquitectura

```
WhatsApp ←→ OpenWA (Render) ←→ cod10.vercel.app (bot Gemini) ←→ MongoDB
                ↑
         Admin cod10-admin (config: clave Gemini, prompt, URL Render)
```

## Requisitos

- Cuenta en [Render](https://render.com)
- Repo OpenWA en GitHub (sube `d:\portafolio\OpenWA` si aún no está)
- Plan **Standard** (~2 GB RAM) — Chromium no funciona bien en Starter
- Disco persistente **1 GB** (sesiones WhatsApp + SQLite)

## Paso 1 — Subir OpenWA a GitHub

Si el repo no está en GitHub:

```powershell
cd D:\portafolio\OpenWA
git remote add origin https://github.com/TU-USUARIO/openwa.git
git push -u origin main
```

## Paso 2 — Crear servicio en Render

1. Entra a https://dashboard.render.com
2. **New +** → **Blueprint**
3. Conecta el repo **OpenWA**
4. Render detectará `render.yaml` y creará el servicio **openwa-cod10**
5. Confirma y espera el build (10–15 min la primera vez)

URL final: `https://openwa-cod10.onrender.com` (o el nombre que elijas)

## Paso 3 — Verificar que está vivo

Abre en el navegador:

- `https://openwa-cod10.onrender.com/api/health/ready` → debe responder OK
- `https://openwa-cod10.onrender.com` → dashboard OpenWA

## Paso 4 — Obtener API Key

En Render → servicio **openwa-cod10** → **Logs** (primer arranque):

Busca la línea `🔑 API Key:` o revisa el archivo en el disco persistente.

También puedes crear una en el dashboard: **Settings → API Keys**.

## Paso 5 — Vincular WhatsApp (una sola vez)

1. Abre `https://openwa-cod10.onrender.com`
2. Inicia sesión con la API Key
3. Crea o abre sesión **codigo10**
4. **Start** → escanea QR con WhatsApp
5. Espera estado **Ready**
6. Copia el **Session ID** (UUID)

## Paso 6 — Configurar admin Codigo 10

https://cod10-admin.vercel.app/#/admin/configuration → **Bot WhatsApp (IA)**

| Campo | Valor |
|-------|-------|
| Bot activo | ✓ |
| Clave API Gemini | tu clave Google AI Studio |
| Prompt del bot | instrucciones del asistente |
| URL servidor OpenWA | `https://openwa-cod10.onrender.com` |
| ID sesión | UUID del paso 5 |
| Clave API OpenWA | `owa_...` del paso 4 |
| Secreto webhook | copia de Render env `WEBHOOK_SECRET` |

**Guardar** (publica en Cloudinary).

## Paso 7 — Registrar webhook

Desde cualquier PC (solo una vez):

```powershell
cd D:\portafolio\food-delivery-singlevendor
$env:OPENWA_BASE_URL="https://openwa-cod10.onrender.com"
$env:OPENWA_API_KEY="owa_..."
$env:OPENWA_SESSION_ID="uuid-sesion"
$env:COD10_VERCEL_URL="https://cod10.vercel.app"
$env:WEBHOOK_SECRET="mismo-secreto-que-admin-y-render"
node scripts/setup-openwa-webhook.mjs
```

## Paso 8 — Probar

Desde otro teléfono, escribe al WhatsApp vinculado:

> ¿Qué productos tienen?

Debe responder el bot con Gemini.

## Variables importantes en Render

| Variable | Descripción |
|----------|-------------|
| `API_MASTER_KEY` | Generada automáticamente |
| `WEBHOOK_SECRET` | Generada — copiar al admin |
| `CORS_ORIGINS` | cod10.vercel.app + admin |
| `RENDER_EXTERNAL_URL` | URL pública (Render la inyecta) |

## Coste estimado

- Web Standard: ~$25/mes
- Disco 1 GB: ~$0.25/mes
- Vercel cod10: según tu plan actual

## Solución de problemas

| Problema | Solución |
|----------|----------|
| Build falla | Revisa logs Render; Dockerfile necesita ~10 min |
| Chromium crash | Confirma plan Standard, no Starter |
| Sesión se pierde | Verifica disco montado en `/app/data` |
| Bot no responde | Revisa webhook + admin guardado + logs Vercel |
| 401 webhook | `WEBHOOK_SECRET` igual en Render, admin y script |
