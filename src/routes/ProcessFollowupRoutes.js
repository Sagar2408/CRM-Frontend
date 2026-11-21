import React from "react";
import ProcessFollowUpWorkspace from "../features/follow-ups/ProcessFollowUpWorkspace";

// Process Person Follow-ups: searchable client list + current follow-up + history,
// laid out like the Executive Follow-ups page. Adding / editing opens /process/follow-up/:customerId
// (features/process-followup/ProcessFollowUpForm).
const ProcessFollowUpRoutes = () => <ProcessFollowUpWorkspace />;

export default ProcessFollowUpRoutes;
