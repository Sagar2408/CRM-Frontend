const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

/**
 * First-time Company Admin signup — requires a Company Code AND a
 * one-time Master-issued Admin registration token. A company code
 * alone is never sufficient to create an Admin account.
 */
export const signupCompanyAdmin = async ({
  companyCode,
  adminSignupToken,
  email,
  password,
  confirmPassword,
}) => {
  const res = await fetch(`${API_BASE_URL}/company-admin/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      companyCode,
      adminSignupToken,
      email,
      password,
      confirmPassword,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Signup failed");
  }
  return data;
};
