import { useEffect, useState } from "react";

export default function Home() {
  const [me, setMe] = useState(null);
  const [loadingMe, setLoadingMe] = useState(true);

  const [groupName, setGroupName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/auth/me");
        const j = await r.json();
        setMe(j.user || null);
      } finally {
        setLoadingMe(false);
      }
    })();
  }, []);

  async function createGroup() {
    setMsg("");
    setBusy(true);
    try {
      const r = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: groupName }),
      });
      const j = await r.json();
      if (!r.ok) setMsg(j.error || "Error");
      else window.location.href = `/group/${j.group.id}`;
    } catch (e) {
      setMsg(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function joinGroup() {
    setMsg("");
    setBusy(true);
    try {
      const r = await fetch("/api/groups/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode }),
      });
      const j = await r.json();
      if (!r.ok) setMsg(j.error || "Error");
      else window.location.href = `/group/${j.groupId}`;
    } catch (e) {
      setMsg(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.href = "/";
    }
  }

  const profileName = me?.display_name || me?.steamid64 || "Profil";
  const profileInitial = (profileName || "P").slice(0, 1).toUpperCase();

  const pageBackgroundStyle = {
    minHeight: "100dvh",
    width: "100%",
    position: "relative",
    overflowX: "hidden",
    margin: 0,
    padding: 0,
    color: "#e8f2ff",
    background:
      "radial-gradient(circle at 20% 10%, #16315f 0%, transparent 45%), radial-gradient(circle at 85% 15%, #4b1f49 0%, transparent 40%), linear-gradient(145deg, #05080f 0%, #0a1322 55%, #060b16 100%)",
  };

  const gridOverlayStyle = {
    position: "fixed",
    inset: 0,
    pointerEvents: "none",
    backgroundImage:
      "linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)",
    backgroundSize: "36px 36px",
  };

  const contentStyle = {
    position: "relative",
    zIndex: 1,
    padding: "92px 40px 40px",
    fontFamily: "system-ui",
    maxWidth: 900,
    margin: "0 auto",
  };

  if (loadingMe) {
    return (
      <div style={pageBackgroundStyle}>
        <div aria-hidden="true" style={gridOverlayStyle} />
        <div style={contentStyle}>Loading...</div>
      </div>
    );
  }

  if (!me) {
    return (
      <div style={pageBackgroundStyle}>
        <div aria-hidden="true" style={gridOverlayStyle} />
        <div style={contentStyle}>
          <header
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              zIndex: 3,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              borderBottom: "1px solid rgba(255,255,255,0.16)",
              padding: "10px 22px",
              background: "rgba(6, 12, 22, 0.86)",
              backdropFilter: "blur(8px)",
            }}
          >
            <a
              href="/"
              style={{ display: "inline-flex", alignItems: "center", gap: 10, color: "#e8f2ff", textDecoration: "none" }}
            >
              <img src="/trophytracker-logo.png" alt="TrophyTracker Logo" style={{ width: 24, height: 24 }} />
              <strong style={{ letterSpacing: "0.04em", textTransform: "uppercase" }}>TrophyTracker</strong>
            </a>
          </header>
          <h1>Steam Achievement Groups</h1>
          <p>Logge dich ein, um Gruppen zu erstellen oder beizutreten.</p>
          <a href="/api/auth/steam/start">
            <button style={{ padding: "10px 14px", marginTop: 10 }}>Sign in with Steam</button>
          </a>
        </div>
      </div>
    );
  }

  return (
    <div style={pageBackgroundStyle}>
      <div aria-hidden="true" style={gridOverlayStyle} />
      <div style={contentStyle}>
        <header
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 3,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            borderBottom: "1px solid rgba(255,255,255,0.16)",
            padding: "10px 22px",
            background: "rgba(6, 12, 22, 0.86)",
            backdropFilter: "blur(8px)",
          }}
        >
          <a
            href="/"
            style={{ display: "inline-flex", alignItems: "center", gap: 10, color: "#e8f2ff", textDecoration: "none" }}
          >
            <img src="/trophytracker-logo.png" alt="TrophyTracker Logo" style={{ width: 24, height: 24 }} />
            <strong style={{ letterSpacing: "0.04em", textTransform: "uppercase" }}>TrophyTracker</strong>
          </a>

          <nav style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            <a
              href="#support"
              style={{
                color: "#9defff",
                textDecoration: "none",
                border: "1px solid rgba(0, 234, 255, 0.32)",
                borderRadius: 999,
                padding: "7px 11px",
                background: "rgba(0, 234, 255, 0.12)",
                fontWeight: 700,
              }}
            >
              Support TrophyTracker
            </a>
            <a
              href={`/user/${me.id}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                color: "#e8f2ff",
                textDecoration: "none",
                border: "1px solid rgba(255,255,255,0.22)",
                borderRadius: 999,
                padding: "7px 11px",
                background: "rgba(255,255,255,0.05)",
                fontWeight: 700,
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  background: "rgba(0, 234, 255, 0.18)",
                  border: "1px solid rgba(0, 234, 255, 0.4)",
                }}
              >
                {profileInitial}
              </span>
              <span>{profileName}</span>
            </a>
            <button
              onClick={logout}
              style={{
                border: "1px solid rgba(255, 123, 0, 0.45)",
                borderRadius: 999,
                padding: "7px 11px",
                background: "rgba(255, 123, 0, 0.2)",
                color: "#ffd6b6",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Logout
            </button>
          </nav>
        </header>

        <h1>Steam Achievement Groups</h1>
        <p style={{ opacity: 0.8 }}>
          Eingeloggt als: <b>{me.display_name || me.steamid64}</b>
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
          <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16 }}>
            <h2 style={{ marginTop: 0 }}>Gruppe erstellen</h2>
            <input
              placeholder="Gruppenname"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              style={{ padding: 10, width: "90%", marginBottom: 10 }}
            />
            <button
              onClick={createGroup}
              disabled={!groupName || busy}
              style={{ padding: "10px 14px" }}
            >
              {busy ? "..." : "Create"}
            </button>
          </div>

          <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16 }}>
            <h2 style={{ marginTop: 0 }}>Gruppe beitreten</h2>
            <input
              placeholder="Invite-Code"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              style={{ padding: 10, width: "90%", marginBottom: 10 }}
            />
            <button
              onClick={joinGroup}
              disabled={!inviteCode || busy}
              style={{ padding: "10px 14px" }}
            >
              {busy ? "..." : "Join"}
            </button>
          </div>
        </div>

        {msg && <p style={{ color: "crimson", marginTop: 12 }}>{msg}</p>}

        <p style={{ marginTop: 20, fontSize: 12, opacity: 0.7 }}>
          Tipp: Invite-Code bekommst du auf der Gruppenseite.
        </p>
        <p id="support" style={{ marginTop: 10, fontSize: 12, opacity: 0.85 }}>
          Support TrophyTracker: Bei Problemen sende dein Anliegen inkl. Group-ID und SteamID an den Admin.
        </p>
      </div>
    </div>
  );
}
