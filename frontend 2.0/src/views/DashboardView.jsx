import React, { useState, useEffect, useMemo } from 'react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList
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
  SlidersHorizontal,
  ArrowUpRight,
  Receipt,
  Copy,
  Check,
  Building2,
  Coins
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

      {/* Charts skeleton */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <div className="glass-panel p-6 rounded-3xl xl:col-span-2">
          <div className="skeleton w-40 h-4 rounded-full mb-6" />
          <div className="skeleton w-full rounded-2xl" style={{ height: 300 }} />
        </div>
        <div className="glass-panel p-6 rounded-3xl xl:col-span-3">
          <div className="skeleton w-44 h-4 rounded-full mb-6" />
          <div className="skeleton w-full rounded-2xl" style={{ height: 300 }} />
        </div>
      </div>
    </div>
  );
}

// --- KPI Card 2.0 ---
function KpiCard({ icon: Icon, label, value, subtext, iconColor, iconBg, glowColor, badge, badgeColor }) {
  return (
    <div className="kpi flex items-center gap-4 group" style={{ borderColor: iconColor }}>
      {/* Big prominent icon container on the left */}
      <Icon className="w-9 h-9 icon" style={{ color: iconColor }} />
      {/* < div
        className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 transition-transform duration-300 group-hover:scale-105 shadow-md">
      </div > */}

      {/* Text block beside the icon */}
      < div className="min-w-0 flex-1" >
        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-wider truncate">
          {label}
        </p>
        {/* {badge} */}

        <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-0.5 truncate">
          {value}
        </h3>

        {
          subtext && (
            <p className="text-[11px] text-zinc-400 font-medium mt-0.5 truncate flex items-center gap-1">
              {subtext}
            </p>
          )
        }
      </div >
    </div >
  );
}

// --- Custom Chart Tooltip ---
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

