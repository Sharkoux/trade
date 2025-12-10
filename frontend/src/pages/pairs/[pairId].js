import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import PairChart from '@/components/PairChart';
import SignalBadge from '@/components/ui/SignalBadge';
import useWatchlist from '@/hooks/useWatchlist';
import useTradeHistory from '@/hooks/useTradeHistory';

export default function PairDetailPage() {
  const router = useRouter();
  const { pairId } = router.query;

  const [activeTab, setActiveTab] = useState('signal');
  const [timeframe, setTimeframe] = useState('1y');
  const [customRange, setCustomRange] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [backtest, setBacktest] = useState(null);
  const [series, setSeries] = useState([]);
  const [risk, setRisk] = useState(null);
  const [funding, setFunding] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [zEnter, setZEnter] = useState(1.5);
  const [zExit, setZExit] = useState(0.5);
  const [positionSize, setPositionSize] = useState(1000);

  const { toggleWatchlist, isInWatchlist } = useWatchlist();
  const { addTrade } = useTradeHistory();

  useEffect(() => {
    const now = new Date();
    const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    setEndDate(now.toISOString().split('T')[0]);
    setStartDate(oneYearAgo.toISOString().split('T')[0]);
  }, []);

  useEffect(() => {
    if (!pairId) return;
    const [coinA, coinB] = pairId.toUpperCase().split('-');

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          coinA,
          coinB,
          zEnter: String(zEnter),
          zExit: String(zExit),
          positionSize: String(positionSize),
        });

        if (customRange && startDate && endDate) {
          params.set('startTime', String(new Date(startDate).getTime()));
          params.set('endTime', String(new Date(endDate).getTime()));
        } else {
          params.set('timeframe', timeframe);
        }

        const res = await fetch(`/api/spread/backtest?` + params.toString());
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erreur API backtest');

        setSeries(data.series || []);
        setBacktest(data.backtest || null);
        setRisk(data.risk || null);
        setFunding(data.funding || null);
      } catch (e) {
        setError(e.message || 'Erreur lors du backtest');
        setSeries([]);
        setBacktest(null);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [pairId, timeframe, customRange, startDate, endDate, zEnter, zExit, positionSize]);

  if (!pairId) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[50vh]">
        <div className="text-gray-500">Chargement...</div>
      </div>
    );
  }

  const [coinA, coinB] = pairId.toUpperCase().split('-');

  const lastPoint = series.length > 0 ? series[series.length - 1] : null;
  const currentZ = lastPoint?.z || 0;
  const currentRatio = lastPoint?.ratio || 0;
  const mean = lastPoint?.mean || 0;
  const std = lastPoint?.std || 0;

  const signal = currentZ > zEnter ? 'SHORT' : currentZ < -zEnter ? 'LONG' : 'NEUTRE';
  const isActive = signal !== 'NEUTRE';

  let exitRatio = mean;
  let gainPct = 0;
  if (signal === 'SHORT' && currentRatio && mean) {
    exitRatio = mean + zExit * std;
    gainPct = ((currentRatio - exitRatio) / currentRatio) * 100;
  } else if (signal === 'LONG' && currentRatio && mean) {
    exitRatio = mean - zExit * std;
    gainPct = ((exitRatio - currentRatio) / currentRatio) * 100;
  }

  const position = signal === 'SHORT'
    ? `Short ${coinA} / Long ${coinB}`
    : signal === 'LONG'
      ? `Long ${coinA} / Short ${coinB}`
      : '-';

  const handleRecordTrade = () => {
    if (!isActive) return;
    const pnl = (gainPct / 100) * positionSize * (risk?.recommendedLeverage || 1);
    addTrade({
      pair: `${coinA}-${coinB}`,
      type: signal,
      entryPrice: currentRatio,
      exitPrice: exitRatio,
      pnl,
      pnlPercent: gainPct * (risk?.recommendedLeverage || 1),
      duration: 0,
    });
    alert('Trade enregistre dans l\'historique !');
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-lg bg-[#1f1f23] hover:bg-[#2a2a32] transition-colors"
          >
            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">{coinA} / {coinB}</h1>
              {isActive && <SignalBadge signal={signal} size="lg" />}
            </div>
            <p className="text-gray-500 text-sm mt-1">Spread Trading Analysis</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => toggleWatchlist(pairId)}
            className={`p-2.5 rounded-lg transition-colors ${
              isInWatchlist(pairId)
                ? 'bg-yellow-500/20 text-yellow-400'
                : 'bg-[#1f1f23] text-gray-400 hover:text-yellow-400'
            }`}
            title={isInWatchlist(pairId) ? 'Retirer de la watchlist' : 'Ajouter a la watchlist'}
          >
            <svg className="w-5 h-5" fill={isInWatchlist(pairId) ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          </button>
          {loading && <span className="text-xs text-gray-500">Chargement...</span>}
        </div>
      </div>

      {error && (
        <div className="card p-4 mb-6 bg-red-500/10 border-red-500/30">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-[#0d0d0f] p-1 rounded-lg w-fit mb-6">
        {[
          { id: 'signal', label: 'Signal & Trade' },
          { id: 'chart', label: 'Graphique' },
          { id: 'backtest', label: 'Backtest' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-[#1f1f23] text-white'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Signal Tab */}
      {activeTab === 'signal' && (
        <div className="space-y-6">
          {/* Signal Card */}
          <div className={`card p-6 ${
            isActive
              ? signal === 'SHORT' ? 'border-red-500/30 bg-red-500/5' : 'border-green-500/30 bg-green-500/5'
              : ''
          }`}>
            {isActive ? (
              <>
                <div className="text-center mb-6">
                  <p className="text-gray-400 text-sm mb-2">Signal Actif</p>
                  <h2 className={`text-5xl font-bold ${signal === 'SHORT' ? 'text-red-400' : 'text-green-400'}`}>
                    {signal}
                  </h2>
                  <p className="text-gray-300 mt-3 text-lg">{position}</p>
                </div>

                {/* Metriques */}
                <div className="grid grid-cols-5 gap-4 mb-6">
                  <div className="text-center p-3 rounded-lg bg-[#0d0d0f]">
                    <p className="text-gray-500 text-xs mb-1">Z-Score</p>
                    <p className="text-2xl font-bold text-yellow-400">{currentZ.toFixed(2)}</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-[#0d0d0f]">
                    <p className="text-gray-500 text-xs mb-1">Ratio</p>
                    <p className="text-2xl font-bold text-white">{currentRatio.toFixed(4)}</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-[#0d0d0f]">
                    <p className="text-gray-500 text-xs mb-1">Cible</p>
                    <p className="text-2xl font-bold text-blue-400">{exitRatio.toFixed(4)}</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-[#0d0d0f]">
                    <p className="text-gray-500 text-xs mb-1">Gain (1x)</p>
                    <p className="text-xl font-bold text-gray-300">+{gainPct.toFixed(1)}%</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-[#0d0d0f]">
                    <p className="text-gray-500 text-xs mb-1">Gain ({risk?.recommendedLeverage || 2}x)</p>
                    <p className="text-2xl font-bold text-green-400">+{(gainPct * (risk?.recommendedLeverage || 2)).toFixed(1)}%</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 justify-center mb-6">
                  <a
                    href={`https://app.hyperliquid.xyz/trade/${coinA}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex-1 max-w-xs py-3 rounded-xl font-semibold text-center transition-colors ${
                      signal === 'SHORT' ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-green-500 hover:bg-green-600 text-white'
                    }`}
                  >
                    {signal === 'SHORT' ? '↓ SHORT' : '↑ LONG'} {coinA}
                  </a>
                  <a
                    href={`https://app.hyperliquid.xyz/trade/${coinB}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex-1 max-w-xs py-3 rounded-xl font-semibold text-center transition-colors ${
                      signal === 'SHORT' ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-red-500 hover:bg-red-600 text-white'
                    }`}
                  >
                    {signal === 'SHORT' ? '↑ LONG' : '↓ SHORT'} {coinB}
                  </a>
                </div>

                <button
                  onClick={handleRecordTrade}
                  className="w-full py-2 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 text-sm hover:bg-blue-500/20 transition-colors"
                >
                  Enregistrer ce trade dans l'historique
                </button>
              </>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500 text-lg mb-2">Pas de signal actif</p>
                <p className="text-gray-600 text-sm">
                  Z-Score actuel : <strong className="text-gray-400">{currentZ.toFixed(2)}</strong>
                  <br />
                  Signal quand |z| &gt; {zEnter}
                </p>
              </div>
            )}
          </div>

          {/* Risk & Funding */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Risques */}
            {risk && (
              <div className="card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-white">Analyse des Risques</h3>
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                    risk.riskScore <= 3 ? 'bg-green-500/20 text-green-400' :
                    risk.riskScore <= 6 ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-red-500/20 text-red-400'
                  }`}>
                    Risque {risk.riskScore}/10
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <div className="p-3 rounded-lg bg-[#0d0d0f] text-center">
                    <p className="text-gray-500 text-xs mb-1">Correlation</p>
                    <p className={`text-lg font-bold ${risk.correlation >= 0.7 ? 'text-green-400' : risk.correlation >= 0.5 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {(risk.correlation * 100).toFixed(0)}%
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-[#0d0d0f] text-center">
                    <p className="text-gray-500 text-xs mb-1">Levier max</p>
                    <p className="text-lg font-bold text-blue-400">{risk.recommendedLeverage}x</p>
                  </div>
                  <div className="p-3 rounded-lg bg-[#0d0d0f] text-center">
                    <p className="text-gray-500 text-xs mb-1">Vol. {coinA}</p>
                    <p className={`text-lg font-bold ${risk.volA > 100 ? 'text-red-400' : 'text-gray-300'}`}>
                      {risk.volA.toFixed(0)}%
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-[#0d0d0f] text-center">
                    <p className="text-gray-500 text-xs mb-1">Max DD</p>
                    <p className={`text-lg font-bold ${risk.maxDrawdown > 30 ? 'text-red-400' : 'text-gray-300'}`}>
                      -{risk.maxDrawdown.toFixed(0)}%
                    </p>
                  </div>
                </div>

                {/* Alertes */}
                <div className="space-y-2 text-xs">
                  {risk.correlation < 0.5 && (
                    <div className="flex items-start gap-2 p-2 rounded-lg bg-red-500/10 border border-red-500/20">
                      <span className="text-red-400">!</span>
                      <span className="text-red-300">Faible correlation - risque de divergence</span>
                    </div>
                  )}
                  {risk.riskScore <= 4 && risk.correlation >= 0.7 && (
                    <div className="flex items-start gap-2 p-2 rounded-lg bg-green-500/10 border border-green-500/20">
                      <span className="text-green-400">✓</span>
                      <span className="text-green-300">Bonne paire pour le spread trading</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Funding */}
            {funding && (
              <div className="card p-6">
                <h3 className="font-semibold text-white mb-4">Funding Rates</h3>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="p-3 rounded-lg bg-[#0d0d0f] text-center">
                    <p className="text-gray-500 text-xs mb-1">{coinA} (8h)</p>
                    <p className={`text-lg font-bold ${funding.coinA.rate8h > 0 ? 'text-red-400' : 'text-green-400'}`}>
                      {funding.coinA.rate8h > 0 ? '+' : ''}{funding.coinA.rate8h.toFixed(4)}%
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-[#0d0d0f] text-center">
                    <p className="text-gray-500 text-xs mb-1">{coinB} (8h)</p>
                    <p className={`text-lg font-bold ${funding.coinB.rate8h > 0 ? 'text-red-400' : 'text-green-400'}`}>
                      {funding.coinB.rate8h > 0 ? '+' : ''}{funding.coinB.rate8h.toFixed(4)}%
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-[#0d0d0f] text-center">
                    <p className="text-gray-500 text-xs mb-1">Net (8h)</p>
                    <p className={`text-lg font-bold ${funding.netRate8h > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {funding.netRate8h > 0 ? '+' : ''}{funding.netRate8h.toFixed(4)}%
                    </p>
                  </div>
                </div>
                <p className="text-xs text-gray-600">
                  Funding positif = longs paient shorts. Negatif = shorts paient longs.
                </p>
              </div>
            )}
          </div>

          {/* Parametres */}
          <div className="card p-4 flex flex-wrap items-center gap-4 text-sm">
            <span className="text-gray-500">Parametres:</span>
            <label className="flex items-center gap-2">
              <span className="text-gray-400">Z seuil</span>
              <input
                type="number"
                step="0.1"
                value={zEnter}
                onChange={(e) => setZEnter(parseFloat(e.target.value))}
                className="w-16 text-center"
              />
            </label>
            <label className="flex items-center gap-2">
              <span className="text-gray-400">Position</span>
              <input
                type="number"
                value={positionSize}
                onChange={(e) => setPositionSize(parseFloat(e.target.value))}
                className="w-24 text-center"
              />
              <span className="text-gray-600">USDC</span>
            </label>
          </div>
        </div>
      )}

      {/* Chart Tab */}
      {activeTab === 'chart' && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white">Historique du ratio</h2>
            <div className="flex gap-2">
              {['1m', '3m', '6m', '1y'].map((tf) => (
                <button
                  key={tf}
                  onClick={() => { setTimeframe(tf); setCustomRange(false); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    !customRange && timeframe === tf
                      ? 'bg-blue-500 text-white'
                      : 'bg-[#1f1f23] text-gray-400 hover:text-white'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>

          <PairChart pairId={pairId} coinA={coinA} coinB={coinB} series={series} zEnter={zEnter} zExit={zExit} />

          <div className="flex gap-6 justify-center mt-4 text-xs text-gray-500">
            <span><span className="inline-block w-4 h-0.5 bg-red-400 mr-2"></span>Zone SHORT</span>
            <span><span className="inline-block w-4 h-0.5 bg-gray-400 mr-2"></span>Moyenne</span>
            <span><span className="inline-block w-4 h-0.5 bg-green-400 mr-2"></span>Zone LONG</span>
          </div>
        </div>
      )}

      {/* Backtest Tab */}
      {activeTab === 'backtest' && (
        <div className="space-y-6">
          {/* Stats */}
          {backtest && (
            <div className="grid grid-cols-4 gap-4">
              <div className="card p-4 text-center">
                <p className="text-gray-500 text-xs mb-1">Trades</p>
                <p className="text-2xl font-bold text-white">{backtest.nbTrades}</p>
              </div>
              <div className="card p-4 text-center">
                <p className="text-gray-500 text-xs mb-1">PnL Total</p>
                <p className={`text-2xl font-bold ${backtest.totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {backtest.totalPnl >= 0 ? '+' : ''}{backtest.totalPnl.toFixed(0)}$
                </p>
              </div>
              <div className="card p-4 text-center">
                <p className="text-gray-500 text-xs mb-1">Rendement moy.</p>
                <p className={`text-2xl font-bold ${backtest.avgPct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {backtest.avgPct >= 0 ? '+' : ''}{(backtest.avgPct * 100).toFixed(1)}%
                </p>
              </div>
              <div className="card p-4 text-center">
                <p className="text-gray-500 text-xs mb-1">Win Rate</p>
                <p className="text-2xl font-bold text-white">
                  {backtest.nbTrades > 0
                    ? `${((backtest.trades?.filter(t => t.pnlUsd > 0).length || 0) / backtest.nbTrades * 100).toFixed(0)}%`
                    : '-'}
                </p>
              </div>
            </div>
          )}

          {/* Trades */}
          <div className="card overflow-hidden">
            <div className="p-4 border-b border-[#1f1f23]">
              <h3 className="font-semibold text-white">Historique des trades</h3>
            </div>
            {backtest && backtest.trades && backtest.trades.length > 0 ? (
              <table className="w-full">
                <thead>
                  <tr className="bg-[#0d0d0f] border-b border-[#1f1f23]">
                    <th className="py-3 px-4 text-left">Type</th>
                    <th className="py-3 px-4 text-left">Entree</th>
                    <th className="py-3 px-4 text-left">Sortie</th>
                    <th className="py-3 px-4 text-left">Duree</th>
                    <th className="py-3 px-4 text-right">PnL</th>
                  </tr>
                </thead>
                <tbody>
                  {backtest.trades.slice().reverse().map((trade, i) => {
                    const entryDate = new Date(trade.entryTime).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
                    const exitDate = new Date(trade.exitTime).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
                    const durationDays = Math.round((trade.exitTime - trade.entryTime) / (1000 * 60 * 60 * 24));
                    const isProfit = trade.pnlUsd > 0;

                    return (
                      <tr key={i} className="border-b border-[#1f1f23]/50 hover:bg-[#151518]">
                        <td className="py-3 px-4">
                          <SignalBadge signal={trade.side === 'short' ? 'SHORT' : 'LONG'} size="sm" />
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-gray-300">{entryDate}</span>
                          <span className="text-gray-600 ml-2 text-xs">z={trade.entryZ.toFixed(2)}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-gray-300">{exitDate}</span>
                          <span className="text-gray-600 ml-2 text-xs">z={trade.exitZ.toFixed(2)}</span>
                        </td>
                        <td className="py-3 px-4 text-gray-500">{durationDays}j</td>
                        <td className="py-3 px-4 text-right">
                          <span className={`font-semibold ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
                            {isProfit ? '+' : ''}{trade.pnlUsd.toFixed(0)}$
                          </span>
                          <span className="text-gray-600 ml-1 text-xs">
                            ({isProfit ? '+' : ''}{(trade.pct * 100).toFixed(1)}%)
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="p-8 text-center text-gray-500">
                {backtest?.nbTrades === 0 ? 'Aucun trade sur cette periode.' : 'Chargement...'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
