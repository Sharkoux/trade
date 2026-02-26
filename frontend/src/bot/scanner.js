/**
 * Module de scan des opportunités de spread trading
 */

const { UNIVERSES, TRADING_LIMITS } = require('./config');
const { fetchCandles } = require('./api');

/**
 * Génère toutes les paires possibles à partir d'une liste de coins
 */
function generatePairs(coins) {
  const pairs = [];
  for (let i = 0; i < coins.length; i++) {
    for (let j = i + 1; j < coins.length; j++) {
      pairs.push({ a: coins[i], b: coins[j] });
    }
  }
  return pairs;
}

/**
 * Calcule les statistiques d'un ratio de paire
 */
function computeStatsRatio(seriesA, seriesB, lookbackDays = TRADING_LIMITS.LOOKBACK_DAYS) {
  const n = Math.min(seriesA.length, seriesB.length);
  if (n < TRADING_LIMITS.MIN_DATA_POINTS) return null;

  const ratios = [];
  const retsA = [];
  const retsB = [];

  for (let i = 1; i < n; i++) {
    const a0 = seriesA[i - 1].c;
    const a1 = seriesA[i].c;
    const b0 = seriesB[i - 1].c;
    const b1 = seriesB[i].c;
    if (!a1 || !b1) continue;

    ratios.push({ ratio: a1 / b1, t: seriesA[i].t });
    retsA.push(Math.log(a1 / a0));
    retsB.push(Math.log(b1 / b0));
  }

  if (ratios.length < TRADING_LIMITS.MIN_DATA_POINTS) return null;

  const lookbackPoints = Math.min(lookbackDays, ratios.length);
  const recentRatios = ratios.slice(-lookbackPoints).map(r => r.ratio);
  const mean = recentRatios.reduce((s, v) => s + v, 0) / recentRatios.length;
  const variance = recentRatios.reduce((s, v) => s + (v - mean) ** 2, 0) / (recentRatios.length - 1);
  const std = Math.sqrt(variance);

  // Corrélation
  const mA = retsA.reduce((s, v) => s + v, 0) / retsA.length;
  const mB = retsB.reduce((s, v) => s + v, 0) / retsB.length;
  let cov = 0, varA = 0, varB = 0;
  for (let i = 0; i < retsA.length; i++) {
    const da = retsA[i] - mA;
    const db = retsB[i] - mB;
    cov += da * db;
    varA += da * da;
    varB += db * db;
  }
  cov /= retsA.length;
  varA /= retsA.length;
  varB /= retsA.length;
  const corr = cov / (Math.sqrt(varA) * Math.sqrt(varB) || 1);

  // Backtest simplifié
  const zEnter = 1.5;
  const zExit = 0.5;
  const trades = [];
  let currentTrade = null;
  let maxDrawdown = 0;
  let peak = ratios[0].ratio;

  for (let i = lookbackPoints; i < ratios.length; i++) {
    const r = ratios[i].ratio;
    if (r > peak) peak = r;
    const dd = (peak - r) / peak;
    if (dd > maxDrawdown) maxDrawdown = dd;

    const windowRatios = ratios.slice(i - lookbackPoints, i).map(x => x.ratio);
    const windowMean = windowRatios.reduce((s, v) => s + v, 0) / windowRatios.length;
    const windowVar = windowRatios.reduce((s, v) => s + (v - windowMean) ** 2, 0) / (windowRatios.length - 1);
    const windowStd = Math.sqrt(windowVar);
    const z = windowStd > 0 ? (r - windowMean) / windowStd : 0;

    if (!currentTrade) {
      if (z > zEnter) currentTrade = { side: 'short', entryRatio: r, entryZ: z };
      else if (z < -zEnter) currentTrade = { side: 'long', entryRatio: r, entryZ: z };
    } else if (Math.abs(z) < zExit) {
      const pct = currentTrade.side === 'short'
        ? (currentTrade.entryRatio - r) / currentTrade.entryRatio
        : (r - currentTrade.entryRatio) / currentTrade.entryRatio;
      trades.push({ pct });
      currentTrade = null;
    }
  }

  const nbTrades = trades.length;
  const wins = trades.filter(t => t.pct > 0).length;
  const winRate = nbTrades > 0 ? wins / nbTrades : 0;
  const avgReturn = nbTrades > 0 ? trades.reduce((s, t) => s + t.pct, 0) / nbTrades : 0;

  const lastRatio = ratios[ratios.length - 1].ratio;
  const zScore = std > 0 ? (lastRatio - mean) / std : 0;

  // Score de qualité
  const qualityStars = computeQualityStars(avgReturn, winRate, maxDrawdown, zScore, nbTrades);

  return {
    mean, std, corr, lastRatio, zScore,
    maxDrawdown: maxDrawdown * 100,
    nbTrades, winRate, avgReturn: avgReturn * 100,
    qualityStars,
  };
}

