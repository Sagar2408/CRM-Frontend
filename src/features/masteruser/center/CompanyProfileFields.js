import React from "react";

// Shared Add / Edit company fields. Pure + controlled so the add modal and the
// company-details edit form can't drift apart. Server-side validation is authoritative;
// this only catches the obvious mistakes early.
export const PROFILE_FIELDS = [
  ["legalName", "Legal company name"],
  ["displayName", "Display name"],
  ["industry", "Industry"],
  ["website", "Website", "url"],
  ["contactPerson", "Contact person"],
  ["contactEmail", "Contact email", "email"],
  ["contactPhone", "Contact phone", "tel"],
  ["accountManager", "Account manager"],
  ["country", "Country"],
  ["state", "State"],
  ["city", "City"],
  ["logoUrl", "Logo URL", "url"],
];
export const SUBSCRIPTION_FIELDS = [
  ["plan", "Subscription plan"],
  ["subscriptionStart", "Subscription start", "date"],
  ["expiryDate", "Subscription expiry", "date"],
  ["userLimit", "Employee / user limit", "number"],
  ["storageLimitMb", "Storage limit (MB)", "number"],
];
export const EMPTY_PROFILE = Object.fromEntries([...PROFILE_FIELDS, ...SUBSCRIPTION_FIELDS, ["description"], ["address"], ["isTrial"], ["trialEndsAt"]].map(([k]) => [k, k === "isTrial" ? false : ""]));

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const validateProfile = (v) => {
  const e = {};
  if (v.contactEmail && !EMAIL_RE.test(v.contactEmail)) e.contactEmail = "Enter a valid email address.";
  for (const f of ["website", "logoUrl"]) if (v[f] && !/^https?:\/\//i.test(v[f])) e[f] = "Must start with http:// or https://";
  if (v.contactPhone && !/^[0-9+()\-\s]{5,40}$/.test(v.contactPhone)) e.contactPhone = "Enter a valid phone number.";
  for (const f of ["userLimit", "storageLimitMb"]) if (v[f] !== "" && v[f] != null && !(Number(v[f]) >= 1)) e[f] = "Must be a positive number.";
  if (v.subscriptionStart && v.expiryDate && v.expiryDate < v.subscriptionStart) e.expiryDate = "Expiry must be after the start date.";
  return e;
};

/** Convert the form state to an API body: "" -> omitted/null, numbers -> numbers. */
export const toBody = (v, { forCreate = false } = {}) => {
  const out = {};
  for (const [k, val] of Object.entries(v)) {
    if (k === "isTrial") { out.isTrial = !!val; continue; }
    if (val === "" || val === undefined || val === null) { if (!forCreate) out[k] = null; continue; }
    out[k] = ["userLimit", "storageLimitMb"].includes(k) ? Number(val) : val;
  }
  return out;
};

const Field = ({ id, label, type = "text", value, onChange, error, wide, children }) => (
  <div className={`mc-field${wide ? " wide" : ""}`}>
    <label htmlFor={id}>{label}</label>
    {children || <input id={id} name={id} type={type} className="mc-input" value={value ?? ""} onChange={onChange} />}
    {error && <span className="mc-error">{error}</span>}
  </div>
);

const CompanyProfileFields = ({ values, onChange, errors = {}, withSubscription = true }) => {
  const set = (e) => onChange({ ...values, [e.target.name]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  return (
    <div className="mc-form">
      {PROFILE_FIELDS.map(([k, label, type]) => (
        <Field key={k} id={k} label={label} type={type} value={values[k]} onChange={set} error={errors[k]} />
      ))}
      <Field id="address" label="Full address" wide error={errors.address}>
        <textarea id="address" name="address" className="mc-textarea" value={values.address ?? ""} onChange={set} />
      </Field>
      <Field id="description" label="Description" wide error={errors.description}>
        <textarea id="description" name="description" className="mc-textarea" value={values.description ?? ""} onChange={set} />
      </Field>
      {withSubscription && (
        <>
          {SUBSCRIPTION_FIELDS.map(([k, label, type]) => (
            <Field key={k} id={k} label={label} type={type} value={values[k]} onChange={set} error={errors[k]} />
          ))}
          <Field id="isTrial" label="Trial account">
            <label className="mc-switch-row" style={{ border: 0, padding: 0 }}>
              <input id="isTrial" name="isTrial" type="checkbox" checked={!!values.isTrial} onChange={set} /> This company is on a trial
            </label>
          </Field>
          {values.isTrial && <Field id="trialEndsAt" label="Trial ends" type="date" value={values.trialEndsAt} onChange={set} error={errors.trialEndsAt} />}
        </>
      )}
    </div>
  );
};

export default CompanyProfileFields;
