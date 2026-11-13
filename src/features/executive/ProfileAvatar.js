import React, { useEffect, useState } from "react";
import { getOwnExecutivePhoto } from "../../services/apiService";

// Fetches the signed-in executive's own photo through the authenticated API (no public
// URL, no new storage) and returns an object URL, or null when there is no photo / the
// request fails. `hasPhoto === false` (known from the profile record) skips the request.
export const useOwnPhotoUrl = (userId, hasPhoto) => {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    setUrl(null);
    if (!userId || hasPhoto === false) return undefined;
    let alive = true;
    let objectUrl;
    getOwnExecutivePhoto()
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
  }, [userId, hasPhoto]);
  return url;
};

// Photo when available, initials when there is none or the image fails to load.
const ProfileAvatar = ({ url, initial, className, alt = "Profile photo" }) => {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [url]);
  return (
    <span className={`${className} has-photo-wrap`} aria-hidden={url && !broken ? undefined : "true"}>
      {url && !broken ? <img className="profile-avatar-img" src={url} alt={alt} onError={() => setBroken(true)} /> : initial}
    </span>
  );
};

export default ProfileAvatar;
