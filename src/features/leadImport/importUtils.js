export const CRM_FIELDS = [
  { key: "name", label: "Name", required: true },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "education", label: "Education" },
  { key: "experience", label: "Experience" },
  { key: "state", label: "State" },
  { key: "country", label: "Country" },
  { key: "dob", label: "Date of birth" },
  { key: "countryPreference", label: "Country preference" },
];

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const EXCEL_EXT = [".xlsx", ".xls"];

export const extOf = (name = "") => {
  const i = name.lastIndexOf(".");
  return i < 0 ? "" : name.slice(i).toLowerCase();
};

/** Client-side pre-check (the server re-validates extension, signature, size and rows). */
export function checkFile(file) {
  if (!file) return "Choose an Excel file.";
  if (!EXCEL_EXT.includes(extOf(file.name))) return "Only Excel files (.xlsx, .xls) can be imported.";
  if (file.size > MAX_UPLOAD_BYTES) return "File must be 10MB or smaller.";
  if (file.size === 0) return "The file is empty.";
  return "";
}

export const STATUS_LABEL = {
  processing: "Processing",
  completed: "Completed",
  completed_with_errors: "Completed with errors",
  failed: "Failed",
  inserted: "Imported",
  duplicate: "Duplicate",
  failed_row: "Failed",
  skipped: "Skipped",
};

export const statusLabel = (s) => STATUS_LABEL[s] || s;

export function formatDateTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString([], { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
