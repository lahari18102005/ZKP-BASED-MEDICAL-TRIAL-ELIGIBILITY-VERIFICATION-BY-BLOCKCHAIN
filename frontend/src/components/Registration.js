import React, { useState } from 'react';
import axios from 'axios';
import './Registration.css';

function Registration({ onRegistration }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    nmcNumber: '',
    specialization: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [nmcVerified, setNmcVerified] = useState(false);
  const [nmcError, setNmcError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear NMC verification when NMC number changes
    if (name === 'nmcNumber') {
      setNmcVerified(false);
      setNmcError('');
    }
  };

  const validateNMCNumber = async () => {
    if (!formData.nmcNumber.trim()) {
      setNmcError('NMC registration number is required');
      return false;
    }

    try {
      const response = await axios.post('http://localhost:5000/api/auth/verify-nmc', {
        nmcNumber: formData.nmcNumber,
        name: formData.name
      });
      
      if (response.data.valid) {
        setNmcVerified(true);
        setNmcError('');
        return true;
      } else {
        setNmcVerified(false);
        setNmcError(response.data.error || 'NMC verification failed');
        return false;
      }
    } catch (err) {
      setNmcVerified(false);
      setNmcError(err.response?.data?.message || 'NMC verification failed');
      return false;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    // Verify NMC number first
    if (!nmcVerified) {
      const isValid = await validateNMCNumber();
      if (!isValid) {
        setLoading(false);
        return;
      }
    }

    try {
      const response = await axios.post('http://localhost:5000/api/auth/register', {
        name: formData.name,
        email: formData.email,
        password: formData.password,
        nmcNumber: formData.nmcNumber,
        specialization: formData.specialization
      });

      onRegistration(response.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="registration-container">
      <div className="registration-box">
        <div className="registration-header">
          <h1>Doctor Registration</h1>
          <p>Medical Authority - Secure Eligibility Verification System</p>
        </div>
        
        <form onSubmit={handleSubmit} className="registration-form">
          {error && <div className="error-message">{error}</div>}
          
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="name">Full Name</label>
              <input
                type="text"
                id="name"
                name="name"
                autoComplete="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Dr. John Doe"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input
                type="email"
                id="email"
                name="email"
                autoComplete="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="doctor@medical.gov"
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                name="password"
                autoComplete="new-password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Min 6 characters"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                autoComplete="new-password"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Re-enter password"
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="nmcNumber">NMC Registration Number</label>
              <div className="nmc-input-group">
                <input
                  type="text"
                  id="nmcNumber"
                  name="nmcNumber"
                  autoComplete="off"
                  value={formData.nmcNumber}
                  onChange={handleChange}
                  placeholder="e.g., 2019/01/123456"
                  required
                />
                <button
                  type="button"
                  onClick={validateNMCNumber}
                  className="verify-nmc-btn"
                  disabled={!formData.nmcNumber.trim() || loading}
                >
                  Verify
                </button>
              </div>
              {nmcVerified && (
                <div className="nmc-success">✓ NMC registration verified</div>
              )}
              {nmcError && <div className="nmc-error">{nmcError}</div>}
            </div>

            <div className="form-group">
              <label htmlFor="specialization">Specialization</label>
              <input
                type="text"
                id="specialization"
                name="specialization"
                autoComplete="off"
                value={formData.specialization}
                onChange={handleChange}
                placeholder="e.g., General Medicine"
                required
              />
            </div>
          </div>

          <div className="nmc-info">
            <h4>NMC Registration Number Formats:</h4>
            <ul>
              <li>YYYY/NN/XXXXXX (e.g., 2019/01/123456)</li>
              <li>State-YYYY-XXXXXX (e.g., DL-2020-234567)</li>
              <li>MCI/REG/YYYY/XXXXXX (e.g., MCI/REG/2018/345678)</li>
              <li>6-8 digit numbers (e.g., 456789)</li>
            </ul>
          </div>

          <button 
            type="submit" 
            className="register-btn" 
            disabled={loading || !nmcVerified}
          >
            {loading ? 'Registering...' : 'Create Account'}
          </button>
        </form>

        <div className="login-link">
          <p>Already have an account? <a href="/login">Sign in</a></p>
        </div>
      </div>
    </div>
  );
}

export default Registration;
