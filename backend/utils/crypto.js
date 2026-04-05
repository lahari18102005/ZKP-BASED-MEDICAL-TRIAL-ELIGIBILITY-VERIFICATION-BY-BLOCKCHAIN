const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const keysDir = path.join(__dirname, '..', 'keys');
const privateKeyPath = path.join(keysDir, 'private.key');
const publicKeyPath = path.join(keysDir, 'public.key');

// Revocation storage (in-memory)
const revokedCredentials = new Set();

// Nonce storage (in-memory) for replay protection
const usedNonces = new Set();

function ensureKeysExist() {
  if (!fs.existsSync(keysDir)) {
    fs.mkdirSync(keysDir, { recursive: true });
  }

  if (!fs.existsSync(privateKeyPath) || !fs.existsSync(publicKeyPath)) {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });

    fs.writeFileSync(privateKeyPath, privateKey);
    fs.writeFileSync(publicKeyPath, publicKey);
    console.log('Medical Authority keys generated successfully');
  }
}

function getPrivateKey() {
  ensureKeysExist();
  return fs.readFileSync(privateKeyPath, 'utf8');
}

function getPublicKey() {
  ensureKeysExist();
  return fs.readFileSync(publicKeyPath, 'utf8');
}

/**
 * Derive encryption key from password using PBKDF2
 * @param {string} password - Doctor's password
 * @param {string} salt - Salt for key derivation (base64 encoded)
 * @returns {Object} - { key: Buffer, salt: string }
 */
function deriveKeyFromPassword(password, salt = null) {
  const iterations = 100000;
  const keyLength = 32; // 256 bits for AES-256
  const digest = 'sha256';
  
  // Generate or use provided salt
  const saltBuffer = salt ? Buffer.from(salt, 'base64') : crypto.randomBytes(32);
  
  const derivedKey = crypto.pbkdf2Sync(password, saltBuffer, iterations, keyLength, digest);
  
  return {
    key: derivedKey,
    salt: saltBuffer.toString('base64')
  };
}

/**
 * Encrypt JSON data using AES-256-GCM
 * @param {Object} data - Data to encrypt
 * @param {string} password - Doctor's password for key derivation
 * @returns {Object} - { encrypted: string, iv: string, authTag: string, salt: string }
 */
