/**
 * Tests pour le module validation.js
 */
import { describe, it, expect } from 'vitest';
import {
  botControlSchema,
  apiKeysSchema,
  telegramSchema,
  executeSchema,
  validate,
  validateBody,
} from '../validation';

describe('validation schemas', () => {
  describe('botControlSchema', () => {
    it('should accept valid start action', () => {
      const result = validate(botControlSchema, { action: 'start' });
      expect(result.success).toBe(true);
    });

    it('should accept valid stop action', () => {
      const result = validate(botControlSchema, { action: 'stop' });
      expect(result.success).toBe(true);
    });

    it('should accept valid reset with initialBalance', () => {
      const result = validate(botControlSchema, {
        action: 'reset',
        initialBalance: 5000,
      });
      expect(result.success).toBe(true);
    });

    it('should accept valid config action', () => {
      const result = validate(botControlSchema, {
        action: 'config',
        config: {
          enabled: true,
          mode: 'paper',
          maxPositionUSD: 500,
          maxConcurrentSpreads: 5,
          minQualityStars: 3,
          minWinRate: 0.55,
          zEntryThreshold: 1.8,
          stopLossPercent: 15,
          activeUniverses: ['l2', 'defi'],
        },
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid action', () => {
      const result = validate(botControlSchema, { action: 'invalid' });
      expect(result.success).toBe(false);
    });

    it('should reject invalid mode', () => {
      const result = validate(botControlSchema, {
        action: 'config',
        config: { mode: 'invalid' },
      });
      expect(result.success).toBe(false);
    });

    it('should reject negative position size', () => {
      const result = validate(botControlSchema, {
        action: 'config',
        config: { maxPositionUSD: -100 },
      });
      expect(result.success).toBe(false);
    });

    it('should reject too high position size', () => {
      const result = validate(botControlSchema, {
        action: 'config',
        config: { maxPositionUSD: 500000 },
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid quality stars', () => {
      const result = validate(botControlSchema, {
        action: 'config',
        config: { minQualityStars: 6 },
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid universe', () => {
      const result = validate(botControlSchema, {
        action: 'config',
        config: { activeUniverses: ['invalid'] },
      });
      expect(result.success).toBe(false);
    });
  });

  describe('apiKeysSchema', () => {
    it('should accept valid configure action', () => {
      const result = validate(apiKeysSchema, {
        action: 'configure',
        apiKey: 'my-api-key',
        apiSecret: 'my-secret',
        walletAddress: '0x1234567890123456789012345678901234567890',
      });
      expect(result.success).toBe(true);
    });

    it('should accept valid test action', () => {
      const result = validate(apiKeysSchema, {
        action: 'test',
        apiKey: 'key',
        apiSecret: 'secret',
        walletAddress: '0xabcdef1234567890abcdef1234567890abcdef12',
      });
      expect(result.success).toBe(true);
    });

    it('should accept valid set-mode action', () => {
      const result = validate(apiKeysSchema, {
        action: 'set-mode',
        mode: 'live',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid wallet address format', () => {
      const result = validate(apiKeysSchema, {
        action: 'configure',
        apiKey: 'key',
        apiSecret: 'secret',
        walletAddress: 'invalid-address',
      });
      expect(result.success).toBe(false);
    });

    it('should reject wallet address too short', () => {
      const result = validate(apiKeysSchema, {
        action: 'configure',
        walletAddress: '0x123',
      });
      expect(result.success).toBe(false);
    });

    it('should reject wallet address too long', () => {
      const result = validate(apiKeysSchema, {
        action: 'configure',
        walletAddress: '0x' + 'a'.repeat(50),
      });
      expect(result.success).toBe(false);
    });
  });

  describe('telegramSchema', () => {
    it('should accept valid configure action', () => {
      const result = validate(telegramSchema, {
        action: 'configure',
        botToken: '123456789:ABCdefGHIjklMNOpqrsTUVwxyz_123',
        chatId: '123456789',
      });
      expect(result.success).toBe(true);
    });

    it('should accept negative chat ID (group)', () => {
      const result = validate(telegramSchema, {
        action: 'configure',
        chatId: '-100123456789',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid bot token format', () => {
      const result = validate(telegramSchema, {
        action: 'configure',
        botToken: 'invalid-token-format',
      });
      expect(result.success).toBe(false);
    });

    it('should reject non-numeric chat ID', () => {
      const result = validate(telegramSchema, {
        action: 'configure',
        chatId: 'abc123',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('executeSchema', () => {
    it('should accept valid spread execution', () => {
      const result = validate(executeSchema, {
        pairId: 'ETH-BTC',
        coinA: 'ETH',
        coinB: 'BTC',
        signal: 'LONG',
        sizeUSD: 100,
      });
      expect(result.success).toBe(true);
    });

    it('should accept without sizeUSD', () => {
      const result = validate(executeSchema, {
        pairId: 'ARB-OP',
        coinA: 'ARB',
        coinB: 'OP',
        signal: 'SHORT',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid signal', () => {
      const result = validate(executeSchema, {
        pairId: 'ETH-BTC',
        coinA: 'ETH',
        coinB: 'BTC',
        signal: 'BUY',
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing required fields', () => {
      const result = validate(executeSchema, {
        pairId: 'ETH-BTC',
      });
      expect(result.success).toBe(false);
    });

    it('should reject negative size', () => {
      const result = validate(executeSchema, {
        pairId: 'ETH-BTC',
        coinA: 'ETH',
        coinB: 'BTC',
        signal: 'LONG',
        sizeUSD: -100,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('validate helper', () => {
    it('should return success with parsed data', () => {
      const result = validate(botControlSchema, { action: 'start' });
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ action: 'start' });
    });

    it('should return error message on failure', () => {
      const result = validate(botControlSchema, { action: 'invalid' });
      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
      expect(typeof result.error).toBe('string');
    });
  });

  describe('validateBody helper', () => {
    it('should work same as validate', () => {
      const result = validateBody(botControlSchema, { action: 'stop' });
      expect(result.success).toBe(true);
      expect(result.data.action).toBe('stop');
    });
  });
});
