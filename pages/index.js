import { useState } from "react";

const wrapStyle = {
  maxWidth: 1160,
  margin: "0 auto",
  padding: "34px 24px 42px",
  color: "#eef4ff",
  fontFamily: "system-ui",
};

const heroStyle = {
  border: "1px solid rgba(255, 255, 255, 0.13)",
  borderRadius: 18,
  background: "linear-gradient(180deg, #0f1c33, #0a1527)",
  boxShadow: "0 20px 48px rgba(0, 0, 0, 0.35)",
  padding: "26px 24px",
};

const sectionTitle = { marginTop: 28, marginBottom: 12, fontSize: 28 };

const statGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
};

const cardStyle = {
  border: "1px solid rgba(255, 255, 255, 0.13)",
  borderRadius: 12,
  background: "rgba(16, 29, 52, 0.75)",
  padding: 16,
};

const actionCard = {
  border: "1px solid rgba(47, 255, 178, 0.35)",
  borderRadius: 12,
  background: "linear-gradient(140deg, rgba(47, 255, 178, 0.13), rgba(47, 140, 255, 0.12))",
  padding: 20,
};

const compactActionCard = {
  ...actionCard,
  padding: 14,
  borderRadius: 10,
};

const primaryButton = {
  padding: "12px 18px",
  color: "#ffffff",
  background: "linear-gradient(135deg, #2f8cff, #52a6ff)",
  border: "1px solid rgba(118, 179, 255, 0.4)",
  borderRadius: 999,
  fontWeight: 700,
  cursor: "pointer",
};

