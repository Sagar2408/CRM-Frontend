import React from "react";
import ProcessFollowUpWorkspace from "../features/follow-ups/ProcessFollowUpWorkspace";

// Process Person Follow-ups: searchable client list + current follow-up + history,
// laid out like the Executive Follow-ups page. Editing still goes through
// /process/clients/details/:clientId/:id (ProcessClientDetailsOverview).
const ProcessFollowUpRoutes = () => <ProcessFollowUpWorkspace />;

export default ProcessFollowUpRoutes;
