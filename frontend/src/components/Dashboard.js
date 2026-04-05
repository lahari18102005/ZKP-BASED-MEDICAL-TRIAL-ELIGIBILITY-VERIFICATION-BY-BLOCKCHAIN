import React, { useState } from 'react';
import EligibilityForm from './EligibilityForm';
import './Dashboard.css';

function Dashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('eligibility');

  return (
    <div className="dashboard">
      <header className="header">
        <div className="logo">🏥 Medical Authority</div>
        <div className="user-info">
          <span className="user-name">{user.name} ({user.specialization})</span>
          <button className="logout-btn" onClick={onLogout}>Logout</button>
        </div>
      </header>

      <nav className="nav-tabs">
        <button
          className={`nav-tab ${activeTab === 'eligibility' ? 'active' : ''}`}
          onClick={() => setActiveTab('eligibility')}
        >
          ✓ Check Eligibility
        </button>
      </nav>

      <main className="main-content">
        <EligibilityForm doctor={user} />
      </main>
    </div>
  );
}

export default Dashboard;
