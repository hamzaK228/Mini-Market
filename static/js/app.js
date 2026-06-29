// Mini-Markets CRM Application Client
const state = {
  markets: [],
  products: [],
  orders: [],
  reconciliationDate: '',
  reconciliationData: null,
  currentMarketId: null,
  activeView: 'dashboard',
  activeOrderTab: 'all',
  activeKkmTab: 'api',
  kkmSyncTimeoutId: null
};

// --- Toast System ---
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  
  const toast = document.createElement('div');
  toast.className = `flex items-center gap-3 px-4 py-3 rounded-xl border text-xs font-semibold shadow-2xl transition-all duration-300 transform translate-y-2 opacity-0 ` +
    (type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
     type === 'error' ? 'bg-red-500/10 border-red-500/30 text-red-400' :
     'bg-amber-500/10 border-amber-500/30 text-amber-400');
  
  const icon = type === 'success' ? 'fa-circle-check' : type === 'error' ? 'fa-circle-xmark' : 'fa-circle-exclamation';
  toast.innerHTML = `<i class="fa-solid ${icon} text-base shrink-0"></i><span>${message}</span>`;
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  }, 10);
  
  setTimeout(() => {
    toast.classList.add('translate-y-2', 'opacity-0');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}
window.showToast = showToast;

// --- App Loading and Session Check ---
function checkAuth() {
  const token = localStorage.getItem('crm_token');
  const owner = localStorage.getItem('crm_owner');
  if (!token || !owner) {
    localStorage.clear();
    window.location.href = '/login';
    return null;
  }
  return JSON.parse(owner);
}

function handleLogout() {
  API.post('/api/auth/logout', {})
    .finally(() => {
      localStorage.clear();
      window.location.href = '/login';
    });
}

// Format date to YYYY-MM-DD
function getTodayString() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// App Initialization
window.addEventListener('DOMContentLoaded', async () => {
  const owner = checkAuth();
  if (!owner) return;
  
  document.getElementById('owner-name').innerText = owner.name;
  document.getElementById('owner-email').innerText = owner.email;
  
  state.reconciliationDate = getTodayString();
  document.getElementById('recon-date-picker').value = state.reconciliationDate;
  
  await refreshAppState();
  
  // Set default market
  const lastMarketId = localStorage.getItem('crm_current_market_id');
  if (lastMarketId && state.markets.find(m => m.id == lastMarketId)) {
    state.currentMarketId = parseInt(lastMarketId);
  } else if (state.markets.length > 0) {
    state.currentMarketId = state.markets[0].id;
    localStorage.setItem('crm_current_market_id', state.currentMarketId);
  }
  
  renderMarketSelects();
  switchTab('dashboard');
  
  // Keyboard Shortcuts (1-5 switching views)
  window.addEventListener('keydown', (e) => {
    const activeElem = document.activeElement;
    if (activeElem && (activeElem.tagName === 'INPUT' || activeElem.tagName === 'TEXTAREA' || activeElem.tagName === 'SELECT')) {
      return;
    }
    const tabs = ['dashboard', 'reconciliation', 'orders', 'products', 'markets'];
    const keyNum = parseInt(e.key);
    if (keyNum >= 1 && keyNum <= 5) {
      e.preventDefault();
      switchTab(tabs[keyNum - 1]);
    }
  });

  // Wire up drag-and-drop on the KKM Dropzone
  const dropzone = document.getElementById('kkm-dropzone');
  if (dropzone) {
    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('border-gold/50', 'bg-zinc-800/20');
    });
    dropzone.addEventListener('dragleave', () => {
      dropzone.classList.remove('border-gold/50', 'bg-zinc-800/20');
    });
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('border-gold/50', 'bg-zinc-800/20');
      const file = e.dataTransfer.files[0];
      if (file) processKkmFile(file);
    });
  }
});

async function refreshAppState() {
  try {
    state.markets = await API.get('/api/markets') || [];
    state.products = await API.get('/api/products') || [];
  } catch (err) {
    console.error('Failed to load initial data', err);
  }
}

function renderMarketSelects() {
  const select = document.getElementById('market-select');
  select.innerHTML = '';
  state.markets.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.innerText = m.name;
    opt.selected = m.id === state.currentMarketId;
    select.appendChild(opt);
  });
}

async function changeActiveMarket(id) {
  state.currentMarketId = parseInt(id);
  localStorage.setItem('crm_current_market_id', id);
  await refreshActiveMarketView();
}

async function refreshActiveMarketView() {
  if (!state.currentMarketId) return;
  
  if (state.activeView === 'dashboard') {
    await renderDashboard();
  } else if (state.activeView === 'reconciliation') {
    await loadReconciliation();
  } else if (state.activeView === 'orders') {
    await renderOrders();
  } else if (state.activeView === 'products') {
    renderProductsTable();
  } else if (state.activeView === 'markets') {
    renderMarketsList();
  }
}

// --- View Router ---
function switchTab(viewId) {
  state.activeView = viewId;
  const views = ['dashboard', 'reconciliation', 'orders', 'products', 'markets'];
  
  views.forEach(v => {
    const el = document.getElementById(`view-${v}`);
    const nav = document.getElementById(`nav-${v}`);
    if (v === viewId) {
      el.classList.remove('hidden');
      nav.className = 'w-full flex items-center gap-3.5 px-4 py-3 rounded-lg text-left text-sm font-bold text-white bg-zinc-800/70 border-l-4 border-gold transition-colors';
    } else {
      el.classList.add('hidden');
      nav.className = 'w-full flex items-center gap-3.5 px-4 py-3 rounded-lg text-left text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800/40 transition-colors border-l-4 border-transparent';
    }
  });

  const titles = {
    dashboard: 'Обзор сети',
    reconciliation: 'Сверка кассы',
    orders: 'Заявки поставщиков',
    products: 'Каталог товаров',
    markets: 'Настройки маркетов'
  };
  document.getElementById('header-page-title').innerText = titles[viewId];
  
  toggleMobileSidebar(true);
  refreshActiveMarketView();
}

