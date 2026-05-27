// ═══ Fetch Interceptor & Authentication ═══
const originalFetch = window.fetch;
window.fetch = async function(resource, init) {
    const token = localStorage.getItem('token');
    init = init || {};
    init.headers = init.headers || {};
    
    if (token) {
        if (init.headers instanceof Headers) {
            init.headers.set('Authorization', `Bearer ${token}`);
        } else if (Array.isArray(init.headers)) {
            // Find existing Authorization header if any
            const idx = init.headers.findIndex(h => h[0].toLowerCase() === 'authorization');
            if (idx !== -1) init.headers[idx][1] = `Bearer ${token}`;
            else init.headers.push(['Authorization', `Bearer ${token}`]);
        } else {
            init.headers['Authorization'] = `Bearer ${token}`;
        }
    }
    
    try {
        const response = await originalFetch(resource, init);
        if (response.status === 401) {
            // Se receber 401 (não autorizado), desloga e exibe modal de login
            logout();
        }
        return response;
    } catch (error) {
        console.error("Fetch error:", error);
        throw error;
    }
};

// ═══ Theme Management ═══
function getSystemTheme() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme) {
    const actual = theme === 'auto' ? getSystemTheme() : theme;
    document.documentElement.setAttribute('data-theme', actual);
    // Update toggle button states
    document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    const labels = { light: '☀️ Claro', dark: '🌙 Escuro', auto: '💻 Auto' };
    document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
        if (btn.textContent.trim() === labels[theme]) btn.classList.add('active');
    });
}

function setTheme(theme) {
    localStorage.setItem('theme-preference', theme);
    applyTheme(theme);
}

// Init theme on load
(function () {
    const saved = localStorage.getItem('theme-preference') || 'auto';
    applyTheme(saved);
    // Listen for OS theme changes when in auto mode
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        const current = localStorage.getItem('theme-preference') || 'auto';
        if (current === 'auto') applyTheme('auto');
    });
})();

const operationForm = document.getElementById('operation-form');
const eventForm = document.getElementById('event-form');
const tickerForm = document.getElementById('ticker-form');
const fetchInfoBtn = document.getElementById('fetch-info-btn');
const holdingsContainer = document.getElementById('holdings-container');
const API_URL = 'http://127.0.0.1:8000/api';
const toast = document.getElementById('toast');
let highlightIds = [];
let cachedTransactions = [];
let globalGroupedTransactions = {}; // For lazy loading
let globalTickersMetadata = {};
let globalSortState = {}; // { ticker: { col: string, dir: 'asc'|'desc' } }

document.addEventListener('DOMContentLoaded', async () => {
    setupAuth();
    setupMasks();
    setupDraggable();
    setupSyncFields();
});

async function initDashboard() {
    await updateTickerSelects();
    loadHoldings();
    loadTransactions();
    checkDataInconsistencies();
}


function setupSyncFields() {
    const qInput = document.querySelector('#modal-operation [name="quantity"]');
    const pInput = document.getElementById('op-price');
    const tInput = document.getElementById('op-total');

    const updateFromPrice = () => {
        const q = parseFloat(qInput.value) || 0;
        const p = parseCurrencyBRL(pInput.value) || 0;
        if (q > 0) tInput.value = formatCurrencyBRL(q * p);
    };

    const updateFromTotal = () => {
        const q = parseFloat(qInput.value) || 0;
        const t = parseCurrencyBRL(tInput.value) || 0;
        if (q > 0) pInput.value = formatCurrencyBRL(t / q, 6);
    };

    qInput.addEventListener('input', updateFromPrice);
    pInput.addEventListener('input', updateFromPrice);
    tInput.addEventListener('input', updateFromTotal);
}

let highestZ = 1000;
function bringToFront(modal) {
    highestZ++;
    modal.style.zIndex = highestZ;
}

function openModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.style.display = 'block';
    bringToFront(modal);
}
function closeModal(id) { document.getElementById(id).style.display = 'none'; }

let currentModal = null;
let dragOffset = { x: 0, y: 0 };

function setupDraggable() {
    document.querySelectorAll('.modal-window').forEach(makeDraggable);

    // Add global listeners only once
    if (!window.draggableLogicSet) {
        document.addEventListener('mousemove', (e) => {
            if (!currentModal) return;
            currentModal.style.left = (e.clientX - dragOffset.x) + 'px';
            currentModal.style.top = (e.clientY - dragOffset.y) + 'px';
        });
        document.addEventListener('mouseup', () => { currentModal = null; });
        window.draggableLogicSet = true;
    }
}

function makeDraggable(modal) {
    if (modal.dataset.draggableSet) return;
    const header = modal.querySelector('.modal-header');
    if (!header) return;

    header.style.cursor = 'move';
    header.onmousedown = (e) => {
        currentModal = modal;
        bringToFront(modal);

        const rect = modal.getBoundingClientRect();
        dragOffset.x = e.clientX - rect.left;
        dragOffset.y = e.clientY - rect.top;

        // Switch to absolute positioning if not already
        modal.style.position = 'fixed';
        modal.style.left = rect.left + 'px';
        modal.style.top = rect.top + 'px';
        modal.style.transform = 'none';
        modal.style.margin = '0';
    };
    modal.dataset.draggableSet = "true";
}

function setupMasks() {
    document.querySelectorAll('.ticker-input').forEach(i => i.addEventListener('input', e => e.target.value = e.target.value.toUpperCase()));
    document.querySelectorAll('.cnpj-input').forEach(i => i.addEventListener('input', e => {
        let v = e.target.value.replace(/\D/g, "");
        if (v.length > 14) v = v.slice(0, 14);
        if (v.length > 12) v = v.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
        else if (v.length > 8) v = v.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})/, "$1.$2.$3/$4");
        else if (v.length > 5) v = v.replace(/^(\d{2})(\d{3})(\d{3})/, "$1.$2.$3");
        else if (v.length > 2) v = v.replace(/^(\d{2})(\d{3})/, "$1.$2");
        e.target.value = v;
    }));
    const applyCurrencyMask = (e) => {
        let v = e.target.value.replace(/\D/g, "");
        if (v === "") { e.target.value = ""; return; }
        v = (parseFloat(v) / 100).toFixed(2);
        e.target.value = formatCurrencyBRL(v);
    };
    document.querySelectorAll('.currency-input').forEach(i => i.addEventListener('input', applyCurrencyMask));
}

function formatCurrencyBRL(v, d = 2) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: d, maximumFractionDigits: d }).format(v); }
function parseCurrencyBRL(v) { return v ? parseFloat(v.replace(/[^\d,]/g, '').replace(',', '.')) : 0; }
function formatDateBRL(s) { if (!s) return "-"; const [y, m, d] = s.split('-'); return `${d}/${m}/${y}`; }

async function updateTickerSelects() {
    try {
        const res = await fetch(`${API_URL}/tickers`);
        const tickers = await res.json();
        document.querySelectorAll('.ticker-select').forEach(select => {
            const currentVal = select.value;
            select.innerHTML = '<option value="">Selecione um ativo...</option>';
            Object.keys(tickers).sort().forEach(t => {
                const opt = document.createElement('option');
                opt.value = t; opt.textContent = `${t} - ${tickers[t].name}`;
                select.appendChild(opt);
            });
            if (currentVal) select.value = currentVal;
        });
    } catch (err) { console.error(err); }
}

// Cache para re-renderização rápida
let cachedHoldingsData = null;
let cachedHoldingsYears = [];
let cachedHoldingsMetadata = {};
let cachedHoldingsColors = {};
let cachedAllTx = [];
let cachedDeclaredStatus = {};

function getChainInfo(ticker) {
    // Identificar elos de Tickers para agrupamento visual
    const forwardLinks = {};
    cachedAllTx.filter(t => t.action === 'Incorporacao').forEach(t => {
        if (t.ticker && t.ticker_destino) forwardLinks[t.ticker.toUpperCase()] = t.ticker_destino.toUpperCase();
    });
    const backwardLinks = {};
    Object.entries(forwardLinks).forEach(([o, d]) => backwardLinks[d] = o);

    let root = ticker.toUpperCase();
    while (backwardLinks[root]) root = backwardLinks[root];
    let chain = [root];
    let curr = root;
    while (forwardLinks[curr]) {
        curr = forwardLinks[curr];
        if (chain.includes(curr)) break;
        chain.push(curr);
    }
    return { root, index: chain.indexOf(ticker.toUpperCase()) };
}

async function loadHoldings() {
    try {
        const [hRes, txRes, tkRes, settingsRes, statusRes] = await Promise.all([
            fetch(`${API_URL}/yearly-holdings`),
            fetch(`${API_URL}/transactions`),
            fetch(`${API_URL}/tickers`),
            fetch(`${API_URL}/settings`),
            fetch(`${API_URL}/declared-status`)
        ]);
        const holdings = await hRes.json();
        if (!holdings.length) { holdingsContainer.innerHTML = '<p class="empty-state">Sem ativos atuais.</p>'; return; }

        cachedAllTx = await txRes.json();
        cachedHoldingsData = holdings;
        cachedHoldingsMetadata = await tkRes.json();
        const settings = await settingsRes.json();
        cachedHoldingsColors = settings.category_colors || {};
        cachedDeclaredStatus = await statusRes.json();

        const allYearsSet = new Set();
        holdings.forEach(h => Object.keys(h.years).forEach(y => allYearsSet.add(y)));
        cachedHoldingsYears = Array.from(allYearsSet).sort();

        renderHoldingsTable();
    } catch (err) { console.error(err); }
}


function renderHoldingsTable() {
    if (!cachedHoldingsData) return;

    const years = cachedHoldingsYears;
    const tickersMetadata = cachedHoldingsMetadata;
    const catColors = cachedHoldingsColors;

    // Obter filtros ativos
    const activeCats = Array.from(document.querySelectorAll('.main-cat-filters .filter-btn.active')).map(b => b.dataset.cat);
    const activeYearCols = Array.from(document.querySelectorAll('.main-year-filters .filter-btn.active')).map(b => b.dataset.year);
    const searchTerm = document.getElementById('main-holding-search')?.value.toUpperCase() || '';

    // Filtrar anos visíveis
    const visibleYears = years.filter(y => activeYearCols.includes('all') || activeYearCols.includes(y));

    // Filtrar categorias únicas dos dados originais para os botões (apenas na primeira vez ou se necessário)
    const allCats = [...new Set(cachedHoldingsData.map(h => h.years[years[years.length - 1]]?.category || "Ações"))].sort();

    // Gerar HTML dos Filtros (se ainda não existir ou para atualizar botões)
    const filtersContainer = document.querySelector('.main-filters');
    if (!filtersContainer) {
        let filtersHtml = `
            <div class="details-header-row main-filters">
                <div class="details-filters">
                    <div class="filter-group main-cat-filters">
                        <span class="filter-label">📂 Categorias</span>
                        <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                            <button class="filter-btn active" data-cat="all" onclick="toggleMainFilter(this, 'cat', 'all')">Todas</button> 
                            ${allCats.map(c => `<button class="filter-btn" data-cat="${c}" onclick="toggleMainFilter(this, 'cat', '${c}')">${c}</button>`).join('')}
                        </div>
                    </div>
                    <div class="filter-group main-year-filters">
                        <span class="filter-label">📅 Colunas (Anos)</span>
                        <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                            <button class="filter-btn active" data-year="all" onclick="toggleMainFilter(this, 'year', 'all')">Todos</button> 
                            ${years.map(y => `<button class="filter-btn" data-year="${y}" onclick="toggleMainFilter(this, 'year', '${y}')">${y}</button>`).join('')}
                        </div>
                    </div>
                </div>
                <div class="internal-search" style="flex: 1; min-width: 250px;">
                    <span class="filter-label">🔍 Localizar Ativo</span>
                    <input type="text" id="main-holding-search" value="${searchTerm}"
                        placeholder="Buscar por ticker ou nome..." 
                        style="width: 100%; padding: 8px 12px; font-size: 0.75rem; border-radius: 8px; border: 1px solid var(--border); background: var(--surface-solid); box-shadow: var(--shadow);"
                        onkeyup="renderHoldingsTable()">
                </div>
            </div>
        `;
        holdingsContainer.innerHTML = filtersHtml + '<div id="table-mount"></div>';
    }

    const tableMount = document.getElementById('table-mount');

    // Filtrar dados reais
    const filteredHoldings = cachedHoldingsData.filter(h => {
        const cat = h.years[years[years.length - 1]]?.category || "Ações";
        const catMatch = activeCats.includes('all') || activeCats.includes(cat);
        const searchMatch = !searchTerm || h.ticker.toUpperCase().includes(searchTerm) || (tickersMetadata[h.ticker]?.name || "").toUpperCase().includes(searchTerm);
        return catMatch && searchMatch;
    });

    // Header
    let html = `<div class="table-scroll"><table class="yearly-table" id="main-consolidated-table"><thead><tr class="main-header-row"><th rowspan="2" class="sticky-type" style="border-right: 1px solid var(--border); text-align: center;">TIPO</th><th rowspan="2" class="sticky-col" style="border-right: 1px solid var(--border); text-align: center;">TICKER</th><th rowspan="2" class="sticky-g" style="border-right: 1px solid var(--border); text-align: center;">G.</th><th rowspan="2" class="sticky-c" style="border-right: 1px solid var(--border); text-align: center;">C.</th>` +
        visibleYears.map((y, index) => `<th colspan="3" class="year-header ${index === visibleYears.length - 1 ? '' : 'year-end'}">${y}</th>`).join('') +
        '</tr>';
    html += '<tr class="sub-header-row">' + visibleYears.flatMap((y, index) => [
        `<th class="sub-th">Qtd.</th>`, 
        `<th class="sub-th">Valor</th>`, 
        `<th class="sub-th ${index === visibleYears.length - 1 ? '' : 'year-end'}" style="cursor: pointer; user-select: none;" onclick="toggleAllDeclared('${y}', event)" title="Marcar/Desmarcar todos os ativos visíveis">✓</th>`
    ]).join('') + '</tr></thead><tbody>';

    const yearColTotals = {};
    visibleYears.forEach(y => yearColTotals[y] = 0);

    // Group by category
    const categorized = filteredHoldings.reduce((acc, h) => {
        const cat = h.years[years[years.length - 1]]?.category || "Ações";
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(h);
        return acc;
    }, {});

    const categories = Object.keys(categorized).sort();
    const catTotals = {};

    categories.forEach(category => {
        let items = categorized[category];
        // Sort items so linked tickers are together
        items.sort((a, b) => {
            const infoA = getChainInfo(a.ticker);
            const infoB = getChainInfo(b.ticker);
            if (infoA.root !== infoB.root) return infoA.root.localeCompare(infoB.root);
            return infoA.index - infoB.index;
        });

        catTotals[category] = {};
        visibleYears.forEach(y => catTotals[category][y] = 0);
        const color = catColors[category] || '#6366f1';

        html += `<tr><td rowspan="${items.length + 2}" class="category-sidebar-cell sticky-type"><span>${category}</span></td><td colspan="${3 + (visibleYears.length * 2)}" style="padding: 0!important;border-bottom:none!important"></td></tr>`;

        items.forEach(h => {
            const info = getChainInfo(h.ticker);
            const isLinkedToPrev = info.index > 0;

            html += `<tr class="asset-row">`;
            html += `<td class="sticky-col" style="border-right: 1px solid var(--border);">`;
            if (isLinkedToPrev) {
                html += `<div style="position: absolute; transform: translate(18px, -18px); color: ${color}80; font-size: 18px; font-weight: bold; pointer-events: none;">↓</div>`;
            }
            html += `<span class="ticker-badge" onclick="copyTickerCnpj('${h.ticker}')" title="Clique para copiar o CNPJ" style="background: ${color}15; color: ${color}; border: 1px solid ${color}30; cursor: pointer;">${h.ticker}</span></td>`;

            const meta = getIrMeta(h.ticker, category, tickersMetadata[h.ticker]?.name);
            html += `<td class="sticky-g" style="font-size: 0.65rem; color: var(--text-dim); text-align: center; border-right: 1px solid var(--border);">${meta.g}</td>`;
            html += `<td class="sticky-c" style="font-size: 0.65rem; color: var(--text-dim); text-align: center; border-right: 1px solid var(--border);">${meta.c}</td>`;

            visibleYears.forEach((y, index) => {
                const data = h.years[y] || { quantity: 0, value: 0 };
                yearColTotals[y] += data.value || 0;
                catTotals[category][y] += data.value || 0;
                const isLast = index === visibleYears.length - 1;

                const statusKey = `${h.ticker.toUpperCase()}:${y}`;
                const isDeclared = cachedDeclaredStatus[statusKey];
                const cellClass = isDeclared ? 'declared-cell' : '';

                const qClass = (data.quantity < 0) ? `amount text-danger ${cellClass}` : `amount ${cellClass}`;
                const vClass = (data.value < 0) ? `amount amount-cell text-danger ${cellClass} ${isLast ? '' : 'year-end'}` : `amount amount-cell ${cellClass} ${isLast ? '' : 'year-end'}`;

                const displayQty = (data.quantity && data.quantity !== 0) ? data.quantity.toLocaleString('pt-BR', { maximumFractionDigits: 8 }) : (h.years[y] ? '0' : '-');
                html += `<td class="${qClass}">${displayQty}</td>`;
                html += `<td class="${vClass}">${data.value ? formatCurrencyBRL(data.value) : (h.years[y] ? '0,00' : '-')} `;

                const prevY = (parseInt(y) - 1).toString();
                const hasDataToDeclare = data.quantity > 0 || data.value > 0 || (h.years[prevY] && h.years[prevY].quantity > 0);
                if (h.years[y] && hasDataToDeclare) {
                    html += `<button class="action-icon-btn ir-tiny-btn" onclick="copyIrsDescription('${h.ticker}', '${y}')" title="Copiar IR ${y}">📋</button>`;
                }
                html += `</td>`;
                html += `<td class="sub-th ${isLast ? '' : 'year-end'} ${cellClass}" style="text-align:center">
                            <button class="status-toggle-btn ${isDeclared ? 'active' : ''}" onclick="toggleAssetDeclared('${h.ticker}', '${y}', this)">
                                ${isDeclared ? '✅' : '⬜'}
                            </button>
                         </td>`;
            });
            html += `</tr>`;
        });

        // Subtotal
        html += `<tr class="subtotal-row"><td class="sticky-col subtotal-label" colspan="3" style="border-right: 1px solid var(--border); text-align: right; padding-right: 1rem;">Subtotal</td>`;
        visibleYears.forEach((y, index) => {
            const isLast = index === visibleYears.length - 1;
            html += `<td class="amount"></td><td class="amount amount-cell ${isLast ? '' : 'year-end'}">${formatCurrencyBRL(catTotals[category][y])}</td><td class="sub-th ${isLast ? '' : 'year-end'}"></td>`;
        });
        html += '</tr>';
    });

    // Footer
    html += '<tr class="totals-row"><td class="sticky-type" style="border-right: 1px solid var(--border);"></td><td class="sticky-col" colspan="3" style="border-right: 1px solid var(--border); text-align: right; padding-right: 1rem;">Total Geral</td>';
    visibleYears.forEach((y, index) => {
        const isLast = index === visibleYears.length - 1;
        html += `<td class="amount"></td><td class="amount amount-cell ${isLast ? '' : 'year-end'}">${formatCurrencyBRL(yearColTotals[y])}</td><td class="sub-th ${isLast ? '' : 'year-end'}"></td>`;
    });
    html += '</tr></tbody></table></div>';

    tableMount.innerHTML = html;
    renderSummary(catTotals, yearColTotals, years);
}

