// pages/api/spread/backtest.js
import { fetchCandles } from './_utilsHyperliquid';

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

function computeZSeries(series) {
  const vals = series.map((p) => p.ratio);
  const n = vals.length;
  const mean = vals.reduce((s, v) => s + v, 0) / n;
  const variance =
    vals.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1);
  const std = Math.sqrt(variance);
  return series.map((p) => ({
    ...p,
    z: std > 0 ? (p.ratio - mean) / std : 0,
  }));
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

  const { coinA, coinB, timeframe = '1y', zEnter, zExit, positionSize } = req.query;
  if (!coinA || !coinB) {
    return res.status(400).json({ error: 'coinA & coinB required' });
  }

  try {
    const now = Date.now();
    let startTime;
    let interval;
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

    const [ca, cb] = await Promise.all([
      fetchCandles(coinA.toUpperCase(), interval, startTime, now),
      fetchCandles(coinB.toUpperCase(), interval, startTime, now),
    ]);

    const series = buildRatioSeries(ca, cb);
    if (series.length < 30) {
      return res.status(400).json({ error: 'Not enough data' });
    }

    const zSeries = computeZSeries(series);
    const result = backtest(zSeries, {
      zEnter: zEnter ? parseFloat(zEnter) : 1.5,
      zExit: zExit ? parseFloat(zExit) : 0.5,
      positionSize: positionSize ? parseFloat(positionSize) : 1000,
    });

    res.status(200).json({
      coinA: coinA.toUpperCase(),
      coinB: coinB.toUpperCase(),
      timeframe,
      series: zSeries,
      backtest: result,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Internal error' });
  }
}