export default function DashboardView({
  fetchWithAuth,
  setToast,
  onOpenDrawer,
  isPrivate = false
}) {
  const [holdings, setHoldings] = useState([]);
  const [inconsistencies, setInconsistencies] = useState([]);
  const [categoryColors, setCategoryColors] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMetric, setViewMetric] = useState('cost'); // 'cost' | 'market'
  const [copiedTicker, setCopiedTicker] = useState(null);

  const loadData = async (showFeedback = false) => {
    if (showFeedback) setIsRefreshing(true);
    try {
      const [holdingsRes, incRes, settingsRes] = await Promise.all([
        fetchWithAuth('/api/holdings'),
        fetchWithAuth('/api/check-inconsistencies'),
        fetchWithAuth('/api/settings'),
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

  // Top 10 Positions for Bar Chart (Filtered or Global)
  const barData = useMemo(() => {
    return [...filteredHoldings]
      .sort((a, b) => (b.total_invested || 0) - (a.total_invested || 0))
      .slice(0, 10)
      .map((h, idx) => ({
        name: h.ticker,
        Valor: parseFloat((h.total_invested || 0).toFixed(2)),
        category: h.category || 'Ações',
        color: getCategoryColor(h.category, categoryColors, idx),
        percent: totalInvestedGlobal > 0 ? (h.total_invested / totalInvestedGlobal) : 0
      }));
  }, [filteredHoldings, categoryColors, totalInvestedGlobal]);

  // Format Y Axis for Bar Chart
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
      {/* Top Header & Actions */}

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
          iconBg="rgba(99, 102, 241, 0.15)"
          glowColor="#6366f1"
          badge="Custo IRPF"
          badgeColor="#818cf8"
        />

        {/* KPI 2: Custo Médio & Aquisição */}
        <KpiCard
          icon={Receipt}
          label="Base de Aquisição"
          value={formatCurrency(totalInvestedFiltered, false, isPrivate)}
          subtext="Base legal para ganho de capital"
          iconColor="#34d399"
          iconBg="rgba(16, 185, 129, 0.15)"
          glowColor="#10b981"
          badge="Declaratório"
          badgeColor="#34d399"
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
          iconBg="rgba(6, 182, 212, 0.15)"
          glowColor="#06b6d4"
          badge="Alocação"
          badgeColor="#38bdf8"
        />

        {/* KPI 4: Conformidade Fiscal */}
        <KpiCard
          icon={inconsistencies.length === 0 ? ShieldCheck : AlertTriangle}
          label="Conformidade Fiscal"
          value={inconsistencies.length === 0 ? "100% Regular" : `${inconsistencies.length} pendência${inconsistencies.length > 1 ? 's' : ''}`}
          subtext={inconsistencies.length === 0 ? "Histórico sem divergências" : "Revisão necessária"}
          iconColor={inconsistencies.length === 0 ? "#34d399" : "#fbbf24"}
          iconBg={inconsistencies.length === 0 ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)"}
          glowColor={inconsistencies.length === 0 ? "#10b981" : "#f59e0b"}
          badge="Auditoria"
          badgeColor={inconsistencies.length === 0 ? "#34d399" : "#fbbf24"}
        />
      </div>

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


      {/* Main Charts Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">

        {/* Donut Chart: Alocação por Categoria */}
        <div className="glass-panel rounded-3xl p-6 xl:col-span-2 flex flex-col justify-between relative overflow-hidden">
          <div>
            <div className="flex items-center justify-between mb-4">
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

            {pieData.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-zinc-500 text-xs text-center p-6">
                <Layers className="w-8 h-8 text-zinc-600 mb-2 stroke-[1.5]" />
                <p className="font-semibold">Nenhuma posição alocada</p>
                <p className="text-[11px] text-zinc-600 mt-0.5">Cadastre compras para ver a divisão.</p>
              </div>
            ) : (
              <>
                <div className="h-64 w-full relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius="58%"
                        outerRadius="82%"
                        paddingAngle={3}
                        dataKey="value"
                        stroke="rgba(0,0,0,0.5)"
                        strokeWidth={2}
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<ChartTooltip isPrivate={isPrivate} />} />
                    </PieChart>
                  </ResponsiveContainer>

                  {/* Donut Center Label */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                      Total
                    </span>
                    <span className="text-sm font-black text-white tabular-nums">
                      {formatCurrency(totalInvestedGlobal, true, isPrivate)}
                    </span>
                  </div>
                </div>

                {/* Categorized Harmonious Legend Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4 pt-4 border-t border-white/5">
                  {pieData.map((entry) => (
                    <button
                      key={entry.name}
                      onClick={() => setSelectedCategoryFilter(selectedCategoryFilter === entry.name ? 'ALL' : entry.name)}
                      className={`flex items-center justify-between p-2.5 rounded-xl border text-left transition-all cursor-pointer ${selectedCategoryFilter === entry.name
                        ? 'bg-white/10 border-white/20 shadow-md'
                        : 'bg-white/[0.02] border-white/[0.03] hover:bg-white/[0.05]'
                        }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: entry.color, boxShadow: `0 0 6px ${entry.color}66` }}
                        />
                        <span className="text-xs font-bold text-zinc-200 truncate">
                          {entry.name}
                        </span>
                      </div>
                      <div className="text-right flex-shrink-0 pl-2">
                        <span className="text-xs font-extrabold text-white tabular-nums">
                          {(entry.percent * 100).toFixed(1)}%
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Bar Chart: Top 10 Maiores Posições */}
        <div className="glass-panel rounded-3xl p-6 xl:col-span-3 flex flex-col justify-between relative overflow-hidden">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                  <BarChart3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Maiores Posições {selectedCategoryFilter !== 'ALL' ? `(${selectedCategoryFilter})` : '(Top 10)'}
                  </h3>
                  <p className="text-[11px] text-zinc-400">Ativos com maior capital investido</p>
                </div>
              </div>
              <span className="text-[10px] px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-300 font-bold border border-emerald-500/20">
                Por Custo
              </span>
            </div>

            {barData.length === 0 ? (
              <div className="h-72 flex flex-col items-center justify-center text-zinc-500 text-xs text-center p-6">
                <Layers className="w-8 h-8 text-zinc-600 mb-2 stroke-[1.5]" />
                <p className="font-semibold">Nenhum ativo encontrado nesta seleção</p>
                <p className="text-[11px] text-zinc-600 mt-0.5">Experimente selecionar outra categoria.</p>
              </div>
            ) : (
              <div className="h-80 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={barData}
                    margin={{ top: 24, right: 12, left: 0, bottom: 6 }}
                    barCategoryGap="24%"
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 700 }}
                      axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                      tickLine={false}
                    />
                    <YAxis
                      tickFormatter={formatYAxis}
                      tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }}
                      axisLine={false}
                      tickLine={false}
                      width={56}
                    />
                    <Tooltip content={<ChartTooltip isPrivate={isPrivate} />} />
                    <Bar
                      dataKey="Valor"
                      radius={[8, 8, 2, 2]}
                      maxBarSize={48}
                    >
                      {barData.map((entry, index) => (
                        <Cell key={`bar-${index}`} fill={entry.color} />
                      ))}
                      <LabelList
                        dataKey="Valor"
                        position="top"
                        style={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
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