function toggleMobileSidebar(forceHide = false) {
  const sidebar = document.getElementById('app-sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const isHidden = sidebar.classList.contains('-translate-x-full');
  
  if (isHidden && !forceHide) {
    sidebar.classList.remove('-translate-x-full');
    overlay.classList.remove('hidden');
  } else {
    sidebar.classList.add('-translate-x-full');
    overlay.classList.add('hidden');
  }
}

// --- View 1: Dashboard Render ---
async function renderDashboard() {
  const activeMarket = state.markets.find(m => m.id === state.currentMarketId);
  if (!activeMarket) {
    document.getElementById('dash-market-badge').innerText = 'Нет маркетов';
    document.getElementById('dash-market-name').innerText = 'Создайте маркет в настройках';
    document.getElementById('dash-market-address').innerText = '';
    return;
  }
  
  document.getElementById('dash-market-badge').innerText = activeMarket.name.split(' ')[0] || 'Маркет';
  document.getElementById('dash-market-name').innerText = activeMarket.name;
  document.getElementById('dash-market-address').innerText = activeMarket.address;

  // Load today's reconciliation for active market
  let recon = null;
  try {
    recon = await API.get(`/api/reconciliations?market_id=${state.currentMarketId}&date=${state.reconciliationDate}`);
  } catch (err) {}
  
  // Load orders for metric
  let orders = [];
  try {
    orders = await API.get(`/api/orders?market_id=${state.currentMarketId}`) || [];
  } catch (err) {}

  const pendingCount = orders.filter(o => o.status === 'pending').length;
  document.getElementById('dash-pending-orders').innerText = pendingCount;

  if (recon) {
    let items = recon.items_json || [];
    let totalQty = items.reduce((sum, item) => sum + (parseFloat(item.actualQty) || 0), 0);
    document.getElementById('dash-sold-count').innerText = `${totalQty} шт`;
    document.getElementById('dash-expected-revenue').innerText = `${recon.total_expected.toLocaleString()} сом`;
    
    const statusText = recon.status === 'ok' ? 'Сверено (Норма)' : 'Сверено (Расхождение)';
    const statusEl = document.getElementById('dash-reconciliation-status');
    const containerEl = document.getElementById('dash-status-icon-container');
    
    statusEl.innerText = statusText;
    if (recon.status === 'ok') {
      statusEl.className = 'text-base font-bold text-emerald-400 mt-1';
      containerEl.className = 'w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 text-xl shrink-0';
      containerEl.innerHTML = '<i class="fa-solid fa-circle-check"></i>';
    } else {
      statusEl.className = 'text-base font-bold text-rose-400 mt-1';
      containerEl.className = 'w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-400 text-xl shrink-0';
      containerEl.innerHTML = '<i class="fa-solid fa-circle-xmark"></i>';
    }
  } else {
    document.getElementById('dash-sold-count').innerText = '0 шт';
    document.getElementById('dash-expected-revenue').innerText = '0 сом';
    document.getElementById('dash-reconciliation-status').innerText = 'Нет сверки';
    document.getElementById('dash-reconciliation-status').className = 'text-base font-bold text-zinc-500 mt-1';
    const containerEl = document.getElementById('dash-status-icon-container');
    containerEl.className = 'w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center text-zinc-500 text-xl shrink-0';
    containerEl.innerHTML = '<i class="fa-solid fa-circle-question"></i>';
  }

  // Comparison Grid of all markets
  const grid = document.getElementById('dash-comparison-grid');
  grid.innerHTML = '';
  
  for (const m of state.markets) {
    let mRecon = null;
    try {
      mRecon = await API.get(`/api/reconciliations?market_id=${m.id}&date=${state.reconciliationDate}`);
    } catch (err) {}
    
    let mOrders = [];
    try {
      mOrders = await API.get(`/api/orders?market_id=${m.id}`) || [];
    } catch (err) {}
    
    const mPending = mOrders.filter(o => o.status === 'pending').length;
    
    const card = document.createElement('div');
    card.className = 'bg-darkCard border border-darkBorder rounded-2xl p-5 premium-card relative overflow-hidden';
    
    let statusBadge = '';
    if (mRecon) {
      statusBadge = mRecon.status === 'ok' 
        ? '<span class="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold uppercase">Сверено (ОК)</span>'
        : `<span class="text-[10px] bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded-full font-bold uppercase">Разница: ${mRecon.total_diff.toLocaleString()} сом</span>`;
    } else {
      statusBadge = '<span class="text-[10px] bg-zinc-800 text-zinc-500 border border-zinc-700/60 px-2 py-0.5 rounded-full font-bold uppercase">Не сверено</span>';
    }
    
    card.innerHTML = `
      <div class="flex justify-between items-start gap-2 mb-3">
        <div>
          <h4 class="font-extrabold text-white text-sm line-clamp-1">${m.name}</h4>
          <p class="text-zinc-500 text-[10px] mt-0.5">${m.address}</p>
        </div>
        ${statusBadge}
      </div>
      <div class="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-darkBorder text-center">
        <div class="bg-zinc-950/60 p-2 rounded-xl border border-darkBorder/40">
          <span class="text-[9px] text-zinc-500 uppercase font-semibold">Касса</span>
          <span class="block text-xs font-bold text-zinc-200 mt-0.5">${mRecon ? mRecon.total_expected.toLocaleString() : 0} сом</span>
        </div>
        <div class="bg-zinc-950/60 p-2 rounded-xl border border-darkBorder/40">
          <span class="text-[9px] text-zinc-500 uppercase font-semibold">Заявки (ожид.)</span>
          <span class="block text-xs font-bold text-amber-500 mt-0.5">${mPending} шт</span>
        </div>
      </div>
    `;
    grid.appendChild(card);
  }
}

// --- View 2: Reconciliation Logic ---
async function loadReconciliation() {
  const activeMarket = state.markets.find(m => m.id === state.currentMarketId);
  if (!activeMarket) return;
  
  try {
    const recon = await API.get(`/api/reconciliations?market_id=${state.currentMarketId}&date=${state.reconciliationDate}`);
    state.reconciliationData = recon;
    renderReconciliationTable(recon);
    loadReconciliationHistory();
  } catch (err) {
    renderReconciliationTable(null);
  }
}

function loadReconciliationDate(date) {
  state.reconciliationDate = date;
  loadReconciliation();
}

function renderReconciliationTable(recon) {
  const tbody = document.getElementById('recon-table-body');
  tbody.innerHTML = '';
  
  if (state.products.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center py-8 text-zinc-500 text-sm">В каталоге нет товаров. Добавьте их во вкладке "Товары"</td></tr>`;
    updateReconciliationTotals();
    return;
  }

  // Create lookup for already-saved items
  const savedItemsMap = {};
  if (recon && recon.items_json) {
    recon.items_json.forEach(item => {
      savedItemsMap[item.productId] = item;
    });
  }

  state.products.forEach(p => {
    const saved = savedItemsMap[p.id] || {};
    const actualQty = saved.actualQty !== undefined ? saved.actualQty : 0;
    const registerQty = saved.registerQty !== undefined ? saved.registerQty : 0;

    const row = document.createElement('tr');
    row.className = 'hover:bg-zinc-900/10 border-b border-darkBorder transition-colors';
    row.dataset.id = p.id;
    row.dataset.price = p.sellPrice;
    
    row.innerHTML = `
      <td class="px-6 py-4 font-bold text-zinc-200">${p.name}</td>
      <td class="px-6 py-4 text-xs text-zinc-500 capitalize">${p.category}</td>
      <td class="px-6 py-4 text-right font-medium text-zinc-400">${p.sellPrice} сом</td>
      <td class="px-6 py-4 text-center">
        <input type="number" min="0" value="${actualQty}" oninput="calculateRowTotals(this)" class="w-16 bg-zinc-950 border border-darkBorder rounded-lg px-2 py-1 text-center font-bold text-white focus:outline-none focus:border-gold">
      </td>
      <td class="px-6 py-4 text-center">
        <input type="number" min="0" value="${registerQty}" oninput="calculateRowTotals(this)" class="w-16 bg-zinc-950 border border-darkBorder rounded-lg px-2 py-1 text-center font-bold text-white focus:outline-none focus:border-gold">
      </td>
      <td class="px-6 py-4 text-right font-bold" id="diff-cell-${p.id}">0 сом</td>
      <td class="px-6 py-4 text-right font-medium text-zinc-400" id="expected-cell-${p.id}">0 сом</td>
      <td class="px-6 py-4 text-right font-medium text-zinc-400" id="register-cell-${p.id}">0 сом</td>
    `;
    tbody.appendChild(row);
    
    // Trigger initial calculation for this row
    const inputs = row.querySelectorAll('input');
    calculateRowTotals(inputs[0]);
  });
  
  updateReconciliationStatusBadge(recon);
}

function calculateRowTotals(inputElement) {
  const row = inputElement.closest('tr');
  const pid = row.dataset.id;
  const price = parseFloat(row.dataset.price) || 0;
  
  const inputs = row.querySelectorAll('input');
  const actualQty = parseFloat(inputs[0].value) || 0;
  const registerQty = parseFloat(inputs[1].value) || 0;
  
  const expectedSum = actualQty * price;
  const registerSum = registerQty * price;
  const diffSum = expectedSum - registerSum;
  
  document.getElementById(`expected-cell-${pid}`).innerText = `${expectedSum.toLocaleString()} сом`;
  document.getElementById(`register-cell-${pid}`).innerText = `${registerSum.toLocaleString()} сом`;
  
  const diffEl = document.getElementById(`diff-cell-${pid}`);
  if (diffSum === 0) {
    diffEl.innerText = '0 сом';
    diffEl.className = 'px-6 py-4 text-right font-bold text-emerald-400';
  } else if (diffSum > 0) {
    diffEl.innerText = `+${diffSum.toLocaleString()} сом`;
    diffEl.className = 'px-6 py-4 text-right font-bold text-amber-500';
  } else {
    diffEl.innerText = `${diffSum.toLocaleString()} сом`;
    diffEl.className = 'px-6 py-4 text-right font-bold text-rose-500';
  }
  
  updateReconciliationTotals();
}

function updateReconciliationTotals() {
  const tbody = document.getElementById('recon-table-body');
  const rows = tbody.querySelectorAll('tr');
  
  let totalExpected = 0;
  let totalRegister = 0;
  let hasMismatch = false;

  rows.forEach(row => {
    if (!row.dataset.id) return;
    const price = parseFloat(row.dataset.price) || 0;
    const inputs = row.querySelectorAll('input');
    const actual = parseFloat(inputs[0].value) || 0;
    const register = parseFloat(inputs[1].value) || 0;
    
    totalExpected += actual * price;
    totalRegister += register * price;
    if (actual !== register) hasMismatch = true;
  });

  const diff = totalExpected - totalRegister;
  
  document.getElementById('recon-total-expected').innerText = `${totalExpected.toLocaleString()} сом`;
  document.getElementById('recon-total-register').innerText = `${totalRegister.toLocaleString()} сом`;
  
  const diffEl = document.getElementById('recon-total-diff');
  if (diff === 0) {
    diffEl.innerText = '0 сом';
    diffEl.className = 'text-xl font-black text-emerald-400 mt-1 block';
  } else {
    const formatted = diff > 0 ? `+${diff.toLocaleString()}` : diff.toLocaleString();
    diffEl.innerText = `${formatted} сом`;
    diffEl.className = `text-xl font-black ${diff > 0 ? 'text-amber-500' : 'text-rose-500'} mt-1 block`;
  }
}

function updateReconciliationStatusBadge(recon) {
  const badge = document.getElementById('recon-status-badge');
  if (!recon) {
    badge.className = 'hidden';
    return;
  }
  
  badge.classList.remove('hidden');
  if (recon.status === 'ok') {
    badge.className = 'text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 px-2.5 py-1 rounded-lg font-bold uppercase flex items-center gap-1.5';
    badge.innerHTML = '<i class="fa-solid fa-circle-check"></i><span>Сверка пройдена успешно</span>';
  } else {
    badge.className = 'text-xs bg-rose-500/10 text-rose-400 border border-rose-500/25 px-2.5 py-1 rounded-lg font-bold uppercase flex items-center gap-1.5';
    badge.innerHTML = '<i class="fa-solid fa-circle-xmark"></i><span>Сверка с расхождением</span>';
  }
}

function quickFillReconciliation(action) {
  const tbody = document.getElementById('recon-table-body');
  const rows = tbody.querySelectorAll('tr');
  
  rows.forEach(row => {
    if (!row.dataset.id) return;
    const inputs = row.querySelectorAll('input');
    if (action === 'zero') {
      inputs[0].value = 0;
    } else if (action === 'copy') {
      inputs[1].value = inputs[0].value;
    }
    calculateRowTotals(inputs[0]);
  });
}

async function saveCurrentReconciliation() {
  const tbody = document.getElementById('recon-table-body');
  const rows = tbody.querySelectorAll('tr');
  
  const items = [];
  let totalExpected = 0;
  let totalRegister = 0;
  let isMismatch = false;

  rows.forEach(row => {
    if (!row.dataset.id) return;
    const pid = parseInt(row.dataset.id);
    const price = parseFloat(row.dataset.price) || 0;
    const name = row.querySelector('td').innerText;
    const inputs = row.querySelectorAll('input');
    const actual = parseFloat(inputs[0].value) || 0;
    const register = parseFloat(inputs[1].value) || 0;
    
    items.push({ productId: pid, name, actualQty: actual, registerQty: register });
    totalExpected += actual * price;
    totalRegister += register * price;
    if (actual !== register) isMismatch = true;
  });

  const payload = {
    market_id: state.currentMarketId,
    date: state.reconciliationDate,
    items: items,
    total_expected: totalExpected,
    total_register: totalRegister,
    total_diff: totalExpected - totalRegister,
    status: isMismatch ? 'mismatch' : 'ok'
  };

  try {
    const res = await API.post('/api/reconciliations', payload);
    showToast('Сверка сохранена успешно!', 'success');
    state.reconciliationData = res;
    updateReconciliationStatusBadge(res);
    loadReconciliationHistory();
  } catch (err) {
    showToast(err.message || 'Ошибка сохранения сверки', 'error');
  }
}

async function loadReconciliationHistory() {
  const tbody = document.getElementById('recon-history-body');
  tbody.innerHTML = '';
  
  try {
    const history = await API.get(`/api/reconciliations/history?market_id=${state.currentMarketId}`) || [];
    if (history.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-zinc-500 text-xs">История сверок пуста</td></tr>`;
      return;
    }
    
    history.forEach(h => {
      const row = document.createElement('tr');
      row.className = 'border-b border-darkBorder hover:bg-zinc-800/10 transition-colors';
      
      const badge = h.status === 'ok' 
        ? '<span class="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full font-bold uppercase">ОК</span>'
        : '<span class="text-[10px] bg-rose-500/10 text-rose-400 px-2 py-0.5 rounded-full font-bold uppercase">Разница</span>';
      
      const diffText = h.total_diff === 0 ? '0 сом' : (h.total_diff > 0 ? `+${h.total_diff}` : h.total_diff) + ' сом';
      const diffClass = h.total_diff === 0 ? 'text-emerald-400 font-bold' : (h.total_diff > 0 ? 'text-amber-500 font-bold' : 'text-rose-500 font-bold');

      const dateObj = new Date(h.created_at);
      const createdStr = dateObj.toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });

      row.innerHTML = `
        <td class="py-3 font-semibold text-zinc-200">${h.date}</td>
        <td class="py-3 text-right font-medium">${h.total_expected.toLocaleString()} сом</td>
        <td class="py-3 text-right font-medium">${h.total_register.toLocaleString()} сом</td>
        <td class="py-3 text-right ${diffClass}">${diffText}</td>
        <td class="py-3 text-center">${badge}</td>
        <td class="py-3 text-right text-xs text-zinc-500">${createdStr}</td>
      `;
      tbody.appendChild(row);
    });
  } catch (err) {}
}

