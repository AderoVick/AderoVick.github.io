const config = window.ADEROVICK_CONFIG;
const $ = (selector) => document.querySelector(selector);
let method = 'mpesa';

function showMessage(text, type = 'warning') {
  const box = $('#checkoutMessage'); box.className = `notice ${type}`; box.textContent = text;
}
function toast(text) {
  const item = document.createElement('div'); item.className = 'toast'; item.textContent = text;
  $('#toastStack')?.append(item); setTimeout(() => item.remove(), 3500);
}
function queryPrefill() {
  const params = new URLSearchParams(location.search);
  if (params.get('tracking')) $('#trackingCode').value = params.get('tracking');
  if (params.get('email')) $('#payerEmail').value = params.get('email');
  if (params.get('amount')) $('#amount').value = params.get('amount');
  if (params.get('currency')) $('#currency').value = params.get('currency');
}
function chooseMethod(next) {
  method = next;
  document.querySelectorAll('[data-payment-tab]').forEach(button => button.classList.toggle('active', button.dataset.paymentTab === next));
  document.querySelectorAll('[data-payment-panel]').forEach(panel => panel.classList.toggle('active', panel.dataset.paymentPanel === next));
  if (next === 'mpesa') $('#currency').value = 'KES';
}
async function callApi(path, body) {
  const response = await fetch(`${config.apiBaseUrl}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'The payment request could not be created.');
  return data;
}
async function submit(event) {
  event.preventDefault();
  if (!event.currentTarget.reportValidity()) return;
  const payload = {
    trackingCode: $('#trackingCode').value.trim().toUpperCase(),
    email: $('#payerEmail').value.trim().toLowerCase(),
    amount: Number($('#amount').value),
    currency: $('#currency').value,
    returnUrl: `${location.origin}${location.pathname.replace('checkout.html','success.html')}?payment=complete`,
    cancelUrl: location.href
  };
  if (method === 'mpesa') payload.phone = $('#mpesaPhone').value.trim();
  const button = $('#payButton'); button.disabled = true; button.textContent = 'Creating secure payment…';
  try {
    if (config.demoMode) {
      await new Promise(resolve => setTimeout(resolve, 750));
      showMessage(`Demo mode: ${method.toUpperCase()} checkout is ready for backend credentials. No payment was taken.`, 'success');
      toast('Payment flow preview completed.');
      return;
    }
    const endpoint = {
      mpesa: '/api/payments/mpesa/stk-push',
      paypal: '/api/payments/paypal/create-order',
      stripe: '/api/payments/stripe/create-session',
      crypto: '/api/payments/crypto/create-invoice'
    }[method];
    const result = await callApi(endpoint, payload);
    if (result.url) location.href = result.url;
    else if (result.approvalUrl) location.href = result.approvalUrl;
    else if (method === 'mpesa') showMessage('The M-Pesa prompt was sent. Complete it on your phone, then check the client portal.', 'success');
    else showMessage('Payment request created successfully.', 'success');
  } catch (error) {
    showMessage(error.message, 'error');
  } finally {
    button.disabled = false; button.textContent = 'Continue securely';
  }
}

document.querySelectorAll('[data-payment-tab]').forEach(button => button.addEventListener('click', () => chooseMethod(button.dataset.paymentTab)));
$('#checkoutForm')?.addEventListener('submit', submit);
$('#menuButton')?.addEventListener('click', () => $('#mainNav')?.classList.toggle('open'));
$('#year').textContent = new Date().getFullYear();
queryPrefill();
