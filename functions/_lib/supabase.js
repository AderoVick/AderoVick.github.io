import { error } from './http.js';

function required(env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('The secure database is not configured.');
  }
}

export async function supabaseRest(env, path, options = {}) {
  required(env);
  const base = env.SUPABASE_URL.replace(/\/$/, '');
  const headers = new Headers(options.headers || {});
  headers.set('apikey', env.SUPABASE_SERVICE_ROLE_KEY);
  headers.set('Authorization', `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`);
  headers.set('Content-Type', headers.get('Content-Type') || 'application/json');
  headers.set('Accept', 'application/json');
  const response = await fetch(`${base}/rest/v1/${path}`, { ...options, headers });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Database request failed (${response.status}): ${text.slice(0, 240)}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

export async function insertRow(env, table, row) {
  return supabaseRest(env, table, {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(row),
  });
}

export async function updateRows(env, table, query, patch) {
  return supabaseRest(env, `${table}?${query}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(patch),
  });
}

export async function getOrderByTracking(env, trackingCode, email) {
  const query = new URLSearchParams({
    select: '*',
    tracking_code: `eq.${trackingCode}`,
    client_email: `eq.${email}`,
    limit: '1',
  });
  const rows = await supabaseRest(env, `orders?${query}`);
  return rows?.[0] || null;
}

export async function getOrderById(env, id) {
  const query = new URLSearchParams({ select: '*', id: `eq.${id}`, limit: '1' });
  const rows = await supabaseRest(env, `orders?${query}`);
  return rows?.[0] || null;
}

export async function uploadObject(env, path, file, mimeType) {
  required(env);
  const base = env.SUPABASE_URL.replace(/\/$/, '');
  const response = await fetch(`${base}/storage/v1/object/client-files/${path}`, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': mimeType || 'application/octet-stream',
      'x-upsert': 'false',
    },
    body: file,
  });
  if (!response.ok) throw new Error(`File upload failed (${response.status}).`);
  return response.json();
}