async function toggleAllDeclared(year, event) {
    if (!cachedHoldingsData) return;

    const activeCats = Array.from(document.querySelectorAll('.main-cat-filters .filter-btn.active')).map(b => b.dataset.cat);
    const searchTerm = document.getElementById('main-holding-search')?.value.toUpperCase() || '';
    
    const displayedTickers = cachedHoldingsData.filter(h => {
        const cat = h.years[cachedHoldingsYears[cachedHoldingsYears.length - 1]]?.category || "Ações";
        const catMatch = activeCats.includes('all') || activeCats.includes(cat);
        const searchMatch = !searchTerm || h.ticker.toUpperCase().includes(searchTerm) || (cachedHoldingsMetadata[h.ticker]?.name || "").toUpperCase().includes(searchTerm);
        return catMatch && searchMatch;
    }).map(h => h.ticker);

    if (displayedTickers.length === 0) return;

    let allDeclared = true;
    for (const ticker of displayedTickers) {
        const statusKey = `${ticker.toUpperCase()}:${year}`;
        if (!cachedDeclaredStatus[statusKey]) {
            allDeclared = false;
            break;
        }
    }

    const targetStatus = !allDeclared;
    const btnIcon = event ? event.currentTarget : null;
    if (btnIcon) btnIcon.style.opacity = '0.5';

    try {
        const r = await fetch(`${API_URL}/set-declared-status-bulk`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tickers: displayedTickers, year: year, is_declared: targetStatus })
        });
        
        if (r.ok) {
            for (const ticker of displayedTickers) {
                const statusKey = `${ticker.toUpperCase()}:${year}`;
                if (targetStatus) {
                    cachedDeclaredStatus[statusKey] = true;
                } else {
                    delete cachedDeclaredStatus[statusKey];
                }
            }
            renderHoldingsTable();
        } else {
            showToast('Erro ao atualizar no servidor.');
            if (btnIcon) btnIcon.style.opacity = '1';
        }
    } catch (err) {
        console.error(err);
        showToast('Erro de conexão.');
        if (btnIcon) btnIcon.style.opacity = '1';
    }
}

