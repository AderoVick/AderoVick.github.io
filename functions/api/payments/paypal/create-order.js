import { error, json, readJson } from '../../../_lib/http.js';
import { resolveApprovedOrder, safeReturnUrl } from '../../../_lib/payment-order.js';
import { insertRow } from '../../../_lib/supabase.js';

function paypalBase(env) {
  return String(env.PAYPAL_ENV || 'sandbox').toLowerCase() === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
}

async function accessToken(env) {
  if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_CLIENT_SECRET) throw new Error('PayPal is not configured.');
  const response = await fetch(`${paypalBase(env)}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${btoa(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error_description || 'PayPal authentication failed.');
  return data.access_token;
}

export async function onRequestPost({ request, env }) {
  try {
    const body = await readJson(request);
    const { order, amount, currency, description } = await resolveApprovedOrder(env, body);
    const token = await accessToken(env);
    const origin = new URL(request.url).origin;
    const returnUrl = safeReturnUrl(body.returnUrl, origin);
    const cancelUrl = safeReturnUrl(body.cancelUrl, origin, '/checkout.html?payment=cancelled');
    const response = await fetch(`${paypalBase(env)}/v2/checkout/orders`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'PayPal-Request-Id': crypto.randomUUID() },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          reference_id: order.id,
          custom_id: order.tracking_code,
          description,
          amount: { currency_code: currency, value: amount.toFixed(2) },
        }],
        payment_source: { paypal: { experience_context: { return_url: returnUrl, cancel_url: cancelUrl, user_action: 'PAY_NOW' } } },
      }),
    });
    const paypalOrder = await response.json();
    if (!response.ok) throw new Error(paypalOrder.message || 'PayPal order could not be created.');
    const approvalUrl = paypalOrder.links?.find(link => ['payer-action', 'approve'].includes(link.rel))?.href;
    if (!approvalUrl) throw new Error('PayPal approval link was not returned.');
    await insertRow(env, 'payments', {
      order_id: order.id,
      provider: 'paypal',
      provider_reference: paypalOrder.id,
      amount,
      currency,
      status: 'Pending',
      checkout_url: approvalUrl,
    });
    return json({ approvalUrl, paypalOrderId: paypalOrder.id }, 201);
  } catch (exception) {
    const status = /not configured/.test(exception.message) ? 503 : 500;
    return error(exception.message || 'PayPal checkout failed.', status);
  }
}

export { paypalBase, accessToken };
