// pages/pairs/[pairId].js
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import PairChart from '../../components/PairChart';

export default function PairDetailPage() {
  const router = useRouter();
  const { pairId } = router.query;

  const [activeTab, setActiveTab] = useState('signal'); // signal | chart | backtest
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

  // Initialiser les dates par défaut
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

        console.log(`[frontend] Received ${data.series?.length || 0} data points`);
        setSeries(data.series || []);
        setBacktest(data.backtest || null);
        setRisk(data.risk || null);
        setFunding(data.funding || null);
      } catch (e) {
        console.error('[frontend] Error:', e.message);
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
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        Chargement…
      </div>
    );
  }

  const [coinA, coinB] = pairId.toUpperCase().split('-');

  // Calculs pour le signal - utiliser les mean/std du dernier point (fenêtre glissante 90j)
  const lastPoint = series.length > 0 ? series[series.length - 1] : null;
  const currentZ = lastPoint?.z || 0;
  const currentRatio = lastPoint?.ratio || 0;
  // Utiliser mean/std de la fenêtre glissante (calculés côté API)
  const mean = lastPoint?.mean || 0;
  const std = lastPoint?.std || 0;

  const signal = currentZ > zEnter ? 'SHORT' : currentZ < -zEnter ? 'LONG' : 'NEUTRE';
  const isActive = signal !== 'NEUTRE';

  // Pour la sortie, on vise un retour vers la moyenne (|z| < zExit)
  // SHORT: ratio élevé → on attend qu'il baisse → cible = mean + zExit*std (légèrement au-dessus de la moyenne)
  // LONG: ratio bas → on attend qu'il monte → cible = mean - zExit*std (légèrement en-dessous de la moyenne)
  // MAIS attention: pour le calcul du gain, c'est la direction qui compte
  let exitRatio = mean; // La cible ultime est la moyenne

  let gainPct = 0;
  if (signal === 'SHORT' && currentRatio && mean) {
    // SHORT ratio: on gagne si le ratio baisse (de currentRatio vers mean)
    // Gain = (entryRatio - exitRatio) / entryRatio
    // En pratique on sort quand |z| < zExit, donc exitRatio ≈ mean + zExit*std
    exitRatio = mean + zExit * std;
    gainPct = ((currentRatio - exitRatio) / currentRatio) * 100;
  } else if (signal === 'LONG' && currentRatio && mean) {
    // LONG ratio: on gagne si le ratio monte (de currentRatio vers mean)
    // En pratique on sort quand |z| < zExit, donc exitRatio ≈ mean - zExit*std
    exitRatio = mean - zExit * std;
    gainPct = ((exitRatio - currentRatio) / currentRatio) * 100;
  }

  const position = signal === 'SHORT'
    ? `Short ${coinA} / Long ${coinB}`
    : signal === 'LONG'
      ? `Long ${coinA} / Short ${coinB}`
      : '—';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col gap-4">

        {/* Header compact */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/')}
              className="text-slate-400 hover:text-slate-200"
            >
              ←
            </button>
            <h1 className="text-xl font-bold">{coinA} / {coinB}</h1>
            {isActive && (
              <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                signal === 'SHORT' ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'
              }`}>
                {signal}
              </span>
            )}
          </div>
          {loading && <span className="text-xs text-slate-500">Chargement...</span>}
          {error && <span className="text-xs text-red-400">{error}</span>}
        </header>

        {/* Onglets */}
        <div className="flex gap-1 bg-slate-900 p-1 rounded-lg w-fit">
          {[
            { id: 'signal', label: 'Signal & Trade' },
            { id: 'chart', label: 'Graphique' },
            { id: 'backtest', label: 'Backtest' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-slate-800 text-slate-100'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Contenu des onglets */}
        <div className="flex flex-col gap-4">

          {/* ONGLET SIGNAL */}
          {activeTab === 'signal' && (
            <>
              {/* Carte signal principal */}
              <div className={`rounded-2xl p-6 ${
                isActive
                  ? signal === 'SHORT' ? 'bg-red-500/10 border border-red-500/30' : 'bg-emerald-500/10 border border-emerald-500/30'
                  : 'bg-slate-900 border border-slate-800'
              }`}>
                {isActive ? (
                  <>
                    <div className="text-center mb-6">
                      <p className="text-slate-400 text-sm mb-1">Signal actif</p>
                      <h2 className={`text-4xl font-bold ${signal === 'SHORT' ? 'text-red-400' : 'text-emerald-400'}`}>
                        {signal}
                      </h2>
                      <p className="text-slate-300 mt-2 text-lg">{position}</p>
                    </div>

                    {/* Métriques clés */}
                    <div className="grid grid-cols-5 gap-3 mb-6">
                      <div className="text-center">
                        <p className="text-slate-500 text-xs">Z-Score</p>
                        <p className="text-2xl font-bold text-amber-400">{currentZ.toFixed(2)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-slate-500 text-xs">Ratio actuel</p>
                        <p className="text-2xl font-bold text-slate-100">{currentRatio.toFixed(4)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-slate-500 text-xs">Cible sortie</p>
                        <p className="text-2xl font-bold text-sky-400">{exitRatio.toFixed(4)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-slate-500 text-xs">Gain (1x)</p>
                        <p className="text-xl font-bold text-slate-300">+{gainPct.toFixed(1)}%</p>
                      </div>
                      <div className="text-center">
                        <p className="text-slate-500 text-xs">Gain ({risk?.recommendedLeverage || 2}x)</p>
                        <p className="text-2xl font-bold text-emerald-400">+{(gainPct * (risk?.recommendedLeverage || 2)).toFixed(1)}%</p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="space-y-4">
                      <div className="flex gap-3 justify-center">
                        <a
                          href={`https://app.hyperliquid.xyz/trade/${coinA}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`flex-1 max-w-xs py-3 rounded-xl font-semibold text-center ${
                            signal === 'SHORT' ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-emerald-500 hover:bg-emerald-600 text-white'
                          }`}
                        >
                          {signal === 'SHORT' ? '↓ SHORT' : '↑ LONG'} {coinA}
                        </a>
                        <a
                          href={`https://app.hyperliquid.xyz/trade/${coinB}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`flex-1 max-w-xs py-3 rounded-xl font-semibold text-center ${
                            signal === 'SHORT' ? 'bg-emerald-500 hover:bg-emerald-600 text-white' : 'bg-red-500 hover:bg-red-600 text-white'
                          }`}
                        >
                          {signal === 'SHORT' ? '↑ LONG' : '↓ SHORT'} {coinB}
                        </a>
                      </div>

                      <p className="text-center text-slate-500 text-xs">
                        Taille suggérée : {positionSize / 2} USDC par position
                      </p>
                    </div>

                    {/* Info sortie */}
                    <div className="mt-6 bg-slate-800/50 rounded-xl p-4">
                      <p className="text-sky-400 font-semibold text-sm mb-2">Quand fermer ?</p>
                      <p className="text-slate-300 text-sm">
                        Ferme les <strong>deux positions simultanément</strong> quand le ratio atteint{' '}
                        <strong className="text-sky-400">{exitRatio.toFixed(4)}</strong>
                      </p>
                      <div className="flex gap-2 mt-3">
                        <a href={`https://app.hyperliquid.xyz/trade/${coinA}`} target="_blank" rel="noopener noreferrer"
                          className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-xs">
                          Fermer {coinA}
                        </a>
                        <a href={`https://app.hyperliquid.xyz/trade/${coinB}`} target="_blank" rel="noopener noreferrer"
                          className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-xs">
                          Fermer {coinB}
                        </a>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-slate-500 text-lg mb-2">Pas de signal actif</p>
                    <p className="text-slate-600 text-sm">
                      Z-Score actuel : <strong className="text-slate-400">{currentZ.toFixed(2)}</strong>
                      <br />
                      Un signal se déclenche quand |z| {'>'} {zEnter}
                    </p>
                  </div>
                )}
              </div>

              {/* Section Risques */}
              {risk && (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold flex items-center gap-2">
                      Analyse des risques
                    </h3>
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      risk.riskScore <= 3 ? 'bg-emerald-500/20 text-emerald-400' :
                      risk.riskScore <= 6 ? 'bg-amber-500/20 text-amber-400' :
                      'bg-red-500/20 text-red-400'
                    }`}>
                      Risque {risk.riskScore}/10
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                    <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                      <p className="text-slate-500 text-xs mb-1">Corrélation</p>
                      <p className={`text-xl font-bold ${risk.correlation >= 0.7 ? 'text-emerald-400' : risk.correlation >= 0.5 ? 'text-amber-400' : 'text-red-400'}`}>
                        {(risk.correlation * 100).toFixed(0)}%
                      </p>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                      <p className="text-slate-500 text-xs mb-1">Levier max</p>
                      <p className="text-xl font-bold text-sky-400">{risk.recommendedLeverage}x</p>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                      <p className="text-slate-500 text-xs mb-1">Vol. {coinA}</p>
                      <p className={`text-xl font-bold ${risk.volA > 100 ? 'text-red-400' : risk.volA > 60 ? 'text-amber-400' : 'text-slate-100'}`}>
                        {risk.volA.toFixed(0)}%
                      </p>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                      <p className="text-slate-500 text-xs mb-1">Vol. {coinB}</p>
                      <p className={`text-xl font-bold ${risk.volB > 100 ? 'text-red-400' : risk.volB > 60 ? 'text-amber-400' : 'text-slate-100'}`}>
                        {risk.volB.toFixed(0)}%
                      </p>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                      <p className="text-slate-500 text-xs mb-1">Max Drawdown</p>
                      <p className={`text-xl font-bold ${risk.maxDrawdown > 30 ? 'text-red-400' : 'text-slate-100'}`}>
                        -{risk.maxDrawdown.toFixed(0)}%
                      </p>
                    </div>
                  </div>

                  {/* Alertes */}
                  <div className="space-y-2 text-xs">
                    {risk.correlation < 0.5 && (
                      <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-lg p-2">
                        <span className="text-red-400">⚠</span>
                        <span className="text-red-300">
                          <strong>Faible corrélation ({(risk.correlation * 100).toFixed(0)}%)</strong> — Ces tokens peuvent diverger fortement. Risque de perte sur une jambe.
                        </span>
                      </div>
                    )}
                    {(risk.volA > 100 || risk.volB > 100) && (
                      <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg p-2">
                        <span className="text-amber-400">⚠</span>
                        <span className="text-amber-300">
                          <strong>Forte volatilité</strong> — Utilisez un levier faible ({risk.recommendedLeverage}x max) pour éviter la liquidation.
                        </span>
                      </div>
                    )}
                    {risk.maxDrawdown > 40 && (
                      <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg p-2">
                        <span className="text-amber-400">⚠</span>
                        <span className="text-amber-300">
                          <strong>Drawdown historique élevé ({risk.maxDrawdown.toFixed(0)}%)</strong> — Le ratio peut s'écarter longtemps de la moyenne.
                        </span>
                      </div>
                    )}
                    {risk.riskScore <= 4 && risk.correlation >= 0.7 && (
                      <div className="flex items-start gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-2">
                        <span className="text-emerald-400">✓</span>
                        <span className="text-emerald-300">
                          <strong>Bonne paire pour le spread</strong> — Corrélation élevée et volatilité modérée.
                        </span>
                      </div>
                    )}
                  </div>

                  <p className="text-slate-600 text-[10px] mt-3">
                    Volatilité = annualisée sur la période. Levier basé sur 10% de marge de sécurité avant liquidation.
                  </p>
                </div>
              )}

              {/* Funding Rates */}
              {funding && (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                  <h3 className="font-semibold mb-3">Funding Rates (coût de maintien)</h3>

                  <div className="grid grid-cols-3 gap-4 mb-3">
                    <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                      <p className="text-slate-500 text-xs mb-1">{coinA} (8h)</p>
                      <p className={`text-lg font-bold ${funding.coinA.rate8h > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                        {funding.coinA.rate8h > 0 ? '+' : ''}{funding.coinA.rate8h.toFixed(4)}%
                      </p>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                      <p className="text-slate-500 text-xs mb-1">{coinB} (8h)</p>
                      <p className={`text-lg font-bold ${funding.coinB.rate8h > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                        {funding.coinB.rate8h > 0 ? '+' : ''}{funding.coinB.rate8h.toFixed(4)}%
                      </p>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                      <p className="text-slate-500 text-xs mb-1">Net spread (8h)</p>
                      <p className={`text-lg font-bold ${signal === 'SHORT' ? (funding.netRate8h > 0 ? 'text-emerald-400' : 'text-red-400') : (funding.netRate8h < 0 ? 'text-emerald-400' : 'text-red-400')}`}>
                        {signal === 'SHORT'
                          ? (funding.netRate8h > 0 ? '+' : '') + funding.netRate8h.toFixed(4)
                          : ((-funding.netRate8h) > 0 ? '+' : '') + (-funding.netRate8h).toFixed(4)}%
                      </p>
                    </div>
                  </div>

                  {/* Estimation du coût */}
                  {isActive && (
                    <div className={`rounded-lg p-3 text-xs ${
                      (signal === 'SHORT' ? funding.netRate8h : -funding.netRate8h) < 0 ? 'bg-red-500/10' : 'bg-emerald-500/10'
                    }`}>
                      {(() => {
                        const netForSignal = signal === 'SHORT' ? funding.netRate8h : -funding.netRate8h;
                        const dailyCost = netForSignal * 3; // 3 × 8h par jour
                        const costPer10Days = dailyCost * 10;
                        const annualized = signal === 'SHORT' ? funding.netAnnualized : -funding.netAnnualized;

                        return (
                          <>
                            <p className={netForSignal < 0 ? 'text-red-300' : 'text-emerald-300'}>
                              {netForSignal < 0 ? (
                                <>
                                  <strong>Coût estimé :</strong> {Math.abs(costPer10Days).toFixed(3)}% pour 10 jours
                                  ({Math.abs(annualized).toFixed(1)}% annualisé)
                                </>
                              ) : (
                                <>
                                  <strong>Gain estimé :</strong> +{costPer10Days.toFixed(3)}% pour 10 jours
                                  (+{annualized.toFixed(1)}% annualisé)
                                </>
                              )}
                            </p>
                            <p className="text-slate-500 mt-1">
                              Pour {positionSize}$ : {netForSignal < 0 ? '-' : '+'}{Math.abs(costPer10Days * positionSize / 100).toFixed(2)}$ / 10 jours
                            </p>
                          </>
                        );
                      })()}
                    </div>
                  )}

                  <p className="text-slate-600 text-[10px] mt-2">
                    Funding positif = les longs paient les shorts. Négatif = les shorts paient les longs.
                  </p>
                </div>
              )}

              {/* Paramètres de trading */}
              <div className="flex flex-wrap gap-4 items-center bg-slate-900/50 rounded-xl p-4 text-xs">
                <span className="text-slate-500">Signal calculé sur 90 jours glissants</span>
                <div className="flex-1" />
                <label className="flex items-center gap-2">
                  <span className="text-slate-500">Seuil Z</span>
                  <input
                    type="number"
                    step="0.1"
                    value={zEnter}
                    onChange={(e) => setZEnter(parseFloat(e.target.value))}
                    className="w-16 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-center"
                  />
                </label>
                <label className="flex items-center gap-2">
                  <span className="text-slate-500">Position</span>
                  <input
                    type="number"
                    value={positionSize}
                    onChange={(e) => setPositionSize(parseFloat(e.target.value))}
                    className="w-20 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-center"
                  />
                  <span className="text-slate-600">USDC</span>
                </label>
              </div>
            </>
          )}

          {/* ONGLET GRAPHIQUE */}
          {activeTab === 'chart' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold">Historique du ratio</h2>
                <div className="flex gap-2 text-xs">
                  {['1m', '3m', '6m', '1y'].map((tf) => (
                    <button
                      key={tf}
                      onClick={() => { setTimeframe(tf); setCustomRange(false); }}
                      className={`px-2 py-1 rounded ${
                        !customRange && timeframe === tf
                          ? 'bg-sky-500 text-slate-900'
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                      }`}
                    >
                      {tf}
                    </button>
                  ))}
                  <button
                    onClick={() => setCustomRange(!customRange)}
                    className={`px-2 py-1 rounded ${
                      customRange ? 'bg-sky-500 text-slate-900' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    Custom
                  </button>
                </div>
              </div>

              {customRange && (
                <div className="flex gap-3 mb-4 text-xs">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="bg-slate-800 border border-slate-700 rounded px-2 py-1"
                  />
                  <span className="text-slate-500 self-center">→</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="bg-slate-800 border border-slate-700 rounded px-2 py-1"
                  />
                </div>
              )}

              <PairChart pairId={pairId} coinA={coinA} coinB={coinB} series={series} zEnter={zEnter} zExit={zExit} />

              {/* Légende */}
              <div className="flex gap-4 justify-center mt-4 text-xs text-slate-500">
                <span><span className="inline-block w-3 h-0.5 bg-red-400 mr-1"></span> Zone SHORT</span>
                <span><span className="inline-block w-3 h-0.5 bg-slate-400 mr-1"></span> Moyenne</span>
                <span><span className="inline-block w-3 h-0.5 bg-emerald-400 mr-1"></span> Zone LONG</span>
              </div>
            </div>
          )}

          {/* ONGLET BACKTEST */}
          {activeTab === 'backtest' && (
            <>
              {/* Paramètres backtest */}
              <div className="bg-slate-900/50 rounded-xl p-4 flex flex-wrap gap-4 items-center text-xs">
                <div className="flex gap-2 items-center">
                  <span className="text-slate-500">Période :</span>
                  {['1m', '3m', '6m', '1y'].map((tf) => (
                    <button
                      key={tf}
                      onClick={() => { setTimeframe(tf); setCustomRange(false); }}
                      className={`px-2 py-1 rounded ${
                        !customRange && timeframe === tf
                          ? 'bg-sky-500 text-slate-900'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {tf}
                    </button>
                  ))}
                  <button
                    onClick={() => setCustomRange(!customRange)}
                    className={`px-2 py-1 rounded ${customRange ? 'bg-sky-500 text-slate-900' : 'bg-slate-800 text-slate-400'}`}
                  >
                    Custom
                  </button>
                </div>

                {customRange && (
                  <div className="flex gap-2 items-center">
                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                      className="bg-slate-800 border border-slate-700 rounded px-2 py-1" />
                    <span className="text-slate-600">→</span>
                    <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                      className="bg-slate-800 border border-slate-700 rounded px-2 py-1" />
                  </div>
                )}

                <div className="flex-1" />

                <label className="flex items-center gap-1">
                  <span className="text-slate-500">zEnter</span>
                  <input type="number" step="0.1" value={zEnter} onChange={(e) => setZEnter(parseFloat(e.target.value))}
                    className="w-14 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-center" />
                </label>
                <label className="flex items-center gap-1">
                  <span className="text-slate-500">zExit</span>
                  <input type="number" step="0.1" value={zExit} onChange={(e) => setZExit(parseFloat(e.target.value))}
                    className="w-14 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-center" />
                </label>
                <label className="flex items-center gap-1">
                  <span className="text-slate-500">Taille</span>
                  <input type="number" value={positionSize} onChange={(e) => setPositionSize(parseFloat(e.target.value))}
                    className="w-20 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-center" />
                </label>
              </div>

              {/* Résumé */}
              {backtest && (
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-slate-900 rounded-xl p-4 text-center">
                    <p className="text-slate-500 text-xs mb-1">Trades</p>
                    <p className="text-2xl font-bold">{backtest.nbTrades}</p>
                  </div>
                  <div className="bg-slate-900 rounded-xl p-4 text-center">
                    <p className="text-slate-500 text-xs mb-1">PnL Total</p>
                    <p className={`text-2xl font-bold ${backtest.totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {backtest.totalPnl >= 0 ? '+' : ''}{backtest.totalPnl.toFixed(0)} $
                    </p>
                  </div>
                  <div className="bg-slate-900 rounded-xl p-4 text-center">
                    <p className="text-slate-500 text-xs mb-1">Rendement moy.</p>
                    <p className={`text-2xl font-bold ${backtest.avgPct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {backtest.avgPct >= 0 ? '+' : ''}{(backtest.avgPct * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div className="bg-slate-900 rounded-xl p-4 text-center">
                    <p className="text-slate-500 text-xs mb-1">Win rate</p>
                    <p className="text-2xl font-bold">
                      {backtest.nbTrades > 0
                        ? `${((backtest.trades?.filter(t => t.pnlUsd > 0).length || 0) / backtest.nbTrades * 100).toFixed(0)}%`
                        : '—'}
                    </p>
                  </div>
                </div>
              )}

              {/* Historique des trades */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <h3 className="font-semibold mb-3">Historique des trades</h3>
                {backtest && backtest.trades && backtest.trades.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-slate-500 text-xs border-b border-slate-800">
                          <th className="text-left py-2">Type</th>
                          <th className="text-left py-2">Entrée</th>
                          <th className="text-left py-2">Sortie</th>
                          <th className="text-left py-2">Durée</th>
                          <th className="text-right py-2">PnL</th>
                        </tr>
                      </thead>
                      <tbody>
                        {backtest.trades.slice().reverse().map((trade, i) => {
                          const entryDate = new Date(trade.entryTime).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
                          const exitDate = new Date(trade.exitTime).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
                          const durationDays = Math.round((trade.exitTime - trade.entryTime) / (1000 * 60 * 60 * 24));
                          const isProfit = trade.pnlUsd > 0;

                          return (
                            <tr key={i} className="border-b border-slate-800/50">
                              <td className={`py-3 font-semibold ${trade.side === 'short' ? 'text-red-400' : 'text-emerald-400'}`}>
                                {trade.side === 'short' ? 'SHORT' : 'LONG'}
                              </td>
                              <td className="py-3">
                                <span className="text-slate-300">{entryDate}</span>
                                <span className="text-slate-600 ml-2 text-xs">z={trade.entryZ.toFixed(2)}</span>
                              </td>
                              <td className="py-3">
                                <span className="text-slate-300">{exitDate}</span>
                                <span className="text-slate-600 ml-2 text-xs">z={trade.exitZ.toFixed(2)}</span>
                              </td>
                              <td className="py-3 text-slate-400">{durationDays}j</td>
                              <td className={`py-3 text-right font-semibold ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
                                {isProfit ? '+' : ''}{trade.pnlUsd.toFixed(0)} $
                                <span className="text-slate-600 ml-1 text-xs">
                                  ({isProfit ? '+' : ''}{(trade.pct * 100).toFixed(1)}%)
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-slate-500 text-sm py-4 text-center">
                    {backtest?.nbTrades === 0 ? 'Aucun trade sur cette période.' : 'Chargement...'}
                  </p>
                )}
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
