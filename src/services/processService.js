import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
const BASE_HEADERS = {
  "Content-Type": "application/json",
};


// ✅ Dynamic headers with token
const getHeaders = () => {
  const token = localStorage.getItem("token");
  if (!token) throw new Error("Token not found in localStorage");

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
};

// ✅ POST - Create
export const createCustomerStages = async (stageData) => {
  const res = await fetch(`${API_BASE_URL}/customer-stages/stages`, {
    method: "POST",
    headers: getHeaders(),
    credentials: "include",
    body: JSON.stringify(stageData),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to create customer stages");
  return data;
};

// ✅ GET - Fetch
export const getCustomerStages = async () => {
  const res = await fetch(`${API_BASE_URL}/customer-stages/stages`, {
    method: "GET",
    headers: getHeaders(),
    credentials: "include",
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to fetch customer stages");
  return data;
};

// ✅ PUT - Update
export const updateCustomerStages = async (stageData) => {
  const res = await fetch(`${API_BASE_URL}/customer-stages/stages`, {
    method: "PUT",
    headers: getHeaders(),
    credentials: "include",
    body: JSON.stringify(stageData),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to update customer stages");
  return data;
};
/*---------------------Customer settings-----------------*/
export const profileSettings = async (payload) => {
  try {
    const token = localStorage.getItem('token');
if (!token) {
  throw new Error("Token missing in localStorage");
}
    const { phone, dob, nationality, passportNumber } = payload;

    const response = await axios.post(
      `${API_BASE_URL}/customer-details`,
      { phone, dob, nationality, passportNumber },
      {
        headers: {
          ...BASE_HEADERS,
          Authorization: `Bearer ${token}`,
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error('API call error:', error.response || error);
    throw error.response?.data || { error: 'Network error or server error' };
  }
};


export const getprofileSettings = async () => {
  const token = localStorage.getItem("token");

  const res = await fetch(`${API_BASE_URL}/customer-details`, {
    method: "GET",
    headers: {
      ...BASE_HEADERS,
      Authorization: `Bearer ${token}`,
    },
    credentials: "include",
  });

  const responseBody = await res.json();

  if (!res.ok) {
    console.error("Details fetching failed:", responseBody);
    throw new Error(responseBody.error || "Details fetching failed");
  }

  return responseBody;
};

export const updateProfileSettings = async (payload) => {
  try {
    const token = localStorage.getItem('token');
    const { phone, dob, nationality, passportNumber } = payload;

    const response = await axios.put(
      `${API_BASE_URL}/customer-details`,
      { phone, dob, nationality, passportNumber },
      {
        headers: {
          ...BASE_HEADERS,
          Authorization: `Bearer ${token}`,
        },
      }
    );

    return response.data;
  } catch (error) {
    throw error.response?.data || { error: 'Network error' };
  }
};
export const getAllCustomers = async () => {
  const token = localStorage.getItem("token");

  if (!token) {
    throw new Error("Token not found in localStorage");
  }

  const res = await fetch(`${API_BASE_URL}/customer/getAllCustomer`, {
    method: "GET",
    headers: {
      ...BASE_HEADERS,
      Authorization: `Bearer ${token}`,
    },
    credentials: "include",
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to fetch customers");
  return data.customers;
};
export const importConvertedClients = async () => {
  const res = await fetch(`${API_BASE_URL}/processperson/import-converted-customer`, {
    method: "POST",
    headers: getHeaders(),
    credentials: "include",
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to import converted clients");
  return data;
};

export const getCustomerStagesById = async (customerId) => {
  try {
    const res = await fetch(`${API_BASE_URL}/customer-stages/${customerId}`, {
      method: "GET",
      headers: getHeaders(),
      credentials: "include",
    });

    const data = await res.json(); // ✅ parse the JSON before using it

    if (!res.ok) throw new Error(data.error || "Failed to fetch customer stages");

    return data;
  } catch (error) {
    console.error("Failed to fetch customer stages by ID:", error);
    throw error;
  }
};
export const  uploadCustomerDocuments= async (formData) => {
  const token = localStorage.getItem('token');
const res = await fetch(`${API_BASE_URL}/customer/document/upload`,{
method: "POST",
headers: {
  // "Content-Type": "multipart/formData",
       Authorization: `Bearer ${token}`,
},
credentials: "include",
body: formData,
});

const data = await res.json();
if (!res.ok) throw new Error(data.error || "Failed to create customer stages");
return data;
};

export const getCustomerDocuments = async (userType,id) => {
const res = await fetch(`${API_BASE_URL}/customer/document/${userType}/${id}`, {
method: "GET",
headers: getHeaders(),
credentials: "include",
});

const data = await res.json();
if (!res.ok) throw new Error(data.error || "Failed to fetch customer stages");
return data;
};

export const getProcessSettings = async () => {
  try {
    const res = await fetch(`${API_BASE_URL}/processperson/process/settings`, {
      method: "GET",
      headers: getHeaders(),
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) {
      if (res.status === 400 && data.message === "Invalid role specified") {
        throw new Error("Settings not available for this account type");
      }
      throw new Error(data.message || "Failed to fetch settings");
    }
    return data.settings;
  } catch (error) {
    throw error;
  }
};
export const createProcessFollowUpApi = async (payload) => {
 
  try {
     console.log(payload)
      const token = localStorage.getItem("token");
    const response = await fetch(`${API_BASE_URL}/process-history/process-followup/create`,{
method: "POST",
headers: {
  "Content-Type": "application/json",
       Authorization: `Bearer ${token}`,
},
credentials: "include",
   body: JSON.stringify(payload)  
});
    return response.data;
  } catch (error) {
    throw error.response ? error.response.data : { message: 'Network error' };
  }
};
export const addStageCommentAndNotify = async ( customerId, stageNumber, newComment ) => {
  const response = await fetch(`${API_BASE_URL}/customer-stages/stage-comment/notify`, {
    method: "POST",
   headers: getHeaders(),
    body: JSON.stringify({ customerId, stageNumber, newComment }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Failed to add comment and notify");
  }

  return data;
};
export const getProcessFollowupApi = async (id) => {
const res = await fetch(`${API_BASE_URL}/process-history/process-followup/${id}`, {
method: "GET",
headers: getHeaders(),
credentials: "include",
});

const data = await res.json();
if (!res.ok) throw new Error(data.error || "Failed to fetch customer stages");
return data;
};
export const createFinalStageApi = async (payload) => {
  const res = await fetch(`${API_BASE_URL}/processed/create`, {
    method: "POST",
    headers: getHeaders(),
    credentials: "include",
    body:JSON.stringify(payload)
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to create customer stages");
  return data;
};
export const moveToRejectedApi = async (payload) => {
  const res = await fetch(`${API_BASE_URL}/process-history/process-followup/reject`, {
    method: "POST",
    headers: getHeaders(),
    credentials: "include",
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to move to rejected");
  return data;
};

export const createCloseLeadApi = async (freshLeadId) => {
  const res = await fetch(`${API_BASE_URL}/close-leads`, {
    method: "POST",
    headers: getHeaders(),
    credentials: "include",
    body:JSON.stringify({ fresh_lead_id: freshLeadId })
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to create customer stages");
  return data;
};




export const getAllProcessFollowupsApi = async (id) => {
const res = await fetch(`${API_BASE_URL}/process-history/process-followup`, {
method: "GET",
headers: getHeaders(),
credentials: "include",
});

const data = await res.json();
if (!res.ok) throw new Error(data.error || "Failed to fetch");
return data;
};
export const getProcessFollowupHistoryApi = async (id) => {
const res = await fetch(`${API_BASE_URL}/process-history/process-followup/${id}`, {
method: "GET",
headers: getHeaders(),
credentials: "include",
});

const data = await res.json();
if (!res.ok) throw new Error(data.error || "Failed to fetch customer stages");
return data;
};
export const getProcessHistoryApi = async (id) => {
const res = await fetch(`${API_BASE_URL}/process-history/process-followup/${id}`, {
method: "GET",  
headers: getHeaders(),
credentials: "include",
});

const data = await res.json();
if (!res.ok) throw new Error(data.error || "Failed to fetch customer stages");
return data;
};
export const createMeetings = async (meetingData) => {
  const res = await fetch(`${API_BASE_URL}/process-history/process-followp/create-meeting`, {
    method: "POST",
    headers: getHeaders(),
    credentials: "include",
    body: JSON.stringify(meetingData),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to create customer stages");
  return data;
};
export const startWorkApi = async (process_person_id) => {
  if (!process_person_id) {
    throw new Error("process_person_id is required");
  }
  const response = await fetch(`${API_BASE_URL}/process-person-activities/startWork`, {
    method: "POST",
    headers: getHeaders(),
    credentials: "include",
    body: JSON.stringify({ process_person_id }),
  });


  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Failed to startwork");
  return data;// Contains { message, activity }
};
export const startBreakApi = async (process_person_id) => {
  if (!process_person_id) {
    throw new Error("process_person_id is required");
  }
  const response = await fetch(`${API_BASE_URL}/process-person-activities/startBreak`, {
    method: "POST",
    headers: getHeaders(),
    credentials: "include",
    body: JSON.stringify({ process_person_id }),
  });


  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Failed to startwork");
  return data;// Contains { message, activity }
};
export const stopBreakApi = async (process_person_id) => {
  if (!process_person_id) {
    throw new Error("process_person_id is required");
  }
  const response = await fetch(`${API_BASE_URL}/process-person-activities/stopBreak`, {
    method: "POST",
    headers: getHeaders(),
    credentials: "include",
    body: JSON.stringify({ process_person_id }),
  });


  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Failed to startwork");
  return data;// Contains { message, activity }
};
export const stopWorkApi = async (process_person_id) => {

  const response = await fetch(`${API_BASE_URL}/process-person-activities/stopWork`, {
    method: "POST",
    headers: getHeaders(),
    credentials: "include",
    body: JSON.stringify({ process_person_id }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Failed to startwork");
  return data;// Contains { message, activity }
};
export const createCustomerStagesApi = async (customerId, stageNumber, newComment) => {

  const response = await fetch(`${API_BASE_URL}/customer-stages/stage-comment/add`, {
    method: "POST",
    headers: getHeaders(),
    credentials: "include",
    body:  JSON.stringify({ customerId, stageNumber, newComment })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Failed to startwork");
  return data;// Contains { message, activity }
};
export const getComments = async () => {
  const res = await fetch(`${API_BASE_URL}/customer-stages/stage-comment/get`, {
    method: "GET",
    headers: getHeaders(),
    credentials: "include",
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to fetch customer stages");
  return data;
};
export const getFinalStage = async () => {
  const res = await fetch(`${API_BASE_URL}/processed/`, {
    method: "GET",
    headers: getHeaders(),
    credentials: "include",
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to fetch customer stages");
  return data;
};
export const getStageComments = async (customerId, stageNumber) => {
  const res = await fetch(
    `${API_BASE_URL}/customer-stages/stage-comment/get?customerId=${customerId}&stageNumber=${stageNumber}`,
    {
      method: "GET",
      headers: getHeaders(),
      credentials: "include",
    }
  );

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to fetch stage comments");
  return data; // { comments: [...] }
};
export const getProcessPersonMeetingsApi = async () => {
  const res = await fetch(
    `${API_BASE_URL}/process-history/process-followup/get-meeting`,
    {
      method: "GET",
      headers: getHeaders(),
      credentials: "include",
    }
  );

  const data = await res.json();

  if (!res.ok) throw new Error(data.error || "Failed to fetch process meetings");

  return data; // expected format: { meetings: [...] }
};
export const getAllNotificationsByUser = async (userRole, page = 1) => {
  const response = await fetch(`${API_BASE_URL}/notification/user?page=${page}`, {
    method: "POST",
    headers: getHeaders(),
    credentials: "include",
    body: JSON.stringify({ userRole }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to fetch notifications");
  }

  return data; // Contains { notifications, pagination }
};
export const getAllProcessPersonsApi = async () => {
  const res = await fetch(`${API_BASE_URL}/processperson/`, {
    method: "GET",
    headers: getHeaders(),
    credentials: "include",
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to fetch customer stages");
  return data;
};
export const createProcessforConvertedApi = async (payload) => {
  const response = await fetch(`${API_BASE_URL}/processperson/assign-process-person`, {
    method: "POST",
    headers: getHeaders(),
    credentials: "include",
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to fetch notifications");
  }

  return data; // Contains { notifications, pagination }
};
export const getAllProcessCustomerIdApi = async () => {
const res = await fetch(`${API_BASE_URL}/processperson/get-customers`, {
method: "GET",
headers: getHeaders(),
credentials: "include",
});

const data = await res.json();
if (!res.ok) throw new Error(data.error || "Failed to fetch");
return data.customers;
};
export const getAllProcessPersonsFollowupApi = async (id) => {
  const res = await fetch(`${API_BASE_URL}/process-history/all-followups/${id}`, {
    method: "GET",
    headers: getHeaders(),
    credentials: "include",
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to fetch customer stages");
  return data;
};