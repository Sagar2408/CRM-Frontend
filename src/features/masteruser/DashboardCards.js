import React, { useMemo } from 'react';
import { FaBuilding, FaCheckCircle, FaBan, FaClock, FaSignOutAlt } from 'react-icons/fa';
import '../../styles/masterdash.css';
import { useMaster } from '../../context/MasterContext';
import { useCompany } from '../../context/CompanyContext';
import { computeCompanySummary } from '../../utils/companySummary';

const DashboardCards = () => {
  const { logout } = useMaster();
  // Same CompanyContext instance the Companies table reads from — no
  // extra fetch here, and the cards stay in sync whenever a company is
  // created or its status/expiry changes (fetchCompanies() is already
  // called after every such mutation).
  const { companies, loading, error } = useCompany();

  const summary = useMemo(() => computeCompanySummary(companies), [companies]);

  const cards = [
    {
      title: 'Total Companies',
      value: summary.total,
      icon: <FaBuilding />,
      className: 'purple',
    },
    {
      title: 'Active Companies',
      value: summary.active,
      icon: <FaCheckCircle />,
      className: 'green',
    },
    {
      title: 'Inactive Companies',
      value: summary.inactive,
      icon: <FaBan />,
      className: 'red',
    },
    {
      title: 'Recently Added',
      value: summary.recentlyAdded,
      icon: <FaClock />,
      className: 'blue',
    },
  ];

  const showEmpty = !loading && !error && companies.length === 0;

  return (
    <div className="dashboard-top-container">
      <div className="dashboard-logout-bar">
        <button className="master-logout-btn" onClick={logout}>
          <FaSignOutAlt style={{ marginRight: '6px' }} />
          Logout
        </button>
      </div>

      {error && companies.length === 0 ? (
        <p className="error-text">{error}</p>
      ) : showEmpty ? (
        <p>No companies yet — summary will appear once a company is added.</p>
      ) : (
        <div className="dashboard-cards">
          {cards.map((card, index) => (
            <div className={`card ${card.className}`} key={index}>
              <div className="m-card-icon">{card.icon}</div>
              <div className="card-content">
                <p className="card-title">{card.title}</p>
                <h2 className="card-value">{loading ? '…' : card.value}</h2>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DashboardCards;
