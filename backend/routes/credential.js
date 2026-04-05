const express = require('express');
const { body, validationResult } = require('express-validator');
const {
  verifyAndDecryptCredential,
  revokeCredential,
  isCredentialRevoked
} = require('../utils/crypto');

const router = express.Router();

/**
 * POST /api/credential/decrypt
 * Decrypt and verify a credential
 * Body: { credentialHash, encryptedData, signature, password }
 */
router.post(
  '/decrypt',
  [
    body('credentialHash').notEmpty().withMessage('Credential hash is required'),
    body('encryptedData').notEmpty().withMessage('Encrypted data is required'),
    body('signature').notEmpty().withMessage('Signature is required'),
    body('password').notEmpty().withMessage('Password is required')
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { credentialHash, encryptedData, signature, password } = req.body;

      // Verify signature and decrypt
      const result = verifyAndDecryptCredential({
        credentialHash,
        encryptedData,
        signature,
        password
      });

      if (!result.isValid) {
        return res.status(400).json({
          success: false,
          message: 'Credential verification failed',
          verification: result.verification
        });
      }

      // Return verified credential
      return res.json({
        success: true,
        message: 'Credential verified successfully',
        credential: result.credential,
        verification: result.verification
      });
    } catch (error) {
      console.error('Credential decryption error:', error);
      return res.status(500).json({
        success: false,
        message: 'Decryption error: ' + error.message
      });
    }
  }
);

/**
 * POST /api/credential/revoke
 * Revoke a credential by ID
 * Body: { credentialId }
 */
router.post(
  '/revoke',
  [
    body('credentialId').notEmpty().withMessage('Credential ID is required')
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { credentialId } = req.body;

      // Check if already revoked
      if (isCredentialRevoked(credentialId)) {
        return res.status(400).json({
          success: false,
          message: 'Credential is already revoked'
        });
      }

      // Revoke the credential
      const result = revokeCredential(credentialId);

      return res.json({
        success: true,
        message: result.message,
        credentialId
      });
    } catch (error) {
      console.error('Credential revocation error:', error);
      return res.status(500).json({
        success: false,
        message: 'Revocation error: ' + error.message
      });
    }
  }
);

/**
 * GET /api/credential/status/:credentialId
 * Check if credential is revoked
 */
router.get('/status/:credentialId', (req, res) => {
  try {
    const { credentialId } = req.params;
    const revoked = isCredentialRevoked(credentialId);

    return res.json({
      success: true,
      credentialId,
      revoked,
      status: revoked ? 'revoked' : 'active'
    });
  } catch (error) {
    console.error('Status check error:', error);
    return res.status(500).json({
      success: false,
      message: 'Status check error: ' + error.message
    });
  }
});

module.exports = router;
