import React, { useState, useEffect } from 'react';
import { RefreshCw, TrendingDown, Award, Calendar, ChevronDown, ChevronUp, Copy, Check, DollarSign } from 'lucide-react';

export default function DarfView({ fetchWithAuth, setToast }) {
  const [salesReport, setSalesReport] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedMonths, setExpandedMonths] = useState({});

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [txRes, tkRes] = await Promise.all([
        fetchWithAuth('/api/transactions'),
        fetchWithAuth('/api/tickers')
      ]);
      const transactions = await txRes.json();
      const tickersMap = await tkRes.json();

      // 1. Sort transactions: Date first, then Action Priority
      // Priority: Comprar (1), Desdobramento (2), Grupamento (2), Vender (3)
      const sortedTxs = [...transactions].sort((a, b) => {
        const dateDiff = new Date(a.date) - new Date(b.date);
        if (dateDiff !== 0) return dateDiff;
        const priority = { 'Comprar': 1, 'Recompensa': 1, 'Desdobramento': 2, 'Grupamento': 2, 'Incorporacao': 3, 'Vender': 4 };
        return (priority[a.action] || 5) - (priority[b.action] || 5);
      });

      // 2. State trackers
      const holdings = {}; // { ticker: { qty: 0, totalCost: 0 } }
      const sales = [];    // Array of sale results

      sortedTxs.forEach(t => {
        const ticker = t.ticker.toUpperCase();
        if (!holdings[ticker]) holdings[ticker] = { qty: 0, totalCost: 0 };
        const h = holdings[ticker];

        if (t.action === 'Comprar' || t.action === 'Recompensa') {
          h.qty += t.quantity;
          h.totalCost += (t.quantity * t.price_per_share) + t.taxes;
        } else if (t.action === 'Vender') {
          if (h.qty > 0) {
            const avgPrice = h.totalCost / h.qty;
            const effectiveSoldQty = Math.min(t.quantity, h.qty);
            const saleCost = effectiveSoldQty * avgPrice;
            const saleRevenue = t.quantity * t.price_per_share;
            const profit = saleRevenue - saleCost - t.taxes;

            sales.push({
              ...t,
              avgPriceAtSale: avgPrice,
              profit: profit,
              category: tickersMap[ticker]?.category || 'Ações'
            });

            h.qty -= t.quantity;
            h.totalCost -= saleCost;

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
            const currentCostOrig = h.totalCost;
            const avgPriceOrig = currentCostOrig / h.qty;
            const newQtyTotal = h.qty * fator;
            const qtyDestInt = Math.floor(newQtyTotal);
            const fraction = newQtyTotal - qtyDestInt;

            if (!holdings[tickerDest]) holdings[tickerDest] = { qty: 0, totalCost: 0 };
            holdings[tickerDest].qty += qtyDestInt;
            holdings[tickerDest].totalCost += currentCostOrig;

            if (fraction > 0) {
              const fractionCost = (fraction / fator) * avgPriceOrig;
              sales.push({
                ...t,
                ticker: t.ticker,
                action: 'Venda Fração',
                quantity: fraction,
                price_per_share: 0,
                avgPriceAtSale: avgPriceOrig / fator,
                profit: -fractionCost,
                category: tickersMap[ticker]?.category || 'Ações'
              });
            }

            h.qty = 0;
            h.totalCost = 0;
          }
        }
      });

      // 3. Day Trade Detection
      const dayBuys = {};
      sortedTxs.forEach(t => {
        if (t.action === 'Comprar' || t.action === 'Recompensa') {
          const k = `${t.date}|${t.ticker.toUpperCase()}`;
          dayBuys[k] = (dayBuys[k] || 0) + t.quantity;
        }
      });
      sales.forEach(s => {
        const k = `${s.date}|${s.ticker.toUpperCase()}`;
        if (dayBuys[k] && dayBuys[k] > 0) {
          s.isDayTrade = true;
          dayBuys[k] -= s.quantity;
        } else {
          s.isDayTrade = false;
        }
      });

      // 4. Group by Month
      const monthlySummary = {};
      sales.forEach(s => {
        const date = new Date(s.date + 'T00:00:00');
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (!monthlySummary[key]) {
          monthlySummary[key] = {
            swingAcoes: 0, swingBDRs: 0, swingFIIs: 0, cripto: 0,
            dayTradeAcoes: 0, dayTradeBDRs: 0, dayTradeFIIs: 0,
            totalVendasSwingAcoes: 0, totalVendasBDRs: 0, totalVendasFIIs: 0,
            totalVendasCripto: 0, totalVendasDayTrade: 0,
            details: []
          };
        }
        const m = monthlySummary[key];
        const cat = s.category;
        const isDT = s.isDayTrade;
        const saleVolume = s.quantity * s.price_per_share;

        if (isDT) {
          m.totalVendasDayTrade += saleVolume;
          if (cat === 'FIIs') m.dayTradeFIIs += s.profit;
          else if (cat === 'BDRs') m.dayTradeBDRs += s.profit;
          else m.dayTradeAcoes += s.profit;
        } else {
          if (cat === 'Cripto') {
            m.cripto += s.profit;
            m.totalVendasCripto += saleVolume;
          } else if (cat === 'FIIs') {
            m.swingFIIs += s.profit;
            m.totalVendasFIIs += saleVolume;
          } else if (cat === 'BDRs') {
            m.swingBDRs += s.profit;
            m.totalVendasBDRs += saleVolume;
          } else {
            m.swingAcoes += s.profit;
            m.totalVendasSwingAcoes += saleVolume;
          }
        }
        m.details.push(s);
      });

      // 5. Carry-forward losses pools
      const accLoss = { swing: 0, fiis: 0, dayTrade: 0, cripto: 0 };
      const chronoKeys = Object.keys(monthlySummary).sort();

      chronoKeys.forEach(monthKey => {
        const d = monthlySummary[monthKey];
        const swingProfit = d.swingAcoes + d.swingBDRs;
        const dtProfit = d.dayTradeAcoes + d.dayTradeBDRs + d.dayTradeFIIs;
        const fiiProfit = d.swingFIIs;
        const cryptoProfit = d.cripto;

        const applyCarry = (profit, pool) => {
          const net = profit + accLoss[pool];
          if (net < 0) {
            accLoss[pool] = net;
            return 0;
          } else {
            accLoss[pool] = 0;
            return net;
          }
        };

        const isSwingAcoesExempt = d.totalVendasSwingAcoes <= 20000;
        const isCriptoExempt = d.totalVendasCripto <= 35000;

        let swingTaxable;
        if (isSwingAcoesExempt && d.swingBDRs === 0) {
          swingTaxable = 0;
        } else {
          if (swingProfit < 0) {
            accLoss.swing += swingProfit;
            swingTaxable = 0;
          } else {
            swingTaxable = applyCarry(swingProfit, 'swing');
          }
        }

        let fiiTaxable;
        if (fiiProfit < 0) {
          accLoss.fiis += fiiProfit;
          fiiTaxable = 0;
        } else {
          fiiTaxable = applyCarry(fiiProfit, 'fiis');
        }

        let dtTaxable;
        if (dtProfit < 0) {
          accLoss.dayTrade += dtProfit;
          dtTaxable = 0;
        } else {
          dtTaxable = applyCarry(dtProfit, 'dayTrade');
        }

        let cryptoTaxable;
        if (isCriptoExempt) {
          cryptoTaxable = 0;
        } else {
          if (cryptoProfit < 0) {
            accLoss.cripto += cryptoProfit;
            cryptoTaxable = 0;
          } else {
            cryptoTaxable = applyCarry(cryptoProfit, 'cripto');
          }
        }

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
        d._accLossSnapshot = { ...accLoss };
      });

      // Transform to display format
      const displayData = chronoKeys.map(key => ({
        key,
        ...monthlySummary[key]
      })).reverse();

      setSalesReport(displayData);

    } catch (err) {
      setToast({ message: 'Erro ao calcular relatório tributário.', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const toggleMonth = (monthKey) => {
    setExpandedMonths(prev => ({
      ...prev,
      [monthKey]: !prev[monthKey]
    }));
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
        <p className="text-zinc-400 font-medium">Processando vendas e gerando DARFs...</p>
      </div>
    );
  }

  const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">DARFs e Histórico de Vendas</h2>
          <p className="text-zinc-400 text-sm">Apuração mensal de ganhos e perdas tributáveis para Renda Variável</p>
        </div>
        <button 
          onClick={loadData}
          className="p-2.5 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] transition-all text-zinc-400 hover:text-white"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {salesReport.length === 0 ? (
        <div className="glass-panel p-8 text-center text-zinc-500 rounded-2xl">
          Nenhuma alienação/venda encontrada no histórico de transações.
        </div>
      ) : (
        <div className="space-y-6">
          {salesReport.map(report => {
            const [year, month] = report.key.split('-');
            const monthName = monthNames[parseInt(month) - 1];
            const isExpanded = !!expandedMonths[report.key];

            const profitColors = (val) => val >= 0 ? 'text-emerald-400' : 'text-red-400';

            return (
              <div key={report.key} className="glass-panel rounded-2xl overflow-hidden border border-white/5">
                {/* Header */}
                <div 
                  onClick={() => toggleMonth(report.key)}
                  className="px-6 py-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-white/[0.02] transition-colors bg-white/[0.01]"
                >
                  <div>
                    <h3 className="text-base font-bold text-white">{monthName} de {year}</h3>
                    <span className="text-xs text-zinc-500">Volume Vendas Ações: {report.totalVendasSwingAcoes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wide">DARF Total Estimado</p>
                      <p className="text-base font-extrabold text-indigo-400">
                        {report._totalDarf.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </p>
                    </div>
                    {isExpanded ? <ChevronUp className="w-5 h-5 text-zinc-400" /> : <ChevronDown className="w-5 h-5 text-zinc-400" />}
                  </div>
                </div>

                {/* Body Details */}
                {isExpanded && (
                  <div className="px-6 pb-6 pt-2 border-t border-white/5 space-y-6 animate-fade-in">
                    {/* Summaries grid */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      {/* Swing Trade */}
                      <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Swing Trade (15%)</p>
                        <p className={`text-base font-bold mt-1 ${profitColors(report._swingProfit)}`}>
                          {report._swingProfit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </p>
                        <p className="text-[9px] text-zinc-500 mt-1">{report._isSwingExempt ? 'Isento (< R$20k)' : `DARF: ${report._swingTax.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`}</p>
                      </div>

                      {/* Day Trade */}
                      <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">⚡ Day Trade (20%)</p>
                        <p className={`text-base font-bold mt-1 ${profitColors(report._dtProfit)}`}>
                          {report._dtProfit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </p>
                        <p className="text-[9px] text-zinc-500 mt-1">DARF: {report._dtTax.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                      </div>

                      {/* FIIs */}
                      <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">FIIs (20%)</p>
                        <p className={`text-base font-bold mt-1 ${profitColors(report._fiiProfit)}`}>
                          {report._fiiProfit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </p>
                        <p className="text-[9px] text-zinc-500 mt-1">DARF: {report._fiiTax.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                      </div>

                      {/* Criptos */}
                      <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Cripto (15%)</p>
                        <p className={`text-base font-bold mt-1 ${profitColors(report._cryptoProfit)}`}>
                          {report._cryptoProfit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </p>
                        <p className="text-[9px] text-zinc-500 mt-1">{report._isCryptoExempt ? 'Isento (< R$35k)' : `DARF: ${report._cryptoTax.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`}</p>
                      </div>

                      {/* Month Total DARF */}
                      <div className="bg-indigo-500/10 p-4 rounded-xl border border-indigo-500/20 col-span-2 md:col-span-1">
                        <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Darf Total</p>
                        <p className="text-base font-black text-indigo-300 mt-1">
                          {report._totalDarf.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </p>
                        <p className="text-[8px] text-zinc-500 mt-1">Pagar até 30/{monthNames[(parseInt(month)) % 12].slice(0,3).toLowerCase()}</p>
                      </div>
                    </div>

                    {/* Prejuízos acumulados carry forward info */}
                    {(report._accLossSnapshot.swing < 0 || report._accLossSnapshot.fiis < 0 || report._accLossSnapshot.dayTrade < 0 || report._accLossSnapshot.cripto < 0) && (
                      <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-3.5 flex items-center justify-between text-xs text-red-300">
                        <span className="font-semibold uppercase tracking-wider text-[9px] text-zinc-400">📉 Prejuízos Acumulados para Compensação futura:</span>
                        <div className="flex gap-4">
                          {report._accLossSnapshot.swing < 0 && <span>Swing: {report._accLossSnapshot.swing.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>}
                          {report._accLossSnapshot.fiis < 0 && <span>FIIs: {report._accLossSnapshot.fiis.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>}
                          {report._accLossSnapshot.dayTrade < 0 && <span>Day Trade: {report._accLossSnapshot.dayTrade.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>}
                          {report._accLossSnapshot.cripto < 0 && <span>Cripto: {report._accLossSnapshot.cripto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>}
                        </div>
                      </div>
                    )}

                    {/* Table of operations inside this month */}
                    <div className="overflow-x-auto border border-white/5 rounded-xl">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-black/40 border-b border-white/5 text-zinc-400">
                            <th className="px-4 py-3 text-left">Data</th>
                            <th className="px-4 py-3 text-left">Ativo</th>
                            <th className="px-4 py-3 text-left">Modalidade</th>
                            <th className="px-4 py-3 text-right">Quant</th>
                            <th className="px-4 py-3 text-right">Preço Médio</th>
                            <th className="px-4 py-3 text-right">Preço Venda</th>
                            <th className="px-4 py-3 text-right">Resultado Líquido</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {report.details.map((s, idx) => (
                            <tr key={idx} className="hover:bg-white/[0.01]">
                              <td className="px-4 py-3 text-zinc-400 text-left font-mono">{s.date.split('-').reverse().join('/')}</td>
                              <td className="px-4 py-3 text-left">
                                <span className="bg-indigo-500/15 text-indigo-300 font-bold px-2 py-0.5 rounded text-[10px] mr-1.5">{s.ticker}</span>
                                <span className="text-[10px] text-zinc-500">{s.category}</span>
                              </td>
                              <td className="px-4 py-3 text-left">
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${s.isDayTrade ? 'bg-red-500/15 text-red-400' : 'bg-indigo-500/15 text-indigo-400'}`}>
                                  {s.isDayTrade ? 'Day Trade' : 'Swing'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right text-zinc-300 font-mono">{s.quantity.toLocaleString('pt-BR', { maximumFractionDigits: 6 })}</td>
                              <td className="px-4 py-3 text-right text-zinc-300 font-mono">{s.avgPriceAtSale.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                              <td className="px-4 py-3 text-right text-zinc-300 font-mono">{s.price_per_share.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                              <td className={`px-4 py-3 text-right font-bold font-mono ${profitColors(s.profit)}`}>
                                {s.profit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
