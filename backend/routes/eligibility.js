const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const AdmZip = require('adm-zip');
const { execFile } = require('child_process');
const os = require('os');
const fs = require('fs/promises');
const path = require('path');
const { path7za } = require('7zip-bin');
const doctors = require('../data/doctors');
const { authMiddleware } = require('../middleware/auth');
const { signEligibilityResult, createSecureCredential, verifyAndDecryptCredential } = require('../utils/crypto');

const router = express.Router();

async function createCredentialZipBuffer(credential, password) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'credential-zip-'));
  const fileName = `secure-credential-${credential.credentialId}.json`;
  const jsonPath = path.join(tempDir, fileName);
  const zipPath = path.join(tempDir, `secure-credential-${credential.credentialId}.zip`);
  const jsonPayload = JSON.stringify(credential, null, 2);

  try {
    await fs.writeFile(jsonPath, jsonPayload, 'utf8');

    await new Promise((resolve, reject) => {
      const args = [
        'a',
        '-tzip',
        `-p${password}`,
        '-mem=ZipCrypto',
        zipPath,
        jsonPath
      ];

      execFile(path7za, args, { windowsHide: true }, (err, stdout, stderr) => {
        if (err) {
          reject(new Error(stderr || err.message));
          return;
        }
        resolve();
      });
    });

    return await fs.readFile(zipPath);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

const testChecklists = {
  'Blood Donation': [
    'Hemoglobin level is normal',
    'No anemia',
    'No recent illness or fever',
    'Patient is healthy'
  ],
  'MRI Scan': [
    'No pacemaker',
    'No metal implant',
    'Not pregnant'
  ],
  'CT Scan': [
    'Not pregnant',
    'No contrast allergy',
    'No kidney problems'
  ]
};

router.get('/tests', authMiddleware, (req, res) => {
  const tests = Object.keys(testChecklists).map(name => ({
    name,
    checklist: testChecklists[name]
  }));
  res.json(tests);
});

router.post(
  '/check',
  authMiddleware,
  [
    body('testType').isIn(['Blood Donation', 'MRI Scan', 'CT Scan']).withMessage('Invalid test type'),
    body('checklistResults').isObject().withMessage('Checklist results must be an object'),
    body('patientId').optional().trim().escape()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { testType, checklistResults, patientId } = req.body;
    const requiredChecks = testChecklists[testType];

    const allChecked = requiredChecks.every(item => checklistResults[item] === true);

    const eligibilityData = {
      test: testType,
      eligible: allChecked,
      doctorId: req.doctor.doctorId,
      doctorName: req.doctor.name,
      patientId: patientId || 'ANONYMOUS',
      verifiedAt: new Date().toISOString()
    };

    const signedResult = signEligibilityResult(eligibilityData);

    res.json({
      success: true,
      signedResult
    });
  }
);

/**
 * POST /api/eligibility/secure-credential
 * Generate a secure, encrypted credential with RSA signature
 * Requires: password for encryption key derivation
 */
router.post(
  '/secure-credential',
  authMiddleware,
  [
    body('testTypes')
      .isArray({ min: 1 })
      .withMessage('At least one test is required')
      .custom((tests) => tests.every(test => ['Blood Donation', 'MRI Scan', 'CT Scan'].includes(test)))
      .withMessage('Invalid test type'),
    body('checklistResults').isObject().withMessage('Checklist results must be an object'),
    body('patientName').trim().notEmpty().withMessage('Patient name is required'),
    body('patientDOB').notEmpty().withMessage('Patient DOB is required'),
    body('password').notEmpty().withMessage('Password is required for encryption'),
    body('lastDoneDate').optional(),
    body('riskLevel').optional(),
    body('additionalNotes').optional(),
    body('eligibilityByTest').optional().isObject(),
    body('overallEligibility').optional().isBoolean()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { 
        testTypes, 
        checklistResults, 
        eligibilityByTest,
        overallEligibility,
        patientName, 
        patientDOB, 
        password,
        lastDoneDate,
        riskLevel,
        additionalNotes
      } = req.body;

      // Verify the provided password is the doctor's login password
      const doctor = doctors.find(d => d.email === req.doctor.email);
      if (!doctor) {
        return res.status(401).json({ message: 'Doctor not found' });
      }

      const isValidPassword = await bcrypt.compare(password, doctor.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: 'Invalid password. You must use your login password to secure the credential.' });
      }

      const normalizedEligibilityByTest = (testTypes || []).reduce((acc, testName) => {
        const requiredChecks = testChecklists[testName] || [];
        const testResults = (checklistResults && checklistResults[testName]) || {};
        const allChecked = requiredChecks.every(item => testResults[item] === true);
        acc[testName] = allChecked;
        return acc;
      }, {});

      const eligibility = typeof overallEligibility === 'boolean'
        ? overallEligibility
        : (testTypes || []).every((testName) => normalizedEligibilityByTest[testName]);

      // Prepare credential data
      const credentialData = {
        patientName,
        patientDOB,
        testTypes,
        checklistResults,
        eligibilityByTest: eligibilityByTest || normalizedEligibilityByTest,
        eligibility,
        lastDoneDate: lastDoneDate || null,
        riskLevel: riskLevel || 'normal',
        additionalNotes: additionalNotes || ''
      };

      // Create secure credential with AES-256 encryption and RSA signature
      const secureCredential = createSecureCredential(
        credentialData,
        password,
        req.doctor.email
      );

      res.json({
        success: true,
        message: 'Secure credential generated successfully',
        credential: {
          credentialId: secureCredential.credentialId,
          encryptedData: secureCredential.encryptedData,
          credentialHash: secureCredential.credentialHash,
          signature: secureCredential.signature,
          doctor: {
            email: req.doctor.email,
            name: req.doctor.name
          },
          generatedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Secure credential generation error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error generating secure credential: ' + error.message
      });
    }
  }
);