// --- View 3: Supplier Orders Logic ---
async function renderOrders() {
  const list = document.getElementById('orders-list');
  list.innerHTML = '<p class="text-zinc-500 text-xs text-center py-8">Загрузка заявок...</p>';

  try {
    const orders = await API.get(`/api/orders?market_id=${state.currentMarketId}`) || [];
    state.orders = orders;
    
    // Filter
    let filtered = orders;
    if (state.activeOrderTab !== 'all') {
      filtered = orders.filter(o => o.status === state.activeOrderTab);
    }
    
    list.innerHTML = '';
    if (filtered.length === 0) {
      list.innerHTML = `<div class="bg-darkCard border border-darkBorder rounded-xl p-8 text-center text-zinc-500 text-sm">Заявок с таким статусом не найдено</div>`;
      return;
    }

    filtered.forEach(o => {
      const card = document.createElement('div');
      card.className = 'bg-darkCard border border-darkBorder rounded-2xl p-5 premium-card relative overflow-hidden';
      
      let statusBadge = '';
      let statusBorder = 'border-darkBorder';
      if (o.status === 'pending') {
        statusBadge = '<span class="text-[10px] bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 rounded-full font-bold uppercase flex items-center gap-1"><i class="fa-solid fa-clock animate-pulse"></i> В ожидании</span>';
        statusBorder = 'border-l-4 border-l-amber-500';
      } else if (o.status === 'accepted') {
        statusBadge = '<span class="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold uppercase flex items-center gap-1"><i class="fa-solid fa-circle-check"></i> Принято</span>';
        statusBorder = 'border-l-4 border-l-emerald-500';
      } else if (o.status === 'rejected') {
        statusBadge = '<span class="text-[10px] bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded-full font-bold uppercase flex items-center gap-1"><i class="fa-solid fa-circle-xmark"></i> Отклонено</span>';
        statusBorder = 'border-l-4 border-l-rose-500';
      }

      card.className += ` ${statusBorder}`;

      const itemsHtml = o.items_json.map(item => `
        <tr class="text-xs text-zinc-300">
          <td class="py-1 font-semibold">${item.name}</td>
          <td class="py-1 text-center font-bold text-zinc-400">${item.qty} шт</td>
          <td class="py-1 text-right text-zinc-500">${item.price} сом</td>
          <td class="py-1 text-right font-bold text-zinc-300">${(item.qty * item.price).toLocaleString()} сом</td>
        </tr>
      `).join('');

      const totalAmount = o.items_json.reduce((sum, item) => sum + (item.qty * item.price), 0);

      // Comments & action buttons logic
      let rejectCommentHtml = '';
      if (o.status === 'rejected' && o.comment) {
        rejectCommentHtml = `
          <div class="mt-4 bg-rose-500/5 border border-rose-500/20 rounded-xl p-3 text-xs text-rose-400 flex items-start gap-2.5">
            <i class="fa-solid fa-comment-dots mt-0.5"></i>
            <div>
              <span class="font-bold uppercase text-[9px] tracking-wider block mb-0.5">Причина отклонения:</span>
              <span>${o.comment}</span>
            </div>
          </div>
        `;
      } else if (o.comment) {
        rejectCommentHtml = `
          <div class="mt-4 bg-zinc-950 p-3 rounded-xl border border-darkBorder/40 text-xs text-zinc-400 flex items-start gap-2.5">
            <i class="fa-solid fa-comment mt-0.5 text-zinc-500"></i>
            <div>
              <span class="font-bold uppercase text-[9px] tracking-wider block mb-0.5 text-zinc-500">Комментарий:</span>
              <span>${o.comment}</span>
            </div>
          </div>
        `;
      }

      let actionsHtml = '';
      if (o.status === 'pending') {
        actionsHtml = `
          <div class="flex flex-wrap gap-2 justify-end mt-4 pt-4 border-t border-darkBorder">
            <button onclick="openEditOrderModal(${o.id})" class="px-3.5 py-1.5 border border-darkBorder hover:border-gold/30 text-zinc-300 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors">
              <i class="fa-solid fa-pen"></i> Редактировать
            </button>
            <button onclick="openRejectReasonModal(${o.id})" class="px-3.5 py-1.5 bg-rose-600/10 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/20 hover:border-transparent rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors">
              <i class="fa-solid fa-xmark"></i> Отклонить
            </button>
            <button onclick="updateOrderStatus(${o.id}, 'accepted')" class="px-4.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors">
              <i class="fa-solid fa-check"></i> Принять
            </button>
          </div>
        `;
      } else {
        actionsHtml = `
          <div class="flex justify-end mt-4 pt-4 border-t border-darkBorder">
            <button onclick="confirmDeleteOrder(${o.id})" class="px-3 py-1.5 text-zinc-500 hover:text-rose-400 text-xs font-semibold flex items-center gap-1 transition-colors">
              <i class="fa-solid fa-trash-can text-[11px]"></i> Удалить запись
            </button>
          </div>
        `;
      }

      const dateObj = new Date(o.created_at);
      const dateStr = dateObj.toLocaleDateString('ru-RU') + ' ' + dateObj.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

      card.innerHTML = `
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-4">
          <div class="flex items-center gap-2.5">
            <span class="text-xs font-mono font-bold text-zinc-500 bg-zinc-950 px-2 py-0.5 rounded border border-darkBorder/40">#${o.id}</span>
            <h4 class="text-base font-extrabold text-white">${o.supplier}</h4>
          </div>
          <div class="flex items-center gap-3">
            <span class="text-xs text-zinc-500">${dateStr}</span>
            ${statusBadge}
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
          <div class="md:col-span-2 overflow-x-auto">
            <table class="w-full">
              <thead>
                <tr class="border-b border-darkBorder text-[10px] text-zinc-500 font-bold uppercase text-left">
                  <th class="pb-1.5 font-semibold">Товар</th>
                  <th class="pb-1.5 text-center font-semibold">Кол-во</th>
                  <th class="pb-1.5 text-right font-semibold">Цена</th>
                  <th class="pb-1.5 text-right font-semibold">Сумма</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>
          </div>

          <div class="bg-zinc-950/60 border border-darkBorder/40 rounded-xl p-4 flex flex-col justify-between">
            <div class="space-y-1.5 text-xs text-zinc-400">
              <div class="flex justify-between"><span>Контакты:</span><span class="font-bold text-zinc-300">${o.contact_person || 'Не указан'}</span></div>
              <div class="flex justify-between"><span>Телефон:</span><span class="font-bold text-zinc-300">${o.phone || 'Не указан'}</span></div>
            </div>
            <div class="border-t border-darkBorder/60 pt-3 mt-3 flex justify-between items-baseline">
              <span class="text-zinc-500 text-[10px] font-bold uppercase tracking-wider">Итого:</span>
              <span class="text-lg font-black text-white">${totalAmount.toLocaleString()} сом</span>
            </div>
          </div>
        </div>

        ${rejectCommentHtml}
        ${actionsHtml}
      `;
      list.appendChild(card);
    });
  } catch(err) {}
}

