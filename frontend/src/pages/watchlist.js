import { useEffect, useState } from 'react';
import Link from 'next/link';
import SignalBadge from '@/components/ui/SignalBadge';
import QualityStars from '@/components/ui/QualityStars';
import useWatchlist from '@/hooks/useWatchlist';

export default function WatchlistPage() {
  const { watchlist, removeFromWatchlist, clearWatchlist, isLoaded } = useWatchlist();
  const [pairsData, setPairsData] = useState({});
  const [loading, setLoading] = useState(true);

  // Charger les donnees des paires de la watchlist
  useEffect(() => {
    if (!isLoaded || watchlist.length === 0) {
      setLoading(false);
      return;
    }

    const fetchPairsData = async () => {
      setLoading(true);
      try {
        // Scanner toutes les paires pour avoir les donnees
        const res = await fetch('/api/spread/scan?universe=all');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        // Creer un map des donnees par pairId
        const dataMap = {};
        (data.pairs || []).forEach(pair => {
          dataMap[pair.pairId] = pair;
        });
        setPairsData(dataMap);
      } catch (e) {
        console.error('Erreur chargement watchlist:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchPairsData();
  }, [isLoaded, watchlist.length]);

  const watchlistPairs = watchlist.map(pairId => ({
    pairId,
    ...pairsData[pairId],
  }));

  const activeCount = watchlistPairs.filter(p => {
    const z = Math.abs(p.zScore || 0);
    return z > 1.5;
  }).length;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Ma Watchlist</h1>
            <p className="text-gray-400 mt-1">
              {watchlist.length} paire{watchlist.length > 1 ? 's' : ''} suivie{watchlist.length > 1 ? 's' : ''}
              {activeCount > 0 && (
                <span className="ml-2 text-yellow-400">
                  ({activeCount} signal{activeCount > 1 ? 'aux' : ''} actif{activeCount > 1 ? 's' : ''})
                </span>
              )}
            </p>
          </div>
          {watchlist.length > 0 && (
            <button
              onClick={() => {
                if (confirm('Vider toute la watchlist ?')) {
                  clearWatchlist();
                }
              }}
              className="btn btn-secondary text-red-400 hover:text-red-300"
            >
              Vider la liste
            </button>
          )}
        </div>
      </div>

      {/* Contenu */}
      {!isLoaded || loading ? (
        <div className="card p-8">
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 skeleton" />
            ))}
          </div>
        </div>
      ) : watchlist.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#1f1f23] flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Votre watchlist est vide</h3>
          <p className="text-gray-500 mb-6">
            Ajoutez des paires depuis le scanner pour les suivre facilement.
          </p>
          <Link href="/scanner" className="btn btn-primary">
            Aller au Scanner
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {watchlistPairs.map(pair => {
            const z = pair.zScore || 0;
            const signal = z > 1.5 ? 'SHORT' : z < -1.5 ? 'LONG' : 'NEUTRE';
            const isActive = signal !== 'NEUTRE';
            const hasData = pair.coinA && pair.coinB;
            const [coinA, coinB] = pair.pairId.toUpperCase().split('-');

            return (
              <div
                key={pair.pairId}
                className={`card p-4 transition-colors ${isActive ? 'border-yellow-500/30 bg-yellow-500/5' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {/* Indicateur signal */}
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      isActive
                        ? signal === 'SHORT' ? 'bg-red-500/20' : 'bg-green-500/20'
                        : 'bg-[#1f1f23]'
                    }`}>
                      {isActive ? (
                        <span className={`text-lg font-bold ${signal === 'SHORT' ? 'text-red-400' : 'text-green-400'}`}>
                          {signal === 'SHORT' ? '↓' : '↑'}
                        </span>
                      ) : (
                        <span className="text-gray-600">-</span>
                      )}
                    </div>

                    {/* Info paire */}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white text-lg">
                          {coinA}/{coinB}
                        </span>
                        {isActive && (
                          <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                        )}
                      </div>
                      {hasData ? (
                        <div className="flex items-center gap-3 mt-1">
                          <QualityStars stars={pair.qualityStars || 0} size="sm" />
                          <span className="text-xs text-gray-500">
                            z = <span className={Math.abs(z) > 1.5 ? 'text-yellow-400' : 'text-gray-400'}>
                              {z >= 0 ? '+' : ''}{z.toFixed(2)}
                            </span>
                          </span>
                          {pair.winRate && (
                            <span className="text-xs text-gray-500">
                              Win: <span className={pair.winRate >= 0.7 ? 'text-green-400' : 'text-gray-400'}>
                                {Math.round(pair.winRate * 100)}%
                              </span>
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-600">Chargement...</span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3">
                    {isActive && <SignalBadge signal={signal} />}

                    <Link
                      href={`/pairs/${pair.pairId}`}
                      className={`btn ${isActive ? 'btn-primary' : 'btn-secondary'}`}
                    >
                      {isActive ? 'Trader' : 'Voir'}
                    </Link>

                    <button
                      onClick={() => removeFromWatchlist(pair.pairId)}
                      className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Retirer de la watchlist"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Info */}
      {watchlist.length > 0 && (
        <div className="mt-6 card p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-blue-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-sm text-gray-400">
              <p>
                Les paires avec un signal actif (|z| &gt; 1.5) sont mises en evidence.
                Les donnees sont mises a jour automatiquement lors du chargement de la page.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
