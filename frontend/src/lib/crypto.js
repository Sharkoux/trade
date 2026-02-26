/**
 * Module de chiffrement pour les credentials sensibles
 * Utilise AES-256-GCM pour le chiffrement symétrique
 */

const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

// Chemin du fichier de clé
const KEY_FILE = process.env.ENCRYPTION_KEY_FILE || path.join(process.cwd(), 'data', '.encryption_key');

/**
 * Génère ou récupère la clé de chiffrement
 * La clé est stockée dans un fichier séparé pour plus de sécurité
 */
function getEncryptionKey() {
  // Priorité 1: Variable d'environnement
  if (process.env.ENCRYPTION_KEY) {
    const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
    if (key.length === KEY_LENGTH) {
      return key;
    }
    console.warn('ENCRYPTION_KEY invalide, utilisation de la clé fichier');
  }

  // Priorité 2: Fichier de clé
  const dataDir = path.dirname(KEY_FILE);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (fs.existsSync(KEY_FILE)) {
    const keyHex = fs.readFileSync(KEY_FILE, 'utf8').trim();
    return Buffer.from(keyHex, 'hex');
  }

  // Génère une nouvelle clé
  const newKey = crypto.randomBytes(KEY_LENGTH);
  fs.writeFileSync(KEY_FILE, newKey.toString('hex'), { mode: 0o600 });
  console.log('Nouvelle clé de chiffrement générée');
  return newKey;
}

let encryptionKey = null;

function getKey() {
  if (!encryptionKey) {
    encryptionKey = getEncryptionKey();
  }
  return encryptionKey;
}

/**
 * Chiffre une chaîne de caractères
 * @param {string} plaintext - Texte à chiffrer
 * @returns {string} Texte chiffré (format: iv:authTag:ciphertext en base64)
 */
function encrypt(plaintext) {
  if (!plaintext) return null;

  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:ciphertext (tout en base64)
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

/**
 * Déchiffre une chaîne de caractères
 * @param {string} ciphertext - Texte chiffré (format: iv:authTag:ciphertext)
 * @returns {string} Texte déchiffré
 */
function decrypt(ciphertext) {
  if (!ciphertext) return null;

  // Vérifie si le texte est chiffré (contient le format attendu)
  if (!ciphertext.includes(':')) {
    // Texte non chiffré (migration depuis anciennes données)
    return ciphertext;
  }

  try {
    const key = getKey();
    const parts = ciphertext.split(':');

    if (parts.length !== 3) {
      // Format invalide, retourne tel quel (données non chiffrées)
      return ciphertext;
    }

    const iv = Buffer.from(parts[0], 'base64');
    const authTag = Buffer.from(parts[1], 'base64');
    const encrypted = parts[2];

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    // En cas d'erreur de déchiffrement, retourne le texte original
    // Cela permet la migration depuis des données non chiffrées
    console.warn('Erreur de déchiffrement, texte peut-être non chiffré:', error.message);
    return ciphertext;
  }
}

/**
 * Vérifie si une chaîne est chiffrée
 * @param {string} text - Texte à vérifier
 * @returns {boolean}
 */
function isEncrypted(text) {
  if (!text || typeof text !== 'string') return false;
  const parts = text.split(':');
  if (parts.length !== 3) return false;

  try {
    // Vérifie que les parties sont du base64 valide
    Buffer.from(parts[0], 'base64');
    Buffer.from(parts[1], 'base64');
    return true;
  } catch {
    return false;
  }
}

/**
 * Hash une chaîne (pour comparaison sans déchiffrement)
 * @param {string} text - Texte à hasher
 * @returns {string} Hash SHA-256
 */
function hash(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

/**
 * Génère un token aléatoire
 * @param {number} length - Longueur en bytes
 * @returns {string} Token en hexadécimal
 */
function generateToken(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

module.exports = {
  encrypt,
  decrypt,
  isEncrypted,
  hash,
  generateToken,
  getKey,
};
