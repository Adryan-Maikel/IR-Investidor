import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Label,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList,
  AreaChart, Area
} from 'recharts';
import {
  Wallet,
  Layers,
  TrendingUp,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  PieChart as PieIcon,
  BarChart3,
  Search,
  Receipt,
  Copy,
  Check,
  Coins,
  History,
  ArrowUpRight,
  ArrowLeft,
  Calendar
} from 'lucide-react';
import { getCategoryColor, formatCurrency, formatNumber } from '../utils/categories';

const CHART_COLOR = 'var(--theme-accent)';
const CHART_GRID = 'var(--theme-chart-grid)';
const CHART_AXIS = 'var(--theme-chart-axis)';
const CHART_RING_GAP = 'var(--theme-chart-ring-gap)';


const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const MONTH_NAME_TO_NUMBER = {
  jan: 1, janeiro: 1,
  fev: 2, fevereiro: 2,
  mar: 3, marco: 3, março: 3,
  abr: 4, abril: 4,
  mai: 5, maio: 5,
  jun: 6, junho: 6,
  jul: 7, julho: 7,
  ago: 8, agosto: 8,
  set: 9, setembro: 9,
  out: 10, outubro: 10,
  nov: 11, novembro: 11,
  dez: 12, dezembro: 12,
};

function readNumber(source, keys) {
  if (!source || typeof source !== 'object') return null;
  for (const key of keys) {
    const rawValue = source[key];
    if (rawValue === null || rawValue === undefined || rawValue === '') continue;
    const value = Number(rawValue);
    if (Number.isFinite(value)) return value;
  }
  return null;
}

function parseMonthNumber(value) {
  if (value === null || value === undefined) return null;

  if (typeof value === 'number' && value >= 1 && value <= 12) {
    return Math.trunc(value);
  }

  const normalized = String(value).trim().toLowerCase();
  const numeric = Number(normalized);
  if (Number.isFinite(numeric) && numeric >= 1 && numeric <= 12) {
    return Math.trunc(numeric);
  }

  const compact = normalized
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z]/g, '');

  return MONTH_NAME_TO_NUMBER[compact] || MONTH_NAME_TO_NUMBER[compact.slice(0, 3)] || null;
}

function finalizeMonthlySeries(rows, year) {
  const byMonth = new Map();

  rows.forEach((row) => {
    const month = parseMonthNumber(
      row.month ?? row.monthNumber ?? row.month_number ?? row.monthIndex ?? row.month_index ?? row.label
    );
    const total = readNumber(row, ['total', 'value', 'totalInvested', 'total_invested', 'invested', 'cost']);
    if (!month || total === null) return;

    const assetsCount = readNumber(row, ['assetsCount', 'assets_count', 'count', 'positions', 'activeCount']) ?? 0;
    const current = byMonth.get(month) || { month, total: 0, assetsCount: 0 };
    current.total += total;
    current.assetsCount += assetsCount;
    byMonth.set(month, current);
  });

  let previousTotal = null;
  return [...byMonth.values()]
    .sort((a, b) => a.month - b.month)
    .map((item) => {
      const growth = previousTotal === null ? 0 : item.total - previousTotal;
      const growthPercent = previousTotal && previousTotal > 0 ? (growth / previousTotal) * 100 : 0;
      previousTotal = item.total;

      return {
        ...item,
        year: String(year),
        label: MONTH_LABELS[item.month - 1],
        total: Number(item.total.toFixed(2)),
        growth: Number(growth.toFixed(2)),
        growthPercent: Number(growthPercent.toFixed(1)),
      };
    });
}

function extractEmbeddedMonthlyData(yearlyHoldings, year, selectedCategoryFilter) {
  if (!Array.isArray(yearlyHoldings)) return [];

  const totals = new Map();

  yearlyHoldings.forEach((item) => {
    const yearData = item?.years?.[year];
    const category = item?.category || yearData?.category || 'Ações';
    if (selectedCategoryFilter !== 'ALL' && category !== selectedCategoryFilter) return;

    const monthSource = yearData?.months
      ?? yearData?.monthly
      ?? item?.months?.[year]
      ?? item?.monthly?.[year];

    if (!monthSource) return;

    const entries = Array.isArray(monthSource)
      ? monthSource
      : Object.entries(monthSource).map(([month, data]) => ({ month, ...(data || {}) }));

    entries.forEach((entry) => {
      const month = parseMonthNumber(
        entry.month ?? entry.monthNumber ?? entry.month_number ?? entry.monthIndex ?? entry.month_index ?? entry.label
      );
      const value = readNumber(entry, ['total', 'value', 'totalInvested', 'total_invested', 'invested', 'cost']);
      if (!month || value === null) return;

      const quantity = readNumber(entry, ['quantity', 'qty']);
      const current = totals.get(month) || { month, total: 0, assetsCount: 0 };
      current.total += value;
      if ((quantity !== null && quantity > 0) || (quantity === null && value > 0)) {
        current.assetsCount += 1;
      }
      totals.set(month, current);
    });
  });

  return finalizeMonthlySeries([...totals.values()], year);
}

