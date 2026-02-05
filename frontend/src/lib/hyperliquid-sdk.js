// SDK Hyperliquid pour le trading automatique
// Gère la signature EIP-712 et l'exécution des ordres

import { keccak256, encodePacked, toHex, parseUnits } from 'viem';

const EXCHANGE_API = 'https://api.hyperliquid.xyz/exchange';
const INFO_API = 'https://api.hyperliquid.xyz/info';

// Constantes EIP-712 pour Hyperliquid
const EIP712_DOMAIN = {
  name: 'HyperliquidSignTransaction',
  version: '1',
  chainId: 42161, // Arbitrum
  verifyingContract: '0x0000000000000000000000000000000000000000',
};

// Types pour les ordres
const ORDER_TYPES = {
  Order: [
    { name: 'asset', type: 'uint32' },
    { name: 'isBuy', type: 'bool' },
    { name: 'limitPx', type: 'uint64' },
    { name: 'sz', type: 'uint64' },
    { name: 'reduceOnly', type: 'bool' },
    { name: 'orderType', type: 'uint8' },
    { name: 'cloid', type: 'bytes16' },
  ],
};

/**
 * Récupère les métadonnées du marché (liste des assets, etc.)
 */
export async function getMeta() {
  const res = await fetch(INFO_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'meta' }),
  });
  return res.json();
}

/**
 * Récupère l'index d'un asset par son nom
 */
export async function getAssetIndex(coin) {
  const meta = await getMeta();
  const index = meta.universe.findIndex(a => a.name === coin);
  if (index === -1) throw new Error(`Asset ${coin} not found`);
  return index;
}

/**
 * Récupère le prix mid actuel d'un asset
 */
export async function getMidPrice(coin) {
  const res = await fetch(INFO_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'allMids' }),
  });
  const mids = await res.json();
  return parseFloat(mids[coin]);
}

/**
 * Récupère les positions d'un compte
 */
export async function getPositions(address) {
  const res = await fetch(INFO_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'clearinghouseState',
      user: address,
    }),
  });
  return res.json();
}

/**
 * Convertit un nombre en format Hyperliquid (string avec précision)
 */
function formatSize(size, szDecimals = 4) {
  return parseFloat(size).toFixed(szDecimals);
}

function formatPrice(price) {
  // Prix avec 5 significant figures max
  if (price >= 10000) return Math.round(price).toString();
  if (price >= 1000) return price.toFixed(1);
  if (price >= 100) return price.toFixed(2);
  if (price >= 10) return price.toFixed(3);
  if (price >= 1) return price.toFixed(4);
  return price.toFixed(5);
}

/**
 * Génère un Client Order ID unique
 */
function generateCloid() {
  const timestamp = Date.now().toString(16);
  const random = Math.random().toString(16).slice(2, 10);
  return `0x${timestamp}${random}`.padEnd(34, '0').slice(0, 34);
}

/**
 * Crée la structure d'un ordre pour Hyperliquid
 */
export function createOrderRequest({
  coin,
  isBuy,
  size,
  price,
  reduceOnly = false,
  orderType = 'limit', // 'limit' ou 'market'
  assetIndex,
}) {
  const order = {
    a: assetIndex, // asset index
    b: isBuy,
    p: formatPrice(price),
    s: formatSize(size),
    r: reduceOnly,
    t: orderType === 'market'
      ? { market: {} }
      : { limit: { tif: 'Ioc' } }, // Immediate or Cancel pour exécution rapide
  };

  return order;
}

/**
 * Place un ordre via l'API Hyperliquid
 * Nécessite un wallet connecté côté client pour signer
 */
export async function placeOrder({
  walletClient,
  address,
  coin,
  isBuy,
  size,
  price,
  reduceOnly = false,
  leverage = 1,
}) {
  // 1. Récupérer l'index de l'asset
  const assetIndex = await getAssetIndex(coin);

  // 2. Créer la requête d'ordre
  const orderRequest = createOrderRequest({
    coin,
    isBuy,
    size,
    price,
    reduceOnly,
    orderType: 'limit',
    assetIndex,
  });

  // 3. Créer l'action à signer
  const timestamp = Date.now();
  const action = {
    type: 'order',
    orders: [orderRequest],
    grouping: 'na',
  };

  // 4. Hash pour signature (simplifié - Hyperliquid utilise un hash custom)
  const connectionId = keccak256(
    encodePacked(['address', 'uint64'], [address, BigInt(timestamp)])
  );

  // 5. Construire le message à signer
  const phantomAgent = {
    source: 'a', // Mainnet
    connectionId,
  };

  // 6. Signer avec EIP-712
  const signature = await walletClient.signTypedData({
    account: address,
    domain: {
      name: 'Exchange',
      version: '1',
      chainId: 42161,
      verifyingContract: '0x0000000000000000000000000000000000000000',
    },
    types: {
      Agent: [
        { name: 'source', type: 'string' },
        { name: 'connectionId', type: 'bytes32' },
      ],
    },
    primaryType: 'Agent',
    message: phantomAgent,
  });

  // 7. Envoyer l'ordre
  const response = await fetch(EXCHANGE_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action,
      nonce: timestamp,
      signature,
      vaultAddress: null,
    }),
  });

  return response.json();
}

