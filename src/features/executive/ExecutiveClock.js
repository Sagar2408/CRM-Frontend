import React, { useEffect, useState } from "react";
import { FaPlay, FaStop } from "react-icons/fa";
import { useWorkClock } from "../../context/ExecutiveActivityContext";
import { useBreakTimer } from "../../context/breakTimerContext";
import "../../styles/executiveClock.css";

// Compact navbar clock for the Executive panel: server-backed Work and Break
// timers around a small analog face (live local time). The Break button starts /
// ends a break, which pauses / resumes the work timer. One 44px-high row so it
// never pushes or overlaps the other header items.
const TICKS = [0, 3, 6, 9];

const ExecutiveClock = () => {
  const { workTimer, breakTimer, onBreak, working, loaded } = useWorkClock();
  const { startBreak, stopBreak, timerLoading } = useBreakTimer();
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

  const mode = !loaded ? "idle" : onBreak ? "break" : working ? "working" : "idle";
  const statusLabel = !loaded ? "Connecting" : onBreak ? "On break" : working ? "Working" : "Not started";
  const timeLabel = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const toggleBreak = () => {
    if (timerLoading || !loaded) return;
    (onBreak ? stopBreak() : startBreak()).catch?.(() => {});
  };

  return (
    <div className={`exec-clock is-${mode}`} role="group" aria-label={`Work timer: ${statusLabel}`}>
      <div className="exec-clock__cell" title={statusLabel}>
        <span className="exec-clock__label">
          <span className="exec-clock__dot" aria-hidden="true" />
          Work
        </span>
        <span className="exec-clock__value" aria-label={`Work time ${workTimer}`}>
          {workTimer}
        </span>
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
        <span className="exec-clock__value" aria-label={`Break time ${breakTimer}`}>
          {breakTimer}
        </span>
      </div>

      <button
        type="button"
        className={`exec-clock__btn ${onBreak ? "is-end" : ""}`}
        onClick={toggleBreak}
        disabled={timerLoading || !loaded || (!onBreak && !working)}
        aria-pressed={onBreak}
        aria-label={onBreak ? "End break and resume work" : "Start a break (pauses work time)"}
        title={onBreak ? "End break and resume work" : "Start a break (pauses work time)"}
      >
        {onBreak ? <FaStop aria-hidden="true" /> : <FaPlay aria-hidden="true" />}
        <span className="exec-clock__btn-text">{onBreak ? "End" : "Break"}</span>
      </button>
    </div>
  );
};

export default ExecutiveClock;
