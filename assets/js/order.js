const config = window.ADEROVICK_CONFIG;
const $ = (selector) => document.querySelector(selector);
let services = [];

function money(value, code) {
  return new Intl.NumberFormat('en', { style: 'currency', currency: code, maximumFractionDigits: 0 }).format(value);
}
function toast(message) {
  const item = document.createElement('div'); item.className = 'toast'; item.textContent = message;
  $('#toastStack')?.append(item); setTimeout(() => item.remove(), 3500);
}
function message(text, type = 'warning') {
  const box = $('#orderMessage'); box.className = `notice ${type} mt-2`; box.textContent = text;
}
function selectedService() { return services.find(item => item.id === $('#service').value); }
function quote() {
  const service = selectedService();
  if (!service) { $('#quoteTotal').textContent = 'Select a service'; $('#quoteBase').textContent = '—'; $('#quoteTimeline').textContent = '—'; return null; }
  const complexity = $('#complexity').value;
  const urgency = $('#urgency').value;
  const currency = $('#currency').value;
  const complexityMultiplier = { standard: 1, advanced: 1.55, enterprise: 2.35 }[complexity] || 1;
  const urgencyMultiplier = { flexible: .92, normal: 1, priority: 1.25, urgent: 1.6 }[urgency] || 1;
  let lowUsd = service.baseUsd * complexityMultiplier * urgencyMultiplier;
  let highUsd = lowUsd * 1.35;
  const conversion = currency === 'KES' ? config.exchangeRateKesPerUsd : currency === 'GBP' ? .78 : currency === 'EUR' ? .92 : 1;
  const low = Math.round(lowUsd * conversion); const high = Math.round(highUsd * conversion);
  const timeline = Math.max(1, Math.round(service.deliveryDays / (urgency === 'urgent' ? 1.7 : urgency === 'priority' ? 1.3 : urgency === 'flexible' ? .8 : 1)));
  $('#quoteTotal').textContent = `${money(low, currency)} – ${money(high, currency)}`;
  $('#quoteBase').textContent = money(Math.round(service.baseUsd * conversion), currency);
  $('#quoteComplexity').textContent = $('#complexity').selectedOptions[0].text;
  $('#quoteUrgency').textContent = $('#urgency').selectedOptions[0].text;
  $('#quoteTimeline').textContent = `About ${timeline} day${timeline === 1 ? '' : 's'}`;
  return { low, high, currency, timeline, baseUsd: service.baseUsd };
}

async function loadServices() {
  const response = await fetch('data/services.json'); services = await response.json();
  $('#service').insertAdjacentHTML('beforeend', services.map(item => `<option value="${item.id}">${item.name}</option>`).join(''));
  const preselected = new URLSearchParams(location.search).get('service');
  if (preselected && services.some(item => item.id === preselected)) $('#service').value = preselected;
  quote();
}

function demoOrder(payload) {
  const random = crypto.getRandomValues(new Uint32Array(1))[0].toString(36).toUpperCase().slice(0, 5);
  const code = `AV-${new Date().toISOString().slice(2, 10).replaceAll('-', '')}-${random}`;
  const order = { id: crypto.randomUUID(), trackingCode: code, status: 'Submitted', createdAt: new Date().toISOString(), ...payload };
  const saved = JSON.parse(localStorage.getItem('aderovick-demo-orders') || '[]'); saved.unshift(order);
  localStorage.setItem('aderovick-demo-orders', JSON.stringify(saved));
  return order;
}

async function uploadFiles(orderId, trackingCode, files) {
  if (!files.length || config.demoMode) return [];
  const uploaded = [];
  for (const file of files) {
    if (file.size > 8 * 1024 * 1024) throw new Error(`${file.name} is larger than 8 MB.`);
    const form = new FormData(); form.append('file', file); form.append('orderId', orderId); form.append('trackingCode', trackingCode);
    const response = await fetch(`${config.apiBaseUrl}/api/uploads`, { method: 'POST', body: form });
    if (!response.ok) throw new Error(`Could not upload ${file.name}.`);
    uploaded.push(await response.json());
  }
  return uploaded;
}

async function submitOrder(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const estimate = quote();
  const service = selectedService();
  const files = [...$('#files').files];
  const payload = {
    clientName: $('#clientName').value.trim(), clientEmail: $('#clientEmail').value.trim().toLowerCase(),
    clientPhone: $('#clientPhone').value.trim(), country: $('#country').value.trim(), organisation: $('#organisation').value.trim(),
    serviceId: service.id, serviceName: service.name, projectTitle: $('#projectTitle').value.trim(), description: $('#description').value.trim(),
    deliverables: $('#deliverables').value.trim(), complexity: $('#complexity').value, urgency: $('#urgency').value,
    deadline: $('#deadline').value || null, budget: Number($('#budget').value) || null, currency: $('#currency').value,
    estimateLow: estimate.low, estimateHigh: estimate.high, fileNames: files.map(file => file.name)
  };
  const button = $('#submitOrder'); button.disabled = true; button.textContent = 'Submitting request…';
  try {
    let order;
    if (config.demoMode) {
      order = demoOrder(payload);
      await new Promise(resolve => setTimeout(resolve, 650));
    } else {
      const response = await fetch(`${config.apiBaseUrl}/api/orders`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Order submission failed.');
      order = result.order;
      await uploadFiles(order.id, order.trackingCode, files);
    }
    message(`Request submitted. Your tracking code is ${order.trackingCode}.`, 'success');
    toast('Order request created successfully.');
    setTimeout(() => location.href = `success.html?order=${encodeURIComponent(order.id)}&tracking=${encodeURIComponent(order.trackingCode)}&email=${encodeURIComponent(payload.clientEmail)}`, 950);
  } catch (error) {
    console.error(error); message(error.message || 'Unable to submit the request. Please email the project brief instead.', 'error');
    button.disabled = false; button.textContent = 'Submit request and get tracking code';
  }
}

function initNav() {
  $('#menuButton')?.addEventListener('click', () => $('#mainNav')?.classList.toggle('open'));
  ['service','complexity','urgency','currency'].forEach(id => $(`#${id}`)?.addEventListener('change', quote));
  $('#orderForm')?.addEventListener('submit', submitOrder);
  $('#year').textContent = new Date().getFullYear();
  const minimum = new Date(); minimum.setDate(minimum.getDate() + 1); $('#deadline').min = minimum.toISOString().slice(0, 10);
}

loadServices().catch(error => message(error.message, 'error'));
initNav();
