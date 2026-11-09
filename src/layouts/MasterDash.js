// layouts/MasterDash.js
import React from 'react';
import DashboardCards from '../features/masteruser/DashboardCards';
import MasterDashboard from '../features/masteruser/MasterDashboard';
import SupportQueries from '../features/masteruser/SupportQueries';
import '../styles/masterdash.css';

const MasterDash = () => {
  return (
    <div className="master-dashboard-wrapper">
      <div className="master-container">
        <h1 className="master-title">Master Dashboard</h1>
        <p className="master-subtitle">View and manage all registered companies.</p>
        <DashboardCards />
        <MasterDashboard />
        <SupportQueries />
      </div>
    </div>
  );
};

export default MasterDash;
