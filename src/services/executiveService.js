import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

// Get token from localStorage
const getToken = () => localStorage.getItem('token');

// ✅ Get headers with token + company ID
const getHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${getToken()}`,
});

/**
 * Record when executive starts work (login)
 */
export const recordStartWork = async () => {
  try {
    const userData = JSON.parse(localStorage.getItem("user") || '{}');
    const ExecutiveId = userData?.id;
    const executiveName = userData?.username;

    const payload = { ExecutiveId, executiveName };

    const response = await axios.post(
      `${API_BASE_URL}/executive-activities/startWork`,
      payload,
      { headers: getHeaders() }
    );

    return response.data;
  } catch (error) {
    console.error('❌ Error recording start work:', error.response?.data || error.message);
    throw new Error(error.response?.data?.message || 'Failed to record work start');
  }
};

/**
 * Record when executive stops work (logout)
 */
export const recordStopWork = async (reason = "logout") => {
  try {
    const userData = JSON.parse(localStorage.getItem("user") || '{}');
    const ExecutiveId = userData?.id;
    const executiveName = userData?.username;

    const payload = { ExecutiveId, executiveName, reason };

    const response = await axios.post(
      `${API_BASE_URL}/executive-activities/stopWork`,
      payload,
      { headers: getHeaders() }
    );

    return response.data;
  } catch (error) {
    console.error('Error recording stop work:', error);
    throw new Error(error.response?.data?.message || 'Failed to record work stop');
  }
};

/**
 * Record when executive starts a break
 */
export const recordStartBreak = async () => {
  try {
    const userData = JSON.parse(localStorage.getItem("user") || '{}');
    const ExecutiveId = userData?.id;
    const executiveName = userData?.username;

    const response = await axios.post(
      `${API_BASE_URL}/executive-activities/startBreak`,
      { ExecutiveId, executiveName },
      { headers: getHeaders() }
    );

    return response.data;
  } catch (error) {
    console.error('Error recording break start:', error);
    throw new Error(error.response?.data?.message || 'Failed to record break start');
  }
};

/**
 * Record when executive stops a break
 */
export const recordStopBreak = async () => {
  try {
    const userData = JSON.parse(localStorage.getItem("user") || '{}');
    const ExecutiveId = userData?.id;
    const executiveName = userData?.username;

    const response = await axios.post(
      `${API_BASE_URL}/executive-activities/stopBreak`,
      { ExecutiveId, executiveName },
      { headers: getHeaders() }
    );

    return response.data;
  } catch (error) {
    console.error('Error recording break stop:', error);
    throw new Error(error.response?.data?.message || 'Failed to record break stop');
  }
};

/**
 * Get current activity status of executive
 */
export const getActivityStatus = async () => {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/executive-activities/status`,
      { headers: getHeaders() }
    );
    return response.data;
  } catch (error) {
    console.error('Error getting activity status:', error);
    throw new Error(error.response?.data?.message || 'Failed to get activity status');
  }
};

/**
 * Keep-alive for the open work session. `idleSeconds` is how long the user has
 * been idle; the server uses it for its own inactivity check.
 */
export const sendHeartbeat = async (idleSeconds = 0) => {
  const response = await axios.post(
    `${API_BASE_URL}/executive-activities/heartbeat`,
    { idleSeconds },
    { headers: getHeaders() }
  );
  return response.data;
};

/** Tenant-wide automatic inactivity logout setting (read: any staff, write: Admin). */
export const getInactivitySettings = async () => {
  const response = await axios.get(
    `${API_BASE_URL}/work-settings/inactivity`,
    { headers: getHeaders() }
  );
  return response.data;
};

export const saveInactivitySettings = async ({ enabled, minutes }) => {
  const response = await axios.put(
    `${API_BASE_URL}/work-settings/inactivity`,
    { enabled, minutes },
    { headers: getHeaders() }
  );
  return response.data;
};

/**
 * Record visit to lead section
 */
export const leadtrackVisit = async (executiveId) => {
  try {
  await axios.post(
  `${API_BASE_URL}/executive-activities/trackLeadVisit`,
  { ExecutiveId: executiveId },
  { headers: getHeaders() }
);

  } catch (error) {
    if (error.response) {
      console.error('API error:', error.response.data.message);
    } else {
      console.error('Network error:', error.message);
    }
  }
};
export const sendEmail = async ({
  templateId,
  executiveName,
  executiveEmail,
  clientEmail,
  emailBody,
  emailSubject,
}) => {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/template/send-email`,
      {
        templateId,
        executiveName,
        executiveEmail,
        clientEmail,
        emailBody,
        emailSubject,
      },
      {
        headers: getHeaders(), // ✅ Add this line
      }
    );
    return response.data;
  } catch (error) {
    console.error("Failed to send email:", error.response?.data || error.message);
    throw new Error(error.response?.data?.message || 'Failed to send email');
  }
};
export const getAttendance = async (startDate, endDate) => {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/executive-activities/attendance`,
      {
        headers: getHeaders(),
        params: {
          startDate, // pass raw string YYYY-MM-DD
          endDate,
        },
      }
    );
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("API error:", error.response.data.message);
    } else {
      console.error("Network error:", error.message);
    }
  }
};