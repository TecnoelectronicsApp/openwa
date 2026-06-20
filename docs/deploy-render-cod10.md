# Desplegar OpenWA en Render GRATIS (Codigo 10)

Guía para WhatsApp en la nube **sin tarjeta** usando el plan Free de Render.

## Arquitectura

```
WhatsApp ←→ OpenWA (Render Free) ←→ cod10.vercel.app (bot Gemini) ←→ MongoDB
                ↑                              ↑
         Admin cod10-admin              Vercel Cron cada 14 min
         (config + QR)                  (despierta Render free)
```

## Paso 1 — Blueprint en Render (sin tarjeta)

1. Entra a https://dashboard.render.com
2. **New +** → **Blueprint**
3. Repo: **TecnoelectronicsApp/openwa** (ya conectado)
4. Render lee `render.yaml` con `plan: free` → **no pide tarjeta**
5. Si falló antes con el plan de pago, pulsa **Retry** o crea Blueprint de nuevo
6. Espera el build (10–15 min la primera vez)

URL final: `https://openwa-cod10.onrender.com`

## Paso 2 — Verificar

- `https://openwa-cod10.onrender.com/api/health/ready` → OK
- Primera carga puede tardar ~1 min (cold start)

## Paso 3 — Copiar credenciales de Render

En el dashboard del servicio → **Environment**:

| Variable | Uso |
|----------|-----|
| `API_MASTER_KEY` | API Key OpenWA → admin Codigo 10 |
| `WEBHOOK_SECRET` | Secreto webhook → admin + Vercel |

## Paso 4 — Configurar admin (cod10-admin.vercel.app)

**Configuración → Bot WhatsApp (IA)**:

| Campo | Valor |
|-------|-------|
| URL OpenWA | `https://openwa-cod10.onrender.com` |
| API Key | `API_MASTER_KEY` de Render |
| Webhook secret | `WEBHOOK_SECRET` de Render |
| Gemini API Key | tu clave |
| Prompt | el que quieras |

Guarda → escanea el **QR** desde el admin.

## Paso 5 — Variables en Vercel (cod10)

En el proyecto **platform** de Vercel:

```
OPENWA_BASE_URL=https://openwa-cod10.onrender.com
OPENWA_API_KEY=<API_MASTER_KEY de Render>
OPENWA_SESSION_ID=<id sesión del admin>
WEBHOOK_SECRET=<WEBHOOK_SECRET de Render>
CRON_SECRET=<opcional, string aleatorio para proteger keepalive>
```

El cron `/api/bot/keepalive` (cada 14 min) evita que Render se duerma.

## Paso 6 — Registrar webhook

Desde tu PC (con Node):

```powershell
cd D:\portafolio\food-delivery-singlevendor
$env:OPENWA_BASE_URL="https://openwa-cod10.onrender.com"
$env:OPENWA_API_KEY="<API_MASTER_KEY>"
$env:WEBHOOK_SECRET="<WEBHOOK_SECRET>"
node scripts/setup-openwa-webhook.mjs
```

O desde Swagger: `POST /api/webhooks` con URL `https://cod10.vercel.app/api/bot/webhook`.

## Limitaciones del plan Free

| Limitación | Qué pasa | Mitigación |
|------------|----------|------------|
| 512 MB RAM | Chromium lento o reinicios | Args optimizados en render.yaml |
| Sin disco | Pierdes sesión al reiniciar | Escanea QR otra vez en admin |
| Se duerme ~15 min | Bot no responde | Cron Vercel cada 14 min |
| Render reinicia servicios | QR otra vez | Normal en free tier |

Para producción estable 24/7 con sesión persistente: usa `render.paid.yaml` (~$26/mes).

## Solución de problemas

| Problema | Acción |
|----------|--------|
| Blueprint pide tarjeta | Confirma que el repo tiene `plan: free` en render.yaml y pulsa Retry |
| Build falla | Revisa logs Render; suele ser timeout Docker — reintenta |
| QR no carga | Espera cold start; abre URL directa del servicio |
| Bot no responde | Verifica webhook, admin guardado, logs Vercel |
| Servicio dormido | Abre URL o espera el cron keepalive |

## Plan de pago (opcional)

Renombra `render.paid.yaml` → `render.yaml` para Standard + disco 1 GB (~$26/mes).
