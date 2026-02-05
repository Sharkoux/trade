// API Route: Exécuter un ordre live sur Hyperliquid
// Cette route reçoit un ordre pré-signé depuis le frontend

const EXCHANGE_API = 'https://api.hyperliquid.xyz/exchange';
const INFO_API = 'https://api.hyperliquid.xyz/info';

// Récupère les métadonnées du marché
async function getMeta() {
  const res = await fetch(INFO_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'meta' }),
  });
  return res.json();
}

// Récupère le prix mid d'un asset
async function getMidPrice(coin) {
  const res = await fetch(INFO_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'allMids' }),
  });
  const mids = await res.json();
  return parseFloat(mids[coin]);
}

// Récupère l'index d'un asset
async function getAssetIndex(coin) {
  const meta = await getMeta();
  const index = meta.universe.findIndex(a => a.name === coin);
  if (index === -1) throw new Error(`Asset ${coin} not found`);
  return index;
}

// Formate le prix pour Hyperliquid
function formatPrice(price) {
  if (price >= 10000) return Math.round(price).toString();
  if (price >= 1000) return price.toFixed(1);
  if (price >= 100) return price.toFixed(2);
  if (price >= 10) return price.toFixed(3);
  if (price >= 1) return price.toFixed(4);
  return price.toFixed(5);
}

// Formate la taille
function formatSize(size, decimals = 4) {
  return parseFloat(size).toFixed(decimals);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    action, // 'order', 'cancel', 'spread-open', 'spread-close'
    signature,
    address,
    nonce,
    ...params
  } = req.body;

  // Valider les paramètres obligatoires
  if (!action || !signature || !address) {
    return res.status(400).json({
      error: 'Missing required parameters: action, signature, address',
    });
  }

  try {
    let result;

    switch (action) {
      case 'order': {
        // Ordre simple
        const { coin, isBuy, size, price, reduceOnly = false } = params;
        if (!coin || size === undefined) {
          return res.status(400).json({ error: 'Missing coin or size' });
        }

        const assetIndex = await getAssetIndex(coin);
        const orderPrice = price || await getMidPrice(coin) * (isBuy ? 1.01 : 0.99);

        const orderRequest = {
          a: assetIndex,
          b: isBuy,
          p: formatPrice(orderPrice),
          s: formatSize(size),
          r: reduceOnly,
          t: { limit: { tif: 'Ioc' } },
        };

        const orderAction = {
          type: 'order',
          orders: [orderRequest],
          grouping: 'na',
        };

        const response = await fetch(EXCHANGE_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: orderAction,
            nonce,
            signature,
            vaultAddress: null,
          }),
        });

        result = await response.json();
        break;
      }

      case 'spread-open': {
        // Ouvrir un spread (2 ordres)
        const { coinA, coinB, sizeUSD, signal } = params;
        if (!coinA || !coinB || !sizeUSD || !signal) {
          return res.status(400).json({
            error: 'Missing coinA, coinB, sizeUSD, or signal',
          });
        }

        // Récupérer les prix et indices
        const [priceA, priceB, indexA, indexB] = await Promise.all([
          getMidPrice(coinA),
          getMidPrice(coinB),
          getAssetIndex(coinA),
          getAssetIndex(coinB),
        ]);

        const sizeA = (sizeUSD / 2) / priceA;
        const sizeB = (sizeUSD / 2) / priceB;
        const slippage = 0.01;

        // Signal LONG ratio = Long A, Short B
        // Signal SHORT ratio = Short A, Long B
        const orders = [];

        if (signal === 'LONG') {
          orders.push({
            a: indexA,
            b: true, // Buy A
            p: formatPrice(priceA * (1 + slippage)),
            s: formatSize(sizeA),
            r: false,
            t: { limit: { tif: 'Ioc' } },
          });
          orders.push({
            a: indexB,
            b: false, // Sell B
            p: formatPrice(priceB * (1 - slippage)),
            s: formatSize(sizeB),
            r: false,
            t: { limit: { tif: 'Ioc' } },
          });
        } else {
          orders.push({
            a: indexA,
            b: false, // Sell A
            p: formatPrice(priceA * (1 - slippage)),
            s: formatSize(sizeA),
            r: false,
            t: { limit: { tif: 'Ioc' } },
          });
          orders.push({
            a: indexB,
            b: true, // Buy B
            p: formatPrice(priceB * (1 + slippage)),
            s: formatSize(sizeB),
            r: false,
            t: { limit: { tif: 'Ioc' } },
          });
        }

        const spreadAction = {
          type: 'order',
          orders,
          grouping: 'na',
        };

        const response = await fetch(EXCHANGE_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: spreadAction,
            nonce,
            signature,
            vaultAddress: null,
          }),
        });

        result = await response.json();
        break;
      }

      case 'spread-close': {
        // Fermer un spread (2 ordres reduceOnly)
        const { coinA, coinB, positionA, positionB } = params;
        if (!coinA || !coinB) {
          return res.status(400).json({ error: 'Missing coinA or coinB' });
        }

        const [priceA, priceB, indexA, indexB] = await Promise.all([
          getMidPrice(coinA),
          getMidPrice(coinB),
          getAssetIndex(coinA),
          getAssetIndex(coinB),
        ]);

        const slippage = 0.01;
        const orders = [];

        // Fermer position A
        if (positionA && positionA.size !== 0) {
          const isBuyA = positionA.side === 'SHORT';
          orders.push({
            a: indexA,
            b: isBuyA,
            p: formatPrice(priceA * (isBuyA ? 1 + slippage : 1 - slippage)),
            s: formatSize(Math.abs(positionA.size)),
            r: true, // reduceOnly
            t: { limit: { tif: 'Ioc' } },
          });
        }

        // Fermer position B
        if (positionB && positionB.size !== 0) {
          const isBuyB = positionB.side === 'SHORT';
          orders.push({
            a: indexB,
            b: isBuyB,
            p: formatPrice(priceB * (isBuyB ? 1 + slippage : 1 - slippage)),
            s: formatSize(Math.abs(positionB.size)),
            r: true,
            t: { limit: { tif: 'Ioc' } },
          });
        }

        if (orders.length === 0) {
          return res.status(400).json({ error: 'No positions to close' });
        }

        const closeAction = {
          type: 'order',
          orders,
          grouping: 'na',
        };

        const response = await fetch(EXCHANGE_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: closeAction,
            nonce,
            signature,
            vaultAddress: null,
          }),
        });

        result = await response.json();
        break;
      }

      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }

    // Vérifier le résultat
    if (result.status === 'err') {
      return res.status(400).json({
        success: false,
        error: result.response || 'Order failed',
        details: result,
      });
    }

    res.status(200).json({
      success: true,
      result,
      timestamp: Date.now(),
    });

  } catch (error) {
    console.error('Execute error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}
