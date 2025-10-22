const STORAGE_KEY = 'trading_journal_v1';
let trades = loadTrades();

const els = {
  navButtons: Array.from(document.querySelectorAll('nav button')),
  tabs: {
    add: document.getElementById('tab-add'),
    list: document.getElementById('tab-list'),
    summary: document.getElementById('tab-summary'),
    backup: document.getElementById('tab-backup'),
  },
  totalPnl: document.getElementById('totalPnl'),
  lastPnl: document.getElementById('lastPnl'),
  tradeForm: document.getElementById('tradeForm'),
  tradeList: document.getElementById('tradeList'),
  dailySummary: document.getElementById('dailySummary'),
  filterSymbol: document.getElementById('filterSymbol'),
  clearFilter: document.getElementById('clearFilter'),
  exportBtn: document.getElementById('exportBtn'),
  importFile: document.getElementById('importFile'),
  importBtn: document.getElementById('importBtn'),
};

init();

function init() {
  // 榛樿鏃ユ湡涓轰粖澶?  const dateInput = document.getElementById('date');
  if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);

  els.navButtons.forEach(btn => {
    btn.addEventListener('click', () => setTab(btn.dataset.tab));
  });

  els.tradeForm.addEventListener('submit', onSubmit);
  els.filterSymbol.addEventListener('input', () => renderTrades(els.filterSymbol.value.trim()));
  els.clearFilter.addEventListener('click', () => { els.filterSymbol.value = ''; renderTrades(''); });
  els.exportBtn.addEventListener('click', exportJSON);
  els.importBtn.addEventListener('click', importJSON);

  updateTotal();
  renderTrades('');
  renderSummary();
}

function setTab(tab) {
  Object.keys(els.tabs).forEach(key => {
    const isActive = key === tab;
    els.tabs[key].classList.toggle('active', isActive);
  });
  els.navButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
}

function onSubmit(e) {
  e.preventDefault();
  const date = document.getElementById('date').value;
  const symbol = document.getElementById('symbol').value.trim();
  const direction = document.getElementById('direction').value;
  const quantity = parseInt(document.getElementById('quantity').value, 10) || 0;
  const entryPrice = parseFloat(document.getElementById('entryPrice').value) || 0;
  const exitPrice = parseFloat(document.getElementById('exitPrice').value) || 0;
  const fees = parseFloat(document.getElementById('fees').value) || 0;
  const notes = document.getElementById('notes').value.trim();

  if (!date || !symbol || quantity <= 0) return;
  const trade = {
    id: Date.now(),
    date,
    symbol,
    direction, // 'Long' or 'Short'
    quantity,
    entryPrice,
    exitPrice,
    fees,
    notes,
  };
  trade.pnl = computePnl(trade);

  trades.push(trade);
  saveTrades();

  els.tradeForm.reset();
  document.getElementById('date').value = date; // 淇濇寔鎻愪氦鐨勬棩鏈?  els.lastPnl.textContent = `鏈鐩堜簭锛?{formatCurrency(trade.pnl)}`;

  updateTotal();
  renderTrades(els.filterSymbol.value.trim());
  renderSummary();
  setTab('list');
}

function computePnl(t) {
  const gross = t.direction === 'Long'
    ? (t.exitPrice - t.entryPrice) * t.quantity
    : (t.entryPrice - t.exitPrice) * t.quantity;
  const net = gross - (t.fees || 0);
  return Math.round(net * 100) / 100; // 涓や綅灏忔暟
}

function updateTotal() {
  const total = trades.reduce((sum, t) => sum + computePnl(t), 0);
  els.totalPnl.textContent = `鎬荤泩浜忥細${formatCurrency(total)}`;
}

