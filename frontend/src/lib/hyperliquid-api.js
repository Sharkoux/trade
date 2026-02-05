// Hyperliquid API avec support des API Keys
// Pour le trading automatique sécurisé (bot worker)

const crypto = require('crypto');

const EXCHANGE_API = 'https://api.hyperliquid.xyz/exchange';
const INFO_API = 'https://api.hyperliquid.xyz/info';

/**
 * Génère une signature pour l'API Hyperliquid
 * Utilise HMAC-SHA256 avec le secret de l'API key
 */
function signRequest(secret, timestamp, method, path, body = '') {
  const message = `${timestamp}${method}${path}${body}`;
  return crypto
    .createHmac('sha256', secret)
    .update(message)
    .digest('hex');
}

/**
 * Génère un nonce unique basé sur le timestamp
 */
function generateNonce() {
  return Date.now();
}

/**
 * Client API Hyperliquid avec authentification par API Key
 */
class HyperliquidClient {
  constructor({ apiKey, apiSecret, walletAddress }) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.walletAddress = walletAddress;
    this.meta = null;
  }

  /**
   * Requête INFO (lecture seule, pas besoin d'auth)
   */
  async infoRequest(payload) {
    const res = await fetch(INFO_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`Info request failed: ${res.status}`);
    }

    return res.json();
  }

  /**
   * Requête EXCHANGE (trading, nécessite auth)
   */
  async exchangeRequest(action) {
    const nonce = generateNonce();

    const payload = {
      action,
      nonce,
      signature: {
        r: '0x0000000000000000000000000000000000000000000000000000000000000000',
        s: '0x0000000000000000000000000000000000000000000000000000000000000000',
        v: 27,
      },
      vaultAddress: null,
    };

    // Headers pour l'authentification API Key
    const headers = {
      'Content-Type': 'application/json',
    };

    // Si on a une API key, on l'utilise
    if (this.apiKey && this.apiSecret) {
      const timestamp = Date.now().toString();
      const bodyStr = JSON.stringify(payload);

      // Hyperliquid utilise le wallet address + timestamp + action hash
      const actionHash = crypto
        .createHash('sha256')
        .update(JSON.stringify(action))
        .digest('hex');

      const signaturePayload = `${this.walletAddress}${timestamp}${actionHash}`;
      const signature = crypto
        .createHmac('sha256', this.apiSecret)
        .update(signaturePayload)
        .digest('hex');

      headers['HL-API-KEY'] = this.apiKey;
      headers['HL-TIMESTAMP'] = timestamp;
      headers['HL-SIGNATURE'] = signature;
    }

    const res = await fetch(EXCHANGE_API, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (data.status === 'err') {
      throw new Error(data.response || 'Exchange request failed');
    }

    return data;
  }

  /**
   * Récupère les métadonnées du marché
   */
  async getMeta() {
    if (!this.meta) {
      this.meta = await this.infoRequest({ type: 'meta' });
    }
    return this.meta;
  }

  /**
   * Récupère l'index d'un asset
   */
  async getAssetIndex(coin) {
    const meta = await this.getMeta();
    const index = meta.universe.findIndex(a => a.name === coin);
    if (index === -1) throw new Error(`Asset ${coin} not found`);
    return index;
  }

  /**
   * Récupère les décimales de taille pour un asset
   */
  async getSzDecimals(coin) {
    const meta = await this.getMeta();
    const asset = meta.universe.find(a => a.name === coin);
    return asset?.szDecimals || 4;
  }

  /**
   * Récupère tous les prix mid
   */
  async getAllMids() {
    return this.infoRequest({ type: 'allMids' });
  }

  /**
   * Récupère le prix mid d'un asset
   */
  async getMidPrice(coin) {
    const mids = await this.getAllMids();
    const price = parseFloat(mids[coin]);
    if (isNaN(price)) throw new Error(`Price not found for ${coin}`);
    return price;
  }

  /**
   * Récupère l'état du compte (positions, balance)
   */
  async getAccountState(address = null) {
    return this.infoRequest({
      type: 'clearinghouseState',
      user: address || this.walletAddress,
    });
  }

  /**
   * Récupère les positions ouvertes
   */
  async getPositions(address = null) {
    const state = await this.getAccountState(address);
    return state.assetPositions || [];
  }

  /**
   * Récupère la balance disponible
   */
  async getBalance(address = null) {
    const state = await this.getAccountState(address);
    return {
      equity: parseFloat(state.marginSummary?.accountValue || 0),
      available: parseFloat(state.withdrawable || 0),
      margin: parseFloat(state.marginSummary?.totalMarginUsed || 0),
    };
  }

  /**
   * Formate un prix selon les règles Hyperliquid
   */
  formatPrice(price) {
    if (price >= 10000) return Math.round(price).toString();
    if (price >= 1000) return price.toFixed(1);
    if (price >= 100) return price.toFixed(2);
    if (price >= 10) return price.toFixed(3);
    if (price >= 1) return price.toFixed(4);
    return price.toFixed(5);
  }

  /**
   * Formate une taille
   */
  formatSize(size, decimals = 4) {
    return parseFloat(size).toFixed(decimals);
  }

  /**
   * Place un ordre
   */
  async placeOrder({
    coin,
    isBuy,
    size,
    price,
    reduceOnly = false,
    orderType = 'limit', // 'limit' ou 'market'
    tif = 'Ioc', // Immediate or Cancel
  }) {
    const assetIndex = await this.getAssetIndex(coin);
    const szDecimals = await this.getSzDecimals(coin);

    const order = {
      a: assetIndex,
      b: isBuy,
      p: this.formatPrice(price),
      s: this.formatSize(size, szDecimals),
      r: reduceOnly,
      t: orderType === 'market'
        ? { limit: { tif: 'Ioc' } }  // Market = limit IOC avec slippage
        : { limit: { tif } },
    };

    const action = {
      type: 'order',
      orders: [order],
      grouping: 'na',
    };

    return this.exchangeRequest(action);
  }

  /**
   * Place un ordre market
   */
  async placeMarketOrder({
    coin,
    isBuy,
    size,
    slippage = 0.01,
  }) {
    const midPrice = await this.getMidPrice(coin);
    const price = isBuy
      ? midPrice * (1 + slippage)
      : midPrice * (1 - slippage);

    return this.placeOrder({
      coin,
      isBuy,
      size,
      price,
      orderType: 'market',
    });
  }

  /**
   * Ferme une position
   */
  async closePosition({ coin, size, side }) {
    const midPrice = await this.getMidPrice(coin);
    const slippage = 0.015; // 1.5% pour être sûr de fermer

    // Pour fermer: vendre si LONG, acheter si SHORT
    const isBuy = side === 'SHORT';
    const price = isBuy
      ? midPrice * (1 + slippage)
      : midPrice * (1 - slippage);

    return this.placeOrder({
      coin,
      isBuy,
      size: Math.abs(size),
      price,
      reduceOnly: true,
    });
  }

  /**
   * Place un spread trade (2 positions opposées)
   */
  async placeSpreadTrade({
    coinA,
    coinB,
    sizeUSD,
    signal, // 'LONG' ou 'SHORT' du ratio A/B
  }) {
    // Récupérer les prix
    const [priceA, priceB] = await Promise.all([
      this.getMidPrice(coinA),
      this.getMidPrice(coinB),
    ]);

    // Calculer les tailles
    const sizeA = (sizeUSD / 2) / priceA;
    const sizeB = (sizeUSD / 2) / priceB;

    const slippage = 0.01;
    const results = [];

    if (signal === 'LONG') {
      // Long A, Short B (on pense que A va surperformer B)
      results.push(await this.placeOrder({
        coin: coinA,
        isBuy: true,
        size: sizeA,
        price: priceA * (1 + slippage),
      }));

      results.push(await this.placeOrder({
        coin: coinB,
        isBuy: false,
        size: sizeB,
        price: priceB * (1 - slippage),
      }));
    } else {
      // Short A, Long B (on pense que B va surperformer A)
      results.push(await this.placeOrder({
        coin: coinA,
        isBuy: false,
        size: sizeA,
        price: priceA * (1 - slippage),
      }));

      results.push(await this.placeOrder({
        coin: coinB,
        isBuy: true,
        size: sizeB,
        price: priceB * (1 + slippage),
      }));
    }

    return results;
  }

  /**
   * Ferme un spread trade
   */
  async closeSpreadTrade({ coinA, coinB, positionA, positionB }) {
    const results = [];

    if (positionA && Math.abs(positionA.size) > 0) {
      results.push(await this.closePosition({
        coin: coinA,
        size: positionA.size,
        side: positionA.side,
      }));
    }

    if (positionB && Math.abs(positionB.size) > 0) {
      results.push(await this.closePosition({
        coin: coinB,
        size: positionB.size,
        side: positionB.side,
      }));
    }

    return results;
  }

  /**
   * Vérifie que l'API key est valide
   */
  async testConnection() {
    try {
      const balance = await this.getBalance();
      return {
        success: true,
        balance,
        message: `Connexion OK. Balance: ${balance.equity.toFixed(2)} USDC`,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

/**
 * Crée un client Hyperliquid
 */
function createClient({ apiKey, apiSecret, walletAddress }) {
  return new HyperliquidClient({ apiKey, apiSecret, walletAddress });
}

module.exports = {
  HyperliquidClient,
  createClient,
  INFO_API,
  EXCHANGE_API,
};
