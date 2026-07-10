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
