// pages/api/spread/backtest.js
import { fetchCandles, fetchFundingRates } from './_utilsHyperliquid';

function buildRatioSeries(ca, cb) {
  const n = Math.min(ca.length, cb.length);
  const series = [];
  for (let i = 0; i < n; i++) {
    const a = parseFloat(ca[i].c);
    const b = parseFloat(cb[i].c);
    if (!a || !b) continue;
    series.push({ t: ca[i].t, ratio: a / b });
  }
  return series;
}

// Calcul du Z-score avec fenêtre glissante fixe (lookback)
// Chaque point a son z calculé sur les N derniers points, pas sur toute la série
function computeZSeries(series, lookbackDays = 90) {
  // Estimer le nombre de points pour le lookback selon l'intervalle des données
  // On calcule la durée moyenne entre 2 points
  let avgIntervalMs = 24 * 60 * 60 * 1000; // par défaut 1 jour
  if (series.length >= 2) {
    const totalDuration = series[series.length - 1].t - series[0].t;
    avgIntervalMs = totalDuration / (series.length - 1);
  }
  const lookbackMs = lookbackDays * 24 * 60 * 60 * 1000;
  const lookbackPoints = Math.max(20, Math.round(lookbackMs / avgIntervalMs));

  // Calculer aussi la moyenne et std globales pour référence (sur les derniers lookbackPoints)
  const recentVals = series.slice(-lookbackPoints).map(p => p.ratio);
  const globalMean = recentVals.reduce((s, v) => s + v, 0) / recentVals.length;
  const globalVariance = recentVals.reduce((s, v) => s + (v - globalMean) ** 2, 0) / (recentVals.length - 1);
  const globalStd = Math.sqrt(globalVariance);

  return series.map((p, i) => {
    // Pour chaque point, calculer z sur la fenêtre glissante
    const windowStart = Math.max(0, i - lookbackPoints + 1);
    const window = series.slice(windowStart, i + 1);

    if (window.length < 20) {
      // Pas assez de données pour ce point, utiliser les stats globales
      return {
        ...p,
        z: globalStd > 0 ? (p.ratio - globalMean) / globalStd : 0,
        mean: globalMean,
        std: globalStd,
      };
    }

    const vals = window.map(pt => pt.ratio);
    const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
    const variance = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / (vals.length - 1);
    const std = Math.sqrt(variance);

    return {
      ...p,
      z: std > 0 ? (p.ratio - mean) / std : 0,
      mean,
      std,
    };
  });
}

