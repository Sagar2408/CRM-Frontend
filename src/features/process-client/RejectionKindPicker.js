import React from "react";

// Lets the Process Person record WHY an application ends: the client withdrew it, or
// it was rejected internally. Sent as `rejection_kind`; the backend keeps the real
// reason text untouched and stores the kind alongside it.
export const REJECTION_KINDS = [
  { value: "client_withdrawal", label: "Client withdrew the application" },
  { value: "internal_rejection", label: "Rejected internally" },
];

const RejectionKindPicker = ({ value, onChange }) => (
  <fieldset className="pp-rejection-kind" style={{ border: 0, padding: 0, margin: "12px 20px" }}>
    <legend style={{ fontWeight: 600, marginBottom: 6 }}>Reason type</legend>
    {REJECTION_KINDS.map((k) => (
      <label key={k.value} style={{ display: "block", cursor: "pointer", margin: "4px 0" }}>
        <input
          type="radio"
          name="rejection_kind"
          value={k.value}
          checked={value === k.value}
          onChange={() => onChange(k.value)}
        />{" "}
        {k.label}
      </label>
    ))}
  </fieldset>
);

export default RejectionKindPicker;
