// pages/api/spread/scan.js
import { fetchCandles } from './_utilsHyperliquid'; // on factorise l'appel candleSnapshot

const UNIVERSES = {
  // Layer 2 / Scaling
  l2: ['OP', 'ARB', 'MNT', 'STRK', 'ZK', 'MATIC', 'IMX', 'METIS', 'MANTA', 'BLAST'],

  // DEX / DeFi Trading
  dex: ['UNI', 'SUSHI', 'GMX', 'APEX', 'DYDX', 'CRV', 'BAL', 'VELO', 'JUP', 'RAY'],

  // Blue chips majeurs
  bluechips: ['BTC', 'ETH', 'SOL', 'AVAX', 'BNB', 'LINK', 'DOT', 'ATOM'],

  // DeFi / Lending
  defi: ['AAVE', 'COMP', 'MKR', 'SNX', 'LDO', 'RPL', 'FXS', 'PENDLE'],

  // Gaming / Metaverse
  gaming: ['IMX', 'GALA', 'AXS', 'SAND', 'MANA', 'ILV', 'PRIME', 'PIXEL'],

  // AI / Data
  ai: ['FET', 'RNDR', 'AGIX', 'TAO', 'AR', 'FIL', 'GRT', 'OCEAN'],

  // Memecoins (haute volatilité)
  meme: ['DOGE', 'SHIB', 'PEPE', 'WIF', 'BONK', 'FLOKI', 'MEME'],

  // Toutes les paires (scan complet - peut être lent)
  all: ['BTC', 'ETH', 'SOL', 'AVAX', 'OP', 'ARB', 'MATIC', 'LINK', 'UNI', 'AAVE', 'LDO', 'MKR', 'SNX', 'CRV', 'GMX', 'DYDX', 'IMX', 'STRK', 'ZK', 'FET', 'RNDR', 'AR', 'GRT'],
};

function generatePairs(coins) {
  const pairs = [];
  for (let i = 0; i < coins.length; i++) {
    for (let j = i + 1; j < coins.length; j++) {
      pairs.push({ a: coins[i], b: coins[j] });
    }
  }
  return pairs;
}

