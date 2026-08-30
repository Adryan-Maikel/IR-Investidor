import React, { useState, useEffect, useMemo } from 'react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
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
  Sparkles,
  PieChart as PieIcon,
  BarChart3,
  Search,
  Receipt,
  Copy,
  Check,
  Coins,
  History,
  ArrowUpRight,
  Calendar
} from 'lucide-react';
import { getCategoryColor, formatCurrency, formatNumber } from '../utils/categories';

// --- Skeleton Loader 2.0 ---
function DashboardSkeleton() {
  return (
    <div className="space-y-8 animate-fade-in">
      {/* Category Pills Skeleton */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="skeleton w-28 h-9 rounded-2xl flex-shrink-0" />
        ))}
      </div>

      {/* KPI skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="glass-panel p-5 rounded-3xl flex items-center gap-4">
            <div className="skeleton w-14 h-14 rounded-2xl flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="skeleton w-20 h-3 rounded-full" />
              <div className="skeleton w-32 h-6 rounded-lg" />
              <div className="skeleton w-16 h-2.5 rounded-full" />
            </div>
          </div>
        ))}
      </div>

      {/* Charts skeleton (4 of 6 and 2 of 6) */}
      <div className="grid grid-cols-1 lg:grid-cols-6 gap-6">
        <div className="glass-panel p-6 rounded-3xl lg:col-span-4 flex flex-col justify-between">
          <div className="skeleton w-52 h-5 rounded-full mb-6" />
          <div className="skeleton w-full rounded-2xl" style={{ height: 380 }} />
        </div>
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="glass-panel p-6 rounded-3xl flex-1">
            <div className="skeleton w-40 h-4 rounded-full mb-6" />
            <div className="skeleton w-full rounded-2xl" style={{ height: 180 }} />
          </div>
          <div className="glass-panel p-6 rounded-3xl flex-1">
            <div className="skeleton w-36 h-4 rounded-full mb-6" />
            <div className="skeleton w-full rounded-2xl" style={{ height: 180 }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// --- KPI Card 2.0 ---
function KpiCard({ icon: Icon, label, value, subtext, iconColor }) {
  return (
    <div className="kpi flex items-center gap-4 group" style={{ borderColor: iconColor }}>
      <Icon className="w-9 h-9 icon" style={{ color: iconColor }} />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-wider truncate">
          {label}
        </p>
        <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-0.5 truncate">
          {value}
        </h3>
        {subtext && (
          <p className="text-[11px] text-zinc-400 font-medium mt-0.5 truncate flex items-center gap-1">
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
  const color = data.payload?.color || data.color || '#6366f1';
  const name = data.payload?.name || data.name;
  const value = data.value;

  return (
    <div className="glass-modal p-3.5 rounded-2xl shadow-2xl border border-white/10 text-xs min-w-[170px] animate-fade-in">
      <div className="flex items-center gap-2 mb-1.5">
        <span
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}88` }}
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
            backgroundColor: `${color}18`,
            color: color,
            borderColor: `${color}35`
          }}
        >
          {data.payload.category}
        </span>
      )}
    </div>
  );
}

// --- Custom Tooltip for Evolution Line Chart ---
function EvolutionTooltip({ active, payload, label, isPrivate }) {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0].payload;
  const isPositive = data.growth >= 0;

  return (
    <div className="glass-modal p-4 rounded-2xl shadow-2xl border border-white/10 text-xs min-w-[210px] animate-fade-in">
      <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-white/10">
        <span className="font-extrabold text-white text-sm">Ano {label}</span>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/30">
          {data.assetsCount} {data.assetsCount === 1 ? 'ativo' : 'ativos'}
        </span>
      </div>
      
      <div className="space-y-2">
        <div>
          <p className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">Patrimônio Acumulado (Custo)</p>
          <p className="text-base font-black text-white mt-0.5">
            {formatCurrency(data.total, false, isPrivate)}
          </p>
        </div>

        {data.growth !== 0 && (
          <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px]">
            <span className="text-zinc-400">Variação vs anterior:</span>
            <span className={`font-bold flex items-center gap-0.5 ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
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
    <div className="rounded-2xl border border-white/10 bg-[#0b0b14]/95 px-3.5 py-3 shadow-2xl backdrop-blur-xl min-w-[170px]">
      <div className="flex items-center gap-2 mb-2">
        <span
          className="h-2.5 w-2.5 rounded-full shrink-0"
          style={{ backgroundColor: item.color, boxShadow: `0 0 12px ${item.color}88` }}
        />
        <span className="text-xs font-bold text-white truncate">{item.name}</span>
      </div>
      <p className="text-sm font-black text-white tabular-nums">
        {formatCurrency(item.value, false, isPrivate)}
      </p>
      <div className="mt-1.5 flex items-center justify-between gap-4 text-[10px] font-semibold">
        <span className="text-zinc-500">{item.count} {item.count === 1 ? 'ativo' : 'ativos'}</span>
        <span style={{ color: item.color }}>{(item.percent * 100).toFixed(1)}% da carteira</span>
      </div>
    </div>
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
      <div className="h-64 flex flex-col items-center justify-center text-zinc-500 text-xs text-center p-6">
        <Layers className="w-8 h-8 text-zinc-600 mb-2 stroke-[1.5]" />
        <p className="font-semibold">Nenhuma posição alocada</p>
        <p className="text-[11px] text-zinc-600 mt-0.5">Cadastre compras para ver a divisão.</p>
      </div>
    );
  }

  const selectedIndex = visibleData.findIndex(item => item.name === selectedCategory);
  const focusIndex = hoveredIndex !== null ? hoveredIndex : selectedIndex;
  const focusItem = focusIndex >= 0 ? visibleData[focusIndex] : null;
  const hasSelection = selectedCategory !== 'ALL' && selectedIndex >= 0;

  const toggleCategory = (category) => {
    if (!onSelectCategory) return;
    onSelectCategory(selectedCategory === category ? 'ALL' : category);
  };

  return (
    <div className="pt-2">
      <div className="relative h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={visibleData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="58%"
              outerRadius="82%"
              paddingAngle={2.5}
              cornerRadius={7}
              startAngle={90}
              endAngle={-270}
              stroke="#0f0f1a"
              strokeWidth={3}
              isAnimationActive
              animationDuration={700}
              animationEasing="ease-out"
            >
              {visibleData.map((item, index) => {
                const isSelected = selectedCategory === item.name;
                const isHovered = hoveredIndex === index;

                return (
                  <Cell
                    key={`allocation-${item.name}`}
                    fill={item.color}
                    fillOpacity={hasSelection && !isSelected ? 0.28 : isHovered ? 1 : 0.9}
                    stroke={isSelected || isHovered ? item.color : '#0f0f1a'}
                    strokeWidth={isSelected ? 5 : isHovered ? 4 : 3}
                    className="cursor-pointer outline-none transition-opacity duration-200"
                    onMouseEnter={() => setHoveredIndex(index)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    onClick={() => toggleCategory(item.name)}
                  />
                );
              })}
            </Pie>
            <Tooltip
              cursor={false}
              content={<AllocationTooltip isPrivate={isPrivate} />}
              wrapperStyle={{ outline: 'none', zIndex: 30 }}
            />
          </PieChart>
        </ResponsiveContainer>

        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="max-w-[118px] text-center">
            <span className="block truncate text-[9px] font-black uppercase tracking-[0.15em] text-zinc-500">
              {focusItem ? focusItem.name : 'Total alocado'}
            </span>
            <span className="mt-1 block text-base font-black tracking-tight text-white tabular-nums">
              {formatCurrency(focusItem ? focusItem.value : totalValue, true, isPrivate)}
            </span>
            <span
              className="mt-0.5 block text-[10px] font-extrabold tabular-nums"
              style={{ color: focusItem ? focusItem.color : '#818cf8' }}
            >
              {focusItem
                ? `${(focusItem.percent * 100).toFixed(1)}% da carteira`
                : `${visibleData.length} ${visibleData.length === 1 ? 'classe' : 'classes'}`}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-1" aria-label="Legenda de alocação por categoria">
        {visibleData.map((item, index) => {
          const isSelected = selectedCategory === item.name;
          const isHovered = hoveredIndex === index;

          return (
            <button
              key={`allocation-legend-${item.name}`}
              type="button"
              onClick={() => toggleCategory(item.name)}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              aria-pressed={isSelected}
              title={`${item.name}: ${(item.percent * 100).toFixed(1)}%`}
              className={`min-w-0 rounded-xl border px-2.5 py-2 text-left transition-all cursor-pointer ${
                isSelected
                  ? 'bg-white/[0.07] border-white/15'
                  : 'bg-white/[0.025] border-white/[0.05] hover:bg-white/[0.055] hover:border-white/10'
              }`}
              style={{
                opacity: hasSelection && !isSelected ? 0.5 : 1,
                boxShadow: isSelected ? `inset 0 0 0 1px ${item.color}66` : undefined
              }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{
                    backgroundColor: item.color,
                    boxShadow: isSelected || isHovered ? `0 0 10px ${item.color}99` : undefined
                  }}
                />
                <span className="min-w-0 flex-1 truncate text-[10px] font-bold text-zinc-300">
                  {item.name}
                </span>
                <span className="shrink-0 text-[10px] font-black tabular-nums" style={{ color: item.color }}>
                  {(item.percent * 100).toFixed(1)}%
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {hasSelection && (
        <button
          type="button"
          onClick={() => onSelectCategory?.('ALL')}
          className="mt-3 w-full rounded-xl border border-indigo-500/15 bg-indigo-500/[0.06] py-2 text-[10px] font-bold text-indigo-300 transition-colors hover:bg-indigo-500/10 cursor-pointer"
        >
          Mostrar todas as categorias
        </button>
      )}
    </div>
  );
}

export default function DashboardView({
  fetchWithAuth,
  setToast,
  onOpenDrawer,
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
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const handleRefresh = () => loadData(false);
    window.addEventListener('refresh-data', handleRefresh);
    return () => window.removeEventListener('refresh-data', handleRefresh);
  }, []);

  // Filter active holdings (quantity > 0)
  const activeHoldings = useMemo(() => {
    return holdings.filter(h => h.quantity > 0);
  }, [holdings]);

  // Available categories list with counts
  const availableCategories = useMemo(() => {
    const counts = {};
    activeHoldings.forEach(h => {
      const cat = h.category || 'Ações';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return Object.keys(counts).map((cat, idx) => ({
      name: cat,
      count: counts[cat],
      color: getCategoryColor(cat, categoryColors, idx)
    }));
  }, [activeHoldings, categoryColors]);

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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
          iconColor="#818cf8"
        />

        {/* KPI 2: Custo Médio & Aquisição */}
        <KpiCard
          icon={Receipt}
          label="Base de Aquisição"
          value={formatCurrency(totalInvestedFiltered, false, isPrivate)}
          subtext="Base legal para ganho de capital"
          iconColor="#34d399"
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
          iconColor="#38bdf8"
        />

        {/* KPI 4: Conformidade Fiscal */}
        <KpiCard
          icon={inconsistencies.length === 0 ? ShieldCheck : AlertTriangle}
          label="Conformidade Fiscal"
          value={inconsistencies.length === 0 ? "100% Regular" : `${inconsistencies.length} pendência${inconsistencies.length > 1 ? 's' : ''}`}
          subtext={inconsistencies.length === 0 ? "Histórico sem divergências" : "Revisão necessária"}
          iconColor={inconsistencies.length === 0 ? "#34d399" : "#fbbf24"}
        />
      </div>

      {/* Filter Bar & Quick Refresh */}
      <div className="flex items-center justify-between gap-2.5">
        {/* Category Pills Filter Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-none">
          <button
            onClick={() => setSelectedCategoryFilter('ALL')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold flex items-center gap-2 flex-shrink-0 transition-all cursor-pointer ${selectedCategoryFilter === 'ALL'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'glass-panel border border-white/5 text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Todas as Classes</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${selectedCategoryFilter === 'ALL' ? 'bg-white/20 text-white' : 'bg-white/5 text-zinc-400'
              }`}>
              {activeHoldings.length}
            </span>
          </button>

          {availableCategories.map(cat => {
            const isSelected = selectedCategoryFilter === cat.name;
            return (
              <button
                key={cat.name}
                onClick={() => setSelectedCategoryFilter(cat.name)}
                className={`px-4 py-2 rounded-2xl text-xs font-bold flex items-center gap-2 flex-shrink-0 transition-all cursor-pointer ${isSelected
                  ? 'text-white shadow-lg'
                  : 'glass-panel border border-white/5 text-zinc-400 hover:text-white hover:bg-white/5'
                  }`}
                style={{
                  backgroundColor: isSelected ? cat.color : undefined,
                  boxShadow: isSelected ? `0 8px 20px -4px ${cat.color}66` : undefined
                }}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: isSelected ? '#ffffff' : cat.color }}
                />
                <span>{cat.name}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-black/30 text-white' : 'bg-white/5 text-zinc-400'
                  }`}>
                  {cat.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Quick refresh */}
        <button
          onClick={() => loadData(true)}
          disabled={isRefreshing}
          className="px-4 py-2.5 rounded-2xl glass-panel border border-white/10 hover:border-white/20 text-zinc-300 hover:text-white text-xs font-bold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          title="Atualizar dados da carteira"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-indigo-400' : ''}`} />
          <span className="hidden sm:inline">Sincronizar</span>
        </button>
      </div>

      {/* Main Charts Grid: 4/6 (Left: Evolution) & 2/6 (Right: Allocation + Top 5) */}
      <div className="grid grid-cols-1 lg:grid-cols-6 gap-6">

        {/* LEFT COLUMN (4 of 6): Evolução do Patrimônio Ano a Ano */}
        <div className="lg:col-span-4 glass-panel rounded-3xl p-6 flex flex-col justify-between relative overflow-hidden">
          <div>
            {/* Header with Title and Growth Stats */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-md">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    Evolução do Patrimônio
                    {selectedCategoryFilter !== 'ALL' && (
                      <span className="text-[11px] font-semibold text-indigo-300 px-2 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/30">
                        {selectedCategoryFilter}
                      </span>
                    )}
                  </h3>
                  <p className="text-[11px] text-zinc-400">Histórico de acumulação por ano (custo de aquisição)</p>
                </div>
              </div>

              {yearlyEvolutionData.length > 1 && (
                <div className="flex items-center gap-2 bg-white/[0.02] border border-white/5 px-3 py-1.5 rounded-2xl">
                  <span className="text-[10px] uppercase font-bold text-zinc-400">Período {evolutionSummary.firstYear} - {evolutionSummary.lastYear}:</span>
                  <span className={`text-xs font-black flex items-center gap-0.5 ${evolutionSummary.totalGrowth >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    {evolutionSummary.totalGrowth >= 0 ? '+' : ''}{evolutionSummary.growthPercent}%
                  </span>
                </div>
              )}
            </div>

            {/* Line / Area Chart */}
            {yearlyEvolutionData.length === 0 ? (
              <div className="h-80 flex flex-col items-center justify-center text-zinc-500 text-xs text-center p-6">
                <Calendar className="w-8 h-8 text-zinc-600 mb-2 stroke-[1.5]" />
                <p className="font-semibold">Nenhum histórico anual disponível</p>
                <p className="text-[11px] text-zinc-600 mt-0.5">Cadastre transações para visualizar o gráfico de acumulação.</p>
              </div>
            ) : (
              <div className="h-80 sm:h-96 w-full pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={yearlyEvolutionData}
                    margin={{ top: 20, right: 20, left: 0, bottom: 10 }}
                  >
                    <defs>
                      <linearGradient id="patrimonioGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.45} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis
                      dataKey="year"
                      tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 700 }}
                      axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                      tickLine={false}
                    />
                    <YAxis
                      tickFormatter={formatYAxis}
                      tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }}
                      axisLine={false}
                      tickLine={false}
                      width={64}
                    />
                    <Tooltip content={<EvolutionTooltip isPrivate={isPrivate} />} />
                    <Area
                      type="monotone"
                      dataKey="total"
                      stroke="#818cf8"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#patrimonioGradient)"
                      dot={{ r: 5, fill: '#818cf8', stroke: '#07070d', strokeWidth: 2 }}
                      activeDot={{ r: 7, fill: '#38bdf8', stroke: '#ffffff', strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Bottom stats summary footer */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-white/5 text-xs">
            <div className="p-2.5 rounded-2xl bg-white/[0.02] border border-white/[0.04]">
              <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Acumulado Atual</span>
              <span className="text-sm font-black text-white mt-0.5 block">
                {formatCurrency(totalInvestedFiltered, false, isPrivate)}
              </span>
            </div>
            <div className="p-2.5 rounded-2xl bg-white/[0.02] border border-white/[0.04]">
              <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Anos Registrados</span>
              <span className="text-sm font-black text-indigo-300 mt-0.5 block">
                {yearlyEvolutionData.length} {yearlyEvolutionData.length === 1 ? 'ano' : 'anos fiscais'}
              </span>
            </div>
            <div className="p-2.5 rounded-2xl bg-white/[0.02] border border-white/[0.04] col-span-2 sm:col-span-1">
              <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Ativos Atuais</span>
              <span className="text-sm font-black text-emerald-400 mt-0.5 block">
                {filteredHoldings.length} posições abertas
              </span>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (2 of 6): Alocação por Categoria (Topo) & Top 5 Posições (Abaixo) */}
        <div className="lg:col-span-2 flex flex-col gap-6">

          {/* Card 1: Donut Chart - Alocação por Categoria */}
          <div className="glass-panel rounded-3xl p-6 flex flex-col justify-between relative overflow-hidden flex-1">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                    <PieIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Alocação por Categoria</h3>
                    <p className="text-[11px] text-zinc-400">Divisão percentual da carteira</p>
                  </div>
                </div>
                <span className="text-[10px] px-2.5 py-1 rounded-full bg-white/5 text-zinc-300 font-bold">
                  {categorySummary.length} classes
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
          </div>

          {/* Card 2: Bar Chart - Maiores Posições (Top 5) */}
          <div className="glass-panel rounded-3xl p-6 flex flex-col justify-between relative overflow-hidden flex-1">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                    <BarChart3 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      Maiores Posições {selectedCategoryFilter !== 'ALL' ? `(${selectedCategoryFilter})` : '(Top 5)'}
                    </h3>
                    <p className="text-[11px] text-zinc-400">Ativos com maior capital investido</p>
                  </div>
                </div>
                <span className="text-[10px] px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-300 font-bold border border-emerald-500/20">
                  Por Custo
                </span>
              </div>

              {barData.length === 0 ? (
                <div className="h-56 flex flex-col items-center justify-center text-zinc-500 text-xs text-center p-6">
                  <Layers className="w-8 h-8 text-zinc-600 mb-2 stroke-[1.5]" />
                  <p className="font-semibold">Nenhum ativo encontrado</p>
                </div>
              ) : (
                <div className="h-60 w-full pt-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={barData}
                      margin={{ top: 20, right: 8, left: -10, bottom: 4 }}
                      barCategoryGap="22%"
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                      <XAxis
                        dataKey="name"
                        tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                        axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                        tickLine={false}
                      />
                      <YAxis
                        tickFormatter={formatYAxis}
                        tick={{ fill: '#64748b', fontSize: 9, fontWeight: 600 }}
                        axisLine={false}
                        tickLine={false}
                        width={48}
                      />
                      <Tooltip
                        cursor={{ fill: 'rgba(255, 255, 255, 0.04)', radius: 6 }}
                        content={<ChartTooltip isPrivate={isPrivate} />}
                      />
                      <Bar
                        dataKey="Valor"
                        radius={[8, 8, 2, 2]}
                        maxBarSize={40}
                      >
                        {barData.map((entry, index) => (
                          <Cell key={`bar-${index}`} fill={entry.color} />
                        ))}
                        <LabelList
                          dataKey="Valor"
                          position="top"
                          style={{ fill: '#94a3b8', fontSize: 9, fontWeight: 700 }}
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
      </div>

      {/* Portfolio Grid & Watchlist 2.0 (Tabela Moderna de Posições) */}
      <div className="glass-panel rounded-3xl p-6 relative overflow-hidden">
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
              className="w-full pl-10 pr-4 py-2 bg-black/40 border border-white/10 rounded-2xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
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
                <tr className="border-b border-white/5 text-[10px] font-black uppercase tracking-wider text-zinc-400">
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
                    <tr key={h.ticker} className="hover:bg-white/[0.02] transition-colors group">
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
                            <span className="font-extrabold text-white text-xs tracking-wide group-hover:text-indigo-300 transition-colors">
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
                          <div className="w-16 h-1.5 bg-black/40 rounded-full overflow-hidden border border-white/5 hidden sm:block">
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
                          className="p-1.5 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/[0.08] text-zinc-400 hover:text-white transition-all cursor-pointer"
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