function switchOrderTab(tab) {
  state.activeOrderTab = tab;
  const tabs = ['all', 'pending', 'accepted', 'rejected'];
  tabs.forEach(t => {
    const el = document.getElementById(`order-tab-${t}`);
    if (t === tab) {
      el.className = 'pb-3 border-b-2 border-gold text-gold';
    } else {
      el.className = 'pb-3 border-b-2 border-transparent text-zinc-400 hover:text-white';
    }
  });
  renderOrders();
}

async function updateOrderStatus(orderId, status, comment = '') {
  try {
    await API.put(`/api/orders/${orderId}`, { status, comment });
    showToast('Статус заявки изменен успешно!', 'success');
    renderOrders();
    closeModal();
  } catch (err) {}
}

// --- View 4: Products Catalog Logic ---
function renderProductsTable() {
  // Populate category filter dropdown
  const catFilter = document.getElementById('prod-filter-category');
  const activeCat = catFilter.value;
  catFilter.innerHTML = '<option value="">Все категории</option>';
  const categories = [...new Set(state.products.map(p => p.category))];
  categories.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.innerText = c;
    opt.selected = c === activeCat;
    catFilter.appendChild(opt);
  });

  // Populate supplier filter dropdown
  const suppFilter = document.getElementById('prod-filter-supplier');
  const activeSupp = suppFilter.value;
  suppFilter.innerHTML = '<option value="">Все поставщики</option>';
  const suppliers = [...new Set(state.products.map(p => p.supplier).filter(Boolean))];
  suppliers.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s;
    opt.innerText = s;
    opt.selected = s === activeSupp;
    suppFilter.appendChild(opt);
  });

  filterProducts();
}

