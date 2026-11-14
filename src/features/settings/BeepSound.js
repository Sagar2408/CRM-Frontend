import React, { useState, useContext, useRef, useEffect } from "react";
import { BeepSettingsContext, BEEP_DEFAULTS, loadBeepSettings, saveBeepSettings, sanitizeBeepSettings } from "../../context/BeepSettingsContext";
import { SoundGenerator, soundOptions } from "./SoundGenerator";
import "../../styles/settingsWorkspace.css";

const TIMING_OPTIONS = [
  { value: 1, label: "1 sec" },
  { value: 3, label: "3 sec" },
  { value: 5, label: "5 sec" },
  { value: 10, label: "10 sec" },
  { value: 15, label: "15 sec" },
  { value: 30, label: "30 sec" },
  { value: 60, label: "1 min" },
];

function BeepSound() {
  const { setSettings: commit } = useContext(BeepSettingsContext);
  // Start from what is actually persisted for this user (the provider may have mounted before sign-in).
  const [draft, setDraft] = useState(() => loadBeepSettings());
  const [notice, setNotice] = useState(null);
  const [playing, setPlaying] = useState(null);
  const generator = useRef(null);

  useEffect(() => {
    generator.current = new SoundGenerator();
    return () => generator.current && generator.current.close && generator.current.close();
  }, []);

  const patch = (p) => {
    setNotice(null);
    setDraft((d) => ({ ...d, ...p }));
  };

  const preview = async (soundId) => {
    const sound = soundOptions.find((s) => s.id === soundId);
    if (!sound || !generator.current) return;
    setPlaying(soundId);
    try {
      await sound.generator(generator.current, draft.volume);
    } catch (e) {
      setNotice({ type: "error", text: "This sound could not be played in your browser." });
    } finally {
      setTimeout(() => setPlaying((p) => (p === soundId ? null : p)), 600);
    }
  };

  const save = () => {
    const clean = sanitizeBeepSettings(draft);
    if (!saveBeepSettings(clean)) {
      setNotice({ type: "error", text: "Your browser blocked saving. Settings will apply until you reload." });
    } else {
      setNotice({ type: "ok", text: "Sound settings saved." });
    }
    commit(clean);
    setDraft(clean);
  };

  const reset = () => {
    setDraft({ ...BEEP_DEFAULTS });
    setNotice(null);
  };

  const disabled = !draft.enabled;

  return (
    <div>
      <div className="xs-page-head">
        <div>
          <h2 className="xs-page-title">Change in Beep</h2>
          <p className="xs-page-sub">Choose how your CRM notifications sound and how often they remind you. Saved per user on this device.</p>
        </div>
        <label className="xs-switch">
          <input type="checkbox" checked={!!draft.enabled} onChange={(e) => patch({ enabled: e.target.checked })} />
          <span className="xs-switch-track" aria-hidden="true" />
          <span className="xs-switch-text">{draft.enabled ? "Sound notifications on" : "Sound notifications off"}</span>
        </label>
      </div>

      {notice && <div className={`xs-alert ${notice.type}`} role={notice.type === "error" ? "alert" : "status"} style={{ marginBottom: 16 }}>{notice.text}</div>}

      <div className={`xs-grid two${disabled ? " xs-dim" : ""}`}>
        <section className="xs-card" aria-label="Sound">
          <h3>Notification sound</h3>
          <p className="xs-card-sub">Pick a sound and use Preview to hear it at the current volume.</p>
          <div role="radiogroup" aria-label="Notification sound" className="xs-sound-grid">
            {soundOptions.map((s) => (
              <div key={s.id} className={`xs-sound${draft.selectedSound === s.id ? " selected" : ""}`}>
                <label className="xs-sound-pick">
                  <input
                    type="radio"
                    name="beep-sound"
                    value={s.id}
                    checked={draft.selectedSound === s.id}
                    onChange={() => patch({ selectedSound: s.id })}
                    disabled={disabled}
                  />
                  <span>{s.name}</span>
                </label>
                <button type="button" className="xs-btn" onClick={() => preview(s.id)} aria-label={`Preview ${s.name}`}>
                  {playing === s.id ? "Playing…" : "▶ Preview"}
                </button>
              </div>
            ))}
          </div>
          <div className="xs-field" style={{ marginTop: 18 }}>
            <label htmlFor="beep-volume">Volume: {draft.volume}%</label>
            <input id="beep-volume" type="range" min="0" max="100" step="5" value={draft.volume} disabled={disabled} onChange={(e) => patch({ volume: Number(e.target.value) })} />
          </div>
        </section>

        <section className="xs-card" aria-label="Timing">
          <h3>Notification timing</h3>
          <p className="xs-card-sub">How often the sound repeats while a notification is waiting.</p>
          <div role="radiogroup" aria-label="Notification timing" className="xs-chips">
            {TIMING_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={draft.timing === o.value}
                className={`xs-chip${draft.timing === o.value ? " selected" : ""}`}
                disabled={disabled}
                onClick={() => patch({ timing: o.value })}
              >
                {o.label}
              </button>
            ))}
          </div>

          <div className="xs-field" style={{ marginTop: 22 }}>
            <label htmlFor="beep-reminder">Reminder delay: {draft.reminderDelay} seconds</label>
            <input id="beep-reminder" type="range" min="10" max="300" step="10" value={draft.reminderDelay} disabled={disabled} onChange={(e) => patch({ reminderDelay: Number(e.target.value) })} />
            <span className="xs-hint">How long after you dismiss a reminder popup before it appears again.</span>
          </div>
        </section>
      </div>

      <div className="xs-actions">
        <button type="button" className="xs-btn" onClick={reset}>Reset to default</button>
        <button type="button" className="xs-btn primary" onClick={save}>Save settings</button>
      </div>
    </div>
  );
}

export default BeepSound;
