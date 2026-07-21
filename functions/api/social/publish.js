import { requireAdmin } from '../../_lib/auth.js';
import { cleanText, error, json, readJson } from '../../_lib/http.js';
import { insertRow } from '../../_lib/supabase.js';

async function publishFacebook(env, message, link) {
  if (!env.META_PAGE_ID || !env.META_PAGE_ACCESS_TOKEN) throw new Error('Facebook Page publishing is not configured.');
  const version = env.META_GRAPH_VERSION || 'v25.0';
  const params = new URLSearchParams({ message, access_token: env.META_PAGE_ACCESS_TOKEN });
  if (link) params.set('link', link);
  const response = await fetch(`https://graph.facebook.com/${version}/${env.META_PAGE_ID}/feed`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || 'Facebook publishing failed.');
  return { platform: 'facebook', id: data.id };
}

async function publishLinkedIn(env, message, link) {
  if (!env.LINKEDIN_ACCESS_TOKEN || !env.LINKEDIN_AUTHOR_URN) throw new Error('LinkedIn publishing is not configured.');
  const body = {
    author: env.LINKEDIN_AUTHOR_URN,
    commentary: message,
    visibility: 'PUBLIC',
    distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
    lifecycleState: 'PUBLISHED',
    isReshareDisabledByAuthor: false,
  };
  if (link) body.content = { article: { source: link, title: cleanText(message.split('\n')[0], 120) || 'AderoVick update' } };
  const response = await fetch('https://api.linkedin.com/rest/posts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.LINKEDIN_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      'LinkedIn-Version': env.LINKEDIN_VERSION || '202606',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error((await response.text()).slice(0, 300) || 'LinkedIn publishing failed.');
  return { platform: 'linkedin', id: response.headers.get('x-restli-id') || response.headers.get('location') || 'published' };
}

export async function onRequestPost({ request, env }) {
  try {
    const admin = await requireAdmin(request, env);
    const body = await readJson(request, 50_000);
    const title = cleanText(body.title, 180);
    const message = cleanText(body.message, 2800);
    const link = cleanText(body.link, 500);
    const platforms = Array.isArray(body.platforms) ? body.platforms.filter(item => ['facebook','linkedin'].includes(item)) : [];
    const scheduledFor = body.scheduledFor ? new Date(body.scheduledFor) : null;
    if (!title || !message || !platforms.length) return error('Title, post copy and at least one platform are required.');
    if (scheduledFor && !Number.isNaN(scheduledFor.getTime()) && scheduledFor.getTime() > Date.now() + 60_000) {
      const rows = await insertRow(env, 'social_posts', {
        title, message, link: link || null, platforms, status: 'Scheduled', scheduled_for: scheduledFor.toISOString(), created_by: admin.id,
      });
      return json({ scheduled: true, post: rows?.[0] }, 201);
    }
    const results = [];
    const failures = [];
    for (const platform of platforms) {
      try {
        results.push(platform === 'facebook' ? await publishFacebook(env, message, link) : await publishLinkedIn(env, message, link));
      } catch (exception) {
        failures.push({ platform, error: exception.message });
      }
    }
    await insertRow(env, 'social_posts', {
      title, message, link: link || null, platforms, status: failures.length ? (results.length ? 'Partially published' : 'Failed') : 'Published',
      published_at: results.length ? new Date().toISOString() : null, provider_results: results, provider_errors: failures, created_by: admin.id,
    });
    if (!results.length) return error('The post could not be published.', 502, failures);
    return json({ published: true, results, failures }, failures.length ? 207 : 201);
  } catch (exception) {
    const status = /Authentication|Administrator/.test(exception.message) ? 403 : 500;
    return error(exception.message || 'Publishing failed.', status);
  }
}