function computeStatsRatio(seriesA, seriesB, lookbackDays = 90) {
  // seriesX = [{t, c}, ...]
  const n = Math.min(seriesA.length, seriesB.length);
  if (n < 20) return null;

  const ratios = [];
  const retsA = [];
  const retsB = [];

  for (let i = 1; i < n; i++) {
    const a0 = seriesA[i - 1].c;
    const a1 = seriesA[i].c;
    const b0 = seriesB[i - 1].c;
    const b1 = seriesB[i].c;
    if (!a1 || !b1) continue;

    const ratio = a1 / b1;
    ratios.push(ratio);

    retsA.push(Math.log(a1 / a0));
    retsB.push(Math.log(b1 / b0));
  }

  if (ratios.length < 20) return null;

  // Fenêtre glissante de 90 jours pour mean/std (cohérent avec backtest.js)
  const lookbackPoints = Math.min(lookbackDays, ratios.length);
  const recentRatios = ratios.slice(-lookbackPoints);

  const mean = recentRatios.reduce((s, v) => s + v, 0) / recentRatios.length;
  const variance = recentRatios.reduce((s, v) => s + (v - mean) ** 2, 0) / (recentRatios.length - 1);
  const std = Math.sqrt(variance);

  // corrélation des log returns (sur toute la période pour avoir une vue long terme)
  const mA = retsA.reduce((s, v) => s + v, 0) / retsA.length;
  const mB = retsB.reduce((s, v) => s + v, 0) / retsB.length;
  let cov = 0;
  let varA = 0;
  let varB = 0;
  for (let i = 0; i < retsA.length; i++) {
    const da = retsA[i] - mA;
    const db = retsB[i] - mB;
    cov += da * db;
    varA += da * da;
    varB += db * db;
  }
  cov /= retsA.length;
  varA /= retsA.length;
  varB /= retsB.length;
  const corr = cov / (Math.sqrt(varA) * Math.sqrt(varB) || 1);

  // Analyse de la réversion avec fenêtre glissante
  // Pour chaque point, calculer z avec sa propre fenêtre de 90 jours
  let reverts = 0;
  let signals = 0;
  let totalDays = 0;

  for (let i = lookbackPoints; i < ratios.length; i++) {
    // Fenêtre glissante pour ce point
    const windowRatios = ratios.slice(i - lookbackPoints, i);
    const windowMean = windowRatios.reduce((s, v) => s + v, 0) / windowRatios.length;
    const windowVar = windowRatios.reduce((s, v) => s + (v - windowMean) ** 2, 0) / (windowRatios.length - 1);
    const windowStd = Math.sqrt(windowVar);

    const z = windowStd > 0 ? (ratios[i] - windowMean) / windowStd : 0;

    if (Math.abs(z) > 1.5) {
      signals++;
      // regarde combien de jours pour revenir vers |z| < 0.5
      for (let j = i + 1; j < ratios.length && j < i + lookbackPoints; j++) {
        // Utiliser la même fenêtre pour la sortie (simplification)
        const zj = windowStd > 0 ? (ratios[j] - windowMean) / windowStd : 0;
        if (Math.abs(zj) < 0.5) {
          reverts++;
          totalDays += (j - i);
          break;
        }
      }
    }
  }
  const reversionRate = signals > 0 ? reverts / signals : 0;
  const avgDaysToRevert = reverts > 0 ? Math.round(totalDays / reverts) : null;

  // Z-score actuel (sur fenêtre de 90 jours)
  const lastRatio = ratios[ratios.length - 1];
  const zScore = std > 0 ? (lastRatio - mean) / std : 0;

  // Volatilité annualisée de chaque token
  const volA = Math.sqrt(varA) * Math.sqrt(365) * 100;
  const volB = Math.sqrt(varB) * Math.sqrt(365) * 100;
  const avgVol = (volA + volB) / 2;

  // Score de risque (1-10)
  let riskScore;
  if (avgVol < 50 && corr > 0.7) riskScore = 2;
  else if (avgVol < 50) riskScore = 3;
  else if (avgVol < 80 && corr > 0.6) riskScore = 4;
  else if (avgVol < 80) riskScore = 5;
  else if (avgVol < 120 && corr > 0.5) riskScore = 6;
  else if (avgVol < 120) riskScore = 7;
  else if (corr > 0.5) riskScore = 8;
  else riskScore = 9;

  return { mean, std, corr, reversionRate, avgDaysToRevert, lastRatio, zScore, volA, volB, riskScore };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end('Method not allowed');

  const universeKey = (req.query.universe || 'l2').toString();
  const coins = UNIVERSES[universeKey];
  if (!coins) return res.status(400).json({ error: 'Unknown universe' });

  try {
    const pairs = generatePairs(coins);

    // candles daily sur ~1 an
    const now = Date.now();
    const startTime = now - 365 * 24 * 60 * 60 * 1000;

    // D'abord, récupérer toutes les candles en parallèle (une seule fois par coin)
    const uniqueCoins = [...new Set(coins)];
    const candlesMap = {};

    await Promise.all(
      uniqueCoins.map(async (coin) => {
        try {
          const candles = await fetchCandles(coin, '1d', startTime, now);
          candlesMap[coin] = candles.map((c) => ({ t: c.t, c: parseFloat(c.c) }));
        } catch (e) {
          // Coin non disponible sur Hyperliquid
          candlesMap[coin] = null;
        }
      })
    );

    // Ensuite, calculer les stats pour chaque paire (pas d'appel API ici)
    const results = [];
    for (const pair of pairs) {
      const seriesA = candlesMap[pair.a];
      const seriesB = candlesMap[pair.b];

      if (!seriesA || !seriesB) continue;

      const stats = computeStatsRatio(seriesA, seriesB);
      if (!stats) continue;

      // Score : on veut corr élevée & bonne réversion à la moyenne
      const corrScore = Math.max(0, (stats.corr + 1) / 2); // 0 → 1
      const reversionScore = stats.reversionRate;          // 0 → 1
      const globalScore = 0.6 * corrScore + 0.4 * reversionScore;

      results.push({
        pairId: `${pair.a}-${pair.b}`.toLowerCase(),
        coinA: pair.a,
        coinB: pair.b,
        corr: stats.corr,
        reversionRate: stats.reversionRate,
        avgDaysToRevert: stats.avgDaysToRevert,
        lastRatio: stats.lastRatio,
        mean: stats.mean,
        std: stats.std,
        score: globalScore,
        zScore: stats.zScore,
        riskScore: stats.riskScore,
        volA: stats.volA,
        volB: stats.volB,
      });
    }

    // tri des meilleures paires
    results.sort((a, b) => b.score - a.score);

    res.status(200).json({ universe: universeKey, pairs: results });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Internal' });
  }
}
