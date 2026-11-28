import apiService from "./apiService";

// Company Admin "Subscription & Billing" (read only). The server derives the company from
// the signed-in Admin's token; no company id is ever sent.
export const billing = {
  subscription: async () => (await apiService.get("/billing/subscription")).data,
  receipt: async (paymentId) => (await apiService.get(`/billing/payments/${paymentId}/receipt`, { responseType: "blob" })).data,
};
