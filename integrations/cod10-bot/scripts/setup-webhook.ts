/**
 * Registra el webhook de OpenWA apuntando a Codigo 10 (platform en Vercel).
 *
 * Webhook URL: https://cod10.vercel.app/api/bot/webhook
 */
const openwaBase = process.env.OPENWA_BASE_URL?.replace(/\/+$/, '');
const openwaApiKey = process.env.OPENWA_API_KEY;
const sessionId = process.env.OPENWA_SESSION_ID;
const cod10Url = (process.env.COD10_VERCEL_URL ?? 'https://cod10.vercel.app').replace(/\/+$/, '');
const webhookSecret = process.env.WEBHOOK_SECRET;

async function main() {
  if (!openwaBase || !openwaApiKey || !sessionId) {
    console.error('Required: OPENWA_BASE_URL, OPENWA_API_KEY, OPENWA_SESSION_ID');
    process.exit(1);
  }

  const webhookUrl = `${cod10Url}/api/bot/webhook`;

  const response = await fetch(`${openwaBase}/api/sessions/${encodeURIComponent(sessionId)}/webhooks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': openwaApiKey,
    },
    body: JSON.stringify({
      url: webhookUrl,
      events: ['message.received'],
      secret: webhookSecret ?? undefined,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`Failed to register webhook (${response.status}):`, text);
    process.exit(1);
  }

  const data = await response.json();
  console.log('Webhook registrado en Codigo 10:');
  console.log(JSON.stringify(data, null, 2));
  console.log(`\nURL: ${webhookUrl}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
