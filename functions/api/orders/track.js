import { error, json, validEmail } from '../../_lib/http.js';
import { getOrderByTracking } from '../../_lib/supabase.js';

export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const code = (url.searchParams.get('code') || '').trim().toUpperCase();
    const email = (url.searchParams.get('email') || '').trim().toLowerCase();
    if (!/^AV-[A-Z0-9-]{8,30}$/.test(code) || !validEmail(email)) return error('A valid tracking code and email are required.');
    const order = await getOrderByTracking(env, code, email);
    if (!order) return error('No matching order was found.', 404);
    return json({ order: {
      id: order.id,
      trackingCode: order.tracking_code,
      clientEmail: order.client_email,
      serviceName: order.service_name,
      projectTitle: order.project_title,
      status: order.status,
      currency: order.currency,
      estimateLowUsd: order.estimate_low_usd,
      estimateHighUsd: order.estimate_high_usd,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
    }});
  } catch (exception) {
    return error(exception.message || 'Order lookup failed.', 500);
  }
}
