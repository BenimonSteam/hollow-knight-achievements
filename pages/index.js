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

  if (loadingMe) {
    return <div style={{ padding: 40, fontFamily: "system-ui" }}>Loading...</div>;
  }

  if (!me) {
    return (
      <div style={{ padding: 40, fontFamily: "system-ui", maxWidth: 900, margin: "0 auto" }}>
        <h1>Steam Achievement Groups</h1>
        <p>Logge dich ein, um Gruppen zu erstellen oder beizutreten.</p>
        <a href="/api/auth/steam/start">
          <button style={{ padding: "10px 14px", marginTop: 10 }}>Sign in with Steam</button>
        </a>
      </div>
    );
  }

  return (
    <div style={{ padding: 40, fontFamily: "system-ui", maxWidth: 900, margin: "0 auto" }}>
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
            style={{ padding: 10, width: "100%", marginBottom: 10 }}
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
            style={{ padding: 10, width: "100%", marginBottom: 10 }}
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
    </div>
  );
}
