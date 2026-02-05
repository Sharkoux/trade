/**
 * Module d'optimisation des z-thresholds par backtest
 *
 * Trouve les paramètres optimaux (z-entry, z-exit) pour chaque paire
 * en testant différentes combinaisons sur les données historiques.
 */

// Grille de recherche pour les paramètres
const Z_ENTRY_RANGE = [1.0, 1.2, 1.5, 1.8, 2.0, 2.2, 2.5];
const Z_EXIT_RANGE = [0.2, 0.3, 0.5, 0.7, 1.0];
const LOOKBACK_DAYS = 90;

/**
 * Calcule les statistiques d'un ratio de prix
 */
function computeRatioStats(seriesA, seriesB, lookbackDays = LOOKBACK_DAYS) {
  const n = Math.min(seriesA.length, seriesB.length);
  if (n < 20) return null;

  const ratios = [];
  for (let i = 0; i < n; i++) {
    const a = seriesA[i].c;
    const b = seriesB[i].c;
    if (a && b) {
      ratios.push({ ratio: a / b, t: seriesA[i].t });
    }
  }

  if (ratios.length < 20) return null;

  return ratios;
}

/**
 * Exécute un backtest avec des paramètres spécifiques
 */
function runBacktest(ratios, zEntry, zExit, lookbackDays = LOOKBACK_DAYS) {
  const trades = [];
  let currentTrade = null;
  let maxDrawdown = 0;
  let peak = 0;
  let equity = 100; // Equity simulée

  const lookbackPoints = Math.min(lookbackDays, ratios.length - 1);

  for (let i = lookbackPoints; i < ratios.length; i++) {
    const r = ratios[i].ratio;

    // Calculer z-score sur la fenêtre glissante
    const windowRatios = ratios.slice(i - lookbackPoints, i).map(x => x.ratio);
    const windowMean = windowRatios.reduce((s, v) => s + v, 0) / windowRatios.length;
    const windowVar = windowRatios.reduce((s, v) => s + (v - windowMean) ** 2, 0) / (windowRatios.length - 1);
    const windowStd = Math.sqrt(windowVar);
    const z = windowStd > 0 ? (r - windowMean) / windowStd : 0;

    // Logique de trading
    if (!currentTrade) {
      // Entrée
      if (z > zEntry) {
        currentTrade = { side: 'short', entryRatio: r, entryZ: z, entryIdx: i };
      } else if (z < -zEntry) {
        currentTrade = { side: 'long', entryRatio: r, entryZ: z, entryIdx: i };
      }
    } else {
      // Sortie
      if (Math.abs(z) < zExit) {
        const pct = currentTrade.side === 'short'
          ? (currentTrade.entryRatio - r) / currentTrade.entryRatio
          : (r - currentTrade.entryRatio) / currentTrade.entryRatio;

        const duration = i - currentTrade.entryIdx;
        trades.push({ pct, duration, side: currentTrade.side });

        // Mise à jour equity
        equity *= (1 + pct);
        if (equity > peak) peak = equity;
        const dd = (peak - equity) / peak;
        if (dd > maxDrawdown) maxDrawdown = dd;

        currentTrade = null;
      }
    }
  }

  // Métriques
  const nbTrades = trades.length;
  if (nbTrades < 3) {
    return { valid: false, reason: 'Not enough trades' };
  }

  const wins = trades.filter(t => t.pct > 0).length;
  const winRate = wins / nbTrades;
  const avgReturn = trades.reduce((s, t) => s + t.pct, 0) / nbTrades;
  const avgDuration = trades.reduce((s, t) => s + t.duration, 0) / nbTrades;

  // Calcul du Sharpe Ratio simplifié
  const returns = trades.map(t => t.pct);
  const meanReturn = avgReturn;
  const stdReturn = Math.sqrt(
    returns.reduce((s, r) => s + (r - meanReturn) ** 2, 0) / (returns.length - 1)
  );
  const sharpe = stdReturn > 0 ? (meanReturn / stdReturn) * Math.sqrt(252 / avgDuration) : 0;

  // Profit Factor
  const grossProfit = trades.filter(t => t.pct > 0).reduce((s, t) => s + t.pct, 0);
  const grossLoss = Math.abs(trades.filter(t => t.pct < 0).reduce((s, t) => s + t.pct, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0;

  // Score composite pour le ranking
  // Pondération: winRate (30%) + avgReturn (30%) + sharpe (20%) + profitFactor (10%) - drawdown penalty (10%)
  const score = (
    winRate * 30 +
    Math.min(avgReturn * 100, 30) * 1 +
    Math.min(sharpe, 3) * 6.67 +
    Math.min(profitFactor, 3) * 3.33 -
    maxDrawdown * 10
  );

  return {
    valid: true,
    zEntry,
    zExit,
    nbTrades,
    winRate,
    avgReturn: avgReturn * 100, // En pourcentage
    avgDuration,
    maxDrawdown: maxDrawdown * 100,
    sharpe,
    profitFactor,
    finalEquity: equity,
    score,
  };
}

/**
 * Optimise les paramètres pour une paire donnée
 */
function optimizePair(seriesA, seriesB, options = {}) {
  const {
    zEntryRange = Z_ENTRY_RANGE,
    zExitRange = Z_EXIT_RANGE,
    lookbackDays = LOOKBACK_DAYS,
    minTrades = 5,
    minWinRate = 0.5,
  } = options;

  const ratios = computeRatioStats(seriesA, seriesB, lookbackDays);
  if (!ratios || ratios.length < lookbackDays + 20) {
    return { success: false, error: 'Insufficient data' };
  }

  const results = [];

  // Grid search sur toutes les combinaisons
  for (const zEntry of zEntryRange) {
    for (const zExit of zExitRange) {
      // z-exit doit être inférieur à z-entry
      if (zExit >= zEntry) continue;

      const result = runBacktest(ratios, zEntry, zExit, lookbackDays);

      if (result.valid && result.nbTrades >= minTrades) {
        results.push(result);
      }
    }
  }

  if (results.length === 0) {
    return { success: false, error: 'No valid parameter combination found' };
  }

  // Trier par score décroissant
  results.sort((a, b) => b.score - a.score);

  // Filtrer les résultats avec un win rate minimum
  const filtered = results.filter(r => r.winRate >= minWinRate);
  const bestResults = filtered.length > 0 ? filtered : results;

  const best = bestResults[0];
  const top5 = bestResults.slice(0, 5);

  // Paramètres par défaut pour comparaison
  const defaultResult = runBacktest(ratios, 1.5, 0.5, lookbackDays);

  return {
    success: true,
    optimal: {
      zEntry: best.zEntry,
      zExit: best.zExit,
      winRate: best.winRate,
      avgReturn: best.avgReturn,
      nbTrades: best.nbTrades,
      maxDrawdown: best.maxDrawdown,
      sharpe: best.sharpe,
      profitFactor: best.profitFactor,
      score: best.score,
    },
    default: defaultResult.valid ? {
      zEntry: 1.5,
      zExit: 0.5,
      winRate: defaultResult.winRate,
      avgReturn: defaultResult.avgReturn,
      nbTrades: defaultResult.nbTrades,
      score: defaultResult.score,
    } : null,
    improvement: defaultResult.valid && defaultResult.score > 0
      ? ((best.score - defaultResult.score) / defaultResult.score * 100).toFixed(1)
      : null,
    alternatives: top5.slice(1).map(r => ({
      zEntry: r.zEntry,
      zExit: r.zExit,
      winRate: r.winRate,
      avgReturn: r.avgReturn,
      score: r.score,
    })),
    testedCombinations: results.length,
  };
}

/**
 * Structure pour stocker les paramètres optimisés
 */
function createOptimizedConfig(pairId, coinA, coinB, optimal, timestamp = Date.now()) {
  return {
    pairId,
    coinA,
    coinB,
    zEntry: optimal.zEntry,
    zExit: optimal.zExit,
    winRate: optimal.winRate,
    avgReturn: optimal.avgReturn,
    score: optimal.score,
    optimizedAt: timestamp,
    expiresAt: timestamp + 7 * 24 * 60 * 60 * 1000, // Expire après 7 jours
  };
}

/**
 * Vérifie si les paramètres optimisés sont encore valides
 */
function isOptimizationValid(config) {
  if (!config || !config.expiresAt) return false;
  return Date.now() < config.expiresAt;
}

module.exports = {
  optimizePair,
  runBacktest,
  computeRatioStats,
  createOptimizedConfig,
  isOptimizationValid,
  Z_ENTRY_RANGE,
  Z_EXIT_RANGE,
  LOOKBACK_DAYS,
};
