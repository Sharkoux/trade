/**
 * Module de cache en mémoire simple avec TTL
 * Utilisé pour réduire les appels API répétitifs
 */

class MemoryCache {
  constructor() {
    this.cache = new Map();
    this.timers = new Map();
  }

  /**
   * Récupère une valeur du cache
   * @param {string} key - Clé du cache
   * @returns {any} Valeur ou undefined si expirée/inexistante
   */
  get(key) {
    const item = this.cache.get(key);
    if (!item) return undefined;

    if (Date.now() > item.expiresAt) {
      this.delete(key);
      return undefined;
    }

    return item.value;
  }

  /**
   * Stocke une valeur dans le cache
   * @param {string} key - Clé du cache
   * @param {any} value - Valeur à stocker
   * @param {number} ttlMs - Durée de vie en millisecondes (défaut: 5000)
   */
  set(key, value, ttlMs = 5000) {
    // Nettoyer l'ancien timer si existant
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
    }

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
      createdAt: Date.now(),
    });

    // Auto-cleanup après expiration
    const timer = setTimeout(() => {
      this.delete(key);
    }, ttlMs);

    this.timers.set(key, timer);
  }

  /**
   * Supprime une entrée du cache
   * @param {string} key - Clé à supprimer
   */
  delete(key) {
    this.cache.delete(key);
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
      this.timers.delete(key);
    }
  }

  /**
   * Vérifie si une clé existe et n'est pas expirée
   * @param {string} key - Clé à vérifier
   * @returns {boolean}
   */
  has(key) {
    return this.get(key) !== undefined;
  }

  /**
   * Vide tout le cache
   */
  clear() {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.cache.clear();
    this.timers.clear();
  }

  /**
   * Retourne la taille du cache
   * @returns {number}
   */
  size() {
    return this.cache.size;
  }

  /**
   * Retourne les statistiques du cache
   * @returns {Object}
   */
  stats() {
    let valid = 0;
    let expired = 0;
    const now = Date.now();

    for (const item of this.cache.values()) {
      if (now > item.expiresAt) {
        expired++;
      } else {
        valid++;
      }
    }

    return { valid, expired, total: this.cache.size };
  }
}

// Instance singleton pour le cache global
const globalCache = new MemoryCache();

/**
 * Wrapper pour fetch avec cache
 * @param {string} url - URL à fetcher
 * @param {Object} options - Options fetch
 * @param {number} ttlMs - TTL du cache (défaut: 5000ms)
 * @returns {Promise<any>}
 */
async function cachedFetch(url, options = {}, ttlMs = 5000) {
  // Créer une clé unique basée sur l'URL et le body
  const cacheKey = `fetch:${url}:${JSON.stringify(options.body || '')}`;

  // Vérifier le cache
  const cached = globalCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  // Faire la requête
  const response = await fetch(url, options);
  const data = await response.json();

  // Stocker dans le cache
  globalCache.set(cacheKey, data, ttlMs);

  return data;
}

/**
 * Wrapper pour les prix Hyperliquid avec cache
 * Cache de 3 secondes pour les prix
 */
const priceCache = new MemoryCache();

async function getCachedMidPrices() {
  const cacheKey = 'hyperliquid:allMids';
  const cached = priceCache.get(cacheKey);

  if (cached !== undefined) {
    return cached;
  }

  const response = await fetch('https://api.hyperliquid.xyz/info', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'allMids' }),
  });

  const data = await response.json();
  priceCache.set(cacheKey, data, 3000); // 3 secondes

  return data;
}

async function getCachedMidPrice(coin) {
  const mids = await getCachedMidPrices();
  return parseFloat(mids[coin]);
}

/**
 * Cache pour les metadata Hyperliquid (change rarement)
 * Cache de 5 minutes
 */
async function getCachedMeta() {
  const cacheKey = 'hyperliquid:meta';
  const cached = globalCache.get(cacheKey);

  if (cached !== undefined) {
    return cached;
  }

  const response = await fetch('https://api.hyperliquid.xyz/info', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'meta' }),
  });

  const data = await response.json();
  globalCache.set(cacheKey, data, 5 * 60 * 1000); // 5 minutes

  return data;
}

module.exports = {
  MemoryCache,
  globalCache,
  priceCache,
  cachedFetch,
  getCachedMidPrices,
  getCachedMidPrice,
  getCachedMeta,
};