function filterProducts() {
  const category = document.getElementById('prod-filter-category').value;
  const supplier = document.getElementById('prod-filter-supplier').value;
  
  let filtered = state.products;
  if (category) filtered = filtered.filter(p => p.category === category);
  if (supplier) filtered = filtered.filter(p => p.supplier === supplier);

  const tbody = document.getElementById('products-table-body');
  tbody.innerHTML = '';
  
  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-6 text-zinc-500">Товары не найдены</td></tr>`;
    return;
  }

  filtered.forEach(p => {
    const row = document.createElement('tr');
    row.className = 'border-b border-darkBorder hover:bg-zinc-800/10 transition-colors';
    row.innerHTML = `
      <td class="px-6 py-4 font-bold text-zinc-200">${p.name}</td>
      <td class="px-6 py-4 text-xs text-zinc-500 capitalize">${p.category}</td>
      <td class="px-6 py-4 text-xs text-zinc-400 font-medium">${p.supplier || '—'}</td>
      <td class="px-6 py-4 text-right font-medium text-zinc-400">${p.buyPrice || p.buy_price || 0} сом</td>
      <td class="px-6 py-4 text-right font-bold text-gold">${p.sellPrice || p.sell_price || 0} сом</td>
      <td class="px-6 py-4 text-center">
        <button onclick="confirmDeleteProduct(${p.id}, '${p.name.replace(/'/g, "\\'")}')" class="text-zinc-500 hover:text-red-400 p-1.5 transition-colors">
          <i class="fa-solid fa-trash-can text-xs"></i>
        </button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

// --- View 5: Markets Management Logic ---
function renderMarketsList() {
  const container = document.getElementById('markets-list-container');
  container.innerHTML = '';
  
  if (state.markets.length === 0) {
    container.innerHTML = `<div class="col-span-full bg-darkCard border border-darkBorder rounded-2xl p-8 text-center text-zinc-500">Магазины не созданы</div>`;
    return;
  }

  state.markets.forEach(m => {
    const card = document.createElement('div');
    card.className = 'bg-darkCard border border-darkBorder rounded-2xl p-5 premium-card space-y-4';
    
    const kkm = m.kkm_config || {};
    const providerNames = {
      webkassa: 'Webkassa',
      '1c': '1C KKM Connector',
      evotor: 'Эвотор API',
      smartkkm: 'Smart KKM'
    };
    const providerLabel = providerNames[kkm.provider] || 'Не настроен';

    card.innerHTML = `
      <div class="flex justify-between items-start">
        <div>
          <h4 class="font-extrabold text-white text-base">${m.name}</h4>
          <p class="text-zinc-500 text-xs mt-0.5"><i class="fa-solid fa-location-dot text-gold/60 mr-1"></i>${m.address}</p>
        </div>
        <button onclick="confirmDeleteMarket(${m.id}, '${m.name.replace(/'/g, "\\'")}')" class="text-zinc-500 hover:text-rose-500 p-1.5 transition-colors">
          <i class="fa-solid fa-trash-can text-xs"></i>
        </button>
      </div>

      <div class="bg-zinc-950/80 p-4 border border-darkBorder rounded-xl text-xs space-y-2">
        <span class="font-bold text-gold uppercase text-[9px] tracking-wider block">Параметры ККМ</span>
        <div class="flex justify-between"><span>Касса:</span><span class="font-semibold text-zinc-300">${providerLabel}</span></div>
        <div class="flex justify-between"><span>Device ID:</span><span class="font-semibold text-zinc-300">${kkm.deviceId || '—'}</span></div>
      </div>
    `;
    container.appendChild(card);
  });
}

// --- CRUD Forms Submission ---
async function submitAddProduct(e) {
  e.preventDefault();
  const name = document.getElementById('prod-name').value;
  const category = document.getElementById('prod-category').value;
  const supplier = document.getElementById('prod-supplier').value;
  const buy_price = parseFloat(document.getElementById('prod-buy-price').value);
  const sell_price = parseFloat(document.getElementById('prod-sell-price').value);

  try {
    await API.post('/api/products', { name, category, supplier, buy_price, sell_price });
    showToast('Товар добавлен в каталог!', 'success');
    document.getElementById('add-product-form').reset();
    closeModal();
    await refreshAppState();
    renderProductsTable();
  } catch(err) {}
}

async function submitAddMarket(e) {
  e.preventDefault();
  const name = document.getElementById('market-name').value;
  const address = document.getElementById('market-address').value;

  try {
    const newMarket = await API.post('/api/markets', { name, address });
    showToast('Новый магазин добавлен!', 'success');
    document.getElementById('add-market-form').reset();
    closeModal();
    await refreshAppState();
    
    // Select the new market
    state.currentMarketId = newMarket.id;
    localStorage.setItem('crm_current_market_id', newMarket.id);
    renderMarketSelects();
    renderMarketsList();
  } catch(err) {}
}

// --- Delete Modals Confirmation ---
let deleteAction = null;

function openDeleteModal(warningText, onConfirm) {
  document.getElementById('delete-warning-text').innerText = warningText;
  deleteAction = onConfirm;
  
  // Show backdrop and modal
  document.getElementById('modal-backdrop').classList.remove('hidden');
  document.getElementById('modal-delete-confirm').classList.remove('hidden');
  
  const confirmBtn = document.getElementById('delete-confirm-btn');
  confirmBtn.onclick = async () => {
    confirmBtn.disabled = true;
    confirmBtn.innerText = 'Удаление...';
    try {
      await deleteAction();
      closeModal();
    } catch(e) {}
    confirmBtn.disabled = false;
    confirmBtn.innerText = 'Удалить';
  };
}

function confirmDeleteProduct(id, name) {
  openDeleteModal(`Вы действительно хотите удалить товар "${name}"?`, async () => {
    try {
      await API.delete(`/api/products/${id}`);
      showToast('Товар удален из каталога!', 'success');
      await refreshAppState();
      renderProductsTable();
    } catch(err) {}
  });
}

function confirmDeleteMarket(id, name) {
  openDeleteModal(`Вы действительно хотите удалить магазин "${name}"? Все сверки и заявки этого магазина будут безвозвратно удалены!`, async () => {
    try {
      await API.delete(`/api/markets/${id}`);
      showToast('Магазин успешно удален!', 'success');
      await refreshAppState();
      
      if (state.currentMarketId === id) {
        state.currentMarketId = state.markets.length > 0 ? state.markets[0].id : null;
        if (state.currentMarketId) {
          localStorage.setItem('crm_current_market_id', state.currentMarketId);
        } else {
          localStorage.removeItem('crm_current_market_id');
        }
      }
      renderMarketSelects();
      renderMarketsList();
    } catch(err) {}
  });
}

function confirmDeleteOrder(id) {
  openDeleteModal(`Удалить запись о заявке #${id}?`, async () => {
    try {
      await API.delete(`/api/orders/${id}`);
      showToast('Запись о заявке удалена', 'success');
      renderOrders();
    } catch(err) {}
  });
}

