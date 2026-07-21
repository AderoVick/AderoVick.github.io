import { error, json, readJson } from '../../../_lib/http.js';
import { resolveApprovedOrder, safeReturnUrl } from '../../../_lib/payment-order.js';
import { insertRow } from '../../../_lib/supabase.js';

export async function onRequestPost({ request, env }) {
  try {
    if (!env.STRIPE_SECRET_KEY) return error('Stripe is not configured.', 503);
    const body = await readJson(request);
    const { order, amount, currency, description } = await resolveApprovedOrder(env, body);
    const origin = new URL(request.url).origin;
    const successUrl = safeReturnUrl(body.returnUrl, origin);
    const cancelUrl = safeReturnUrl(body.cancelUrl, origin, '/checkout.html?payment=cancelled');
    const params = new URLSearchParams();
    params.set('mode', 'payment');
    params.set('success_url', successUrl);
    params.set('cancel_url', cancelUrl);
    params.set('client_reference_id', order.id);
    params.set('customer_email', order.client_email);
    params.set('line_items[0][quantity]', '1');
    params.set('line_items[0][price_data][currency]', currency.toLowerCase());
    params.set('line_items[0][price_data][unit_amount]', String(Math.round(amount * 100)));
    params.set('line_items[0][price_data][product_data][name]', description);
    params.set('metadata[order_id]', order.id);
    params.set('metadata[tracking_code]', order.tracking_code);
    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    });
    const session = await response.json();
    if (!response.ok) throw new Error(session?.error?.message || 'Stripe checkout could not be created.');
    await insertRow(env, 'payments', {
      order_id: order.id,
      provider: 'stripe',
      provider_reference: session.id,
      amount,
      currency,
      status: 'Pending',
      checkout_url: session.url,
    });
    return json({ url: session.url, reference: session.id }, 201);
  } catch (exception) {
    return error(exception.message || 'Stripe checkout failed.', 500);
  }
}
