import { error, json } from '../../../_lib/http.js';
import { updateRows } from '../../../_lib/supabase.js';

function values(items = []) {
  return Object.fromEntries(items.map(item => [item.Name, item.Value]));
}

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const callback = body?.Body?.stkCallback;
    if (!callback?.CheckoutRequestID) return error('Invalid M-Pesa callback.');
    const metadata = values(callback.CallbackMetadata?.Item || []);
    const status = Number(callback.ResultCode) === 0 ? 'Paid' : 'Failed';
    const rows = await updateRows(env, 'payments', `provider=eq.mpesa&provider_reference=eq.${encodeURIComponent(callback.CheckoutRequestID)}`, {
      status,
      paid_at: status === 'Paid' ? new Date().toISOString() : null,
      receipt_number: metadata.MpesaReceiptNumber || null,
      payer_phone: metadata.PhoneNumber ? String(metadata.PhoneNumber) : null,
      raw_response: body,
    });
    if (status === 'Paid' && rows?.[0]?.order_id) await updateRows(env, 'orders', `id=eq.${rows[0].order_id}`, { status: 'In progress' });
    return json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (exception) {
    return error(exception.message || 'M-Pesa callback processing failed.', 500);
  }
}
