import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Registration from './components/Registration';
import Dashboard from './components/Dashboard';
import ErrorBoundary from './components/ErrorBoundary';
import storageManager from './utils/storageManager';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const backgroundVideoUrl = '/background-video.mp4';

  useEffect(() => {
    const token = storageManager.getItem('token');
    const doctorData = storageManager.getItem('doctor');
    if (token && doctorData) {
      setUser(JSON.parse(doctorData));
    }
  }, []);

  const handleLogin = (data) => {
    storageManager.setItem('token', data.token);
    storageManager.setItem('signature', data.signature);
    storageManager.setItem('doctor', JSON.stringify(data.doctor));
    setUser(data.doctor);
  };

  const handleLogout = () => {
    storageManager.removeItem('token');
    storageManager.removeItem('signature');
    storageManager.removeItem('doctor');
    setUser(null);
  };

  return (
    <ErrorBoundary>
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <div className="app-shell">
          <div className="video-backdrop" aria-hidden="true">
            <video
              className="video-layer"
              crossOrigin="anonymous"
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              src={backgroundVideoUrl}
            />
            <div className="video-overlay"></div>
            <div className="video-noise"></div>
          </div>

          <div className="app-content">
            <Routes>
              <Route 
                path="/login" 
                element={!user ? <Login onLogin={handleLogin} /> : <Navigate to="/" replace />} 
              />
              <Route 
                path="/register" 
                element={!user ? <Registration onRegistration={handleLogin} /> : <Navigate to="/" replace />} 
              />
              <Route 
                path="/" 
                element={user ? <Dashboard user={user} onLogout={handleLogout} /> : <Navigate to="/login" replace />} 
              />
            </Routes>
          </div>
        </div>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
