import { useState } from "react";

const wrapStyle = {
  maxWidth: 1080,
  margin: "0 auto",
  padding: "24px 28px 40px",
  color: "#e8f2ff",
  fontFamily: "system-ui",
};

const heroStyle = {
  border: "1px solid rgba(0, 234, 255, 0.28)",
  borderRadius: 16,
  background: "linear-gradient(160deg, rgba(16, 26, 45, 0.92), rgba(8, 13, 23, 0.9))",
  boxShadow: "0 0 28px rgba(0, 234, 255, 0.12)",
  padding: "24px 22px",
};

const sectionTitle = { marginTop: 28, marginBottom: 12 };

const cards3 = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 12,
};

const cardStyle = {
  border: "1px solid rgba(255, 255, 255, 0.14)",
  borderRadius: 12,
  background: "rgba(8, 18, 33, 0.72)",
  padding: 14,
};

const actionCard = {
  border: "1px solid rgba(0, 234, 255, 0.28)",
  borderRadius: 12,
  background: "rgba(16, 26, 45, 0.74)",
  padding: 16,
};

const primaryButton = {
  padding: "10px 14px",
  color: "#04131d",
  background: "linear-gradient(90deg, #00d9ff, #2fffb2)",
  border: "1px solid transparent",
  borderRadius: 10,
  fontWeight: 700,
  cursor: "pointer",
};

const ghostButton = {
  padding: "10px 14px",
  color: "#00eaff",
  background: "rgba(0, 234, 255, 0.1)",
  border: "1px solid rgba(0, 234, 255, 0.35)",
  borderRadius: 10,
  fontWeight: 700,
  cursor: "pointer",
};

const inputStyle = {
  display: "block",
  width: "100%",
  marginTop: 10,
  marginBottom: 10,
  padding: 10,
  color: "#e8f2ff",
  background: "rgba(7, 19, 33, 0.85)",
  border: "1px solid rgba(0, 234, 255, 0.35)",
  borderRadius: 10,
};

function StepCard({ n, title, text }) {
  return (
    <article style={cardStyle}>
      <div style={{ fontSize: 12, color: "#9cb3c9", marginBottom: 6 }}>Schritt {n}</div>
      <h3 style={{ marginTop: 0, marginBottom: 6 }}>{title}</h3>
      <p style={{ margin: 0, color: "#9cb3c9" }}>{text}</p>
    </article>
  );
}

function FeatureCard({ title, text }) {
  return (
    <article style={cardStyle}>
      <h3 style={{ marginTop: 0, marginBottom: 6 }}>{title}</h3>
      <p style={{ margin: 0, color: "#9cb3c9" }}>{text}</p>
    </article>
  );
}

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
    return <div style={wrapStyle}>Loading...</div>;
  }

  return (
    <main style={wrapStyle}>
      <section style={{ ...heroStyle, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20 }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ marginTop: 0, marginBottom: 10 }}>Vergleiche Achievements in deiner Gruppe</h1>
          <p style={{ marginTop: 0, color: "#9cb3c9", maxWidth: 820 }}>
            TrophyTracker hilft dir, mit deinem Team Fortschritt sichtbar zu machen: Ranglisten anlegen,
            seltene Achievements tracken und live vergleichen.
          </p>
          {!me ? (
            <a href="/api/auth/steam/start">
              <button style={primaryButton}>Mit Steam starten</button>
            </a>
          ) : (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <a href={`/user/${me.id}`}>
                <button style={ghostButton}>Zu meinem Profil</button>
              </a>
              <a href="#quick-actions">
                <button style={primaryButton}>Direkt loslegen</button>
              </a>
            </div>
          )}
        </div>
        <img
          src="/trophytracker-logo.png"
          alt="TrophyTracker Logo"
          style={{ width: 140, height: 140, objectFit: "contain", flexShrink: 0 }}
        />
      </section>

      <h2 id="quick-actions" style={sectionTitle}>Schnellstart</h2>
      {!me ? (
        <section style={actionCard}>
          <p style={{ marginTop: 0, color: "#9cb3c9" }}>
            Logge dich ein, um direkt Gruppen zu erstellen, Invite-Codes zu nutzen und Ranglisten zu sehen.
          </p>
          <a href="/api/auth/steam/start">
            <button style={primaryButton}>Sign in with Steam</button>
          </a>
        </section>
      ) : (
        <section style={{ ...cards3, gridTemplateColumns: "1fr 1fr" }}>
          <form
            style={actionCard}
            onSubmit={(e) => {
              e.preventDefault();
              createGroup();
            }}
          >
            <h3 style={{ marginTop: 0 }}>Gruppe erstellen</h3>
            <p style={{ margin: 0, color: "#9cb3c9" }}>Lege deine eigene Gruppe fuer Achievement-Tracking an.</p>
            <input
              placeholder="Gruppenname"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              style={inputStyle}
            />
            <button type="submit" disabled={!groupName.trim() || busy} style={primaryButton}>
              {busyAction === "create" ? "Erstelle..." : "Create"}
            </button>
          </form>

          <form
            style={actionCard}
            onSubmit={(e) => {
              e.preventDefault();
              joinGroup();
            }}
          >
            <h3 style={{ marginTop: 0 }}>Gruppe beitreten</h3>
            <p style={{ margin: 0, color: "#9cb3c9" }}>Nutze einen Invite-Code und schliesse dich sofort an.</p>
            <input
              placeholder="Invite-Code"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              style={inputStyle}
            />
            <button type="submit" disabled={!inviteCode.trim() || busy} style={ghostButton}>
              {busyAction === "join" ? "Trete bei..." : "Join"}
            </button>
          </form>
        </section>
      )}

      {msg ? <p style={{ color: "#ff9db0", marginTop: 12 }}>{msg}</p> : null}

      <h2 style={sectionTitle}>So funktioniert's</h2>
      <section style={cards3}>
        <StepCard n="1" title="Einloggen" text="Melde dich mit Steam an, damit dein Profil und Spiele geladen werden." />
        <StepCard n="2" title="Gruppe verbinden" text="Erstelle eine Gruppe oder tritt mit Invite-Code einer bestehenden Gruppe bei." />
        <StepCard n="3" title="Rangliste starten" text="Waehle einen Modus und vergleiche euren Fortschritt in einer Matrix." />
      </section>

      <h2 style={sectionTitle}>Was du bekommst</h2>
      <section style={cards3}>
        <FeatureCard title="Gruppen-Hub" text="Alle Mitglieder, Invite-Code und Spielauswahl zentral in einer Seite." />
        <FeatureCard title="Flexible Ranglisten" text="Overall, seltenste 10 oder Custom-Auswahl fuer gezielte Challenges." />
        <FeatureCard title="Direkter Vergleich" text="Ranking + Achievement-Matrix zeigen sofort, wer bei welchen Zielen vorne liegt." />
      </section>

      <p id="support" style={{ marginTop: 24, fontSize: 12, color: "#9cb3c9" }}>
        Support TrophyTracker: Bei Problemen sende dein Anliegen inkl. Group-ID und SteamID an den Admin.
      </p>
    </main>
  );
}
