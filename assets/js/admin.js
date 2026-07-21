const config = window.ADEROVICK_CONFIG;
const $ = selector => document.querySelector(selector);
let token = '';
let projects = [];
let ordersCache = [];

function notice(selector, text, type = 'warning') { const el = $(selector); el.className = `notice ${type} mt-2`; el.textContent = text; }
function toast(text) { const item = document.createElement('div'); item.className = 'toast'; item.textContent = text; $('#toastStack')?.append(item); setTimeout(()=>item.remove(),3500); }
function money(value, currency='USD') { return new Intl.NumberFormat('en',{style:'currency',currency,maximumFractionDigits:0}).format(value || 0); }
function demoOrders() { return JSON.parse(localStorage.getItem('aderovick-demo-orders') || '[]'); }
function renderOrders(orders) {
  ordersCache = orders;
  $('#openOrders').textContent = orders.filter(o => !['Completed','Cancelled'].includes(o.status)).length;
  $('#quoteOrders').textContent = orders.filter(o => ['Submitted','Under review'].includes(o.status)).length;
  $('#ordersBody').innerHTML = orders.length ? orders.map(order => `<tr><td><strong>${order.trackingCode}</strong></td><td>${order.clientName}<br><small class="text-muted">${order.clientEmail}</small></td><td>${order.serviceName || order.serviceId}</td><td><span class="badge">${order.status || 'Submitted'}</span></td><td>${money(order.estimateLow, order.currency)}–${money(order.estimateHigh, order.currency)}</td><td>${new Date(order.createdAt).toLocaleDateString()}</td><td><button class="btn btn-ghost btn-sm" data-edit-order="${order.id}">Update</button></td></tr>`).join('') : '<tr><td colspan="7" class="text-muted">No orders found.</td></tr>';
  document.querySelectorAll('[data-edit-order]').forEach(button => button.addEventListener('click', () => openOrderModal(button.dataset.editOrder)));
}
async function authToken() {
  if (!config.supabaseUrl || !config.supabaseAnonKey || !window.supabase) return '';
  const client = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
  const { data } = await client.auth.getSession(); return data.session?.access_token || '';
}
async function loadOrders() {
  try {
    if (config.demoMode) { renderOrders(demoOrders()); return; }
    token = await authToken(); if (!token) throw new Error('Sign in with an authorised admin account before loading orders.');
    const response = await fetch(`${config.apiBaseUrl}/api/admin/orders`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Orders could not be loaded.');
    renderOrders(data.orders); notice('#adminStatus','Authenticated admin session active.','success');
  } catch (error) { notice('#adminStatus', error.message, 'error'); }
}

function openOrderModal(id) {
  const order = ordersCache.find(item => item.id === id); if (!order) return;
  $('#updateOrderId').value = order.id; $('#updateStatus').value = order.status || 'Submitted';
  $('#updateCurrency').value = order.quotedCurrency || order.currency || 'USD'; $('#updateAmount').value = order.quotedAmount || ''; $('#updateNotes').value = order.adminNotes || '';
  $('#orderModal').classList.add('open');
}
function closeOrderModal() { $('#orderModal').classList.remove('open'); }
async function updateOrder(event) {
  event.preventDefault(); const id=$('#updateOrderId').value; const payload={id,status:$('#updateStatus').value,quotedAmount:$('#updateAmount').value?Number($('#updateAmount').value):null,quotedCurrency:$('#updateCurrency').value,adminNotes:$('#updateNotes').value};
  try {
    if (config.demoMode) { const saved=demoOrders(); const index=saved.findIndex(item=>item.id===id); if(index<0) throw new Error('Order not found.'); saved[index]={...saved[index],status:payload.status,quotedAmount:payload.quotedAmount,quotedCurrency:payload.quotedCurrency,adminNotes:payload.adminNotes,updatedAt:new Date().toISOString()}; localStorage.setItem('aderovick-demo-orders',JSON.stringify(saved)); notice('#updateMessage','Demo order updated in this browser.','success'); renderOrders(saved); return; }
    token=token||await authToken(); if(!token) throw new Error('An authenticated admin session is required.'); const response=await fetch(`${config.apiBaseUrl}/api/admin/order-update`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(payload)}); const data=await response.json(); if(!response.ok) throw new Error(data.error||'Update failed.'); notice('#updateMessage','Order updated successfully.','success'); await loadOrders();
  } catch(error) { notice('#updateMessage',error.message,'error'); }
}

