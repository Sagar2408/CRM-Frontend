// Pure helpers for deriving Master Dashboard summary numbers and a
// company's subscription/payment status from the company list the
// Master Dashboard already fetches — no extra API call needed.

export const RECENTLY_ADDED_WINDOW_DAYS = 30;
export const EXPIRING_SOON_WINDOW_DAYS = 7;

/**
 * Total / Active / Inactive / Recently Added counts for the Master
 * Dashboard summary cards, computed from the real company records.
 * "Active"/"Inactive" reflect the company's account activation status
 * (`status`), not its payment/subscription status — those are kept
 * separate by design.
 */
export function computeCompanySummary(companies, now = new Date()) {
  const list = Array.isArray(companies) ? companies : [];
  const cutoff = new Date(now.getTime() - RECENTLY_ADDED_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  let active = 0;
  let recentlyAdded = 0;

  for (const company of list) {
    if (company?.status === "active") active += 1;
    if (company?.createdAt && new Date(company.createdAt) >= cutoff) {
      recentlyAdded += 1;
    }
  }

  return {
    total: list.length,
    active,
    inactive: list.length - active,
    recentlyAdded,
  };
}

/**
 * A company's payment/subscription status, derived from `expiryDate`.
 * Mirrors the backend's calendar-date semantics in tenantResolver: the
 * expiry date is valid through its entire (company-local) day.
 *
 *  - "not_configured": no expiryDate has ever been set.
 *  - "expired": past the end of the expiry date.
 *  - "expiring_soon": within EXPIRING_SOON_WINDOW_DAYS of expiring.
 *  - "active": expires later than that, or just not yet in the soon window.
 */
export function getSubscriptionStatus(company, now = new Date()) {
  const expiryDate = company?.expiryDate;
  if (!expiryDate) return "not_configured";

  const expiry = new Date(expiryDate);
  // UTC getters: a date-only expiry ("YYYY-MM-DD") parses to UTC
  // midnight, so reading it back in UTC keeps this independent of the
  // viewer's local timezone — matching the backend's tenantResolver.
  const endOfExpiryDay = new Date(
    Date.UTC(
      expiry.getUTCFullYear(),
      expiry.getUTCMonth(),
      expiry.getUTCDate(),
      23,
      59,
      59,
      999
    )
  );

  if (now.getTime() > endOfExpiryDay.getTime()) return "expired";

  const soonThreshold = new Date(
    endOfExpiryDay.getTime() - EXPIRING_SOON_WINDOW_DAYS * 24 * 60 * 60 * 1000
  );
  if (now.getTime() >= soonThreshold.getTime()) return "expiring_soon";

  return "active";
}

export const SUBSCRIPTION_STATUS_LABELS = {
  active: "Active",
  expiring_soon: "Expiring Soon",
  expired: "Expired",
  not_configured: "Not Configured",
};
