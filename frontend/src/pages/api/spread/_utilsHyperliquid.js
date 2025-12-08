// src/pages/api/spread/_utilsHyperliquid.js

// Petite fonction utilitaire pour appeler candleSnapshot d'Hyperliquid
export async function fetchCandles(coin, interval, startTime, endTime) {
  const res = await fetch('https://api.hyperliquid.xyz/info', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'candleSnapshot',
      req: {
        coin,       // ex: 'OP'
        interval,   // ex: '1d', '4h', '1m' (selon ce qu'on choisit)
        startTime,  // timestamp ms
        endTime,    // timestamp ms
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`candleSnapshot error for ${coin}: ${res.status} ${text}`);
  }

  const data = await res.json();

  if (!Array.isArray(data)) {
    throw new Error(`Unexpected candleSnapshot response for ${coin}`);
  }

  // data = tableau de bougies : [{ t, o, h, l, c, v }, ... ]
  return data;
}
