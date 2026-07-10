// /api/webhooks/dodo — recibe los avisos de pago de Dodo Payments y marca al usuario
// correspondiente como "pro" (o lo regresa a "free") en Supabase.
//
// Configurar en el dashboard de Dodo (Developer > Webhooks):
//   URL:     https://numbersoracle.com/api/webhooks/dodo
//   Eventos: payment.succeeded, subscription.active, subscription.renewed,
//            subscription.cancelled, subscription.expired, subscription.failed
//
// Variables de entorno requeridas en Vercel:
//   DODO_PAYMENTS_API_KEY        — misma key que create-checkout.js
//   DODO_PAYMENTS_WEBHOOK_KEY    — "Signing secret" del webhook (dashboard de Dodo), secreta
//   SUPABASE_SERVICE_ROLE_KEY    — Supabase > Project Settings > API > service_role, secreta
//                                   (necesaria para poder actualizar el perfil de CUALQUIER
//                                   usuario sin estar logueado como ese usuario)
//   SUPABASE_URL                 — opcional, ya tiene un valor por defecto correcto abajo

import DodoPayments from 'dodopayments';
import { createClient } from '@supabase/supabase-js';

export const config = { api: { bodyParser: false } };

// Eventos que activan acceso Pro / lo revocan.
const PRO_EVENTS = new Set(['payment.succeeded', 'subscription.active', 'subscription.renewed']);
const FREE_EVENTS = new Set(['subscription.cancelled', 'subscription.expired', 'subscription.failed']);

// Memoria simple de idempotencia mientras la función esté "caliente" (Vercel puede reciclar
// la instancia; no es garantía absoluta, pero evita reprocesos en reintentos inmediatos).
const seenWebhookIds = new Set();

export async function POST(request) {
  const rawBody = await request.text();

  if (!process.env.DODO_PAYMENTS_WEBHOOK_KEY) {
    console.error('Falta DODO_PAYMENTS_WEBHOOK_KEY en las variables de entorno');
    return Response.json({ error: 'Webhook no configurado' }, { status: 500 });
  }

  const client = new DodoPayments({
    bearerToken: process.env.DODO_PAYMENTS_API_KEY,
    webhookKey: process.env.DODO_PAYMENTS_WEBHOOK_KEY,
  });

  const webhookHeaders = {
    'webhook-id': request.headers.get('webhook-id') || '',
    'webhook-signature': request.headers.get('webhook-signature') || '',
    'webhook-timestamp': request.headers.get('webhook-timestamp') || '',
  };

  let event;
  try {
    event = client.webhooks.unwrap(rawBody, { headers: webhookHeaders });
  } catch (err) {
    console.error('Firma de webhook invalida:', err);
    return Response.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const webhookId = webhookHeaders['webhook-id'];
  if (webhookId) {
    if (seenWebhookIds.has(webhookId)) {
      return Response.json({ received: true, duplicate: true });
    }
    seenWebhookIds.add(webhookId);
  }

  // Responder rápido (Dodo da 15s de margen) y procesar después.
  processEvent(event).catch((err) => console.error('Error procesando webhook Dodo:', err));

  return Response.json({ received: true });
}

async function processEvent(event) {
  const type = event?.type;
  const data = event?.data || {};

  if (!PRO_EVENTS.has(type) && !FREE_EVENTS.has(type)) {
    console.log('Evento Dodo sin manejador especifico, ignorado:', type);
    return;
  }

  const userId = data.metadata?.supabase_user_id || event?.metadata?.supabase_user_id || null;
  const email = data.customer?.email || null;

  if (!userId && !email) {
    console.error('Webhook', type, 'sin supabase_user_id ni email — no se puede identificar al usuario');
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL || 'https://thtuzvhzwcoifgdyzrsz.supabase.co';
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Falta SUPABASE_SERVICE_ROLE_KEY en las variables de entorno');
    return;
  }
  const supabase = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const newPlan = PRO_EVENTS.has(type) ? 'pro' : 'free';

  let query = supabase.from('profiles').update({ plan: newPlan });
  query = userId ? query.eq('id', userId) : query.eq('email', email);

  const { error, count } = await query.select('id');

  if (error) {
    console.error('Error actualizando plan en Supabase:', error);
    return;
  }
  console.log('Plan actualizado a', newPlan, 'para', userId || email, '— evento', type, '— filas afectadas:', count ?? 'n/d');
}
