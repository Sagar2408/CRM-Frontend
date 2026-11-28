import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { permissionService } from "../services/permissionService";
import { AuthContext } from "./authContextObject";

const PermissionContext = createContext();

/**
 * The signed-in staff session as stored by login, or null when nobody is signed in
 * (Process Person / customer / client sessions have no role and use their own rules).
 */
const readSession = () => {
  try {
    const user = JSON.parse(localStorage.getItem("user"));
    if (!user?.id || !user?.role) return null;
    // The token is part of the key: every login gets a new one, so signing in again (even
    // as an account with the same role and id in another company) reloads permissions.
    return { id: user.id, role: user.role, key: `${user.role}:${user.id}:${localStorage.getItem("token") || ""}` };
  } catch {
    return null;
  }
};

const NOTHING = { owner: null, permissions: null, loading: false, error: null };

export const PermissionProvider = ({ children }) => {
  // This provider stays mounted across login and logout (they navigate without reloading
  // the page). Subscribing to the auth context re-renders it when the account changes.
  useContext(AuthContext);
  const session = readSession();
  const sessionKey = session?.key ?? null;

  const [state, setState] = useState(() => ({ ...NOTHING, owner: sessionKey, loading: !!sessionKey }));
  const latest = useRef(0);

  const fetchPermissions = useCallback(async () => {
    const request = ++latest.current; // a slower answer for a previous account is ignored
    const current = readSession();
    if (!current) return setState(NOTHING);

    const role = String(current.role).toLowerCase();
    const done = (permissions, error = null) => {
      if (request === latest.current) setState({ owner: current.key, permissions, loading: false, error });
    };
    if (role === "admin") return done("FULL_ACCESS");

    // Keep showing this account's own permissions while refreshing them; never another's.
    setState((prev) => (prev.owner === current.key && prev.permissions ? prev : { ...NOTHING, owner: current.key, loading: true }));
    try {
      done(await permissionService.fetchPermissionsForUser(current.id, current.role));
    } catch (err) {
      if (err.response?.status === 404) {
        // No RolePermission row exists yet for this user (e.g. an Admin
        // hasn't configured Page Access Control for them). That's a
        // normal, expected state — not a failed request — so it should
        // flow into RequirePermission's own `!permissions` fallback
        // (UnauthorizedAccess) instead of being surfaced as a raw
        // "Request failed with status code 404" error.
        done(null);
      } else {
        console.error("Permissions error:", err);
        done(null, err.message || "Failed to fetch permissions");
      }
    }
  }, []);

  useEffect(() => {
    fetchPermissions();
  }, [sessionKey, fetchPermissions]);

  // Until the stored state belongs to the account now signed in, report "loading" - this
  // covers the render between a login/logout and the effect above, so nobody ever sees
  // another account's pages (or a false "no pages" message).
  const current = state.owner === sessionKey ? state : { permissions: null, loading: !!sessionKey, error: null };

  // ✅ Memoize all the service methods
  const fetchUsers = useCallback(() => permissionService.fetchUsers(), []);
  const createPermission = useCallback((payload) => permissionService.createPermission(payload), []);
  const fetchAllRolePermissions = useCallback(() => permissionService.fetchAllRolePermissions(), []);
  const fetchSinglePermission = useCallback((id) => permissionService.fetchSinglePermission(id), []);
  const savePermissions = useCallback((id, permissions) => permissionService.savePermissions(id, permissions), []);
  const fetchPermissionsForUser = useCallback((id, role) => permissionService.fetchPermissionsForUser(id, role), []);

  return (
    <PermissionContext.Provider
      value={{
        // State
        permissions: current.permissions,
        loading: current.loading,
        error: current.error,
        // Utility
        fetchPermissions,
        fetchUsers,
        createPermission,
        fetchAllRolePermissions,
        fetchSinglePermission,
        savePermissions,
        fetchPermissionsForUser,
      }}
    >
      {children}
    </PermissionContext.Provider>
  );
};

export const usePermissionContext = () => useContext(PermissionContext);
