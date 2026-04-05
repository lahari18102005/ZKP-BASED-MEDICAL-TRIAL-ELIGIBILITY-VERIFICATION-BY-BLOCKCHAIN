// NMC (National Medical Commission) Registration Number Validator
// This utility validates Indian doctor registration numbers

const validateNMCNumber = (nmcNumber) => {
  // Remove any spaces and convert to uppercase
  const cleanNumber = nmcNumber.replace(/\s/g, '').toUpperCase();
  
  // NMC registration number patterns
  const patterns = [
    // Pattern: YEAR-STATE-CODE-NUMBER (e.g., 2019/01/123456)
    /^(\d{4})[\/\-]([0-9]{2})[\/\-]([0-9]{6,8})$/,
    // Pattern: STATE-CODE-YEAR-NUMBER (e.g., DL-2019-123456)
    /^([A-Z]{2})[\/\-](\d{4})[\/\-]([0-9]{6,8})$/,
    // Pattern: OLD MCI format: MCI/REG/YEAR/NUM (e.g., MCI/REG/2019/123456)
    /^MCI[\/\-]REG[\/\-](\d{4})[\/\-]([0-9]{6,8})$/,
    // Simple numeric pattern (6-8 digits)
    /^([0-9]{6,8})$/
  ];

  for (const pattern of patterns) {
    if (pattern.test(cleanNumber)) {
      return { valid: true, normalizedNumber: cleanNumber };
    }
  }

  return { valid: false, error: 'Invalid NMC registration number format' };
};

// Mock NMC database lookup (in production, this would connect to actual NMC API)
const mockNMCDatabase = {
  '2019/01/123456': {
    name: 'Dr. Amit Kumar',
    state: 'Delhi',
    registrationYear: '2019',
    specialization: 'General Medicine',
    status: 'active'
  },
  'DL-2020-234567': {
    name: 'Dr. Priya Sharma',
    state: 'Delhi',
    registrationYear: '2020',
    specialization: 'Pediatrics',
    status: 'active'
  },
  'MCI/REG/2018/345678': {
    name: 'Dr. Rajesh Singh',
    state: 'Maharashtra',
    registrationYear: '2018',
    specialization: 'Cardiology',
    status: 'active'
  },
  '2021/05/456789': {
    name: 'Dr. Anjali Patel',
    state: 'Gujarat',
    registrationYear: '2021',
    specialization: 'Orthopedics',
    status: 'active'
  },
  // Test doctor credentials (for demo/testing)
  'NMC/2022/001': {
    name: 'Dr. Test User',
    state: 'Delhi',
    registrationYear: '2022',
    specialization: 'General Medicine',
    status: 'active'
  },
  'NMC/2022/002': {
    name: 'Dr. Demo Doctor',
    state: 'Maharashtra',
    registrationYear: '2022',
    specialization: 'Internal Medicine',
    status: 'active'
  }
};

const verifyNMCDoctor = (nmcNumber, doctorName) => {
  const validation = validateNMCNumber(nmcNumber);
  
  if (!validation.valid) {
    return { valid: false, error: validation.error };
  }

  const doctorData = mockNMCDatabase[validation.normalizedNumber];
  
  if (!doctorData) {
    return { valid: false, error: 'NMC registration number not found in database' };
  }

  if (doctorData.status !== 'active') {
    return { valid: false, error: 'Doctor registration is not active' };
  }

  // Name matching (allowing for minor variations)
  const normalizeName = (name) => name.toLowerCase().replace(/\s+/g, '').trim();
  const inputNameNormalized = normalizeName(doctorName);
  const dbNameNormalized = normalizeName(doctorData.name);

  if (!dbNameNormalized.includes(inputNameNormalized.split(' ')[0]) || 
      !dbNameNormalized.includes(inputNameNormalized.split(' ').slice(-1)[0])) {
    return { valid: false, error: 'Name does not match NMC records' };
  }

  return {
    valid: true,
    doctorData: {
      ...doctorData,
      nmcNumber: validation.normalizedNumber
    }
  };
};

module.exports = {
  validateNMCNumber,
  verifyNMCDoctor,
  mockNMCDatabase
};
