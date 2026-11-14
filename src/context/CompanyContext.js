import React, { createContext, useContext, useEffect, useState,useCallback } from "react";
import {
  getCompaniesForMaster,
  pauseCompanyById,
  resumeCompanyById,
  setCompanyExpiry,
} from "../services/companyService";

// 1. Create Context
const CompanyContext = createContext();

// 2. Custom Hook
export const useCompany = () => useContext(CompanyContext);

// 3. Provider Component
export const CompanyProvider = ({ children }) => {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);


    const fetchCompanies = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await getCompaniesForMaster();
      setCompanies(res.companies || []);
    } catch (err) {
      setError(err?.error || "Failed to fetch companies");
    } finally {
      setLoading(false);
    }
  }, []); // no dependencies — safe to memoize once

  // ✅ Call on mount
  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);


 // -------------------------
  // Set Expiry Date for a Company
  // -------------------------
  const updateCompanyExpiry = async (companyId, expiryDate) => {
    try {
      const res = await setCompanyExpiry(companyId, expiryDate);
      await fetchCompanies(); // refresh list
      return res;
    } catch (err) {
      throw err;
    }
  };

  // -------------------------
  // Pause a Company
  // -------------------------
  const pauseCompany = async (companyId) => {
    try {
      const res = await pauseCompanyById(companyId);
      await fetchCompanies();
      return res;
    } catch (err) {
      throw err;
    }
  };

  // -------------------------
  // Resume a Company
  // -------------------------
  const resumeCompany = async (companyId) => {
    try {
      const res = await resumeCompanyById(companyId);
      await fetchCompanies();
      return res;
    } catch (err) {
      throw err;
    }
  };

  // -------------------------
  // Provider Return
  // -------------------------
  return (
    <CompanyContext.Provider
      value={{
        companies,
        loading,
        error,
        fetchCompanies,
        updateCompanyExpiry,
        pauseCompany,
        resumeCompany,
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
};
