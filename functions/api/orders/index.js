import { allowedOrigin, cleanText, error, json, randomCode, readJson, validEmail } from '../../_lib/http.js';
import { estimateQuote } from '../../_lib/catalog.js';
import { insertRow } from '../../_lib/supabase.js';

export async function onRequestPost({ request, env }) {
  if (!allowedOrigin(request, env)) return error('Origin not allowed.', 403);
  try {
    const body = await readJson(request);
    const clientName = cleanText(body.clientName, 120);
    const clientEmail = cleanText(body.clientEmail, 180).toLowerCase();
    const projectTitle = cleanText(body.projectTitle, 180);
    const description = cleanText(body.description, 5000);
    const serviceId = cleanText(body.serviceId, 80);
    if (!clientName || !validEmail(clientEmail) || !projectTitle || description.length < 20 || !serviceId) {
      return error('Name, valid email, service, project title and a meaningful description are required.');
    }
    const estimate = estimateQuote(serviceId, body.complexity, body.urgency);
    const trackingCode = randomCode('AV');
    const row = {
      tracking_code: trackingCode,
      client_name: clientName,
      client_email: clientEmail,
      client_phone: cleanText(body.clientPhone, 60),
      country: cleanText(body.country, 90),
      organisation: cleanText(body.organisation, 160),
      service_id: serviceId,
      service_name: estimate.service.name,
      project_title: projectTitle,
      description,
      deliverables: cleanText(body.deliverables, 4000),
      complexity: cleanText(body.complexity || 'standard', 30),
      urgency: cleanText(body.urgency || 'normal', 30),
      deadline: body.deadline || null,
      budget: Number(body.budget) || null,
      currency: cleanText(body.currency || 'USD', 3).toUpperCase(),
      estimate_low_usd: estimate.lowUsd,
      estimate_high_usd: estimate.highUsd,
      status: 'Submitted',
      source: 'web',
    };
    const rows = await insertRow(env, 'orders', row);
    const created = rows?.[0];
    return json({
      order: {
        id: created?.id,
        trackingCode,
        status: created?.status || 'Submitted',
        estimateLowUsd: estimate.lowUsd,
        estimateHighUsd: estimate.highUsd,
      },
    }, 201);
  } catch (exception) {
    return error(exception.message || 'Order submission failed.', 500);
  }
}

export function onRequestGet() {
  return error('Method not allowed.', 405);
}
