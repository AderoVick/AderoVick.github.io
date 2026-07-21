export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...extraHeaders,
    },
  });
}

export function error(message, status = 400, details) {
  return json({ error: message, ...(details ? { details } : {}) }, status);
}

export async function readJson(request, maxBytes = 100_000) {
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > maxBytes) throw new Error('Request body is too large.');
  const text = await request.text();
  if (text.length > maxBytes) throw new Error('Request body is too large.');
  try {
    return JSON.parse(text || '{}');
  } catch {
    throw new Error('Invalid JSON request.');
  }
}

export function cleanText(value, maxLength = 500) {
  return String(value ?? '').trim().replace(/[\u0000-\u001F\u007F]/g, '').slice(0, maxLength);
}

export function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

export function allowedOrigin(request, env) {
  const origin = request.headers.get('Origin');
  if (!origin) return true;
  const configured = env.ALLOWED_ORIGIN || env.APP_URL;
  if (!configured) return true;
  return origin === configured || origin === new URL(configured).origin;
}

export function randomCode(prefix = 'AV') {
  const bytes = crypto.getRandomValues(new Uint8Array(5));
  const token = [...bytes].map(byte => (byte % 36).toString(36)).join('').toUpperCase();
  const date = new Date().toISOString().slice(2, 10).replaceAll('-', '');
  return `${prefix}-${date}-${token}`;
}