// --- Modals Display Handlers ---
function closeModal() {
  document.getElementById('modal-backdrop').classList.add('hidden');
  const modals = [
    'modal-new-order', 'modal-edit-order', 'modal-reject-reason',
    'modal-add-product', 'modal-add-market', 'modal-delete-confirm', 'modal-kkm-integration'
  ];
  modals.forEach(m => document.getElementById(m).classList.add('hidden'));
  
  if (state.kkmSyncTimeoutId) {
    clearTimeout(state.kkmSyncTimeoutId);
    state.kkmSyncTimeoutId = null;
  }
}

function openAddProductModal() {
  document.getElementById('modal-backdrop').classList.remove('hidden');
  document.getElementById('modal-add-product').classList.remove('hidden');
}

function openAddMarketModal() {
  document.getElementById('modal-backdrop').classList.remove('hidden');
  document.getElementById('modal-add-market').classList.remove('hidden');
}

// --- Supplier Orders creation ---
let newOrderRowsCount = 0;

function openNewOrderModal() {
  document.getElementById('modal-backdrop').classList.remove('hidden');
  document.getElementById('modal-new-order').classList.remove('hidden');
  
  const container = document.getElementById('order-items-rows');
  container.innerHTML = '';
  newOrderRowsCount = 0;
  
  addOrderItemRow(); // Add initial row
}

function addOrderItemRow() {
  const container = document.getElementById('order-items-rows');
  const index = newOrderRowsCount++;
  
  const row = document.createElement('div');
  row.className = 'flex items-center gap-2.5 bg-zinc-950 p-2 border border-darkBorder rounded-lg';
  row.id = `new-order-row-${index}`;
  
  // Options
  const prodOptions = state.products.map(p => `<option value="${p.id}" data-price="${p.sellPrice}" data-name="${p.name.replace(/"/g, '&quot;')}">${p.name}</option>`).join('');
  
  row.innerHTML = `
    <select onchange="updateOrderItemPriceAndName(${index}, this)" class="flex-1 bg-zinc-900 border border-darkBorder text-xs text-zinc-200 rounded px-2.5 py-1.5 focus:outline-none">
      <option value="">Выберите товар</option>
      ${prodOptions}
    </select>
    <input type="hidden" id="order-item-name-${index}">
    <div class="flex items-center gap-1.5 shrink-0">
      <span class="text-[10px] text-zinc-500">Цена:</span>
      <input type="number" id="order-item-price-${index}" required class="w-16 bg-zinc-900 border border-darkBorder text-xs text-center text-zinc-300 rounded px-1.5 py-1" placeholder="Цена">
    </div>
    <div class="flex items-center gap-1.5 shrink-0">
      <span class="text-[10px] text-zinc-500">Кол-во:</span>
      <input type="number" id="order-item-qty-${index}" min="1" required class="w-14 bg-zinc-900 border border-darkBorder text-xs text-center text-zinc-350 rounded px-1.5 py-1" value="1">
    </div>
    <button type="button" onclick="removeOrderItemRow(${index})" class="text-zinc-500 hover:text-red-400 p-1 transition-colors"><i class="fa-solid fa-trash-can text-[11px]"></i></button>
  `;
  container.appendChild(row);
}

