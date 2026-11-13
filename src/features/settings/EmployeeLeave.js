

import React, { useState, useEffect } from 'react';
import { Calendar, FileText, User, Clock, CheckCircle, AlertCircle, X, History, Plus } from 'lucide-react';
import { useApi } from '../../context/ApiContext';
import moment from 'moment';
import '../../styles/setting.css';
import { leaveApi } from '../../services/hrService';

const EmployeeLeave = () => {
  const { uploadFileAPI, createLeaveApplication, fetchLeaveApplicationsAPI, getHrProfile } = useApi();

  const [formData, setFormData] = useState({
    employeeId: '',
    fullName: '',
    role: '',
    positionTitle: '',
    leaveType: '',
    startDate: '',
    endDate: '',
    totalDays: '',
    reason: '',
    emergencyContactName: '',
    emergencyPhone: '',
    workHandoverTo: '',
    handoverNotes: '',
    attachments: null,
    appliedDate: moment().format('YYYY-MM-DD'),
  });

  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errors, setErrors] = useState({});
  const [submissionError, setSubmissionError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [leaveApplications, setLeaveApplications] = useState([]);
  const [leaveHistoryLoading, setLeaveHistoryLoading] = useState(false);
  const [showSandwichLeavePopup, setShowSandwichLeavePopup] = useState(false);
  const [sandwichLeaveSundays, setSandwichLeaveSundays] = useState([]);
  const [currentView, setCurrentView] = useState('form'); // 'form' or 'history'

  // Leave types are defined by HR (Leave Management > Leave types); the server
  // validates the chosen type and the employee's allocated balance.
  const [leaveTypes, setLeaveTypes] = useState([]);
  useEffect(() => {
    leaveApi
      .types()
      .then((types) => setLeaveTypes(types.map((t) => t.name)))
      .catch(() => setLeaveTypes([]));
  }, []);

  const roleOptions = [
    'Executive',
    'Manager',
    'HR',
    'Admin',
  ];

  const findSundaysBetweenDates = (startDate, endDate) => {
    const sundays = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    let current = new Date(start);
    current.setDate(current.getDate() + 1);
    while (current < end) {
      if (current.getDay() === 0) {
        sundays.push(new Date(current));
      }
      current.setDate(current.getDate() + 1);
    }
    return sundays;
  };

  const formatDateForDisplay = (date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  useEffect(() => {
    const fetchUserDataAndLeaves = async () => {
      try {
        const userData = localStorage.getItem('user');
        const executiveId = localStorage.getItem('executiveId');

        if (userData) {
          const user = JSON.parse(userData);
          const employeeId = user.id || executiveId || user.employeeId || '';

          setFormData(prev => ({
            ...prev,
            employeeId,
            fullName: user.username || user.name || user.fullName || '',
            role: user.role || '',
            positionTitle: user.position || user.title || user.designation || '',
          }));

          if (employeeId) {
            setLeaveHistoryLoading(true);
            const applications = await fetchLeaveApplicationsAPI(employeeId);
            setLeaveApplications(applications || []);
            setLeaveHistoryLoading(false);
          }
        }
      } catch (error) {
        console.error('Error fetching user data or leave applications:', error);
        setLeaveHistoryLoading(false);
      }
    };

    fetchUserDataAndLeaves();
  }, [fetchLeaveApplicationsAPI]);

  const handleInputChange = (e) => {
    const { name, value, files } = e.target;
    if (name === 'attachments') {
      setFormData(prev => ({ ...prev, [name]: files[0] }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }

    if (name === 'startDate' || name === 'endDate') {
      const startDate = new Date(name === 'startDate' ? value : formData.startDate);
      const endDate = new Date(name === 'endDate' ? value : formData.endDate);

      if (startDate && endDate && endDate >= startDate) {
        const timeDiff = endDate.getTime() - startDate.getTime();
        const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;
        setFormData(prev => ({ ...prev, totalDays: daysDiff.toString() }));
      }
    }

    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.fullName.trim()) newErrors.fullName = 'Employee name is required';
    if (!formData.role) newErrors.role = 'Role is required';
    if (!formData.positionTitle.trim()) newErrors.positionTitle = 'Position is required';
    if (!formData.leaveType) newErrors.leaveType = 'Leave type is required';
    if (!formData.startDate) newErrors.startDate = 'Start date is required';
    if (!formData.endDate) newErrors.endDate = 'End date is required';
    if (!formData.reason.trim()) newErrors.reason = 'Reason is required';
    if (!formData.emergencyContactName.trim()) newErrors.emergencyContactName = 'Emergency contact is required';
    if (!formData.emergencyPhone.trim()) newErrors.emergencyPhone = 'Emergency phone is required';

    if (formData.startDate && formData.endDate) {
      const startDate = new Date(formData.startDate);
      const endDate = new Date(formData.endDate);
      if (endDate < startDate) {
        newErrors.endDate = 'End date must be after start date';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    if (formData.startDate && formData.endDate) {
      const sundays = findSundaysBetweenDates(formData.startDate, formData.endDate);
      if (sundays.length > 0) {
        setSandwichLeaveSundays(sundays);
        setShowSandwichLeavePopup(true);
        return;
      }
    }

    await submitLeaveApplication();
  };

  const submitLeaveApplication = async () => {
    setUploading(true);
    setSubmissionError('');

    try {
      let supportingDocumentPath = null;

      if (formData.attachments) {
        const uploadResponse = await uploadFileAPI(formData.attachments);
        supportingDocumentPath = uploadResponse?.filePath || null;
      }

      const payload = {
        employeeId: formData.employeeId,
        fullName: formData.fullName,
        positionTitle: formData.positionTitle,
        leaveType: formData.leaveType,
        startDate: formData.startDate,
        endDate: formData.endDate,
        totalDays: parseInt(formData.totalDays, 10),
        appliedDate: formData.appliedDate,
        reason: formData.reason,
        emergencyContactName: formData.emergencyContactName,
        emergencyPhone: formData.emergencyPhone,
        workHandoverTo: formData.workHandoverTo || null,
        handoverNotes: formData.handoverNotes || null,
        supportingDocumentPath,
      };

      const response = await createLeaveApplication(payload);
      if (response && response.data) {
      try {
            const hrProfile = await getHrProfile();
            if (hrProfile?.id) {
              console.log("HR Profile fetched:", hrProfile);
            }
          } catch (hrError) {
            console.warn('Failed to fetch HR profile:', hrError);
          }
        setIsSubmitted(true);
        const applications = await fetchLeaveApplicationsAPI(formData.employeeId);
        setLeaveApplications(applications || []);
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error) {
      console.error('Error submitting leave application:', error);
      setSubmissionError(error.response?.data?.message || error.message || 'Failed to submit leave application. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleSandwichLeaveConfirm = () => {
    setShowSandwichLeavePopup(false);
    submitLeaveApplication();
  };

  const handleSandwichLeaveCancel = () => {
    setShowSandwichLeavePopup(false);
    setSandwichLeaveSundays([]);
  };

  const handleReset = () => {
    const userData = localStorage.getItem('user');
    const executiveId = localStorage.getItem('executiveId');

    let userInfo = {
      employeeId: '',
      fullName: '',
      role: '',
      positionTitle: '',
    };

    if (userData) {
      try {
        const user = JSON.parse(userData);
        userInfo = {
          employeeId: user.id || executiveId || user.employeeId || '',
          fullName: user.username || user.name || user.fullName || '',
          role: user.role || '',
          positionTitle: user.position || user.title || user.designation || '',
        };
      } catch (error) {
        console.error('Error parsing user data:', error);
      }
    }

    setFormData({
      ...userInfo,
      leaveType: '',
      startDate: '',
      endDate: '',
      totalDays: '',
      reason: '',
      emergencyContactName: '',
      emergencyPhone: '',
      workHandoverTo: '',
      handoverNotes: '',
      attachments: null,
      appliedDate: moment().format('YYYY-MM-DD'),
    });
    setErrors({});
    setIsSubmitted(false);
    setSubmissionError('');
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'approved': return '#10b981';
      case 'rejected': return '#ef4444';
      case 'pending': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  const handleViewToggle = () => {
    setCurrentView(currentView === 'form' ? 'history' : 'form');
    if (currentView === 'history') {
      setIsSubmitted(false); // Reset submission state when switching to form
    }
  };

  const SandwichLeavePopup = () => (
    <div className="el-popup-overlay">
      <div className="el-popup-container">
        <div className="el-popup-header">
          <AlertCircle className="el-popup-icon" style={{ color: '#f59e0b' }} />
          <h3 className="el-popup-title">Sandwich Leave Detected</h3>
          <button 
            onClick={handleSandwichLeaveCancel}
            className="el-popup-close"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="el-popup-content">
          <p className="el-popup-message">
            Your leave application includes the following Sunday(s), which creates a "sandwich leave" situation:
          </p>
          
          <div className="el-sunday-list">
            {sandwichLeaveSundays.map((sunday, index) => (
              <div key={index} className="el-sunday-item">
                📅 {formatDateForDisplay(sunday)}
              </div>
            ))}
          </div>
          
          <div className="el-popup-warning">
            <strong>Note:</strong> Sandwich leave means taking leave on days surrounding a weekend or holiday, 
            which may affect your leave balance calculation. Please confirm if you want to proceed.
          </div>
        </div>
        
        <div className="el-popup-actions">
          <button 
            onClick={handleSandwichLeaveCancel}
            className="el-popup-cancel-btn"
          >
            Cancel & Review Dates
          </button>
          <button 
            onClick={handleSandwichLeaveConfirm}
            className="el-popup-confirm-btn"
            disabled={uploading}
          >
            {uploading ? 'Submitting...' : 'Proceed with Application'}
          </button>
        </div>
      </div>
    </div>
  );

  if (isSubmitted) {
    return (
      <div className="el-container">
        <div className="el-success-card">
          <CheckCircle className="el-success-icon" />
          <h2 className="el-success-title">Leave Application Submitted Successfully</h2>
          <p className="el-success-message">
            Your leave application has been submitted and is pending approval.
            You will receive a confirmation email shortly with your application reference number.
          </p>
          <div className="el-success-details">
            <p><strong>Employee:</strong> {formData.fullName}</p>
            <p><strong>Employee ID:</strong> {formData.employeeId}</p>
            <p><strong>Role:</strong> {formData.role}</p>
            <p><strong>Leave Type:</strong> {formData.leaveType}</p>
            <p><strong>Duration:</strong> {formData.startDate} to {formData.endDate} ({formData.totalDays} days)</p>
          </div>
          <div className="el-success-actions">
            <button onClick={handleReset} className="el-new-application-btn">
              Submit New Application
            </button>
            <button 
              onClick={handleViewToggle} 
              className="el-toggle-btn"
              style={{ marginLeft: '10px' }}
            >
              <History size={18} />
              View Leave History
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="el-container">
      {showSandwichLeavePopup && <SandwichLeavePopup />}
      
      <div className="el-header">
        <div className="el-header-content">
          <User className="el-header-icon" />
          <div>
            <h1 className="el-title">Employee Leave Application</h1>
            <p className="el-subtitle">
              {currentView === 'form' 
                ? 'Submit your leave request or view your leave history' 
                : 'View your leave application history'
              }
            </p>
          </div>
        </div>
        <div className="el-header-buttons">
          <button
            onClick={handleViewToggle}
            className="el-toggle-btn"
          >
            {currentView === 'form' ? (
              <>
                <History size={18} />
                View Leave History
              </>
            ) : (
              <>
                <Plus size={18} />
                New Application
              </>
            )}
          </button>
        </div>
      </div>

      {currentView === 'form' ? (
        <div className="el-form">
          {submissionError && (
            <div className="el-error-banner">
              <AlertCircle size={20} style={{ color: '#ef4444' }} />
              <span>{submissionError}</span>
            </div>
          )}

          <div className="el-section">
            <h3 className="el-section-title">
              <User size={20} className="el-section-icon" />
              Employee Information
            </h3>
            <div className="el-grid">
              <div className="el-form-group">
                <label className="el-label">Employee ID</label>
                <input
                  type="text"
                  name="employeeId"
                  value={formData.employeeId}
                  onChange={handleInputChange}
                  className="el-input el-input-readonly"
                  placeholder="Auto-populated from login"
                  readOnly
                />
                <span className="el-info-text">Auto-populated from your login session</span>
              </div>
              <div className="el-form-group">
                <label className="el-label">Full Name *</label>
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleInputChange}
                  className={`el-input el-input-readonly ${errors.fullName ? 'el-input-error' : ''}`}
                  placeholder="Auto-populated from login"
                  readOnly
                />
                <span className="el-info-text">Auto-populated from your login session</span>
                {errors.fullName && <span className="el-error-text">{errors.fullName}</span>}
              </div>
              <div className="el-form-group">
                <label className="el-label">Role *</label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleInputChange}
                  className={`el-select el-select-readonly ${errors.role ? 'el-input-error' : ''}`}
                  disabled
                >
                  <option value="">Select Role</option>
                  {roleOptions.map(roleOption => (
                    <option key={roleOption} value={roleOption}>{roleOption}</option>
                  ))}
                </select>
                <span className="el-info-text">Auto-populated from your login session</span>
                {errors.role && <span className="el-error-text">{errors.role}</span>}
              </div>
              <div className="el-form-group">
                <label className="el-label">Position/Title *</label>
                <input
                  type="text"
                  name="positionTitle"
                  value={formData.positionTitle}
                  onChange={handleInputChange}
                  className={`el-input ${errors.positionTitle ? 'el-input-error' : ''}`}
                  placeholder="Enter position/title"
                />
                {errors.positionTitle && <span className="el-error-text">{errors.positionTitle}</span>}
              </div>
            </div>
          </div>

          <div className="el-section">
            <h3 className="el-section-title">
              <Calendar size={20} className="el-section-icon" />
              Leave Details
            </h3>
            <div className="el-grid">
              <div className="el-form-group">
                <label className="el-label">Leave Type *</label>
                <select
                  name="leaveType"
                  value={formData.leaveType}
                  onChange={handleInputChange}
                  className={`el-select ${errors.leaveType ? 'el-input-error' : ''}`}
                >
                  <option value="">Select Leave Type</option>
                  {leaveTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
                {errors.leaveType && <span className="el-error-text">{errors.leaveType}</span>}
              </div>
              <div className="el-form-group">
                <label className="el-label">Start Date *</label>
                <input
                  type="date"
                  name="startDate"
                  value={formData.startDate}
                  onChange={handleInputChange}
                  className={`el-input ${errors.startDate ? 'el-input-error' : ''}`}
                  min={new Date().toISOString().split('T')[0]}
                />
                {errors.startDate && <span className="el-error-text">{errors.startDate}</span>}
              </div>
              <div className="el-form-group">
                <label className="el-label">End Date *</label>
                <input
                  type="date"
                  name="endDate"
                  value={formData.endDate}
                  onChange={handleInputChange}
                  className={`el-input ${errors.endDate ? 'el-input-error' : ''}`}
                  min={formData.startDate || new Date().toISOString().split('T')[0]}
                />
                {errors.endDate && <span className="el-error-text">{errors.endDate}</span>}
              </div>
              <div className="el-form-group">
                <label className="el-label">Total Days</label>
                <input
                  type="text"
                  name="totalDays"
                  value={formData.totalDays}
                  readOnly
                  className="el-input el-input-readonly"
                  placeholder="Auto-calculated"
                />
              </div>
            </div>
          </div>

          <div className="el-section">
            <h3 className="el-section-title">
              <FileText size={20} className="el-section-icon" />
              Additional Information
            </h3>
            <div className="el-form-group">
              <label className="el-label">Reason for Leave *</label>
              <textarea
                name="reason"
                value={formData.reason}
                onChange={handleInputChange}
                className={`el-textarea ${errors.reason ? 'el-input-error' : ''}`}
                placeholder="Please provide detailed reason for leave"
                rows="4"
              />
              {errors.reason && <span className="el-error-text">{errors.reason}</span>}
            </div>

            <div className="el-grid">
              <div className="el-form-group">
                <label className="el-label">Emergency Contact Name *</label>
                <input
                  type="text"
                  name="emergencyContactName"
                  value={formData.emergencyContactName}
                  onChange={handleInputChange}
                  className={`el-input ${errors.emergencyContactName ? 'el-input-error' : ''}`}
                  placeholder="Contact person during leave"
                />
                {errors.emergencyContactName && <span className="el-error-text">{errors.emergencyContactName}</span>}
              </div>
              <div className="el-form-group">
                <label className="el-label">Emergency Phone *</label>
                <input
                  type="tel"
                  name="emergencyPhone"
                  value={formData.emergencyPhone}
                  onChange={handleInputChange}
                  className={`el-input ${errors.emergencyPhone ? 'el-input-error' : ''}`}
                  placeholder="Phone number"
                />
                {errors.emergencyPhone && <span className="el-error-text">{errors.emergencyPhone}</span>}
              </div>
            </div>

            <div className="el-grid">
              <div className="el-form-group">
                <label className="el-label">Work Handover To</label>
                <input
                  type="text"
                  name="workHandoverTo"
                  value={formData.workHandoverTo}
                  onChange={handleInputChange}
                  className="el-input"
                  placeholder="Name of person handling responsibilities"
                />
              </div>
              <div className="el-form-group">
                <label className="el-label">Supporting Documents</label>
                <input
                  type="file"
                  name="attachments"
                  onChange={handleInputChange}
                  className="el-file-input"
                  accept=".pdf,.doc,.docx,.jpg,.png"
                />
              </div>
            </div>

            <div className="el-form-group">
              <label className="el-label">Handover Notes</label>
              <textarea
                name="handoverNotes"
                value={formData.handoverNotes}
                onChange={handleInputChange}
                className="el-textarea"
                placeholder="Important notes for work handover and coverage"
                rows="3"
              />
            </div>
          </div>

          <div className="el-action-buttons">
            <button type="button" onClick={handleReset} className="el-reset-btn" disabled={uploading}>
              Reset Form
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="el-submit-btn"
              disabled={uploading}
            >
              <Clock size={18} className="el-btn-icon" />
              {uploading ? 'Submitting...' : 'Submit Leave Application'}
            </button>
          </div>
        </div>
      ) : (
        <div className="el-section">
          <h3 className="el-section-title">
            <Calendar size={20} className="el-section-icon" />
            Your Leave Application History
          </h3>
          {leaveHistoryLoading ? (
            <div className="el-loading">Loading your leave applications...</div>
          ) : leaveApplications.length === 0 ? (
            <div className="el-no-data">
              <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                <Calendar size={48} style={{ color: '#9ca3af', marginBottom: '16px' }} />
                <h3 style={{ color: '#6b7280', marginBottom: '8px' }}>No leave applications found</h3>
                <p style={{ color: '#9ca3af', marginBottom: '20px' }}>
                  You haven't submitted any leave applications yet.
                </p>
                <button 
                  onClick={handleViewToggle}
                  className="el-submit-btn"
                >
                  <Plus size={18} className="el-btn-icon" />
                  Submit Your First Application
                </button>
              </div>
            </div>
          ) : (
            <div className="el-table-container">
              <table className="el-table">
                <thead>
                  <tr>
                    <th className="el-table-header">Leave Type</th>
                    <th className="el-table-header">Start Date</th>
                    <th className="el-table-header">End Date</th>
                    <th className="el-table-header">Total Days</th>
                    <th className="el-table-header">Status</th>
                    <th className="el-table-header">Applied Date</th>
                    <th className="el-table-header">Reason</th>
                    <th className="el-table-header">HR Leave Response</th>
                  </tr>
                </thead>
                <tbody>
                  {leaveApplications.map((application) => (
                    <tr key={application.id} className="el-table-row">
                      <td className="el-table-cell">{application.leaveType}</td>
                      <td className="el-table-cell">{application.startDate}</td>
                      <td className="el-table-cell">{application.endDate}</td>
                      <td className="el-table-cell">{application.totalDays}</td>
                      <td className="el-table-cell" style={{ color: getStatusColor(application.status) }}>
                        {application.status}
                      </td>
                      <td className="el-table-cell">{application.appliedDate}</td>
                      <td className="el-table-cell">{application.reason}</td>
                      <td className="el-table-cell">{application.hrComment}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EmployeeLeave;