const config = window.ADEROVICK_CONFIG;
const $ = selector => document.querySelector(selector);
let authMode = 'signin';

function box(selector, text, type = 'warning') { const el = $(selector); el.className = `notice ${type} mt-2`; el.textContent = text; }
function renderOrder(order) {
  const statuses = ['Submitted','Under review','Quoted','In progress','Review','Completed'];
  const current = Math.max(0, statuses.indexOf(order.status || 'Submitted'));
  $('#orderResult').className = 'mt-3';
  $('#orderResult').innerHTML = `<div class="dashboard-card"><span class="eyebrow">${order.trackingCode}</span><h2>${order.projectTitle || order.serviceName || 'Client order'}</h2><p class="text-muted">${order.serviceName || ''} · Submitted ${new Date(order.createdAt).toLocaleDateString()}</p><div class="order-timeline">${statuses.map((status,index)=>`<div class="timeline-item ${index < current ? 'complete' : index === current ? 'active' : ''}"><span class="timeline-dot"></span><div><strong>${status}</strong><p>${index === current ? 'Current stage' : index < current ? 'Completed' : 'Pending'}</p></div></div>`).join('')}</div><a class="btn btn-primary mt-2" href="checkout.html?tracking=${encodeURIComponent(order.trackingCode)}&email=${encodeURIComponent(order.clientEmail || '')}">Open checkout</a></div>`;
}
async function track(event) {
  event.preventDefault();
  const code = $('#trackingCode').value.trim().toUpperCase(); const email = $('#trackEmail').value.trim().toLowerCase();
  try {
    let order;
    if (config.demoMode) {
      const orders = JSON.parse(localStorage.getItem('aderovick-demo-orders') || '[]');
      order = orders.find(item => item.trackingCode === code && item.clientEmail === email);
      if (!order) throw new Error('No matching demo order was found. Check the code and email.');
    } else {
      const response = await fetch(`${config.apiBaseUrl}/api/orders/track?code=${encodeURIComponent(code)}&email=${encodeURIComponent(email)}`);
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Order not found.'); order = data.order;
    }
    box('#trackMessage', 'Order found.', 'success'); renderOrder(order);
  } catch (error) { box('#trackMessage', error.message, 'error'); $('#orderResult').className = 'hidden'; }
}
function setAuthMode(mode) {
  authMode = mode; document.querySelectorAll('[data-auth-tab]').forEach(tab => tab.classList.toggle('active', tab.dataset.authTab === mode));
  $('#authButton').textContent = mode === 'signup' ? 'Create account' : 'Sign in';
}
async function authenticate(event) {
  event.preventDefault();
  if (!config.supabaseUrl || !config.supabaseAnonKey || !window.supabase) { box('#authMessage','Account login is not configured yet. Use guest tracking above.','warning'); return; }
  const client = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
  const credentials = { email: $('#authEmail').value.trim(), password: $('#authPassword').value };
  const result = authMode === 'signup' ? await client.auth.signUp(credentials) : await client.auth.signInWithPassword(credentials);
  if (result.error) box('#authMessage', result.error.message, 'error');
  else box('#authMessage', authMode === 'signup' ? 'Account created. Check your email if confirmation is required.' : 'Signed in successfully.', 'success');
}

new URLSearchParams(location.search).get('tracking') && ($('#trackingCode').value = new URLSearchParams(location.search).get('tracking'));
new URLSearchParams(location.search).get('email') && ($('#trackEmail').value = new URLSearchParams(location.search).get('email'));
$('#trackForm')?.addEventListener('submit', track); $('#authForm')?.addEventListener('submit', authenticate);
document.querySelectorAll('[data-auth-tab]').forEach(tab => tab.addEventListener('click', () => setAuthMode(tab.dataset.authTab)));
$('#menuButton')?.addEventListener('click', () => $('#mainNav')?.classList.toggle('open')); $('#year').textContent = new Date().getFullYear();
