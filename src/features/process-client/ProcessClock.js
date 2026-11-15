import React, { useEffect, useState } from "react";
import { FaPlay, FaStop } from "react-icons/fa";
import "../../styles/executiveClock.css";

const TICKS = [0, 3, 6, 9];

// Header work / break clock for the Process Person panel. Same look as the Executive
// clock (shared executiveClock.css); every number comes from useProcessWorkClock, which
// is backed by the server-side work session.
const ProcessClock = ({ clock }) => {
  const { workTimer: work, breakTimer, onBreak: isBreakActive, busy: timerLoading, loaded, toggleBreak: toggle } = clock;
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const sec = now.getSeconds();
  const min = now.getMinutes();
  const hourDeg = (now.getHours() % 12) * 30 + min * 0.5;
  const minuteDeg = min * 6 + sec * 0.1;
  const secondDeg = sec * 6;
  const mode = !loaded ? "idle" : isBreakActive ? "break" : "working";
  const statusLabel = !loaded ? "Connecting" : isBreakActive ? "On break" : "Working";
  const timeLabel = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const toggleBreak = () => {
    if (timerLoading || !loaded) return;
    toggle();
  };

  return (
    <div className={`exec-clock is-${mode}`} role="group" aria-label={`Work timer: ${statusLabel}`}>
      <div className="exec-clock__cell" title={statusLabel}>
        <span className="exec-clock__label">
          <span className="exec-clock__dot" aria-hidden="true" />
          Work
        </span>
        <span className="exec-clock__value" aria-label={`Work time ${work}`}>{work}</span>
      </div>

      <div className="exec-clock__face" role="img" aria-label={`Current time ${timeLabel}`} title={timeLabel}>
        {TICKS.map((i) => (
          <span key={i} className="exec-clock__tick" style={{ transform: `rotate(${i * 30}deg)` }} />
        ))}
        <span className="exec-clock__hand exec-clock__hand--hour" style={{ transform: `rotate(${hourDeg}deg)` }} />
        <span className="exec-clock__hand exec-clock__hand--minute" style={{ transform: `rotate(${minuteDeg}deg)` }} />
        <span className="exec-clock__hand exec-clock__hand--second" style={{ transform: `rotate(${secondDeg}deg)` }} />
        <span className="exec-clock__pin" />
      </div>

      <div className="exec-clock__cell exec-clock__cell--break">
        <span className="exec-clock__label">Break</span>
        <span className="exec-clock__value" aria-label={`Break time ${breakTimer}`}>{breakTimer}</span>
      </div>

      <button
        type="button"
        className={`exec-clock__btn ${isBreakActive ? "is-end" : ""}`}
        onClick={toggleBreak}
        disabled={timerLoading || !loaded}
        aria-pressed={isBreakActive}
        aria-label={isBreakActive ? "End break and resume work" : "Start a break"}
        title={isBreakActive ? "End break and resume work" : "Start a break"}
      >
        {isBreakActive ? <FaStop aria-hidden="true" /> : <FaPlay aria-hidden="true" />}
        <span className="exec-clock__btn-text">{isBreakActive ? "End" : "Break"}</span>
      </button>
    </div>
  );
};

export default ProcessClock;
