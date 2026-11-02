// Minimal pub/sub so axios interceptors and plain-fetch service calls
// (neither of which live inside the React tree) can tell the globally
// mounted InsufficientBalanceModal to appear, without routing every
// login/service file through React context.

export const SUBSCRIPTION_EXPIRED_EVENT = "subscription-expired";
const PENDING_STORAGE_KEY = "pendingSubscriptionExpired";

export function emitSubscriptionExpired(detail) {
  window.dispatchEvent(new CustomEvent(SUBSCRIPTION_EXPIRED_EVENT, { detail }));
}

/**
 * Used when the detection happens right before a full-page redirect
 * (an already-logged-in session whose company just expired, caught by
 * the apiService response interceptor) — a same-page event would never
 * be heard by the page that's about to unload. The next page checks
 * sessionStorage for this on mount instead.
 */
export function stashPendingSubscriptionExpired(detail) {
  try {
    sessionStorage.setItem(PENDING_STORAGE_KEY, JSON.stringify(detail || {}));
  } catch {
    // sessionStorage unavailable — the modal just won't show post-redirect.
  }
}

export function consumePendingSubscriptionExpired() {
  try {
    const raw = sessionStorage.getItem(PENDING_STORAGE_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(PENDING_STORAGE_KEY);
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
