import { requireAdmin } from '../../_lib/auth.js';
import { cleanText, error, json, readJson } from '../../_lib/http.js';
import { updateRows } from '../../_lib/supabase.js';

const STATUSES = new Set(['Submitted','Under review','Quoted','In progress','Review','Completed','Cancelled']);

export async function onRequestPost({ request, env }) {
  try {
    await requireAdmin(request, env);
    const body = await readJson(request);
    const id = cleanText(body.id, 80);
    const status = cleanText(body.status, 40);
    if (!id || !STATUSES.has(status)) return error('A valid order ID and status are required.');
    const patch = { status, updated_at: new Date().toISOString() };
    if (body.quotedAmount != null) {
      const amount = Number(body.quotedAmount);
      if (!Number.isFinite(amount) || amount <= 0) return error('Quoted amount must be positive.');
      patch.quoted_amount = amount;
      patch.quoted_currency = cleanText(body.quotedCurrency || 'USD', 3).toUpperCase();
      patch.quoted_at = new Date().toISOString();
    }
    if (body.adminNotes != null) patch.admin_notes = cleanText(body.adminNotes, 4000);
    const rows = await updateRows(env, 'orders', `id=eq.${encodeURIComponent(id)}`, patch);
    if (!rows?.length) return error('Order not found.', 404);
    return json({ order: rows[0] });
  } catch (exception) {
    const status = /Authentication|Administrator/.test(exception.message) ? 403 : 500;
    return error(exception.message || 'Order update failed.', status);
  }
}
