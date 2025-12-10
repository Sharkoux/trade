/**
 * Algorithme de scoring intelligent pour les paires de spread trading
 * Score sur 100 points basé sur:
 * - Qualité (étoiles)
 * - Signal actif
 * - Win rate historique
 * - Rendement moyen
 * - Drawdown (pénalité)
 * - Score de risque (pénalité)
 */

export function calculateScore(pair) {
  let score = 0;

  // Qualité (0-100 pts) - 20 pts par étoile
  const qualityStars = pair.qualityStars || 0;
  score += qualityStars * 20;

  // Bonus signal actif (+20 pts)
  const z = Math.abs(pair.zScore || 0);
  const hasActiveSignal = z > 1.5;
  if (hasActiveSignal) {
    score += 20;
    // Bonus supplémentaire pour z-score optimal (1.5-2.5)
    if (z >= 1.5 && z <= 2.5) {
      score += 10;
    }
  }

  // Win rate (0-15 pts)
  const winRate = pair.winRate || 0;
  score += winRate * 15;

  // Rendement moyen (variable)
  const avgReturn = pair.avgReturn || 0;
  if (avgReturn > 0) {
    score += Math.min(avgReturn * 2, 20); // Max 20 pts
  } else {
    score -= Math.abs(avgReturn) * 3; // Pénalité pour rendement négatif
  }

  // Pénalité drawdown
  const maxDrawdown = pair.maxDrawdown || 0;
  if (maxDrawdown > 50) {
    score -= 30;
  } else if (maxDrawdown > 40) {
    score -= 20;
  } else if (maxDrawdown > 30) {
    score -= 10;
  }

  // Pénalité risque
  const riskScore = pair.riskScore || 5;
  score -= riskScore * 2;

  // Bonus corrélation élevée
  const correlation = pair.corr || 0;
  if (correlation >= 0.8) {
    score += 10;
  } else if (correlation >= 0.7) {
    score += 5;
  } else if (correlation < 0.5) {
    score -= 15; // Pénalité forte pour faible corrélation
  }

  // Normaliser entre 0 et 100
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Trie les paires par score intelligent décroissant
 */
export function sortByScore(pairs) {
  return [...pairs]
    .map(pair => ({
      ...pair,
      score: calculateScore(pair)
    }))
    .sort((a, b) => b.score - a.score);
}

/**
 * Filtre les paires selon des critères
 */
export function filterPairs(pairs, filters = {}) {
  return pairs.filter(pair => {
    // Filtre par qualité minimum
    if (filters.minQuality && (pair.qualityStars || 0) < filters.minQuality) {
      return false;
    }

    // Filtre signaux actifs uniquement
    if (filters.activeOnly) {
      const z = Math.abs(pair.zScore || 0);
      if (z <= 1.5) return false;
    }

    // Filtre par univers
    if (filters.universe && filters.universe !== 'all') {
      // Note: nécessite que l'API retourne l'univers de la paire
      if (pair.universe && pair.universe !== filters.universe) {
        return false;
      }
    }

    // Filtre par score minimum
    if (filters.minScore) {
      const score = calculateScore(pair);
      if (score < filters.minScore) return false;
    }

    return true;
  });
}

/**
 * Obtient le top N des meilleures paires
 */
export function getTopPairs(pairs, n = 5) {
  return sortByScore(pairs).slice(0, n);
}

/**
 * Calcule les statistiques globales du portefeuille
 */
export function calculateGlobalStats(pairs) {
  const activePairs = pairs.filter(p => Math.abs(p.zScore || 0) > 1.5);
  const topPairs = sortByScore(pairs).slice(0, 10);

  const avgWinRate = topPairs.length > 0
    ? topPairs.reduce((sum, p) => sum + (p.winRate || 0), 0) / topPairs.length
    : 0;

  const avgReturn = topPairs.length > 0
    ? topPairs.reduce((sum, p) => sum + (p.avgReturn || 0), 0) / topPairs.length
    : 0;

  const bestPair = topPairs[0] || null;

  return {
    activeSignals: activePairs.length,
    avgWinRate: Math.round(avgWinRate * 100),
    avgReturn: avgReturn.toFixed(1),
    bestPair: bestPair ? `${bestPair.coinA}/${bestPair.coinB}` : '-',
    topScore: bestPair?.score || 0,
  };
}
