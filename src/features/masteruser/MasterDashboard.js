import React, { useEffect, useState } from 'react';
import '../../styles/masterdash.css';
import { useCompany } from '../../context/CompanyContext';
import AddCompanyModal from './AddCompanyModal';
import { getSubscriptionStatus, SUBSCRIPTION_STATUS_LABELS } from '../../utils/companySummary';

const SUBSCRIPTION_BADGE_CLASS = {
  active: 'sub-badge-active',
  expiring_soon: 'sub-badge-expiring',
  expired: 'sub-badge-expired',
  not_configured: 'sub-badge-unconfigured',
};

const MasterDashboard = () => {
  const {
    companies,
    fetchCompanies,
    loading,
    error,
    pauseCompany,
    resumeCompany,
    updateCompanyExpiry,
    regenerateAdminToken
  } = useCompany();

  const [showModal, setShowModal] = useState(false);
  const [expiryDates, setExpiryDates] = useState({}); // Local expiry input
  const [newToken, setNewToken] = useState(null); // { companyName, token, expiresAt }
  const [copiedToken, setCopiedToken] = useState(false);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  // ✅ Toggle ON = resumeCompany | Toggle OFF = pauseCompany
  const handleToggleStatus = async (company, isChecked) => {
    try {
      if (isChecked) {
        await resumeCompany(company.id);  // ✅ Toggled ON
      } else {
        await pauseCompany(company.id);   // ❌ Toggled OFF
      }
      await fetchCompanies();
    } catch (err) {
      alert(err?.error || "Failed to update company status");
    }
  };

  // ⏳ Date input state
  const handleExpiryChange = (companyId, dateStr) => {
    setExpiryDates((prev) => ({ ...prev, [companyId]: dateStr }));
  };

  // 📅 Submit expiry API
  const submitExpiryDate = async (companyId) => {
    const dateStr = expiryDates[companyId];
    if (!dateStr) return alert("Please select a date first.");
    try {
      const iso = new Date(dateStr).toISOString();
      await updateCompanyExpiry(companyId, iso);
      await fetchCompanies();
    } catch (err) {
      alert(err?.error || "Failed to set expiry date");
    }
  };

  // 🔑 Regenerate a lost/expired Admin registration token
  const handleRegenerateToken = async (company) => {
    try {
      const res = await regenerateAdminToken(company.id);
      setNewToken({
        companyName: company.name,
        token: res.adminSignupToken,
        expiresAt: res.adminSignupTokenExpiresAt,
      });
    } catch (err) {
      alert(err?.message || "Failed to regenerate admin token");
    }
  };

  const handleCopyToken = async () => {
    if (!newToken) return;
    try {
      await navigator.clipboard.writeText(newToken.token);
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 1500);
    } catch {
      // ignore — value is still visible to copy manually
    }
  };

  return (
    <>
    <div className={`table-section-wrapper`}>
      <div className={`table-section ${showModal ? 'blurred' : ''}`}>
        <div className="table-header">
          <h2>Companies</h2>
          <button className="add-button" onClick={() => setShowModal(true)}>
            + Add New Company
          </button>
        </div>

        {error && companies.length === 0 && (
          <p className="error-text">{error}</p>
        )}

        {!loading && companies.length > 0 ? (
          <table className="company-table">
            <thead>
              <tr>
                <th>Company ID</th>
                <th>Company Name</th>
                <th>Company Code</th>
                <th>DB Name</th>
                <th>Admin Signup</th>
                <th>Created At</th>
                <th>Expiry Date</th>
                <th>Subscription</th>
                <th>Toggle Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((company) => {
                const status = company.status?.toLowerCase() || "unknown";
                const currentExpiry = company.expiryDate
                  ? new Date(company.expiryDate).toLocaleDateString()
                  : "None";
                const subscriptionStatus = getSubscriptionStatus(company);

                return (
                  <tr key={company.id}>
                    <td>{company.id}</td>
                    <td>{company.name}</td>
                    <td>{company.code}</td>
                    <td>{company.db_name}</td>
                    <td>
                      {company.adminClaimedAt ? (
                        "Claimed"
                      ) : (
                        <button
                          className="set-expiry-btn"
                          onClick={() => handleRegenerateToken(company)}
                        >
                          Generate Admin Token
                        </button>
                      )}
                    </td>
                    <td>{new Date(company.createdAt).toLocaleDateString()}</td>
                    <td>{currentExpiry}</td>
                    <td>
                      <span
                        className={`sub-status-badge ${SUBSCRIPTION_BADGE_CLASS[subscriptionStatus]}`}
                      >
                        {SUBSCRIPTION_STATUS_LABELS[subscriptionStatus]}
                      </span>
                    </td>

                    {/* ✅ Toggle Switch */}
                    <td>
                      <label className="switch">
                        <input
                          type="checkbox"
                          checked={status === "active"}
                          onChange={(e) =>
                            handleToggleStatus(company, e.target.checked)
                          }
                        />
<span className="slider"></span>
</label>
                    </td>

                    {/* 📅 Expiry Input + Set Button */}
                    <td>
                      <input
                        type="date"
                        value={expiryDates[company.id] || ""}
                        onChange={(e) =>
                          handleExpiryChange(company.id, e.target.value)
                        }
                        className="date-input"
                      />
                      <button
                        className="set-expiry-btn"
                        onClick={() => submitExpiryDate(company.id)}
                      >
                        Set
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          !loading && <p>No companies found.</p>
        )}
      </div>

      {showModal && (
        <AddCompanyModal
          onClose={() => setShowModal(false)}
          onCreated={fetchCompanies}
        />
      )}

      {newToken && (
        <div className="modal-overlay">
          <div className="modal-content refined-modal">
            <h2 className="modal-title">New Admin Registration Token</h2>
            <p className="modal-subtitle">
              For "{newToken.companyName}". Share this with the company's authorized Admin —
              it is shown only once and replaces any previous unused token.
            </p>
            <div className="m-form-group">
              <input readOnly value={newToken.token} />
              <button type="button" className="cancel-btn" onClick={handleCopyToken}>
                {copiedToken ? "Copied!" : "Copy"}
              </button>
            </div>
            {newToken.expiresAt && (
              <p className="modal-subtitle" style={{ fontSize: "0.85em" }}>
                Expires: {new Date(newToken.expiresAt).toLocaleString()}
              </p>
            )}
            <div className="modal-actions">
              <button type="button" className="create-btn-m" onClick={() => setNewToken(null)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </>
  );
};

export default MasterDashboard;
