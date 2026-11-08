import React, { useEffect, useMemo, useRef, useState } from "react";
import { FaSearch, FaTimes } from "react-icons/fa";

const idOf = (e) => String(e?.id ?? e?._id ?? "");

// Searchable employee selector. mode="single": value is an executive or null.
// mode="multi": value is an array (max `max`), shown as removable chips.
const ExecutivePicker = ({ executives, mode = "single", value, onChange, max = 5, label, placeholder }) => {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef(null);
  const multi = mode === "multi";
  const selected = multi ? value || [] : value ? [value] : [];
  const isSelected = (e) => selected.some((s) => idOf(s) === idOf(e));
  const full = multi && selected.length >= max;

  const options = useMemo(() => {
    const q = query.trim().toLowerCase();
    return executives.filter((e) => !q || (e.username || "").toLowerCase().includes(q));
  }, [executives, query]);

  useEffect(() => setActive(0), [query, open]);

  useEffect(() => {
    const close = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const choose = (e) => {
    if (multi) {
      if (isSelected(e)) onChange(selected.filter((s) => idOf(s) !== idOf(e)));
      else if (!full) onChange([...selected, e]);
      setQuery("");
    } else {
      onChange(e);
      setQuery("");
      setOpen(false);
    }
  };

  const onKeyDown = (ev) => {
    if (ev.key === "ArrowDown") {
      ev.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, options.length - 1));
    } else if (ev.key === "ArrowUp") {
      ev.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (ev.key === "Enter" && open && options[active]) {
      ev.preventDefault();
      choose(options[active]);
    } else if (ev.key === "Escape") {
      setOpen(false);
    } else if (ev.key === "Backspace" && multi && !query && selected.length) {
      onChange(selected.slice(0, -1));
    }
  };

  const listId = `rp-picker-${mode}`;
  return (
    <div className="rp-picker" ref={boxRef}>
      {label && <span className="rp-picker-label">{label}</span>}
      <div className="rp-picker-field" onClick={() => setOpen(true)}>
        <FaSearch className="rp-picker-icon" aria-hidden="true" />
        {multi &&
          selected.map((s) => (
            <span key={idOf(s)} className="rp-chip">
              {s.username}
              <button type="button" aria-label={`Remove ${s.username}`} onClick={(e) => { e.stopPropagation(); choose(s); }}>
                <FaTimes />
              </button>
            </span>
          ))}
        <input
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-label={label || "Search executives"}
          value={open || multi ? query : value?.username || ""}
          placeholder={multi ? (selected.length ? "Add another…" : placeholder || "Search executives…") : value ? value.username : placeholder || "Search executives…"}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        {!multi && value && (
          <button type="button" className="rp-clear" aria-label="Clear selection" onClick={(e) => { e.stopPropagation(); onChange(null); }}>
            <FaTimes />
          </button>
        )}
      </div>
      {multi && <span className="rp-picker-hint">{selected.length} of {max} selected</span>}
      {open && (
        <ul className="rp-options" role="listbox" id={listId} aria-multiselectable={multi}>
          {options.length === 0 ? (
            <li className="rp-option-empty">No executives match “{query}”.</li>
          ) : (
            options.map((e, i) => {
              const sel = isSelected(e);
              const disabled = multi && full && !sel;
              return (
                <li
                  key={idOf(e)}
                  role="option"
                  aria-selected={sel}
                  aria-disabled={disabled}
                  className={`rp-option ${i === active ? "is-active" : ""} ${sel ? "is-selected" : ""} ${disabled ? "is-disabled" : ""}`}
                  onMouseDown={(ev) => ev.preventDefault()}
                  onClick={() => !disabled && choose(e)}
                >
                  {multi && <input type="checkbox" readOnly checked={sel} tabIndex={-1} />}
                  {e.username}
                </li>
              );
            })
          )}
          {full && <li className="rp-option-empty">Maximum of {max} executives reached.</li>}
        </ul>
      )}
    </div>
  );
};

export default ExecutivePicker;
