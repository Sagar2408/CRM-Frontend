import React, { useEffect, useState, useCallback } from "react";
import { FaExclamationTriangle } from "react-icons/fa";
import "./InsufficientBalanceModal.css";
import {
  SUBSCRIPTION_EXPIRED_EVENT,
  consumePendingSubscriptionExpired,
} from "../../utils/authEvents";

/**
 * Global "Insufficient Balance" popup shown whenever a tenant login (or
 * an already-authenticated request) is blocked because the company's
 * payment/subscription has expired (backend code SUBSCRIPTION_EXPIRED).
 * Mounted once near the app root (see App.js) so it works for every
 * tenant login page without each one wiring it up individually.
 *
 * Deliberately shows only company name + expiry date — never a company
 * ID or any database detail, matching what the backend sends.
 */
const InsufficientBalanceModal = () => {
  const [info, setInfo] = useState(null);

  useEffect(() => {
    // Covers the case where detection happened just before a full-page
    // redirect (existing session expiring mid-use) on the previous page.
    const pending = consumePendingSubscriptionExpired();
    if (pending) setInfo(pending);

    const handleEvent = (event) => setInfo(event.detail || {});
    window.addEventListener(SUBSCRIPTION_EXPIRED_EVENT, handleEvent);
    return () => window.removeEventListener(SUBSCRIPTION_EXPIRED_EVENT, handleEvent);
  }, []);

  const handleClose = useCallback(() => setInfo(null), []);

  if (!info) return null;

  const expiryDate = info.expiryDate ? new Date(info.expiryDate) : null;

  return (
    <div className="insufficient-balance-overlay" role="dialog" aria-modal="true">
      <div className="insufficient-balance-box">
        <FaExclamationTriangle className="insufficient-balance-icon" />
        <h2 className="insufficient-balance-title">Insufficient Balance</h2>
        <p className="insufficient-balance-message">
          Your company's subscription/payment period has expired. Please
          contact your company administrator to renew the payment and
          restore access.
        </p>

        {(info.companyName || expiryDate) && (
          <div className="insufficient-balance-details">
            {info.companyName && (
              <div>
                <span>Company</span>
                <span>{info.companyName}</span>
              </div>
            )}
            {expiryDate && !isNaN(expiryDate) && (
              <div>
                <span>Payment expiry</span>
                <span>{expiryDate.toLocaleDateString()}</span>
              </div>
            )}
          </div>
        )}

        <p className="insufficient-balance-message">
          If you believe this is a mistake, please reach out to your company
          administrator or support for help renewing access.
        </p>

        <div className="insufficient-balance-actions">
          <button
            type="button"
            className="insufficient-balance-close-btn"
            onClick={handleClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default InsufficientBalanceModal;
