import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

const LEADERBOARD_MODE_OPTIONS = [
  {
    value: "overall_progress",
    label: "Overall achievement progress",
    description:
      "Klassisches Gesamt-Ranking ueber alle Achievements des gewaehlten Spiels. Ideal fuer langfristigen Fortschritt in der Gruppe.",
  },
  {
    value: "rarest_10",
    label: "Die 10 seltensten Achievements",
    description:
      "Vergleicht nur die 10 global seltensten Achievements des Spiels. Damit siehst du schneller, wer die schwierigsten Ziele schafft.",
  },
  {
    value: "custom",
    label: "Custom Auswahl",
    description:
      "Du waehlst selbst aus, welche Achievements fuer das Ranking gezaehlt werden. Gut fuer Challenges oder Themen-Ranglisten.",
  },
];

function leaderboardModeLabel(mode) {
  const match = LEADERBOARD_MODE_OPTIONS.find((o) => o.value === mode);
  return match ? match.label : LEADERBOARD_MODE_OPTIONS[0].label;
}

function memberUserHref(memberUserId) {
  if (!memberUserId) return null;
  return `/user/${memberUserId}`;
}

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
  const [showCreateLeaderboardOptions, setShowCreateLeaderboardOptions] = useState(false);
  const [createLeaderboardMode, setCreateLeaderboardMode] = useState("overall_progress");
  const [availableAchievements, setAvailableAchievements] = useState([]);
  const [selectedCustomAchievements, setSelectedCustomAchievements] = useState([]);
  const [loadingAvailableAchievements, setLoadingAvailableAchievements] = useState(false);
  const [creatingLeaderboard, setCreatingLeaderboard] = useState(false);
  const [deletingGroup, setDeletingGroup] = useState(false);

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
    if (createLeaderboardMode === "custom" && selectedCustomAchievements.length === 0) {
      setErr("Bitte waehle mindestens ein Achievement fuer Custom aus.");
      return;
    }

    setCreatingLeaderboard(true);
    try {
      const r = await fetch(`/api/groups/${id}/set-game`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appid,
          title: selectedGame?.name || null,
          mode: createLeaderboardMode,
          trackedAchievementApiNames:
            createLeaderboardMode === "custom" ? selectedCustomAchievements : [],
        }),
      });

      const j = await r.json();
      if (!r.ok) {
        setErr(j.error || "Failed to save game");
        return;
      }

      setShowCreateLeaderboardOptions(false);
      setSelectedCustomAchievements([]);
      setAvailableAchievements([]);
      await refreshGroup();
    } catch (e) {
      setErr(String(e));
    } finally {
      setCreatingLeaderboard(false);
    }
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

  async function deleteGroup() {
    if (!group?.id || deletingGroup) return;

    const confirmed = window.confirm(
      `Willst du die Gruppe "${group.name || group.id}" wirklich loeschen? Diese Aktion kann nicht rueckgaengig gemacht werden.`
    );
    if (!confirmed) return;

    setErr("");
    setDeletingGroup(true);
    try {
      const r = await fetch(`/api/groups/${group.id}`, { method: "DELETE" });
      const j = await r.json();
      if (!r.ok) {
        setErr(j.error || "Failed to delete group");
        return;
      }
      window.location.href = "/";
    } catch (e) {
      setErr(String(e));
    } finally {
      setDeletingGroup(false);
    }
  }

  const isOwner = !!me && !!group && String(me.id) === String(group.owner_user_id);
  const ownerSteamid64 = useMemo(
    () => members.find((m) => m.role === "owner")?.users?.steamid64 || "",
    [members]
  );

  const ownerGamesByAppid = useMemo(() => {
    const map = new Map();
    for (const g of ownerGames) map.set(String(g.appid), g);
    return map;
  }, [ownerGames]);

  const memberUserIdBySteamid64 = useMemo(() => {
    const map = new Map();
    for (const member of members) {
      if (!member?.users?.steamid64 || !member?.users?.id) continue;
      map.set(String(member.users.steamid64), String(member.users.id));
    }
    return map;
  }, [members]);

  async function loadAchievementsForCustomSelection() {
    if (!appid || !ownerSteamid64) return;

    setLoadingAvailableAchievements(true);
    try {
      const r = await fetch(
        `/api/steam/achievements?steamid=${encodeURIComponent(ownerSteamid64)}&appid=${encodeURIComponent(appid)}`
      );
      const j = await r.json();
      if (!r.ok) {
        setErr(j.error || "Failed to load achievements");
        setAvailableAchievements([]);
        return;
      }

      const achievements = (j.achievements || []).map((a) => ({
        apiName: a.apiName,
        displayName: a.displayName || a.apiName,
        description: a.description || "",
        icon: a.icon || a.icongray || "",
        globalPercent: typeof a.globalPercent === "number" ? a.globalPercent : null,
        rarityLabel: a.rarityLabel || "Unbekannt",
      }));
      achievements.sort((a, b) => {
        const pa = typeof a.globalPercent === "number" ? a.globalPercent : Number.POSITIVE_INFINITY;
        const pb = typeof b.globalPercent === "number" ? b.globalPercent : Number.POSITIVE_INFINITY;
        if (pa !== pb) return pa - pb;
        return String(a.displayName).localeCompare(String(b.displayName));
      });
      setAvailableAchievements(achievements);
      setSelectedCustomAchievements((prev) =>
        prev.filter((apiName) => achievements.some((a) => a.apiName === apiName))
      );
    } catch (e) {
      setErr(String(e));
      setAvailableAchievements([]);
    } finally {
      setLoadingAvailableAchievements(false);
    }
  }

  useEffect(() => {
    if (!showCreateLeaderboardOptions) return;
    if (createLeaderboardMode !== "custom") return;
    if (!appid || !ownerSteamid64) return;

    (async () => {
      await loadAchievementsForCustomSelection();
    })();
  }, [showCreateLeaderboardOptions, createLeaderboardMode, appid, ownerSteamid64]);

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
          {isOwner ? (
            <div style={{ marginTop: 12 }}>
              <button
                onClick={deleteGroup}
                disabled={deletingGroup}
                style={{
                  padding: "8px 12px",
                  border: "1px solid #c82b2b",
                  background: deletingGroup ? "#f8dede" : "#fff0f0",
                  color: "#8a1212",
                  borderRadius: 8,
                  cursor: deletingGroup ? "not-allowed" : "pointer",
                }}
              >
                {deletingGroup ? "Loesche Gruppe..." : "Gruppe loeschen"}
              </button>
            </div>
          ) : null}
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
              {memberUserHref(m.users?.id) ? (
                <a href={memberUserHref(m.users?.id)} style={{ color: "#9defff", textDecoration: "underline" }}>
                  {m.users?.display_name || m.users?.steamid64 || "Unbekannter User"}
                </a>
              ) : (
                <>{m.users?.display_name || m.users?.steamid64 || "Unbekannter User"}</>
              )}
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

        <button
          onClick={() => {
            setErr("");
            setShowCreateLeaderboardOptions(true);
          }}
          disabled={!appid || !isOwner}
          style={{ padding: "10px 14px" }}
        >
          Rangliste anlegen
        </button>
      </div>

      {showCreateLeaderboardOptions ? (
        <div
          onClick={() => {
            if (creatingLeaderboard) return;
            setShowCreateLeaderboardOptions(false);
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(4, 10, 20, 0.74)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 16,
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(860px, 100%)",
              maxHeight: "90vh",
              overflowY: "auto",
              color: "#e8f2ff",
              background:
                "linear-gradient(160deg, rgba(16, 26, 45, 0.95), rgba(8, 13, 23, 0.95))",
              borderRadius: 14,
              border: "1px solid rgba(0, 234, 255, 0.3)",
              boxShadow: "0 18px 40px rgba(0, 0, 0, 0.4)",
              padding: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>Ranglisten-Typ auswaehlen</div>
                <p style={{ margin: "6px 0 0", opacity: 0.8 }}>
                  Waehle den Modus, bevor du die Rangliste fuer das aktuelle Spiel anlegst.
                </p>
              </div>
              <button
                onClick={() => setShowCreateLeaderboardOptions(false)}
                disabled={creatingLeaderboard}
                style={{
                  padding: "8px 12px",
                  color: "#00eaff",
                  background: "rgba(0, 234, 255, 0.08)",
                  border: "1px solid rgba(0, 234, 255, 0.35)",
                  borderRadius: 10,
                }}
              >
                Schliessen
              </button>
            </div>

            <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
              {LEADERBOARD_MODE_OPTIONS.map((option) => {
                const selected = createLeaderboardMode === option.value;
                return (
                  <label
                    key={option.value}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "24px 1fr",
                      alignItems: "start",
                      gap: 10,
                      border: selected
                        ? "1px solid rgba(0, 234, 255, 0.65)"
                        : "1px solid rgba(255, 255, 255, 0.18)",
                      borderRadius: 10,
                      padding: 12,
                      background: selected
                        ? "linear-gradient(135deg, rgba(0, 234, 255, 0.14) 0%, rgba(47, 255, 178, 0.08) 100%)"
                        : "rgba(255, 255, 255, 0.02)",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="radio"
                      name="leaderboard-type"
                      value={option.value}
                      checked={selected}
                      onChange={() => {
                        setCreateLeaderboardMode(option.value);
                        setErr("");
                        if (option.value !== "custom") {
                          setSelectedCustomAchievements([]);
                        }
                      }}
                      style={{ marginTop: 4 }}
                    />
                    <div>
                      <div style={{ fontWeight: 700 }}>{option.label}</div>
                      <div style={{ marginTop: 4, fontSize: 14, lineHeight: 1.45, color: "#9cb3c9" }}>
                        {option.description}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>

            {createLeaderboardMode === "custom" ? (
              <div
                style={{
                  marginTop: 14,
                  borderTop: "1px solid rgba(255, 255, 255, 0.14)",
                  paddingTop: 12,
                }}
              >
                <div style={{ marginBottom: 8, fontWeight: 600 }}>
                  Achievements fuer Tracking ({selectedCustomAchievements.length} ausgewaehlt)
                </div>
                {loadingAvailableAchievements ? (
                  <p style={{ margin: 0, opacity: 0.8 }}>Lade Achievements...</p>
                ) : availableAchievements.length === 0 ? (
                  <p style={{ margin: 0, opacity: 0.8 }}>Keine Achievements gefunden.</p>
                ) : (
                  <div
                    style={{
                      maxHeight: 240,
                      overflowY: "auto",
                      border: "1px solid rgba(255, 255, 255, 0.14)",
                      borderRadius: 8,
                      padding: 8,
                      display: "grid",
                      gap: 6,
                      background: "rgba(255, 255, 255, 0.02)",
                    }}
                  >
                    {availableAchievements.map((achievement) => {
                      const checked = selectedCustomAchievements.includes(achievement.apiName);
                      return (
                        <label
                          key={achievement.apiName}
                          style={{
                            display: "grid",
                            gridTemplateColumns: "24px 42px 1fr",
                            gap: 8,
                            alignItems: "start",
                            border: "1px solid rgba(255, 255, 255, 0.12)",
                            borderRadius: 8,
                            padding: 8,
                            background: "rgba(0, 0, 0, 0.18)",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedCustomAchievements((prev) => [...prev, achievement.apiName]);
                                return;
                              }
                              setSelectedCustomAchievements((prev) =>
                                prev.filter((apiName) => apiName !== achievement.apiName)
                              );
                            }}
                            style={{ marginTop: 12 }}
                          />
                          {achievement.icon ? (
                            <img
                              src={achievement.icon}
                              alt={achievement.displayName}
                              width={40}
                              height={40}
                              style={{
                                borderRadius: 6,
                                objectFit: "cover",
                                background: "rgba(255, 255, 255, 0.06)",
                              }}
                            />
                          ) : (
                            <div
                              style={{
                                width: 40,
                                height: 40,
                                borderRadius: 6,
                                background: "rgba(255, 255, 255, 0.08)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 10,
                                color: "#9cb3c9",
                              }}
                            >
                              N/A
                            </div>
                          )}
                          <div>
                            <div style={{ fontWeight: 700 }}>{achievement.displayName}</div>
                            <div style={{ fontSize: 12, color: "#9cb3c9" }}>
                              {achievement.description || "Keine Beschreibung verfuegbar."}
                            </div>
                            <div style={{ marginTop: 2, fontSize: 12, color: "#9cb3c9" }}>
                              Seltenheit:{" "}
                              <b>
                                {achievement.rarityLabel}
                                {typeof achievement.globalPercent === "number"
                                  ? ` (${achievement.globalPercent.toFixed(2)}%)`
                                  : ""}
                              </b>
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : null}

            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button
                onClick={saveGame}
                disabled={
                  creatingLeaderboard ||
                  !appid ||
                  (createLeaderboardMode === "custom" && selectedCustomAchievements.length === 0)
                }
                style={{
                  padding: "10px 14px",
                  color: "#04131d",
                  background: "linear-gradient(90deg, #00d9ff, #2fffb2)",
                  border: "1px solid transparent",
                  borderRadius: 10,
                  fontWeight: 700,
                }}
              >
                {creatingLeaderboard ? "Erstelle..." : "Rangliste erstellen"}
              </button>
              <button
                onClick={() => setShowCreateLeaderboardOptions(false)}
                disabled={creatingLeaderboard}
                style={{
                  padding: "10px 14px",
                  color: "#00eaff",
                  background: "rgba(0, 234, 255, 0.08)",
                  border: "1px solid rgba(0, 234, 255, 0.35)",
                  borderRadius: 10,
                  fontWeight: 700,
                }}
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      ) : null}

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
                  border:
                    hoveredLeaderboardId === (lb.id || `${lb.group_id}-${lb.appid}`)
                      ? "1px solid rgba(0, 234, 255, 0.62)"
                      : "1px solid rgba(255, 255, 255, 0.16)",
                  borderRadius: 10,
                  padding: 10,
                  cursor: "pointer",
                  background:
                    hoveredLeaderboardId === (lb.id || `${lb.group_id}-${lb.appid}`)
                      ? "linear-gradient(135deg, rgba(0, 234, 255, 0.14) 0%, rgba(47, 255, 178, 0.09) 100%)"
                      : "rgba(8, 18, 33, 0.72)",
                  boxShadow:
                    hoveredLeaderboardId === (lb.id || `${lb.group_id}-${lb.appid}`)
                      ? "0 10px 22px rgba(0, 234, 255, 0.14)"
                      : "0 2px 8px rgba(0, 0, 0, 0.26)",
                  transform: hoveredLeaderboardId === (lb.id || `${lb.group_id}-${lb.appid}`) ? "translateY(-1px)" : "translateY(0)",
                  transition: "all 160ms ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {game?.libraryCapsuleUrl || game?.iconUrl ? (
                    <img
                      src={game.libraryCapsuleUrl || game.iconUrl}
                      alt={lb.title || `App ${lb.appid}`}
                      width={64}
                      height={96}
                      style={{
                        borderRadius: 8,
                        objectFit: "cover",
                        background: "rgba(255, 255, 255, 0.08)",
                        border: "1px solid rgba(255, 255, 255, 0.14)",
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 64,
                        height: 96,
                        borderRadius: 8,
                        background: "rgba(255, 255, 255, 0.08)",
                        border: "1px solid rgba(255, 255, 255, 0.14)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 10,
                        color: "#9cb3c9",
                      }}
                    >
                      No Cover
                    </div>
                  )}
                  <div>
                    <div style={{ fontWeight: 700, color: "#e8f2ff" }}>{lb.title || `App ${lb.appid}`}</div>
                    <div style={{ fontSize: 12, color: "#9cb3c9" }}>AppID: {lb.appid}</div>
                    <div style={{ fontSize: 12, color: "#9cb3c9" }}>
                      Typ: {leaderboardModeLabel(lb.mode || "overall_progress")}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteLeaderboard(lb.appid);
                    }}
                    disabled={!isOwner}
                    style={{
                      padding: "6px 10px",
                      color: "#ffd6b6",
                      background: "rgba(255, 123, 0, 0.16)",
                      border: "1px solid rgba(255, 123, 0, 0.45)",
                      borderRadius: 8,
                    }}
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
          <p style={{ fontSize: 13, opacity: 0.8 }}>
            Modus: <b>{compare.modeLabel || leaderboardModeLabel(compare.mode || "overall_progress")}</b>
            {typeof compare.totalInGame === "number" ? ` (${compare.total}/${compare.totalInGame} Achievements im Fokus)` : null}
          </p>
          <ol>
            {compare.members
              .slice()
              .sort((a, b) => (b.unlockedCount || 0) - (a.unlockedCount || 0))
              .map((m) => (
                <li key={m.steamid64}>
                  <b>
                    {memberUserIdBySteamid64.get(String(m.steamid64)) ? (
                      <a
                        href={`/user/${memberUserIdBySteamid64.get(String(m.steamid64))}`}
                        style={{ color: "#9defff", textDecoration: "underline" }}
                      >
                        {m.displayName}
                      </a>
                    ) : (
                      m.displayName
                    )}
                  </b>{" "}
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
                      {memberUserIdBySteamid64.get(String(m.steamid64)) ? (
                        <a
                          href={`/user/${memberUserIdBySteamid64.get(String(m.steamid64))}`}
                          style={{ color: "#9defff", textDecoration: "underline" }}
                        >
                          {m.displayName}
                        </a>
                      ) : (
                        m.displayName
                      )}
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