function removeOrderItemRow(index) {
  const row = document.getElementById(`new-order-row-${index}`);
  if (row) row.remove();
}

function updateOrderItemPriceAndName(index, selectEl) {
  const opt = selectEl.options[selectEl.selectedIndex];
  if (!opt || selectEl.value === '') return;
  
  const price = opt.dataset.price;
  const name = opt.dataset.name;
  
  document.getElementById(`order-item-price-${index}`).value = price;
  document.getElementById(`order-item-name-${index}`).value = name;
}

async function submitNewOrder(e) {
  e.preventDefault();
  const supplier = document.getElementById('order-supplier').value;
  const contact = document.getElementById('order-contact').value;
  const phone = document.getElementById('order-phone').value;
  
  const items = [];
  const container = document.getElementById('order-items-rows');
  const rows = container.children;
  
  for (let row of rows) {
    const select = row.querySelector('select');
    if (!select.value) continue;
    
    const pid = parseInt(select.value);
    const index = row.id.split('-').pop();
    const price = parseFloat(document.getElementById(`order-item-price-${index}`).value) || 0;
    const qty = parseInt(document.getElementById(`order-item-qty-${index}`).value) || 0;
    const name = document.getElementById(`order-item-name-${index}`).value;
    
    items.push({ productId: pid, name, price, qty });
  }

  if (items.length === 0) {
    showToast('Добавьте хотя бы один товар в заявку!', 'error');
    return;
  }

  const payload = {
    market_id: state.currentMarketId,
    supplier,
    contact_person: contact,
    phone,
    items
  };

  try {
    await API.post('/api/orders', payload);
    showToast('Заявка успешно отправлена!', 'success');
    closeModal();
    if (state.activeView === 'orders') {
      renderOrders();
    }
  } catch(err) {}
}

// --- Edit Order Modal Logic ---
function openEditOrderModal(orderId) {
  const order = state.orders.find(o => o.id === orderId);
  if (!order) return;
  
  document.getElementById('modal-backdrop').classList.remove('hidden');
  document.getElementById('modal-edit-order').classList.remove('hidden');
  
  document.getElementById('edit-order-id').value = order.id;
  
  const container = document.getElementById('edit-order-items-container');
  container.innerHTML = '';
  
  order.items_json.forEach((item, idx) => {
    const div = document.createElement('div');
    div.className = 'flex items-center justify-between bg-zinc-950 p-3.5 border border-darkBorder rounded-xl gap-3 text-xs';
    div.innerHTML = `
      <span class="font-bold text-zinc-200 flex-1">${item.name}</span>
      <input type="hidden" name="edit-pid" value="${item.productId}">
      <input type="hidden" name="edit-pname" value="${item.name.replace(/"/g, '&quot;')}">
      <input type="hidden" name="edit-price" value="${item.price}">
      <div class="flex items-center gap-2 shrink-0">
        <span class="text-[10px] text-zinc-500">Кол-во:</span>
        <input type="number" name="edit-qty" min="1" value="${item.qty}" class="w-16 bg-zinc-900 border border-darkBorder text-center rounded py-1 px-1.5 text-white font-bold">
      </div>
    `;
    container.appendChild(div);
  });
}

async function submitEditOrder(e) {
  e.preventDefault();
  const orderId = document.getElementById('edit-order-id').value;
  const container = document.getElementById('edit-order-items-container');
  
  const pids = container.querySelectorAll('input[name="edit-pid"]');
  const pnames = container.querySelectorAll('input[name="edit-pname"]');
  const prices = container.querySelectorAll('input[name="edit-price"]');
  const qtys = container.querySelectorAll('input[name="edit-qty"]');
  
  const items = [];
  pids.forEach((el, idx) => {
    items.push({
      productId: parseInt(el.value),
      name: pnames[idx].value,
      price: parseFloat(prices[idx].value),
      qty: parseInt(qtys[idx].value) || 1
    });
  });

  try {
    await API.put(`/api/orders/${orderId}`, { items });
    showToast('Заявка обновлена успешно!', 'success');
    closeModal();
    renderOrders();
  } catch(err) {}
}

// --- Reject Order Modal Logic ---
function openRejectReasonModal(orderId) {
  document.getElementById('modal-backdrop').classList.remove('hidden');
  document.getElementById('modal-reject-reason').classList.remove('hidden');
  
  document.getElementById('reject-order-id').value = orderId;
  document.getElementById('reject-comment').value = '';
}

function submitRejectOrder() {
  const orderId = document.getElementById('reject-order-id').value;
  const comment = document.getElementById('reject-comment').value.strip ? document.getElementById('reject-comment').value.strip() : document.getElementById('reject-comment').value;
  if (!comment) {
    showToast('Причина отклонения обязательна!', 'error');
    return;
  }
  updateOrderStatus(orderId, 'rejected', comment);
}

// --- KKM Integration Modal Logic ---
function openKkmModal() {
  const activeMarket = state.markets.find(m => m.id === state.currentMarketId);
  if (!activeMarket) {
    showToast('Маркет не выбран!', 'error');
    return;
  }
  
  document.getElementById('modal-backdrop').classList.remove('hidden');
  document.getElementById('modal-kkm-integration').classList.remove('hidden');
  
  // Set up panels default values
  const kkm = activeMarket.kkm_config || {};
  const providerNames = {
    webkassa: 'Webkassa (Казахстан/Кыргызстан)',
    '1c': '1C KKM Connector',
    evotor: 'Эвотор API',
    smartkkm: 'Smart KKM (Кыргызстан)'
  };
  
  document.getElementById('kkm-info-provider').innerText = providerNames[kkm.provider] || 'Не настроен';
  document.getElementById('kkm-info-endpoint').innerText = kkm.endpoint || '—';
  document.getElementById('kkm-info-device').innerText = kkm.deviceId || '—';
  
  // Format current reconciliation date nicely
  const parts = state.reconciliationDate.split('-');
  document.getElementById('kkm-info-date').innerText = parts.reverse().join('.');
  
  // Prep Settings tab form
  document.getElementById('kkm-setting-provider').value = kkm.provider || 'webkassa';
  document.getElementById('kkm-setting-endpoint').value = kkm.endpoint || '';
  document.getElementById('kkm-setting-token').value = kkm.token || '';
  document.getElementById('kkm-setting-device').value = kkm.deviceId || '';
  
  switchKkmTab('api');
}

