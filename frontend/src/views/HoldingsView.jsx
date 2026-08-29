import React, { useState, useEffect } from 'react';
import { Copy, Check, CheckSquare, Square, RefreshCw, Search, Filter, AlertCircle, CheckCircle2, ShieldAlert } from 'lucide-react';

export default function HoldingsView({ fetchWithAuth, setToast, activeSubTab, setActiveSubTab }) {
  const [holdings, setHoldings] = useState([]);
  const [yearlyHoldings, setYearlyHoldings] = useState([]);
  const [declaredStatus, setDeclaredStatus] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [copiedTicker, setCopiedTicker] = useState(null);
  const [filterType, setFilterType] = useState('all'); // 'all' | 'active' | 'alienated'
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [hRes, yRes, dRes] = await Promise.all([
        fetchWithAuth('/api/holdings'),
        fetchWithAuth('/api/yearly-holdings'),
        fetchWithAuth('/api/declared-status'),
      ]);
      setHoldings(await hRes.json());
      setYearlyHoldings(await yRes.json());
      setDeclaredStatus(await dRes.json());
    } catch (err) {
      setToast({ message: 'Falha ao carregar Posição de Bens e Direitos.', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);
  useEffect(() => {
    const handleRefresh = () => loadData();
    window.addEventListener('refresh-data', handleRefresh);
    return () => window.removeEventListener('refresh-data', handleRefresh);
  }, []);

  const toggleDeclared = async (ticker, year) => {
    try {
      const res = await fetchWithAuth('/api/toggle-declared-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker, year })
      });
      const data = await res.json();
      if (res.ok) {
        setDeclaredStatus(prev => {
          const key = `${ticker.toUpperCase()}:${year}`;
          const next = { ...prev };
          if (data.is_declared) next[key] = true;
          else delete next[key];
          return next;
        });
        setToast({ message: `Status de declarado atualizado para ${ticker}!`, type: 'success' });
      }
    } catch (err) {
      setToast({ message: 'Falha ao atualizar status.', type: 'error' });
    }
  };

  const generateIRDescription = (h) => {
    const category = (h.category || 'Ações').toUpperCase();
    const company = h.razao_social || h.name;
    const companyInfo = company && company !== h.ticker ? ` (${company})` : '';
    const cnpjInfo = h.cnpj ? ` CADASTRADO NO CNPJ: ${h.cnpj}.` : '';

    if (!h.is_alienated && h.quantity > 0) {
      return `${category} - ${h.ticker}${companyInfo} - QUANTIDADE: ${h.quantity.toLocaleString('pt-BR', { maximumFractionDigits: 6 })} COTAS/AÇÕES. CUSTO MÉDIO DE AQUISIÇÃO: ${h.average_price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}. CUSTO TOTAL ACUMULADO: ${h.total_invested.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.${cnpjInfo}`;
    } else {
      let dateFormatted = '';
      if (h.last_alienation_date) {
        const parts = h.last_alienation_date.split('-');
        if (parts.length === 3) {
          dateFormatted = `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
      }
      const dateText = dateFormatted ? ` EM ${dateFormatted}` : '';
      const soldQty = h.total_sold_quantity > 0 ? h.total_sold_quantity : h.quantity;
      const qtyText = soldQty > 0 ? ` QUANTIDADE TOTAL ALIENADA: ${soldQty.toLocaleString('pt-BR', { maximumFractionDigits: 6 })} COTAS/AÇÕES.` : '';
      const avgPrice = (h.last_avg_price || h.average_price || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      
      return `${category} - ${h.ticker}${companyInfo} -${cnpjInfo} POSIÇÃO TOTALMENTE ALIENADA${dateText}.${qtyText} CUSTO MÉDIO DE AQUISIÇÃO: ${avgPrice}. SITUAÇÃO EM 31/12: R$ 0,00.`;
    }
  };

  const handleCopyIRDescription = (h) => {
    const desc = generateIRDescription(h);
    navigator.clipboard.writeText(desc);
    setCopiedTicker(h.ticker);
    setToast({ 
      message: h.is_alienated || h.quantity === 0
        ? `Declaração de alienação de ${h.ticker} copiada!`
        : `Declaração de ${h.ticker} copiada!`, 
      type: 'success' 
    });
    setTimeout(() => setCopiedTicker(null), 2000);
  };

  const years = Array.from(
    new Set(yearlyHoldings.flatMap(h => Object.keys(h.years)))
  ).sort();

  // Filtragem dos ativos
  const filteredHoldings = holdings.filter(h => {
    const matchesSearch = 
      h.ticker.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (h.name && h.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (h.razao_social && h.razao_social.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (h.category && h.category.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    if (filterType === 'active') return !h.is_alienated && h.quantity > 0;
    if (filterType === 'alienated') return h.is_alienated || h.quantity === 0;
    return true;
  });

  const activeCount = holdings.filter(h => !h.is_alienated && h.quantity > 0).length;
  const alienatedCount = holdings.filter(h => h.is_alienated || h.quantity === 0).length;

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="space-y-5 animate-fade-in">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="skeleton w-52 h-6 rounded-lg" />
            <div className="skeleton w-72 h-3 rounded-full" />
          </div>
        </div>
        <div className="space-y-px">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center gap-6 py-3.5 border-b border-white/[0.04]">
              <div className="skeleton w-16 h-5 rounded" />
              <div className="skeleton w-20 h-3 rounded-full" />
              <div className="ml-auto skeleton w-24 h-3 rounded-full" />
              <div className="skeleton w-28 h-3 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            {activeSubTab === 'current' ? 'Posição Atual' : 'Tabela Anual (31/12)'}
          </h2>
          <p className="text-zinc-500 text-xs mt-0.5">
            {activeSubTab === 'current'
              ? 'Bens e Direitos consolidados · Ativos em carteira e posições alienadas para a Receita Federal'
              : 'Posição de fechamento anual para a ficha da Receita Federal (31/12 de cada ano)'}
          </p>
        </div>
        <button
          onClick={loadData}
          title="Atualizar dados"
          className="p-2 rounded-lg text-zinc-600 hover:bg-white/[0.06] hover:text-zinc-400 transition-colors self-start sm:self-auto"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* ── Posição Atual ── */}
      {activeSubTab === 'current' && (
        <div className="space-y-4">
          {/* Controls Bar: Search & Status Filters */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white/[0.02] p-3 rounded-xl border border-white/5">
            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto">
              <button
                onClick={() => setFilterType('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                  filterType === 'all'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'bg-white/[0.03] text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200'
                }`}
              >
                Todas ({holdings.length})
              </button>
              <button
                onClick={() => setFilterType('active')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  filterType === 'active'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                    : 'bg-white/[0.03] text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                Em Carteira ({activeCount})
              </button>
              <button
                onClick={() => setFilterType('alienated')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  filterType === 'alienated'
                    ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                    : 'bg-white/[0.03] text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                Alienadas / Zeradas ({alienatedCount})
              </button>
            </div>

            {/* Search Input */}
            <div className="relative min-w-[200px] sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                placeholder="Buscar ticker, empresa ou CNPJ..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
          </div>

          {filteredHoldings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-center">
                <span className="text-xl">📭</span>
              </div>
              <p className="text-zinc-400 text-sm font-medium">Nenhum ativo encontrado para o filtro selecionado.</p>
              <p className="text-zinc-600 text-xs">Ajuste o filtro acima ou registre novas operações na aba Transações.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-white/5 bg-black/20">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.06] bg-white/[0.01]">
                    <th className="px-3.5 py-3 text-[10px] font-semibold text-zinc-500 text-left uppercase tracking-wider sticky left-0 z-10 bg-[#0d0d1a]">Ticker / Ativo</th>
                    <th className="px-3.5 py-3 text-[10px] font-semibold text-zinc-500 text-left uppercase tracking-wider">Categoria</th>
                    <th className="px-3.5 py-3 text-[10px] font-semibold text-zinc-500 text-center uppercase tracking-wider">Status</th>
                    <th className="px-3.5 py-3 text-[10px] font-semibold text-zinc-500 text-right uppercase tracking-wider">Quantidade</th>
                    <th className="px-3.5 py-3 text-[10px] font-semibold text-zinc-500 text-right uppercase tracking-wider">Preço Médio</th>
                    <th className="px-3.5 py-3 text-[10px] font-semibold text-zinc-500 text-right uppercase tracking-wider">Custo Total</th>
                    <th className="px-3.5 py-3 text-[10px] font-semibold text-zinc-500 text-center uppercase tracking-wider w-32">Declaração IRPF</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHoldings.map((h) => {
                    const isAlienated = h.is_alienated || h.quantity === 0;
                    const formattedAlienationDate = h.last_alienation_date
                      ? h.last_alienation_date.split('-').reverse().join('/')
                      : null;

                    return (
                      <tr
                        key={h.ticker}
                        className={`group border-b border-white/[0.04] transition-colors duration-150 ${
                          isAlienated ? 'hover:bg-amber-500/[0.02] bg-white/[0.005]' : 'hover:bg-white/[0.03]'
                        }`}
                      >
                        {/* Ticker & Name */}
                        <td className="px-3.5 py-3.5 text-left sticky left-0 z-10 bg-[#0d0d1a] group-hover:bg-[#101022] transition-colors">
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              <span className={`font-bold px-2 py-0.5 rounded text-xs transition-colors ${
                                isAlienated
                                  ? 'bg-zinc-800 text-zinc-400 border border-white/5'
                                  : 'bg-indigo-500/10 group-hover:bg-indigo-500/20 text-indigo-300'
                              }`}>
                                {h.ticker}
                              </span>
                              {h.cnpj && (
                                <span className="text-[10px] text-zinc-600 font-mono hidden md:inline">
                                  {h.cnpj}
                                </span>
                              )}
                            </div>
                            {(h.razao_social || h.name) && (
                              <span className="text-[11px] text-zinc-500 truncate max-w-[200px] mt-0.5" title={h.razao_social || h.name}>
                                {h.razao_social || h.name}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Category */}
                        <td className="px-3.5 py-3.5 text-left text-zinc-400 text-xs font-medium group-hover:text-zinc-200 transition-colors">
                          {h.category}
                        </td>

                        {/* Status Badge */}
                        <td className="px-3.5 py-3.5 text-center">
                          {isAlienated ? (
                            <span 
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20"
                              title={formattedAlienationDate ? `Posição encerrada em ${formattedAlienationDate}` : 'Posição totalmente liquidada'}
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                              Alienada {formattedAlienationDate ? `(${formattedAlienationDate})` : ''}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                              Em Carteira
                            </span>
                          )}
                        </td>

                        {/* Quantidade */}
                        <td className="px-3.5 py-3.5 text-right text-xs font-mono group-hover:text-white transition-colors tabular-nums">
                          {isAlienated ? (
                            <div className="flex flex-col items-end">
                              <span className="text-zinc-500 font-bold">0</span>
                              {h.total_sold_quantity > 0 && (
                                <span className="text-[10px] text-zinc-600">
                                  {h.total_sold_quantity.toLocaleString('pt-BR', { maximumFractionDigits: 6 })} alienadas
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-zinc-300">
                              {h.quantity.toLocaleString('pt-BR', { maximumFractionDigits: 6 })}
                            </span>
                          )}
                        </td>

                        {/* Preço Médio */}
                        <td className="px-3.5 py-3.5 text-right text-xs font-mono group-hover:text-zinc-300 transition-colors tabular-nums">
                          {isAlienated ? (
                            <div className="flex flex-col items-end">
                              <span className="text-zinc-400">
                                {(h.last_avg_price || h.average_price || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </span>
                              <span className="text-[10px] text-zinc-600">histórico</span>
                            </div>
                          ) : (
                            <span className="text-zinc-400">
                              {h.average_price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                          )}
                        </td>

                        {/* Custo Total */}
                        <td className="px-3.5 py-3.5 text-right font-bold text-xs font-mono tabular-nums">
                          {isAlienated ? (
                            <span className="text-zinc-600">R$ 0,00</span>
                          ) : (
                            <span className="text-emerald-400 group-hover:text-emerald-300 transition-colors">
                              {h.total_invested.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                          )}
                        </td>

                        {/* Copiar IRPF Button */}
                        <td className="px-3.5 py-3.5 text-center">
                          <button
                            onClick={() => handleCopyIRDescription(h)}
                            className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer ${
                              isAlienated
                                ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20'
                                : 'bg-white/[0.04] hover:bg-indigo-500/15 text-zinc-400 hover:text-indigo-300'
                            }`}
                            title={isAlienated ? 'Copiar discriminação de alienação para IRPF' : 'Copiar texto para IRPF'}
                          >
                            {copiedTicker === h.ticker ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-400" />
                                <span className="text-emerald-400">Copiado!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>{isAlienated ? 'Copiar Alienação' : 'Copiar IRPF'}</span>
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Table Footer */}
              <div className="p-3 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-zinc-500">
                <p>
                  Exibindo <span className="text-white font-semibold">{filteredHoldings.length}</span> de <span className="text-white font-semibold">{holdings.length}</span> ativos
                  ({activeCount} em carteira · {alienatedCount} alienados)
                </p>
                <p className="text-zinc-600 text-[10px]">
                  💡 Clique em <b>Copiar</b> para obter a discriminação formatada para a declaração de Bens e Direitos da Receita Federal.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Tabela Anual ── */}
      {activeSubTab === 'yearly' && (
        yearlyHoldings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-center">
              <span className="text-xl">📅</span>
            </div>
            <p className="text-zinc-500 text-sm font-medium">Nenhum fechamento anual encontrado.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-white/5 bg-black/20">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/[0.06] bg-white/[0.01]">
                  <th className="px-3 py-3 text-[10px] font-semibold text-zinc-500 text-left uppercase tracking-wider sticky left-0 z-10 bg-[#0d0d1a]" rowSpan={2}>
                    Ativo
                  </th>
                  {years.map(year => (
                    <th
                      key={year}
                      className="px-3 py-2 text-[10px] font-bold text-zinc-300 text-center border-l border-white/[0.06]"
                      colSpan={3}
                    >
                      31/12/{year}
                    </th>
                  ))}
                </tr>
                <tr className="border-b border-white/[0.06]">
                  {years.map(year => (
                    <React.Fragment key={`sub-${year}`}>
                      <th className="px-3 py-2 text-[10px] font-semibold text-zinc-500 text-right border-l border-white/[0.06] uppercase tracking-wider">Qtd</th>
                      <th className="px-3 py-2 text-[10px] font-semibold text-zinc-500 text-right uppercase tracking-wider">Valor</th>
                      <th className="px-3 py-2 text-[10px] font-semibold text-zinc-500 text-center uppercase tracking-wider">Decl.</th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {yearlyHoldings.map(h => (
                  <tr
                    key={h.ticker}
                    className="group border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors duration-150"
                  >
                    <td className="px-3 py-3.5 text-left sticky left-0 z-10 bg-[#0d0d1a] group-hover:bg-[#101022] transition-colors">
                      <div className="flex flex-col">
                        <span className="bg-indigo-500/10 group-hover:bg-indigo-500/20 text-indigo-300 font-bold px-2 py-0.5 rounded text-xs transition-colors self-start">
                          {h.ticker}
                        </span>
                        {h.cnpj && (
                          <span className="text-[9px] text-zinc-600 font-mono mt-0.5">
                            {h.cnpj}
                          </span>
                        )}
                      </div>
                    </td>
                    {years.map(year => {
                      const yearData = h.years[year] || { quantity: 0, value: 0 };
                      const key = `${h.ticker.toUpperCase()}:${year}`;
                      const isDeclared = !!declaredStatus[key];
                      const isAlienatedInYear = yearData.is_alienated || yearData.quantity === 0;

                      return (
                        <React.Fragment key={`${h.ticker}-${year}`}>
                          <td className="px-3 py-3.5 text-right text-zinc-400 font-mono group-hover:text-zinc-200 transition-colors tabular-nums border-l border-white/[0.04]">
                            {yearData.quantity > 0 ? (
                              yearData.quantity.toLocaleString('pt-BR', { maximumFractionDigits: 6 })
                            ) : yearData.last_alienation_date ? (
                              <span className="text-[10px] text-amber-400/80 font-sans" title={`Alienado em ${yearData.last_alienation_date}`}>
                                Alienado
                              </span>
                            ) : (
                              <span className="text-zinc-800">—</span>
                            )}
                          </td>
                          <td className="px-3 py-3.5 text-right font-mono group-hover:text-emerald-400 transition-colors tabular-nums">
                            {yearData.value > 0 ? (
                              <span className="text-emerald-500/90 font-bold">
                                {yearData.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </span>
                            ) : yearData.last_alienation_date ? (
                              <span className="text-zinc-600 text-[10px]">R$ 0,00</span>
                            ) : (
                              <span className="text-zinc-800">—</span>
                            )}
                          </td>
                          <td className="px-3 py-3.5 text-center">
                            {(yearData.quantity > 0 || yearData.last_alienation_date || isDeclared) ? (
                              <button
                                onClick={() => toggleDeclared(h.ticker, year)}
                                className={`p-1 rounded-md transition-colors cursor-pointer ${
                                  isDeclared
                                    ? 'text-indigo-400 hover:text-indigo-300'
                                    : 'text-zinc-700 hover:text-zinc-400'
                                }`}
                                title={isDeclared ? 'Declarado ✓' : 'Marcar como declarado'}
                              >
                                {isDeclared
                                  ? <CheckSquare className="w-3.5 h-3.5" />
                                  : <Square className="w-3.5 h-3.5" />}
                              </button>
                            ) : (
                              <span className="text-zinc-800">—</span>
                            )}
                          </td>
                        </React.Fragment>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="p-3 border-t border-white/5">
              <p className="text-[10px] text-zinc-600">
                {yearlyHoldings.length} {yearlyHoldings.length === 1 ? 'ativo' : 'ativos'} · {years.length} {years.length === 1 ? 'ano' : 'anos'} de histórico fechados em 31/12
              </p>
            </div>
          </div>
        )
      )}
    </div>
  );
}

