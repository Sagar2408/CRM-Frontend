import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  recordStartWork,
  recordStopWork,
  recordStartBreak,
  recordStopBreak,
  startCall,
  endCall,
  getActivityStatus,
  leadtrackVisit,
  sendEmail,
  getAttendance
} from '../services/executiveService';

// 1. Create Context
const ExecutiveActivityContext = createContext();

// 2. Hook for consuming context
export const useExecutiveActivity = () => useContext(ExecutiveActivityContext);

// 3. Provider Component
export const ExecutiveActivityProvider = ({ children }) => {
  const [status, setStatus] = useState({
    workActive: false,
    breakActive: false,
    callActive: false,
  });

  const [loading, setLoading] = useState(false);
  const [startTimeData, setStartTimeData] = useState(null);

  // ---------------------------------------
  // Effect: Fetch current activity status
  // ---------------------------------------
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        setLoading(true);
        const data = await getActivityStatus();
        setStatus({
          workActive: data.workActive,
          breakActive: data.breakActive,
          callActive: data.callActive,
        });
      } catch (error) {
        console.error('Error fetching activity status:', error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
  }, []);

  // ---------------------------------------
  // Effect: Start work automatically on mount
  // ---------------------------------------
  useEffect(() => {
    handleStartWork();

    // Cleanup function can be added here if needed
    return () => {
      // Cleanup logic (optional)
      // You could add handleStopWork() here if needed when component unmounts
    };
  }, []);

  // ---------------------------------------
  // Work Session Handlers
  // ---------------------------------------
  const handleStartWork = async () => {
    try {
      setLoading(true);
      const response = await recordStartWork();

      setStartTimeData(response.activity);
      if (response?.activity?.workStartTime) {
        localStorage.setItem(
          'workStartTime',
          new Date(response.activity.workStartTime).toISOString()
        );
      }

      setStatus((prev) => ({ ...prev, workActive: true }));
    } catch (error) {
      console.error("❌ Error recording start work:", error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStopWork = async () => {
    try {
      setLoading(true);
      await recordStopWork();
      setStatus({ workActive: false, breakActive: false, callActive: false });
    } catch (error) {
      console.error("❌ Error stopping work:", error.message);
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------
  // Break Handlers
  // ---------------------------------------
  const handleStartBreak = async () => {
    try {
      setLoading(true);
      await recordStartBreak();
      setStatus((prev) => ({ ...prev, breakActive: true }));
    } catch (error) {
      console.error("❌ Error starting break:", error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStopBreak = async () => {
    try {
      setLoading(true);
      const data = await recordStopBreak();
      setStatus((prev) => ({ ...prev, breakActive: false }));
      return data.breakDuration;
    } catch (error) {
      console.error("❌ Error stopping break:", error.message);
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------
  // Call Activity Handlers
  // ---------------------------------------
  const handleStartCall = async (leadId) => {
    try {
      setLoading(true);
      await startCall(leadId);
      setStatus((prev) => ({ ...prev, callActive: true }));
    } catch (error) {
      console.error("❌ Error starting call:", error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEndCall = async (leadId) => {
    try {
      setLoading(true);
      await endCall(leadId);
      setStatus((prev) => ({ ...prev, callActive: false }));
    } catch (error) {
      console.error("❌ Error ending call:", error.message);
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------
  // Lead Visit Tracking
  // ---------------------------------------
  const leadtrack = useCallback(async (executiveId) => {
    try {
      setLoading(true);
      if (!executiveId) {
        console.error("❌ Executive ID is missing.");
        return;
      }
      await leadtrackVisit(executiveId);
    } catch (error) {
      console.error("❌ Error in lead tracking:", error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // ---------------------------------------
  // Email Sending Handler
  // ---------------------------------------
  const handleSendEmail = async ({
    templateId,
    executiveName,
    executiveEmail,
    clientEmail,
    emailBody,
    emailSubject,
  }) => {
    try {
      return await sendEmail({
        templateId,
        executiveName,
        executiveEmail,
        clientEmail,
        emailBody,
        emailSubject,
      });
    } catch (error) {
      console.error("❌ Email sending failed:", error.message);
      throw error;
    }
  };

  const handleGetAttendance = useCallback(async (startDate, endDate) => {
    try {
      setLoading(true);
      const data = await getAttendance(startDate, endDate);
      return data || [];
    } catch (error) {
      console.error("Error fetching attendance:", error.message);
    } finally {
      setLoading(false);
    }
  }, []);
  // ---------------------------------------
  // Provider Return
  // ---------------------------------------
  return (
    <ExecutiveActivityContext.Provider
      value={{
        status,
        loading,
        setStatus,
        startTimeData,
        setStartTimeData,
        handleStartWork,
        handleStopWork,
        handleStartBreak,
        handleStopBreak,
        handleStartCall,
        handleEndCall,
        handleSendEmail,
        leadtrack,
        handleGetAttendance,
        
      }}
    >
      {children}
    </ExecutiveActivityContext.Provider>
  );
};