function encryptCredential(data, password) {
  const { key, salt } = deriveKeyFromPassword(password);
  
  // Generate random IV
  const iv = crypto.randomBytes(16);
  
  // Create cipher
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  // Encrypt data
  const jsonString = JSON.stringify(data);
  let encrypted = cipher.update(jsonString, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  // Get authentication tag
  const authTag = cipher.getAuthTag();
  
  return {
    encrypted: encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    salt: salt
  };
}

/**
 * Decrypt JSON data using AES-256-GCM
 * @param {Object} encryptedData - { encrypted, iv, authTag, salt }
 * @param {string} password - Doctor's password
 * @returns {Object} - Decrypted credential object
 */
function decryptCredential(encryptedData, password) {
  try {
    const { encrypted, iv, authTag, salt } = encryptedData;
    
    // Derive key using provided salt
    const { key } = deriveKeyFromPassword(password, salt);
    
    // Create decipher
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'));
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    
    // Decrypt
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return JSON.parse(decrypted);
  } catch (error) {
    throw new Error(`Decryption failed: ${error.message}`);
  }
}

/**
 * Create a secure credential with encryption
 * @param {Object} credentialData - Credential data to secure
 * @param {string} password - Doctor's password for encryption
 * @param {string} doctorEmail - Doctor's email
 * @returns {Object} - { credentialId, encryptedData, signature }
 */
function createSecureCredential(credentialData, password, doctorEmail) {
  // Generate credential ID (UUID)
  const credentialId = uuidv4();
  
  // Generate nonce for replay protection
  const nonce = crypto.randomBytes(16).toString('hex');
  
  // Create credential object
  const credential = {
    credential_id: credentialId,
    patient_id: crypto.createHash('sha256').update(credentialData.patientName + credentialData.patientDOB).digest('hex'),
    eligibility: credentialData.eligibility,
    medical_data: {
      test_types: credentialData.testTypes || (credentialData.testType ? [credentialData.testType] : []),
      checklist_results: credentialData.checklistResults || {},
      eligibility_by_test: credentialData.eligibilityByTest || {},
      last_done_date: credentialData.lastDoneDate || null,
      risk_level: credentialData.riskLevel || 'normal',
      additional_notes: credentialData.additionalNotes || ''
    },
    issued_at: new Date().toISOString(),
    expiry: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days
    nonce: nonce,
    issuer_email: doctorEmail
  };
  
  // Hash the credential for signing
  const credentialHash = crypto.createHash('sha256').update(JSON.stringify(credential)).digest('hex');
  
  // Sign the hash using doctor's private key
  const privateKey = getPrivateKey();
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(credentialHash);
  const signature = sign.sign(privateKey, 'base64');
  
  // Encrypt the credential
  const encryptedData = encryptCredential(credential, password);
  
  return {
    credentialId,
    credentialHash,
    encryptedData,
    signature
  };
}

/**
 * Verify and decrypt a secure credential
 * @param {Object} credentialPackage - { credentialHash, encryptedData, signature, password }
 * @returns {Object} - { credential, isValid, verification }
 */
function verifyAndDecryptCredential(credentialPackage) {
  const { credentialHash, encryptedData, signature, password } = credentialPackage;
  
  try {
    // Verify signature using doctor's public key
    const publicKey = getPublicKey();
    const verify = crypto.createVerify('RSA-SHA256');
    verify.update(credentialHash);
    const signatureValid = verify.verify(publicKey, signature, 'base64');
    
    if (!signatureValid) {
      return {
        credential: null,
        isValid: false,
        verification: { status: 'invalid', reason: 'Invalid RSA signature' }
      };
    }
    
    // Decrypt credential
    const credential = decryptCredential(encryptedData, password);
    
    // Check if credential is revoked
    if (revokedCredentials.has(credential.credential_id)) {
      return {
        credential,
        isValid: false,
        verification: { status: 'revoked', reason: 'Credential has been revoked' }
      };
    }
    
    // Check if credential has expired
    const expiryDate = new Date(credential.expiry);
    if (new Date() > expiryDate) {
      return {
        credential,
        isValid: false,
        verification: { status: 'expired', reason: 'Credential has expired' }
      };
    }
    
    // Replay protection - check if nonce was already used
    if (usedNonces.has(credential.nonce)) {
      return {
        credential,
        isValid: false,
        verification: { status: 'invalid', reason: 'Nonce replay detected' }
      };
    }
    
    // Mark nonce as used
    usedNonces.add(credential.nonce);
    
    return {
      credential,
      isValid: true,
      verification: { 
        status: 'valid',
        eligibility: credential.eligibility,
        issued_at: credential.issued_at,
        expiry: credential.expiry
      }
    };
  } catch (error) {
    return {
      credential: null,
      isValid: false,
      verification: { status: 'error', reason: error.message }
    };
  }
}

/**
 * Revoke a credential by its ID
 * @param {string} credentialId - Credential ID to revoke
 */
function revokeCredential(credentialId) {
  revokedCredentials.add(credentialId);
  return { success: true, message: `Credential ${credentialId} has been revoked` };
}

/**
 * Check if a credential is revoked
 * @param {string} credentialId - Credential ID to check
 * @returns {boolean}
 */
function isCredentialRevoked(credentialId) {
  return revokedCredentials.has(credentialId);
}

function signEligibilityResult(eligibilityData) {
  const privateKey = getPrivateKey();
  const dataString = JSON.stringify(eligibilityData);
  
  const sign = crypto.createSign('SHA256');
  sign.update(dataString);
  sign.end();
  
  const signature = sign.sign(privateKey, 'base64');
  
  return {
    ...eligibilityData,
    signature,
    timestamp: new Date().toISOString(),
    issuer: 'Medical Authority'
  };
}

function verifySignature(signedData) {
  const { signature, timestamp, issuer, ...eligibilityData } = signedData;
  const publicKey = getPublicKey();
  const dataString = JSON.stringify(eligibilityData);
  
  const verify = crypto.createVerify('SHA256');
  verify.update(dataString);
  verify.end();
  
  return verify.verify(publicKey, signature, 'base64');
}

/**
 * Sign data using RSA private key
 * @param {Object|string} data - Data to sign
 * @returns {string} - Base64 encoded signature
 */
function signData(data) {
  const privateKey = getPrivateKey();
  const dataString = typeof data === 'string' ? data : JSON.stringify(data);
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(dataString);
  return sign.sign(privateKey, 'base64');
}

/**
 * Verify signature using RSA public key
 * @param {Object|string} data - Original data
 * @param {string} signature - Base64 encoded signature
 * @returns {boolean} - True if signature is valid
 */
function verifyDataSignature(data, signature) {
  try {
    const publicKey = getPublicKey();
    const dataString = typeof data === 'string' ? data : JSON.stringify(data);
    const verify = crypto.createVerify('RSA-SHA256');
    verify.update(dataString);
    return verify.verify(publicKey, signature, 'base64');
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

/**
 * Create a signed JWT token
 * @param {Object} payload - JWT payload
 * @returns {Object} - Token and signature
 */
function createSignedToken(payload) {
  const token = jwt.sign(payload, process.env.JWT_SECRET || 'fallback_secret', { expiresIn: '8h' });
  const decoded = jwt.decode(token);
  const signature = signData({ token, timestamp: decoded.iat * 1000 });
  return { token, signature };
}

/**
 * Verify a signed JWT token
 * @param {string} token - JWT token
 * @param {string} signature - RSA signature
 * @returns {Object} - Decoded payload if valid
 */
function verifySignedToken(token, signature) {
  try {
    // First verify the JWT to get the timestamp from the token itself
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    
    // Then verify the RSA signature with the same data structure
    const isSignatureValid = verifyDataSignature({ token, timestamp: decoded.iat * 1000 }, signature);
    if (!isSignatureValid) {
      throw new Error('Invalid digital signature');
    }

    return decoded;
  } catch (error) {
    throw new Error(`Token verification failed: ${error.message}`);
  }
}

module.exports = {
  signEligibilityResult,
  verifySignature,
  ensureKeysExist,
  signData,
  verifyDataSignature,
  createSignedToken,
  verifySignedToken,
  getPrivateKey,
  getPublicKey,
  deriveKeyFromPassword,
  encryptCredential,
  decryptCredential,
  createSecureCredential,
  verifyAndDecryptCredential,
  revokeCredential,
  isCredentialRevoked
};
