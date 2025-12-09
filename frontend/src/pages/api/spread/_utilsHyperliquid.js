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

// Récupérer les infos de marché (dont funding rate)
export async function fetchMeta() {
  const res = await fetch('https://api.hyperliquid.xyz/info', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'meta' }),
  });

  if (!res.ok) {
    throw new Error(`meta error: ${res.status}`);
  }

  return res.json();
}

// Récupérer les funding rates actuels
export async function fetchFundingRates() {
  const res = await fetch('https://api.hyperliquid.xyz/info', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'metaAndAssetCtxs' }),
  });

  if (!res.ok) {
    throw new Error(`metaAndAssetCtxs error: ${res.status}`);
  }

  const data = await res.json();
  // data[0] = meta, data[1] = array of asset contexts
  // Chaque asset context a : { funding, openInterest, prevDayPx, dayNtlVlm, ... }

  const meta = data[0];
  const assetCtxs = data[1];

  const fundingMap = {};
  if (meta?.universe && assetCtxs) {
    for (let i = 0; i < meta.universe.length; i++) {
      const coin = meta.universe[i].name;
      const ctx = assetCtxs[i];
      if (ctx?.funding) {
        // funding est le taux horaire, on le convertit en taux 8h et annualisé
        const hourlyRate = parseFloat(ctx.funding);
        fundingMap[coin] = {
          hourly: hourlyRate * 100,
          rate8h: hourlyRate * 8 * 100,
          annualized: hourlyRate * 8 * 3 * 365 * 100, // 3 fois par jour × 365 jours
        };
      }
    }
  }

  return fundingMap;
}