function normalizeMonthlyResponse(payload, year, selectedCategoryFilter = 'ALL') {
  if (!payload) return [];

  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray(payload.months)
      ? payload.months
      : Array.isArray(payload.data)
        ? payload.data
        : Array.isArray(payload.holdings)
          ? payload.holdings
          : null;

  if (rows) {
    const directRows = rows.filter((row) => {
      if (selectedCategoryFilter === 'ALL') return true;
      const category = row?.category || row?.class || row?.assetCategory;
      return !category || category === selectedCategoryFilter;
    });

    const direct = finalizeMonthlySeries(directRows, year);
    if (direct.length) return direct;

    const totals = [];
    directRows.forEach((item) => {
      const monthSource = item?.months ?? item?.monthly ?? item?.history;
      if (!monthSource) return;

      const entries = Array.isArray(monthSource)
        ? monthSource
        : Object.entries(monthSource).map(([month, data]) => ({ month, ...(data || {}) }));

      entries.forEach((entry) => {
        const total = readNumber(entry, ['total', 'value', 'totalInvested', 'total_invested', 'invested', 'cost']);
        if (total === null) return;

        totals.push({
          ...entry,
          total,
          assetsCount: readNumber(entry, ['assetsCount', 'assets_count', 'count', 'positions', 'activeCount'])
            ?? (readNumber(entry, ['quantity', 'qty']) > 0 ? 1 : 0),
        });
      });
    });

    const nested = finalizeMonthlySeries(totals, year);
    if (nested.length) return nested;
  }

  if (payload.months && !Array.isArray(payload.months) && typeof payload.months === 'object') {
    return finalizeMonthlySeries(
      Object.entries(payload.months).map(([month, data]) => ({ month, ...(data || {}) })),
      year
    );
  }

  const topLevelMonthEntries = Object.entries(payload)
    .filter(([key, value]) => parseMonthNumber(key) && value && typeof value === 'object')
    .map(([month, data]) => ({ month, ...data }));

  return finalizeMonthlySeries(topLevelMonthEntries, year);
}

// --- Skeleton Loader 2.0 ---
function DashboardSkeleton() {
  return (
    <div className="space-y-8 animate-fade-in">
      {/* KPI skeleton */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="surface-panel p-5 rounded-xl flex items-center gap-4">
            <div className="skeleton w-14 h-14 rounded-lg flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="skeleton w-20 h-3 rounded-full" />
              <div className="skeleton w-32 h-6 rounded-lg" />
              <div className="skeleton w-16 h-2.5 rounded-full" />
            </div>
          </div>
        ))}
      </div>

      {/* Charts skeleton (4 of 6 and 2 of 6) */}
      <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-6">
        <div className="surface-panel flex min-h-[620px] flex-col rounded-xl p-6 lg:col-span-4">
          <div className="skeleton mb-5 h-5 w-52 rounded-full" />
          <div className="skeleton min-h-[420px] w-full flex-1 rounded-lg" />
          <div className="mt-4 grid grid-cols-3 gap-3">
            {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-14 rounded-lg" />)}
          </div>
        </div>
        <div className="flex flex-col gap-4 lg:col-span-2">
          <div className="surface-panel rounded-xl p-4">
            <div className="skeleton mb-3 h-4 w-40 rounded-full" />
            <div className="skeleton h-44 w-full rounded-lg" />
          </div>
          <div className="surface-panel flex min-h-[320px] flex-1 flex-col rounded-xl p-5">
            <div className="skeleton mb-3 h-4 w-36 rounded-full" />
            <div className="skeleton min-h-[230px] w-full flex-1 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}

// --- KPI Card 2.0 ---
function KpiCard({ icon: Icon, label, value, subtext, iconColor }) {
  return (
    <div className="kpi group flex items-center gap-3" style={{ borderLeftColor: iconColor }}>
      <div className="kpi-icon flex h-8 w-8 shrink-0 items-center justify-center">
        <Icon className="icon h-6 w-6" style={{ color: iconColor }} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[9px] font-black uppercase tracking-[0.08em] text-[var(--theme-kpi-muted)]">
          {label}
        </p>
        <h3 className="mt-0.5 truncate text-base font-black tracking-tight text-[var(--theme-kpi-text)] sm:text-lg">
          {value}
        </h3>
        {subtext && (
          <p className="mt-0.5 truncate text-[10px] font-medium text-[var(--theme-kpi-muted)]">
            {subtext}
          </p>
        )}
      </div>
    </div>
  );
}

// --- Custom Tooltip for Allocation & Top 5 ---
function ChartTooltip({ active, payload, isPrivate }) {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0];
  const color = CHART_COLOR;
  const name = data.payload?.name || data.name;
  const value = data.value;

  return (
    <div className="surface-modal p-3.5 rounded-lg  border border-zinc-700 text-xs min-w-[170px] animate-fade-in">
      <div className="flex items-center gap-2 mb-1.5">
        <span
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: color }}
        />
        <span className="font-bold text-white text-xs truncate">{name}</span>
      </div>
      <p className="text-sm font-black text-zinc-100 pl-4.5">
        {typeof value === 'number' ? formatCurrency(value, false, isPrivate) : value}
      </p>
      {data.payload?.percent !== undefined && (
        <p className="text-[10px] text-zinc-400 pl-4.5 mt-0.5 font-semibold">
          {(data.payload.percent * 100).toFixed(1)}% da carteira
        </p>
      )}
      {data.payload?.category && (
        <span
          className="inline-block mt-1.5 ml-4.5 text-[9px] font-bold px-2 py-0.5 rounded border"
          style={{
            backgroundColor: 'var(--theme-accent-soft)',
            color,
            borderColor: 'var(--theme-accent-border)'
          }}
        >
          {data.payload.category}
        </span>
      )}
    </div>
  );
}