async function toggleAssetDeclared(ticker, year, btn) {
    try {
        const r = await fetch(`${API_URL}/toggle-declared-status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ticker, year })
        });
        const res = await r.json();
        const statusKey = `${ticker.toUpperCase()}:${year}`;
        if (res.is_declared) {
            cachedDeclaredStatus[statusKey] = true;
        } else {
            delete cachedDeclaredStatus[statusKey];
        }
        renderHoldingsTable();
    } catch (err) { console.error(err); showToast('Erro ao salvar status.'); }
}

function toggleMainFilter(btn, type, value) {
    if (value === 'all') {
        btn.parentElement.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    } else {
        btn.classList.toggle('active');
        const allBtn = btn.parentElement.querySelector('.filter-btn[data-cat="all"], .filter-btn[data-year="all"]');
        if (allBtn) allBtn.classList.remove('active');
        if (btn.parentElement.querySelectorAll('.filter-btn.active').length === 0 && allBtn) {
            allBtn.classList.add('active');
        }
    }
    renderHoldingsTable();
}

function getIrMeta(ticker, category, name) {
    const categoryMeta = {
        'Ações': { g: '03', c: '01' },
        'FIIs': { g: '07', c: '03' },
        'BDRs': { g: '04', c: '04' },
        'Cripto': { g: '08', c: getCryptoCode(ticker, name) }
    };
    return categoryMeta[category] || { g: '--', c: '--' };
}

function getCryptoCode(ticker, name) {
    const t = ticker.toUpperCase();
    const n = (name || "").toUpperCase();
    if (t === 'BTC' || n.includes('BITCOIN')) return '01';
    if (['ETH', 'XRP', 'BCH', 'LTC', 'SOL', 'ADA', 'DOT', 'AVAX', 'MATIC', 'LINK', 'UNI'].includes(t) ||
        ['ETHER', 'ETHEREUM', 'RIPPLE', 'LITECOIN', 'SOLANA', 'CARDANO', 'POLKADOT', 'AVALANCHE', 'POLYGON'].some(x => n.includes(x))) return '02';
    if (['USDT', 'USDC', 'BRZ', 'BUSD', 'DAI', 'TUSD', 'GUSD', 'PAX', 'PAXG'].includes(t) ||
        ['TETHER', 'USD COIN', 'BRAZILIAN DIGITAL TOKEN', 'BINANCE USD', 'TRUE USD', 'GEMINI USD', 'PAXOS'].some(x => n.includes(x))) return '03';
    return '99';
}

async function copyIrsDescription(ticker, year) {
    try {
        const [txRes, tkRes, hlRes] = await Promise.all([fetch(`${API_URL}/transactions`), fetch(`${API_URL}/tickers`), fetch(`${API_URL}/yearly-holdings`)]);
        const allTransactions = await txRes.json();
        const tickers = await tkRes.json();
        const yearlyHoldings = await hlRes.json();

        const endDate = `${year}-12-31`;
        const startOfYear = `${year}-01-01`;
        const txs = allTransactions.filter(t => t.ticker === ticker && t.date <= endDate).sort((a, b) => new Date(a.date) - new Date(b.date));
        const info = tickers[ticker] || { name: "[NOME]", cnpj: "[CNPJ]", category: "Ações" };
        const tickerHistory = yearlyHoldings.find(i => i.ticker === ticker);

        if (!tickerHistory || !tickerHistory.years[year]) { showToast(`Sem posicao em ${year}`); return; }

        const h = tickerHistory.years[year];
        const prevYear = (parseInt(year) - 1).toString();
        const prevH = tickerHistory.years[prevYear] || { quantity: 0, value: 0 };

        const avgPrice = h.quantity > 0 ? h.value / h.quantity : 0;
        const category = info.category || 'Ações';
        const razaoSocial = info.razao_social || info.name;

        const buysInYear = txs.filter(t => (t.action === 'Comprar' || t.action === 'Recompensa') && t.date >= startOfYear && t.date <= endDate);
        const salesInYear = txs.filter(t => t.action === 'Vender' && t.date >= startOfYear && t.date <= endDate);
        let saleNote = "";
        if (salesInYear.length > 0) {
            const totalSold = salesInYear.reduce((acc, s) => acc + s.quantity, 0);
            saleNote = h.quantity === 0 ? ` Posição totalmente alienada durante o ano de ${year} (venda total de ${totalSold.toLocaleString('pt-BR')} unidades).` : ` Durante o ano de ${year}, foram alienadas ${totalSold.toLocaleString('pt-BR')} unidades.`;
        }

        const incTx = allTransactions.find(t => t.action === 'Incorporacao' && t.ticker_destino === ticker && t.date <= endDate);
        let incNote = "";
        if (incTx) {
            const incYear = incTx.date.split('-')[0];
            incNote = ` O saldo inicial contempla cotas originadas da incorporação do fundo ${incTx.ticker} ocorrida em ${incYear}`;
            if (buysInYear.length > 0) {
                incNote += ", acrescidas de novas aquisições.";
            } else {
                incNote += ".";
            }
        }

        let descriptionText = '';
        const isCrypto = category === 'Cripto';
        const cryptoCode = isCrypto ? getCryptoCode(ticker, info.name) : '01';
        const cryptoLabels = { '01': 'Bitcoin (BTC)', '02': 'Altcoin', '03': 'Stablecoin', '99': 'Criptoativo' };

        const baseInfo = isCrypto
            ? `custodiados na Nu Crypto Ltda, CNPJ 44.342.498/0001-46.`
            : `custodiadas na corretora Nu Investimentos S.A., CNPJ 62.169.875/0001-79.`;

        const hQtyFormatted = h.quantity.toLocaleString('pt-BR', { maximumFractionDigits: 8 });
        const cnpjText = isCrypto ? "" : `, CNPJ ${info.cnpj || '[CNPJ]'}`;
        const nameText = isCrypto ? "" : `${razaoSocial} `;

        if (h.quantity === 0) {
            // Se o saldo atual é zero, mas o anterior era > 0, então houve alienação total
            let tempQty = prevH.quantity;
            let tempCost = prevH.value;
            let maxCostThisYear = tempCost;
            const thisYearTxs = txs.filter(t => t.date >= startOfYear && t.date <= endDate);
            thisYearTxs.forEach(t => {
                if (t.action === 'Comprar') {
                    tempQty += t.quantity;
                    tempCost += (t.quantity * t.price_per_share) + t.taxes;
                } else if (t.action === 'Desdobramento') {
                    tempQty *= t.quantity;
                } else if (t.action === 'Grupamento') {
                    if (t.quantity > 0) tempQty /= t.quantity;
                }
                if (tempCost > maxCostThisYear) maxCostThisYear = tempCost;
            });

            const totalSold = salesInYear.reduce((acc, s) => acc + s.quantity, 0);
            const totalSoldFormatted = totalSold.toLocaleString('pt-BR', { maximumFractionDigits: 8 });
            const labelPrefix = isCrypto ? `Posição em ${cryptoLabels[cryptoCode]} ` : `Posição em `;

            descriptionText = `${labelPrefix}${nameText}(${ticker})${cnpjText}, ${baseInfo}${incNote}${saleNote} Custo total de aquisição antes da alienação: ${formatCurrencyBRL(maxCostThisYear)}.`;
        } else {
            if (category === 'FIIs') {
                descriptionText = `${hQtyFormatted} cotas do fundo imobiliário ${razaoSocial} (${ticker}), CNPJ ${info.cnpj || '[CNPJ]'}, ${baseInfo}${incNote}${saleNote} Custo total de aquisição: ${formatCurrencyBRL(h.value)}.`;
            } else if (category === 'BDRs') {
                descriptionText = `${hQtyFormatted} BDRs de ${info.name} (${ticker}), CNPJ ${info.cnpj || '[CNPJ]'}, ${baseInfo}${incNote}${saleNote} Custo médio de aquisição: ${formatCurrencyBRL(avgPrice)}.`;
            } else if (isCrypto) {
                const label = cryptoLabels[cryptoCode];
                descriptionText = `${hQtyFormatted} unidades de ${label} (${ticker}), ${baseInfo}${saleNote} Custo total de aquisição: ${formatCurrencyBRL(h.value)}.`;
            } else {
                const hasSplit = txs.some(t => t.action === 'Desdobramento');
                let splitNote = "";
                if (hasSplit) {
                    const splitTxs = txs.filter(t => t.action === 'Desdobramento');
                    const lastSplit = splitTxs[splitTxs.length - 1];
                    splitNote = ` Nota: Em ${formatDateBRL(lastSplit.date)}, ocorreu desdobramento ${lastSplit.quantity}:1.`;
                }
                descriptionText = `${hQtyFormatted} ações de ${info.name} (${ticker}), CNPJ ${info.cnpj || '[CNPJ]'}, ${baseInfo}${saleNote}${splitNote} Custo médio de aquisição: ${formatCurrencyBRL(avgPrice)}.`;
            }
        }

        await navigator.clipboard.writeText(descriptionText);
        showToast(`Discriminação de ${year} copiada!`);
    } catch (err) { console.error(err); showToast('Erro.'); }
}

// Removed duplicate global declarations

/**
 * CORE RENDERING LOGIC
 * Can render to the singleton or cloned modals
 */
async function renderTransactionUI(container, query = "", highlights = []) {
    try {
        if (!container) return;
        const transactionsContainer = container.querySelector('.transactions-display-area');
        if (!transactionsContainer) return;

        // Fetch data
        const [txRes, tkRes] = await Promise.all([fetch(`${API_URL}/transactions`), fetch(`${API_URL}/tickers`)]);
        cachedTransactions = await txRes.json();
        globalTickersMetadata = await tkRes.json();
        const tickersMap = globalTickersMetadata;

        // 3. Pre-calculate global balances chronologically to handle transfers (Incorporacao)
        const globalBalances = {}; // { TICKER: { qty: 0, cost: 0 } }
        [...cachedTransactions].sort((a, b) => {
            const dateDiff = new Date(a.date) - new Date(b.date);
            if (dateDiff !== 0) return dateDiff;
            const priority = { 'Comprar': 1, 'Recompensa': 1, 'Desdobramento': 2, 'Grupamento': 2, 'Incorporacao': 3, 'Vender': 4 };
            return (priority[a.action] || 5) - (priority[b.action] || 5);
        }).forEach(t => {
            const ticker = t.ticker.toUpperCase();
            if (!globalBalances[ticker]) globalBalances[ticker] = { qty: 0, cost: 0 };

            if (t.action === 'Comprar' || t.action === 'Recompensa') {
                globalBalances[ticker].qty += t.quantity;
                globalBalances[ticker].cost += (t.quantity * t.price_per_share) + t.taxes;
            } else if (t.action === 'Vender') {
                if (globalBalances[ticker].qty > 1e-10) {
                    const avg = globalBalances[ticker].cost / globalBalances[ticker].qty;
                    const effectiveSold = Math.min(t.quantity, globalBalances[ticker].qty);
                    globalBalances[ticker].qty -= t.quantity;
                    globalBalances[ticker].cost -= (effectiveSold * avg);
                } else {
                    globalBalances[ticker].qty -= t.quantity;
                }
            } else if (t.action === 'Desdobramento') {
                globalBalances[ticker].qty *= t.quantity;
            } else if (t.action === 'Grupamento') {
                if (t.quantity > 0) globalBalances[ticker].qty /= t.quantity;
            } else if (t.action === 'Incorporacao') {
                const dest = (t.ticker_destino || "").toUpperCase();
                const fator = t.fator_conversao || 1.0;
                if (dest) {
                    if (!globalBalances[dest]) globalBalances[dest] = { qty: 0, cost: 0 };
                    const newQtyTotal = globalBalances[ticker].qty * fator;
                    // Removido Math.floor para suportar frações (cripto)
                    globalBalances[dest].qty += newQtyTotal;
                    globalBalances[dest].cost += globalBalances[ticker].cost;
                    globalBalances[ticker].qty = 0;
                    globalBalances[ticker].cost = 0;
                }
            }

            // Limpeza de resíduos de ponto flutuante
            if (Math.abs(globalBalances[ticker].qty) < 1e-10) {
                globalBalances[ticker].qty = 0;
                globalBalances[ticker].cost = 0;
            }
        });

        // 1. Filter
        let filtered = cachedTransactions;
        if (query && query.trim()) {
            const parts = query.toUpperCase().split(/\s+/).filter(p => p.trim().length > 0);
            filtered = cachedTransactions.filter(t => {
                if (!t || !t.ticker) return false;
                const tick = t.ticker.toUpperCase();
                const date = (t.date || "").toUpperCase();
                const dateBRL = formatDateBRL(date).toUpperCase();

                return parts.every(p =>
                    tick.includes(p) ||
                    date.includes(p) ||
                    dateBRL.includes(p)
                );
            });
        }

        if (!filtered.length) {
            if (query) showToast(`Nenhum registro para "${query}"`);
            transactionsContainer.innerHTML = '<p class="empty-state">Nenhuma transação encontrada.</p>';
            return;
        }

        // 1. Identify Ticker Links (chains) for unification
        const forwardLinks = {};
        cachedTransactions.filter(tx => tx.action === 'Incorporacao').forEach(tx => {
            if (tx.ticker && tx.ticker_destino) forwardLinks[tx.ticker.toUpperCase()] = tx.ticker_destino.toUpperCase();
        });

        const getUltimateInfo = (t) => {
            let current = t.toUpperCase();
            let chain = [current];
            while (forwardLinks[current]) {
                current = forwardLinks[current];
                if (chain.includes(current)) break;
                chain.push(current);
            }
            return { ultimate: current, chain: chain.join(' → ') };
        };

        const groupMeta = {}; // ultimate -> { longestChain: string }
        new Set(cachedTransactions.map(tx => tx.ticker.toUpperCase())).forEach(t => {
            const { ultimate, chain } = getUltimateInfo(t);
            if (!groupMeta[ultimate] || chain.length > groupMeta[ultimate].longestChain.length) {
                groupMeta[ultimate] = { longestChain: chain };
            }
        });

        // 2. Group
        const groupedByUltimate = {};
        const catGroups = filtered.reduce((acc, t) => {
            const { ultimate } = getUltimateInfo(t.ticker);
            const cat = tickersMap[ultimate]?.category || tickersMap[t.ticker]?.category || 'Outros';

            if (!acc[cat]) acc[cat] = {};
            if (!acc[cat][ultimate]) acc[cat][ultimate] = [];
            acc[cat][ultimate].push(t);

            if (!groupedByUltimate[ultimate]) groupedByUltimate[ultimate] = [];
            groupedByUltimate[ultimate].push(t);

            return acc;
        }, {});

        let html = '';
        Object.keys(catGroups).sort().forEach(cat => {
            html += `<h3 style="margin: 1.5rem 0 0.5rem 0.5rem; color: var(--primary); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.1em;">📁 ${cat}</h3>`;
            html += '<table class="grouped-table" style="margin-left: 0;"><thead><tr><th width="30"></th><th>Ticker</th><th>Operações</th><th>Qtd. Atual</th><th>Preço Médio</th><th>Última Data</th></tr></thead><tbody>';

            const tickers = catGroups[cat];
            Object.keys(tickers).sort().forEach(ultimateTicker => {
                const txs = tickers[ultimateTicker].sort((a, b) => new Date(b.date) - new Date(a.date));
                const lastOp = txs[0].date;
                const years = Array.from(new Set(txs.map(t => t.date.split('-')[0]))).sort().reverse();

                const currentBalance = globalBalances[ultimateTicker] || { qty: 0, cost: 0 };
                const displayLabel = groupMeta[ultimateTicker]?.longestChain || ultimateTicker;

                // Previously, we built all rows here. Now we only build headers for performance.
                // tableRowsHtml will be built on demand.

                html += `<tr class="group-header" onclick="toggleGroup(this)" data-ticker="${ultimateTicker}">
                            <td><span class="chevron">▶</span></td>
                            <td><span class="ticker-badge">${displayLabel}</span></td>
                            <td style="font-size: 0.65rem; opacity: 0.7;">${txs.length} txs</td>
                            <td class="amount" style="font-weight: 600;">${currentBalance.qty.toLocaleString('pt-BR', { maximumFractionDigits: 8 })}</td>
                            <td class="amount" style="color: var(--primary); font-weight: 600;">${formatCurrencyBRL(currentBalance.qty > 0 ? currentBalance.cost : 0)}</td>
                            <td style="font-size: 0.65rem; opacity: 0.7;">${formatDateBRL(lastOp)}</td>
                         </tr>
                         <tr class="details-row" id="details-${ultimateTicker.replace(/\./g, '_')}">
                            <td colspan="6" class="lazy-load-placeholder">
                                <div style="padding: 2rem; text-align: center; color: var(--text-dim);">
                                    <span class="loading-spinner"></span> Carregando histórico de ${ultimateTicker}...
                                </div>
                            </td>
                         </tr>`;
            });
            html += '</tbody></table>';
        });

        globalGroupedTransactions = groupedByUltimate;
        transactionsContainer.innerHTML = html;

        // 4. Auto-expand highlights
        const headers = transactionsContainer.querySelectorAll('.group-header');
        headers.forEach(h => {
            const ticker = h.dataset.ticker;
            const txs = groupedByUltimate[ticker] || [];
            const hasHighlight = highlights && txs.some(t => highlights.includes(t.id));

            if (hasHighlight) {
                toggleGroup(h);
            }
        });

        filterTransactions();

    } catch (err) {
        console.error('RenderTransactionUI failed', err);
    }
}

/**
 * SINGLETON WRAPPER
 */
async function loadTransactions() {
    try {
        const searchInput = document.getElementById('transactionSearch');
        const query = searchInput ? searchInput.value : "";
        const tab = document.getElementById('tab-transacoes');
        if (!tab) return;

        await renderTransactionUI(tab, query, highlightIds);
    } catch (err) {
        alert("Erro ao carregar transações: " + err.message);
        console.error(err);
    }
}

/**
 * SALES & DARF REPORT LOGIC
 */
async function loadSalesReport() {
    const container = document.getElementById('sales-report-container');
    if (!container) return;

    try {
        const [txRes, tkRes] = await Promise.all([
            fetch(`${API_URL}/transactions`),
            fetch(`${API_URL}/tickers`)
        ]);
        const transactions = await txRes.json();
        const tickersMap = await tkRes.json();

        // 1. Sort transactions: Date first, then Action Priority
        // Priority: Comprar (1), Desdobramento (2), Grupamento (2), Vender (3)
        const sortedTxs = [...transactions].sort((a, b) => {
            const dateDiff = new Date(a.date) - new Date(b.date);
            if (dateDiff !== 0) return dateDiff;

            const priority = { 'Comprar': 1, 'Desdobramento': 2, 'Grupamento': 2, 'Vender': 3 };
            const pA = priority[a.action] || 4;
            const pB = priority[b.action] || 4;
            return pA - pB;
        });

        // 2. State trackers
        const holdings = {}; // { ticker: { qty: 0, totalCost: 0 } }
        const sales = [];    // Array of sale results

        sortedTxs.forEach(t => {
            if (!holdings[t.ticker]) holdings[t.ticker] = { qty: 0, totalCost: 0 };
            const h = holdings[t.ticker];

            if (t.action === 'Comprar') {
                h.qty += t.quantity;
                h.totalCost += (t.quantity * t.price_per_share) + t.taxes;
            } else if (t.action === 'Vender') {
                if (h.qty > 0) {
                    const avgPrice = h.totalCost / h.qty;

                    // Se tentar vender mais do que tem, limita ao estoque atual para o cálculo de custo
                    // Isso evita inflar prejuízos por falta de dados históricos
                    const effectiveSoldQty = Math.min(t.quantity, h.qty);
                    const saleCost = effectiveSoldQty * avgPrice;
                    const saleRevenue = t.quantity * t.price_per_share;
                    const profit = saleRevenue - saleCost - t.taxes;

                    sales.push({
                        ...t,
                        avgPriceAtSale: avgPrice,
                        profit: profit,
                        category: tickersMap[t.ticker]?.category || 'Ações'
                    });

                    // Update holdings
                    h.qty -= t.quantity;
                    h.totalCost -= saleCost;

                    // Safety reset
                    if (h.qty <= 0) {
                        h.qty = 0;
                        h.totalCost = 0;
                    }
                }
            } else if (t.action === 'Desdobramento') {
                h.qty *= t.quantity;
            } else if (t.action === 'Grupamento') {
                if (t.quantity > 0) h.qty /= t.quantity;
            } else if (t.action === 'Incorporacao') {
                const tickerDest = (t.ticker_destino || "").toUpperCase();
                const fator = t.fator_conversao || 1.0;

                if (tickerDest && h.qty > 0) {
                    const currentQtyOrig = h.qty;
                    const currentCostOrig = h.totalCost;
                    const avgPriceOrig = currentCostOrig / currentQtyOrig;

                    const newQtyTotal = currentQtyOrig * fator;
                    const qtyDestInt = Math.floor(newQtyTotal);
                    const fraction = newQtyTotal - qtyDestInt;

                    // 1. Prepare Destination Holding
                    if (!holdings[tickerDest]) holdings[tickerDest] = { qty: 0, totalCost: 0 };

                    // 2. Transfer 100% cost to Destination Integer Part (as requested)
                    holdings[tickerDest].qty += qtyDestInt;
                    holdings[tickerDest].totalCost += currentCostOrig;

                    // 3. Record internal sale for fraction
                    if (fraction > 0) {
                        // Proportional cost for the fraction
                        const fractionInOrigTerms = fraction / fator;
                        const fractionCost = fractionInOrigTerms * avgPriceOrig;

                        sales.push({
                            ...t,
                            ticker: t.ticker, // Mostra o de origem na venda da fração
                            action: 'Venda de Frações (Inc.)',
                            quantity: fraction,
                            price_per_share: 0, // Preço será zero até que o provento caia
                            avgPriceAtSale: avgPriceOrig / fator,
                            profit: -fractionCost, // Prejuízo inicial que será compensado pelo valor recebido
                            category: tickersMap[t.ticker]?.category || 'Ações'
                        });
                    }

                    // 4. Zero Origin
                    h.qty = 0;
                    h.totalCost = 0;
                }
            }
        });

        if (sales.length === 0) {
            container.innerHTML = '<p class="empty-state">Nenhuma venda registrada no histórico.</p>';
            return;
        }

        // 3. Day Trade Detection: buy + sell of same ticker on same date
        const dayBuys = {};
        sortedTxs.forEach(t => {
            if (t.action === 'Comprar' || t.action === 'Recompensa') {
                const k = `${t.date}|${t.ticker}`;
                dayBuys[k] = (dayBuys[k] || 0) + t.quantity;
            }
        });
        sales.forEach(s => {
            const k = `${s.date}|${s.ticker}`;
            if (dayBuys[k] && dayBuys[k] > 0) {
                s.isDayTrade = true;
                dayBuys[k] -= s.quantity;
            } else {
                s.isDayTrade = false;
            }
        });

        // 4. Group by Month/Year, Category, and Day Trade
        const monthlySummary = {};
        sales.forEach(s => {
            const date = new Date(s.date + 'T00:00:00');
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            if (!monthlySummary[key]) monthlySummary[key] = {
                swingAcoes: 0, swingBDRs: 0, swingFIIs: 0, cripto: 0,
                dayTradeAcoes: 0, dayTradeBDRs: 0, dayTradeFIIs: 0,
                totalVendasSwingAcoes: 0, totalVendasBDRs: 0, totalVendasFIIs: 0,
                totalVendasCripto: 0, totalVendasDayTrade: 0,
                details: []
            };
            const m = monthlySummary[key];
            const cat = String(s.category);
            const isDT = s.isDayTrade;
            const saleVolume = (s.quantity * s.price_per_share);

            if (isDT) {
                m.totalVendasDayTrade += saleVolume;
                if (cat.includes('FII')) m.dayTradeFIIs += s.profit;
                else if (cat.includes('BDR')) m.dayTradeBDRs += s.profit;
                else m.dayTradeAcoes += s.profit;
            } else {
                if (cat.includes('Cripto')) {
                    m.cripto += s.profit;
                    m.totalVendasCripto += saleVolume;
                } else if (cat.includes('FII')) {
                    m.swingFIIs += s.profit;
                    m.totalVendasFIIs += saleVolume;
                } else if (cat.includes('BDR')) {
                    m.swingBDRs += s.profit;
                    m.totalVendasBDRs += saleVolume;
                } else {
                    m.swingAcoes += s.profit;
                    m.totalVendasSwingAcoes += saleVolume;
                }
            }
            m.details.push(s);
        });

        // 5. Loss Carry-Forward — process months chronologically
        // RF segregation: swing (ações+BDRs), FIIs, dayTrade, cripto — each separate pool
        const accLoss = { swing: 0, fiis: 0, dayTrade: 0, cripto: 0 };
        const chronoKeys = Object.keys(monthlySummary).sort();

        chronoKeys.forEach(monthKey => {
            const d = monthlySummary[monthKey];

            // Combine swing trade pools (ações + BDRs share one loss pool per RF rules)
            const swingProfit = d.swingAcoes + d.swingBDRs;
            const dtProfit = d.dayTradeAcoes + d.dayTradeBDRs + d.dayTradeFIIs;
            const fiiProfit = d.swingFIIs;
            const cryptoProfit = d.cripto;

            // Apply carry-forward: offset accumulated losses from prior months
            const applyCarry = (profit, pool) => {
                const net = profit + accLoss[pool]; // accLoss is negative
                if (net < 0) {
                    accLoss[pool] = net; // Still in loss
                    return 0;
                } else {
                    accLoss[pool] = 0; // Loss fully consumed
                    return net;
                }
            };

            // Isenções (only for swing trade ações when total sales <= R$20k)
            const isSwingAcoesExempt = d.totalVendasSwingAcoes <= 20000;
            const isCriptoExempt = d.totalVendasCripto <= 35000;

            // Swing trade: if exempt, losses don't accumulate and no tax
            let swingTaxable;
            if (isSwingAcoesExempt && d.swingBDRs === 0) {
                // Pure ações below 20k: exempt, but losses don't add to pool
                swingTaxable = 0;
            } else {
                // Either above 20k or has BDR profits: apply carry-forward
                if (swingProfit < 0) {
                    accLoss.swing += swingProfit;
                    swingTaxable = 0;
                } else {
                    swingTaxable = applyCarry(swingProfit, 'swing');
                }
            }

            // FII: no exemption
            let fiiTaxable;
            if (fiiProfit < 0) { accLoss.fiis += fiiProfit; fiiTaxable = 0; }
            else { fiiTaxable = applyCarry(fiiProfit, 'fiis'); }

            // Day Trade: no exemption
            let dtTaxable;
            if (dtProfit < 0) { accLoss.dayTrade += dtProfit; dtTaxable = 0; }
            else { dtTaxable = applyCarry(dtProfit, 'dayTrade'); }

            // Cripto: exempt if total sales <= 35k
            let cryptoTaxable;
            if (isCriptoExempt) {
                cryptoTaxable = 0;
            } else {
                if (cryptoProfit < 0) { accLoss.cripto += cryptoProfit; cryptoTaxable = 0; }
                else { cryptoTaxable = applyCarry(cryptoProfit, 'cripto'); }
            }

            // Store computed values for rendering
            d._swingProfit = swingProfit;
            d._fiiProfit = fiiProfit;
            d._dtProfit = dtProfit;
            d._cryptoProfit = cryptoProfit;
            d._swingTaxable = swingTaxable;
            d._fiiTaxable = fiiTaxable;
            d._dtTaxable = dtTaxable;
            d._cryptoTaxable = cryptoTaxable;
            d._swingTax = swingTaxable > 0 ? swingTaxable * 0.15 : 0;
            d._fiiTax = fiiTaxable > 0 ? fiiTaxable * 0.20 : 0;
            d._dtTax = dtTaxable > 0 ? dtTaxable * 0.20 : 0;
            d._cryptoTax = cryptoTaxable > 0 ? cryptoTaxable * 0.15 : 0;
            d._totalDarf = d._swingTax + d._fiiTax + d._dtTax + d._cryptoTax;
            d._isSwingExempt = isSwingAcoesExempt && d.swingBDRs === 0;
            d._isCryptoExempt = isCriptoExempt;
            d._accLossSnapshot = { ...accLoss }; // snapshot for display
        });

        // 6. Render HTML (reverse chronological for display)
        let html = '';
        const sortedKeys = chronoKeys.slice().reverse();

        sortedKeys.forEach(monthKey => {
            const data = monthlySummary[monthKey];
            const [year, month] = monthKey.split('-');
            const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
            const hasDT = data._dtProfit !== 0;
            const lossInfo = data._accLossSnapshot;
            const hasAccLoss = lossInfo.swing < 0 || lossInfo.fiis < 0 || lossInfo.dayTrade < 0 || lossInfo.cripto < 0;

            html += `
                <div class="month-report-card" style="margin-bottom: 2rem; border-left: 4px solid var(--primary); padding-left: 1rem;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem;">
                        <div>
                            <h4 style="font-size: 1.1rem; color: var(--text);">${monthNames[parseInt(month) - 1]} de ${year}</h4>
                            <span style="font-size: 0.7rem; color: var(--text-dim);">Resumo de operações realizadas no mês</span>
                        </div>
                        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                            <span class="badge-info" style="background: ${data._isSwingExempt ? 'var(--success)20' : 'var(--danger)20'}; color: ${data._isSwingExempt ? 'var(--success)' : 'var(--danger)'}; padding: 4px 10px; border-radius: 20px;">
                                Vendas Ações: ${formatCurrencyBRL(data.totalVendasSwingAcoes)} (${data._isSwingExempt ? 'Isento' : 'Tributável'})
                            </span>
                            ${hasDT ? '<span class="badge-info" style="background: var(--danger)20; color: var(--danger); padding: 4px 10px; border-radius: 20px;">⚡ Day Trade detectado</span>' : ''}
                        </div>
                    </div>

                    <div class="summary-card-grid" style="margin-bottom: 1rem;">
                        <div class="summary-card" style="padding: 0.75rem;">
                            <div class="summary-card-label">Swing Trade (15%)</div>
                            <div class="summary-card-value ${data._swingProfit >= 0 ? 'success' : 'danger'}" style="font-size: 1.1rem;">${formatCurrencyBRL(data._swingProfit)}</div>
                            <div style="font-size: 0.6rem; opacity: 0.7; margin-bottom: 4px;">↕ ${formatCurrencyBRL(data.totalVendasSwingAcoes + data.totalVendasBDRs)} Movimentado</div>
                            <div class="summary-card-secondary">${data._isSwingExempt ? 'Isento (< 20k)' : (data._swingTaxable !== data._swingProfit && data._swingProfit > 0 ? `Base: ${formatCurrencyBRL(data._swingTaxable)} → DARF: ${formatCurrencyBRL(data._swingTax)}` : `DARF: ${formatCurrencyBRL(data._swingTax)}`)}</div>
                        </div>
                        ${hasDT ? `<div class="summary-card" style="padding: 0.75rem; border-left-color: var(--danger);">
                            <div class="summary-card-label">⚡ Day Trade (20%)</div>
                            <div class="summary-card-value ${data._dtProfit >= 0 ? 'success' : 'danger'}" style="font-size: 1.1rem;">${formatCurrencyBRL(data._dtProfit)}</div>
                            <div style="font-size: 0.6rem; opacity: 0.7; margin-bottom: 4px;">↕ ${formatCurrencyBRL(data.totalVendasDayTrade)} Movimentado</div>
                            <div class="summary-card-secondary">${data._dtTaxable !== data._dtProfit && data._dtProfit > 0 ? `Base: ${formatCurrencyBRL(data._dtTaxable)} → DARF: ${formatCurrencyBRL(data._dtTax)}` : `DARF: ${formatCurrencyBRL(data._dtTax)}`}</div>
                        </div>` : ''}
                        <div class="summary-card" style="padding: 0.75rem;">
                            <div class="summary-card-label">FIIs (20%)</div>
                            <div class="summary-card-value ${data._fiiProfit >= 0 ? 'success' : 'danger'}" style="font-size: 1.1rem;">${formatCurrencyBRL(data._fiiProfit)}</div>
                            <div style="font-size: 0.6rem; opacity: 0.7; margin-bottom: 4px;">↕ ${formatCurrencyBRL(data.totalVendasFIIs)} Movimentado</div>
                            <div class="summary-card-secondary">${data._fiiTaxable !== data._fiiProfit && data._fiiProfit > 0 ? `Base: ${formatCurrencyBRL(data._fiiTaxable)} → DARF: ${formatCurrencyBRL(data._fiiTax)}` : `DARF: ${formatCurrencyBRL(data._fiiTax)}`}</div>
                        </div>
                        <div class="summary-card" style="padding: 0.75rem;">
                            <div class="summary-card-label">Cripto (15%)</div>
                            <div class="summary-card-value ${data._cryptoProfit >= 0 ? 'success' : 'danger'}" style="font-size: 1.1rem;">${formatCurrencyBRL(data._cryptoProfit)}</div>
                            <div style="font-size: 0.6rem; opacity: 0.7; margin-bottom: 4px;">↕ ${formatCurrencyBRL(data.totalVendasCripto)} Movimentado</div>
                            <div class="summary-card-secondary">${data._isCryptoExempt ? 'Isento (< 35k)' : (data._cryptoTaxable !== data._cryptoProfit && data._cryptoProfit > 0 ? `Base: ${formatCurrencyBRL(data._cryptoTaxable)} → DARF: ${formatCurrencyBRL(data._cryptoTax)}` : `DARF: ${formatCurrencyBRL(data._cryptoTax)}`)}</div>
                        </div>
                        <div class="summary-card" style="padding: 0.75rem; background: var(--primary-glow); border-color: var(--primary);">
                            <div class="summary-card-label" style="color: var(--primary)">Total DARF</div>
                            <div class="summary-card-value" style="font-size: 1.1rem; color: var(--primary)">${formatCurrencyBRL(data._totalDarf)}</div>
                            <div class="summary-card-secondary">Vencimento: último dia útil de ${monthNames[parseInt(month) % 12]}/${parseInt(month) === 12 ? parseInt(year) + 1 : year}</div>
                        </div>
                    </div>

                    ${hasAccLoss ? `<div style="padding: 0.5rem 0.75rem; background: var(--surface); border-radius: var(--radius); border: 1px solid var(--border); margin-bottom: 1rem; font-size: 0.65rem;">
                        <span style="font-weight: 700; color: var(--text-dim); text-transform: uppercase; font-size: 0.55rem; letter-spacing: 0.05em;">📉 Prejuízo acumulado após este mês:</span>
                        <div style="display: flex; gap: 1rem; margin-top: 0.3rem; flex-wrap: wrap;">
                            ${lossInfo.swing < 0 ? `<span class="danger">Swing: ${formatCurrencyBRL(lossInfo.swing)}</span>` : ''}
                            ${lossInfo.fiis < 0 ? `<span class="danger">FIIs: ${formatCurrencyBRL(lossInfo.fiis)}</span>` : ''}
                            ${lossInfo.dayTrade < 0 ? `<span class="danger">Day Trade: ${formatCurrencyBRL(lossInfo.dayTrade)}</span>` : ''}
                            ${lossInfo.cripto < 0 ? `<span class="danger">Cripto: ${formatCurrencyBRL(lossInfo.cripto)}</span>` : ''}
                        </div>
                    </div>` : ''}

                    <table class="details-table" style="font-size: 0.65rem;">
                        <thead>
                            <tr>
                                <th>Data</th>
                                <th>Ativo</th>
                                <th>Tipo</th>
                                <th>Quant.</th>
                                <th>Preço Médio</th>
                                <th>Preço Venda</th>
                                <th style="text-align: right;">Resultado Líquido</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.details.map(s => `
                                <tr>
                                    <td>${formatDateBRL(s.date)}</td>
                                    <td><span class="ticker-badge" style="font-size: 0.6rem;">${s.ticker}</span> <span style="font-size: 0.5rem; opacity: 0.7;">${s.category}</span></td>
                                    <td><span style="font-size: 0.55rem; padding: 1px 5px; border-radius: 3px; background: ${s.isDayTrade ? 'var(--danger)20' : 'var(--primary-glow)'}; color: ${s.isDayTrade ? 'var(--danger)' : 'var(--text-dim)'}; font-weight: 600;">${s.isDayTrade ? 'DT' : 'ST'}</span></td>
                                    <td class="amount">${typeof s.quantity === 'number' ? s.quantity.toLocaleString('pt-BR', { maximumFractionDigits: 8 }) : s.quantity}</td>
                                    <td class="amount">${formatCurrencyBRL(s.avgPriceAtSale)}</td>
                                    <td class="amount">${formatCurrencyBRL(s.price_per_share)}</td>
                                    <td class="amount ${s.profit >= 0 ? 'success' : 'danger'}" style="text-align: right;">${formatCurrencyBRL(s.profit)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        });

        container.innerHTML = html;

    } catch (err) {
        console.error('loadSalesReport failed', err);
        container.innerHTML = '<p class="empty-state text-danger">Erro ao calcular ganhos e perdas.</p>';
    }
}

/**
 * Navigates to the Transactions Tab and filters/highlights specific records
 */
function viewInHistory(ticker, ids = [], dateSource = "") {
    try {
        // 1. Set global highlights
        highlightIds = (typeof ids === 'string') ? [ids] : (ids || []);

        // 2. Set the search query
        const query = ticker + (dateSource ? " " + dateSource : "");
        const searchInput = document.getElementById('transactionSearch');
        if (searchInput) {
            searchInput.value = query;
        }

        // 3. Switch tab (this triggers loadTransactions via the switcher logic)
        switchTab('tab-transacoes');

        // 4. Close modal
        closeModal('modal-notifications');
    } catch (err) {
        alert("Erro na navegação: " + err.message);
    }
}

function toggleGroup(btn) {
    const header = btn.classList.contains('group-header') ? btn : btn.closest('.group-header');
    if (!header) return;

    const ticker = header.dataset.ticker;
    const nextRow = header.nextElementSibling;
    const chevron = header.querySelector('.chevron');

    if (nextRow && nextRow.classList.contains('details-row')) {
        const isExpanding = nextRow.style.display === 'none';

        if (isExpanding) {
            // Lazy Build if placeholder is present
            if (nextRow.querySelector('.lazy-load-placeholder')) {
                buildGroupDetails(ticker, nextRow);
            }
            nextRow.style.display = 'table-row';
            header.classList.add('expanded');
            if (chevron) chevron.innerText = '▼';
        } else {
            nextRow.style.display = 'none';
            header.classList.remove('expanded');
            if (chevron) chevron.innerText = '▶';
        }
    }
}

/**
 * Builds the transaction UI for a specific ticker group on the fly
 */
function buildGroupDetails(ticker, containerRow) {
    const txs = globalGroupedTransactions[ticker] || [];
    const years = [...new Set(txs.map(t => t.date.split('-')[0]))].sort().reverse();

    // Sort transactions for PM calculation
    const sorted = [...txs].sort((a, b) => new Date(a.date) - new Date(b.date));

    // Initial content with Filters + Search + Table
    containerRow.innerHTML = `
        <td colspan="6">
            <div class="details-scroll-container">
                <div class="details-header-row">
                    <div class="details-filters">
                        <div class="filter-group">
                            <span class="filter-label">📅 Anos</span>
                            <div class="btns-filters years">
                                <button class="filter-btn active" data-year="all" onclick="filterDetails(this, 'year', 'all')">Todos</button> 
                                ${years.map(y => `<button class="filter-btn" data-year="${y}" onclick="filterDetails(this, 'year', '${y}')">${y}</button>`).join('')}
                            </div>
                        </div>
                        <div class="filter-group">
                            <span class="filter-label">⚡ Operação</span>
                            <div class="btns-filters actions">
                                <button class="filter-btn active" data-action="all" onclick="filterDetails(this, 'action', 'all')">Todas</button>
                                <button class="filter-btn" data-action="Comprar" onclick="filterDetails(this, 'action', 'Comprar')">Compra</button>
                                <button class="filter-btn" data-action="Vender" onclick="filterDetails(this, 'action', 'Vender')">Venda</button>
                                <button class="filter-btn" data-action="Recompensa" onclick="filterDetails(this, 'action', 'Recompensa')">Bônus</button>
                            </div>
                        </div>
                    </div>
                    
                    <div class="internal-search" style="flex: 1; min-width: 250px;">
                        <span class="filter-label">🔍 Pesquisa Rápida</span>
                        <input type="text" class="internal-filter-input" 
                            placeholder="Buscar no histórico de ${ticker}..." 
                            style="width: 100%; padding: 8px 12px; font-size: 0.75rem; border-radius: 8px; border: 1px solid var(--border); background: var(--surface-solid); box-shadow: var(--shadow);"
                            onkeyup="filterDetails(this, 'search', this.value)">
                    </div>
                </div>

                <table class="details-table" data-ticker="${ticker}">
                    <thead>
                        <tr>
                            <th style="display:none;">RawDate</th>
                            <th onclick="handleSort(this, 'date')" style="cursor:pointer">Data ↕</th>
                            <th onclick="handleSort(this, 'action')" style="cursor:pointer">Ação ↕</th>
                            <th onclick="handleSort(this, 'quantity')" style="cursor:pointer">Quant. ↕</th>
                            <th onclick="handleSort(this, 'price')" style="cursor:pointer">Preço ↕</th>
                            <th onclick="handleSort(this, 'taxes')" style="cursor:pointer">Taxas ↕</th>
                            <th>PM</th>
                            <th width="50"></th>
                        </tr>
                    </thead>
                    <tbody>
                        ${renderDetailRows(sorted)}
                    </tbody>
                    <tfoot>
                        <tr class="filter-total-row">
                            <td colspan="2" style="font-size: 0.65rem; font-weight: 800; color: var(--primary);">TOTAL FILTRADO</td>
                            <td class="amount filter-total-qty" style="font-weight: 800; color: var(--primary); font-size: 0.8rem;">0</td>
                            <td colspan="2" class="amount filter-total-cost" style="color:var(--primary); font-weight: 800; font-size: 0.8rem;">R$ 0,00</td>
                            <td colspan="2"></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </td>`;

    // Initial total calculation
    filterDetails(containerRow.querySelector('.filter-btn'), 'init', '');
}

/**
 * Helper to render only the TRs for the details table
 */
function renderDetailRows(txs) {
    let runningQty = 0;
    let runningCost = 0;

    return txs.map(t => {
        const qty = t.quantity;
        const price = t.price_per_share;
        const taxes = t.taxes || 0;
        const act = t.action.toLowerCase();

        if (act === 'comprar' || act === 'recompensa') {
            runningQty += qty;
            runningCost += (qty * price) + taxes;
        } else if (act === 'vender') {
            const avg = runningQty > 0 ? runningCost / runningQty : 0;
            runningQty -= qty;
            // Se a quantidade ficou zerada (dentro da tolerância), zeramos o custo
            if (runningQty <= 1e-10) {
                runningQty = 0;
                runningCost = 0;
            } else {
                runningCost = runningQty * avg;
            }
        } else if (act === 'desdobramento') {
            runningQty *= qty;
        } else if (act === 'grupamento') {
            if (qty > 0) runningQty /= qty;
        }

        const currentAvg = runningQty > 0 ? runningCost / runningQty : 0;
        const c = (act === 'comprar' || act === 'recompensa') ? 'success' : act === 'vender' ? 'danger' : 'text-dim';
        const highlightStyle = highlightIds.includes(t.id) ? 'style="background: rgba(217, 119, 6, 0.15); border-left: 4px solid #d97706; font-weight: 600;"' : '';

        let args = `'${t.id}', '${t.ticker}', '${t.action}', ${t.quantity}, ${t.price_per_share}, ${t.taxes}, '${t.date}'`;
        if (t.action === 'Troca' || t.action === 'Incorporacao') {
            args += `, '${t.ticker_destino || ''}', ${t.fator_conversao || 0}`;
        }

        return `
            <tr data-year="${t.date.split('-')[0]}" data-action="${t.action}" ${highlightStyle}>
                <td style="display:none;">${t.date}</td>
                <td>${formatDateBRL(t.date)}</td>
                <td><span class="${c}">${t.action}</span></td>
                <td class="amount">${qty.toLocaleString('pt-BR', { maximumFractionDigits: 8 })}</td>
                <td class="amount">${formatCurrencyBRL(price)}</td>
                <td class="amount">${formatCurrencyBRL(taxes)}</td>
                <td class="amount">${formatCurrencyBRL(currentAvg)}</td>
                <td>
                    <div style="display:flex; gap:4px;">
                        <button class="action-icon-btn" onclick="prepareEdit(${args})" title="Editar">✏️</button>
                        <button class="action-icon-btn delete-btn" onclick="deleteTransaction('${t.id}')" title="Excluir">🗑️</button>
                    </div>
                </td>
            </tr>`;
    }).join('');
}

/**
 * Handles sorting when a header is clicked
 */
function handleSort(th, col) {
    const table = th.closest('.details-table');
    const ticker = table.dataset.ticker;
    const container = table.closest('.details-scroll-container');
    const tbody = table.querySelector('tbody');

    // Toggle sort state
    if (!globalSortState[ticker]) globalSortState[ticker] = { col: 'date', dir: 'asc' };

    if (globalSortState[ticker].col === col) {
        globalSortState[ticker].dir = globalSortState[ticker].dir === 'asc' ? 'desc' : 'asc';
    } else {
        globalSortState[ticker].col = col;
        globalSortState[ticker].dir = 'asc';
    }

    const dir = globalSortState[ticker].dir;

    // Sort transactions
    const txs = [...(globalGroupedTransactions[ticker] || [])];
    txs.sort((a, b) => {
        let valA, valB;
        switch (col) {
            case 'date': valA = a.date; valB = b.date; break;
            case 'action': valA = a.action; valB = b.action; break;
            case 'quantity': valA = a.quantity; valB = b.quantity; break;
            case 'price': valA = a.price_per_share; valB = b.price_per_share; break;
            case 'taxes': valA = a.taxes || 0; valB = b.taxes || 0; break;
            default: valA = a.date; valB = b.date;
        }

        if (valA < valB) return dir === 'asc' ? -1 : 1;
        if (valA > valB) return dir === 'asc' ? 1 : -1;
        return 0;
    });

    // Update headers UI
    table.querySelectorAll('th').forEach(header => {
        const text = header.innerText.replace(/[↕↑↓]/g, '').trim();
        if (header === th) {
            header.innerText = `${text} ${dir === 'asc' ? '↑' : '↓'}`;
        } else if (header.innerText.includes('↕') || header.innerText.includes('↑') || header.innerText.includes('↓')) {
            header.innerText = `${text} ↕`;
        }
    });

    // Re-render rows
    tbody.innerHTML = renderDetailRows(txs);

    // Re-apply current filters
    filterDetails(container.querySelector('.filter-btn'), 'init', '');
}

function filterDetails(btn, type, value) {
    const container = btn.closest('.details-scroll-container');
    const tickerHeader = container.closest('tr').previousElementSibling;
    const ticker = tickerHeader.dataset.ticker;

    // Update active state with Multi-Select logic
    if (type !== 'search' && type !== 'init') {
        const filterGroup = btn.parentElement;
        if (value === 'all') {
            // Se clicou em "Todos", desmarca os outros
            filterGroup.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        } else {
            // Se clicou em um específico, alterna ele e desmarca o "Todos"
            btn.classList.toggle('active');
            const allBtn = filterGroup.querySelector('.filter-btn[data-year="all"], .filter-btn[data-action="all"]');
            if (allBtn) allBtn.classList.remove('active');

            // Se não sobrar nenhum ativo, volta para o "Todos"
            const actives = filterGroup.querySelectorAll('.filter-btn.active');
            if (actives.length === 0 && allBtn) {
                allBtn.classList.add('active');
            }
        }
    }

    const activeYears = Array.from(container.querySelectorAll('.btns-filters.years .filter-btn.active'))
        .map(b => b.dataset.year);
    const activeActions = Array.from(container.querySelectorAll('.btns-filters.actions .filter-btn.active'))
        .map(b => b.dataset.action);
    const searchInput = container.querySelector('.internal-filter-input');
    const searchTerm = searchInput ? searchInput.value.toUpperCase().trim() : '';

    const rows = container.querySelectorAll('.details-table tbody tr');
    let totalQty = 0;
    let totalCost = 0;

    rows.forEach(row => {
        const rowYear = row.dataset.year;
        let rowAction = row.dataset.action;
        const text = row.textContent.toUpperCase();

        // Parse data for calculation
        // Columns: 0:Data (Hidden), 1:Data, 2:Ação, 3:Quant, 4:Preço, 5:Taxas
        const qty = parseFloat(row.cells[3].textContent.replace(/\./g, '').replace(',', '.')) || 0;
        const price = parseCurrencyBRL(row.cells[4].textContent) || 0;
        const taxes = parseCurrencyBRL(row.cells[5].textContent) || 0;

        const yearMatch = (activeYears.includes('all') || activeYears.includes(rowYear));
        const actionMatch = (activeActions.includes('all') || activeActions.includes(rowAction));
        const searchMatch = (!searchTerm || text.includes(searchTerm));

        if (yearMatch && actionMatch && searchMatch) {
            row.style.display = '';
            if (rowAction === 'Comprar' || rowAction === 'Recompensa') {
                totalQty += qty;
                totalCost += (qty * price) + taxes;
            } else if (rowAction === 'Vender') {
                totalQty -= qty;
            }
        } else {
            row.style.display = 'none';
        }
    });

    // Limpeza de resíduos de ponto flutuante no rodapé
    if (Math.abs(totalQty) < 1e-10) totalQty = 0;

    const footerQty = container.querySelector('.filter-total-qty');
    const footerCost = container.querySelector('.filter-total-cost');
    if (footerQty) footerQty.textContent = totalQty === 0 ? '0' : (totalQty < 1 ? totalQty.toLocaleString('pt-BR', { maximumFractionDigits: 8 }) : totalQty.toLocaleString('pt-BR', { maximumFractionDigits: 2 }));
    if (footerCost) footerCost.textContent = formatCurrencyBRL(totalCost);
}


async function submitTransaction(fd, m) {
    const isE = !!fd.id; const url = isE ? `${API_URL}/transactions/${fd.id}` : `${API_URL}/transactions`;
    try {
        const r = await fetch(url, { method: isE ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fd) });
        if (r.ok) { showToast(isE ? 'Atualizado!' : 'Registrado!'); if (isE) closeModal(m); else { const f = document.querySelector(`#${m} form`); f.querySelector('[name="quantity"]').value = ""; const p = f.querySelector('[name="price"]'); if (p) p.value = ""; f.querySelector('[name="date"]').focus(); } loadHoldings(); loadTransactions(); if (document.getElementById('tab-fii-fiagro')?.classList.contains('active')) loadFiiFiagroAnnualReport(); checkDataInconsistencies(); }
    } catch (err) { showToast('Erro.'); }
}

async function openAssetManager() { openModal('modal-ticker-list'); await loadTickerList(); }
async function loadTickerList() {
    const list = document.getElementById('ticker-manager-list');
    try {
        const res = await fetch(`${API_URL}/tickers`);
        const tickers = await res.json();
        const keys = Object.keys(tickers).sort();
        if (!keys.length) {
            list.innerHTML = '<p style="opacity:0.6; text-align:center; padding: 1rem;">Nenhum ativo cadastrado.</p>';
            return;
        }

        // Group by category
        const groups = keys.reduce((acc, k) => {
            const cat = tickers[k].category || 'Outros';
            if (!acc[cat]) acc[cat] = [];
            acc[cat].push(k);
            return acc;
        }, {});

        let html = '';
        Object.keys(groups).sort().forEach(cat => {
            html += `<div style="margin: 1rem 0 0.4rem 0.2rem; display: flex; align-items: center; gap: 0.5rem;">
                        <span style="font-size: 0.55rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: var(--primary); opacity: 0.8;">${cat}</span>
                        <div style="flex: 1; height: 1px; background: var(--border); opacity: 0.3;"></div>
                     </div>`;
            html += '<table style="width:100%; font-size:0.85rem; border-collapse: separate; border-spacing: 0 4px;">';
            groups[cat].forEach(k => {
                const t = tickers[k];
                const args = `'${k}', '${(t.name || '').replace(/'/g, "\\'")}', '${t.cnpj || ''}', '${cat}', '${(t.razao_social || '').replace(/'/g, "\\'")}'`;
                html += `<tr>
                            <td style="padding: 6px 8px; background: rgba(255,255,255,0.02); border-radius: 6px 0 0 6px; border: 1px solid var(--border); border-right: none;">
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <b style="color: var(--text); font-size: 0.8rem;">${k}</b>
                                    <span style="font-size:0.6rem; background: var(--surface-solid); color: var(--text-dim); padding: 1px 4px; border-radius: 3px; border: 1px solid var(--border);">${cat}</span>
                                </div>
                                <div style="font-size: 0.65rem; color: var(--text-dim); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 180px;">${t.name || ''}</div>
                            </td>
                            <td style="padding: 6px 8px; background: rgba(255,255,255,0.02); border-radius: 0 6px 6px 0; border: 1px solid var(--border); border-left: none; text-align: right; vertical-align: middle;">
                                <button class="action-icon-btn" style="opacity: 0.6; margin-right: 4px;" onclick="openTickerForm(${args})">✏️</button>
                                <button class="action-icon-btn delete-btn" style="opacity: 0.6;" onclick="deleteTicker('${k}')">🗑️</button>
                            </td>
                         </tr>`;
            });
            html += '</table>';
        });
        list.innerHTML = html;
    } catch (err) {
        list.innerHTML = '<p style="color: var(--danger); text-align: center; padding: 1rem;">Erro ao carregar lista.</p>';
    }
}

function openTickerForm(t, n, c, cat, razao) {
    const isEdit = !!t;
    const title = document.getElementById('ticker-modal-title');
    const btn = document.getElementById('ticker-submit-btn');
    const tickerInput = tickerForm.querySelector('[name="ticker"]');

    tickerForm.reset();
    delete tickerForm.dataset.editMode;
    delete tickerForm.dataset.razaoSocial;

    if (isEdit) {
        title.innerHTML = `✏️ Editar Ativo: <b>${t}</b>`;
        btn.textContent = "Atualizar Ativo";
        tickerInput.value = t;
        tickerInput.readOnly = true;
        tickerInput.style.opacity = '0.6';
        tickerForm.querySelector('[name="name"]').value = n || '';
        tickerForm.querySelector('[name="cnpj"]').value = c || '';
        tickerForm.querySelector('[name="category"]').value = cat || "Ações";
        tickerForm.dataset.editMode = t;
        tickerForm.dataset.razaoSocial = razao || '';
    } else {
        title.innerHTML = "➕ Cadastrar Novo Ativo";
        btn.textContent = "Cadastrar Ativo";
        tickerInput.readOnly = false;
        tickerInput.style.opacity = '1';
    }

    const razaoInfo = document.getElementById('razao-social-info');
    const razaoText = document.getElementById('razao-social-text');
    if (razaoInfo && razaoText) {
        if (isEdit && razao) {
            razaoText.textContent = razao;
            razaoInfo.style.display = 'block';
        } else {
            razaoInfo.style.display = 'none';
        }
    }

    openModal('modal-ticker-form');
}


async function deleteTicker(t) {
    customConfirm(`Deseja excluir ${t} e todas as suas informações do catálogo?`, async () => {
        try {
            const r = await fetch(`${API_URL}/tickers/${t}`, { method: 'DELETE' });
            if (r.ok) { showToast('Removido!'); await loadTickerList(); await updateTickerSelects(); }
        } catch (err) { showToast('Erro.'); }
    });
}

tickerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(tickerForm);
    const ticker = fd.get('ticker').toUpperCase();
    const isE = !!tickerForm.dataset.editMode;
    const url = `${API_URL}/tickers/${isE ? tickerForm.dataset.editMode : ticker}`;
    const razaoSocial = tickerForm.dataset.razaoSocial || '';
    const payload = {
        name: fd.get('name'),
        cnpj: fd.get('cnpj'),
        category: fd.get('category'),
        razao_social: razaoSocial
    };
    try {
        const r = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (r.ok) {
            showToast(isE ? 'Atualizado!' : 'Cadastrado!');
            closeModal('modal-ticker-form');
            await loadTickerList();
            await updateTickerSelects();
        }
    } catch (err) { showToast('Erro'); }
});

operationForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(operationForm);
    const q = parseFloat(fd.get('quantity'));
    const totalInput = document.getElementById('op-total');
    let price;

    // Calcula o preço unitário EXATO com base no Valor Total preenchido para não perder centavos
    if (totalInput && totalInput.value) {
        const totalRaw = parseCurrencyBRL(totalInput.value) || 0;
        price = q > 0 ? (totalRaw / q) : 0;
    } else {
        price = parseCurrencyBRL(fd.get('price')) || 0;
    }

    submitTransaction({
        id: fd.get('id') || null,
        ticker: fd.get('ticker'),
        action: fd.get('action'),
        quantity: q,
        price_per_share: price,
        taxes: parseCurrencyBRL(fd.get('taxes') || "0"),
        date: fd.get('date')
    }, 'modal-operation');
});

eventForm.addEventListener('submit', (e) => {
    e.preventDefault(); const fd = new FormData(eventForm);
    const action = fd.get('action');
    const payload = {
        id: fd.get('id') || null,
        ticker: fd.get('ticker'),
        action: action,
        quantity: parseFloat(fd.get('quantity')), // No caso de INC, tratamos quantity como o fator aqui para reuso
        price_per_share: 0,
        taxes: 0,
        date: fd.get('date'),
        ticker_destino: action === 'Incorporacao' ? fd.get('ticker_destino') : null,
        fator_conversao: action === 'Incorporacao' ? parseFloat(fd.get('quantity')) : null
    };
    submitTransaction(payload, 'modal-event');
});

