import { useEffect, useMemo, useState } from "react";
import "../styles/globals.css";

export default function App({ Component, pageProps }) {
  const [me, setMe] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/auth/me");
        const j = await r.json();
        setMe(j.user || null);
      } catch {
        setMe(null);
      } finally {
        setAuthChecked(true);
      }
    })();
  }, []);

  async function logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.href = "/";
    }
  }

  const profileName = me?.display_name || me?.steamid64 || "Profil";
  const profileInitial = useMemo(
    () => profileName.slice(0, 1).toUpperCase(),
    [profileName]
  );
  const profileAvatarUrl = me?.avatar_url || "";

  return (
    <div className="appShell">
      <div aria-hidden="true" className="appGridOverlay" />

      <header className="appHeader">
        <a href="/" className="appBrand">
          <img src="/trophytracker-logo.png" alt="TrophyTracker Logo" className="appBrandLogo" />
          <strong>TrophyTracker</strong>
        </a>

        <nav className="appHeaderNav">
          <a href="#support" className="appSupportLink">
            Support TrophyTracker
          </a>

          {me ? (
            <>
              <a href={`/user/${me.id}`} className="appProfileLink">
                {profileAvatarUrl ? (
                  <img src={profileAvatarUrl} alt="" className="appProfileAvatar" aria-hidden="true" />
                ) : (
                  <span className="appProfileIcon" aria-hidden="true">
                    {profileInitial}
                  </span>
                )}
                <span>{profileName}</span>
              </a>
              <button onClick={logout} aria-label="Logout" title="Logout" className="appPowerButton">
                <svg viewBox="0 0 24 24" aria-hidden="true" className="appPowerIcon">
                  <path d="M12 2v10" />
                  <path d="M6.2 5.3a8 8 0 1 0 11.6 0" />
                </svg>
              </button>
            </>
          ) : (
            <a href="/api/auth/steam/start" className="appSignInLink">
              Sign in
            </a>
          )}
        </nav>
      </header>

      <div className="appContent">
        <Component {...pageProps} appUser={me} authChecked={authChecked} />
      </div>
    </div>
  );
}
