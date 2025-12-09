// pages/index.js
import { useEffect, useState } from 'react';
import Link from 'next/link';
import GlossarySpread from '../components/GlossarySpread';


export default function DashboardPage() {
  const [universe, setUniverse] = useState('l2');
  const [pairs, setPairs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sortBy, setSortBy] = useState('signal'); // signal, risk, gain, corr, quality
  const [showOnlyGood, setShowOnlyGood] = useState(false); // Filtre qualité >= 3 étoiles

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/spread/scan?universe=${universe}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erreur API scan');
        setPairs(data.pairs || []);
      } catch (e) {
        console.error(e);
        setError('Impossible de charger les paires de spread');
        setPairs([]);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [universe]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <header className="space-y-1 mb-6">
          <h1 className="text-2xl md:text-3xl font-bold">Spread Trading Dashboard</h1>
          <p className="text-slate-400 text-sm">
            Scanner de paires corrélées (Hyperliquid) pour stratégie de spread / mean reversion.
          </p>
        </header>

        {/* Layout 3 colonnes */}
        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr_220px] gap-4">

          {/* ===== PANNEAU GAUCHE - C'est quoi le spread ? ===== */}
          <aside className="hidden lg:block space-y-4">
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
              <h3 className="text-sm font-semibold mb-2 text-sky-400">C'est quoi le spread ?</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Le <strong>spread trading</strong> consiste à parier sur l'écart de prix entre deux actifs similaires.
                Au lieu de deviner si un token va monter ou baisser, on parie que l'écart entre deux tokens va revenir à la normale.
              </p>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
              <h3 className="text-sm font-semibold mb-2 text-sky-400">Exemple simple</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Si OP et ARB bougent souvent ensemble mais que OP monte soudainement beaucoup plus que ARB,
                on peut parier que cet écart va se réduire : on <strong>vend</strong> OP et on <strong>achète</strong> ARB.
              </p>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
              <h3 className="text-sm font-semibold mb-2 text-sky-400">Pourquoi c'est utile ?</h3>
              <ul className="text-xs text-slate-300 space-y-1">
                <li>• Moins risqué que parier sur une direction</li>
                <li>• Fonctionne même si le marché est incertain</li>
                <li>• Basé sur des données historiques</li>
              </ul>
            </div>
          </aside>

          {/* ===== COLONNE CENTRALE - Contenu principal ===== */}
          <div className="flex flex-col gap-4">
            {/* Sélecteur d'univers */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-slate-400 mr-1">Univers :</span>
                {[
                  { id: 'l2', label: 'L2', desc: 'Layer 2' },
                  { id: 'dex', label: 'DEX', desc: 'Exchanges' },
                  { id: 'bluechips', label: 'Majeurs', desc: 'BTC, ETH...' },
                  { id: 'defi', label: 'DeFi', desc: 'Lending' },
                  { id: 'gaming', label: 'Gaming', desc: 'Metaverse' },
                  { id: 'ai', label: 'AI', desc: 'Data & AI' },
                  { id: 'meme', label: 'Meme', desc: 'Haute vol.' },
                  { id: 'all', label: 'Tout', desc: 'Scan complet' },
                ].map((u) => (
                  <button
                    key={u.id}
                    onClick={() => setUniverse(u.id)}
                    title={u.desc}
                    className={
                      universe === u.id
                        ? 'px-2 py-1 rounded-md bg-sky-500 text-slate-900 font-semibold'
                        : 'px-2 py-1 rounded-md bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700'
                    }
                  >
                    {u.label}
                  </button>
                ))}
                {loading && <span className="text-slate-400 ml-2">Scan en cours…</span>}
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-3 text-xs">
                <button
                  onClick={() => setShowOnlyGood(false)}
                  className={
                    !showOnlyGood
                      ? 'px-3 py-1.5 rounded-lg bg-slate-700 text-slate-100 font-medium'
                      : 'px-3 py-1.5 rounded-lg bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }
                >
                  Tous les signaux
                </button>
                <button
                  onClick={() => setShowOnlyGood(true)}
                  className={
                    showOnlyGood
                      ? 'px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 font-medium border border-emerald-500/30'
                      : 'px-3 py-1.5 rounded-lg bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }
                >
                  TOP seulement
                </button>
              </div>
              {error && <span className="text-xs text-red-400 mt-2 block">{error}</span>}
            </div>

            {/* Tableau des paires proposées par /api/spread/scan */}
            <section className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 md:p-5">
              <h2 className="text-lg font-semibold mb-3">Paires de spread suggérées</h2>

              {pairs.length === 0 && !loading && !error && (
                <p className="text-xs text-slate-500">
                  Aucune paire disponible pour cet univers (ou erreur côté API).
                </p>
              )}

              {pairs.length > 0 && (
                <div className="overflow-x-auto text-xs md:text-sm">
                  {/* Tri selon le critère sélectionné */}
                  {(() => {
                    // Calcul du gain pour le tri
                    const pairsWithGain = pairs.map(p => {
                      const z = p.zScore || 0;
                      const signal = z > 1.5 ? 'SHORT' : z < -1.5 ? 'LONG' : 'NEUTRE';
                      const mean = p.mean || 0;
                      const std = p.std || 0;
                      const entryRatio = p.lastRatio;
                      let exitRatio = mean;
                      if (signal === 'SHORT') exitRatio = mean + 0.5 * std;
                      else if (signal === 'LONG') exitRatio = mean - 0.5 * std;
                      let gainPct = 0;
                      if (signal === 'SHORT' && entryRatio && exitRatio) {
                        gainPct = ((entryRatio - exitRatio) / entryRatio) * 100;
                      } else if (signal === 'LONG' && entryRatio && exitRatio) {
                        gainPct = ((exitRatio - entryRatio) / entryRatio) * 100;
                      }
                      return { ...p, gainPct, signal };
                    });

                    // Filtrer si "Bons trades" est activé (>= 3 étoiles sur 5)
                    const filteredPairs = showOnlyGood
                      ? pairsWithGain.filter(p => (p.qualityStars || 0) >= 3)
                      : pairsWithGain;

                    const sortedPairs = [...filteredPairs].sort((a, b) => {
                      const zA = Math.abs(a.zScore || 0);
                      const zB = Math.abs(b.zScore || 0);
                      const hasSignalA = zA > 1.5;
                      const hasSignalB = zB > 1.5;

                      switch (sortBy) {
                        case 'quality':
                          // Qualité décroissante, puis signaux actifs
                          if ((b.qualityStars || 0) !== (a.qualityStars || 0)) {
                            return (b.qualityStars || 0) - (a.qualityStars || 0);
                          }
                          if (hasSignalA && !hasSignalB) return -1;
                          if (!hasSignalA && hasSignalB) return 1;
                          return zB - zA;
                        case 'risk':
                          // Risque croissant (moins risqué en premier)
                          return (a.riskScore || 10) - (b.riskScore || 10);
                        case 'gain':
                          // Gain décroissant (signaux actifs seulement)
                          if (hasSignalA && !hasSignalB) return -1;
                          if (!hasSignalA && hasSignalB) return 1;
                          return (b.gainPct || 0) - (a.gainPct || 0);
                        case 'corr':
                          // Corrélation décroissante
                          return (b.corr || 0) - (a.corr || 0);
                        case 'signal':
                        default:
                          // Signaux actifs en premier, puis par |z| décroissant
                          if (hasSignalA && !hasSignalB) return -1;
                          if (!hasSignalA && hasSignalB) return 1;
                          return zB - zA;
                      }
                    });

                    const activeCount = sortedPairs.filter(p => Math.abs(p.zScore || 0) > 1.5).length;

                    return (
                      <>
                        {activeCount > 0 && (
                          <div className="mb-3 px-3 py-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                            <span className="text-amber-400 font-semibold">{activeCount} sign{activeCount > 1 ? 'aux' : 'al'} actif{activeCount > 1 ? 's' : ''}</span>
                            <span className="text-slate-400 ml-2 text-xs">— Opportunités de trade détectées</span>
                          </div>
                        )}
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="text-slate-400 border-b border-slate-800 text-[10px] md:text-xs">
                              <th className="text-left py-2 pr-2 whitespace-nowrap">Paire</th>
                              <th className="text-left py-2 pr-2 whitespace-nowrap w-20">Qualité</th>
                              <th className="text-left py-2 pr-2 whitespace-nowrap w-10">Z</th>
                              <th className="text-left py-2 pr-2 whitespace-nowrap w-14">Signal</th>
                              <th className="text-left py-2 pr-2 whitespace-nowrap w-14 hidden sm:table-cell" title="Taux de réussite historique">Win%</th>
                              <th className="text-left py-2 pr-2 whitespace-nowrap w-14 hidden sm:table-cell" title="Gain moyen par trade">Avg</th>
                              <th className="text-left py-2 pr-2 whitespace-nowrap w-14 hidden md:table-cell" title="Drawdown maximum historique">DD</th>
                              <th className="text-left py-2 pr-2 whitespace-nowrap w-14 hidden sm:table-cell">Gain</th>
                              <th className="text-left py-2 w-14"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {sortedPairs.map((p) => {
                              const z = p.zScore || 0;
                              const signal = p.signal;
                              const signalColor = signal === 'SHORT' ? 'text-red-400' : signal === 'LONG' ? 'text-emerald-400' : 'text-slate-500';
                              const zColor = Math.abs(z) > 1.5 ? 'text-amber-400' : 'text-slate-300';
                              const isActive = signal !== 'NEUTRE';
                              const rowBg = isActive ? 'bg-slate-800/50' : '';

                              // Position à prendre
                              let position = '—';
                              if (signal === 'SHORT') {
                                position = `Short ${p.coinA} / Long ${p.coinB}`;
                              } else if (signal === 'LONG') {
                                position = `Long ${p.coinA} / Short ${p.coinB}`;
                              }

                              // Couleur du risque
                              const riskColor = (p.riskScore || 5) <= 4 ? 'text-emerald-400' : (p.riskScore || 5) <= 6 ? 'text-amber-400' : 'text-red-400';

                              // Étoiles de qualité (0-5)
                              const stars = p.qualityStars || 0;
                              const starsColor = stars >= 4 ? 'text-emerald-400' : stars >= 2 ? 'text-slate-300' : 'text-slate-600';

                              // Alertes pour trades dangereux
                              const isDangerous = (p.avgReturn || 0) < 0 || (p.maxDrawdown || 0) > 40;

                              return (
                                <tr key={p.pairId} className={`border-b border-slate-900/60 hover:bg-slate-800/50 ${rowBg} ${isDangerous ? 'opacity-50' : ''} text-[10px] md:text-xs`}>
                                  <td className="py-2 pr-2 font-medium whitespace-nowrap">
                                    {isActive && <span className="inline-block w-2 h-2 rounded-full bg-amber-400 mr-1"></span>}
                                    {p.coinA}/{p.coinB}
                                  </td>
                                  <td className={`py-2 pr-2 whitespace-nowrap ${starsColor}`} title={`${stars}/5 étoiles`}>
                                    {stars >= 4 && <span className="inline-block px-1 py-0.5 mr-1 text-[8px] font-bold bg-emerald-500 text-white rounded">TOP</span>}
                                    {isDangerous && stars < 4 && <span className="inline-block px-1 py-0.5 mr-1 text-[8px] font-bold bg-red-500 text-white rounded">!</span>}
                                    {'★'.repeat(stars)}{'☆'.repeat(5 - stars)}
                                  </td>
                                  <td className={`py-2 pr-2 font-medium whitespace-nowrap ${zColor}`}>
                                    {z.toFixed(2)}
                                  </td>
                                  <td className={`py-2 pr-2 font-semibold whitespace-nowrap ${signalColor}`}>
                                    {signal}
                                  </td>
                                  <td className={`py-2 pr-2 whitespace-nowrap hidden sm:table-cell ${(p.winRate || 0) >= 0.7 ? 'text-emerald-400' : (p.winRate || 0) >= 0.5 ? 'text-slate-300' : 'text-red-400'}`}>
                                    {p.winRate != null ? `${Math.round(p.winRate * 100)}%` : '—'}
                                  </td>
                                  <td className={`py-2 pr-2 whitespace-nowrap hidden sm:table-cell ${(p.avgReturn || 0) > 5 ? 'text-emerald-400' : (p.avgReturn || 0) > 0 ? 'text-slate-300' : 'text-red-400'}`}>
                                    {p.avgReturn != null ? `${p.avgReturn > 0 ? '+' : ''}${p.avgReturn.toFixed(1)}%` : '—'}
                                  </td>
                                  <td className={`py-2 pr-2 whitespace-nowrap hidden md:table-cell ${(p.maxDrawdown || 0) <= 25 ? 'text-emerald-400' : (p.maxDrawdown || 0) <= 40 ? 'text-amber-400' : 'text-red-400'}`}>
                                    {p.maxDrawdown != null ? `-${Math.round(p.maxDrawdown)}%` : '—'}
                                  </td>
                                  <td className={`py-2 pr-2 font-semibold whitespace-nowrap hidden sm:table-cell ${p.gainPct > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
                                    {isActive && p.gainPct ? `+${p.gainPct.toFixed(0)}%` : '—'}
                                  </td>
                                  <td className="py-2 whitespace-nowrap">
                                    <Link
                                      href={`/pairs/${p.pairId}`}
                                      className={`inline-flex items-center text-[10px] px-2 py-1 rounded-md border ${isActive ? 'border-amber-500/50 bg-amber-500/10 text-amber-300' : 'border-slate-700'} hover:bg-slate-800`}
                                    >
                                      {isActive ? 'Trader' : 'Voir'}
                                    </Link>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </>
                    );
                  })()}
                </div>
              )}
              <p className="text-[10px] text-slate-600 mt-3">
                * Gains affichés sans levier (1x). Cliquez sur une paire pour voir le gain avec levier recommandé.
              </p>
            </section>
          </div>

          {/* ===== PANNEAU DROIT - Comprendre les chiffres ===== */}
          <aside className="hidden lg:block space-y-4">
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
              <h3 className="text-sm font-semibold mb-2 text-emerald-400">Comprendre le tableau</h3>
              <ul className="text-xs text-slate-300 space-y-2">
                <li>
                  <strong className="text-slate-100">Win%</strong><br/>
                  Taux de réussite historique. <span className="text-emerald-400">{'>'} 70%</span> = excellent.
                </li>
                <li>
                  <strong className="text-slate-100">Avg</strong><br/>
                  Rendement moyen par trade. <span className="text-emerald-400">{'>'} 5%</span> = bon.
                </li>
                <li>
                  <strong className="text-slate-100">DD (Drawdown)</strong><br/>
                  Pire perte temporaire. <span className="text-emerald-400">{'<'} 25%</span> = faible risque.
                </li>
              </ul>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
              <h3 className="text-sm font-semibold mb-2 text-emerald-400">Les univers</h3>
              <ul className="text-xs text-slate-300 space-y-2">
                <li><strong className="text-slate-100">L2</strong> — OP, ARB, STRK, ZK, MATIC...</li>
                <li><strong className="text-slate-100">DEX</strong> — UNI, GMX, DYDX, CRV, JUP...</li>
                <li><strong className="text-slate-100">Majeurs</strong> — BTC, ETH, SOL, AVAX...</li>
                <li><strong className="text-slate-100">DeFi</strong> — AAVE, MKR, LDO, SNX...</li>
                <li><strong className="text-slate-100">Gaming</strong> — IMX, GALA, AXS, SAND...</li>
                <li><strong className="text-slate-100">AI</strong> — FET, RNDR, TAO, AR, GRT...</li>
                <li><strong className="text-slate-100">Meme</strong> — DOGE, PEPE, WIF... (risqué)</li>
              </ul>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
              <h3 className="text-sm font-semibold mb-2 text-emerald-400">Système de qualité ★</h3>
              <p className="text-xs text-slate-300 leading-relaxed mb-2">
                Score basé sur <strong>sûreté + rentabilité</strong> :
              </p>
              <ul className="text-xs text-slate-300 space-y-1">
                <li><span className="text-emerald-400">★★</span> Rendement moyen {'>'} 5%</li>
                <li><span className="text-emerald-400">★★</span> Winrate {'>'} 70%</li>
                <li><span className="text-emerald-400">★</span> Drawdown {'<'} 30%</li>
              </ul>
              <p className="text-xs text-red-400 mt-2 mb-1">
                Pénalités strictes :
              </p>
              <ul className="text-xs text-slate-400 space-y-1">
                <li><span className="text-red-400">!</span> Avg négatif → max 1★</li>
                <li><span className="text-red-400">!</span> DD {'>'} 50% → max 1★</li>
              </ul>
              <p className="text-xs text-slate-400 mt-2">
                <span className="inline-block px-1 py-0.5 mr-1 text-[8px] font-bold bg-emerald-500 text-white rounded">TOP</span> = Trade recommandé (4+ étoiles)
              </p>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
              <h3 className="text-sm font-semibold mb-2 text-emerald-400">Conseil</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Utilisez le filtre <strong>"★ Bons trades"</strong> pour n'afficher que les meilleures opportunités.
                Évitez les memecoins pour débuter.
              </p>
            </div>
          </aside>

        </div>
      </div>
    </div>
  );
}
