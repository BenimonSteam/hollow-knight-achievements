import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

export default function GroupPage() {
  const router = useRouter();
  const { id } = router.query;

  const [me, setMe] = useState(null);
  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [leaderboards, setLeaderboards] = useState([]);
  const [ownerGames, setOwnerGames] = useState([]);
  const [loadingOwnerGames, setLoadingOwnerGames] = useState(false);
  const [err, setErr] = useState("");

  const [appid, setAppid] = useState("");
  const [compare, setCompare] = useState(null);
  const [loadingCompare, setLoadingCompare] = useState(false);
  const [hoveredLeaderboardId, setHoveredLeaderboardId] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/auth/me");
        const j = await r.json();
        if (r.ok) setMe(j.user || null);
      } catch (e) {
        setErr(String(e));
      }
    })();
  }, []);

  async function loadOwnerGames(ownerSteamid64, preferredAppid) {
    if (!ownerSteamid64) {
      setOwnerGames([]);
      return;
    }

    setLoadingOwnerGames(true);
    try {
      const r = await fetch(`/api/steam/games?steamid=${encodeURIComponent(ownerSteamid64)}`);
      const j = await r.json();
      if (!r.ok) {
        setErr(j.error || "Failed to load owner games");
        setOwnerGames([]);
        return;
      }

      const games = j.games || [];
      setOwnerGames(games);

      if (preferredAppid) {
        const hasPreferred = games.some((g) => String(g.appid) === String(preferredAppid));
        if (!hasPreferred) {
          setAppid(games[0] ? String(games[0].appid) : "");
        }
      } else {
        setAppid((prev) => prev || (games[0] ? String(games[0].appid) : ""));
      }
    } catch (e) {
      setErr(String(e));
      setOwnerGames([]);
    } finally {
      setLoadingOwnerGames(false);
    }
  }

  async function refreshGroup() {
    if (!id) return;

    const r = await fetch(`/api/groups/${id}`);
    const j = await r.json();

    if (!r.ok) {
      setErr(j.error || "Failed to load group");
      return;
    }

    setGroup(j.group);
    const nextMembers = j.members || [];
    setMembers(nextMembers);
    setLeaderboards(j.leaderboards || []);

    const activeAppid = j.group?.active_appid ? String(j.group.active_appid) : "";
    setAppid(activeAppid);

    const ownerSteamid64 = nextMembers.find((m) => m.role === "owner")?.users?.steamid64;
    await loadOwnerGames(ownerSteamid64, activeAppid);
  }

  useEffect(() => {
    if (!id) return;

    (async () => {
      setErr("");
      await refreshGroup();
    })();
  }, [id]);

  async function saveGame() {
    setErr("");
    if (!appid) return;

    const selectedGame = ownerGames.find((g) => String(g.appid) === String(appid));
    const r = await fetch(`/api/groups/${id}/set-game`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appid, title: selectedGame?.name || null }),
    });

    const j = await r.json();
    if (!r.ok) setErr(j.error || "Failed to save game");
    else await refreshGroup();
  }

  async function deleteLeaderboard(appidToDelete) {
    setErr("");
    const r = await fetch(`/api/groups/${id}/set-game`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appid: appidToDelete }),
    });
    const j = await r.json();
    if (!r.ok) {
      setErr(j.error || "Failed to delete leaderboard");
      return;
    }

    if (String(appid) === String(appidToDelete)) {
      setCompare(null);
    }
    await refreshGroup();
  }

  async function loadCompare(appidOverride) {
    setErr("");
    setCompare(null);

    const selectedAppid = appidOverride || appid;
    if (!selectedAppid) return;

    if (appidOverride) setAppid(String(appidOverride));

    setLoadingCompare(true);
    try {
      const r = await fetch(`/api/groups/${id}/compare?appid=${encodeURIComponent(selectedAppid)}`);
      const j = await r.json();
      if (!r.ok) setErr(j.error || "Compare failed");
      else setCompare(j);
    } catch (e) {
      setErr(String(e));
    } finally {
      setLoadingCompare(false);
    }
  }

  const isOwner = !!me && !!group && String(me.id) === String(group.owner_user_id);

  const ownerGamesByAppid = useMemo(() => {
    const map = new Map();
    for (const g of ownerGames) map.set(String(g.appid), g);
    return map;
  }, [ownerGames]);

  if (!id) return <div style={{ padding: 40, fontFamily: "system-ui" }}>Loading...</div>;

  return (
    <div style={{ padding: 40, fontFamily: "system-ui", maxWidth: 1100, margin: "0 auto" }}>
      <a href="/" style={{ display: "inline-block", marginBottom: 12 }}>
        {"<-"} Home
      </a>

      <h1>{group ? group.name : "Group"}</h1>

      {err && <p style={{ color: "crimson" }}>{err}</p>}

      {group && (
        <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16, marginTop: 12 }}>
          <div>
            <b>Invite Code:</b> {group.invite_code}
          </div>
          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>
            Tipp: Teile den Code. Andere gehen auf Home und dann auf Join Group.
          </div>
        </div>
      )}

      <h2 style={{ marginTop: 24 }}>Mitglieder</h2>
      <ul>
        {members.map((m) => (
          <li
            key={m.users?.steamid64 || `${m.role}-${m.joined_at}`}
            style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}
          >
            {m.users?.avatar_url && (
              <img
                src={m.users.avatar_url}
                alt=""
                width={32}
                height={32}
                style={{ borderRadius: "50%" }}
              />
            )}
            <span>
              {m.users?.display_name || m.users?.steamid64 || "Unbekannter User"}
              {m.role ? ` (${m.role})` : ""}
            </span>
          </li>
        ))}
      </ul>

      <h2 style={{ marginTop: 24 }}>Spiel auswaehlen</h2>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <select
          value={appid}
          onChange={(e) => setAppid(e.target.value)}
          disabled={loadingOwnerGames || ownerGames.length === 0}
          style={{ padding: 10, minWidth: 280 }}
        >
          {ownerGames.length === 0 ? (
            <option value="">{loadingOwnerGames ? "Lade Spiele..." : "Keine Spiele gefunden"}</option>
          ) : null}
          {ownerGames.map((g) => (
            <option key={g.appid} value={String(g.appid)}>
              {g.name} (AppID: {g.appid})
            </option>
          ))}
        </select>

        <button onClick={() => loadCompare()} disabled={!appid || loadingCompare} style={{ padding: "10px 14px" }}>
          {loadingCompare ? "Vergleiche..." : "Compare"}
        </button>

        <button onClick={saveGame} disabled={!appid || !isOwner} style={{ padding: "10px 14px" }}>
          Rangliste anlegen
        </button>
      </div>

      {group?.active_appid ? (
        <p style={{ marginTop: 8, opacity: 0.8 }}>
          Aktives Gruppenspiel: <b>{group.active_appid}</b>
        </p>
      ) : null}

      <h2 style={{ marginTop: 24 }}>Ranglisten in dieser Gruppe</h2>
      {leaderboards.length === 0 ? (
        <p style={{ opacity: 0.8 }}>Noch keine Ranglisten angelegt.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {leaderboards.map((lb) => {
            const game = ownerGamesByAppid.get(String(lb.appid));
            return (
              <li
                key={lb.id || `${lb.group_id}-${lb.appid}`}
                onClick={() => loadCompare(String(lb.appid))}
                onMouseEnter={() => setHoveredLeaderboardId(lb.id || `${lb.group_id}-${lb.appid}`)}
                onMouseLeave={() => setHoveredLeaderboardId(null)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    loadCompare(String(lb.appid));
                  }
                }}
                role="button"
                tabIndex={0}
                style={{
                  marginBottom: 10,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  border: hoveredLeaderboardId === (lb.id || `${lb.group_id}-${lb.appid}`) ? "1px solid #7aa6ff" : "1px solid #ddd",
                  borderRadius: 10,
                  padding: 10,
                  cursor: "pointer",
                  background:
                    hoveredLeaderboardId === (lb.id || `${lb.group_id}-${lb.appid}`)
                      ? "linear-gradient(135deg, #f7fbff 0%, #eef5ff 100%)"
                      : "#fff",
                  boxShadow:
                    hoveredLeaderboardId === (lb.id || `${lb.group_id}-${lb.appid}`)
                      ? "0 8px 20px rgba(30, 80, 180, 0.12)"
                      : "0 1px 2px rgba(0, 0, 0, 0.04)",
                  transform: hoveredLeaderboardId === (lb.id || `${lb.group_id}-${lb.appid}`) ? "translateY(-1px)" : "translateY(0)",
                  transition: "all 160ms ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {game?.iconUrl ? (
                    <img
                      src={game.iconUrl}
                      alt={lb.title || `App ${lb.appid}`}
                      width={48}
                      height={48}
                      style={{ borderRadius: 8, objectFit: "cover" }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 8,
                        background: "#eee",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 10,
                        color: "#666",
                      }}
                    >
                      No Cover
                    </div>
                  )}
                  <div>
                    <div style={{ fontWeight: 700 }}>{lb.title || `App ${lb.appid}`}</div>
                    <div style={{ fontSize: 12, opacity: 0.7 }}>AppID: {lb.appid}</div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteLeaderboard(lb.appid);
                    }}
                    disabled={!isOwner}
                    style={{ padding: "6px 10px" }}
                  >
                    Loeschen
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

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
                    <span>- {m.unlockedCount}/{compare.total}</span>
                  ) : (
                    <span style={{ color: "crimson" }}>- nicht verfuegbar ({m.error})</span>
                  )}
                </li>
              ))}
          </ol>

          <h2 style={{ marginTop: 24 }}>Achievements (Mini-Matrix Vorschau)</h2>
          <p style={{ fontSize: 12, opacity: 0.8 }}>
            Unten sind nur die ersten 15 Achievements (MVP). Spaeter machen wir Paging/Filter.
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
                          {ok ? "OK" : "-"}
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
