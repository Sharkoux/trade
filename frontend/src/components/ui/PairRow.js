import Link from 'next/link';
import SignalBadge from './SignalBadge';
import QualityStars from './QualityStars';
import ScoreBar from './ScoreBar';

export default function PairRow({ pair, showScore = false, onAddWatchlist, isInWatchlist }) {
  const z = pair.zScore || 0;
  const signal = z > 1.5 ? 'SHORT' : z < -1.5 ? 'LONG' : 'NEUTRE';
  const isActive = signal !== 'NEUTRE';

  // Calcul du gain potentiel
  const mean = pair.mean || 0;
  const std = pair.std || 0;
  const entryRatio = pair.lastRatio;
  let gainPct = 0;
  if (signal === 'SHORT' && entryRatio && mean) {
    const exitRatio = mean + 0.5 * std;
    gainPct = ((entryRatio - exitRatio) / entryRatio) * 100;
  } else if (signal === 'LONG' && entryRatio && mean) {
    const exitRatio = mean - 0.5 * std;
    gainPct = ((exitRatio - entryRatio) / entryRatio) * 100;
  }

  return (
    <tr className={`border-b border-[#1f1f23] hover:bg-[#151518] transition-colors ${isActive ? 'bg-[#12121a]' : ''}`}>
      {/* Score */}
      {showScore && (
        <td className="py-3 px-4 w-24">
          <ScoreBar score={pair.score || 0} />
        </td>
      )}

      {/* Paire */}
      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
          {isActive && <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />}
          <span className="font-medium text-white">{pair.coinA}/{pair.coinB}</span>
        </div>
      </td>

      {/* Qualite */}
      <td className="py-3 px-4">
        <QualityStars stars={pair.qualityStars || 0} />
      </td>

      {/* Z-Score */}
      <td className="py-3 px-4">
        <span className={`font-mono font-medium ${Math.abs(z) > 1.5 ? 'text-yellow-400' : 'text-gray-400'}`}>
          {z >= 0 ? '+' : ''}{z.toFixed(2)}
        </span>
      </td>

      {/* Signal */}
      <td className="py-3 px-4">
        <SignalBadge signal={signal} />
      </td>

      {/* Win Rate */}
      <td className="py-3 px-4 hidden md:table-cell">
        <span className={`${(pair.winRate || 0) >= 0.7 ? 'text-green-400' : (pair.winRate || 0) >= 0.5 ? 'text-gray-300' : 'text-red-400'}`}>
          {pair.winRate != null ? `${Math.round(pair.winRate * 100)}%` : '-'}
        </span>
      </td>

      {/* Avg Return */}
      <td className="py-3 px-4 hidden md:table-cell">
        <span className={`${(pair.avgReturn || 0) > 5 ? 'text-green-400' : (pair.avgReturn || 0) > 0 ? 'text-gray-300' : 'text-red-400'}`}>
          {pair.avgReturn != null ? `${pair.avgReturn > 0 ? '+' : ''}${pair.avgReturn.toFixed(1)}%` : '-'}
        </span>
      </td>

      {/* Gain potentiel */}
      <td className="py-3 px-4 hidden lg:table-cell">
        <span className={`font-medium ${gainPct > 0 ? 'text-green-400' : 'text-gray-500'}`}>
          {isActive && gainPct > 0 ? `+${gainPct.toFixed(1)}%` : '-'}
        </span>
      </td>

      {/* Actions */}
      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
          {onAddWatchlist && (
            <button
              onClick={() => onAddWatchlist(pair.pairId)}
              className={`p-1.5 rounded transition-colors ${isInWatchlist ? 'text-yellow-400 bg-yellow-500/10' : 'text-gray-500 hover:text-yellow-400 hover:bg-[#1f1f23]'}`}
              title={isInWatchlist ? 'Retirer de la watchlist' : 'Ajouter a la watchlist'}
            >
              <svg className="w-4 h-4" fill={isInWatchlist ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </button>
          )}
          <Link
            href={`/pairs/${pair.pairId}`}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              isActive
                ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/30'
                : 'bg-[#1f1f23] text-gray-400 hover:text-white hover:bg-[#2a2a32]'
            }`}
          >
            {isActive ? 'Trader' : 'Voir'}
          </Link>
        </div>
      </td>
    </tr>
  );
}