// Calcul des métriques de risque
function computeRiskMetrics(ca, cb, series) {
  // Volatilité journalière de chaque token (écart-type des rendements)
  const returnsA = [];
  const returnsB = [];
  for (let i = 1; i < ca.length; i++) {
    const prevA = parseFloat(ca[i - 1].c);
    const currA = parseFloat(ca[i].c);
    const prevB = parseFloat(cb[i - 1].c);
    const currB = parseFloat(cb[i].c);
    if (prevA && currA && prevB && currB) {
      returnsA.push((currA - prevA) / prevA);
      returnsB.push((currB - prevB) / prevB);
    }
  }

  const avgRetA = returnsA.reduce((s, v) => s + v, 0) / returnsA.length;
  const avgRetB = returnsB.reduce((s, v) => s + v, 0) / returnsB.length;
  const volA = Math.sqrt(returnsA.reduce((s, v) => s + (v - avgRetA) ** 2, 0) / returnsA.length);
  const volB = Math.sqrt(returnsB.reduce((s, v) => s + (v - avgRetB) ** 2, 0) / returnsB.length);

  // Volatilité annualisée (×√365 pour daily)
  const volAnnualA = volA * Math.sqrt(365) * 100;
  const volAnnualB = volB * Math.sqrt(365) * 100;

  // Max drawdown du ratio (pire perte depuis un pic)
  const ratios = series.map(p => p.ratio);
  let maxDrawdown = 0;
  let peak = ratios[0];
  for (const r of ratios) {
    if (r > peak) peak = r;
    const dd = (peak - r) / peak;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  // Levier recommandé basé sur la volatilité
  // Règle : on veut max 20% de perte avant liquidation, donc levier = 20% / (2 × vol journalière max)
  const maxDailyVol = Math.max(volA, volB);
  const recommendedLeverage = maxDailyVol > 0 ? Math.min(5, Math.max(1, 0.1 / maxDailyVol)) : 2;

  // Score de risque (1-10)
  const avgVol = (volAnnualA + volAnnualB) / 2;
  let riskScore;
  if (avgVol < 50) riskScore = 3;
  else if (avgVol < 80) riskScore = 5;
  else if (avgVol < 120) riskScore = 7;
  else riskScore = 9;

  // Corrélation des rendements
  let correlation = 0;
  if (returnsA.length > 0) {
    let cov = 0;
    for (let i = 0; i < returnsA.length; i++) {
      cov += (returnsA[i] - avgRetA) * (returnsB[i] - avgRetB);
    }
    cov /= returnsA.length;
    const stdA = Math.sqrt(returnsA.reduce((s, v) => s + (v - avgRetA) ** 2, 0) / returnsA.length);
    const stdB = Math.sqrt(returnsB.reduce((s, v) => s + (v - avgRetB) ** 2, 0) / returnsB.length);
    correlation = stdA && stdB ? cov / (stdA * stdB) : 0;
  }

  return {
    volA: volAnnualA,
    volB: volAnnualB,
    maxDrawdown: maxDrawdown * 100,
    recommendedLeverage: Math.round(recommendedLeverage * 10) / 10,
    riskScore,
    correlation,
  };
}

// backtest mean reversion simple
function backtest(zSeries, params) {
  const { zEnter = 1.5, zExit = 0.5, positionSize = 1000 } = params;
  const trades = [];
  let current = null; // {side: 'short'|'long', entryZ, entryRatio, entryTime}

  for (const p of zSeries) {
    if (!current) {
      if (p.z > zEnter) {
        current = {
          side: 'short', // short ratio (short A / long B)
          entryZ: p.z,
          entryRatio: p.ratio,
          entryTime: p.t,
        };
      } else if (p.z < -zEnter) {
        current = {
          side: 'long', // long ratio (long A / short B)
          entryZ: p.z,
          entryRatio: p.ratio,
          entryTime: p.t,
        };
      }
    } else {
      // sortie si |z| < zExit
      if (Math.abs(p.z) < zExit) {
        const exitRatio = p.ratio;
        let pct;
        if (current.side === 'short') {
          // ratio baisse = gain
          pct = (current.entryRatio - exitRatio) / current.entryRatio;
        } else {
          // long ratio
          pct = (exitRatio - current.entryRatio) / current.entryRatio;
        }
        const pnlUsd = pct * positionSize;

        trades.push({
          ...current,
          exitZ: p.z,
          exitRatio,
          exitTime: p.t,
          pct,
          pnlUsd,
        });
        current = null;
      }
    }
  }

  const totalPnl = trades.reduce((s, t) => s + t.pnlUsd, 0);
  const avgPct = trades.length
    ? trades.reduce((s, t) => s + t.pct, 0) / trades.length
    : 0;

  return { trades, totalPnl, avgPct, nbTrades: trades.length };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end('Method not allowed');

  const { coinA, coinB, timeframe = '1y', startTime: customStart, endTime: customEnd, zEnter, zExit, positionSize } = req.query;
  if (!coinA || !coinB) {
    return res.status(400).json({ error: 'coinA & coinB required' });
  }

  try {
    const now = Date.now();
    let startTime;
    let endTime = customEnd ? parseInt(customEnd) : now;
    let interval;

    // Si dates custom fournies
    if (customStart) {
      startTime = parseInt(customStart);
      const durationDays = (endTime - startTime) / (24 * 60 * 60 * 1000);
      // Choisir l'intervalle selon la durée
      if (durationDays <= 7) {
        interval = '1h';
      } else if (durationDays <= 30) {
        interval = '4h';
      } else if (durationDays <= 90) {
        interval = '4h';
      } else {
        interval = '1d';
      }
    } else {
      // Timeframe preset
      switch (timeframe) {
        case '1m':
          interval = '4h';
          startTime = now - 30 * 24 * 60 * 60 * 1000;
          break;
        case '3m':
          interval = '4h';
          startTime = now - 90 * 24 * 60 * 60 * 1000;
          break;
        case '6m':
          interval = '1d';
          startTime = now - 180 * 24 * 60 * 60 * 1000;
          break;
        case '1y':
        default:
          interval = '1d';
          startTime = now - 365 * 24 * 60 * 60 * 1000;
      }
      endTime = now;
    }

    const [ca, cb] = await Promise.all([
      fetchCandles(coinA.toUpperCase(), interval, startTime, endTime),
      fetchCandles(coinB.toUpperCase(), interval, startTime, endTime),
    ]);

    console.log(`[backtest] ${coinA}/${coinB} - ca: ${ca.length}, cb: ${cb.length}, interval: ${interval}`);

    const series = buildRatioSeries(ca, cb);
    console.log(`[backtest] series length: ${series.length}`);

    if (series.length < 10) {
      return res.status(400).json({ error: `Not enough data (${series.length} points, need 10+)` });
    }

    const zSeries = computeZSeries(series);
    const result = backtest(zSeries, {
      zEnter: zEnter ? parseFloat(zEnter) : 1.5,
      zExit: zExit ? parseFloat(zExit) : 0.5,
      positionSize: positionSize ? parseFloat(positionSize) : 1000,
    });

    // Calcul des métriques de risque
    const riskMetrics = computeRiskMetrics(ca, cb, series);

    // Récupérer les funding rates actuels
    let funding = null;
    try {
      const fundingMap = await fetchFundingRates();
      const fundingA = fundingMap[coinA.toUpperCase()];
      const fundingB = fundingMap[coinB.toUpperCase()];
      if (fundingA && fundingB) {
        funding = {
          coinA: { ...fundingA, coin: coinA.toUpperCase() },
          coinB: { ...fundingB, coin: coinB.toUpperCase() },
          // Coût net estimé pour le spread (SHORT A + LONG B)
          // SHORT paye le funding si positif, reçoit si négatif
          // LONG reçoit le funding si positif, paye si négatif
          netRate8h: -fundingA.rate8h + fundingB.rate8h, // pour SHORT A / LONG B
          netAnnualized: -fundingA.annualized + fundingB.annualized,
        };
      }
    } catch (e) {
      console.log('[backtest] Could not fetch funding rates:', e.message);
    }

    res.status(200).json({
      coinA: coinA.toUpperCase(),
      coinB: coinB.toUpperCase(),
      timeframe,
      series: zSeries,
      backtest: result,
      risk: riskMetrics,
      funding,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Internal error' });
  }
}
