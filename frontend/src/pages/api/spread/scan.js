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
    ratios.push({ ratio, t: seriesA[i].t });

    retsA.push(Math.log(a1 / a0));
    retsB.push(Math.log(b1 / b0));
  }

  if (ratios.length < 20) return null;

  // Fenêtre glissante de 90 jours pour mean/std (cohérent avec backtest.js)
  const lookbackPoints = Math.min(lookbackDays, ratios.length);
  const recentRatios = ratios.slice(-lookbackPoints).map(r => r.ratio);

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

  // === BACKTEST HISTORIQUE ===
  // Simuler les trades passés pour avoir des stats réelles
  const zEnter = 1.5;
  const zExit = 0.5;
  const trades = [];
  let currentTrade = null;
  let maxDrawdown = 0;
  let peak = ratios[0].ratio;

  for (let i = lookbackPoints; i < ratios.length; i++) {
    const r = ratios[i].ratio;

    // Calcul du drawdown
    if (r > peak) peak = r;
    const dd = (peak - r) / peak;
    if (dd > maxDrawdown) maxDrawdown = dd;

    // Fenêtre glissante pour ce point
    const windowRatios = ratios.slice(i - lookbackPoints, i).map(x => x.ratio);
    const windowMean = windowRatios.reduce((s, v) => s + v, 0) / windowRatios.length;
    const windowVar = windowRatios.reduce((s, v) => s + (v - windowMean) ** 2, 0) / (windowRatios.length - 1);
    const windowStd = Math.sqrt(windowVar);
    const z = windowStd > 0 ? (r - windowMean) / windowStd : 0;

    if (!currentTrade) {
      // Entrée en position
      if (z > zEnter) {
        currentTrade = { side: 'short', entryRatio: r, entryTime: ratios[i].t, entryZ: z };
      } else if (z < -zEnter) {
        currentTrade = { side: 'long', entryRatio: r, entryTime: ratios[i].t, entryZ: z };
      }
    } else {
      // Sortie si |z| < zExit
      if (Math.abs(z) < zExit) {
        let pct;
        if (currentTrade.side === 'short') {
          pct = (currentTrade.entryRatio - r) / currentTrade.entryRatio;
        } else {
          pct = (r - currentTrade.entryRatio) / currentTrade.entryRatio;
        }
        trades.push({
          ...currentTrade,
          exitRatio: r,
          exitTime: ratios[i].t,
          exitZ: z,
          pct,
          durationDays: Math.round((ratios[i].t - currentTrade.entryTime) / (24 * 60 * 60 * 1000)),
        });
        currentTrade = null;
      }
    }
  }

  // Stats du backtest
  const nbTrades = trades.length;
  const wins = trades.filter(t => t.pct > 0).length;
  const winRate = nbTrades > 0 ? wins / nbTrades : 0;
  const avgReturn = nbTrades > 0 ? trades.reduce((s, t) => s + t.pct, 0) / nbTrades : 0;
  const avgDuration = nbTrades > 0 ? Math.round(trades.reduce((s, t) => s + t.durationDays, 0) / nbTrades) : null;
  const totalReturn = trades.reduce((s, t) => s + t.pct, 0);

  // Derniers trades (les 3 plus récents)
  const recentTrades = trades.slice(-3).reverse();

  // Z-score actuel (sur fenêtre de 90 jours)
  const lastRatio = ratios[ratios.length - 1].ratio;
  const zScore = std > 0 ? (lastRatio - mean) / std : 0;

  // Volatilité annualisée de chaque token
  const volA = Math.sqrt(varA) * Math.sqrt(365) * 100;
  const volB = Math.sqrt(varB) * Math.sqrt(365) * 100;
  const avgVol = (volA + volB) / 2;

  // Score de risque (1-10) amélioré avec drawdown
  let riskScore;
  if (avgVol < 50 && corr > 0.7 && maxDrawdown < 0.2) riskScore = 2;
  else if (avgVol < 50 && maxDrawdown < 0.25) riskScore = 3;
  else if (avgVol < 80 && corr > 0.6 && maxDrawdown < 0.3) riskScore = 4;
  else if (avgVol < 80 && maxDrawdown < 0.35) riskScore = 5;
  else if (avgVol < 120 && corr > 0.5 && maxDrawdown < 0.4) riskScore = 6;
  else if (avgVol < 120) riskScore = 7;
  else if (corr > 0.5) riskScore = 8;
  else riskScore = 9;

  return {
    mean,
    std,
    corr,
    lastRatio,
    zScore,
    volA,
    volB,
    riskScore,
    // Nouvelles stats de backtest
    maxDrawdown: maxDrawdown * 100,
    nbTrades,
    winRate,
    avgReturn: avgReturn * 100,
    avgDuration,
    totalReturn: totalReturn * 100,
    recentTrades,
  };
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

      // === SCORE DE QUALITÉ DU TRADE (0 à 5 étoiles) ===
      // Objectif : Mettre en avant les trades SÛRS et RENTABLES
      //
      // RÈGLES STRICTES (élimination) :
      // - Avg négatif = MAX 1 étoile (trade perdant historiquement)
      // - Drawdown > 50% = MAX 1 étoile (trop risqué)
      // - Winrate < 50% = MAX 2 étoiles
      // - Moins de 3 trades historiques = MAX 2 étoiles (pas assez de données)

      const z = stats.zScore;
      const absZ = Math.abs(z);
      let qualityStars = 0;
      let maxStars = 5; // Plafond qui peut être réduit par les pénalités

      // === PÉNALITÉS STRICTES ===

      // Trade historiquement perdant = MAXIMUM 1 étoile
      if (stats.avgReturn < 0) {
        maxStars = 1;
      }
      // Drawdown catastrophique (> 50%) = MAXIMUM 1 étoile
      else if (stats.maxDrawdown > 50) {
        maxStars = 1;
      }
      // Drawdown élevé (> 40%) = MAXIMUM 2 étoiles
      else if (stats.maxDrawdown > 40) {
        maxStars = 2;
      }
      // Winrate faible (< 50%) = MAXIMUM 2 étoiles
      else if (stats.winRate < 0.5) {
        maxStars = 2;
      }
      // Pas assez de données (< 3 trades) = MAXIMUM 2 étoiles
      else if (stats.nbTrades < 3) {
        maxStars = 2;
      }

      // === POINTS POSITIFS (seulement si pas éliminé) ===

      // Critère 1 : RENTABILITÉ - Rendement moyen (max 2 étoiles)
      // C'est le critère le plus important !
      if (stats.avgReturn >= 8) qualityStars += 2;         // >= 8% = excellent
      else if (stats.avgReturn >= 5) qualityStars += 1.5;  // >= 5% = très bon
      else if (stats.avgReturn >= 2) qualityStars += 1;    // >= 2% = correct
      else if (stats.avgReturn > 0) qualityStars += 0.5;   // > 0% = au moins positif

      // Critère 2 : SÛRETÉ - Winrate élevé (max 1.5 étoiles)
      if (stats.winRate >= 0.8) qualityStars += 1.5;       // 80%+ = excellent
      else if (stats.winRate >= 0.7) qualityStars += 1;    // 70%+ = très bon
      else if (stats.winRate >= 0.6) qualityStars += 0.5;  // 60%+ = correct

      // Critère 3 : SÛRETÉ - Drawdown faible (max 1 étoile)
      if (stats.maxDrawdown <= 20) qualityStars += 1;      // <= 20% = excellent
      else if (stats.maxDrawdown <= 30) qualityStars += 0.5; // <= 30% = acceptable

      // Critère 4 : SIGNAL - Z-Score dans la zone idéale (max 0.5 étoile)
      // Moins important que la rentabilité historique
      if (absZ >= 1.5 && absZ <= 2.5) qualityStars += 0.5;

      // Appliquer le plafond et arrondir
      qualityStars = Math.min(maxStars, Math.round(qualityStars));

      results.push({
        pairId: `${pair.a}-${pair.b}`.toLowerCase(),
        coinA: pair.a,
        coinB: pair.b,
        corr: stats.corr,
        lastRatio: stats.lastRatio,
        mean: stats.mean,
        std: stats.std,
        zScore: stats.zScore,
        riskScore: stats.riskScore,
        volA: stats.volA,
        volB: stats.volB,
        // Stats de backtest historique
        maxDrawdown: stats.maxDrawdown,
        nbTrades: stats.nbTrades,
        winRate: stats.winRate,
        avgReturn: stats.avgReturn,
        avgDuration: stats.avgDuration,
        totalReturn: stats.totalReturn,
        recentTrades: stats.recentTrades,
        // Score de qualité (0 à 5 étoiles)
        qualityStars,
      });
    }

    // tri des meilleures paires par qualité puis par z-score
    results.sort((a, b) => {
      if (b.qualityStars !== a.qualityStars) return b.qualityStars - a.qualityStars;
      return Math.abs(b.zScore) - Math.abs(a.zScore);
    });

    res.status(200).json({ universe: universeKey, pairs: results });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Internal' });
  }
}
