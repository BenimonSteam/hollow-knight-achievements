import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

export default function GroupPage() {
  const router = useRouter();
  const { id } = router.query;

  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [err, setErr] = useState("");

  const [appid, setAppid] = useState("");
  const [compare, setCompare] = useState(null);
  const [loadingCompare, setLoadingCompare] = useState(false);

  useEffect(() => {
    if (!id) return;

    (async () => {
      setErr("");
      const r = await fetch(`/api/groups/${id}`);
      const j = await r.json();
      if (!r.ok) {
        setErr(j.error || "Failed to load group");
        return;
      }
      setGroup(j.group);
      setMembers(j.members || []);
      setAppid(j.group?.active_appid ? String(j.group.active_appid) : "");
    })();
  }, [id]);

  const isOwner = useMemo(() => {
    if (!group) return false;
    // members enthält role + users; owner role steht im group_members
    const meMember = members.find(m => m.role === "owner");
    // Das ist nicht perfekt für "bin ich owner", aber für MVP ok,
    // weil du beim Create Group als owner eingetragen wirst.
    // Besser wäre: /api/auth/me + Abgleich user.id mit group.owner_user_id.
    return !!meMember;
  }, [group, members]);

  async function saveGame() {
    setErr("");
    if (!appid) return;
    const r = await fetch(`/api/groups/${id}/set-game`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appid }),
    });
    const j = await r.json();
    if (!r.ok) setErr(j.error || "Failed to save game");
    else {
      // refresh group
      const rr = await fetch(`/api/groups/${id}`);
      const jj = await rr.json();
      if (rr.ok) setGroup(jj.group);
    }
  }

  async function loadCompare() {
    setErr("");
    setCompare(null);
    if (!appid) return;

    setLoadingCompare(true);
    try {
      const r = await fetch(`/api/groups/${id}/compare?appid=${encodeURIComponent(appid)}`);
      const j = await r.json();
      if (!r.ok) setErr(j.error || "Compare failed");
      else setCompare(j);
    } catch (e) {
      setErr(String(e));
    } finally {
      setLoadingCompare(false);
    }
  }

  if (!id) return <div style={{ padding: 40, fontFamily: "system-ui" }}>Loading…</div>;

  return (
    <div style={{ padding: 40, fontFamily: "system-ui", maxWidth: 1100, margin: "0 auto" }}>
      <a href="/" style={{ display: "inline-block", marginBottom: 12 }}>← Home</a>

      <h1>{group ? group.name : "Group"}</h1>

      {err && <p style={{ color: "crimson" }}>{err}</p>}

      {group && (
        <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16, marginTop: 12 }}>
          <div>
            <b>Invite Code:</b> {group.invite_code}
          </div>
          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>
            Tipp: Teile den Code. Andere gehen auf Home → “Join Group”.
          </div>
        </div>
      )}

      <h2 style={{ marginTop: 24 }}>Mitglieder</h2>
      <ul>
        {members.map((m) => (
          <li key={m.users.steamid64}>
            {m.users.display_name || m.users.steamid64}{" "}
            <span style={{ opacity: 0.7 }}>({m.role})</span>
          </li>
        ))}
      </ul>

      <h2 style={{ marginTop: 24 }}>Spiel auswählen</h2>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input
          value={appid}
          onChange={(e) => setAppid(e.target.value)}
          placeholder="AppID (z.B. 367520)"
          style={{ padding: 10, minWidth: 240 }}
        />
        <button onClick={loadCompare} disabled={!appid || loadingCompare} style={{ padding: "10px 14px" }}>
          {loadingCompare ? "Vergleiche..." : "Compare"}
        </button>

        <button onClick={saveGame} disabled={!appid} style={{ padding: "10px 14px" }}>
          Save as group game
        </button>
      </div>

      {group?.active_appid ? (
        <p style={{ marginTop: 8, opacity: 0.8 }}>
          Aktives Gruppenspiel: <b>{group.active_appid}</b>
        </p>
      ) : null}

      {compare && (
        <div style={{ marginTop: 24 }}>
          <h2>Ranking</h2>
          <ol>
            {compare.members
              .slice()
              .sort((a, b) => (b.unlockedCount || 0) - (a.unlockedCount || 0))
              .map((m) => (
                <li key={m.steamid64}>
                  <b>{m.displayName}</b>{" "}
                  {m.ok ? (
                    <span>
                      — {m.unlockedCount}/{compare.total}
                    </span>
                  ) : (
                    <span style={{ color: "crimson" }}>— nicht verfügbar ({m.error})</span>
                  )}
                </li>
              ))}
          </ol>

          <h2 style={{ marginTop: 24 }}>Achievements (Mini-Matrix Vorschau)</h2>
          <p style={{ fontSize: 12, opacity: 0.8 }}>
            Unten sind nur die ersten 15 Achievements (MVP). Später machen wir Paging/Filter.
          </p>

          <div style={{ overflowX: "auto", border: "1px solid #ddd", borderRadius: 12 }}>
            <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 800 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #ddd" }}>
                    Achievement
                  </th>
                  {compare.members.map((m) => (
                    <th key={m.steamid64} style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #ddd" }}>
                      {m.displayName}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {compare.achievements.slice(0, 15).map((a) => (
                  <tr key={a.apiName}>
                    <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <img src={a.icon} width={32} height={32} style={{ borderRadius: 6 }} />
                        <div>
                          <div style={{ fontWeight: 700 }}>{a.displayName}</div>
                          <div style={{ fontSize: 12, opacity: 0.8 }}>{a.description}</div>
                        </div>
                      </div>
                    </td>
                    {compare.members.map((m) => {
                      const ok = compare.matrix?.[a.apiName]?.[m.steamid64];
                      return (
                        <td key={m.steamid64} style={{ padding: 10, borderBottom: "1px solid #eee" }}>
                          {ok ? "✅" : "—"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