// --- SWAP LOGIC ---
const swapForm = document.getElementById('swap-form');
function openSwapModal() {
    swapForm.reset();
    updateTickerSelects();
    openModal('modal-swap');
}

swapForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(swapForm);
    const date = fd.get('date');
    const totalBrl = parseCurrencyBRL(fd.get('total_brl'));
    const tOut = fd.get('ticker_out');
    const qOut = parseFloat(fd.get('qty_out'));
    const tIn = fd.get('ticker_in');
    const qIn = parseFloat(fd.get('qty_in'));

    if (!tOut || !tIn || !qOut || !qIn || !totalBrl) {
        showToast('Preencha todos os campos corretamente.');
        return;
    }

    try {
        const btn = swapForm.querySelector('button[type="submit"]');
        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Processando...';

        // 1. Register Sale (Venda) of ticker_out
        const saleTx = {
            ticker: tOut,
            action: 'Vender',
            quantity: qOut,
            price_per_share: totalBrl / qOut,
            taxes: 0,
            date: date
        };

        // 2. Register Purchase (Compra) of ticker_in
        const purchaseTx = {
            ticker: tIn,
            action: 'Comprar',
            quantity: qIn,
            price_per_share: totalBrl / qIn,
            taxes: 0,
            date: date
        };

        const res = await fetch(`${API_URL}/transactions/swap`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify([saleTx, purchaseTx])
        });

        if (res.ok) {
            showToast('Troca registrada com sucesso!');
            closeModal('modal-swap');
            loadHoldings();
            loadTransactions();
            checkDataInconsistencies();
        } else {
            const data = await res.json();
            showToast(data.detail || 'Erro ao registrar troca.');
        }

        btn.disabled = false;
        btn.textContent = originalText;
    } catch (err) {
        console.error(err);
        showToast('Erro técnico ao realizar troca.');
    }
});

