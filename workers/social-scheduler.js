/** Cloudflare Worker cron job for scheduled Facebook Page and LinkedIn posts. */
async function rest(env, path, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set('apikey', env.SUPABASE_SERVICE_ROLE_KEY);
  headers.set('Authorization', `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`);
  headers.set('Content-Type', 'application/json');
  const response = await fetch(`${env.SUPABASE_URL.replace(/\/$/,'')}/rest/v1/${path}`, { ...options, headers });
  if (!response.ok) throw new Error((await response.text()).slice(0,300));
  return response.status === 204 ? null : response.json();
}
async function facebook(env, post) {
  const params = new URLSearchParams({ message: post.message, access_token: env.META_PAGE_ACCESS_TOKEN });
  if (post.link) params.set('link', post.link);
  const response = await fetch(`https://graph.facebook.com/${env.META_GRAPH_VERSION || 'v25.0'}/${env.META_PAGE_ID}/feed`, { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body:params });
  const data = await response.json(); if (!response.ok) throw new Error(data?.error?.message || 'Facebook failed'); return { platform:'facebook', id:data.id };
}
async function linkedin(env, post) {
  const body = { author:env.LINKEDIN_AUTHOR_URN, commentary:post.message, visibility:'PUBLIC', distribution:{feedDistribution:'MAIN_FEED',targetEntities:[],thirdPartyDistributionChannels:[]}, lifecycleState:'PUBLISHED', isReshareDisabledByAuthor:false };
  if (post.link) body.content = { article:{ source:post.link, title:post.title.slice(0,120) } };
  const response = await fetch('https://api.linkedin.com/rest/posts', { method:'POST', headers:{Authorization:`Bearer ${env.LINKEDIN_ACCESS_TOKEN}`,'Content-Type':'application/json','LinkedIn-Version':env.LINKEDIN_VERSION || '202606','X-Restli-Protocol-Version':'2.0.0'}, body:JSON.stringify(body) });
  if (!response.ok) throw new Error((await response.text()).slice(0,300)); return { platform:'linkedin', id:response.headers.get('x-restli-id') || 'published' };
}
async function run(env) {
  const now = new Date().toISOString();
  const query = new URLSearchParams({ select:'*', status:'eq.Scheduled', scheduled_for:`lte.${now}`, order:'scheduled_for.asc', limit:'20' });
  const posts = await rest(env, `social_posts?${query}`);
  for (const post of posts || []) {
    const results = []; const failures = [];
    for (const platform of post.platforms || []) {
      try { results.push(platform === 'facebook' ? await facebook(env,post) : await linkedin(env,post)); }
      catch (error) { failures.push({platform,error:error.message}); }
    }
    const status = failures.length ? (results.length ? 'Partially published' : 'Failed') : 'Published';
    await rest(env, `social_posts?id=eq.${post.id}`, { method:'PATCH', headers:{Prefer:'return=minimal'}, body:JSON.stringify({status,published_at:results.length ? new Date().toISOString() : null,provider_results:results,provider_errors:failures}) });
  }
}
export default {
  async scheduled(_controller, env, ctx) { ctx.waitUntil(run(env)); },
  async fetch(request, env) {
    if (request.headers.get('Authorization') !== `Bearer ${env.SCHEDULER_SECRET}`) return new Response('Forbidden',{status:403});
    await run(env); return new Response('Scheduled posts processed.');
  }
};
