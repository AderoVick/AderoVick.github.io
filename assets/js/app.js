const config = window.ADEROVICK_CONFIG;
const state = { projects: [], services: [], posts: [], projectFilter: 'all', search: '' };

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[char]);
}

function formatDate(value) {
  if (!value) return 'Recently updated';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recently updated';
  return new Intl.DateTimeFormat('en', { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
}

function currency(value, code = 'USD') {
  return new Intl.NumberFormat('en', { style: 'currency', currency: code, maximumFractionDigits: 0 }).format(value);
}

function toast(message, type = 'info') {
  const stack = $('#toastStack');
  if (!stack) return;
  const item = document.createElement('div');
  item.className = `toast ${type}`;
  item.textContent = message;
  stack.append(item);
  setTimeout(() => item.remove(), 4200);
}

async function getJson(url) {
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Could not load ${url}`);
  return response.json();
}

function projectButtons(project) {
  const buttons = [];
  if (project.websiteUrl) buttons.push(`<a class="btn btn-primary btn-sm" href="${escapeHtml(project.websiteUrl)}" target="_blank" rel="noopener">Open website ↗</a>`);
  if (project.appUrl) buttons.push(`<a class="btn btn-secondary btn-sm" href="${escapeHtml(project.appUrl)}" target="_blank" rel="noopener">Launch app ↗</a>`);
  if (project.repoUrl) buttons.push(`<a class="btn btn-ghost btn-sm" href="${escapeHtml(project.repoUrl)}" target="_blank" rel="noopener">Source code</a>`);
  return buttons.join('');
}

function renderProjects() {
  const grid = $('#projectGrid');
  if (!grid) return;
  const term = state.search.toLowerCase().trim();
  const filtered = state.projects.filter((project) => {
    const text = [project.title, project.summary, project.category, project.language, ...(project.topics || [])].join(' ').toLowerCase();
    const matchesSearch = !term || text.includes(term);
    const filter = state.projectFilter;
    const matchesFilter = filter === 'all'
      || (filter === 'live' && (project.appUrl || project.websiteUrl))
      || (filter === 'analytics' && /analytics|data|forecast|statistics/i.test(text));
    return matchesSearch && matchesFilter;
  });

  if (!filtered.length) {
    grid.innerHTML = '<div class="empty-state"><strong>No matching projects.</strong><br>Try another term or filter.</div>';
    return;
  }

  grid.innerHTML = filtered.map((project) => `
    <article class="project-card">
      <div class="project-top">
        <span class="project-icon">${escapeHtml(project.title.split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase())}</span>
        <span class="status-pill ${project.appUrl || project.websiteUrl ? 'live' : ''}">${escapeHtml(project.status || 'Source available')}</span>
      </div>
      <h3>${escapeHtml(project.title)}</h3>
      <p>${escapeHtml(project.summary || 'Open-source project and technical documentation.')}</p>
      <div class="tag-row">
        ${(project.topics || [project.language, project.category]).filter(Boolean).slice(0, 5).map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
      </div>
      <div class="project-actions">${projectButtons(project)}</div>
      <div class="project-meta">Updated ${formatDate(project.updatedAt)}${Number.isFinite(project.stars) ? ` · ${project.stars} stars` : ''}</div>
    </article>
  `).join('');
}

function renderServices() {
  const grid = $('#serviceGrid');
  if (!grid) return;
  grid.innerHTML = state.services.map((service) => `
    <article class="service-card ${service.popular ? 'popular' : ''}">
      <div class="service-icon">${escapeHtml(service.name.split(/\s+/).slice(0, 2).map(word => word[0]).join(''))}</div>
      <span class="eyebrow" style="margin-top:1rem">${escapeHtml(service.category)}</span>
      <h3>${escapeHtml(service.name)}</h3>
      <p>${escapeHtml(service.summary)}</p>
      <ul class="service-list">${service.deliverables.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
      <div class="service-price">
        <span><small>Starting from</small><strong>${currency(service.baseUsd)}</strong></span>
        <a class="btn btn-primary btn-sm" href="order.html?service=${encodeURIComponent(service.id)}">Order service</a>
      </div>
    </article>
  `).join('');
}

function renderPosts() {
  const grid = $('#postGrid');
  if (!grid) return;
  grid.innerHTML = state.posts.map(post => `
    <article class="post-card">
      <div><span class="category">${escapeHtml(post.category)}</span> · <time datetime="${escapeHtml(post.date)}">${formatDate(post.date)}</time></div>
      <h3>${escapeHtml(post.title)}</h3>
      <p>${escapeHtml(post.excerpt)}</p>
      <a class="btn btn-ghost btn-sm" href="${escapeHtml(post.url)}">Read more →</a>
    </article>
  `).join('');
}

function commandItems() {
  const staticItems = [
    { title: 'Place a new order', subtitle: 'Submit a project request and receive a tracking code', url: 'order.html', icon: '01' },
    { title: 'Track an order', subtitle: 'Open the client portal', url: 'portal.html', icon: 'CP' },
    { title: 'Open checkout', subtitle: 'M-Pesa, PayPal, Stripe or crypto invoice', url: 'checkout.html', icon: '$' },
    { title: 'Contact Victor', subtitle: config.email, url: `mailto:${config.email}`, icon: '@' }
  ];
  const projectItems = state.projects.flatMap(project => {
    const target = project.appUrl || project.websiteUrl || project.repoUrl;
    if (!target) return [];
    return [{ title: project.title, subtitle: project.appUrl ? 'Launch live application' : project.websiteUrl ? 'Open project website' : 'Open source repository', url: target, icon: 'AP', external: true }];
  });
  const serviceItems = state.services.map(service => ({ title: service.name, subtitle: service.summary, url: `order.html?service=${encodeURIComponent(service.id)}`, icon: 'SV' }));
  return [...staticItems, ...projectItems, ...serviceItems];
}

function renderCommands(term = '') {
  const results = $('#commandResults');
  if (!results) return;
  const query = term.toLowerCase().trim();
  const items = commandItems().filter(item => !query || `${item.title} ${item.subtitle}`.toLowerCase().includes(query)).slice(0, 9);
  results.innerHTML = items.length ? items.map(item => `
    <a class="command-result" href="${escapeHtml(item.url)}" ${item.external ? 'target="_blank" rel="noopener"' : ''}>
      <span class="command-row-icon">${escapeHtml(item.icon)}</span>
      <span><strong>${escapeHtml(item.title)}</strong><small style="display:block;color:var(--muted)">${escapeHtml(item.subtitle)}</small></span>
      <span>→</span>
    </a>
  `).join('') : '<div class="empty-state">No matches found.</div>';
}

function initializeNavigation() {
  const menuButton = $('#menuButton');
  const nav = $('#mainNav');
  menuButton?.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    menuButton.setAttribute('aria-expanded', String(open));
  });
  $$('#mainNav a').forEach(link => link.addEventListener('click', () => nav?.classList.remove('open')));

  const themeButton = $('#themeButton');
  const saved = localStorage.getItem('aderovick-theme');
  const initial = saved || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  document.documentElement.dataset.theme = initial;
  themeButton?.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('aderovick-theme', next);
  });
}

function initializeCommandPalette() {
  const modal = $('#commandModal');
  const input = $('#commandInput');
  const open = () => {
    modal?.classList.add('open');
    renderCommands(input?.value || '');
    setTimeout(() => input?.focus(), 50);
  };
  const close = () => modal?.classList.remove('open');
  $('#commandButton')?.addEventListener('click', open);
  modal?.addEventListener('click', event => { if (event.target === modal) close(); });
  input?.addEventListener('input', event => renderCommands(event.target.value));
  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); open(); }
    if (event.key === 'Escape') close();
  });
}

function initializeFilters() {
  $('#projectSearch')?.addEventListener('input', event => { state.search = event.target.value; renderProjects(); });
  $$('[data-project-filter]').forEach(button => button.addEventListener('click', () => {
    $$('[data-project-filter]').forEach(item => item.classList.remove('active'));
    button.classList.add('active');
    state.projectFilter = button.dataset.projectFilter;
    renderProjects();
  }));
}

async function initializeData() {
  try {
    [state.projects, state.services, state.posts] = await Promise.all([
      getJson('data/projects.json'), getJson('data/services.json'), getJson('data/posts.json')
    ]);
    renderProjects();
    renderServices();
    renderPosts();
    renderCommands();
    const count = $('#projectCount');
    if (count) count.textContent = `${state.projects.length}+`;
    const sync = $('#syncStatus');
    if (sync) {
      const latest = [...state.projects].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0];
      sync.textContent = latest ? `Catalogue refreshed · latest project update ${formatDate(latest.updatedAt)}` : 'Project catalogue ready.';
    }
  } catch (error) {
    console.error(error);
    $('#projectGrid').innerHTML = '<div class="empty-state">Project catalogue could not be loaded. Open the GitHub profile to view repositories.</div>';
    toast('Some platform data could not be loaded.', 'error');
  }
}

function initializePwa() {
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  }
}

function initialize() {
  initializeNavigation();
  initializeCommandPalette();
  initializeFilters();
  initializeData();
  initializePwa();
  const year = $('#year');
  if (year) year.textContent = new Date().getFullYear();
}

initialize();
