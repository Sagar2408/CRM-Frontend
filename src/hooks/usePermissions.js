// src/hooks/usePermissions.js
import { usePermissionContext } from "../context/PermissionContext";

export const usePermissions = () => {
  const { permissions, loading, error, fetchPermissions } = usePermissionContext();
  return { permissions, loading, error, refresh: fetchPermissions };
};
