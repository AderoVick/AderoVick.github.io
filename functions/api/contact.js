import { allowedOrigin, cleanText, error, json, readJson, validEmail } from '../_lib/http.js';
import { insertRow } from '../_lib/supabase.js';

export async function onRequestPost({ request, env }) {
  if (!allowedOrigin(request, env)) return error('Origin not allowed.', 403);
  try {
    const body = await readJson(request, 30_000);
    const name = cleanText(body.name, 120);
    const email = cleanText(body.email, 180).toLowerCase();
    const message = cleanText(body.message, 5000);
    if (!name || !validEmail(email) || message.length < 10) return error('Name, valid email and message are required.');
    await insertRow(env, 'contact_messages', { name, email, subject: cleanText(body.subject, 180), message, source: 'web' });
    return json({ received: true }, 201);
  } catch (exception) {
    return error(exception.message || 'Message could not be submitted.', 500);
  }
}