function toggleEventFields() {
    const action = document.getElementById('event-action-select').value;
    const destRow = document.getElementById('dest-ticker-row');
    const factorLabel = document.getElementById('factor-label');
    const factorInput = document.getElementById('event-factor-input');
    const hint = document.getElementById('event-hint');

    if (action === 'Incorporacao') {
        destRow.style.display = 'block';
        factorLabel.textContent = 'Fator de Conversão';
        factorInput.placeholder = 'ex: 0.12345';
        hint.textContent = '* Ao incorporar, o custo total do ativo de origem é transferido para a parte inteira do destino. Frações geram venda interna.';
    } else {
        destRow.style.display = 'none';
        factorLabel.textContent = 'Fator (Ratio)';
        factorInput.placeholder = action === 'Desdobramento' ? 'ex: 2 para 2:1' : 'ex: 0.1 para 1:10';
        hint.textContent = '* Ajuste de estoque. No caso de desdobramento/grupamento não há fluxo financeiro.';
    }
}

function customConfirm(msg, onConfirm) {
    const m = document.getElementById('modal-confirm');
    const txt = document.getElementById('confirm-message');
    const btn = document.getElementById('confirm-action-btn');

    txt.textContent = msg;
    openModal('modal-confirm');

    // Remove previous listeners
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);

    newBtn.addEventListener('click', () => {
        onConfirm();
        closeModal('modal-confirm');
    });
}

async function deleteTransaction(id) {
    customConfirm('Deseja excluir esta transação permanentemente?', async () => {
        try {
            const r = await fetch(`${API_URL}/transactions/${id}`, { method: 'DELETE' });
            if (r.ok) { showToast('Removido!'); await loadHoldings(); await loadTransactions(); }
        } catch (err) { showToast('Erro.'); }
    });
}

function prepareEdit(id, ticker, action, quantity, price, taxes, date, ticker_destino, fator_conversao) {
    const isEvent = (action === 'Desdobramento' || action === 'Grupamento' || action === 'Incorporacao');
    const modalId = isEvent ? 'modal-event' : 'modal-operation';
    const form = document.querySelector(`#${modalId} form`);

    openModal(modalId);

    form.querySelector('[name="id"]').value = id || '';

    // Set selects with defensive checks
    const tickerInp = form.querySelector('[name="ticker"]');
    if (tickerInp) tickerInp.value = ticker;

    const actionInp = form.querySelector('[name="action"]');
    if (actionInp) actionInp.value = action;

    form.querySelector('[name="quantity"]').value = quantity;
    form.querySelector('[name="date"]').value = date;

    if (isEvent) {
        if (action === 'Incorporacao') {
            const destSelect = form.querySelector('[name="ticker_destino"]');
            if (destSelect) destSelect.value = ticker_destino || "";
        }
        if (typeof toggleEventFields === 'function') toggleEventFields();
    } else {
        // Format values for currency inputs
        const pInp = form.querySelector('[name="price"]');
        if (pInp) pInp.value = formatCurrencyBRL(price, 6);

        const tInp = form.querySelector('[name="taxes"]');
        if (tInp) tInp.value = formatCurrencyBRL(taxes);

        // Sync total
        const tField = document.getElementById('op-total');
        if (tField) tField.value = formatCurrencyBRL((parseFloat(quantity) || 0) * (parseFloat(price) || 0));
    }

    const btn = form.querySelector('.submit-btn');
    if (btn) btn.textContent = "Atualizar";
}

function resetFormForNew(m) {
    const f = document.querySelector(`#${m} form`);
    if (!f) return;
    f.reset();
    const idField = f.querySelector('[name="id"]');
    if (idField) idField.value = "";
    const submitBtn = f.querySelector('.submit-btn');
    if (submitBtn) {
        if (m === 'modal-ticker-form') submitBtn.textContent = "Salvar Ativo";
        else submitBtn.textContent = "Registrar Operação";
    }
}
const originalOpenModal = openModal;
openModal = function (id) {
    if (id !== 'modal-ticker-list' && id !== 'modal-ticker-form' && id !== 'modal-theme' && id !== 'modal-full-history') resetFormForNew(id);
    originalOpenModal(id);
}

function showToast(m) { toast.textContent = m; toast.style.display = 'block'; setTimeout(() => toast.style.display = 'none', 3000); }

if (fetchInfoBtn) {
    fetchInfoBtn.addEventListener('click', async () => {
        const t = tickerForm.querySelector('[name="ticker"]').value.trim().toUpperCase();
        if (!t) { showToast('Digite o ticker!'); return; }
        const oh = fetchInfoBtn.innerHTML; fetchInfoBtn.innerHTML = '⏳'; fetchInfoBtn.disabled = true;
        const razaoInfo = document.getElementById('razao-social-info');
        const razaoText = document.getElementById('razao-social-text');
        if (razaoInfo) razaoInfo.style.display = 'none';
        try {
            const r = await fetch(`${API_URL}/fetch-ticker-info/${t}`); const info = await r.json();
            if (info.name) {
                tickerForm.querySelector('[name="name"]').value = info.name;
                if (info.cnpj) tickerForm.querySelector('[name="cnpj"]').value = info.cnpj;
                if (info.category) tickerForm.querySelector('[name="category"]').value = info.category;
                if (info.razao_social) {
                    tickerForm.dataset.razaoSocial = info.razao_social;
                    if (razaoInfo && razaoText) {
                        razaoText.textContent = info.razao_social;
                        razaoInfo.style.display = 'block';
                    }
                }
                showToast('Preenchido!');
            }
            else { showToast('Não encontrado.'); }
        } catch (err) { showToast('Erro.'); } finally { fetchInfoBtn.innerHTML = oh; fetchInfoBtn.disabled = false; }
    });
}

async function openThemeManager() {
    openModal('modal-theme');
    const list = document.getElementById('theme-manager-list');
    list.innerHTML = 'Carregando...';

    try {
        const [tickersRes, settingsRes] = await Promise.all([
            fetch(`${API_URL}/tickers`),
            fetch(`${API_URL}/settings`)
        ]);
        const tickers = await tickersRes.json();
        const settings = await settingsRes.json();
        const catColors = settings.category_colors || {};

        const categories = Array.from(new Set(Object.values(tickers).map(t => t.category || 'Ações'))).sort();

        if (!categories.length) {
            list.innerHTML = '<p class="empty-state">Nenhuma categoria encontrada. Cadastre ativos primeiro.</p>';
            return;
        }

        let html = '';
        categories.forEach(cat => {
            const color = catColors[cat] || '#3b82f6';
            html += `<div class="theme-item">
                        <label>${cat}</label>
                        <input type="color" class="color-picker" data-cat="${cat}" value="${color}">
                     </div>`;
        });
        list.innerHTML = html;
    } catch (e) {
        list.innerHTML = 'Erro ao carregar categorias.';
    }
}

function filterTransactions() {
    const inputEl = document.getElementById('transactionSearch');
    if (!inputEl) return;

    const query = inputEl.value.toUpperCase().trim();
    const headers = document.querySelectorAll('.group-header');

    // If query is empty, show everything
    if (!query) {
        headers.forEach(h => {
            h.style.display = '';
            const next = h.nextElementSibling;
            if (next && next.classList.contains('details-row')) {
                if (!h.classList.contains('expanded')) next.style.display = 'none';
            }
        });
        return;
    }

    const parts = query.split(/\s+/);
    headers.forEach(h => {
        const ticker = h.querySelector('.ticker-badge').textContent.toUpperCase();
        const next = h.nextElementSibling;

        // Use textContent because innerText is empty for display:none elements!
        const rowText = (next && next.classList.contains('details-row')) ? next.textContent.toUpperCase() : "";

        const isMatch = parts.every(p => ticker.includes(p) || rowText.includes(p));
        h.style.display = isMatch ? '' : 'none';

        if (!isMatch && next && next.classList.contains('details-row')) {
            next.style.display = 'none';
        }
    });
}

async function saveThemeSettings() {
    const pickers = document.querySelectorAll('.color-picker');
    const category_colors = {};
    pickers.forEach(p => {
        category_colors[p.dataset.cat] = p.value;
    });

    try {
        const r = await fetch(`${API_URL}/settings`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ category_colors })
        });
        if (r.ok) {
            showToast('Tema atualizado!');
            closeModal('modal-theme');
            loadHoldings(); // Refresh UI
        }
    } catch (e) {
        showToast('Erro ao salvar.');
    }
}

function getContrastColor(hex) {
    if (!hex || hex.indexOf('#') !== 0) return '#1e293b';
    const r = parseInt(hex.substr(1, 2), 16);
    const g = parseInt(hex.substr(3, 2), 16);
    const b = parseInt(hex.substr(5, 2), 16);
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return (yiq >= 128) ? '#1e293b' : '#ffffff';
}

function renderSummary(catTotals, grandTotals, years) {
    const summaryContainer = document.getElementById('summary-container');
    if (!summaryContainer) return;

    const lastYear = years[years.length - 1];
    const categories = Object.keys(catTotals);

    if (categories.length <= 1) {
        summaryContainer.innerHTML = '';
        return;
    }

    let html = `<h3>📈 Resumo por Categoria (${lastYear})</h3><div class="summary-card-grid">`;

    categories.forEach(cat => {
        const value = catTotals[cat][lastYear] || 0;
        const percent = (value / grandTotals[lastYear] * 100).toFixed(1);
        html += `<div class="summary-card">
                    <div class="summary-card-label"><span>${cat}</span> <span class="badge-info">${percent}%</span></div>
                    <div class="summary-card-value">${formatCurrencyBRL(value)}</div>
                    <div class="summary-card-secondary">Total alocado no ano ${lastYear}</div>
                 </div>`;
    });

    html += `<div class="summary-card" style="border-color: var(--primary); background: rgba(99, 102, 241, 0.08);">
                <div class="summary-card-label" style="color: var(--primary)">PATRIMÔNIO TOTAL</div>
                <div class="summary-card-value" style="color: var(--primary)">${formatCurrencyBRL(grandTotals[lastYear])}</div>
                <div class="summary-card-secondary">Soma de todas as categorias em ${lastYear}</div>
             </div>`;

    summaryContainer.innerHTML = html + '</div>';
}

// Redundant, now using tabs
// async function openFullHistory() { ... }

let filterTimeout;
function filterHistoryBySearch() {
    highlightIds = []; // Limpa destaques ao buscar manualmente
    clearTimeout(filterTimeout);
    filterTimeout = setTimeout(() => {
        loadTransactions();
    }, 300);
}


/* ═══════════════════════════════
   NOTIFICATIONS & INCONSISTENCIES
   ═══════════════════════════════ */
async function checkDataInconsistencies(showModalIfEmpty = false) {
    try {
        const res = await fetch(`${API_URL}/check-inconsistencies`);
        if (!res.ok) throw new Error('Falha ao buscar inconsistências');

        const inconsistencies = await res.json();

        const bellIcon = document.getElementById('bell-icon');
        const notifCount = document.getElementById('notif-count');
        const statusText = document.getElementById('status-text');
        const systemStatus = document.getElementById('system-status');

        if (!bellIcon || !notifCount) return;

        const count = inconsistencies.length;

        if (count > 0) {
            notifCount.innerHTML = count;
            notifCount.style.display = 'block';
            bellIcon.classList.add('bell-active');
            statusText.innerHTML = `${count} inconsistências detectadas`;
            systemStatus.className = 'status-badge status-warning';
        } else {
            notifCount.style.display = 'none';
            bellIcon.classList.remove('bell-active');
            statusText.innerHTML = 'Sistema em Conformidade';
            systemStatus.className = 'status-badge status-healthy';
        }

        renderInconsistencies(inconsistencies);

        if (showModalIfEmpty && count === 0) {
            showToast('Nenhuma inconsistência encontrada.');
        }
    } catch (err) { console.error('Inconsistency check failed', err); }
}

function renderInconsistencies(items) {
    const list = document.getElementById('notifications-list');
    const footer = document.getElementById('notifications-footer');
    if (!list) return;

    if (!Array.isArray(items) || items.length === 0) {
        list.innerHTML = '<div class="empty-state">🎉 Nenhuma inconsistência detectada.</div>';
        if (footer) footer.style.display = 'none';
        return;
    }

    if (footer) footer.style.display = 'block';
    list.innerHTML = items.map(item => {
        if (item.type === 'DUPLICADO') {
            return `
                <div class="inconsistency-item">
                    <div class="inconsistency-info">
                        <div class="inconsistency-badge">${item.type}</div>
                        <div style="font-weight:600; font-size:0.75rem;">${item.ticker} - ${formatDateBRL(item.date)}</div>
                        <div style="font-size:0.65rem; opacity:0.8;">${item.message}</div>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:4px;">
                        <button class="menu-btn secondary-btn" onclick="viewInHistory('${item.ticker}', ${JSON.stringify(item.ids).replace(/"/g, "'")}, '${item.date || ""}')" style="padding:4px 8px; font-size:0.55rem; width:100%; justify-content:center;">
                             🔍 Ver no Histórico
                        </button>
                        <button class="menu-btn secondary-btn" onclick="ignoreInconsistency('${item.ticker}', ${JSON.stringify(item.ids).replace(/"/g, "'")})" style="padding:4px 8px; font-size:0.55rem; width:100%; justify-content:center; color: var(--success);">
                             ✅ Está Correto
                        </button>
                        <button class="menu-btn secondary-btn delete-btn" onclick="deleteDuplicate('${item.ids[0]}')" style="padding:4px 8px; font-size:0.55rem; width:100%; justify-content:center;">
                             ⛔ Deletar Cópia
                        </button>
                    </div>
                </div>
            `;
        } else if (item.type === 'SALDO_INSUFICIENTE') {
            return `
                <div class="inconsistency-item">
                    <div class="inconsistency-info">
                        <div class="inconsistency-badge" style="background:#e11d48">${item.type}</div>
                        <div style="font-weight:600; font-size:0.75rem;">${item.ticker} - ${formatDateBRL(item.date)}</div>
                        <div style="font-size:0.65rem; opacity:0.8;">${item.message}</div>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:4px;">
                        <button class="menu-btn secondary-btn" onclick="viewInHistory('${item.ticker}', ${JSON.stringify(item.ids).replace(/"/g, "'")}, '${item.date || ""}')" style="padding:4px 8px; font-size:0.55rem; width:100%; justify-content:center;">
                             🔍 Ver no Histórico
                        </button>
                        <button class="menu-btn secondary-btn" onclick="ignoreInconsistency('${item.ticker}', ${JSON.stringify(item.ids).replace(/"/g, "'")})" style="padding:4px 8px; font-size:0.55rem; width:100%; justify-content:center; color: var(--success);">
                             ✅ Está Correto
                        </button>
                    </div>
                </div>
            `;
        } else {
            return `
                <div class="inconsistency-item">
                    <div class="inconsistency-info">
                        <div class="inconsistency-badge" style="background:var(--primary)">${item.type}</div>
                        <div style="font-weight:600; font-size:0.75rem;">${item.ticker}</div>
                        <div style="font-size:0.65rem; opacity:0.8;">${item.message}</div>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:4px;">
                        <button class="menu-btn secondary-btn" onclick="viewInHistory('${item.ticker}')" style="padding:4px 8px; font-size:0.55rem; width:100%; justify-content:center;">
                             🔍 Ver no Histórico
                        </button>
                        <button class="menu-btn secondary-btn" onclick="ignoreInconsistency('${item.ticker}')" style="padding:4px 8px; font-size:0.55rem; width:100%; justify-content:center; color: var(--success);">
                             ✅ Está Correto
                        </button>
                        <button class="menu-btn secondary-btn" onclick="openAssetManager()" style="padding:4px 8px; font-size:0.55rem; width:100%; justify-content:center;">
                             🏷️ Corrigir Ativo
                        </button>
                    </div>
                </div>
            `;
        }
    }).join('');
}

