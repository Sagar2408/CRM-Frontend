import { displayName, initialOf } from "./userDisplay";

test("uses first + last name, trimmed", () => {
  expect(displayName({ firstname: " Dev Kumar ", lastname: "Singh", username: "executive2" })).toBe("Dev Kumar Singh");
  expect(initialOf({ firstname: "dev", lastname: "singh" })).toBe("D");
});

test("handles a single name part and falls back to name, then username", () => {
  expect(displayName({ firstname: "Dev", username: "u" })).toBe("Dev");
  expect(displayName({ lastname: "Singh", username: "u" })).toBe("Singh");
  expect(displayName({ firstname: "  ", lastname: "", name: "Asha Rao", username: "u" })).toBe("Asha Rao");
  expect(displayName({ username: "executive2" })).toBe("executive2");
});

test("never throws on missing data", () => {
  expect(displayName(null)).toBe("");
  expect(displayName(undefined)).toBe("");
  expect(initialOf(null)).toBe("?");
});
