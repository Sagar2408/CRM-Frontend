import React, { useEffect, useState } from "react";
import { getUserPhoto } from "../../../services/userManagementService";

const COLORS = ["#6366f1", "#0ea5e9", "#14b8a6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#22c55e"];
export const initialsOf = (name) =>
  String(name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("") || "?";
const colorOf = (key) => COLORS[[...String(key)].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];

/**
 * Employee avatar. The photo (when one exists) is fetched through the
 * authenticated, tenant-scoped API as a blob; there is no public URL.
 * `version` forces a refetch after an upload/delete. `preview` shows a
 * local, not-yet-saved image.
 */
const Avatar = ({ user, size = 40, version = 0, preview = null }) => {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    if (!user.hasPhoto) {
      setUrl(null);
      return undefined;
    }
    let alive = true;
    let objectUrl;
    getUserPhoto(user.kind, user.id)
      .then((blob) => {
        if (!alive) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => alive && setUrl(null));
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [user.kind, user.id, user.hasPhoto, version]);

  const src = preview || url;
  const style = { width: size, height: size, fontSize: Math.round(size * 0.38) };
  return src ? (
    <img className="um-avatar" style={style} src={src} alt={`${user.name} profile`} />
  ) : (
    <span className="um-avatar um-avatar-fallback" style={{ ...style, background: colorOf(user.key) }} aria-label={`${user.name} avatar`}>
      {initialsOf(user.name)}
    </span>
  );
};

export default Avatar;
