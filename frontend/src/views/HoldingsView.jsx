import React, { useState, useEffect } from 'react';
import { Copy, Check, CheckSquare, Square, RefreshCw } from 'lucide-react';

export default function HoldingsView({ fetchWithAuth, setToast, activeSubTab, setActiveSubTab }) {
  const [holdings, setHoldings] = useState([]);
  const [yearlyHoldings, setYearlyHoldings] = useState([]);
  const [declaredStatus, setDeclaredStatus] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [copiedTicker, setCopiedTicker] = useState(null);

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

  const handleCopyIRDescription = (h) => {
    const desc = `${h.category.toUpperCase()} - ${h.ticker} - QUANTIDADE: ${h.quantity.toLocaleString('pt-BR', { maximumFractionDigits: 6 })} COTAS/AÇÕES. CUSTO MÉDIO: ${h.average_price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}. CUSTO TOTAL ACUMULADO DE AQUISIÇÃO: ${h.total_invested.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}. CADASTRADO NO CNPJ: ${h.cnpj || 'N/A'}`;
    navigator.clipboard.writeText(desc);
    setCopiedTicker(h.ticker);
    setToast({ message: `Declaração de ${h.ticker} copiada!`, type: 'success' });
    setTimeout(() => setCopiedTicker(null), 2000);
  };

  const years = Array.from(
    new Set(yearlyHoldings.flatMap(h => Object.keys(h.years)))
  ).sort();

  const activeHoldings = holdings.filter(h => h.quantity > 0);

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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            {activeSubTab === 'current' ? 'Posição Atual' : 'Tabela Anual (31/12)'}
          </h2>
          <p className="text-zinc-500 text-xs mt-0.5">
            {activeSubTab === 'current'
              ? 'Bens e Direitos consolidados · Preço Médio FIFO'
              : 'Posição de fechamento anual para a ficha da Receita Federal'}
          </p>
        </div>
        <button
          onClick={loadData}
          title="Atualizar"
          className="p-2 rounded-lg text-zinc-600 hover:bg-white/[0.06] hover:text-zinc-400 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ── Posição Atual ── */}
      {activeSubTab === 'current' && (
        activeHoldings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-center">
              <span className="text-xl">📭</span>
            </div>
            <p className="text-zinc-500 text-sm font-medium">Nenhuma posição em aberto encontrada.</p>
            <p className="text-zinc-700 text-xs">Registre operações na aba Transações!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="px-3 py-3 text-[10px] font-semibold text-zinc-600 text-left uppercase tracking-wider sticky left-0 z-10 bg-[#0d0d1a]">Ticker</th>
                  <th className="px-3 py-3 text-[10px] font-semibold text-zinc-600 text-left uppercase tracking-wider">Categoria</th>
                  <th className="px-3 py-3 text-[10px] font-semibold text-zinc-600 text-right uppercase tracking-wider">Quantidade</th>
                  <th className="px-3 py-3 text-[10px] font-semibold text-zinc-600 text-right uppercase tracking-wider">Preço Médio</th>
                  <th className="px-3 py-3 text-[10px] font-semibold text-zinc-600 text-right uppercase tracking-wider">Custo Total</th>
                  <th className="px-3 py-3 text-[10px] font-semibold text-zinc-600 text-center uppercase tracking-wider w-28">IRPF</th>
                </tr>
              </thead>
              <tbody>
                {activeHoldings.map((h, i) => (
                  <tr
                    key={h.ticker}
                    className="group border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors duration-150"
                  >
                    <td className="px-3 py-3.5 text-left sticky left-0 z-10 bg-[#0d0d1a] group-hover:bg-[#101022] transition-colors">
                      <span className="bg-indigo-500/10 group-hover:bg-indigo-500/20 text-indigo-300 font-bold px-2 py-0.5 rounded text-xs transition-colors">
                        {h.ticker}
                      </span>
                    </td>
                    <td className="px-3 py-3.5 text-left text-zinc-500 text-xs font-medium group-hover:text-zinc-300 transition-colors">
                      {h.category}
                    </td>
                    <td className="px-3 py-3.5 text-right text-zinc-400 text-xs font-mono group-hover:text-white transition-colors tabular-nums">
                      {h.quantity.toLocaleString('pt-BR', { maximumFractionDigits: 6 })}
                    </td>
                    <td className="px-3 py-3.5 text-right text-zinc-500 text-xs font-mono group-hover:text-zinc-300 transition-colors tabular-nums">
                      {h.average_price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                    <td className="px-3 py-3.5 text-right text-emerald-400 font-bold text-xs font-mono group-hover:text-emerald-300 transition-colors tabular-nums">
                      {h.total_invested.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                    <td className="px-3 py-3.5 text-center">
                      <button
                        onClick={() => handleCopyIRDescription(h)}
                        className="px-2.5 py-1 bg-white/[0.04] hover:bg-indigo-500/15 text-zinc-500 hover:text-indigo-300 rounded-lg text-[10px] font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer"
                        title="Copiar texto para IRPF"
                      >
                        {copiedTicker === h.ticker
                          ? <Check className="w-3 h-3 text-emerald-400" />
                          : <Copy className="w-3 h-3" />
                        }
                        Copiar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-3 px-1">
              <p className="text-[10px] text-zinc-700 tabular-nums">
                {activeHoldings.length} {activeHoldings.length === 1 ? 'ativo' : 'ativos'} em carteira
              </p>
            </div>
          </div>
        )
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
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="px-3 py-3 text-[10px] font-semibold text-zinc-600 text-left uppercase tracking-wider sticky left-0 z-10 bg-[#0d0d1a]" rowSpan={2}>
                    Ativo
                  </th>
                  {years.map(year => (
                    <th
                      key={year}
                      className="px-3 py-2 text-[10px] font-bold text-zinc-400 text-center border-l border-white/[0.06]"
                      colSpan={3}
                    >
                      31/12/{year}
                    </th>
                  ))}
                </tr>
                <tr className="border-b border-white/[0.06]">
                  {years.map(year => (
                    <React.Fragment key={`sub-${year}`}>
                      <th className="px-3 py-2 text-[10px] font-semibold text-zinc-600 text-right border-l border-white/[0.06] uppercase tracking-wider">Qtd</th>
                      <th className="px-3 py-2 text-[10px] font-semibold text-zinc-600 text-right uppercase tracking-wider">Valor</th>
                      <th className="px-3 py-2 text-[10px] font-semibold text-zinc-600 text-center uppercase tracking-wider">Decl.</th>
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
                      <span className="bg-indigo-500/10 group-hover:bg-indigo-500/20 text-indigo-300 font-bold px-2 py-0.5 rounded text-xs transition-colors">
                        {h.ticker}
                      </span>
                    </td>
                    {years.map(year => {
                      const yearData = h.years[year] || { quantity: 0, value: 0 };
                      const key = `${h.ticker.toUpperCase()}:${year}`;
                      const isDeclared = !!declaredStatus[key];
                      return (
                        <React.Fragment key={`${h.ticker}-${year}`}>
                          <td className="px-3 py-3.5 text-right text-zinc-500 font-mono group-hover:text-zinc-300 transition-colors tabular-nums border-l border-white/[0.04]">
                            {yearData.quantity > 0
                              ? yearData.quantity.toLocaleString('pt-BR', { maximumFractionDigits: 6 })
                              : <span className="text-zinc-800">—</span>}
                          </td>
                          <td className="px-3 py-3.5 text-right text-emerald-500/80 font-bold font-mono group-hover:text-emerald-400 transition-colors tabular-nums">
                            {yearData.value > 0
                              ? yearData.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                              : <span className="text-zinc-800">—</span>}
                          </td>
                          <td className="px-3 py-3.5 text-center">
                            {yearData.quantity > 0 ? (
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
                            ) : <span className="text-zinc-800">—</span>}
                          </td>
                        </React.Fragment>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-3 px-1">
              <p className="text-[10px] text-zinc-700">
                {yearlyHoldings.length} {yearlyHoldings.length === 1 ? 'ativo' : 'ativos'} · {years.length} {years.length === 1 ? 'ano' : 'anos'} de histórico
              </p>
            </div>
          </div>
        )
      )}
    </div>
  );
}
