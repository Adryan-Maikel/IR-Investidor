import React, { useState, useEffect } from 'react';
import { RefreshCw, Calendar, TrendingUp } from 'lucide-react';

export default function IrMensalView({ fetchWithAuth, setToast }) {
  const [allYearData, setAllYearData] = useState({});
  const [years, setYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [txRes, tkRes] = await Promise.all([
        fetchWithAuth('/api/transactions'),
        fetchWithAuth('/api/tickers')
      ]);
      const allTransactions = await txRes.json();
      const tickersMap = await tkRes.json();

      const sortedTxs = [...allTransactions].sort((a, b) => {
        const dateDiff = new Date(a.date) - new Date(b.date);
        if (dateDiff !== 0) return dateDiff;
        const priority = { 'Comprar': 1, 'Recompensa': 1, 'Desdobramento': 2, 'Grupamento': 2, 'Incorporacao': 3, 'Vender': 4 };
        return (priority[a.action] || 5) - (priority[b.action] || 5);
      });

      const holdings = {};
      const sales = [];

      sortedTxs.forEach(t => {
        const ticker = t.ticker.toUpperCase();
        if (!holdings[ticker]) holdings[ticker] = { qty: 0, totalCost: 0 };
        const h = holdings[ticker];
        const action = t.action.toLowerCase();
        
        if (action === 'comprar' || action === 'recompensa') {
          h.qty += t.quantity;
          h.totalCost += (t.quantity * t.price_per_share) + t.taxes;
        } else if (action === 'vender' && h.qty > 0) {
          const avgPrice = h.totalCost / h.qty;
          const effectiveSoldQty = Math.min(t.quantity, h.qty);
          const saleCost = effectiveSoldQty * avgPrice;
          const profit = (t.quantity * t.price_per_share) - saleCost - t.taxes;
          sales.push({ ...t, avgPriceAtSale: avgPrice, profit: profit, category: tickersMap[ticker]?.category || 'Ações' });
          h.qty -= t.quantity;
          h.totalCost -= saleCost;
          if (h.qty <= 0) { h.qty = 0; h.totalCost = 0; }
        } else if (action === 'desdobramento') { 
          h.qty *= t.quantity; 
        } else if (action === 'grupamento' && t.quantity > 0) { 
          h.qty /= t.quantity; 
        } else if (action === 'incorporacao') {
          const tickerDest = (t.ticker_destino || "").toUpperCase().trim();
          const factor = t.fator_conversao || 1.0;
          
          if (tickerDest && h.qty > 0) {
            if (!holdings[tickerDest]) holdings[tickerDest] = { qty: 0, totalCost: 0 };
            const newQtyTotal = h.qty * factor;
            const qtyDestInt = Math.floor(newQtyTotal);
            const fraction = newQtyTotal - qtyDestInt;
            
            holdings[tickerDest].qty += qtyDestInt;
            holdings[tickerDest].totalCost += h.totalCost;
            
            if (fraction > 0) {
              const avgPriceOrig = h.totalCost / h.qty;
              const fractionCost = (fraction / factor) * avgPriceOrig;
              sales.push({
                ...t,
                ticker: t.ticker,
                action: 'Venda de Frações (Inc.)',
                quantity: fraction,
                price_per_share: 0,
                avgPriceAtSale: avgPriceOrig / factor,
                profit: -fractionCost,
                category: tickersMap[ticker]?.category || 'Ações'
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
          const k = `${t.date}|${t.ticker.toUpperCase()}`;
          dayBuys[k] = (dayBuys[k] || 0) + t.quantity;
        }
      });
      sales.forEach(s => {
        const k = `${s.date}|${s.ticker.toUpperCase()}`;
        if (dayBuys[k] && dayBuys[k] > 0) { s.isDayTrade = true; dayBuys[k] -= s.quantity; }
        else { s.isDayTrade = false; }
      });

      // Detect all years from transactions
      const yearSet = new Set();
      allTransactions.forEach(t => {
        if (t.date) yearSet.add(t.date.slice(0, 4));
      });
      const yearsList = Array.from(yearSet).sort();

      const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

      // Build per-year summaries with carry-forward
      const compiledData = {};
      // Carry-forward pools persist across years (prejuízo não expira)
      const accLoss = { swing: 0, dayTrade: 0 };

      yearsList.forEach(year => {
        const yearSummary = {};
        for (let i = 1; i <= 12; i++) {
          const k = `${year}-${String(i).padStart(2, '0')}`;
          yearSummary[k] = {
            key: k,
            name: monthNames[i - 1],
            // Resultados brutos
            comumAcoes: 0, comumBDRs: 0, comumFII: 0,
            dtAcoes: 0, dtBDRs: 0, dtFII: 0,
            // Volumes de venda
            totalVendasAcoes: 0, totalVendasBDRs: 0,
            // IRRF
            irrfAcoes: 0, irrfFII: 0, irrfDT: 0,
          };
        }

        // Populate monthly data
        sales.forEach(s => {
          const saleYear = s.date.slice(0, 4);
          if (saleYear !== year) return;
          const monthKey = s.date.slice(0, 7);
          const m = yearSummary[monthKey];
          if (!m) return;

          const cat = s.category;
          const isFII = cat === 'FIIs';
          const isBDR = cat === 'BDRs';
          const saleVolume = s.quantity * s.price_per_share;

          if (s.isDayTrade) {
            if (isFII) m.dtFII += s.profit;
            else if (isBDR) m.dtBDRs += s.profit;
            else m.dtAcoes += s.profit;
            // IRRF Day Trade: 1% sobre o lucro líquido positivo
            if (s.profit > 0) m.irrfDT += s.profit * 0.01;
          } else {
            if (isFII) {
              m.comumFII += s.profit;
              // IRRF FIIs: 1% sobre os rendimentos na alienação (IN RFB 1585/2015, Art. 68)
              m.irrfFII += saleVolume * 0.01;
            } else if (isBDR) {
              m.comumBDRs += s.profit;
              m.totalVendasBDRs += saleVolume;
              // IRRF swing trade: 0,005% sobre o valor de alienação
              m.irrfAcoes += saleVolume * 0.00005;
            } else {
              m.comumAcoes += s.profit;
              m.totalVendasAcoes += saleVolume;
              // IRRF swing trade: 0,005% sobre o valor de alienação
              m.irrfAcoes += saleVolume * 0.00005;
            }
          }
        });

        // Apply carry-forward within this year (continuing from previous year)
        const monthKeys = Object.keys(yearSummary).sort();
        monthKeys.forEach(k => {
          const m = yearSummary[k];

          // === SWING TRADE (Operações Comuns) ===
          const isAcoesExempt = m.totalVendasAcoes <= 20000;
          // Quando ações isentas, só BDRs participam do pool
          const swingTaxable = isAcoesExempt ? m.comumBDRs : (m.comumAcoes + m.comumBDRs);

          let swingBase = 0;
          const prevSwingLoss = accLoss.swing;
          if (swingTaxable < 0) {
            accLoss.swing += swingTaxable;
          } else if (swingTaxable > 0) {
            const net = swingTaxable + accLoss.swing;
            if (net <= 0) {
              accLoss.swing = net;
            } else {
              accLoss.swing = 0;
              swingBase = net;
            }
          }

          // === DAY TRADE (Ações/BDRs) ===
          const dtTotal = m.dtAcoes + m.dtBDRs;
          let dtBase = 0;
          const prevDTLoss = accLoss.dayTrade;
          if (dtTotal < 0) {
            accLoss.dayTrade += dtTotal;
          } else if (dtTotal > 0) {
            const net = dtTotal + accLoss.dayTrade;
            if (net <= 0) {
              accLoss.dayTrade = net;
            } else {
              accLoss.dayTrade = 0;
              dtBase = net;
            }
          }

          // Store computed values
          m._swingResult = swingTaxable;
          m._dtResult = dtTotal;
          m._prevSwingLoss = Math.abs(prevSwingLoss);
          m._prevDTLoss = Math.abs(prevDTLoss);
          m._swingBase = swingBase;
          m._dtBase = dtBase;
          m._swingLossToCarry = Math.min(0, swingTaxable > 0 ? 0 : swingTaxable);
          m._dtLossToCarry = Math.min(0, dtTotal > 0 ? 0 : dtTotal);
          m._accSwingLoss = accLoss.swing;
          m._accDTLoss = accLoss.dayTrade;
          m._isAcoesExempt = isAcoesExempt;
          m._comumAcoesRaw = m.comumAcoes;
          m._comumBDRsRaw = m.comumBDRs;

          // IRRF totals
          m._irrfComum = m.irrfAcoes;
          m._irrfDT = m.irrfDT;
          m._irrfFII = m.irrfFII;
        });

        compiledData[year] = yearSummary;
      });

      setAllYearData(compiledData);
      setYears(yearsList);

      const currentYear = new Date().getFullYear().toString();
      if (!selectedYear) {
        const targetYear = yearsList.includes(currentYear) ? currentYear : (yearsList[yearsList.length - 1] || currentYear);
        setSelectedYear(targetYear);
        if (!selectedMonth) setSelectedMonth(`${targetYear}-01`);
      }
    } catch (err) {
      setToast({ message: 'Erro ao calcular simulador de IR mensal.', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const handleRefresh = () => {
      loadData();
    };
    window.addEventListener('refresh-data', handleRefresh);
    return () => window.removeEventListener('refresh-data', handleRefresh);
  }, []);

  // When year changes, reset month to January of that year
  const handleYearChange = (newYear) => {
    setSelectedYear(newYear);
    setSelectedMonth(`${newYear}-01`);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
        <p className="text-zinc-400 font-medium">Sincronizando dados tributários do simulador...</p>
      </div>
    );
  }

  const irData = allYearData[selectedYear] || {};
  const currentData = irData[selectedMonth] || {
    name: 'Janeiro',
    comumAcoes: 0, comumBDRs: 0, dtAcoes: 0, dtBDRs: 0,
    comumFII: 0, dtFII: 0,
    _swingResult: 0, _dtResult: 0,
    _prevSwingLoss: 0, _prevDTLoss: 0,
    _swingBase: 0, _dtBase: 0,
    _swingLossToCarry: 0, _dtLossToCarry: 0,
    _accSwingLoss: 0, _accDTLoss: 0,
    _isAcoesExempt: true,
    _comumAcoesRaw: 0, _comumBDRsRaw: 0,
    _irrfComum: 0, _irrfDT: 0, _irrfFII: 0,
  };

  const fmt = (v) => v === 0 ? "0,00" : v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const cls = (v) => v < 0 ? 'text-red-400 font-medium' : v > 0 ? 'text-emerald-400 font-medium' : 'text-zinc-400';

  const impostoComum = currentData._swingBase * 0.15;
  const impostoDT = currentData._dtBase * 0.20;
  const impostoDevido = impostoComum + impostoDT;
  const irrfTotal = (currentData._irrfComum || 0) + (currentData._irrfDT || 0);
  const impostoPagar = Math.max(0, impostoDevido - irrfTotal);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tight">Simulador IR Mensal</h2>
          <p className="text-zinc-400 text-sm mt-1">Visualização de ganhos no layout padrão do programa da Receita Federal</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Year selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400">Ano:</span>
            <select
              value={selectedYear}
              onChange={(e) => handleYearChange(e.target.value)}
              className="py-1.5 px-3 bg-black/40 border border-white/5 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500 w-24"
            >
              {years.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <button 
            onClick={loadData}
            className="p-2.5 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] transition-all text-zinc-400 hover:text-white"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Months List */}
        <div className="glass-panel p-4 rounded-2xl h-fit space-y-1.5 bg-black/20">
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider px-2 mb-2">Selecione o Mês</p>
          {Object.keys(irData).sort().map(k => {
            const m = irData[k];
            if (!m) return null;
            return (
              <button
                key={k}
                onClick={() => setSelectedMonth(k)}
                className={`w-full text-left px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between transition-all ${
                  k === selectedMonth 
                    ? 'bg-indigo-600 text-white shadow-md' 
                    : 'text-zinc-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <span>{m.name}</span>
                <span className="text-[9px] opacity-75 font-mono">{k.split('-')[0]}</span>
              </button>
            );
          })}
        </div>

        {/* Main Simulator Card */}
        <div className="lg:col-span-3 glass-panel p-6 rounded-2xl space-y-6">
          <div className="border-b border-white/5 pb-4 flex justify-between items-center bg-white/[0.01] -m-6 px-6 py-4 rounded-t-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-400" />
              Mercado de Renda Variável - {currentData.name} de {selectedYear}
            </h3>
            <span className="text-[9px] bg-indigo-500/10 text-indigo-400 font-bold px-2 py-1 rounded tracking-widest uppercase">
              Simulação de Declaração
            </span>
          </div>

          {/* Section: Mercado a Vista */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Mercado à Vista — Ações/BDRs (Operações Comuns)</h4>
            <div className="border border-white/5 rounded-xl overflow-hidden text-xs">
              <div className="grid grid-cols-3 bg-black/40 py-2.5 px-4 font-bold text-zinc-400 border-b border-white/5 text-[10px] uppercase tracking-wider">
                <div>Ficha / Ativos</div>
                <div className="text-right">Operações Comuns</div>
                <div className="text-right">Day-Trade</div>
              </div>
              <div className="grid grid-cols-3 py-3 px-4 border-b border-white/5 bg-white/[0.01] hover:bg-indigo-500/[0.06] transition-all duration-150 border-l-2 border-l-transparent hover:border-l-indigo-500 cursor-pointer">
                <div className="text-zinc-300">Mercado à vista — ações</div>
                <div className={`text-right ${cls(currentData._comumAcoesRaw)}`}>{fmt(currentData._comumAcoesRaw)}</div>
                <div className={`text-right ${cls(currentData.dtAcoes)}`}>{fmt(currentData.dtAcoes)}</div>
              </div>
              <div className="grid grid-cols-3 py-3 px-4 border-b border-white/5 bg-white/[0.01] hover:bg-indigo-500/[0.06] transition-all duration-150 border-l-2 border-l-transparent hover:border-l-indigo-500 cursor-pointer">
                <div className="text-zinc-300">
                  BDRs (sem isenção R$20k)
                  {currentData._isAcoesExempt && currentData._comumBDRsRaw !== 0 && (
                    <span className="ml-1.5 text-[8px] text-amber-400 font-bold">TRIBUTÁVEL</span>
                  )}
                </div>
                <div className={`text-right ${cls(currentData._comumBDRsRaw)}`}>{fmt(currentData._comumBDRsRaw)}</div>
                <div className={`text-right ${cls(currentData.dtBDRs)}`}>{fmt(currentData.dtBDRs)}</div>
              </div>
              <div className="grid grid-cols-3 py-3 px-4 text-zinc-500 hover:bg-indigo-500/[0.04] transition-all duration-150 border-l-2 border-l-transparent hover:border-l-indigo-500 cursor-pointer">
                <div>Mercado à vista — ouro</div>
                <div className="text-right">0,00</div>
                <div className="text-right">0,00</div>
              </div>
            </div>
            {currentData._isAcoesExempt && (
              <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl px-3.5 py-2 text-[9px] text-emerald-400">
                ✓ Ações isentas neste mês (vendas ≤ R$20.000). Apenas BDRs entram na base de cálculo do Swing Trade.
              </div>
            )}
          </div>

          {/* Section: Resultados */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Resultados Fiscais (Ações/BDRs)</h4>
            <div className="border border-white/5 rounded-xl overflow-hidden text-xs">
              <div className="grid grid-cols-3 bg-black/40 py-2.5 px-4 font-bold text-zinc-400 border-b border-white/5 text-[10px] uppercase tracking-wider">
                <div>Resumos de compensação</div>
                <div className="text-right">Operações Comuns</div>
                <div className="text-right">Day-Trade</div>
              </div>
              <div className="grid grid-cols-3 py-3 px-4 border-b border-white/5 bg-white/[0.01] hover:bg-indigo-500/[0.06] transition-all duration-150 border-l-2 border-l-transparent hover:border-l-indigo-500 cursor-pointer">
                <div className="text-zinc-300 font-semibold">Resultado líquido do mês</div>
                <div className={`text-right ${cls(currentData._swingResult)}`}>{fmt(currentData._swingResult)}</div>
                <div className={`text-right ${cls(currentData._dtResult)}`}>{fmt(currentData._dtResult)}</div>
              </div>
              <div className="grid grid-cols-3 py-3 px-4 border-b border-white/5 text-zinc-500 hover:bg-indigo-500/[0.04] transition-all duration-150 border-l-2 border-l-transparent hover:border-l-indigo-500 cursor-pointer">
                <div>Resultado negativo até o mês anterior</div>
                <div className="text-right text-red-500/80">{fmt(currentData._prevSwingLoss)}</div>
                <div className="text-right text-red-500/80">{fmt(currentData._prevDTLoss)}</div>
              </div>
              <div className="grid grid-cols-3 py-3 px-4 border-b border-white/5 hover:bg-indigo-500/[0.06] transition-all duration-150 border-l-2 border-l-transparent hover:border-l-indigo-500 cursor-pointer">
                <div className="text-zinc-300 font-semibold">Base de cálculo do imposto</div>
                <div className="text-right text-white font-mono">{fmt(currentData._swingBase)}</div>
                <div className="text-right text-white font-mono">{fmt(currentData._dtBase)}</div>
              </div>
              <div className="grid grid-cols-3 py-3 px-4 text-zinc-500 hover:bg-indigo-500/[0.04] transition-all duration-150 border-l-2 border-l-transparent hover:border-l-indigo-500 cursor-pointer">
                <div>Prejuízo a compensar (acumulado)</div>
                <div className="text-right text-red-400/80">{fmt(Math.abs(currentData._accSwingLoss))}</div>
                <div className="text-right text-red-400/80">{fmt(Math.abs(currentData._accDTLoss))}</div>
              </div>
            </div>
          </div>

          {/* Totais do imposto */}
          <div className="border-t border-white/5 pt-4 space-y-3">
            <div className="flex justify-between items-center text-xs text-zinc-400 py-1">
              <span>Imposto Devido (Comum 15% / Day Trade 20%)</span>
              <span className="font-bold text-white font-mono">R$ {fmt(impostoDevido)}</span>
            </div>
            <div className="flex justify-between items-center text-xs text-zinc-400 py-1">
              <span>Imposto Retido na Fonte — "Dedo-duro" (0,005% ações · 1% DT)</span>
              <span className="font-bold text-white font-mono">R$ {fmt(irrfTotal)}</span>
            </div>
            <div className="flex justify-between items-center bg-indigo-500/10 p-4 rounded-xl border border-indigo-500/20 text-sm">
              <span className="font-bold text-indigo-300">Imposto Líquido a Pagar</span>
              <span className="font-black text-indigo-300 font-mono text-base">R$ {fmt(impostoPagar)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
