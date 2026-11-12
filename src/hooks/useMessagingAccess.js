import { usePermissionContext } from "../context/PermissionContext";

// Where each role's Messaging page lives (mirrors the route files).
const BASE_BY_ROLE = {
  admin: "/admin",
  hr: "/hr",
  manager: "/manager",
  tl: "/team-lead",
  executive: "/executive",
};

export function readUser() {
  try {
    return JSON.parse(localStorage.getItem("user")) || null;
  } catch {
    return null;
  }
}

/**
 * Frontend mirror of the server rule (the server is the real gate):
 *  - Admin and Process Person: always allowed
 *  - TL / Executive / Manager / HR: need the `messaging` permission
 *  - anything else (customers): never
 */
export default function useMessagingAccess() {
  const ctx = usePermissionContext() || {};
  const user = readUser();
  const isProcess = user?.type === "processperson";
  const role = String(user?.role || "").toLowerCase();

  let allowed = false;
  let loading = false;
  if (isProcess || role === "admin") {
    allowed = true;
  } else if (BASE_BY_ROLE[role]) {
    loading = !!ctx.loading;
    allowed = ctx.permissions?.messaging === true;
  }
  const base = isProcess ? "/process" : BASE_BY_ROLE[role] || null;
  return { allowed, loading, path: base ? `${base}/messaging` : null, isAdmin: role === "admin" && !isProcess };
}