/**
 * Calcule le nombre d'étoiles de qualité
 */
function computeQualityStars(avgReturn, winRate, maxDrawdown, zScore, nbTrades) {
  let qualityStars = 0;
  let maxStars = 5;

  if (avgReturn < 0) maxStars = 1;
  else if (maxDrawdown > 0.5) maxStars = 1;
  else if (maxDrawdown > 0.4) maxStars = 2;
  else if (winRate < 0.5) maxStars = 2;
  else if (nbTrades < 3) maxStars = 2;

  if (avgReturn >= 0.08) qualityStars += 2;
  else if (avgReturn >= 0.05) qualityStars += 1.5;
  else if (avgReturn >= 0.02) qualityStars += 1;
  else if (avgReturn > 0) qualityStars += 0.5;

  if (winRate >= 0.8) qualityStars += 1.5;
  else if (winRate >= 0.7) qualityStars += 1;
  else if (winRate >= 0.6) qualityStars += 0.5;

  if (maxDrawdown <= 0.2) qualityStars += 1;
  else if (maxDrawdown <= 0.3) qualityStars += 0.5;

  const absZ = Math.abs(zScore);
  if (absZ >= 1.5 && absZ <= 2.5) qualityStars += 0.5;

  return Math.min(maxStars, Math.round(qualityStars));
}

/**
 * Scanner les opportunités de trading
 */
async function scanOpportunities(config, optimizedParamsMap = {}) {
  const opportunities = [];
  const uniqueCoins = new Set();

  // Collecter les coins des univers actifs
  for (const universe of config.activeUniverses) {
    const coins = UNIVERSES[universe] || [];
    coins.forEach(c => uniqueCoins.add(c));
  }

  const coinsArray = [...uniqueCoins];
  const now = Date.now();
  const startTime = now - 365 * 24 * 60 * 60 * 1000;

  // Récupérer les candles en parallèle
  const candlesMap = {};
  await Promise.all(
    coinsArray.map(async (coin) => {
      try {
        const candles = await fetchCandles(coin, '1d', startTime, now);
        candlesMap[coin] = candles.map(c => ({ t: c.t, c: parseFloat(c.c) }));
      } catch (e) {
        candlesMap[coin] = null;
      }
    })
  );

  // Générer et analyser les paires
  const pairs = generatePairs(coinsArray);

  for (const pair of pairs) {
    const seriesA = candlesMap[pair.a];
    const seriesB = candlesMap[pair.b];
    if (!seriesA || !seriesB) continue;

    const stats = computeStatsRatio(seriesA, seriesB);
    if (!stats) continue;

    // Filtrer selon config
    if (stats.qualityStars < config.minQualityStars) continue;
    if (stats.winRate < config.minWinRate) continue;

    const pairId = `${pair.a}-${pair.b}`.toLowerCase();
    const absZ = Math.abs(stats.zScore);

    // Utiliser les paramètres optimisés si disponibles
    const optimized = optimizedParamsMap[pairId];
    const zEntryThreshold = optimized?.zEntry || config.zEntryThreshold;
    const zExitThreshold = optimized?.zExit || config.zExitThreshold;

    if (absZ < zEntryThreshold) continue;

    const signal = stats.zScore > 0 ? 'SHORT' : 'LONG';
    const optimizedBonus = optimized ? 10 : 0;

    opportunities.push({
      pairId,
      coinA: pair.a,
      coinB: pair.b,
      signal,
      zScore: stats.zScore,
      zEntryThreshold,
      zExitThreshold,
      isOptimized: !!optimized,
      qualityStars: stats.qualityStars,
      winRate: stats.winRate,
      avgReturn: stats.avgReturn,
      correlation: stats.corr,
      score: stats.qualityStars * 20 + absZ * 10 + stats.winRate * 15 + optimizedBonus,
    });
  }

  // Trier par score décroissant
  opportunities.sort((a, b) => b.score - a.score);
  return opportunities;
}

module.exports = {
  generatePairs,
  computeStatsRatio,
  computeQualityStars,
  scanOpportunities,
  UNIVERSES,
};