const ghostButton = {
  padding: "12px 18px",
  color: "#cdd8ec",
  background: "rgba(255, 255, 255, 0.04)",
  border: "1px solid rgba(255, 255, 255, 0.13)",
  borderRadius: 999,
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

const compactInputStyle = {
  ...inputStyle,
  marginTop: 8,
  marginBottom: 8,
  padding: "8px 10px",
  borderRadius: 8,
};

const compactButtonStyle = {
  ...primaryButton,
  width: "100%",
  padding: "9px 12px",
  borderRadius: 10,
};

const compactGhostButtonStyle = {
  ...ghostButton,
  width: "100%",
  padding: "9px 12px",
  borderRadius: 10,
};

function StepCard({ n, title, text }) {
  return (
    <article style={cardStyle}>
      <div
        style={{
          display: "inline-block",
          fontSize: 12,
          color: "#9ed5ff",
          border: "1px solid rgba(158, 213, 255, 0.35)",
          borderRadius: 999,
          padding: "4px 8px",
          marginBottom: 8,
        }}
      >
        Schritt {n}
      </div>
      <h3 style={{ marginTop: 0, marginBottom: 6 }}>{title}</h3>
      <p style={{ margin: 0, color: "#a7b5cc" }}>{text}</p>
    </article>
  );
}

function FeatureCard({ title, text }) {
  return (
    <article style={cardStyle}>
      <div
        style={{
          display: "inline-block",
          fontSize: 12,
          color: "#9ed5ff",
          border: "1px solid rgba(158, 213, 255, 0.35)",
          borderRadius: 999,
          padding: "4px 8px",
          marginBottom: 8,
        }}
      >
        Feature
      </div>
      <h3 style={{ marginTop: 0, marginBottom: 6 }}>{title}</h3>
      <p style={{ margin: 0, color: "#a7b5cc" }}>{text}</p>
    </article>
  );
}

export default function Home({ appUser, authChecked }) {
  const me = appUser || null;
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [msg, setMsg] = useState("");
  const [busyAction, setBusyAction] = useState(null);

  const busy = busyAction !== null;

  async function createGroup() {
    const name = groupName.trim();
    const description = groupDescription.trim();
    if (!name || busy) return;

    setMsg("");
    setBusyAction("create");
    try {
      const r = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
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
      <section
        style={{
          ...heroStyle,
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.2fr) minmax(260px, 1fr)",
          gap: 24,
          alignItems: "center",
        }}
      >
        <div>
          <div
            style={{
              color: "#87b4ff",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginBottom: 6,
            }}
          >
            Group Achievement Tracking
          </div>
          <h1 style={{ marginTop: 0, marginBottom: 12, fontSize: "clamp(36px, 6vw, 58px)", lineHeight: 1.05 }}>
            Rediscover your games. Share your success.
          </h1>
          <p style={{ marginTop: 0, color: "#a7b5cc", maxWidth: 620, fontSize: 18 }}>
            Organisiere deine Crew, erstelle Ranglisten und vergleiche Fortschritte in Echtzeit.
            TrophyTracker bringt euer Achievement-Hunting in einen gemeinsamen Hub.
          </p>
          {!me ? (
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 24 }}>
              <a href="/api/auth/steam/start">
                <button style={primaryButton}>Mit Steam starten</button>
              </a>
              <a href="#quick-actions">
                <button style={ghostButton}>So funktioniert es</button>
              </a>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 24 }}>
              <a href={`/user/${me.id}`}>
                <button style={ghostButton}>Zu meinem Profil</button>
              </a>
              <a href="#quick-actions">
                <button style={primaryButton}>Direkt loslegen</button>
              </a>
            </div>
          )}
        </div>
        <div style={{ border: "1px solid rgba(255, 255, 255, 0.12)", borderRadius: 12, padding: 14 }}>
          <img
            src="/trophytracker-logo.png"
            alt="TrophyTracker Logo"
            style={{
              width: "100%",
              maxWidth: 280,
              aspectRatio: "1 / 1",
              objectFit: "contain",
              display: "block",
              margin: "0 auto",
            }}
          />
        </div>
      </section>

      <section style={{ ...statGrid, marginTop: 12 }}>
        <article style={cardStyle}>
          <b style={{ fontSize: 24 }}>1.2k+</b>
          <span style={{ display: "block", marginTop: 4, color: "#a7b5cc", fontSize: 13 }}>aktive Gruppen</span>
        </article>
        <article style={cardStyle}>
          <b style={{ fontSize: 24 }}>95k+</b>
          <span style={{ display: "block", marginTop: 4, color: "#a7b5cc", fontSize: 13 }}>getrackte Achievements</span>
        </article>
        <article style={cardStyle}>
          <b style={{ fontSize: 24 }}>40+</b>
          <span style={{ display: "block", marginTop: 4, color: "#a7b5cc", fontSize: 13 }}>Top Games im Fokus</span>
        </article>
        <article style={cardStyle}>
          <b style={{ fontSize: 24 }}>24/7</b>
          <span style={{ display: "block", marginTop: 4, color: "#a7b5cc", fontSize: 13 }}>Sync und Vergleich</span>
        </article>
      </section>

      <h2 id="quick-actions" style={sectionTitle}>Schnellstart</h2>
      {!me ? (
        <section style={actionCard}>
          <p style={{ marginTop: 0, color: "#a7b5cc" }}>
            Logge dich ein, um direkt Gruppen zu erstellen, Invite-Codes zu nutzen und Ranglisten zu sehen.
          </p>
          <a href="/api/auth/steam/start">
            <button style={primaryButton}>Sign in with Steam</button>
          </a>
        </section>
      ) : (
        <section style={{ ...statGrid, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 10 }}>
          <form
            style={compactActionCard}
            onSubmit={(e) => {
              e.preventDefault();
              createGroup();
            }}
          >
            <h3 style={{ marginTop: 0 }}>Gruppe erstellen</h3>
            <p style={{ margin: 0, color: "#a7b5cc", fontSize: 14 }}>Neue Gruppe in Sekunden anlegen.</p>
            <input
              placeholder="Gruppenname"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              style={compactInputStyle}
            />
            <textarea
              placeholder="Beschreibung (optional)"
              value={groupDescription}
              onChange={(e) => setGroupDescription(e.target.value)}
              maxLength={500}
              rows={3}
              style={{ ...compactInputStyle, resize: "vertical", minHeight: 78 }}
            />
            <button type="submit" disabled={!groupName.trim() || busy} style={compactButtonStyle}>
              {busyAction === "create" ? "Erstelle..." : "Create"}
            </button>
          </form>

          <form
            style={compactActionCard}
            onSubmit={(e) => {
              e.preventDefault();
              joinGroup();
            }}
          >
            <h3 style={{ marginTop: 0 }}>Gruppe beitreten</h3>
            <p style={{ margin: 0, color: "#a7b5cc", fontSize: 14 }}>Invite-Code eingeben und direkt beitreten.</p>
            <input
              placeholder="Invite-Code"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              style={compactInputStyle}
            />
            <button type="submit" disabled={!inviteCode.trim() || busy} style={compactGhostButtonStyle}>
              {busyAction === "join" ? "Trete bei..." : "Join"}
            </button>
          </form>
        </section>
      )}

      {msg ? <p style={{ color: "#ff9db0", marginTop: 12 }}>{msg}</p> : null}

      <h2 style={sectionTitle}>So funktioniert's</h2>
      <section style={{ ...statGrid, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
        <StepCard n="1" title="Einloggen" text="Melde dich mit Steam an, damit dein Profil und Spiele geladen werden." />
        <StepCard n="2" title="Gruppe verbinden" text="Erstelle eine Gruppe oder tritt mit Invite-Code einer bestehenden Gruppe bei." />
        <StepCard n="3" title="Rangliste starten" text="Waehle einen Modus und vergleiche euren Fortschritt in einer Matrix." />
      </section>

      <h2 style={sectionTitle}>Was du bekommst</h2>
      <section style={{ ...statGrid, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
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
