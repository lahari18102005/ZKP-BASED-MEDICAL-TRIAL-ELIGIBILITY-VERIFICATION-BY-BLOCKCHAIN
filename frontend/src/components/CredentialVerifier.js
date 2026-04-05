import React, { useState } from 'react';
import axios from 'axios';
import storageManager from '../utils/storageManager';
import './CredentialVerifier.css';

function CredentialVerifier() {
  const [credentialFile, setCredentialFile] = useState(null);
  const [password, setPassword] = useState('');
  const [verificationResult, setVerificationResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [credentialData, setCredentialData] = useState(null);
  const [credentialZipBase64, setCredentialZipBase64] = useState('');

  const arrayBufferToBase64 = (buffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 1) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setError('');
    
    if (file) {
      const isZip = file.name.toLowerCase().endsWith('.zip');

      if (isZip) {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const base64 = arrayBufferToBase64(event.target.result);
            setCredentialZipBase64(base64);
            setCredentialData(null);
            setCredentialFile(file);
            setShowPasswordModal(true);
            setPassword('');
          } catch (err) {
            setError('Invalid ZIP file. Please upload a valid credential zip.');
          }
        };
        reader.readAsArrayBuffer(file);
      } else {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const credential = JSON.parse(event.target.result);
            setCredentialData(credential);
            setCredentialZipBase64('');
            setCredentialFile(file);
            setShowPasswordModal(true);
            setPassword('');
          } catch (err) {
            setError('Invalid JSON file. Please upload a valid credential file.');
          }
        };
        reader.readAsText(file);
      }
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!password) {
      setError('Password is required');
      return;
    }

    setLoading(true);
    setError('');
    setVerificationResult(null);

    try {
      const response = await axios.post(
        'http://localhost:5000/api/eligibility/verify-and-decrypt',
        credentialZipBase64
          ? { credentialZipBase64, password }
          : { credentialPackage: credentialData, password }
      );

      setVerificationResult(response.data);
      setShowPasswordModal(false);
      setPassword('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to verify credential. Check your password and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeCredential = async () => {
    if (!verificationResult?.credential?.credential_id) {
      setError('No credential ID available to revoke');
      return;
    }

    const token = storageManager.getItem('token');
    const signature = storageManager.getItem('signature');

    try {
      setLoading(true);
      const response = await axios.post(
        'http://localhost:5000/api/credential/revoke',
        { credentialId: verificationResult.credential.credential_id },
        {
          headers: { 
            Authorization: `Bearer ${token}`,
            'X-Signature': signature || ''
          }
        }
      );

      if (response.data.success) {
        setError('');
        setVerificationResult({
          ...verificationResult,
          revoked: true
        });
        alert('Credential has been revoked successfully');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to revoke credential');
    } finally {
      setLoading(false);
    }
  };

  const handleResetVerification = () => {
    setVerificationResult(null);
    setCredentialFile(null);
    setPassword('');
    setCredentialData(null);
    setCredentialZipBase64('');
    setShowPasswordModal(false);
    setError('');
  };

  const handleCloseModal = () => {
    setShowPasswordModal(false);
    setPassword('');
    setCredentialFile(null);
    setCredentialData(null);
    setCredentialZipBase64('');
  };

  return (
    <div className="verifier-container">
      {!verificationResult ? (
        <div className="verifier-card">
          <div className="verifier-header">
            <h2>🔍 Verify Secure Credential</h2>
            <p>Upload and decrypt your medical credential</p>
          </div>
          
          <form onSubmit={(e) => e.preventDefault()} className="verifier-form">
            <div className="form-group">
              <label className="file-label" htmlFor="credentialFile">
                <span className="file-icon">📁</span>
                <span className="file-text">
                  {credentialFile ? `✓ ${credentialFile.name}` : 'Choose Credential File (ZIP or JSON)'}
                </span>
                <input
                  type="file"
                  id="credentialFile"
                  name="credentialFile"
                  accept=".json,.zip"
                  onChange={handleFileChange}
                  className="file-input"
                  hidden
                />
              </label>
            </div>

            <div className="info-box">
              <p><strong>📌 How it works:</strong></p>
              <ul>
                <li>Upload the encrypted credential ZIP or JSON file</li>
                <li>A password prompt will appear automatically</li>
                <li>Enter the doctor's login password to decrypt</li>
                <li>View verified credential details</li>
              </ul>
            </div>

            {error && <div className="alert alert-error">{error}</div>}
          </form>
        </div>
      ) : (
        <div className="result-card">
          <div className="result-header">
            <h2>✅ Credential Verified Successfully!</h2>
          </div>

          <div className="verification-details">
            <div className="detail-section">
              <h3>🔐 Security Verification</h3>
              <div className="status-item success">
                <span className="status-badge">✓</span>
                <span className="status-text">Signature verified with RSA-2048</span>
              </div>
              <div className="status-item success">
                <span className="status-badge">✓</span>
                <span className="status-text">Decrypted with AES-256-GCM</span>
              </div>
              <div className="status-item success">
                <span className="status-badge">✓</span>
                <span className="status-text">Credential is valid and not expired</span>
              </div>
              <div className="status-item success">
                <span className="status-badge">✓</span>
                <span className="status-text">Nonce validated (replay protection)</span>
              </div>
            </div>

            <div className="detail-section">
              <h3>📋 Medical Information</h3>
              <div className="info-grid">
                <div className="info-item">
                  <span className="label">Test Type:</span>
                  <span className="value">{verificationResult.medicalData?.testType || 'N/A'}</span>
                </div>
                <div className="info-item">
                  <span className="label">Patient Name:</span>
                  <span className="value">{verificationResult.medicalData?.patientName || 'N/A'}</span>
                </div>
                <div className="info-item">
                  <span className="label">Patient DOB:</span>
                  <span className="value">{verificationResult.medicalData?.patientDOB || 'N/A'}</span>
                </div>
                <div className="info-item">
                  <span className="label">Risk Level:</span>
                  <span className={`value risk-${verificationResult.medicalData?.riskLevel || 'normal'}`}>
                    {verificationResult.medicalData?.riskLevel || 'Normal'}
                  </span>
                </div>
              </div>
            </div>

            <div className="detail-section">
              <h3>🔍 Eligibility Criteria</h3>
              <div className="checklist-results">
                {verificationResult.medicalData?.checklistResults && 
                  Object.entries(verificationResult.medicalData.checklistResults).map(([key, value]) => (
                    <div key={key} className="checklist-item">
                      <span className={value ? '✓' : '✗'}></span>
                      <span>{key}</span>
                    </div>
                  ))
                }
              </div>
            </div>

            {verificationResult.medicalData?.additionalNotes && (
              <div className="detail-section">
                <h3>📝 Additional Notes</h3>
                <p className="notes">{verificationResult.medicalData.additionalNotes}</p>
              </div>
            )}

            <div className="detail-section metadata">
              <h3>📊 Credential Metadata</h3>
              <div className="metadata-grid">
                <div className="metadata-item">
                  <span className="label">Credential ID:</span>
                  <code className="value">{verificationResult.credentialId?.substring(0, 16)}...</code>
                </div>
                <div className="metadata-item">
                  <span className="label">Issued By:</span>
                  <span className="value">{verificationResult.doctorEmail || 'N/A'}</span>
                </div>
                <div className="metadata-item">
                  <span className="label">Issued Date:</span>
                  <span className="value">{new Date(verificationResult.issuedAt).toLocaleDateString()} {new Date(verificationResult.issuedAt).toLocaleTimeString()}</span>
                </div>
                <div className="metadata-item">
                  <span className="label">Expiry Date:</span>
                  <span className="value">{new Date(verificationResult.expiresAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="action-buttons">
            <button onClick={handleResetVerification} className="btn btn-primary">
              🔄 Verify Another Credential
            </button>
          </div>
        </div>
      )}

      {showPasswordModal && (
        <div className="modal-overlay">
          <div className="password-modal">
            <div className="modal-header">
              <h3>🔑 Enter Doctor's Password</h3>
              <button 
                className="close-btn"
                onClick={handleCloseModal}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleVerify} className="password-form">
              <p className="modal-instruction">
          Enter the doctor's password used to secure this credential to decrypt and verify it.
        </p>

        <div className="form-group">
          <label htmlFor="verifierPassword">Doctor's Password *</label>
          <input
            type="password"
            id="verifierPassword"
            name="verifierPassword"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter the doctor's login password"
            className="input-field"
                  required
                />
              </div>

              {error && <div className="alert alert-error">{error}</div>}

              <div className="modal-actions">
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={handleCloseModal}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={!password || loading}
                >
                  {loading ? '⏳ Verifying...' : '✓ Decrypt & Verify'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default CredentialVerifier;
