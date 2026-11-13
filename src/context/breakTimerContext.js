import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { useExecutiveActivity, useWorkClock } from "./ExecutiveActivityContext";
import { useProcessService } from "./ProcessServiceContext";
// Create Break Timer Context
const BreakTimerContext = createContext();


// Provider Component
export const BreakTimerProvider = ({ children }) => {
  const { handleStartBreak, handleStopBreak, user: activityUser } = useExecutiveActivity() || {};
  // Executives: break state and time live on the server (work time pauses while
  // on break). Every other panel (Process) keeps its original local timer.
  const isExecutive = String(activityUser?.role || "").toLowerCase() === "executive";
  const clock = useWorkClock();
  const {createStartBreak,createStopBreak}=useProcessService();
  const [breakTimer, setBreakTimer] = useState("00:00:00");
  const [isBreakActive, setIsBreakActive] = useState(false);
  const [timerLoading, setTimerLoading] = useState(false);
  const [totalPausedSeconds, setTotalPausedSeconds] = useState(0);

  const intervalRef = useRef(null);

  // -----------------------
  // Timer Helpers
  // -----------------------
  const startTimer = useCallback((startTime, previousSeconds = 0) => {
    clearInterval(intervalRef.current);

    intervalRef.current = setInterval(() => {
      const now = new Date();
      const diffSeconds = Math.floor((now - startTime) / 1000);
      setBreakTimer(formatTime(previousSeconds + diffSeconds));
    }, 1000);
  }, []);

  const formatTime = (totalSeconds) => {
    const pad = (num) => String(num).padStart(2, "0");
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  };

  const breakTimerToSeconds = (timeString) => {
    const [hours, minutes, seconds] = timeString.split(":").map(Number);
    return hours * 3600 + minutes * 60 + seconds;
  };

  // On mount: restore break session state
  useEffect(() => {
    const breakStart = localStorage.getItem("breakStartTime");
    const pausedSeconds = parseInt(localStorage.getItem("pausedBreakSeconds"));

    if (pausedSeconds) {
      setTotalPausedSeconds(pausedSeconds);
      setBreakTimer(formatTime(pausedSeconds));
    }

    if (breakStart) {
      setIsBreakActive(true);
      const start = new Date(breakStart);
      startTimer(start, pausedSeconds || 0);
    }

    return () => clearInterval(intervalRef.current);
  }, [startTimer]);

  // -----------------------
  // Break Actions
  // -----------------------
  const startBreak = async () => {
    try {
      setTimerLoading(true);
      if (isExecutive) {
        await handleStartBreak();
        return;
      }
      await handleStartBreak();

      const start = new Date();
      localStorage.setItem("breakStartTime", start);

      setIsBreakActive(true);
      startTimer(start, totalPausedSeconds);
    } catch (error) {
      console.error("❌ Error starting break:", error.message);
    } finally {
      setTimerLoading(false);
    }
  };
   const processstartBreak = async (id) => {
    try {
      setTimerLoading(true);
      await createStartBreak(id);

      const start = new Date();
      localStorage.setItem("breakStartTime", start);

      setIsBreakActive(true);
      startTimer(start, totalPausedSeconds);
    } catch (error) {
      console.error("❌ Error starting break:", error.message);
    } finally {
      setTimerLoading(false);
    }
  };

  const stopBreak = async () => {
    try {
      setTimerLoading(true);
      if (isExecutive) {
        await handleStopBreak();
        return;
      }
      await handleStopBreak();

      clearInterval(intervalRef.current);

      const currentTimer = breakTimerToSeconds(breakTimer);
      setTotalPausedSeconds(currentTimer);
      localStorage.setItem("pausedBreakSeconds", currentTimer);

      localStorage.removeItem("breakStartTime");
      setIsBreakActive(false);
    } catch (error) {
      console.error("❌ Error stopping break:", error.message);
    } finally {
      setTimerLoading(false);
    }
  };
  const processstopBreak = async (id) => {
    try {
      setTimerLoading(true);
      await createStopBreak(id);

      clearInterval(intervalRef.current);

      const currentTimer = breakTimerToSeconds(breakTimer);
      setTotalPausedSeconds(currentTimer);
      localStorage.setItem("pausedBreakSeconds", currentTimer);

      localStorage.removeItem("breakStartTime");
      setIsBreakActive(false);
    } catch (error) {
      console.error("❌ Error stopping break:", error.message);
    } finally {
      setTimerLoading(false);
    }
  };

  const resetBreakTimer = () => {
    clearInterval(intervalRef.current);
    setBreakTimer("00:00:00");
    setIsBreakActive(false);
    setTotalPausedSeconds(0);

    localStorage.removeItem("breakStartTime");
    localStorage.removeItem("pausedBreakSeconds");
  };

  // -----------------------
  // Provider Return
  // -----------------------
  return (
    <BreakTimerContext.Provider
      value={{
        breakTimer: isExecutive ? clock.breakTimer : breakTimer,
        isBreakActive: isExecutive ? clock.onBreak : isBreakActive,
        timerLoading,
        startBreak,
        stopBreak,
        resetBreakTimer,
        processstartBreak,
        processstopBreak
      }}
    >
      {children}
    </BreakTimerContext.Provider>
  );
};

// Hook for using Break Timer Context
export const useBreakTimer = () => useContext(BreakTimerContext);