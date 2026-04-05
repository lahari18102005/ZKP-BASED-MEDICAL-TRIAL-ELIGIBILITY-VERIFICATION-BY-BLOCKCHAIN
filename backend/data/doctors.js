const bcrypt = require('bcryptjs');

const doctors = [
  {
    doctorId: 'DR001',
    email: 'doctor1@medical.gov',
    password: bcrypt.hashSync('SecurePass123!', 10),
    name: 'Dr. Sarah Johnson',
    specialization: 'General Medicine'
  },
  {
    doctorId: 'DR002',
    email: 'doctor2@medical.gov',
    password: bcrypt.hashSync('SecurePass456!', 10),
    name: 'Dr. Michael Chen',
    specialization: 'Radiology'
  }
];

module.exports = doctors;
