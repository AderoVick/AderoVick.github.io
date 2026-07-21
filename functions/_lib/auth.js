import { supabaseRest } from './supabase.js';

export function bearerToken(request) {
  const value = request.headers.get('Authorization') || '';
  return value.startsWith('Bearer ') ? value.slice(7).trim() : '';
}

export async function currentUser(request, env) {
  const token = bearerToken(request);
  if (!token || !env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return null;
  const response = await fetch(`${env.SUPABASE_URL.replace(/\/$/, '')}/auth/v1/user`, {
    headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  });
  if (!response.ok) return null;
  return response.json();
}

export async function requireAdmin(request, env) {
  const user = await currentUser(request, env);
  if (!user?.id) throw new Error('Authentication is required.');
  const query = new URLSearchParams({ select: 'role', id: `eq.${user.id}`, limit: '1' });
  const rows = await supabaseRest(env, `profiles?${query}`);
  if (rows?.[0]?.role !== 'admin') throw new Error('Administrator access is required.');
  return user;
}
