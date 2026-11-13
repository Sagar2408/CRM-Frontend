// Display identity for the signed-in employee: real first + last name from the
// employee record, falling back to the login username only when no name is stored.
export const displayName = (info) => {
  const full = [info?.firstname, info?.lastname]
    .map((p) => (typeof p === "string" ? p.trim() : ""))
    .filter(Boolean)
    .join(" ");
  return full || info?.name || info?.username || "";
};

export const initialOf = (info) => (displayName(info).charAt(0) || "?").toUpperCase();