/**
 * Place un ordre market (exécution immédiate)
 */
export async function placeMarketOrder({
  walletClient,
  address,
  coin,
  isBuy,
  size,
  slippage = 0.01, // 1% slippage par défaut
}) {
  // Récupérer le prix actuel
  const midPrice = await getMidPrice(coin);

  // Calculer le prix avec slippage
  const price = isBuy
    ? midPrice * (1 + slippage)
    : midPrice * (1 - slippage);

  return placeOrder({
    walletClient,
    address,
    coin,
    isBuy,
    size,
    price,
    reduceOnly: false,
  });
}

/**
 * Ferme une position existante
 */
export async function closePosition({
  walletClient,
  address,
  coin,
  size,
  side, // 'LONG' ou 'SHORT'
}) {
  const midPrice = await getMidPrice(coin);
  const slippage = 0.01;

  // Pour fermer: vendre si LONG, acheter si SHORT
  const isBuy = side === 'SHORT';
  const price = isBuy
    ? midPrice * (1 + slippage)
    : midPrice * (1 - slippage);

  return placeOrder({
    walletClient,
    address,
    coin,
    isBuy,
    size: Math.abs(size),
    price,
    reduceOnly: true,
  });
}

/**
 * Place une paire de positions pour spread trading
 * SHORT coinA + LONG coinB (ou inverse selon le signal)
 */
export async function placeSpreadTrade({
  walletClient,
  address,
  coinA,
  coinB,
  sizeUSD,
  signal, // 'LONG' ou 'SHORT' (du ratio A/B)
  leverage = 1,
}) {
  // Récupérer les prix
  const [priceA, priceB] = await Promise.all([
    getMidPrice(coinA),
    getMidPrice(coinB),
  ]);

  // Calculer les tailles en fonction du montant USD
  const sizeA = (sizeUSD / 2) / priceA;
  const sizeB = (sizeUSD / 2) / priceB;

  // Signal LONG ratio = on s'attend à ce que A surperforme B
  // => Long A, Short B
  // Signal SHORT ratio = on s'attend à ce que A sous-performe B
  // => Short A, Long B

  const orders = [];

  if (signal === 'LONG') {
    // Long A, Short B
    orders.push({
      coin: coinA,
      isBuy: true,
      size: sizeA,
      price: priceA * 1.01, // 1% slippage
    });
    orders.push({
      coin: coinB,
      isBuy: false,
      size: sizeB,
      price: priceB * 0.99,
    });
  } else {
    // Short A, Long B
    orders.push({
      coin: coinA,
      isBuy: false,
      size: sizeA,
      price: priceA * 0.99,
    });
    orders.push({
      coin: coinB,
      isBuy: true,
      size: sizeB,
      price: priceB * 1.01,
    });
  }

  // Exécuter les ordres
  const results = [];
  for (const order of orders) {
    const result = await placeOrder({
      walletClient,
      address,
      ...order,
    });
    results.push(result);
  }

  return results;
}

/**
 * Ferme une position spread
 */
export async function closeSpreadTrade({
  walletClient,
  address,
  coinA,
  coinB,
  positionA, // { size, side }
  positionB, // { size, side }
}) {
  const results = [];

  if (positionA && positionA.size !== 0) {
    const result = await closePosition({
      walletClient,
      address,
      coin: coinA,
      size: positionA.size,
      side: positionA.side,
    });
    results.push(result);
  }

  if (positionB && positionB.size !== 0) {
    const result = await closePosition({
      walletClient,
      address,
      coin: coinB,
      size: positionB.size,
      side: positionB.side,
    });
    results.push(result);
  }

  return results;
}

export default {
  getMeta,
  getAssetIndex,
  getMidPrice,
  getPositions,
  placeOrder,
  placeMarketOrder,
  closePosition,
  placeSpreadTrade,
  closeSpreadTrade,
};