// --- Custom Tooltip for Evolution Line Chart ---
function EvolutionTooltip({ active, payload, label, isPrivate, viewMode = 'year', selectedYear = null }) {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0].payload;
  const isPositive = data.growth >= 0;
  const title = viewMode === 'month' ? `${label} ${selectedYear}` : `Ano ${label}`;
  const variationLabel = viewMode === 'month' ? 'Variação vs mês anterior:' : 'Variação vs anterior:';

  return (
    <div className="surface-modal min-w-[210px] rounded-lg p-4 text-xs animate-fade-in">
      <div className="mb-2 flex items-center justify-between gap-2 border-b border-zinc-700 pb-2">
        <span className="text-sm font-extrabold text-white">{title}</span>
        <span className="chart-badge rounded-full px-2 py-0.5 text-[10px] font-bold">
          {data.assetsCount} {data.assetsCount === 1 ? 'ativo' : 'ativos'}
        </span>
      </div>

      <div className="space-y-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Patrimônio Acumulado (Custo)</p>
          <p className="mt-0.5 text-base font-black text-white">
            {formatCurrency(data.total, false, isPrivate)}
          </p>
        </div>

        {data.growth !== 0 && (
          <div className="flex items-center justify-between border-t border-zinc-700 pt-2 text-[11px]">
            <span className="text-zinc-400">{variationLabel}</span>
            <span className={`flex items-center gap-0.5 font-bold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
              {isPositive ? '+' : ''}{formatCurrency(data.growth, false, isPrivate)} ({isPositive ? '+' : ''}{data.growthPercent}%)
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Allocation Donut: clean, proportional and interactive ---
function AllocationTooltip({ active = false, payload = [], isPrivate = false }) {
  if (!active || !payload?.length) return null;

  const item = payload[0]?.payload;
  if (!item) return null;

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900 px-3.5 py-3   min-w-[170px]">
      <div className="flex items-center gap-2 mb-2">
        <span
          className="h-2.5 w-2.5 rounded-full shrink-0"
          style={{ backgroundColor: CHART_COLOR }}
        />
        <span className="text-xs font-bold text-white truncate">{item.name}</span>
      </div>
      <p className="text-sm font-black text-white tabular-nums">
        {formatCurrency(item.value, false, isPrivate)}
      </p>
      <div className="mt-1.5 flex items-center justify-between gap-4 text-[10px] font-semibold">
        <span className="text-zinc-500">{item.count} {item.count === 1 ? 'ativo' : 'ativos'}</span>
        <span style={{ color: CHART_COLOR }}>{(item.percent * 100).toFixed(1)}% da carteira</span>
      </div>
    </div>
  );
}

function AllocationCalloutLabel({ viewBox, item }) {
  if (!viewBox || !item) return null;

  const cx = Number(viewBox.cx) || 0;
  const cy = Number(viewBox.cy) || 0;
  const outerRadius = Number(viewBox.outerRadius) || 0;
  const anchorX = cx + outerRadius * 0.9;
  const anchorY = cy - outerRadius * 0.28;
  const elbowX = anchorX + 18;
  const endX = elbowX + 34;
  const textX = endX + 7;
  const percentage = `${(item.percent * 100).toFixed(1)}%`;

  return (
    <g className="pointer-events-none">
      <path
        d={`M ${anchorX} ${anchorY} L ${elbowX} ${anchorY - 8} L ${endX} ${anchorY - 8}`}
        fill="none"
        stroke={CHART_COLOR}
        strokeWidth="1"
        strokeLinecap="round"
      />
      <circle cx={anchorX} cy={anchorY} r="2" fill={CHART_COLOR} />
      <text
        x={textX}
        y={anchorY - 11}
        fill="var(--theme-text)"
        fontSize="10"
        fontWeight="800"
      >
        {item.name}
      </text>
      <text
        x={textX}
        y={anchorY + 4}
        fill={CHART_COLOR}
        fontSize="10"
        fontWeight="900"
      >
        {percentage}
      </text>
    </g>
  );
}

function AllocationDonut({
  data = [],
  totalValue = 0,
  isPrivate = false,
  selectedCategory = 'ALL',
  onSelectCategory
}) {
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const visibleData = useMemo(
    () => data.filter(item => Number(item.value) > 0),
    [data]
  );

  if (visibleData.length === 0) {
    return (
      <div className="flex h-[196px] flex-col items-center justify-center p-4 text-center text-xs text-zinc-500">
        <Layers className="mb-2 h-7 w-7 text-zinc-600 stroke-[1.5]" />
        <p className="font-semibold">Nenhuma posição alocada</p>
        <p className="mt-0.5 text-[11px] text-zinc-600">Cadastre compras para ver a divisão.</p>
      </div>
    );
  }

  const selectedIndex = visibleData.findIndex(item => item.name === selectedCategory);
  const focusIndex = hoveredIndex !== null ? hoveredIndex : selectedIndex;
  const focusItem = focusIndex >= 0 ? visibleData[focusIndex] : null;
  const displayItem = focusItem || visibleData[0];
  const hasSelection = selectedCategory !== 'ALL' && selectedIndex >= 0;

  const toggleCategory = (category) => {
    if (!onSelectCategory) return;
    onSelectCategory(selectedCategory === category ? 'ALL' : category);
  };

  return (
    <div className="relative mt-1">
      <div className="relative h-[202px] w-full overflow-visible">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart className="chart-clean-focus">
            <Pie
              data={visibleData}
              dataKey="value"
              nameKey="name"
              cx="36%"
              cy="52%"
              innerRadius="68%"
              outerRadius="93%"
              paddingAngle={1.5}
              cornerRadius={3}
              startAngle={90}
              endAngle={-270}
              stroke={CHART_RING_GAP}
              strokeWidth={2}
              isAnimationActive
              animationDuration={600}
              animationEasing="ease-out"
            >
              {visibleData.map((item, index) => {
                const isSelected = selectedCategory === item.name;
                const isHovered = hoveredIndex === index;

                return (
                  <Cell
                    key={`allocation-${item.name}`}
                    fill={CHART_COLOR}
                    fillOpacity={hasSelection && !isSelected ? 0.2 : isHovered ? 1 : 0.92}
                    stroke={CHART_RING_GAP}
                    strokeWidth={2}
                    className="cursor-pointer outline-none transition-opacity duration-200"
                    onMouseEnter={() => setHoveredIndex(index)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    onClick={() => toggleCategory(item.name)}
                  />
                );
              })}
              <Label content={(props) => <AllocationCalloutLabel {...props} item={displayItem} />} />
            </Pie>
            <Tooltip
              cursor={false}
              content={<AllocationTooltip isPrivate={isPrivate} />}
              wrapperStyle={{ outline: 'none', zIndex: 30 }}
            />
          </PieChart>
        </ResponsiveContainer>

        <div
          className="pointer-events-none absolute top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center text-center"
          style={{ left: '36%', width: 108 }}
        >
          <div className="max-w-[100px]">
            <span className="block truncate text-[8px] font-black uppercase tracking-[0.12em] text-zinc-500">
              {focusItem ? focusItem.name : 'Total alocado'}
            </span>
            <span className="mt-1 block text-base font-black tracking-tight text-white tabular-nums">
              {formatCurrency(focusItem ? focusItem.value : totalValue, true, isPrivate)}
            </span>
            <span className="mt-0.5 block text-[9px] font-extrabold tabular-nums text-indigo-300">
              {focusItem
                ? `${(focusItem.percent * 100).toFixed(1)}% da carteira`
                : `${visibleData.length} ${visibleData.length === 1 ? 'classe' : 'classes'}`}
            </span>
          </div>
        </div>
      </div>

      {hasSelection && (
        <button
          type="button"
          onClick={() => onSelectCategory?.('ALL')}
          className="absolute bottom-0 right-0 rounded-md px-2 py-1 text-[9px] font-bold text-indigo-300 hover:bg-zinc-900 hover:text-indigo-400"
        >
          Limpar filtro
        </button>
      )}
    </div>
  );
}

export default function DashboardView({
  fetchWithAuth,
  setToast,
  isPrivate = false
}) {
  const [holdings, setHoldings] = useState([]);
  const [yearlyHoldings, setYearlyHoldings] = useState([]);
  const [inconsistencies, setInconsistencies] = useState([]);
  const [categoryColors, setCategoryColors] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedTicker, setCopiedTicker] = useState(null);
  const [selectedEvolutionYear, setSelectedEvolutionYear] = useState(null);
  const [monthlyEvolutionData, setMonthlyEvolutionData] = useState([]);
  const [isLoadingMonthly, setIsLoadingMonthly] = useState(false);
  const [monthlyLoadError, setMonthlyLoadError] = useState('');
  const monthlyCacheRef = useRef(new Map());

  const loadData = async (showFeedback = false) => {
    if (showFeedback) setIsRefreshing(true);
    try {
      const [holdingsRes, incRes, settingsRes, yearlyRes] = await Promise.all([
        fetchWithAuth('/api/holdings'),
        fetchWithAuth('/api/check-inconsistencies'),
        fetchWithAuth('/api/settings'),
        fetchWithAuth('/api/yearly-holdings'),
      ]);

      if (holdingsRes.ok) {
        setHoldings(await holdingsRes.json());
      }
      if (incRes.ok) {
        setInconsistencies(await incRes.json());
      }
      if (settingsRes.ok) {
        const settings = await settingsRes.json();
        setCategoryColors(settings.category_colors || {});
      }
      if (yearlyRes.ok) {
        setYearlyHoldings(await yearlyRes.json());
      }

      if (showFeedback && setToast) {
        setToast({ message: 'Dados da carteira sincronizados!', type: 'success' });
      }
    } catch (err) {
      if (setToast) {
        setToast({ message: 'Falha ao sincronizar dados do dashboard.', type: 'error' });
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      if (showFeedback) {
        window.dispatchEvent(new CustomEvent('dashboard-refresh-state', { detail: { loading: false } }));
      }
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const handleRefresh = () => loadData(true);
    window.addEventListener('refresh-data', handleRefresh);
    return () => window.removeEventListener('refresh-data', handleRefresh);
  }, []);

  // Filter active holdings (quantity > 0)
  const activeHoldings = useMemo(() => {
    return holdings.filter(h => h.quantity > 0);
  }, [holdings]);

  // Holdings filtered by selected category filter and search query
  const filteredHoldings = useMemo(() => {
    return activeHoldings.filter(h => {
      const matchesCategory = selectedCategoryFilter === 'ALL' || (h.category || 'Ações') === selectedCategoryFilter;
      const matchesSearch = !searchQuery.trim() ||
        h.ticker.toUpperCase().includes(searchQuery.toUpperCase().trim()) ||
        (h.name && h.name.toUpperCase().includes(searchQuery.toUpperCase().trim())) ||
        (h.cnpj && h.cnpj.includes(searchQuery.trim()));
      return matchesCategory && matchesSearch;
    });
  }, [activeHoldings, selectedCategoryFilter, searchQuery]);

  // Aggregate totals
  const totalInvestedGlobal = useMemo(() => {
    return activeHoldings.reduce((acc, h) => acc + (h.total_invested || 0), 0);
  }, [activeHoldings]);

  const totalInvestedFiltered = useMemo(() => {
    return filteredHoldings.reduce((acc, h) => acc + (h.total_invested || 0), 0);
  }, [filteredHoldings]);

  // Aggregate by Category for Donut Chart
  const categorySummary = useMemo(() => {
    const map = {};
    activeHoldings.forEach(h => {
      const cat = h.category || 'Ações';
      if (!map[cat]) {
        map[cat] = { category: cat, totalInvested: 0, count: 0 };
      }
      map[cat].totalInvested += (h.total_invested || 0);
      map[cat].count += 1;
    });

    return Object.values(map)
      .map((item, idx) => ({
        ...item,
        color: getCategoryColor(item.category, categoryColors, idx),
        percent: totalInvestedGlobal > 0 ? (item.totalInvested / totalInvestedGlobal) : 0
      }))
      .sort((a, b) => b.totalInvested - a.totalInvested);
  }, [activeHoldings, totalInvestedGlobal, categoryColors]);

  // Pie chart data
  const pieData = useMemo(() => {
    return categorySummary.map(item => ({
      name: item.category,
      value: parseFloat(item.totalInvested.toFixed(2)),
      color: item.color,
      percent: item.percent,
      count: item.count
    }));
  }, [categorySummary]);

  // Yearly Evolution Data for Historical Line Chart
  const yearlyEvolutionData = useMemo(() => {
    if (!yearlyHoldings || yearlyHoldings.length === 0) {
      if (activeHoldings.length > 0) {
        const currentYear = new Date().getFullYear().toString();
        return [{
          year: currentYear,
          total: totalInvestedFiltered,
          assetsCount: filteredHoldings.length,
          growth: 0,
          growthPercent: 0
        }];
      }
      return [];
    }

    const yearsSet = new Set();
    yearlyHoldings.forEach(item => {
      if (item.years) {
        Object.keys(item.years).forEach(y => yearsSet.add(y));
      }
    });

    const sortedYears = Array.from(yearsSet).sort();
    if (sortedYears.length === 0) return [];

    let previousTotal = 0;
    return sortedYears.map((year, idx) => {
      const filteredYearHoldings = yearlyHoldings.filter(item => {
        if (selectedCategoryFilter === 'ALL') return true;
        const cat = item.category || (item.years[year] && item.years[year].category) || 'Ações';
        return cat === selectedCategoryFilter;
      });

      let yearTotal = 0;
      let activeInYearCount = 0;

      filteredYearHoldings.forEach(item => {
        const yData = item.years && item.years[year];
        if (yData && yData.quantity > 0) {
          yearTotal += (yData.value || 0);
          activeInYearCount += 1;
        }
      });

      yearTotal = parseFloat(yearTotal.toFixed(2));
      const growth = idx === 0 ? 0 : (yearTotal - previousTotal);
      const growthPercent = (idx > 0 && previousTotal > 0) ? ((growth / previousTotal) * 100) : 0;
      previousTotal = yearTotal;

      return {
        year,
        total: yearTotal,
        assetsCount: activeInYearCount,
        growth: parseFloat(growth.toFixed(2)),
        growthPercent: parseFloat(growthPercent.toFixed(1))
      };
    });
  }, [yearlyHoldings, selectedCategoryFilter, activeHoldings, totalInvestedFiltered, filteredHoldings]);

  // Pre-fetch / cache all years monthly data in background for zero-latency zoom
  useEffect(() => {
    if (!yearlyHoldings || yearlyHoldings.length === 0) return;

    const yearsSet = new Set();
    yearlyHoldings.forEach(item => {
      if (item.years) {
        Object.keys(item.years).forEach(y => yearsSet.add(y));
      }
    });

    yearsSet.forEach(async (year) => {
      const cacheKey = `${year}_${selectedCategoryFilter}`;
      if (monthlyCacheRef.current.has(cacheKey)) return;

      const embedded = extractEmbeddedMonthlyData(yearlyHoldings, year, selectedCategoryFilter);
      if (embedded.length) {
        monthlyCacheRef.current.set(cacheKey, embedded);
        return;
      }

      try {
        const response = await fetchWithAuth(
          `/api/monthly-holdings?year=${encodeURIComponent(year)}${selectedCategoryFilter !== 'ALL' ? `&category=${encodeURIComponent(selectedCategoryFilter)}` : ''}`
        );
        if (response.ok) {
          const payload = await response.json();
          const normalized = normalizeMonthlyResponse(payload, year, selectedCategoryFilter);
          if (normalized.length) {
            monthlyCacheRef.current.set(cacheKey, normalized);
          }
        }
      } catch (e) {
        // quiet prefetch fail
      }
    });
  }, [yearlyHoldings, selectedCategoryFilter]);

  useEffect(() => {
    if (!selectedEvolutionYear) {
      setMonthlyEvolutionData([]);
      setMonthlyLoadError('');
      setIsLoadingMonthly(false);
      return;
    }

    const cacheKey = `${selectedEvolutionYear}_${selectedCategoryFilter}`;
    if (monthlyCacheRef.current.has(cacheKey)) {
      setMonthlyEvolutionData(monthlyCacheRef.current.get(cacheKey));
      setIsLoadingMonthly(false);
      return;
    }

    let cancelled = false;

    const loadMonthlyEvolution = async () => {
      setIsLoadingMonthly(true);
      setMonthlyLoadError('');

      const embedded = extractEmbeddedMonthlyData(
        yearlyHoldings,
        selectedEvolutionYear,
        selectedCategoryFilter
      );

      if (embedded.length) {
        monthlyCacheRef.current.set(cacheKey, embedded);
        if (!cancelled) {
          setMonthlyEvolutionData(embedded);
          setIsLoadingMonthly(false);
        }
        return;
      }

      try {
        const response = await fetchWithAuth(
          `/api/monthly-holdings?year=${encodeURIComponent(selectedEvolutionYear)}${selectedCategoryFilter !== 'ALL' ? `&category=${encodeURIComponent(selectedCategoryFilter)}` : ''}`
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const payload = await response.json();
        const normalized = normalizeMonthlyResponse(payload, selectedEvolutionYear, selectedCategoryFilter);

        if (!cancelled) {
          if (normalized.length) {
            monthlyCacheRef.current.set(cacheKey, normalized);
          }
          setMonthlyEvolutionData(normalized);
          setMonthlyLoadError(
            normalized.length
              ? ''
              : 'O backend respondeu, mas não retornou histórico mensal para este ano.'
          );
        }
      } catch (error) {
        if (!cancelled) {
          setMonthlyEvolutionData([]);
          setMonthlyLoadError(
            'O histórico mensal ainda não está disponível para este ano.'
          );
        }
      } finally {
        if (!cancelled) setIsLoadingMonthly(false);
      }
    };

    loadMonthlyEvolution();

    return () => {
      cancelled = true;
    };
  }, [selectedEvolutionYear, selectedCategoryFilter, yearlyHoldings]);

  const handleEvolutionChartClick = (chartState) => {
    if (selectedEvolutionYear) return;

    const year = chartState?.activePayload?.[0]?.payload?.year ?? chartState?.activeLabel;
    if (year) {
      const yearStr = String(year);
      const cacheKey = `${yearStr}_${selectedCategoryFilter}`;
      if (monthlyCacheRef.current.has(cacheKey)) {
        setMonthlyEvolutionData(monthlyCacheRef.current.get(cacheKey));
      }
      setSelectedEvolutionYear(yearStr);
    }
  };

  const closeMonthlyEvolution = () => {
    setSelectedEvolutionYear(null);
    setMonthlyEvolutionData([]);
    setMonthlyLoadError('');
  };

  const activeEvolutionData = selectedEvolutionYear ? monthlyEvolutionData : yearlyEvolutionData;
  const activeEvolutionDataKey = selectedEvolutionYear ? 'label' : 'year';
  const activeEvolutionLast = activeEvolutionData.length
    ? activeEvolutionData[activeEvolutionData.length - 1]
    : null;

  // Evolution summary metrics
  const evolutionSummary = useMemo(() => {
    if (yearlyEvolutionData.length === 0) {
      return { firstYear: '-', lastYear: '-', totalGrowth: 0, growthPercent: 0 };
    }
    const first = yearlyEvolutionData[0];
    const last = yearlyEvolutionData[yearlyEvolutionData.length - 1];
    const totalGrowth = last.total - first.total;
    const growthPercent = first.total > 0 ? ((totalGrowth / first.total) * 100) : 0;

    return {
      firstYear: first.year,
      lastYear: last.year,
      totalGrowth,
      growthPercent: growthPercent.toFixed(1)
    };
  }, [yearlyEvolutionData]);

  // Top 5 Positions for Bar Chart (Filtered or Global)
  const barData = useMemo(() => {
    return [...filteredHoldings]
      .sort((a, b) => (b.total_invested || 0) - (a.total_invested || 0))
      .slice(0, 5)
      .map((h, idx) => ({
        name: h.ticker,
        Valor: parseFloat((h.total_invested || 0).toFixed(2)),
        category: h.category || 'Ações',
        color: getCategoryColor(h.category, categoryColors, idx),
        percent: totalInvestedGlobal > 0 ? (h.total_invested / totalInvestedGlobal) : 0
      }));
  }, [filteredHoldings, categoryColors, totalInvestedGlobal]);

  // Format Y Axis for Bar and Line Charts
  const formatYAxis = (val) => {
    if (isPrivate) return '•••';
    if (val >= 1000000) return `R$${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `R$${(val / 1000).toFixed(0)}k`;
    return `R$${val}`;
  };

  const handleCopyIR = (h) => {
    const text = `${h.category || 'AÇÕES'} - ${h.ticker} (${h.name || h.razao_social || h.ticker}) - CNPJ: ${h.cnpj || 'N/A'}. QUANTIDADE: ${h.quantity} COTAS. CUSTO TOTAL: ${formatCurrency(h.total_invested, false, false)}. PREÇO MÉDIO: ${formatCurrency(h.average_price, false, false)}.`;
    navigator.clipboard.writeText(text);
    setCopiedTicker(h.ticker);
    setTimeout(() => setCopiedTicker(null), 2000);
    if (setToast) {
      setToast({ message: `Descrição de ${h.ticker} copiada para declaração!`, type: 'success' });
    }
  };

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-7 animate-fade-in pb-12">
      {/* 4 Real KPIs (Icon on Left, Text beside it) */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* KPI 1: Patrimônio Alocado */}
        <KpiCard
          icon={Wallet}
          label={selectedCategoryFilter === 'ALL' ? "Patrimônio Total" : `Patrimônio em ${selectedCategoryFilter}`}
          value={formatCurrency(totalInvestedFiltered, false, isPrivate)}
          subtext={
            selectedCategoryFilter === 'ALL'
              ? `${activeHoldings.length} ativos em custódia`
              : `${filteredHoldings.length} ativo(s) nesta classe`
          }
          iconColor="var(--theme-accent)"
        />

        {/* KPI 2: Custo Médio & Aquisição */}
        <KpiCard
          icon={Receipt}
          label="Base de Aquisição"
          value={formatCurrency(totalInvestedFiltered, false, isPrivate)}
          subtext="Base legal para ganho de capital"
          iconColor="var(--theme-accent)"
        />

        {/* KPI 3: Classes & Diversificação */}
        <KpiCard
          icon={TrendingUp}
          label="Diversificação"
          value={
            selectedCategoryFilter === 'ALL'
              ? `${categorySummary.length} classes`
              : `${((totalInvestedFiltered / (totalInvestedGlobal || 1)) * 100).toFixed(1)}% carteira`
          }
          subtext={
            selectedCategoryFilter === 'ALL'
              ? `${activeHoldings.length} posições abertas`
              : `Alocação em ${selectedCategoryFilter}`
          }
          iconColor="var(--theme-accent)"
        />

        {/* KPI 4: Conformidade Fiscal */}
        <KpiCard
          icon={inconsistencies.length === 0 ? ShieldCheck : AlertTriangle}
          label="Conformidade Fiscal"
          value={inconsistencies.length === 0 ? "100% Regular" : `${inconsistencies.length} pendência${inconsistencies.length > 1 ? 's' : ''}`}
          subtext={inconsistencies.length === 0 ? "Histórico sem divergências" : "Revisão necessária"}
          iconColor={inconsistencies.length === 0 ? "var(--theme-accent)" : "var(--theme-warning)"}
        />
      </div>

      {/* Main Charts Grid: line chart fills the tall column; side cards stay compact */}
      <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-6">

        {/* LEFT COLUMN: Evolução do Patrimônio */}
        <div className="surface-panel relative flex min-h-[620px] flex-col overflow-hidden rounded-xl p-5 sm:p-6 lg:col-span-4">
          <div className="mb-3 flex shrink-0 flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div className="flex min-w-0 items-center gap-3">
              <div className="chart-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
                <History className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h3 className="flex flex-wrap items-center gap-2 text-base font-bold text-white">
                  {selectedEvolutionYear ? `Evolução em ${selectedEvolutionYear}` : 'Evolução do Patrimônio'}
                  {selectedCategoryFilter !== 'ALL' && (
                    <span className="chart-badge rounded-full px-2 py-0.5 text-[11px] font-semibold">
                      {selectedCategoryFilter}
                    </span>
                  )}
                </h3>
                <p className="text-[11px] text-zinc-400">
                  {selectedEvolutionYear
                    ? `Detalhamento mês a mês de ${selectedEvolutionYear} (custo de aquisição)`
                    : 'Clique em um ano para abrir o detalhamento mês a mês'}
                </p>
              </div>
            </div>

            {selectedEvolutionYear ? (
              <div className="flex shrink-0 items-center gap-2 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={closeMonthlyEvolution}
                  className="theme-control flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] font-bold cursor-pointer"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Voltar para anos
                </button>
                <span className="chart-badge flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wide">
                  {selectedEvolutionYear} · mensal
                  {isLoadingMonthly && <RefreshCw className="h-3 w-3 animate-spin text-indigo-400" />}
                </span>
              </div>
            ) : yearlyEvolutionData.length > 1 ? (
              <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-1.5">
                <span className="text-[10px] font-bold uppercase text-zinc-400">
                  Período {evolutionSummary.firstYear} - {evolutionSummary.lastYear}:
                </span>
                <span className={`flex items-center gap-0.5 text-xs font-black ${evolutionSummary.totalGrowth >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                  {evolutionSummary.totalGrowth >= 0 ? '+' : ''}{evolutionSummary.growthPercent}%
                </span>
              </div>
            ) : null}
          </div>

          {yearlyEvolutionData.length === 0 ? (
            <div className="flex min-h-[360px] flex-1 flex-col items-center justify-center p-6 text-center text-xs text-zinc-500">
              <Calendar className="mb-2 h-8 w-8 text-zinc-600 stroke-[1.5]" />
              <p className="font-semibold">Nenhum histórico anual disponível</p>
              <p className="mt-0.5 text-[11px] text-zinc-600">Cadastre transações para visualizar o gráfico de acumulação.</p>
            </div>
          ) : (
            <div className={`chart-clean-focus min-h-[360px] w-full flex-1 pt-2 ${selectedEvolutionYear ? '' : 'cursor-pointer'}`}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={activeEvolutionData}
                  margin={{ top: 14, right: 10, left: -4, bottom: 2 }}
                  onClick={selectedEvolutionYear ? undefined : handleEvolutionChartClick}
                  className="chart-clean-focus"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} vertical={false} />
                  <XAxis
                    dataKey={activeEvolutionDataKey}
                    tick={{ fill: CHART_AXIS, fontSize: 11, fontWeight: 700 }}
                    axisLine={{ stroke: CHART_GRID }}
                    tickLine={false}
                    interval={selectedEvolutionYear ? 0 : 'preserveStartEnd'}
                  />
                  <YAxis
                    tickFormatter={formatYAxis}
                    tick={{ fill: CHART_AXIS, fontSize: 10, fontWeight: 600 }}
                    axisLine={false}
                    tickLine={false}
                    width={60}
                  />
                  <Tooltip
                    cursor={{ stroke: 'var(--theme-border-strong)', strokeWidth: 1, strokeDasharray: '4 4' }}
                    content={(
                      <EvolutionTooltip
                        isPrivate={isPrivate}
                        viewMode={selectedEvolutionYear ? 'month' : 'year'}
                        selectedYear={selectedEvolutionYear}
                      />
                    )}
                    wrapperStyle={{ outline: 'none' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="total"
                    stroke={CHART_COLOR}
                    strokeWidth={3}
                    fillOpacity={0}
                    fill="transparent"
                    isAnimationActive={true}
                    animationDuration={600}
                    animationEasing="ease-in-out"
                    dot={{ r: 3.5, fill: CHART_COLOR, stroke: CHART_RING_GAP, strokeWidth: 2 }}
                    activeDot={{ r: 5, fill: CHART_COLOR, stroke: CHART_RING_GAP, strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="mt-3 grid shrink-0 grid-cols-2 gap-2.5 border-t border-zinc-800 pt-3 text-xs sm:grid-cols-3">
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-2.5 py-2">
              <span className="block text-[9px] font-bold uppercase tracking-wider text-zinc-400">
                {selectedEvolutionYear ? 'Fechamento do período' : 'Acumulado atual'}
              </span>
              <span className="mt-0.5 block text-sm font-black text-white">
                {formatCurrency(
                  selectedEvolutionYear ? (activeEvolutionLast?.total || 0) : totalInvestedFiltered,
                  false,
                  isPrivate
                )}
              </span>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-2.5 py-2">
              <span className="block text-[9px] font-bold uppercase tracking-wider text-zinc-400">
                {selectedEvolutionYear ? 'Meses registrados' : 'Anos registrados'}
              </span>
              <span className="mt-0.5 block text-sm font-black text-indigo-300">
                {selectedEvolutionYear
                  ? `${activeEvolutionData.length} ${activeEvolutionData.length === 1 ? 'mês' : 'meses'}`
                  : `${yearlyEvolutionData.length} ${yearlyEvolutionData.length === 1 ? 'ano' : 'anos fiscais'}`}
              </span>
            </div>
            <div className="col-span-2 rounded-lg border border-zinc-800 bg-zinc-950/40 px-2.5 py-2 sm:col-span-1">
              <span className="block text-[9px] font-bold uppercase tracking-wider text-zinc-400">
                {selectedEvolutionYear ? 'Ativos no fechamento' : 'Ativos atuais'}
              </span>
              <span className="mt-0.5 block text-sm font-black text-emerald-400">
                {selectedEvolutionYear
                  ? `${activeEvolutionLast?.assetsCount || 0} posições`
                  : `${filteredHoldings.length} posições abertas`}
              </span>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: compact allocation + top positions */}
        <div className="flex flex-col gap-4 lg:col-span-2">
          <div className="surface-panel relative shrink-0 overflow-hidden rounded-xl p-3.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="chart-icon flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
                  <PieIcon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-bold text-white">Alocação por Categoria</h3>
                  <p className="truncate text-[10px] text-zinc-400">Divisão percentual da carteira</p>
                </div>
              </div>
              <span className="shrink-0 rounded-full bg-zinc-900 px-2 py-1 text-[9px] font-bold text-zinc-300">
                {categorySummary.length} {categorySummary.length === 1 ? 'classe' : 'classes'}
              </span>
            </div>

            <AllocationDonut
              data={pieData}
              totalValue={totalInvestedGlobal}
              isPrivate={isPrivate}
              selectedCategory={selectedCategoryFilter}
              onSelectCategory={setSelectedCategoryFilter}
            />
          </div>

          <div className="surface-panel relative flex min-h-[320px] flex-1 flex-col overflow-hidden rounded-xl p-5">
            <div className="mb-2 flex shrink-0 items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="chart-icon flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
                  <BarChart3 className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-bold text-white">
                    Maiores Posições {selectedCategoryFilter !== 'ALL' ? `(${selectedCategoryFilter})` : '(Top 5)'}
                  </h3>
                  <p className="truncate text-[10px] text-zinc-400">Ativos com maior capital investido</p>
                </div>
              </div>
              <span className="chart-badge shrink-0 rounded-full px-2 py-1 text-[9px] font-bold">Por Custo</span>
            </div>

            {barData.length === 0 ? (
              <div className="flex min-h-[230px] flex-1 flex-col items-center justify-center p-6 text-center text-xs text-zinc-500">
                <Layers className="mb-2 h-8 w-8 text-zinc-600 stroke-[1.5]" />
                <p className="font-semibold">Nenhum ativo encontrado</p>
              </div>
            ) : (
              <div className="min-h-[230px] w-full flex-1 pt-1">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={barData}
                    margin={{ top: 20, right: 6, left: -12, bottom: 2 }}
                    barCategoryGap="24%"
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: CHART_AXIS, fontSize: 10, fontWeight: 700 }}
                      axisLine={{ stroke: CHART_GRID }}
                      tickLine={false}
                    />
                    <YAxis
                      tickFormatter={formatYAxis}
                      tick={{ fill: CHART_AXIS, fontSize: 9, fontWeight: 600 }}
                      axisLine={false}
                      tickLine={false}
                      width={46}
                    />
                    <Tooltip
                      cursor={{ fill: 'var(--theme-accent-soft)', radius: 6 }}
                      content={<ChartTooltip isPrivate={isPrivate} />}
                    />
                    <Bar
                      dataKey="Valor"
                      fill={CHART_COLOR}
                      radius={[6, 6, 2, 2]}
                      maxBarSize={36}
                    >
                      <LabelList
                        dataKey="Valor"
                        position="top"
                        style={{ fill: CHART_AXIS, fontSize: 9, fontWeight: 700 }}
                        formatter={(v) => isPrivate ? '•••' : (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0))}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Portfolio Grid & Watchlist 2.0 (Tabela Moderna de Posições) */}
      <div className="surface-panel rounded-xl p-6 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Coins className="w-5 h-5 text-indigo-400" />
              Posições em Custódia
            </h3>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Detalhamento de quantidade, preço médio e custo acumulado por ativo
            </p>
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por ticker, nome ou CNPJ..."
              className="w-full pl-10 pr-4 py-2 bg-zinc-950 border border-zinc-700 rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {filteredHoldings.length === 0 ? (
          <div className="py-12 text-center text-zinc-500 text-xs">
            Nenhum ativo encontrado para os filtros selecionados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-zinc-800 text-[10px] font-black uppercase tracking-wider text-zinc-400">
                  <th className="pb-3 px-3">Ativo</th>
                  <th className="pb-3 px-3">Categoria</th>
                  <th className="pb-3 px-3 text-right">Quantidade</th>
                  <th className="pb-3 px-3 text-right">Preço Médio</th>
                  <th className="pb-3 px-3 text-right">Total Investido</th>
                  <th className="pb-3 px-3 text-right">Peso</th>
                  <th className="pb-3 px-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {filteredHoldings.map((h, idx) => {
                  const color = getCategoryColor(h.category, categoryColors, idx);
                  const weight = totalInvestedGlobal > 0 ? ((h.total_invested || 0) / totalInvestedGlobal) * 100 : 0;
                  const isCopied = copiedTicker === h.ticker;

                  return (
                    <tr key={h.ticker} className="hover:bg-zinc-950/40 group">
                      {/* Ativo */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs text-white flex-shrink-0"
                            style={{ backgroundColor: `${color}25`, border: `1px solid ${color}45` }}
                          >
                            {h.ticker.slice(0, 2)}
                          </div>
                          <div>
                            <span className="font-extrabold text-white text-xs tracking-wide group-hover:text-indigo-300">
                              {h.ticker}
                            </span>
                            <p className="text-[10px] text-zinc-400 truncate max-w-[140px] sm:max-w-[200px]">
                              {h.name || h.razao_social || h.ticker}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Categoria */}
                      <td className="py-3.5 px-3">
                        <span
                          className="px-2.5 py-1 rounded-full text-[10px] font-bold border"
                          style={{
                            backgroundColor: `${color}15`,
                            color: color,
                            borderColor: `${color}35`
                          }}
                        >
                          {h.category || 'Ações'}
                        </span>
                      </td>

                      {/* Quantidade */}
                      <td className="py-3.5 px-3 text-right font-mono text-zinc-300">
                        {formatNumber(h.quantity, 6, isPrivate)}
                      </td>

                      {/* Preço Médio */}
                      <td className="py-3.5 px-3 text-right font-mono text-zinc-300">
                        {formatCurrency(h.average_price, false, isPrivate)}
                      </td>

                      {/* Total Investido */}
                      <td className="py-3.5 px-3 text-right font-mono font-bold text-white">
                        {formatCurrency(h.total_invested, false, isPrivate)}
                      </td>

                      {/* Peso na Carteira */}
                      <td className="py-3.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800 hidden sm:block">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${Math.min(weight, 100)}%`, backgroundColor: color }}
                            />
                          </div>
                          <span className="font-bold text-zinc-300 tabular-nums">
                            {weight.toFixed(1)}%
                          </span>
                        </div>
                      </td>

                      {/* Ações */}
                      <td className="py-3.5 px-3 text-center">
                        <button
                          onClick={() => handleCopyIR(h)}
                          className="p-1.5 rounded-lg border border-zinc-800 bg-zinc-950/40 hover:bg-zinc-800 text-zinc-400 hover:text-white cursor-pointer"
                          title="Copiar texto formatado para IRPF"
                        >
                          {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