/**
 * POST /api/eligibility/secure-credential/zip
 * Download credential as a password-protected zip
 * Body: { credential, password }
 */
router.post(
  '/secure-credential/zip',
  authMiddleware,
  [
    body('credential').isObject().withMessage('Credential payload is required'),
    body('password').notEmpty().withMessage('Password is required')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { credential, password } = req.body;

      // Verify the provided password is the doctor's login password
      const doctor = doctors.find(d => d.email === req.doctor.email);
      if (!doctor) {
        return res.status(401).json({ message: 'Doctor not found' });
      }

      const isValidPassword = await bcrypt.compare(password, doctor.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: 'Invalid password. You must use your login password to secure the credential.' });
      }

      if (!credential || !credential.credentialId) {
        return res.status(400).json({ message: 'Invalid credential payload' });
      }

      const zipBuffer = await createCredentialZipBuffer(credential, password);
      const zipFileName = `secure-credential-${credential.credentialId}.zip`;

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${zipFileName}"`);
      return res.send(zipBuffer);
    } catch (error) {
      console.error('Zip generation error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error generating credential zip: ' + error.message
      });
    }
  }
);

/**
 * POST /api/eligibility/verify-and-decrypt
 * Verify and decrypt a credential package or zip
 * Body: { credentialPackage?, credentialZipBase64?, password }
 */
router.post(
  '/verify-and-decrypt',
  [
    body('password').notEmpty().withMessage('Password is required'),
    body('credentialPackage').optional().isObject(),
    body('credentialZipBase64').optional().isString()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { credentialPackage, credentialZipBase64, password } = req.body;
      let payload = credentialPackage || null;

      if (!payload && credentialZipBase64) {
        const zipBuffer = Buffer.from(credentialZipBase64, 'base64');
        const zip = new AdmZip(zipBuffer);

        const entries = zip.getEntries(password);
        const jsonEntry = entries.find(entry => entry.entryName.endsWith('.json'));
        if (!jsonEntry) {
          return res.status(400).json({ message: 'No credential JSON found in zip' });
        }

        const jsonText = jsonEntry.getData(password).toString('utf8');
        payload = JSON.parse(jsonText);
      }

      if (!payload) {
        return res.status(400).json({ message: 'Credential payload is required' });
      }

      const result = verifyAndDecryptCredential({
        credentialHash: payload.credentialHash,
        encryptedData: payload.encryptedData,
        signature: payload.signature,
        password
      });

      if (!result.isValid) {
        return res.status(400).json({
          success: false,
          message: 'Credential verification failed',
          verification: result.verification
        });
      }

      const credential = result.credential || {};
      const medicalData = credential.medical_data || {};

      return res.json({
        success: true,
        credentialId: credential.credential_id || null,
        doctorEmail: credential.issuer_email || null,
        issuedAt: credential.issued_at || null,
        expiresAt: credential.expiry || null,
        medicalData: {
          testType: medicalData.test_type || null,
          patientName: null,
          patientDOB: null,
          riskLevel: medicalData.risk_level || 'normal',
          checklistResults: null,
          additionalNotes: medicalData.additional_notes || ''
        }
      });
    } catch (error) {
      console.error('Credential verification error:', error);
      return res.status(500).json({
        success: false,
        message: 'Verification error: ' + error.message
      });
    }
  }
);

module.exports = router;
