import { useState } from "react";

const pageStyle = {
  padding: "24px 40px 40px",
  fontFamily: "system-ui",
  maxWidth: 900,
  margin: "0 auto",
  color: "#e8f2ff",
};

const mutedTextStyle = { color: "#9cb3c9" };
const cardStyle = {
  border: "1px solid rgba(0, 234, 255, 0.3)",
  borderRadius: 12,
  padding: 16,
  background: "rgba(16, 26, 45, 0.72)",
};
const inputStyle = {
  padding: 10,
  width: "90%",
  marginBottom: 10,
  color: "#e8f2ff",
  background: "rgba(7, 19, 33, 0.85)",
  border: "1px solid rgba(0, 234, 255, 0.35)",
  borderRadius: 10,
};
const primaryButtonStyle = {
  padding: "10px 14px",
  color: "#04131d",
  background: "linear-gradient(90deg, #00d9ff, #2fffb2)",
  border: "1px solid transparent",
  borderRadius: 10,
  fontWeight: 700,
};
const ghostButtonStyle = {
  padding: "10px 14px",
  color: "#00eaff",
  background: "rgba(0, 234, 255, 0.1)",
  border: "1px solid rgba(0, 234, 255, 0.35)",
  borderRadius: 10,
  fontWeight: 700,
};
export default function Home({ appUser, authChecked }) {
  const me = appUser || null;
  const [groupName, setGroupName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [msg, setMsg] = useState("");
  const [busyAction, setBusyAction] = useState(null);

  const busy = busyAction !== null;

  async function createGroup() {
    const name = groupName.trim();
    if (!name || busy) return;

    setMsg("");
    setBusyAction("create");
    try {
      const r = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const j = await r.json();
      if (!r.ok) setMsg(j.error || "Error");
      else window.location.href = `/group/${j.group.id}`;
    } catch (e) {
      setMsg(String(e));
    } finally {
      setBusyAction(null);
    }
  }

  async function joinGroup() {
    const code = inviteCode.trim();
    if (!code || busy) return;

    setMsg("");
    setBusyAction("join");
    try {
      const r = await fetch("/api/groups/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode: code }),
      });
      const j = await r.json();
      if (!r.ok) setMsg(j.error || "Error");
      else window.location.href = `/group/${j.groupId}`;
    } catch (e) {
      setMsg(String(e));
    } finally {
      setBusyAction(null);
    }
  }

  if (!authChecked) {
    return <div style={pageStyle}>Loading...</div>;
  }

  if (!me) {
    return (
      <div style={pageStyle}>
        <h1>Steam Achievement Groups</h1>
        <p style={mutedTextStyle}>Logge dich ein, um Gruppen zu erstellen oder beizutreten.</p>
        <a href="/api/auth/steam/start">
          <button style={{ ...primaryButtonStyle, marginTop: 10 }}>Sign in with Steam</button>
        </a>
        <p id="support" style={{ ...mutedTextStyle, marginTop: 18, fontSize: 12, opacity: 0.9 }}>
          Support TrophyTracker: Bei Problemen sende dein Anliegen inkl. SteamID an den Admin.
        </p>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <h1>Steam Achievement Groups</h1>
      <p style={{ ...mutedTextStyle, opacity: 0.95 }}>
        Eingeloggt als: <b>{me.display_name || me.steamid64}</b>
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
        <form
          style={cardStyle}
          onSubmit={(e) => {
            e.preventDefault();
            createGroup();
          }}
        >
          <h2 style={{ marginTop: 0 }}>Gruppe erstellen</h2>
          <input
            placeholder="Gruppenname"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            style={inputStyle}
          />
          <button type="submit" disabled={!groupName.trim() || busy} style={primaryButtonStyle}>
            {busyAction === "create" ? "..." : "Create"}
          </button>
        </form>

        <form
          style={cardStyle}
          onSubmit={(e) => {
            e.preventDefault();
            joinGroup();
          }}
        >
          <h2 style={{ marginTop: 0 }}>Gruppe beitreten</h2>
          <input
            placeholder="Invite-Code"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            style={inputStyle}
          />
          <button type="submit" disabled={!inviteCode.trim() || busy} style={ghostButtonStyle}>
            {busyAction === "join" ? "..." : "Join"}
          </button>
        </form>
      </div>

      {msg ? <p style={{ color: "crimson", marginTop: 12 }}>{msg}</p> : null}

      <p style={{ ...mutedTextStyle, marginTop: 20, fontSize: 12, opacity: 0.9 }}>
        Tipp: Invite-Code bekommst du auf der Gruppenseite.
      </p>
      <p id="support" style={{ ...mutedTextStyle, marginTop: 10, fontSize: 12, opacity: 0.9 }}>
        Support TrophyTracker: Bei Problemen sende dein Anliegen inkl. Group-ID und SteamID an den Admin.
      </p>
    </div>
  );
}