async function deleteDuplicate(id) {
    if (!confirm('Deseja realmente deletar este registro duplicado?')) return;
    try {
        const r = await fetch(`${API_URL}/transactions/${id}`, { method: 'DELETE' });
        if (r.ok) {
            showToast('Duplicata removida!');
            await checkDataInconsistencies();
            loadHoldings();
            loadTransactions();
        }
    } catch (err) { showToast('Erro.'); }
}

function openNotifications() {
    openModal('modal-notifications');
    checkDataInconsistencies();
}

async function copyTickerCnpj(ticker) {
    try {
        const res = await fetch(`${API_URL}/tickers`);
        const tickers = await res.json();
        const info = tickers[ticker];
        if (info && info.cnpj) {
            await navigator.clipboard.writeText(info.cnpj);
            showToast(`CNPJ de ${ticker} copiado!`);
        } else {
            showToast(`CNPJ não encontrado para ${ticker}.`);
        }
    } catch (err) { showToast('Erro ao copiar CNPJ.'); }
}

async function ignoreInconsistency(ticker, ids = []) {
    if (!confirm('Deseja marcar como correto? Esta inconsistência não será mais exibida.')) return;
    try {
        const r = await fetch(`${API_URL}/whitelist-inconsistency`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ticker, ids })
        });
        if (r.ok) {
            showToast('Item ignorado com sucesso!');
            await checkDataInconsistencies();
        }
    } catch (err) { showToast('Erro ao processar solicitação.'); }
}

/* ═══════════════════════════════
   TAB SWITCHER LOGIC
   ═══════════════════════════════ */
function switchTab(tabId) {
    // Remove active class from all tabs and buttons
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));

    // Add active class to selected tab and button
    const activeTab = document.getElementById(tabId);
    if (activeTab) activeTab.classList.add('active');

    // Finding the button that triggered this
    const btnId = `btn-${tabId}`;
    const activeBtn = document.getElementById(btnId);
    if (activeBtn) activeBtn.classList.add('active');

    // Load data if switching to Transações, Bens or Operações
    if (tabId === 'tab-transacoes') {
        loadTransactions();
    } else if (tabId === 'tab-bens') {
        loadHoldings();
    } else if (tabId === 'tab-operacoes') {
        loadSalesReport();
    } else if (tabId === 'tab-ir-mensal') {
        loadIRMensal();
    } else if (tabId === 'tab-fii-fiagro') {
        loadFiiFiagroAnnualReport();
    }

    // Auto-scroll to top when switching
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// IR Mensal Logic
let selectedIrMonthKey = null;
let irMonthlyData = {};

async function loadIRMensal() {
    const monthList = document.getElementById('ir-month-list');
    const formBody = document.getElementById('ir-form-body');
    if (!monthList) return;

    try {
        const [txRes, tkRes] = await Promise.all([
            fetch(`${API_URL}/transactions`),
            fetch(`${API_URL}/tickers`)
        ]);
        const allTransactions = await txRes.json();
        const tickersMap = await tkRes.json();

        // 1. Process data similar to loadSalesReport
        const sortedTxs = allTransactions.sort((a, b) => new Date(a.date) - new Date(b.date));
        const holdings = {};
        const sales = [];

        sortedTxs.forEach(t => {
            if (!holdings[t.ticker]) holdings[t.ticker] = { qty: 0, totalCost: 0 };
            const h = holdings[t.ticker];
            const action = t.action.toLowerCase();
            
            if (action === 'comprar' || action === 'recompensa') {
                h.qty += t.quantity;
                h.totalCost += (t.quantity * t.price_per_share) + t.taxes;
            } else if (action === 'vender' && h.qty > 0) {
                const avgPrice = h.totalCost / h.qty;
                const effectiveSoldQty = Math.min(t.quantity, h.qty);
                const saleCost = effectiveSoldQty * avgPrice;
                const profit = (t.quantity * t.price_per_share) - saleCost - t.taxes;
                sales.push({ ...t, avgPriceAtSale: avgPrice, profit: profit, category: tickersMap[t.ticker]?.category || 'Ações' });
                h.qty -= t.quantity;
                h.totalCost -= saleCost;
                if (h.qty <= 0) { h.qty = 0; h.totalCost = 0; }
            } else if (action === 'desdobramento') { 
                h.qty *= t.quantity; 
            } else if (action === 'grupamento' && t.quantity > 0) { 
                h.qty /= t.quantity; 
            } else if (action === 'incorporacao') {
                const tickerDest = (t.ticker_destino || "").toUpperCase().trim();
                const fator = t.fator_conversao || 1.0;
                
                if (tickerDest && h.qty > 0) {
                    if (!holdings[tickerDest]) holdings[tickerDest] = { qty: 0, totalCost: 0 };
                    
                    const newQtyTotal = h.qty * fator;
                    const qtyDestInt = Math.floor(newQtyTotal);
                    const fraction = newQtyTotal - qtyDestInt;
                    
                    holdings[tickerDest].qty += qtyDestInt;
                    holdings[tickerDest].totalCost += h.totalCost;
                    
                    if (fraction > 0) {
                        const avgPriceOrig = h.totalCost / h.qty;
                        const fractionInOrigTerms = fraction / fator;
                        const fractionCost = fractionInOrigTerms * avgPriceOrig;
                        
                        sales.push({
                            ...t,
                            ticker: t.ticker,
                            action: 'Venda de Frações (Inc.)',
                            quantity: fraction,
                            price_per_share: 0,
                            avgPriceAtSale: avgPriceOrig / fator,
                            profit: -fractionCost,
                            category: tickersMap[t.ticker]?.category || 'Ações'
                        });
                    }
                    h.qty = 0;
                    h.totalCost = 0;
                }
            }
        });

        // Day Trade Detection
        const dayBuys = {};
        sortedTxs.forEach(t => {
            if (t.action === 'Comprar' || t.action === 'Recompensa') {
                const k = `${t.date}|${t.ticker}`;
                dayBuys[k] = (dayBuys[k] || 0) + t.quantity;
            }
        });
        sales.forEach(s => {
            const k = `${s.date}|${s.ticker}`;
            if (dayBuys[k] && dayBuys[k] > 0) { s.isDayTrade = true; dayBuys[k] -= s.quantity; }
            else { s.isDayTrade = false; }
        });

        // 2. Aggregate into Months (Focus on 2024/2025)
        const summary = {};
        const yearTarget = new Date().getFullYear().toString(); // Focado no ano atual de declaração dinâmico
        const sidebarYearEl = document.getElementById('ir-sidebar-year');
        if (sidebarYearEl) {
            sidebarYearEl.textContent = `Meses de ${yearTarget}`;
        }
        const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

        // Inicializa meses
        for (let i = 1; i <= 12; i++) {
            const k = `${yearTarget}-${String(i).padStart(2, '0')}`;
            summary[k] = {
                name: monthNames[i - 1],
                comumAcoes: 0, dtAcoes: 0,
                comumFII: 0, dtFII: 0,
                irrfComum: 0, irrfDT: 0,
                prejuizoAnteriorComum: 0, prejuizoAnteriorDT: 0
            };
        }

        sales.forEach(s => {
            const date = s.date.split('-');
            const k = `${date[0]}-${date[1]}`;
            if (!summary[k]) return;
            const m = summary[k];
            const isFII = (s.category || "").includes("FII");
            const profit = s.profit;

            if (s.isDayTrade) {
                if (isFII) m.dtFII += profit;
                else m.dtAcoes += profit;
                if (profit > 0) m.irrfDT += profit * 0.01;
            } else {
                if (isFII) m.comumFII += profit;
                else m.comumAcoes += profit;
                m.irrfComum += (s.quantity * s.price_per_share) * 0.00005;
            }
        });

        irMonthlyData = summary;
        renderIrSidebar(yearTarget);

        if (!selectedIrMonthKey) {
            selectedIrMonthKey = `${yearTarget}-01`;
        }
        renderIrForm();

    } catch (err) { console.error(err); }
}

function renderIrSidebar(year) {
    const list = document.getElementById('ir-month-list');
    if (!list) return;
    let html = '';
    Object.keys(irMonthlyData).sort().forEach(k => {
        const m = irMonthlyData[k];
        const isActive = k === selectedIrMonthKey ? 'active' : '';
        html += `<div class="ir-month-item ${isActive}" onclick="selectIrMonth('${k}')">
                    <span>${m.name}</span>
                    <span class="ir-badge-tag">${year}</span>
                 </div>`;
    });
    list.innerHTML = html;
}

function selectIrMonth(k) {
    selectedIrMonthKey = k;
    renderIrSidebar(k.split('-')[0]);
    renderIrForm();
}

function renderIrForm() {
    const body = document.getElementById('ir-form-body');
    const title = document.getElementById('ir-selected-month-title');
    const data = irMonthlyData[selectedIrMonthKey];

    if (!data || !body) return;
    title.textContent = `Renda Variável - ${data.name} de ${selectedIrMonthKey.split('-')[0]}`;

    const fmt = (v) => v === 0 ? "0,00" : formatCurrencyBRL(v).replace('R$', '').trim();
    const cls = (v) => v < 0 ? 'value-neg' : 'value-pos';

    body.innerHTML = `
        <div class="ir-table-section">
            <div class="ir-section-title">
                <span>Mercado à Vista</span>
                <span>Titular</span>
            </div>
            <div class="ir-grid-row" style="background: var(--surface-hover); font-weight: bold; font-size: 0.7rem; color: var(--text-dim); text-transform: uppercase;">
                <div class="ir-grid-label"></div>
                <div class="ir-grid-input" style="text-align: center; border: none;">Operações Comuns</div>
                <div class="ir-grid-input" style="text-align: center; border: none;">Day-Trade</div>
            </div>
            <div class="ir-grid-row">
                <div class="ir-grid-label">Mercado à vista - ações</div>
                <div class="ir-grid-input ${cls(data.comumAcoes)}">${fmt(data.comumAcoes)}</div>
                <div class="ir-grid-input ${cls(data.dtAcoes)}">${fmt(data.dtAcoes)}</div>
            </div>
            <div class="ir-grid-row">
                <div class="ir-grid-label">Mercado à vista - ouro</div>
                <div class="ir-grid-input">0,00</div>
                <div class="ir-grid-input">0,00</div>
            </div>
        </div>

        <div class="ir-table-section">
            <div class="ir-section-title">Resultados</div>
            <div class="ir-grid-row" style="background: var(--surface-hover); font-weight: bold; font-size: 0.7rem; color: var(--text-dim); text-transform: uppercase;">
                <div class="ir-grid-label"></div>
                <div class="ir-grid-input" style="text-align: center; border: none;">Operações Comuns</div>
                <div class="ir-grid-input" style="text-align: center; border: none;">Day-Trade</div>
            </div>
            <div class="ir-grid-row">
                <div class="ir-grid-label">Resultado líquido do mês</div>
                <div class="ir-grid-input ${cls(data.comumAcoes)}">${fmt(data.comumAcoes)}</div>
                <div class="ir-grid-input ${cls(data.dtAcoes)}">${fmt(data.dtAcoes)}</div>
            </div>
            <div class="ir-grid-row">
                <div class="ir-grid-label">Resultado negativo até o mês anterior</div>
                <div class="ir-grid-input" style="color: var(--danger)">0,00</div>
                <div class="ir-grid-input" style="color: var(--danger)">0,00</div>
            </div>
            <div class="ir-grid-row">
                <div class="ir-grid-label">Base de cálculo do imposto</div>
                <div class="ir-grid-input">${fmt(Math.max(0, data.comumAcoes))}</div>
                <div class="ir-grid-input">${fmt(Math.max(0, data.dtAcoes))}</div>
            </div>
            <div class="ir-grid-row">
                <div class="ir-grid-label">Prejuízo a compensar</div>
                <div class="ir-grid-input">${fmt(Math.min(0, data.comumAcoes))}</div>
                <div class="ir-grid-input">${fmt(Math.min(0, data.dtAcoes))}</div>
            </div>
        </div>

        <div class="ir-footer-section">
            <div class="ir-summary-row">
                <span>Imposto devido (15% e 20%)</span>
                <b>R$ ${fmt((Math.max(0, data.comumAcoes) * 0.15) + (Math.max(0, data.dtAcoes) * 0.20))}</b>
            </div>
            <div class="ir-summary-row">
                <span>IR fonte (Lei nº 11.033/2004) no mês ("Dedo-duro")</span>
                <b>R$ ${fmt(data.irrfComum + data.irrfDT)}</b>
            </div>
            <div class="ir-summary-row total">
                <span>Imposto a Pagar</span>
                <span>R$ ${fmt(Math.max(0, (Math.max(0, data.comumAcoes) * 0.15) + (Math.max(0, data.dtAcoes) * 0.20) - (data.irrfComum + data.irrfDT)))}</span>
            </div>
        </div>
    `;
}

/* ═══════════════════════════════
   FIIs / Fiagro - Tabela anual IRPF
   ═══════════════════════════════ */
let fiiFiagroAnnualReports = {};
let fiiFiagroAvailableYears = [];
let fiiFiagroLastCopiedRows = [];

const FII_FIAGRO_MONTHS = [
    { key: '01', label: 'JAN' }, { key: '02', label: 'FEV' }, { key: '03', label: 'MAR' },
    { key: '04', label: 'ABR' }, { key: '05', label: 'MAI' }, { key: '06', label: 'JUN' },
    { key: '07', label: 'JUL' }, { key: '08', label: 'AGO' }, { key: '09', label: 'SET' },
    { key: '10', label: 'OUT' }, { key: '11', label: 'NOV' }, { key: '12', label: 'DEZ' }
];

function isFiiFiagroCategory(category) {
    const c = String(category || '').toLowerCase();
    return c.includes('fii') || c.includes('fiis') || c.includes('fiagro') || c.includes('imobiliário') || c.includes('imobiliario');
}

function getTxPriorityForTaxReport(tx) {
    const p = {
        'comprar': 1,
        'recompensa': 1,
        'desdobramento': 2,
        'grupamento': 2,
        'incorporacao': 3,
        'vender': 4
    };

    return p[String(tx.action || '').toLowerCase()] || 5;
}

function toNumberSafe(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

function formatTaxNumber(value, digits = 2) {
    const n = Math.abs(value) < 0.005 ? 0 : value;

    return n.toLocaleString('pt-BR', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits
    });
}

function renderFiiFiagroMoney(value, extraClass = '') {
    const cls = value < -0.004 ? 'value-neg' : (value > 0.004 ? 'value-pos' : '');

    return `<td class="fii-fiagro-amount ${cls} ${extraClass}">${formatTaxNumber(value)}</td>`;
}

