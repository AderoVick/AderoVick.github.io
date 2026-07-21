import { getOrderByTracking } from './supabase.js';
import { validEmail } from './http.js';

export async function resolveApprovedOrder(env, body) {
  const trackingCode = String(body.trackingCode || '').trim().toUpperCase();
  const email = String(body.email || '').trim().toLowerCase();
  if (!trackingCode || !validEmail(email)) throw new Error('A valid tracking code and billing email are required.');
  const order = await getOrderByTracking(env, trackingCode, email);
  if (!order) throw new Error('No matching order was found.');
  if (!order.quoted_amount || !order.quoted_currency) throw new Error('This order does not have an approved quotation yet.');
  if (!['Quoted', 'In progress', 'Review'].includes(order.status)) throw new Error('This order is not currently open for payment.');
  return {
    order,
    amount: Number(order.quoted_amount),
    currency: String(order.quoted_currency).toUpperCase(),
    description: `${order.service_name}: ${order.project_title}`.slice(0, 120),
  };
}

export function safeReturnUrl(candidate, fallbackOrigin, fallbackPath = '/success.html?payment=complete') {
  try {
    const url = new URL(candidate || fallbackPath, fallbackOrigin);
    if (url.origin !== fallbackOrigin) return new URL(fallbackPath, fallbackOrigin).toString();
    return url.toString();
  } catch {
    return new URL(fallbackPath, fallbackOrigin).toString();
  }
}
