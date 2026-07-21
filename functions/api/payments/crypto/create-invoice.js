import { error, json, readJson } from '../../../_lib/http.js';
import { resolveApprovedOrder } from '../../../_lib/payment-order.js';
import { insertRow } from '../../../_lib/supabase.js';

export async function onRequestPost({ request, env }) {
  try {
    if (!env.CRYPTO_PAYMENT_URL) return error('Crypto invoicing is not configured.', 503);
    const body = await readJson(request);
    const { order, amount, currency } = await resolveApprovedOrder(env, body);
    const url = new URL(env.CRYPTO_PAYMENT_URL);
    url.searchParams.set('reference', order.tracking_code);
    url.searchParams.set('amount', amount.toFixed(2));
    url.searchParams.set('currency', currency);
    await insertRow(env, 'payments', {
      order_id: order.id,
      provider: 'crypto',
      provider_reference: order.tracking_code,
      amount,
      currency,
      status: 'Pending',
      checkout_url: url.toString(),
    });
    return json({ url: url.toString(), notice: 'The customer must confirm the network and amount on the provider invoice.' }, 201);
  } catch (exception) {
    return error(exception.message || 'Crypto invoice could not be created.', 500);
  }
}