function switchKkmTab(tabId) {
  state.activeKkmTab = tabId;
  const tabs = ['api', 'file', 'settings'];
  tabs.forEach(t => {
    const btn = document.getElementById(`tab-kkm-${t}`);
    const panel = document.getElementById(`kkm-panel-${t}`);
    if (t === tabId) {
      btn.className = 'flex-1 py-2 rounded-lg font-bold transition-all bg-gold text-darkBg text-xs';
      panel.classList.remove('hidden');
    } else {
      btn.className = 'flex-1 py-2 rounded-lg font-bold transition-all text-zinc-400 hover:text-white text-xs';
      panel.classList.add('hidden');
    }
  });
}

async function submitKkmSettings(e) {
  e.preventDefault();
  const provider = document.getElementById('kkm-setting-provider').value;
  const endpoint = document.getElementById('kkm-setting-endpoint').value;
  const token = document.getElementById('kkm-setting-token').value;
  const deviceId = document.getElementById('kkm-setting-device').value;

  const kkm_config = { provider, endpoint, token, deviceId };
  
  try {
    await API.put(`/api/markets/${state.currentMarketId}`, { kkm_config });
    showToast('Параметры интеграции сохранены!', 'success');
    await refreshAppState();
    closeModal();
  } catch(err) {}
}

// Simulated API KKM Sync console logger
function logTerminal(text, type = 'info') {
  const term = document.getElementById('kkm-log-terminal');
  const d = new Date();
  const time = d.toTimeString().split(' ')[0];
  
  const span = document.createElement('div');
  span.className = type === 'success' ? 'text-emerald-400 font-bold' : (type === 'error' ? 'text-red-400' : 'text-zinc-400');
  span.innerHTML = `[${time}] ${text}`;
  
  term.appendChild(span);
  term.scrollTop = term.scrollHeight;
}

function startKkmApiSync() {
  const activeMarket = state.markets.find(m => m.id === state.currentMarketId);
  const config = activeMarket.kkm_config || {};
  if (!config.provider || !config.endpoint) {
    showToast('Сначала настройте параметры кассы!', 'error');
    switchKkmTab('settings');
    return;
  }

  document.getElementById('kkm-sync-logs-container').classList.remove('hidden');
  document.getElementById('btn-kkm-sync-run').disabled = true;
  
  const term = document.getElementById('kkm-log-terminal');
  term.innerHTML = '';
  
  logTerminal('Инициализация сессии KKM...');
  
  const steps = [
    { delay: 800, text: `Подключение к шлюзу ${config.provider.toUpperCase()}...`, type: 'info' },
    { delay: 1600, text: `Авторизация терминала ${config.deviceId}... OK.`, type: 'info' },
    { delay: 2400, text: `Запрос z-отчета продаж за дату ${state.reconciliationDate}...`, type: 'info' },
    { delay: 3200, text: 'Обработка данных. Сопоставление с каталогом товаров...', type: 'info' },
    { delay: 4200, text: 'Получено: 16 записей продаж. Импорт в таблицу сверки...', type: 'success' },
    { delay: 4800, text: 'Синхронизация завершена успешно!', type: 'success' }
  ];

  steps.forEach(step => {
    state.kkmSyncTimeoutId = setTimeout(() => {
      logTerminal(step.text, step.type);
      if (step.delay === 4800) {
        // Complete mock population
        mockPopulateReconciliationValues();
        showToast('Импорт данных ККМ выполнен успешно!', 'success');
        setTimeout(() => closeModal(), 1000);
      }
    }, step.delay);
  });
}

function mockPopulateReconciliationValues() {
  const tbody = document.getElementById('recon-table-body');
  const rows = tbody.querySelectorAll('tr');
  
  // Set random but realistic mock values for demonstration
  rows.forEach(row => {
    if (!row.dataset.id) return;
    const inputs = row.querySelectorAll('input');
    // Set actual sales qty randomly (e.g. 5 to 45)
    const randomQty = Math.floor(Math.random() * 40) + 5;
    
    inputs[0].value = randomQty; // physical qty
    // Make 80% matches, 20% mismatch
    if (Math.random() > 0.2) {
      inputs[1].value = randomQty; // match
    } else {
      inputs[1].value = randomQty + (Math.random() > 0.5 ? 1 : -1); // mismatch
    }
    
    calculateRowTotals(inputs[0]);
  });
}

// File Drag & Drop parsing
function triggerKkmFileInput() {
  document.getElementById('kkm-file-input').click();
}

function handleKkmFileSelect(e) {
  const file = e.target.files[0];
  if (file) processKkmFile(file);
}

function processKkmFile(file) {
  const reader = new FileReader();
  const ext = file.name.split('.').pop().toLowerCase();
  
  reader.onload = function(e) {
    const content = e.target.result;
    try {
      if (ext === 'json') {
        const data = JSON.parse(content);
        importKkmReportData(data);
      } else if (ext === 'csv') {
        const data = parseCsvReport(content);
        importKkmReportData(data);
      }
      showToast(`Успешно обработан файл: ${file.name}`, 'success');
      closeModal();
    } catch(err) {
      showToast('Ошибка при чтении или неверный формат файла отчета!', 'error');
    }
  };
  
  reader.readAsText(file);
}

function parseCsvReport(csvText) {
  const lines = csvText.split('\n');
  const result = [];
  
  // Simple CSV parser ignoring header
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const parts = line.split(',');
    if (parts.length >= 2) {
      const name = parts[0].replace(/"/g, '').trim();
      const qty = parseInt(parts[1]) || 0;
      result.push({ name, qty });
    }
  }
  return result;
}

function importKkmReportData(reportItems) {
  const tbody = document.getElementById('recon-table-body');
  const rows = tbody.querySelectorAll('tr');

  // Map loaded items
  rows.forEach(row => {
    if (!row.dataset.id) return;
    const name = row.querySelector('td').innerText.trim().toLowerCase();
    const inputs = row.querySelectorAll('input');
    
    // Find matching item in import list
    let match = null;
    if (Array.isArray(reportItems)) {
      match = reportItems.find(item => {
        const item_name = (item.name || '').toLowerCase();
        return item_name === name || name.includes(item_name) || item_name.includes(name);
      });
    } else if (typeof reportItems === 'object') {
      // JSON dict where keys are product IDs or names
      const matchKey = Object.keys(reportItems).find(k => k.toLowerCase() === name || name.includes(k.toLowerCase()));
      if (matchKey) {
        match = { qty: reportItems[matchKey] };
      }
    }

    if (match) {
      inputs[1].value = match.qty || match.quantity || 0;
    } else {
      inputs[1].value = 0; // default if not in report
    }
    calculateRowTotals(inputs[0]);
  });
}

function downloadSampleKkmReport() {
  const data = state.products.map(p => ({
    name: p.name,
    quantity: Math.floor(Math.random() * 30) + 2
  }));
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `kkm_sales_report_${state.reconciliationDate}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Шаблон отчета скачан!', 'success');
}
