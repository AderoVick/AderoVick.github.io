import { error, json } from '../../../_lib/http.js';
import { updateRows } from '../../../_lib/supabase.js';

async function verifyStripeSignature(rawBody, signature, secret) {
  if (!signature || !secret) return false;
  const parts = Object.fromEntries(signature.split(',').map(part => part.split('=')));
  const timestamp = parts.t;
  const provided = parts.v1;
  if (!timestamp || !provided || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${rawBody}`));
  const expected = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  if (expected.length !== provided.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i += 1) mismatch |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  return mismatch === 0;
}

export async function onRequestPost({ request, env }) {
  try {
    if (!env.STRIPE_WEBHOOK_SECRET) return error('Stripe webhook is not configured.', 503);
    const raw = await request.text();
    const valid = await verifyStripeSignature(raw, request.headers.get('Stripe-Signature'), env.STRIPE_WEBHOOK_SECRET);
    if (!valid) return error('Invalid Stripe signature.', 400);
    const event = JSON.parse(raw);
    if (['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(event.type)) {
      const session = event.data.object;
      const rows = await updateRows(env, 'payments', `provider=eq.stripe&provider_reference=eq.${encodeURIComponent(session.id)}`, {
        status: 'Paid', paid_at: new Date().toISOString(), raw_response: event,
      });
      if (rows?.[0]?.order_id) await updateRows(env, 'orders', `id=eq.${rows[0].order_id}`, { status: 'In progress' });
    } else if (['checkout.session.expired','checkout.session.async_payment_failed'].includes(event.type)) {
      const session = event.data.object;
      await updateRows(env, 'payments', `provider=eq.stripe&provider_reference=eq.${encodeURIComponent(session.id)}`, { status: 'Failed', raw_response: event });
    }
    return json({ received: true });
  } catch (exception) {
    return error(exception.message || 'Webhook processing failed.', 500);
  }
}
