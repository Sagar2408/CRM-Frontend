import React from "react";
import useMessagingAccess from "../../hooks/useMessagingAccess";
import UnauthorizedAccess from "../admin-settings/UnauthorizedAccess";

/** Route guard: Admin / Process Person always; others need the `messaging` permission. */
const RequireMessaging = ({ children }) => {
  const { allowed, loading } = useMessagingAccess();
  if (loading) return <div>Loading permissions...</div>;
  return allowed ? <>{children}</> : <UnauthorizedAccess />;
};

export default RequireMessaging;