async function loadProjects() {
  projects = await fetch('data/projects.json').then(r=>r.json());
  $('#liveProjects').textContent = projects.filter(p=>p.appUrl || p.websiteUrl).length;
  $('#adminProjectGrid').innerHTML = projects.map(project => `<article class="project-card" style="min-height:auto"><div class="project-top"><span class="project-icon">${project.title.split(/\s+/).slice(0,2).map(w=>w[0]).join('')}</span><span class="status-pill ${project.appUrl || project.websiteUrl ? 'live':''}">${project.status}</span></div><h3>${project.title}</h3><p>${project.summary}</p><div class="project-actions"><a class="btn btn-ghost btn-sm" href="${project.repoUrl}" target="_blank" rel="noopener">Repository</a>${project.websiteUrl ? `<a class="btn btn-secondary btn-sm" href="${project.websiteUrl}" target="_blank" rel="noopener">Website</a>`:''}${project.appUrl ? `<a class="btn btn-primary btn-sm" href="${project.appUrl}" target="_blank" rel="noopener">App</a>`:''}</div></article>`).join('');
}
function preview() {
  $('#previewTitle').textContent = $('#postTitle').value || 'Your post title';
  $('#previewMessage').textContent = $('#postMessage').value || 'Your post copy appears here as you type.';
  $('#postCount').textContent = $('#postMessage').value.length;
  const link = $('#postLink').value.trim(); $('#previewLink').classList.toggle('hidden', !link); if (link) $('#previewLink').href = link;
}
function saveDraft() {
  const drafts = JSON.parse(localStorage.getItem('aderovick-social-drafts') || '[]');
  drafts.unshift({ id: crypto.randomUUID(), title: $('#postTitle').value, message: $('#postMessage').value, link: $('#postLink').value, createdAt: new Date().toISOString() });
  localStorage.setItem('aderovick-social-drafts', JSON.stringify(drafts)); $('#scheduledPosts').textContent = drafts.length; toast('Draft saved in this browser.');
}
async function publish(event) {
  event.preventDefault();
  const platforms = []; if ($('#postFacebook').checked) platforms.push('facebook'); if ($('#postLinkedIn').checked) platforms.push('linkedin');
  if (!platforms.length) { notice('#publishMessage','Select at least one platform.','error'); return; }
  const payload = { title: $('#postTitle').value.trim(), message: $('#postMessage').value.trim(), link: $('#postLink').value.trim(), platforms, scheduledFor: $('#scheduleAt').value || null };
  try {
    if (config.demoMode) { saveDraft(); notice('#publishMessage','Demo mode: the post was saved as a draft. No social account was contacted.','success'); return; }
    token = token || await authToken(); if (!token) throw new Error('An authenticated admin session is required.');
    const response = await fetch(`${config.apiBaseUrl}/api/social/publish`, { method:'POST', headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`}, body:JSON.stringify(payload) });
    const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Publishing failed.');
    notice('#publishMessage', data.scheduled ? 'Post scheduled successfully.' : 'Post published successfully.', 'success');
  } catch (error) { notice('#publishMessage', error.message, 'error'); }
}

$('#refreshOrders')?.addEventListener('click', loadOrders); $('#orderUpdateForm')?.addEventListener('submit', updateOrder); $('#closeOrderModal')?.addEventListener('click', closeOrderModal); $('#orderModal')?.addEventListener('click',event=>{if(event.target.id==='orderModal')closeOrderModal();}); $('#publishForm')?.addEventListener('submit', publish); $('#saveDraft')?.addEventListener('click', saveDraft);
['postTitle','postMessage','postLink'].forEach(id => $(`#${id}`)?.addEventListener('input', preview));
$('#menuButton')?.addEventListener('click',()=>$('#mainNav')?.classList.toggle('open'));
$('#scheduledPosts').textContent = JSON.parse(localStorage.getItem('aderovick-social-drafts') || '[]').length;
loadOrders(); loadProjects().catch(console.error); preview();
