import { error, json, readJson } from '../../../_lib/http.js';
import { resolveApprovedOrder } from '../../../_lib/payment-order.js';
import { insertRow } from '../../../_lib/supabase.js';

function mpesaBase(env) {
  return String(env.MPESA_ENV || 'sandbox').toLowerCase() === 'live'
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke';
}

function nairobiTimestamp(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Nairobi', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).reduce((acc, part) => ({ ...acc, [part.type]: part.value }), {});
  return `${parts.year}${parts.month}${parts.day}${parts.hour}${parts.minute}${parts.second}`;
}

function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (/^2547\d{8}$/.test(digits) || /^2541\d{8}$/.test(digits)) return digits;
  if (/^07\d{8}$/.test(digits) || /^01\d{8}$/.test(digits)) return `254${digits.slice(1)}`;
  throw new Error('Enter a valid Kenyan M-Pesa phone number.');
}

async function token(env) {
  if (!env.MPESA_CONSUMER_KEY || !env.MPESA_CONSUMER_SECRET) throw new Error('M-Pesa is not configured.');
  const response = await fetch(`${mpesaBase(env)}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${btoa(`${env.MPESA_CONSUMER_KEY}:${env.MPESA_CONSUMER_SECRET}`)}` },
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) throw new Error(data.errorMessage || 'M-Pesa authentication failed.');
  return data.access_token;
}

export async function onRequestPost({ request, env }) {
  try {
    if (!env.MPESA_SHORTCODE || !env.MPESA_PASSKEY || !env.MPESA_CALLBACK_URL) return error('M-Pesa is not fully configured.', 503);
    const body = await readJson(request);
    const { order, amount, currency, description } = await resolveApprovedOrder(env, body);
    if (currency !== 'KES') return error('M-Pesa checkout requires an approved KES quotation.');
    const phone = normalizePhone(body.phone);
    const timestamp = nairobiTimestamp();
    const password = btoa(`${env.MPESA_SHORTCODE}${env.MPESA_PASSKEY}${timestamp}`);
    const accessToken = await token(env);
    const response = await fetch(`${mpesaBase(env)}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        BusinessShortCode: env.MPESA_SHORTCODE,
        Password: password,
        Timestamp: timestamp,
        TransactionType: env.MPESA_TRANSACTION_TYPE || 'CustomerPayBillOnline',
        Amount: Math.max(1, Math.round(amount)),
        PartyA: phone,
        PartyB: env.MPESA_SHORTCODE,
        PhoneNumber: phone,
        CallBackURL: env.MPESA_CALLBACK_URL,
        AccountReference: order.tracking_code.slice(0, 12),
        TransactionDesc: description.slice(0, 40),
      }),
    });
    const result = await response.json();
    if (!response.ok || result.ResponseCode !== '0') throw new Error(result.errorMessage || result.ResponseDescription || 'M-Pesa request failed.');
    await insertRow(env, 'payments', {
      order_id: order.id,
      provider: 'mpesa',
      provider_reference: result.CheckoutRequestID,
      secondary_reference: result.MerchantRequestID,
      amount: Math.round(amount),
      currency: 'KES',
      status: 'Pending',
      raw_response: result,
    });
    return json({ requested: true, checkoutRequestId: result.CheckoutRequestID, message: result.CustomerMessage }, 201);
  } catch (exception) {
    const status = /not configured/.test(exception.message) ? 503 : 500;
    return error(exception.message || 'M-Pesa request failed.', status);
  }
}
