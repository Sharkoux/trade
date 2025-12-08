// pages/api/hyperliquid/candles.js
function parseTimeframe(tf) {
  // simple mapping timeframe → interval + lookback ms
  const now = Date.now();
  switch (tf) {
    case '1h':
      return { interval: '1m', startTime: now - 60 * 60 * 1000 };
    case '4h':
      return { interval: '5m', startTime: now - 4 * 60 * 60 * 1000 };
    case '1d':
      return { interval: '15m', startTime: now - 24 * 60 * 60 * 1000 };
    case '1w':
      return { interval: '1h', startTime: now - 7 * 24 * 60 * 60 * 1000 };
    default:
      return { interval: '15m', startTime: now - 24 * 60 * 60 * 1000 };
  }
}

async function fetchCandles(coin, interval, startTime, endTime) {
  const res = await fetch('https://api.hyperliquid.xyz/info', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'candleSnapshot',
      req: { coin, interval, startTime, endTime },
    }),
  });

  if (!res.ok) throw new Error(`candleSnapshot error for ${coin}`);
  const data = await res.json(); // tableau de bougies OHLCV 
  return data;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end('Method not allowed');

  const { coinA, coinB, timeframe = '1d' } = req.query;
  if (!coinA || !coinB) {
    return res.status(400).json({ error: 'coinA & coinB required' });
  }

  try {
    const now = Date.now();
    const { interval, startTime } = parseTimeframe(timeframe);
    const endTime = now;

    const [ca, cb] = await Promise.all([
      fetchCandles(coinA.toUpperCase(), interval, startTime, endTime),
      fetchCandles(coinB.toUpperCase(), interval, startTime, endTime),
    ]);

    const len = Math.min(ca.length, cb.length);
    const series = [];

    for (let i = 0; i < len; i++) {
      const a = ca[i];
      const b = cb[i];
      const closeA = parseFloat(a.c);
      const closeB = parseFloat(b.c);
      if (!isFinite(closeA) || !isFinite(closeB)) continue;
      const ratio = closeA / closeB;
      series.push({
        t: a.t,          // open time ms
        ratio,
        a: closeA,
        b: closeB,
      });
    }

    res.status(200).json({
      series,
      interval,
      coinA: coinA.toUpperCase(),
      coinB: coinB.toUpperCase(),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Internal error' });
  }
}
