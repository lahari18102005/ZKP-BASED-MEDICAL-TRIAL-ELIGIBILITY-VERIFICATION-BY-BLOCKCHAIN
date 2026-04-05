const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const doctors = require('../data/doctors');
const { verifyNMCDoctorWithFallback } = require('../utils/nmcScraper');
const { createSignedToken } = require('../utils/crypto');
const fs = require('fs');
const path = require('path');
const router = express.Router();

router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    const doctor = doctors.find(d => d.email === email);
    if (!doctor) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isValidPassword = await bcrypt.compare(password, doctor.password);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const payload = { 
      doctorId: doctor.doctorId, 
      email: doctor.email, 
      name: doctor.name 
    };

    // Create signed token
    const { token, signature } = createSignedToken(payload);

    res.json({
      token,
      signature,
      doctor: {
        doctorId: doctor.doctorId,
        email: doctor.email,
        name: doctor.name,
        specialization: doctor.specialization
      }
    });
  }
);

// Registration route with NMC verification
router.post(
  '/register',
  [
    body('name').trim().isLength({ min: 3 }).withMessage('Name must be at least 3 characters'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('nmcNumber').trim().notEmpty().withMessage('NMC registration number is required'),
    body('specialization').trim().isLength({ min: 3 }).withMessage('Specialization is required')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password, nmcNumber, specialization } = req.body;

    // Check if doctor already exists
    const existingDoctor = doctors.find(d => d.email === email);
    if (existingDoctor) {
      return res.status(400).json({ message: 'Doctor with this email already registered' });
    }

    // Verify NMC registration (using web scraping with fallback)
    const nmcVerification = await verifyNMCDoctorWithFallback(nmcNumber, name);
    if (!nmcVerification.valid) {
      return res.status(400).json({ message: nmcVerification.error });
    }

    // Generate new doctor ID
    const newDoctorId = `DR${String(doctors.length + 1).padStart(3, '0')}`;

    // Create new doctor object
    const newDoctor = {
      doctorId: newDoctorId,
      email,
      password: bcrypt.hashSync(password, 10),
      name: nmcVerification.doctorData.name,
      specialization,
      nmcNumber: nmcVerification.doctorData.nmcNumber,
      state: nmcVerification.doctorData.state,
      registrationYear: nmcVerification.doctorData.registrationYear
    };

    // Add to doctors array
    doctors.push(newDoctor);

    // Update the doctors.js file (in production, use a proper database)
    const doctorsFilePath = path.join(__dirname, '../data/doctors.js');
    const fileContent = `const bcrypt = require('bcryptjs');

const doctors = ${JSON.stringify(doctors, null, 2)};

module.exports = doctors;`;

    fs.writeFileSync(doctorsFilePath, fileContent);

    // Create signed token
    const payload = { 
      doctorId: newDoctor.doctorId, 
      email: newDoctor.email, 
      name: newDoctor.name 
    };
    const { token, signature } = createSignedToken(payload);

    res.status(201).json({
      message: 'Registration successful',
      token,
      signature,
      doctor: {
        doctorId: newDoctor.doctorId,
        email: newDoctor.email,
        name: newDoctor.name,
        specialization: newDoctor.specialization,
        nmcNumber: newDoctor.nmcNumber
      }
    });
  }
);

// NMC verification endpoint (using web scraping with fallback)
router.post('/verify-nmc', [
  body('nmcNumber').trim().notEmpty().withMessage('NMC registration number is required'),
  body('name').trim().isLength({ min: 3 }).withMessage('Name must be at least 3 characters')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { nmcNumber, name } = req.body;
  const verification = await verifyNMCDoctorWithFallback(nmcNumber, name);

  res.json(verification);
});

module.exports = router;
