import React from "react";
import FollowUpWorkspace from "../features/follow-ups/FollowUpWorkspace";

// Executive Follow-ups: list + lead/history workspace. Editing a follow-up still
// goes through /executive/clients/:id/details (ClientDetailsOverview).
const FollowUpRoutes = () => <FollowUpWorkspace />;

export default FollowUpRoutes;
