// /api/create-checkout — crea una sesión de pago de Dodo Payments y devuelve la URL de checkout.
// El navegador llama a este endpoint (mismo dominio, numbersoracle.com) y redirige al usuario
// a la checkout_url que Dodo devuelve. No expone ningún secreto al frontend.
//
// Variables de entorno requeridas en Vercel (Project Settings → Environment Variables):
//   DODO_PAYMENTS_API_KEY      — API key de Dodo (Developer > API Keys), secreta
//   DODO_PAYMENTS_ENVIRONMENT  — "live_mode" o "test_mode" (default: live_mode)

import DodoPayments from 'dodopayments';

// Catálogo de planes permitidos → product_id real en Dodo.
// Fase 2 (10 jul 2026): los 6 productos de zona ya existen en el dashboard de Dodo,
// verificados uno a uno (nombre + precio + tipo) antes de copiar aquí sus IDs.
const ALLOWED_PRODUCTS = {
  usa_monthly: 'pdt_0NiqRHmCOwWgCt7EEVl8D',       // USA/Europa Occ. — $6.99/mes
  latam_monthly: 'pdt_0Nit6PJFVOzOuLNQVCZzf',     // Latam/Europa Del Este — $3.99/mes
  sea_monthly: 'pdt_0Nit7S6DoSKX8fGrlrOG3',       // SEA — $4.99/mes
  china_unlimited: 'pdt_0NitCW6L6XHHBTyNR3ouS',   // China — Ilimitado Mensual — ¥48 pago único
  china_pack5: 'pdt_0NitGsFkXcwTKnL6U3iqJ',       // China — Pack 5 Créditos — ¥38 pago único
  china_pack3: 'pdt_0NitJ7IrkmwULtMD1qPeU',       // China — Pack 3 Créditos — ¥28 pago único
  // Fase 3 (11 jul 2026): consulta única + suscripción anual por zona (China no aplica, ya cubierta arriba)
  latam_consult: 'pdt_0NiyTolZ79ZdYsExsEf2z',     // Latam/Europa Del Este — Pago Por Consulta — $1.29
  latam_annual: 'pdt_0NiyVbTwaJtXxl0QpoUf1',      // Latam/Europa Del Este — Suscripción Anual — $29.99
  usa_consult: 'pdt_0NiyVuDtY9bmSZPA91CXM',       // USA/Europa Occ. — Pago Por Consulta — $1.99
  usa_annual: 'pdt_0NiyWHrKEgr8ArEOAlr4q',        // USA/Europa Occ. — Suscripción Anual — $59.99
  sea_consult: 'pdt_0NiyWj1UPOlZMw3bw9P1V',       // SEA — Pago Por Consulta — $1.49
  sea_annual: 'pdt_0NiyX9NQWlNQ3W8KLqP9U',        // SEA — Suscripción Anual — $39.99
  // Pase Semanal (16 jul 2026): pago único, 7 días de acceso, sin renovación. Sin China.
  latam_weekly: 'pdt_0NjKTZyyja2WigEq4GxNP',      // Latam/Europa Del Este — Pase Semanal — $1.99
  usa_weekly: 'pdt_0NjKU15fYy87vAseMZRhh',        // USA/Europa Occ. — Pase Semanal — $2.99
  sea_weekly: 'pdt_0NjKUIQEI14v9Zz6rXIGr',        // SEA — Pase Semanal — $1.79
};

export const config = { api: { bodyParser: true } };

export async function POST(request) {
  try {
    const body = await request.json();
    const email = (body?.email || '').trim();
    const userId = (body?.user_id || '').trim();
    const plan = body?.plan || 'usa_monthly';

    if (!email || !userId) {
      return Response.json({ error: 'Falta email o user_id' }, { status: 400 });
    }

    const productId = ALLOWED_PRODUCTS[plan];
    if (!productId) {
      return Response.json({ error: 'Plan no reconocido: ' + plan }, { status: 400 });
    }

    if (!process.env.DODO_PAYMENTS_API_KEY) {
      console.error('Falta DODO_PAYMENTS_API_KEY en las variables de entorno');
      return Response.json({ error: 'Configuración de pagos incompleta' }, { status: 500 });
    }

    const client = new DodoPayments({
      bearerToken: process.env.DODO_PAYMENTS_API_KEY,
      environment: process.env.DODO_PAYMENTS_ENVIRONMENT || 'live_mode',
    });

    const session = await client.checkoutSessions.create({
      product_cart: [{ product_id: productId, quantity: 1 }],
      customer: { email },
      return_url: 'https://numbersoracle.com/?pro=success',
      // metadata viaja tal cual al webhook: así sabemos a qué usuario de Supabase
      // marcar como "pro" cuando llegue el pago, sin depender solo del email.
      metadata: { supabase_user_id: userId },
    });

    return Response.json({ checkout_url: session.checkout_url });
  } catch (err) {
    console.error('create-checkout error:', err);
    return Response.json({ error: 'No se pudo crear el checkout' }, { status: 500 });
  }
}
