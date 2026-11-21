import React, { useEffect, useState } from "react";
import { Navigate, useLocation, useParams } from "react-router-dom";
import { getAllProcessCustomerIdApi } from "../../services/processService";

// Old bookmarks / links (/process/clients/processperson/:name/:freshLeadId and
// /process/clients/details/:name/:freshLeadId) now land on the new follow-up screen.
// The customer id comes from navigation state when present; otherwise it is looked up from the
// signed-in person's own assigned clients by fresh-lead id (so another person's id finds nothing).
export default function LegacyFollowUpRedirect() {
  const { id } = useParams();
  const location = useLocation();
  const [target, setTarget] = useState(location.state?.client?.id ? String(location.state.client.id) : null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (target) return undefined;
    let alive = true;
    getAllProcessCustomerIdApi()
      .then((list) => {
        const hit = (Array.isArray(list) ? list : []).find((c) => String(c.fresh_lead_id) === String(id));
        if (!alive) return;
        if (hit) setTarget(String(hit.id));
        else setFailed(true);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [target, id]);

  if (failed) return <Navigate to="/process/freshlead" replace />;
  if (!target) return <p className="pfu-muted" style={{ padding: 16 }}>Opening follow-up...</p>;
  return <Navigate to={`/process/follow-up/${encodeURIComponent(target)}`} replace />;
}
