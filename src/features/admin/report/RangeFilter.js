import React from "react";
import { RANGE_PRESETS, rangeError, rangeFor } from "./reportUtils";

// Date-range control shared by the single report and the comparison.
// `value` = { preset, from, to }; the effective range comes from rangeFor().
const RangeFilter = ({ value, onChange }) => {
  const err = value.preset === "custom" ? rangeError(rangeFor("custom", value)) : "";
  return (
    <div className="rp-range">
      <label>
        <span>Period</span>
        <select value={value.preset} onChange={(e) => onChange({ ...value, preset: e.target.value })} aria-label="Period">
          {RANGE_PRESETS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
      </label>
      {value.preset === "custom" && (
        <>
          <label>
            <span>From</span>
            <input type="date" value={value.from} max={value.to || undefined} aria-label="From date"
              onChange={(e) => onChange({ ...value, from: e.target.value })} />
          </label>
          <label>
            <span>To</span>
            <input type="date" value={value.to} min={value.from || undefined} aria-label="To date"
              onChange={(e) => onChange({ ...value, to: e.target.value })} />
          </label>
        </>
      )}
      {err && <span className="rp-range-error" role="alert">{err}</span>}
    </div>
  );
};

export default RangeFilter;
