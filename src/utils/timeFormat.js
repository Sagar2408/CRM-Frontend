// HH:MM:SS from a number of seconds (hours are not wrapped at 24).
export const formatDuration = (totalSeconds) => {
  const s = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
};
