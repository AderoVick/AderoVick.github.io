import { error, json, readJson } from '../../../_lib/http.js';
import { updateRows } from '../../../_lib/supabase.js';
import { accessToken, paypalBase } from './create-order.js';

export async function onRequestPost({ request, env }) {
  try {
    const body = await readJson(request);
    const paypalOrderId = String(body.paypalOrderId || '').trim();
    if (!paypalOrderId) return error('PayPal order ID is required.');
    const token = await accessToken(env);
    const response = await fetch(`${paypalBase(env)}/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: '{}',
    });
    const capture = await response.json();
    if (!response.ok) throw new Error(capture.message || 'PayPal capture failed.');
    if (capture.status === 'COMPLETED') {
      const rows = await updateRows(env, 'payments', `provider=eq.paypal&provider_reference=eq.${encodeURIComponent(paypalOrderId)}`, { status: 'Paid', paid_at: new Date().toISOString(), raw_response: capture });
      if (rows?.[0]?.order_id) await updateRows(env, 'orders', `id=eq.${rows[0].order_id}`, { status: 'In progress' });
    }
    return json({ status: capture.status, capture });
  } catch (exception) {
    return error(exception.message || 'PayPal capture failed.', 500);
  }
}
