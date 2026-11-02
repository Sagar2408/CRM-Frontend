import React, { useState } from 'react';
import {
  FaBuilding,
  FaDatabase,
  FaLink,
  FaUser,
  FaLock,
  FaHashtag
} from 'react-icons/fa';
import { useCompany } from '../../context/CompanyContext'; 
import '../../styles/masterdash.css';

const AddCompanyModal = ({ onClose, onCreated }) => {
  const { addCompany } = useCompany();
  const [formData, setFormData] = useState({
    name: '',
    db_name: '',
    db_host: '',
    db_user: '',
    db_password: '',
    db_port: ''
  });
  const [createdInfo, setCreatedInfo] = useState(null);
  const [copied, setCopied] = useState('');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await addCompany(formData);
      onCreated();
      setCreatedInfo(res);
    } catch (err) {
      console.error('Company creation failed:', err);
      alert(err.error || err.message || 'Failed to create company');
    }
  };

  const handleCopy = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(''), 1500);
    } catch {
      // Clipboard API unavailable — the value is still visible to select/copy manually.
    }
  };

  if (createdInfo) {
    const code = createdInfo.company?.code || '';
    const token = createdInfo.adminSignupToken || '';
    const expiresAt = createdInfo.adminSignupTokenExpiresAt
      ? new Date(createdInfo.adminSignupTokenExpiresAt).toLocaleString()
      : null;

    return (
      <div className="modal-overlay">
        <div className="modal-content refined-modal">
          <h2 className="modal-title">Company Created</h2>
          <p className="modal-subtitle">
            Share the Company Code with the Sales Team and the Admin Registration Token with
            the company's authorized Admin. The token is shown only once.
          </p>

          <div className="m-form-group">
            <FaHashtag className="icon" />
            <input readOnly value={code} />
            <button type="button" className="cancel-btn" onClick={() => handleCopy(code, 'code')}>
              {copied === 'code' ? 'Copied!' : 'Copy'}
            </button>
          </div>

          <div className="m-form-group">
            <FaLock className="icon" />
            <input readOnly value={token} />
            <button type="button" className="cancel-btn" onClick={() => handleCopy(token, 'token')}>
              {copied === 'token' ? 'Copied!' : 'Copy'}
            </button>
          </div>
          {expiresAt && (
            <p className="modal-subtitle" style={{ fontSize: '0.85em' }}>
              Token expires: {expiresAt}. If it's lost or expires, regenerate it from the
              company's row in the dashboard.
            </p>
          )}

          <div className="modal-actions">
            <button type="button" className="create-btn-m" onClick={onClose}>Done</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content refined-modal">
        <h2 className="modal-title">Create Company</h2>
        <p className="modal-subtitle">Fill out the form to create a new company.</p>

        <form onSubmit={handleSubmit} className="form-grid">
          <div className="m-form-group">
            <FaBuilding className="icon" />
            <input name="name" placeholder="Company Name" onChange={handleChange} required />
          </div>
          <div className="m-form-group">
            <FaDatabase className="icon" />
            <input name="db_name" placeholder="Database Name" onChange={handleChange} required />
          </div>
          <div className="m-form-group">
            <FaLink className="icon" />
            <input name="db_host" placeholder="Host" onChange={handleChange} required />
          </div>
          <div className="m-form-group">
            <FaUser className="icon" />
            <input name="db_user" placeholder="Database User" onChange={handleChange} required />
          </div>
          <div className="m-form-group">
            <FaLock className="icon" />
            <input type="password" name="db_password" placeholder="Password" onChange={handleChange} required />
          </div>
          <div className="m-form-group">
            <FaHashtag className="icon" />
            <input name="db_port" placeholder="Port" onChange={handleChange} required />
          </div>

          <div className="modal-actions">
            <button type="button" className="cancel-btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="create-btn-m">Create</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddCompanyModal;
