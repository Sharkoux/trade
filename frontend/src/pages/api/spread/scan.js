// pages/api/spread/scan.js
import { fetchCandles } from './_utilsHyperliquid'; // on factorise l'appel candleSnapshot

const UNIVERSES = {
  l2: ['OP', 'ARB', 'MNT', 'STRK', 'ZK'],
  dex: ['UNI', 'SUSHI', 'GMX', 'APEX'],
  bluechips: ['BTC', 'ETH', 'SOL', 'AVAX'],
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

function computeStatsRatio(seriesA, seriesB) {
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

  // moyenne & std du ratio
  const mean =
    ratios.reduce((s, v) => s + v, 0) / ratios.length;
  const variance =
    ratios.reduce((s, v) => s + (v - mean) ** 2, 0) / (ratios.length - 1);
  const std = Math.sqrt(variance);

  // corrélation des log returns
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

  // simple “mean reversion score” = combien de fois le z-score revient vers 0
  let reverts = 0;
  let signals = 0;
  for (let i = 0; i < ratios.length; i++) {
    const z = std > 0 ? (ratios[i] - mean) / std : 0;
    if (Math.abs(z) > 1) {
      signals++;
      // regarde si dans les 5 jours suivants on revient vers |z| < 0.5
      for (let j = i + 1; j < Math.min(i + 6, ratios.length); j++) {
        const zj = std > 0 ? (ratios[j] - mean) / std : 0;
        if (Math.abs(zj) < 0.5) {
          reverts++;
          break;
        }
      }
    }
  }
  const reversionRate = signals > 0 ? reverts / signals : 0;

  return { mean, std, corr, reversionRate, lastRatio: ratios[ratios.length - 1] };
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

    const results = [];
    for (const pair of pairs) {
      try {
        const [ca, cb] = await Promise.all([
          fetchCandles(pair.a, '1d', startTime, now),
          fetchCandles(pair.b, '1d', startTime, now),
        ]);

        const seriesA = ca.map((c) => ({ t: c.t, c: parseFloat(c.c) }));
        const seriesB = cb.map((c) => ({ t: c.t, c: parseFloat(c.c) }));

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
          lastRatio: stats.lastRatio,
          mean: stats.mean,
          std: stats.std,
          score: globalScore,
        });
      } catch (e) {
        // ignore la paire si erreur
      }
    }

    // tri des meilleures paires
    results.sort((a, b) => b.score - a.score);

    res.status(200).json({ universe: universeKey, pairs: results });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Internal' });
  }
}
