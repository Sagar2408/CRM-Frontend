import axios from "axios";

// Create an Axios instance specific to company service
const companyApi = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL, // ⚠️ Replace with env var in production
  headers: {
    "Content-Type": "application/json",
  },
});

// ✅ Attach Authorization token (masterToken) automatically to all requests
companyApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("masterToken"); 
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    } else {
      delete config.headers.Authorization;
    }
    
    return config;
  },
  (error) => Promise.reject(error)
);


export const createCompany = async (data) => {
  try {
    const response = await companyApi.post("/company/create-company", data);
    return response.data;
  } catch (error) {
    throw error.response?.data || { error: "Company creation failed" };
  }
};


export const getCompaniesForMaster = async () => {
  try {
    const response = await companyApi.get("/company/master/companies");
    return response.data;
  } catch (error) {
    throw error.response?.data || { error: "Failed to fetch companies" };
  }
};

export const setCompanyExpiry = async (companyId, expiryDate) => {
  try {
    const response = await companyApi.post(`/company/companies/${companyId}/expiry`, {
      expiryDate,
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || { error: "Failed to set expiry date" };
  }
};


export const pauseCompanyById = async (companyId) => {
  try {
    const response = await companyApi.post(`/company/companies/${companyId}/pause`);
    return response.data;
  } catch (error) {
    throw error.response?.data || { error: "Failed to pause company" };
  }
};


export const resumeCompanyById = async (companyId) => {
  try {
    const response = await companyApi.post(`/company/companies/${companyId}/resume`);
    return response.data;
  } catch (error) {
    throw error.response?.data || { error: "Failed to resume company" };
  }
};

export const regenerateAdminSignupToken = async (companyId) => {
  try {
    const response = await companyApi.post(
      `/company/companies/${companyId}/regenerate-admin-token`
    );
    return response.data;
  } catch (error) {
    throw error.response?.data || { error: "Failed to regenerate admin token" };
  }
};