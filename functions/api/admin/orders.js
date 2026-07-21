import { requireAdmin } from '../../_lib/auth.js';
import { error, json } from '../../_lib/http.js';
import { supabaseRest } from '../../_lib/supabase.js';

export async function onRequestGet({ request, env }) {
  try {
    await requireAdmin(request, env);
    const rows = await supabaseRest(env, 'orders?select=*&order=created_at.desc&limit=200');
    return json({ orders: rows.map(row => ({
      id: row.id,
      trackingCode: row.tracking_code,
      clientName: row.client_name,
      clientEmail: row.client_email,
      serviceName: row.service_name,
      projectTitle: row.project_title,
      status: row.status,
      currency: row.currency,
      estimateLow: row.estimate_low_usd,
      estimateHigh: row.estimate_high_usd,
      quotedAmount: row.quoted_amount,
      quotedCurrency: row.quoted_currency,
      adminNotes: row.admin_notes,
      createdAt: row.created_at,
    })) });
  } catch (exception) {
    const status = /Authentication|Administrator/.test(exception.message) ? 403 : 500;
    return error(exception.message || 'Orders could not be loaded.', status);
  }
}
