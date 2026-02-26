/**
 * Tests pour le module crypto.js
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { encrypt, decrypt, isEncrypted, hash, generateToken } from '../crypto';

describe('crypto', () => {
  describe('encrypt/decrypt', () => {
    it('should encrypt and decrypt a string', () => {
      const plaintext = 'my-secret-api-key-12345';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should return different ciphertext for same plaintext', () => {
      const plaintext = 'same-text';
      const encrypted1 = encrypt(plaintext);
      const encrypted2 = encrypt(plaintext);

      // Due to random IV, ciphertext should be different
      expect(encrypted1).not.toBe(encrypted2);

      // But both should decrypt to same value
      expect(decrypt(encrypted1)).toBe(plaintext);
      expect(decrypt(encrypted2)).toBe(plaintext);
    });

    it('should handle empty string', () => {
      const encrypted = encrypt('');
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe('');
    });

    it('should handle special characters', () => {
      const plaintext = 'api-key!@#$%^&*()_+-=[]{}|;:,.<>?';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('should handle unicode characters', () => {
      const plaintext = 'clé-secrète-日本語-🔐';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('should handle long strings', () => {
      const plaintext = 'x'.repeat(10000);
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('should return null for null input', () => {
      expect(encrypt(null)).toBeNull();
      expect(decrypt(null)).toBeNull();
    });

    it('should handle non-encrypted strings gracefully', () => {
      const plaintext = 'not-encrypted-text';
      const result = decrypt(plaintext);
      // Should return original text if not encrypted format
      expect(result).toBe(plaintext);
    });
  });

  describe('isEncrypted', () => {
    it('should return true for encrypted string', () => {
      const encrypted = encrypt('test');
      expect(isEncrypted(encrypted)).toBe(true);
    });

    it('should return false for plain string', () => {
      expect(isEncrypted('plain-text')).toBe(false);
    });

    it('should return false for null/undefined', () => {
      expect(isEncrypted(null)).toBe(false);
      expect(isEncrypted(undefined)).toBe(false);
    });

    it('should return false for non-string', () => {
      expect(isEncrypted(123)).toBe(false);
      expect(isEncrypted({})).toBe(false);
    });

    it('should return false for string with wrong format', () => {
      expect(isEncrypted('only:two:parts:but-invalid-base64-!!!')).toBe(false);
    });
  });

  describe('hash', () => {
    it('should return SHA-256 hash', () => {
      const result = hash('test');
      // SHA-256 produces 64 hex characters
      expect(result).toHaveLength(64);
      expect(/^[a-f0-9]+$/.test(result)).toBe(true);
    });

    it('should be deterministic', () => {
      const hash1 = hash('same-input');
      const hash2 = hash('same-input');
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different inputs', () => {
      const hash1 = hash('input1');
      const hash2 = hash('input2');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('generateToken', () => {
    it('should generate token of correct length', () => {
      const token = generateToken(16);
      // 16 bytes = 32 hex characters
      expect(token).toHaveLength(32);
    });

    it('should default to 32 bytes (64 hex chars)', () => {
      const token = generateToken();
      expect(token).toHaveLength(64);
    });

    it('should generate unique tokens', () => {
      const tokens = new Set();
      for (let i = 0; i < 100; i++) {
        tokens.add(generateToken());
      }
      expect(tokens.size).toBe(100);
    });

    it('should only contain hex characters', () => {
      const token = generateToken();
      expect(/^[a-f0-9]+$/.test(token)).toBe(true);
    });
  });
});
