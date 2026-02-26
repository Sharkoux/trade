/**
 * Schémas de validation Zod pour les API
 */

const { z } = require('zod');

// ============ BOT CONTROL ============

const botControlSchema = z.object({
  action: z.enum(['start', 'stop', 'reset', 'config', 'close-spread', 'close-all']),
  initialBalance: z.number().positive().optional(),
  spreadId: z.string().optional(),
  reason: z.string().optional(),
  config: z.object({
    enabled: z.boolean().optional(),
    mode: z.enum(['paper', 'live']).optional(),
    maxPositionUSD: z.number().positive().max(100000).optional(),
    maxConcurrentSpreads: z.number().int().positive().max(20).optional(),
    minQualityStars: z.number().int().min(0).max(5).optional(),
    minWinRate: z.number().min(0).max(1).optional(),
    zEntryThreshold: z.number().positive().max(5).optional(),
    zExitThreshold: z.number().positive().max(5).optional(),
    stopLossPercent: z.number().positive().max(100).optional(),
    activeUniverses: z.array(z.enum(['l2', 'dex', 'bluechips', 'defi', 'ai', 'meme'])).optional(),
  }).optional(),
});

// ============ API KEYS ============

const apiKeysSchema = z.object({
  action: z.enum(['test', 'configure', 'remove', 'set-mode']),
  apiKey: z.string().min(1).optional(),
  apiSecret: z.string().min(1).optional(),
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Adresse wallet invalide').optional(),
  mode: z.enum(['paper', 'live']).optional(),
});

// ============ TELEGRAM ============

const telegramSchema = z.object({
  action: z.enum(['test', 'configure', 'enable', 'disable']),
  botToken: z.string().regex(/^\d+:[A-Za-z0-9_-]+$/, 'Format token invalide').optional(),
  chatId: z.string().regex(/^-?\d+$/, 'Chat ID invalide').optional(),
});

// ============ EXECUTE ============

const executeSchema = z.object({
  pairId: z.string().min(1),
  coinA: z.string().min(1),
  coinB: z.string().min(1),
  signal: z.enum(['LONG', 'SHORT']),
  sizeUSD: z.number().positive().max(100000).optional(),
});

// ============ OPTIMIZE ============

const optimizeSchema = z.object({
  action: z.enum(['optimize', 'get', 'clear', 'clear-all']).optional(),
  pairId: z.string().optional(),
  coinA: z.string().optional(),
  coinB: z.string().optional(),
});

// ============ SCAN ============

const scanQuerySchema = z.object({
  universe: z.enum(['l2', 'dex', 'bluechips', 'defi', 'ai', 'meme', 'all']).optional(),
  minQuality: z.coerce.number().int().min(0).max(5).optional(),
  activeOnly: z.coerce.boolean().optional(),
});

// ============ HYPERLIQUID ============

const candlesQuerySchema = z.object({
  coin: z.string().min(1),
  interval: z.enum(['1m', '5m', '15m', '1h', '4h', '1d']).optional(),
  limit: z.coerce.number().int().positive().max(5000).optional(),
});

const positionsQuerySchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Adresse invalide'),
});

// ============ HELPERS ============

/**
 * Valide les données avec un schéma Zod
 * @param {z.ZodSchema} schema - Schéma de validation
 * @param {any} data - Données à valider
 * @returns {{ success: boolean, data?: any, error?: string }}
 */
function validate(schema, data) {
  try {
    const result = schema.parse(data);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
      return { success: false, error: messages.join(', ') };
    }
    return { success: false, error: 'Validation error' };
  }
}

/**
 * Middleware de validation pour Next.js API routes
 * @param {z.ZodSchema} schema - Schéma de validation
 * @returns {Function} Middleware function
 */
function validateRequest(schema) {
  return (handler) => async (req, res) => {
    const dataToValidate = req.method === 'GET' ? req.query : req.body;
    const result = validate(schema, dataToValidate);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    // Attache les données validées
    req.validated = result.data;
    return handler(req, res);
  };
}

/**
 * Helper pour valider dans le handler
 */
function validateBody(schema, body) {
  return validate(schema, body);
}

function validateQuery(schema, query) {
  return validate(schema, query);
}

module.exports = {
  // Schemas
  botControlSchema,
  apiKeysSchema,
  telegramSchema,
  executeSchema,
  optimizeSchema,
  scanQuerySchema,
  candlesQuerySchema,
  positionsQuerySchema,
  // Helpers
  validate,
  validateRequest,
  validateBody,
  validateQuery,
  // Re-export zod pour usage externe
  z,
};
