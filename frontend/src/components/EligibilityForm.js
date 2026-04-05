import React, { useState, useEffect } from 'react';
import axios from 'axios';
import storageManager from '../utils/storageManager';
import './EligibilityForm.css';

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

function EligibilityForm({ doctor }) {
  const [selectedTests, setSelectedTests] = useState([]);
  const [checklistResults, setChecklistResults] = useState({});
  const [patientName, setPatientName] = useState('');
  const [patientDOB, setPatientDOB] = useState('');
  const [password, setPassword] = useState('');
  const [downloadPassword, setDownloadPassword] = useState('');
  const [lastDoneDate, setLastDoneDate] = useState('');
  const [riskLevel, setRiskLevel] = useState('normal');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [secureCredential, setSecureCredential] = useState(null);
  const [generatingSecure, setGeneratingSecure] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setError('');
  }, [selectedTests]);

  const handleTestToggle = (testName) => {
    setSelectedTests((prev) => {
      const isSelected = prev.includes(testName);
      const next = isSelected ? prev.filter((test) => test !== testName) : [...prev, testName];

      if (isSelected) {
        setChecklistResults((prevResults) => {
          const { [testName]: removed, ...rest } = prevResults;
          return rest;
        });
      }

      return next;
    });
  };

  const handleCheckboxChange = (testName, item) => {
    setChecklistResults((prev) => {
      const testResults = prev[testName] || {};
      return {
        ...prev,
        [testName]: {
          ...testResults,
          [item]: !testResults[item]
        }
      };
    });
  };

  const handleGenerateSecureCredential = async (e) => {
    e.preventDefault();
    setGeneratingSecure(true);
    setError('');

    const token = storageManager.getItem('token');
    const signature = storageManager.getItem('signature');

    try {
      if (!patientName || !patientDOB || !password) {
        setError('Patient name, DOB, and password are required');
        setGeneratingSecure(false);
        return;
      }

      if (selectedTests.length === 0) {
        setError('Select at least one medical test');
        setGeneratingSecure(false);
        return;
      }

      const eligibilityByTest = selectedTests.reduce((acc, testName) => {
        const requiredChecks = testChecklists[testName] || [];
        const testResults = checklistResults[testName] || {};
        const allChecked = requiredChecks.every((item) => testResults[item] === true);
        acc[testName] = allChecked;
        return acc;
      }, {});

      const overallEligibility = selectedTests.every((testName) => eligibilityByTest[testName]);

      const response = await axios.post(
        'http://localhost:5000/api/eligibility/secure-credential',
        {
          testTypes: selectedTests,
          checklistResults,
          eligibilityByTest,
          overallEligibility,
          patientName,
          patientDOB,
          password,
          lastDoneDate: lastDoneDate || null,
          riskLevel: riskLevel || 'normal',
          additionalNotes: additionalNotes || ''
        },
        {
          headers: { 
            Authorization: `Bearer ${token}`,
            'X-Signature': signature || ''
          }
        }
      );
      setSecureCredential(response.data.credential);
      setDownloadPassword(password);
      setSelectedTests([]);
      setPatientName('');
      setPatientDOB('');
      setPassword('');
      setChecklistResults({});
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to generate secure credential');
    } finally {
      setGeneratingSecure(false);
    }
  };

  const downloadSecureCredential = async () => {
    if (!downloadPassword) {
      setError('Download requires your login password. Please generate the credential again.');
      return;
    }

    try {
      const token = storageManager.getItem('token');
      const signature = storageManager.getItem('signature');

      const response = await axios.post(
        'http://localhost:5000/api/eligibility/secure-credential/zip',
        {
          credential: secureCredential,
          password: downloadPassword
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'X-Signature': signature || ''
          },
          responseType: 'blob'
        }
      );

      const blob = new Blob([response.data], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `secure-credential-${secureCredential.credentialId}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setDownloadPassword('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to download credential zip');
    }
  };

  const hasSelectedTests = selectedTests.length > 0;

  return (
    <div className="eligibility-container">
      {!secureCredential ? (
        <div className="form-wrapper">
          <div className="form-header">
            <h1>🔐 Generate Secure Medical Credential</h1>
            <p>Create encrypted, tamper-proof credentials for patient eligibility verification</p>
          </div>

          <form onSubmit={handleGenerateSecureCredential} className="secure-form">
            <div className="form-row">
              <div className="form-group full-width">
                <div className="form-label">Medical Tests *</div>
                <p className="helper-text">Select one or more tests.</p>
                <div className="test-grid">
                  {Object.keys(testChecklists).map((test) => {
                    const isSelected = selectedTests.includes(test);
                    return (
                      <button
                        key={test}
                        type="button"
                        className={`test-card ${isSelected ? 'selected' : ''}`}
                        onClick={() => handleTestToggle(test)}
                      >
                        <span className="test-title">{test}</span>
                        <span className="test-meta">{testChecklists[test].length} criteria</span>
                        <span className="test-check">{isSelected ? '✓' : '+'}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="riskLevel">Risk Level</label>
                <select 
                  id="riskLevel"
                  name="riskLevel"
                  autoComplete="off"
                  value={riskLevel}
                  onChange={(e) => setRiskLevel(e.target.value)}
                  className="input-field"
                >
                  <option value="normal">Normal</option>
                  <option value="low">Low</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group full-width">
                <label htmlFor="patientName">Patient Name *</label>
                <input
                  type="text"
                  id="patientName"
                  name="patientName"
                  autoComplete="name"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  placeholder="Full name of patient"
                  className="input-field"
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="patientDob">Patient DOB (YYYY-MM-DD) *</label>
                <input
                  type="date"
                  id="patientDob"
                  name="patientDob"
                  autoComplete="bday"
                  value={patientDOB}
                  onChange={(e) => setPatientDOB(e.target.value)}
                  className="input-field"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="lastTestDate">Last Test Date</label>
                <input
                  type="date"
                  id="lastTestDate"
                  name="lastTestDate"
                  autoComplete="off"
                  value={lastDoneDate}
                  onChange={(e) => setLastDoneDate(e.target.value)}
                  className="input-field"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group full-width">
                <label htmlFor="secureCredentialPassword">Your Login Password (to secure file) *</label>
                <input
                  type="password"
                  id="secureCredentialPassword"
                  name="secureCredentialPassword"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your doctor's login password"
                  className="input-field"
                  required
                />
                <small className="help-text">🔒 Required to generate the secure credential. Anyone who opens the file must enter this password.</small>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group full-width">
                <label htmlFor="additionalNotes">Additional Notes</label>
                <textarea
                  id="additionalNotes"
                  name="additionalNotes"
                  autoComplete="off"
                  value={additionalNotes}
                  onChange={(e) => setAdditionalNotes(e.target.value)}
                  placeholder="Any additional medical notes..."
                  className="input-field textarea-field"
                  rows="2"
                />
              </div>
            </div>

            {hasSelectedTests && (
              <div className="criteria-stack">
                {selectedTests.map((testName) => (
                  <div key={testName} className="checklist-section">
                    <h3>Eligibility Criteria - {testName}</h3>
                    <p className="checklist-instruction">Select any applicable criteria:</p>
                    <div className="checklist">
                      {testChecklists[testName].map((item, index) => (
                        <label key={index} className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={checklistResults[testName]?.[item] || false}
                            onChange={() => handleCheckboxChange(testName, item)}
                          />
                          <span className="checkbox-custom"></span>
                          <span className="checkbox-text">{item}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {error && <div className="alert alert-error">{error}</div>}

            <button 
              type="submit" 
              className={`btn btn-primary btn-large ${hasSelectedTests ? '' : 'disabled'}`}
              disabled={!hasSelectedTests || generatingSecure}
            >
              {generatingSecure ? '⏳ Generating Credential...' : '🔐 Generate Secure Credential'}
            </button>
          </form>
        </div>
      ) : (
        <div className="success-wrapper">
          <div className="success-card">
            <div className="success-icon">✓</div>
            <h2>Credential Generated Successfully!</h2>

            <div className="credential-info">
              <div className="info-item">
                <span className="info-label">Credential ID:</span>
                <code className="info-value">{secureCredential.credentialId.substring(0, 16)}...</code>
              </div>
              <div className="info-item">
                <span className="info-label">File Format:</span>
                <span className="info-value">Password-protected ZIP</span>
              </div>
              <div className="info-item">
                <span className="info-label">Encryption:</span>
                <span className="info-value">🔐 AES-256-GCM</span>
              </div>
              <div className="info-item">
                <span className="info-label">Signature:</span>
                <span className="info-value">✓ RSA-SHA256</span>
              </div>
              <div className="info-item">
                <span className="info-label">Expiry:</span>
                <span className="info-value">90 days</span>
              </div>
            </div>

            <div className="security-features">
              <h4>Security Features:</h4>
              <ul>
                <li>🔒 Password-based encryption key derivation (PBKDF2)</li>
                <li>✓ Digital signature verification (RSA-2048)</li>
                <li>🎲 Nonce-based replay attack protection</li>
                <li>⏰ Automatic expiry validation</li>
                <li>📦 Password-protected ZIP download</li>
              </ul>
            </div>

            <div className="action-buttons">
              <button onClick={downloadSecureCredential} className="btn btn-success">
                📥 Download Encrypted ZIP
              </button>
              <button 
                onClick={() => {
                  setSecureCredential(null);
                }} 
                className="btn btn-secondary"
              >
                ➕ Generate Another
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EligibilityForm;
