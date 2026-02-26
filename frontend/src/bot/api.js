/**
 * Module API Hyperliquid avec cache
 */

const { API } = require('./config');
const { MemoryCache } = require('../lib/cache');

// Cache pour les prix (3 secondes)
const priceCache = new MemoryCache();

// Cache pour les candles (30 secondes)
const candleCache = new MemoryCache();

/**
 * Fetch les candles pour un coin
 */
async function fetchCandles(coin, interval, startTime, endTime) {
  const cacheKey = `candles:${coin}:${interval}:${startTime}`;
  const cached = candleCache.get(cacheKey);
  if (cached) return cached;

  const res = await fetch(API.INFO, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'candleSnapshot',
      req: { coin, interval, startTime, endTime },
    }),
  });

  if (!res.ok) {
    throw new Error(`candleSnapshot error for ${coin}: ${res.status}`);
  }

  const data = await res.json();
  candleCache.set(cacheKey, data, 30000); // 30 secondes
  return data;
}

/**
 * Récupère tous les prix mid
 */
async function getAllMidPrices() {
  const cacheKey = 'allMids';
  const cached = priceCache.get(cacheKey);
  if (cached) return cached;

  const res = await fetch(API.INFO, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'allMids' }),
  });

  const data = await res.json();
  priceCache.set(cacheKey, data, 3000); // 3 secondes
  return data;
}

/**
 * Récupère le prix mid d'un coin
 */
async function getMidPrice(coin) {
  const mids = await getAllMidPrices();
  return parseFloat(mids[coin]);
}

/**
 * Récupère les metadata du marché
 */
async function getMeta() {
  const res = await fetch(API.INFO, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'meta' }),
  });
  return res.json();
}

/**
 * Vide les caches
 */
function clearCaches() {
  priceCache.clear();
  candleCache.clear();
}

module.exports = {
  fetchCandles,
  getAllMidPrices,
  getMidPrice,
  getMeta,
  clearCaches,
  priceCache,
  candleCache,
};
