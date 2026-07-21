export const SERVICES = Object.freeze({
  'research-survey': { name: 'Research & Survey Support', baseUsd: 120 },
  'data-cleaning': { name: 'Data Cleaning & Validation', baseUsd: 90 },
  'statistical-analysis': { name: 'Statistical Analysis', baseUsd: 180 },
  'dashboard-reporting': { name: 'Dashboards & Reporting', baseUsd: 250 },
  'ai-evaluation': { name: 'AI Model Evaluation', baseUsd: 140 },
  'analytical-web-tool': { name: 'Analytical Web Tool', baseUsd: 450 },
  consultation: { name: 'Project Consultation', baseUsd: 35 },
});

export function estimateQuote(serviceId, complexity = 'standard', urgency = 'normal') {
  const service = SERVICES[serviceId];
  if (!service) throw new Error('Unknown service.');
  const complexityFactor = { standard: 1, advanced: 1.55, enterprise: 2.35 }[complexity] || 1;
  const urgencyFactor = { flexible: 0.92, normal: 1, priority: 1.25, urgent: 1.6 }[urgency] || 1;
  const low = Math.round(service.baseUsd * complexityFactor * urgencyFactor);
  return { lowUsd: low, highUsd: Math.round(low * 1.35), service };
}