async function loadFiiFiagroAnnualReport() {
    const container = document.getElementById('fii-fiagro-report-container');
    const yearSelect = document.getElementById('fii-fiagro-year-select');

    if (!container || !yearSelect) return;

    container.innerHTML = '<p class="empty-state">Processando histórico de FIIs/Fiagro...</p>';

    try {
        const [txRes, tkRes] = await Promise.all([
            fetch(`${API_URL}/transactions`),
            fetch(`${API_URL}/tickers`)
        ]);

        const transactions = await txRes.json();
        const tickersMap = await tkRes.json();

        const { reports, years } = buildFiiFiagroReports(transactions, tickersMap);

        fiiFiagroAnnualReports = reports;
        fiiFiagroAvailableYears = years;

        if (!years.length) {
            yearSelect.innerHTML = '<option value="">Sem dados</option>';
            container.innerHTML = '<p class="empty-state">Nenhuma venda de FII/Fiagro encontrada no histórico.</p>';
            return;
        }

        const previousValue = yearSelect.value;
        const currentYear = new Date().getFullYear().toString();
        const preferredYear = years.includes(currentYear) ? currentYear : (years.length > 0 ? years[years.length - 1] : currentYear);
        const selectedYear = years.includes(previousValue) ? previousValue : preferredYear;

        yearSelect.innerHTML = years
            .map(y => `<option value="${y}" ${y === selectedYear ? 'selected' : ''}>${y}</option>`)
            .join('');

        renderFiiFiagroYearReport();
    } catch (err) {
        console.error('loadFiiFiagroAnnualReport failed', err);
        container.innerHTML = '<p class="empty-state text-danger">Erro ao calcular a tabela de FIIs/Fiagro.</p>';
    }
}

function buildFiiFiagroReports(transactions, tickersMap) {
    const sortedTxs = [...transactions].sort((a, b) => {
        const dateDiff = new Date(a.date) - new Date(b.date);

        if (dateDiff !== 0) return dateDiff;

        return getTxPriorityForTaxReport(a) - getTxPriorityForTaxReport(b);
    });

    const holdings = {};
    const monthlyResults = {};
    const monthlyDetails = {};
    const yearSet = new Set();

    sortedTxs.forEach(tx => {
        const ticker = String(tx.ticker || '').toUpperCase();

        if (!ticker || !tx.date) return;

        const action = String(tx.action || '').toLowerCase();
        const qty = toNumberSafe(tx.quantity);
        const price = toNumberSafe(tx.price_per_share);
        const taxes = toNumberSafe(tx.taxes);
        const meta = tickersMap[ticker] || {};
        const category = meta.category || 'Ações';
        const isFiiFiagro = isFiiFiagroCategory(category);

        yearSet.add(String(tx.date).slice(0, 4));

        if (!holdings[ticker]) {
            holdings[ticker] = {
                qty: 0,
                totalCost: 0
            };
        }

        const h = holdings[ticker];

        if (action === 'comprar' || action === 'recompensa') {
            h.qty += qty;
            h.totalCost += (qty * price) + taxes;
            return;
        }

        if (action === 'vender') {
            const avgPrice = h.qty > 0 ? h.totalCost / h.qty : price;
            const effectiveSoldQty = h.qty > 0 ? Math.min(qty, h.qty) : qty;
            const saleCost = effectiveSoldQty * avgPrice;
            const saleRevenue = qty * price;
            const result = saleRevenue - saleCost - taxes;

            if (isFiiFiagro) {
                const monthKey = String(tx.date).slice(0, 7);

                monthlyResults[monthKey] = (monthlyResults[monthKey] || 0) + result;

                if (!monthlyDetails[monthKey]) {
                    monthlyDetails[monthKey] = [];
                }

                monthlyDetails[monthKey].push({
                    date: tx.date,
                    ticker,
                    quantity: qty,
                    saleRevenue,
                    avgPrice,
                    saleCost,
                    taxes,
                    result
                });
            }

            h.qty -= qty;
            h.totalCost -= saleCost;

            if (h.qty <= 1e-10) {
                h.qty = 0;
                h.totalCost = 0;
            }

            return;
        }

        if (action === 'desdobramento') {
            h.qty *= qty;
            return;
        }

        if (action === 'grupamento') {
            if (qty > 0) h.qty /= qty;
            return;
        }

        if (action === 'incorporacao') {
            const tickerDest = String(tx.ticker_destino || '').toUpperCase();
            const factor = toNumberSafe(tx.fator_conversao || tx.quantity || 1);

            if (!tickerDest) return;

            if (!holdings[tickerDest]) {
                holdings[tickerDest] = {
                    qty: 0,
                    totalCost: 0
                };
            }

            holdings[tickerDest].qty += h.qty * factor;
            holdings[tickerDest].totalCost += h.totalCost;

            h.qty = 0;
            h.totalCost = 0;
        }
    });

    Object.keys(monthlyResults).forEach(k => yearSet.add(k.slice(0, 4)));

    const years = Array.from(yearSet).filter(Boolean).sort();
    const reports = {};

    let accumulatedLoss = 0;

    years.forEach(year => {
        const rows = [];

        FII_FIAGRO_MONTHS.forEach(month => {
            const monthKey = `${year}-${month.key}`;
            const result = monthlyResults[monthKey] || 0;
            const previousLoss = accumulatedLoss;
            const taxableBase = result > 0 ? Math.max(result - previousLoss, 0) : 0;

            if (result < 0) {
                accumulatedLoss = previousLoss + Math.abs(result);
            } else if (result > 0) {
                accumulatedLoss = Math.max(previousLoss - result, 0);
            }

            const taxDue = taxableBase * 0.20;

            rows.push({
                month: month.label,
                monthKey,
                result,
                previousLoss,
                taxableBase,
                lossToCarry: accumulatedLoss,
                taxRate: 20,
                taxDue,
                previousWithheldTaxBalance: 0,
                withheldTaxInMonth: 0,
                withheldTaxToCompensate: 0,
                taxToPay: taxDue,
                taxPaid: 0,
                details: monthlyDetails[monthKey] || []
            });
        });

        reports[year] = rows;
    });

    return {
        reports,
        years
    };
}

function renderFiiFiagroYearReport() {
    const container = document.getElementById('fii-fiagro-report-container');
    const yearSelect = document.getElementById('fii-fiagro-year-select');

    if (!container || !yearSelect) return;

    const year = yearSelect.value;
    const rows = fiiFiagroAnnualReports[year] || [];

    if (!year || !rows.length) {
        container.innerHTML = '<p class="empty-state">Nenhum dado disponível para o ano selecionado.</p>';
        return;
    }

    fiiFiagroLastCopiedRows = rows;

    const totalTaxDue = rows.reduce((acc, r) => acc + r.taxDue, 0);
    const totalTaxToPay = rows.reduce((acc, r) => acc + r.taxToPay, 0);
    const yearEndLoss = rows[rows.length - 1]?.lossToCarry || 0;
    const monthsWithSales = rows.filter(r => r.details.length > 0).length;

    const tableRows = rows.map(r => `
        <tr>
            <th scope="row">${r.month}</th>
            ${renderFiiFiagroMoney(r.result)}
            ${renderFiiFiagroMoney(r.previousLoss)}
            ${renderFiiFiagroMoney(r.taxableBase)}
            ${renderFiiFiagroMoney(r.lossToCarry)}
            <td class="fii-fiagro-amount">${formatTaxNumber(r.taxRate)}%</td>
            ${renderFiiFiagroMoney(r.taxDue)}
            ${renderFiiFiagroMoney(r.previousWithheldTaxBalance)}
            ${renderFiiFiagroMoney(r.withheldTaxInMonth)}
            ${renderFiiFiagroMoney(r.withheldTaxToCompensate)}
            ${renderFiiFiagroMoney(r.taxToPay)}
            ${renderFiiFiagroMoney(r.taxPaid)}
        </tr>
    `).join('');

    const detailRows = rows
        .flatMap(r => r.details.map(d => ({ ...d, month: r.month })))
        .map(d => `
            <tr>
                <td>${formatDateBRL(d.date)}</td>
                <td><span class="ticker-badge">${d.ticker}</span></td>
                <td class="amount">${d.quantity.toLocaleString('pt-BR', { maximumFractionDigits: 8 })}</td>
                <td class="amount">${formatCurrencyBRL(d.saleRevenue)}</td>
                <td class="amount">${formatCurrencyBRL(d.saleCost)}</td>
                <td class="amount">${formatCurrencyBRL(d.taxes)}</td>
                <td class="amount ${d.result < 0 ? 'danger' : 'success'}">${formatCurrencyBRL(d.result)}</td>
            </tr>
        `)
        .join('');

    container.innerHTML = `
        <div class="fii-fiagro-summary-grid">
            <div class="summary-card">
                <div class="summary-card-label">Meses com venda</div>
                <div class="summary-card-value">${monthsWithSales}</div>
            </div>

            <div class="summary-card">
                <div class="summary-card-label">Prejuízo a compensar em DEZ</div>
                <div class="summary-card-value ${yearEndLoss > 0 ? 'danger' : ''}">${formatCurrencyBRL(yearEndLoss)}</div>
            </div>

            <div class="summary-card">
                <div class="summary-card-label">Imposto devido no ano</div>
                <div class="summary-card-value ${totalTaxDue > 0 ? 'danger' : ''}">${formatCurrencyBRL(totalTaxDue)}</div>
            </div>

            <div class="summary-card">
                <div class="summary-card-label">Imposto a pagar</div>
                <div class="summary-card-value ${totalTaxToPay > 0 ? 'danger' : 'success'}">${formatCurrencyBRL(totalTaxToPay)}</div>
            </div>
        </div>

        <div class="fii-fiagro-note">
            Os campos de IR fonte ficam como 0,00 porque o histórico de operações não possui um campo separado para IRRF.
            Confira com as notas de corretagem/informe da corretora antes de transmitir a declaração.
        </div>

        <div class="fii-fiagro-table-scroll">
            <table class="fii-fiagro-table" id="fii-fiagro-tax-table">
                <thead>
                    <tr>
                        <th>Mês</th>
                        <th>Resultado líquido do mês</th>
                        <th>Resultado negativo até o mês anterior</th>
                        <th>Base de cálculo do imposto</th>
                        <th>Prejuízo a compensar</th>
                        <th>Alíquota do imposto</th>
                        <th>Imposto devido</th>
                        <th>Saldo do imposto retido nos meses anteriores<br><small>Lei 11.033/2004</small></th>
                        <th>Imposto retido no mês<br><small>Lei 11.033/2004</small></th>
                        <th>Imposto a compensar<br><small>Lei 11.033/2004</small></th>
                        <th>Imposto a pagar</th>
                        <th>Imposto pago</th>
                    </tr>
                </thead>

                <tbody>
                    ${tableRows}
                </tbody>
            </table>
        </div>

        <details class="fii-fiagro-details">
            <summary>Ver operações que compõem o resultado de ${year}</summary>

            ${detailRows ? `
                <div class="table-scroll" style="margin-top: 1rem;">
                    <table class="history-table">
                        <thead>
                            <tr>
                                <th>Data</th>
                                <th>Ativo</th>
                                <th>Qtd.</th>
                                <th>Venda bruta</th>
                                <th>Custo baixado</th>
                                <th>Taxas</th>
                                <th>Resultado</th>
                            </tr>
                        </thead>

                        <tbody>
                            ${detailRows}
                        </tbody>
                    </table>
                </div>
            ` : '<p class="empty-state">Nenhuma venda de FII/Fiagro neste ano.</p>'}
        </details>
    `;
}

async function copyFiiFiagroTable() {
    const yearSelect = document.getElementById('fii-fiagro-year-select');
    const rows = fiiFiagroLastCopiedRows || [];

    if (!rows.length || !yearSelect?.value) {
        showToast('Carregue um ano antes de copiar.');
        return;
    }

    const headers = [
        'Mês',
        'Resultado líquido do mês',
        'Resultado negativo até mês anterior',
        'Base de cálculo do imposto',
        'Prejuízo a compensar',
        'Alíquota do imposto',
        'Imposto devido',
        'Saldo IRRF anteriores',
        'IRRF no mês',
        'IRRF a compensar',
        'Imposto a pagar',
        'Imposto pago'
    ];

    const lines = [headers.join('\t')].concat(
        rows.map(r => [
            r.month,
            formatTaxNumber(r.result),
            formatTaxNumber(r.previousLoss),
            formatTaxNumber(r.taxableBase),
            formatTaxNumber(r.lossToCarry),
            `${formatTaxNumber(r.taxRate)}%`,
            formatTaxNumber(r.taxDue),
            formatTaxNumber(r.previousWithheldTaxBalance),
            formatTaxNumber(r.withheldTaxInMonth),
            formatTaxNumber(r.withheldTaxToCompensate),
            formatTaxNumber(r.taxToPay),
            formatTaxNumber(r.taxPaid)
        ].join('\t'))
    );

    try {
        await navigator.clipboard.writeText(lines.join('\n'));
        showToast(`Tabela de FIIs/Fiagro ${yearSelect.value} copiada!`);
}

// ═══ Authentication UI & Handlers ═══

function setupAuth() {
    const token = localStorage.getItem('token');
    const modalAuth = document.getElementById('modal-auth');
    const btnLogout = document.getElementById('btn-logout');
    
    if (token) {
        if (modalAuth) modalAuth.style.display = 'none';
        if (btnLogout) btnLogout.style.display = 'block';
        initDashboard();
    } else {
        if (modalAuth) modalAuth.style.display = 'flex';
        if (btnLogout) btnLogout.style.display = 'none';
    }
}

function switchAuthTab(tab) {
    document.querySelectorAll('.auth-tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.auth-tab-content').forEach(content => content.classList.remove('active'));
    
    if (tab === 'login') {
        const loginBtn = document.querySelector('.auth-tab-btn[onclick*="login"]');
        if (loginBtn) loginBtn.classList.add('active');
        const loginTab = document.getElementById('auth-tab-login');
        if (loginTab) loginTab.classList.add('active');
    } else {
        const registerBtn = document.querySelector('.auth-tab-btn[onclick*="register"]');
        if (registerBtn) registerBtn.classList.add('active');
        const registerTab = document.getElementById('auth-tab-register');
        if (registerTab) registerTab.classList.add('active');
    }
}

function logout() {
    localStorage.removeItem('token');
    // Refresh to completely clear state and block screen with login modal
    window.location.reload();
}

// Form Handlers
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const loginError = document.getElementById('login-error');
    const registerError = document.getElementById('register-error');
    
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (loginError) loginError.textContent = '';
            
            const fd = new FormData(loginForm);
            const data = Object.fromEntries(fd.entries());
            
            try {
                const res = await originalFetch(`${API_URL}/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                
                const resData = await res.json();
                if (res.ok) {
                    localStorage.setItem('token', resData.access_token);
                    setupAuth();
                    showToast('Bem-vindo de volta!');
                } else {
                    if (loginError) loginError.textContent = resData.detail || 'Erro ao fazer login.';
                }
            } catch (err) {
                console.error(err);
                if (loginError) loginError.textContent = 'Erro de rede ou servidor off-line.';
            }
        });
    }
    
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (registerError) registerError.textContent = '';
            
            const fd = new FormData(registerForm);
            const data = Object.fromEntries(fd.entries());
            
            try {
                const res = await originalFetch(`${API_URL}/auth/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                
                const resData = await res.json();
                if (res.ok) {
                    // Auto login
                    const loginRes = await originalFetch(`${API_URL}/auth/login`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(data)
                    });
                    
                    const loginData = await loginRes.json();
                    if (loginRes.ok) {
                        localStorage.setItem('token', loginData.access_token);
                        setupAuth();
                        showToast('Conta criada e conectado com sucesso!');
                    } else {
                        switchAuthTab('login');
                        showToast('Conta criada! Por favor, faça login.');
                    }
                } else {
                    if (registerError) registerError.textContent = resData.detail || 'Erro ao criar conta.';
                }
            } catch (err) {
                console.error(err);
                if (registerError) registerError.textContent = 'Erro de rede ou servidor off-line.';
            }
        });
    }
});