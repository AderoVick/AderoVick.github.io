import { error, json } from '../_lib/http.js';
import { getOrderById, insertRow, uploadObject } from '../_lib/supabase.js';

const ALLOWED = new Set(['csv','xlsx','xls','sav','dta','pdf','doc','docx','txt','zip']);

function safeName(name) {
  return String(name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120);
}

export async function onRequestPost({ request, env }) {
  try {
    const form = await request.formData();
    const file = form.get('file');
    const orderId = String(form.get('orderId') || '');
    const trackingCode = String(form.get('trackingCode') || '').toUpperCase();
    if (!(file instanceof File) || !orderId || !trackingCode) return error('File, order ID and tracking code are required.');
    if (file.size > 8 * 1024 * 1024) return error('The file exceeds the 8 MB limit.', 413);
    const extension = safeName(file.name).split('.').pop().toLowerCase();
    if (!ALLOWED.has(extension)) return error('This file type is not accepted.');
    const order = await getOrderById(env, orderId);
    if (!order || order.tracking_code !== trackingCode) return error('Order verification failed.', 403);
    const objectPath = `${orderId}/${crypto.randomUUID()}-${safeName(file.name)}`;
    await uploadObject(env, objectPath, await file.arrayBuffer(), file.type);
    await insertRow(env, 'order_files', { order_id: orderId, object_path: objectPath, original_name: safeName(file.name), mime_type: file.type, size_bytes: file.size });
    return json({ uploaded: true, name: safeName(file.name) }, 201);
  } catch (exception) {
    return error(exception.message || 'Upload failed.', 500);
  }
}