function renderTrades(filter) {
  const list = els.tradeList;
  list.innerHTML = '';
  const items = (filter ? trades.filter(t => (t.symbol || '').toLowerCase().includes(filter.toLowerCase())) : trades)
    .sort((a, b) => b.id - a.id);

  if (!items.length) {
    list.innerHTML = '<li class="item">鏆傛棤璁板綍</li>';
    return;
  }

  items.forEach(t => {
    const li = document.createElement('li');
    li.className = 'item';
    const pnlClass = t.pnl >= 0 ? 'profit' : 'loss';
    li.innerHTML = `
      <div class="meta"><span>${t.date}</span><span>${t.direction === 'Long' ? '鍋氬' : '鍋氱┖'}</span></div>
      <div class="title">${escapeHtml(t.symbol)} | 鏁伴噺锛?{t.quantity}</div>
      <div>涔板叆浠凤細${t.entryPrice} | 鍗栧嚭浠凤細${t.exitPrice} | 鎵嬬画璐癸細${t.fees || 0}</div>
      <div class="pnl ${pnlClass}">鐩堜簭锛?{formatCurrency(computePnl(t))}</div>
      <div class="actions">
        <button data-id="${t.id}" class="del">鍒犻櫎</button>
      </div>
    `;
    li.querySelector('.del').addEventListener('click', () => deleteTrade(t.id));
    list.appendChild(li);
  });
}

function renderSummary() {
  const ul = els.dailySummary;
  ul.innerHTML = '';
  if (!trades.length) {
    ul.innerHTML = '<li class="item">鏆傛棤姹囨€?/li>';
    return;
  }
  const groups = trades.reduce((acc, t) => {
    acc[t.date] = acc[t.date] || { date: t.date, total: 0, count: 0 };
    acc[t.date].total += computePnl(t);
    acc[t.date].count += 1;
    return acc;
  }, {});
  const rows = Object.values(groups).sort((a, b) => b.date.localeCompare(a.date));
  rows.forEach(r => {
    const li = document.createElement('li');
    li.className = 'item';
    const pnlClass = r.total >= 0 ? 'profit' : 'loss';
    li.innerHTML = `
      <div class="meta"><span>${r.date}</span><span>璁板綍锛?{r.count} 绗?/span></div>
      <div class="pnl ${pnlClass}">褰撴棩鐩堜簭锛?{formatCurrency(Math.round(r.total * 100) / 100)}</div>
    `;
    ul.appendChild(li);
  });
}

function deleteTrade(id) {
  const idx = trades.findIndex(t => t.id === id);
  if (idx >= 0) {
    trades.splice(idx, 1);
    saveTrades();
    updateTotal();
    renderTrades(els.filterSymbol.value.trim());
    renderSummary();
  }
}

function exportJSON() {
  const blob = new Blob([JSON.stringify(trades, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `trading_journal_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function importJSON() {
  const file = els.importFile.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (Array.isArray(data)) {
        trades = data.map(sanitizeTrade);
        saveTrades();
        updateTotal();
        renderTrades('');
        renderSummary();
        alert('瀵煎叆鎴愬姛');
      } else {
        alert('瀵煎叆鏍煎紡涓嶆纭?);
      }
    } catch (e) {
      alert('瀵煎叆澶辫触锛? + e.message);
    }
  };
  reader.readAsText(file);
}

function sanitizeTrade(t) {
  return {
    id: Number(t.id) || Date.now(),
    date: t.date || new Date().toISOString().slice(0, 10),
    symbol: String(t.symbol || ''),
    direction: t.direction === 'Short' ? 'Short' : 'Long',
    quantity: Number(t.quantity) || 0,
    entryPrice: Number(t.entryPrice) || 0,
    exitPrice: Number(t.exitPrice) || 0,
    fees: Number(t.fees) || 0,
    notes: String(t.notes || ''),
    pnl: Number(t.pnl || 0),
  };
}

function saveTrades() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trades));
}

function loadTrades() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data.map(sanitizeTrade) : [];
  } catch (e) {
    return [];
  }
}

function formatCurrency(n) {
  const value = (Number(n) || 0).toFixed(2);
  return `楼${value}`;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"]/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[s]));
}