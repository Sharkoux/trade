/**
 * Tests pour le module scoring.js
 */
import { describe, it, expect } from 'vitest';
import {
  calculateScore,
  sortByScore,
  filterPairs,
  getTopPairs,
  calculateGlobalStats,
} from '../scoring';

describe('scoring', () => {
  describe('calculateScore', () => {
    it('should return 0 for empty pair', () => {
      expect(calculateScore({})).toBe(0);
    });

    it('should add 20 points per quality star', () => {
      expect(calculateScore({ qualityStars: 1 })).toBeGreaterThanOrEqual(20);
      expect(calculateScore({ qualityStars: 5 })).toBeGreaterThanOrEqual(100);
    });

    it('should add bonus for active signal (z > 1.5)', () => {
      const withSignal = calculateScore({ zScore: 2.0 });
      const withoutSignal = calculateScore({ zScore: 1.0 });
      expect(withSignal).toBeGreaterThan(withoutSignal);
    });

    it('should add extra bonus for optimal z-score range (1.5-2.5)', () => {
      const optimal = calculateScore({ zScore: 2.0 });
      const tooHigh = calculateScore({ zScore: 3.0 });
      // Les deux ont le bonus de signal actif, mais optimal a +10
      expect(optimal).toBeGreaterThan(tooHigh);
    });

    it('should add points for win rate', () => {
      const highWinRate = calculateScore({ winRate: 0.8 });
      const lowWinRate = calculateScore({ winRate: 0.2 });
      expect(highWinRate).toBeGreaterThan(lowWinRate);
    });

    it('should add points for positive return', () => {
      const positive = calculateScore({ avgReturn: 5 });
      const negative = calculateScore({ avgReturn: -5 });
      expect(positive).toBeGreaterThan(negative);
    });

    it('should penalize high drawdown', () => {
      const lowDrawdown = calculateScore({ maxDrawdown: 10 });
      const highDrawdown = calculateScore({ maxDrawdown: 60 });
      expect(lowDrawdown).toBeGreaterThan(highDrawdown);
    });

    it('should penalize high risk score', () => {
      const lowRisk = calculateScore({ riskScore: 1 });
      const highRisk = calculateScore({ riskScore: 10 });
      expect(lowRisk).toBeGreaterThan(highRisk);
    });

    it('should bonus high correlation', () => {
      const highCorr = calculateScore({ corr: 0.9 });
      const lowCorr = calculateScore({ corr: 0.3 });
      expect(highCorr).toBeGreaterThan(lowCorr);
    });

    it('should normalize score between 0 and 100', () => {
      // Pair with very negative factors
      const badPair = {
        qualityStars: 0,
        zScore: 0,
        winRate: 0,
        avgReturn: -50,
        maxDrawdown: 80,
        riskScore: 10,
        corr: 0.2,
      };

      // Pair with very positive factors
      const goodPair = {
        qualityStars: 5,
        zScore: 2.0,
        winRate: 1.0,
        avgReturn: 20,
        maxDrawdown: 5,
        riskScore: 1,
        corr: 0.95,
      };

      expect(calculateScore(badPair)).toBeGreaterThanOrEqual(0);
      expect(calculateScore(goodPair)).toBeLessThanOrEqual(100);
    });

    it('should calculate realistic score for typical pair', () => {
      const typicalPair = {
        qualityStars: 4,
        zScore: 1.8,
        winRate: 0.65,
        avgReturn: 2.5,
        maxDrawdown: 15,
        riskScore: 5,
        corr: 0.75,
      };

      const score = calculateScore(typicalPair);
      expect(score).toBeGreaterThan(50);
      expect(score).toBeLessThan(100);
    });
  });

  describe('sortByScore', () => {
    it('should sort pairs by score descending', () => {
      const pairs = [
        { qualityStars: 2, coinA: 'A', coinB: 'B' },
        { qualityStars: 5, coinA: 'C', coinB: 'D' },
        { qualityStars: 3, coinA: 'E', coinB: 'F' },
      ];

      const sorted = sortByScore(pairs);

      expect(sorted[0].qualityStars).toBe(5);
      expect(sorted[1].qualityStars).toBe(3);
      expect(sorted[2].qualityStars).toBe(2);
    });

    it('should add score property to each pair', () => {
      const pairs = [{ qualityStars: 3 }];
      const sorted = sortByScore(pairs);

      expect(sorted[0]).toHaveProperty('score');
      expect(typeof sorted[0].score).toBe('number');
    });

    it('should not mutate original array', () => {
      const pairs = [{ qualityStars: 2 }, { qualityStars: 5 }];
      const original = [...pairs];

      sortByScore(pairs);

      expect(pairs[0].qualityStars).toBe(original[0].qualityStars);
      expect(pairs[1].qualityStars).toBe(original[1].qualityStars);
    });
  });

  describe('filterPairs', () => {
    const testPairs = [
      { qualityStars: 5, zScore: 2.0, universe: 'defi' },
      { qualityStars: 3, zScore: 1.0, universe: 'l2' },
      { qualityStars: 4, zScore: 1.8, universe: 'defi' },
      { qualityStars: 2, zScore: 0.5, universe: 'meme' },
    ];

    it('should filter by minimum quality', () => {
      const filtered = filterPairs(testPairs, { minQuality: 4 });
      expect(filtered).toHaveLength(2);
      expect(filtered.every(p => p.qualityStars >= 4)).toBe(true);
    });

    it('should filter active signals only', () => {
      const filtered = filterPairs(testPairs, { activeOnly: true });
      expect(filtered).toHaveLength(2);
      expect(filtered.every(p => Math.abs(p.zScore) > 1.5)).toBe(true);
    });

    it('should filter by universe', () => {
      const filtered = filterPairs(testPairs, { universe: 'defi' });
      expect(filtered).toHaveLength(2);
      expect(filtered.every(p => p.universe === 'defi')).toBe(true);
    });

    it('should combine multiple filters', () => {
      const filtered = filterPairs(testPairs, {
        minQuality: 4,
        activeOnly: true,
      });
      expect(filtered).toHaveLength(2);
    });

    it('should return all pairs with no filters', () => {
      const filtered = filterPairs(testPairs, {});
      expect(filtered).toHaveLength(4);
    });

    it('should handle universe=all', () => {
      const filtered = filterPairs(testPairs, { universe: 'all' });
      expect(filtered).toHaveLength(4);
    });
  });

  describe('getTopPairs', () => {
    it('should return top N pairs', () => {
      const pairs = [
        { qualityStars: 2 },
        { qualityStars: 5 },
        { qualityStars: 3 },
        { qualityStars: 4 },
        { qualityStars: 1 },
      ];

      const top3 = getTopPairs(pairs, 3);

      expect(top3).toHaveLength(3);
      expect(top3[0].qualityStars).toBe(5);
      expect(top3[1].qualityStars).toBe(4);
      expect(top3[2].qualityStars).toBe(3);
    });

    it('should default to 5 pairs', () => {
      const pairs = Array(10).fill(null).map((_, i) => ({ qualityStars: i }));
      const top = getTopPairs(pairs);
      expect(top).toHaveLength(5);
    });

    it('should return all pairs if less than N', () => {
      const pairs = [{ qualityStars: 3 }, { qualityStars: 4 }];
      const top5 = getTopPairs(pairs, 5);
      expect(top5).toHaveLength(2);
    });
  });

  describe('calculateGlobalStats', () => {
    it('should count active signals', () => {
      const pairs = [
        { zScore: 2.0 },
        { zScore: 1.0 },
        { zScore: -1.8 },
      ];

      const stats = calculateGlobalStats(pairs);
      expect(stats.activeSignals).toBe(2);
    });

    it('should calculate average win rate from top 10', () => {
      const pairs = Array(15).fill(null).map((_, i) => ({
        qualityStars: i,
        winRate: 0.5 + i * 0.02,
      }));

      const stats = calculateGlobalStats(pairs);
      expect(stats.avgWinRate).toBeGreaterThan(0);
    });

    it('should calculate average return from top 10', () => {
      const pairs = Array(15).fill(null).map((_, i) => ({
        qualityStars: i,
        avgReturn: i * 0.5,
      }));

      const stats = calculateGlobalStats(pairs);
      expect(parseFloat(stats.avgReturn)).toBeGreaterThan(0);
    });

    it('should identify best pair', () => {
      const pairs = [
        { qualityStars: 3, coinA: 'ETH', coinB: 'BTC' },
        { qualityStars: 5, coinA: 'ARB', coinB: 'OP' },
      ];

      const stats = calculateGlobalStats(pairs);
      expect(stats.bestPair).toBe('ARB/OP');
    });

    it('should handle empty array', () => {
      const stats = calculateGlobalStats([]);
      expect(stats.activeSignals).toBe(0);
      expect(stats.avgWinRate).toBe(0);
      expect(stats.bestPair).toBe('-');
    });
  });
});
