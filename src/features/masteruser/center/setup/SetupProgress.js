import React from "react";
import { STAGE_LABELS } from "../../../../services/masterAdminService";

const NEXT_HINT = {
  draft: "Save the database configuration next.",
  database_pending: "Test the database connection.",
  database_connected: "Generate an admin invitation.",
  admin_invitation_pending: "Waiting for the company admin to register with the invitation token.",
  admin_registered: "All requirements are met — activate the company.",
};

/** Setup stage + step indicator shown on the company Overview while a company is still being set up. */
const SetupProgress = ({ setup, provisioning }) => {
  if (!setup || !setup.steps || !setup.steps.length) return null;
  const done = setup.steps.filter((s) => s.done).length;
  const live = provisioning !== "draft";
  return (
    <section className="mc-setup" aria-label="Setup progress">
      <div className="mc-setup-head">
        <strong>{live ? "Setup complete" : "Setup progress"}</strong>
        <span className={`mc-badge stage-${setup.stage}`}>{STAGE_LABELS[setup.stage] || setup.stage}</span>
      </div>
      <ol className="mc-steps">
        {setup.steps.map((s, i) => (
          <li key={s.key} className={s.done ? "done" : ""} aria-label={`${s.label}: ${s.done ? "done" : "pending"}`}>
            <span className="mc-step-dot" aria-hidden="true">{s.done ? "✓" : i + 1}</span>
            <span className="mc-step-label">{s.label}</span>
          </li>
        ))}
      </ol>
      <div className="mc-progress" role="progressbar" aria-valuemin={0} aria-valuemax={setup.steps.length} aria-valuenow={done}>
        <span style={{ width: `${(done / setup.steps.length) * 100}%` }} />
      </div>
      {!live && NEXT_HINT[setup.stage] && <p className="mc-muted">Next: {NEXT_HINT[setup.stage]}</p>}
    </section>
  );
};

export default SetupProgress;
