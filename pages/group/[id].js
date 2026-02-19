import { useRouter } from "next/router";
import { useEffect, useMemo, useRef, useState } from "react";

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

function formatFeedTime(isoTimestamp) {
  if (!isoTimestamp) return "";
  const dt = new Date(isoTimestamp);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleString("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

const groupUi = {
  field: {
    width: "100%",
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid rgba(0, 234, 255, 0.3)",
    background: "rgba(7, 19, 33, 0.88)",
    color: "#e8f2ff",
    fontFamily: "inherit",
  },
  buttonPrimary: {
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid rgba(82, 166, 255, 0.5)",
    background: "linear-gradient(135deg, rgba(47, 140, 255, 0.36), rgba(0, 234, 255, 0.24))",
    color: "#dff3ff",
    fontWeight: 700,
  },
  buttonSecondary: {
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid rgba(0, 234, 255, 0.35)",
    background: "rgba(0, 234, 255, 0.08)",
    color: "#9defff",
    fontWeight: 700,
  },
  buttonDanger: {
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid rgba(255, 123, 0, 0.45)",
    background: "rgba(255, 123, 0, 0.16)",
    color: "#ffd6b6",
    fontWeight: 700,
  },
  dropdownSurface: {
    border: "1px solid rgba(0, 234, 255, 0.3)",
    borderRadius: 10,
    background: "rgba(7, 18, 33, 0.96)",
    boxShadow: "0 14px 30px rgba(0, 0, 0, 0.35)",
  },
  menuItem: {
    padding: "8px 10px",
    textAlign: "left",
    border: "1px solid rgba(255, 255, 255, 0.14)",
    borderRadius: 6,
    background: "rgba(255, 255, 255, 0.03)",
    color: "#e8f2ff",
  },
  menuItemActive: {
    background: "rgba(0, 234, 255, 0.16)",
    border: "1px solid rgba(0, 234, 255, 0.4)",
  },
};

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
  const [gameSearch, setGameSearch] = useState("");
  const [isGameDropdownOpen, setIsGameDropdownOpen] = useState(false);
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
  const [groupDescriptionDraft, setGroupDescriptionDraft] = useState("");
  const [savingGroupDescription, setSavingGroupDescription] = useState(false);
  const [syncingAvatarXp, setSyncingAvatarXp] = useState(false);
  const [avatarSyncMsg, setAvatarSyncMsg] = useState("");
  const [creatingBattleForUserId, setCreatingBattleForUserId] = useState(null);
  const [activityFeed, setActivityFeed] = useState([]);
  const [loadingActivityFeed, setLoadingActivityFeed] = useState(false);
  const [activityFeedError, setActivityFeedError] = useState("");
  const [openCommentsByEventId, setOpenCommentsByEventId] = useState({});
  const [loadingCommentsByEventId, setLoadingCommentsByEventId] = useState({});
  const [commentsByEventId, setCommentsByEventId] = useState({});
  const [commentDraftByEventId, setCommentDraftByEventId] = useState({});
  const [commentErrorByEventId, setCommentErrorByEventId] = useState({});
  const [commentBusyByEventId, setCommentBusyByEventId] = useState({});
  const [matrixPage, setMatrixPage] = useState(1);
  const gameDropdownRef = useRef(null);
  const rankingSectionRef = useRef(null);

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
      setGameSearch("");
      setIsGameDropdownOpen(false);
      return;
    }

    setLoadingOwnerGames(true);
    try {
      const r = await fetch(`/api/steam/games?steamid=${encodeURIComponent(ownerSteamid64)}`);
      const j = await r.json();
      if (!r.ok) {
        setErr(j.error || "Failed to load owner games");
        setOwnerGames([]);
        setIsGameDropdownOpen(false);
        return;
      }

      const games = j.games || [];
      setOwnerGames(games);
      setGameSearch("");
      setIsGameDropdownOpen(false);

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
      setIsGameDropdownOpen(false);
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
    setGroupDescriptionDraft(String(j.group?.description || ""));
    const nextMembers = j.members || [];
    setMembers(nextMembers);
    setLeaderboards(j.leaderboards || []);

    const activeAppid = j.group?.active_appid ? String(j.group.active_appid) : "";
    setAppid(activeAppid);

    const ownerSteamid64 = nextMembers.find((m) => m.role === "owner")?.users?.steamid64;
    await Promise.all([loadOwnerGames(ownerSteamid64, activeAppid), loadActivityFeed(activeAppid)]);
  }

  async function loadActivityFeed(appidOverride) {
    if (!id) return;

    const feedAppid = String(appidOverride || appid || "");
    setLoadingActivityFeed(true);
    setActivityFeedError("");
    try {
      const params = new URLSearchParams({ limit: "5" });
      if (feedAppid) params.set("appid", feedAppid);
      const r = await fetch(`/api/groups/${id}/activity?${params.toString()}`);
      const j = await r.json();
      if (!r.ok) {
        setActivityFeed([]);
        setActivityFeedError(j.error || "Feed konnte nicht geladen werden");
        return;
      }
      const items = Array.isArray(j.items) ? j.items : [];
      setActivityFeed(items);
      setOpenCommentsByEventId((prev) => {
        const next = {};
        for (const item of items) {
          if (!item?.eventId) continue;
          if (prev[item.eventId]) next[item.eventId] = true;
        }
        return next;
      });
    } catch (e) {
      setActivityFeed([]);
      setActivityFeedError(String(e));
    } finally {
      setLoadingActivityFeed(false);
    }
  }

  useEffect(() => {
    if (!id) return;

    (async () => {
      setErr("");
      await refreshGroup();
    })();
  }, [id]);

  useEffect(() => {
    if (!id || !appid) {
      setActivityFeed([]);
      return;
    }
    (async () => {
      await loadActivityFeed(appid);
    })();
  }, [id, appid]);

  async function loadCommentsForEvent(eventId) {
    if (!id || !eventId) return;

    setLoadingCommentsByEventId((prev) => ({ ...prev, [eventId]: true }));
    setCommentErrorByEventId((prev) => ({ ...prev, [eventId]: "" }));

    try {
      const q = new URLSearchParams({ eventId });
      const r = await fetch(`/api/groups/${id}/activity/comments?${q.toString()}`);
      const j = await r.json();
      if (!r.ok) {
        setCommentErrorByEventId((prev) => ({ ...prev, [eventId]: j.error || "Kommentare konnten nicht geladen werden" }));
        return;
      }
      setCommentsByEventId((prev) => ({ ...prev, [eventId]: Array.isArray(j.comments) ? j.comments : [] }));
    } catch (e) {
      setCommentErrorByEventId((prev) => ({ ...prev, [eventId]: String(e) }));
    } finally {
      setLoadingCommentsByEventId((prev) => ({ ...prev, [eventId]: false }));
    }
  }

  async function toggleCommentsForEvent(eventId) {
    if (!eventId) return;
    const willOpen = !openCommentsByEventId[eventId];
    setOpenCommentsByEventId((prev) => ({ ...prev, [eventId]: willOpen }));
    if (!willOpen) return;
    if (Array.isArray(commentsByEventId[eventId])) return;
    await loadCommentsForEvent(eventId);
  }

  async function submitCommentForEvent(eventId) {
    if (!id || !eventId) return;
    const text = (commentDraftByEventId[eventId] || "").trim();
    if (!text) return;

    setCommentBusyByEventId((prev) => ({ ...prev, [eventId]: true }));
    setCommentErrorByEventId((prev) => ({ ...prev, [eventId]: "" }));
    try {
      const r = await fetch(`/api/groups/${id}/activity/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, text }),
      });
      const j = await r.json();
      if (!r.ok) {
        setCommentErrorByEventId((prev) => ({ ...prev, [eventId]: j.error || "Kommentar konnte nicht gespeichert werden" }));
        return;
      }

      setCommentDraftByEventId((prev) => ({ ...prev, [eventId]: "" }));
      setCommentsByEventId((prev) => {
        const existing = Array.isArray(prev[eventId]) ? prev[eventId] : [];
        return { ...prev, [eventId]: [...existing, j.comment] };
      });
      setActivityFeed((prev) =>
        prev.map((item) =>
          item.eventId === eventId ? { ...item, commentCount: Number(item.commentCount || 0) + 1 } : item
        )
      );
    } catch (e) {
      setCommentErrorByEventId((prev) => ({ ...prev, [eventId]: String(e) }));
    } finally {
      setCommentBusyByEventId((prev) => ({ ...prev, [eventId]: false }));
    }
  }

  async function deleteCommentForEvent(eventId, commentId) {
    if (!id || !eventId || !commentId) return;

    setCommentBusyByEventId((prev) => ({ ...prev, [eventId]: true }));
    setCommentErrorByEventId((prev) => ({ ...prev, [eventId]: "" }));
    try {
      const r = await fetch(`/api/groups/${id}/activity/comments`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentId }),
      });
      const j = await r.json();
      if (!r.ok) {
        setCommentErrorByEventId((prev) => ({ ...prev, [eventId]: j.error || "Kommentar konnte nicht geloescht werden" }));
        return;
      }

      setCommentsByEventId((prev) => {
        const existing = Array.isArray(prev[eventId]) ? prev[eventId] : [];
        return { ...prev, [eventId]: existing.filter((c) => String(c.id) !== String(j.deletedId)) };
      });
      setActivityFeed((prev) =>
        prev.map((item) =>
          item.eventId === eventId
            ? { ...item, commentCount: Math.max(0, Number(item.commentCount || 0) - 1) }
            : item
        )
      );
    } catch (e) {
      setCommentErrorByEventId((prev) => ({ ...prev, [eventId]: String(e) }));
    } finally {
      setCommentBusyByEventId((prev) => ({ ...prev, [eventId]: false }));
    }
  }

  useEffect(() => {
    if (!isGameDropdownOpen) return;

    function onMouseDown(event) {
      if (!gameDropdownRef.current) return;
      if (!gameDropdownRef.current.contains(event.target)) {
        setIsGameDropdownOpen(false);
        setGameSearch("");
      }
    }

    function onKeyDown(event) {
      if (event.key !== "Escape") return;
      setIsGameDropdownOpen(false);
      setGameSearch("");
    }

    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isGameDropdownOpen]);

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

  async function saveGroupDescription() {
    if (!group?.id || savingGroupDescription) return;
    setErr("");
    setSavingGroupDescription(true);
    try {
      const r = await fetch(`/api/groups/${group.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: groupDescriptionDraft }),
      });
      const j = await r.json();
      if (!r.ok) {
        setErr(j.error || "Beschreibung konnte nicht gespeichert werden");
        return;
      }
      setGroup((prev) => ({ ...(prev || {}), ...(j.group || {}) }));
      setGroupDescriptionDraft(String(j.group?.description || ""));
    } catch (e) {
      setErr(String(e));
    } finally {
      setSavingGroupDescription(false);
    }
  }

  async function syncAvatarXpForCurrentGame() {
    if (!appid || syncingAvatarXp) return;
    setErr("");
    setAvatarSyncMsg("");
    setSyncingAvatarXp(true);
    try {
      const selectedGame = ownerGamesByAppid.get(String(appid));
      const r = await fetch("/api/avatar/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appid: Number(appid),
          gameTitle: selectedGame?.name || null,
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        setErr(j.error || "Avatar XP Sync fehlgeschlagen");
        return;
      }
      setAvatarSyncMsg(
        `Avatar Sync ok: +${j?.syncedGame?.gameXp || 0} XP aus App ${j?.syncedGame?.appid || appid}, Level ${j?.avatar?.level || 1}.`
      );
    } catch (e) {
      setErr(String(e));
    } finally {
      setSyncingAvatarXp(false);
    }
  }

  async function createBattleWithMember(opponentUserId) {
    if (!id || !opponentUserId || creatingBattleForUserId) return;
    setErr("");
    setCreatingBattleForUserId(opponentUserId);
    try {
      const r = await fetch("/api/battles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId: id,
          opponentUserId: Number(opponentUserId),
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        setErr(j.error || "Battle konnte nicht gestartet werden");
        return;
      }
      window.location.href = `/battle/${j.battleId}`;
    } catch (e) {
      setErr(String(e));
    } finally {
      setCreatingBattleForUserId(null);
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

  const filteredOwnerGames = useMemo(() => {
    const query = gameSearch.trim().toLowerCase();
    if (!query) return ownerGames;
    return ownerGames.filter((g) => {
      const name = String(g?.name || "").toLowerCase();
      const appidText = String(g?.appid || "");
      return name.includes(query) || appidText.includes(query);
    });
  }, [ownerGames, gameSearch]);

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

  useEffect(() => {
    setMatrixPage(1);
  }, [compare?.appid, compare?.mode, compare?.total]);

  useEffect(() => {
    if (!compare || !rankingSectionRef.current) return;
    rankingSectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [compare?.appid, compare?.mode, compare?.total]);

  if (!id) return <div style={{ padding: 40, fontFamily: "system-ui" }}>Loading...</div>;

  return (
    <div style={{ padding: 40, fontFamily: "system-ui", maxWidth: 1100, margin: "0 auto" }}>
      <a href="/" style={{ display: "inline-block", marginBottom: 12 }}>
        {"<-"} Home
      </a>

      <h1>{group ? group.name : "Group"}</h1>

      {err && <p style={{ color: "crimson" }}>{err}</p>}

      <div
        style={{
          marginTop: 12,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 16,
          alignItems: "start",
        }}
      >
        <div>
      {group && (
        <div style={{ border: "1px solid rgba(255, 255, 255, 0.2)", borderRadius: 12, padding: 16, marginTop: 0, width: "100%", maxWidth: 500 }}>
          <div>
            <b>Invite Code:</b> {group.invite_code}
          </div>
          <div style={{ marginTop: 10 }}>
            <b>Beschreibung:</b>
            {isOwner ? (
              <div style={{ marginTop: 6 }}>
                <textarea
                  value={groupDescriptionDraft}
                  onChange={(e) => setGroupDescriptionDraft(e.target.value)}
                  placeholder="Beschreibung der Gruppe (optional)"
                  maxLength={500}
                  rows={4}
                  style={{
                    ...groupUi.field,
                    resize: "vertical",
                    minHeight: 84,
                  }}
                />
                <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    type="button"
                    onClick={saveGroupDescription}
                    disabled={savingGroupDescription}
                    style={{
                      ...groupUi.buttonPrimary,
                      cursor: savingGroupDescription ? "not-allowed" : "pointer",
                    }}
                  >
                    {savingGroupDescription ? "Speichere..." : "Beschreibung speichern"}
                  </button>
                  <span style={{ fontSize: 12, opacity: 0.75 }}>{groupDescriptionDraft.length}/500</span>
                </div>
              </div>
            ) : group.description ? (
              <div style={{ marginTop: 4, whiteSpace: "pre-wrap", opacity: 0.9 }}>{group.description}</div>
            ) : (
              <div style={{ marginTop: 4, opacity: 0.7 }}>Keine Beschreibung hinterlegt.</div>
            )}
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
                  ...groupUi.buttonDanger,
                  cursor: deletingGroup ? "not-allowed" : "pointer",
                  opacity: deletingGroup ? 0.7 : 1,
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
            style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, justifyContent: "space-between" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
            </div>
            {String(m.users?.id || "") !== String(me?.id || "") ? (
              <button
                type="button"
                onClick={() => createBattleWithMember(m.users?.id)}
                disabled={creatingBattleForUserId !== null}
                style={{ ...groupUi.buttonSecondary, padding: "6px 9px", fontSize: 12 }}
              >
                {creatingBattleForUserId === m.users?.id ? "Starte..." : "Duell"}
              </button>
            ) : null}
          </li>
        ))}
      </ul>

      <h2 style={{ marginTop: 24 }}>Spiel auswaehlen</h2>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <div ref={gameDropdownRef} style={{ position: "relative", minWidth: 320 }}>
          <button
            type="button"
            onClick={() => {
              if (loadingOwnerGames || ownerGames.length === 0) return;
              setIsGameDropdownOpen((prev) => !prev);
              setGameSearch("");
            }}
            disabled={loadingOwnerGames || ownerGames.length === 0}
            style={{
              padding: "10px 12px",
              minWidth: 320,
              textAlign: "left",
              border: groupUi.field.border,
              borderRadius: groupUi.field.borderRadius,
              background: groupUi.field.background,
              color: groupUi.field.color,
            }}
          >
            {loadingOwnerGames
              ? "Lade Spiele..."
              : ownerGames.length === 0
                ? "Keine Spiele gefunden"
                : appid && ownerGamesByAppid.get(String(appid))
                  ? `${ownerGamesByAppid.get(String(appid)).name} (AppID: ${ownerGamesByAppid.get(String(appid)).appid})`
                  : "Spiel auswaehlen"}
          </button>

          {isGameDropdownOpen && ownerGames.length > 0 ? (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                left: 0,
                width: "100%",
                zIndex: 60,
                ...groupUi.dropdownSurface,
                padding: 8,
              }}
            >
              <input
                type="text"
                value={gameSearch}
                onChange={(e) => setGameSearch(e.target.value)}
                placeholder="Spiel suchen (Name oder AppID)"
                autoFocus
                style={{ ...groupUi.field, padding: 8, marginBottom: 8 }}
              />
              <div style={{ maxHeight: 260, overflowY: "auto", display: "grid", gap: 4 }}>
                {filteredOwnerGames.length === 0 ? (
                  <div style={{ padding: "8px 6px", color: "#666" }}>Keine Treffer fuer "{gameSearch}"</div>
                ) : (
                  filteredOwnerGames.map((g) => (
                    <button
                      key={g.appid}
                      type="button"
                      onClick={() => {
                        setAppid(String(g.appid));
                        setIsGameDropdownOpen(false);
                        setGameSearch("");
                      }}
                      style={
                        String(g.appid) === String(appid)
                          ? { ...groupUi.menuItem, ...groupUi.menuItemActive }
                          : groupUi.menuItem
                      }
                    >
                      {g.name} (AppID: {g.appid})
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : null}
        </div>

        <button
          onClick={() => {
            setErr("");
            setShowCreateLeaderboardOptions(true);
          }}
          disabled={!appid || !isOwner}
          style={{ ...groupUi.buttonPrimary, padding: "10px 14px" }}
        >
          Rangliste anlegen
        </button>
        <button
          type="button"
          onClick={syncAvatarXpForCurrentGame}
          disabled={!appid || syncingAvatarXp}
          style={{ ...groupUi.buttonSecondary, padding: "10px 14px" }}
        >
          {syncingAvatarXp ? "Sync laeuft..." : "Avatar XP syncen"}
        </button>
      </div>
      {avatarSyncMsg ? (
        <p style={{ marginTop: 8, color: "#9defff", fontSize: 13 }}>{avatarSyncMsg}</p>
      ) : null}

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
                  ...groupUi.buttonSecondary,
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
                  ...groupUi.buttonPrimary,
                  padding: "10px 14px",
                  background: "linear-gradient(90deg, #00d9ff, #2fffb2)",
                  borderRadius: 10,
                }}
              >
                {creatingLeaderboard ? "Erstelle..." : "Rangliste erstellen"}
              </button>
              <button
                onClick={() => setShowCreateLeaderboardOptions(false)}
                disabled={creatingLeaderboard}
                style={{
                  ...groupUi.buttonSecondary,
                  padding: "10px 14px",
                  borderRadius: 10,
                }}
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div style={{ marginTop: 24 }}>
          <h2 style={{ marginTop: 0 }}>Ranglisten in dieser Gruppe</h2>
          {leaderboards.length === 0 ? (
            <p style={{ opacity: 0.8 }}>Noch keine Ranglisten angelegt.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {leaderboards.map((lb) => {
                const game = ownerGamesByAppid.get(String(lb.appid));
                const isActiveLeaderboard = String(lb.appid) === String(appid);
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
                        isActiveLeaderboard
                          ? "1px solid rgba(47, 255, 178, 0.78)"
                          : hoveredLeaderboardId === (lb.id || `${lb.group_id}-${lb.appid}`)
                          ? "1px solid rgba(0, 234, 255, 0.62)"
                          : "1px solid rgba(255, 255, 255, 0.16)",
                      borderRadius: 10,
                      padding: 10,
                      cursor: "pointer",
                      background:
                        isActiveLeaderboard
                          ? "linear-gradient(135deg, rgba(47, 255, 178, 0.22) 0%, rgba(0, 234, 255, 0.14) 100%)"
                          : hoveredLeaderboardId === (lb.id || `${lb.group_id}-${lb.appid}`)
                          ? "linear-gradient(135deg, rgba(0, 234, 255, 0.14) 0%, rgba(47, 255, 178, 0.09) 100%)"
                          : "rgba(8, 18, 33, 0.72)",
                      boxShadow:
                        isActiveLeaderboard
                          ? "0 12px 24px rgba(47, 255, 178, 0.2)"
                          : hoveredLeaderboardId === (lb.id || `${lb.group_id}-${lb.appid}`)
                          ? "0 10px 22px rgba(0, 234, 255, 0.14)"
                          : "0 2px 8px rgba(0, 0, 0, 0.26)",
                      transform:
                        hoveredLeaderboardId === (lb.id || `${lb.group_id}-${lb.appid}`)
                          ? "translateY(-1px)"
                          : "translateY(0)",
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
                          ...groupUi.buttonDanger,
                          padding: "6px 10px",
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
        </div>

        </div>

        <aside style={{ maxWidth: 420, width: "100%", justifySelf: "end" }}>
          <h2 style={{ marginTop: 0 }}>Gruppen-Feed</h2>
          {activityFeedError ? <p style={{ color: "crimson" }}>{activityFeedError}</p> : null}
          {loadingActivityFeed && activityFeed.length === 0 ? (
            <p style={{ opacity: 0.8 }}>Lade Feed...</p>
          ) : activityFeed.length === 0 ? (
            <p style={{ opacity: 0.8 }}>Noch keine Achievement-Aktivitaet in den getrackten Spielen.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
              {activityFeed.map((item, index) => {
                const eventId = item?.eventId || "";
                const key =
                  eventId ||
                  `${item.user?.steamid64 || "user"}-${item.appid}-${item.achievementApiName || "achievement"}-${item.unlocktime || index}`;
                const userHref = item?.user?.id ? `/user/${item.user.id}` : null;
                const comments = eventId ? commentsByEventId[eventId] || [] : [];
                const isCommentsOpen = eventId ? !!openCommentsByEventId[eventId] : false;
                const isLoadingComments = eventId ? !!loadingCommentsByEventId[eventId] : false;
                const isCommentBusy = eventId ? !!commentBusyByEventId[eventId] : false;
                const commentError = eventId ? commentErrorByEventId[eventId] || "" : "";
                const commentDraft = eventId ? commentDraftByEventId[eventId] || "" : "";
                return (
                  <li
                    key={key}
                    style={{
                      border: "1px solid rgba(255, 255, 255, 0.15)",
                      background: "rgba(8, 18, 33, 0.65)",
                      borderRadius: 10,
                      padding: "10px 12px",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    {item?.achievementIcon ? (
                      <img
                        src={item.achievementIcon}
                        alt={item.achievementName || "Achievement"}
                        width={32}
                        height={32}
                        style={{ borderRadius: 6, background: "rgba(255, 255, 255, 0.08)" }}
                      />
                    ) : null}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ color: "#e8f2ff" }}>
                        {userHref ? (
                          <a href={userHref} style={{ color: "#9defff", textDecoration: "underline", fontWeight: 700 }}>
                            {item?.user?.displayName || item?.user?.steamid64 || "Unbekannter User"}
                          </a>
                        ) : (
                          <b>{item?.user?.displayName || item?.user?.steamid64 || "Unbekannter User"}</b>
                        )}{" "}
                        hat <b>{item.achievementName || item.achievementApiName || "ein Achievement"}</b> in{" "}
                        <b>{item.gameTitle || `App ${item.appid}`}</b> freigeschaltet.
                      </div>
                      <div style={{ marginTop: 2, fontSize: 12, color: "#9cb3c9" }}>{formatFeedTime(item.unlockedAt)}</div>
                      {eventId ? (
                        <div style={{ marginTop: 8 }}>
                          <button
                            type="button"
                            onClick={() => toggleCommentsForEvent(eventId)}
                            disabled={isCommentBusy}
                            style={{
                              padding: "4px 8px",
                              borderRadius: 8,
                              border: groupUi.buttonSecondary.border,
                              background: groupUi.buttonSecondary.background,
                              color: groupUi.buttonSecondary.color,
                              fontSize: 12,
                            }}
                          >
                            {isCommentsOpen ? "Kommentare ausblenden" : "Kommentare anzeigen"} ({item.commentCount || 0})
                          </button>

                          {isCommentsOpen ? (
                            <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
                              {commentError ? <div style={{ color: "#ff9db0", fontSize: 12 }}>{commentError}</div> : null}
                              {isLoadingComments ? (
                                <div style={{ fontSize: 12, opacity: 0.8 }}>Lade Kommentare...</div>
                              ) : comments.length === 0 ? (
                                <div style={{ fontSize: 12, opacity: 0.8 }}>Noch keine Kommentare.</div>
                              ) : (
                                <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6 }}>
                                  {comments.map((comment) => (
                                    <li
                                      key={comment.id}
                                      style={{
                                        border: "1px solid rgba(255, 255, 255, 0.12)",
                                        borderRadius: 8,
                                        padding: "6px 8px",
                                        background: "rgba(0, 0, 0, 0.18)",
                                      }}
                                    >
                                      <div style={{ fontSize: 12, color: "#9cb3c9", display: "flex", justifyContent: "space-between", gap: 8 }}>
                                        <span>{comment?.user?.displayName || "Unbekannter User"}</span>
                                        <span>{formatFeedTime(comment.createdAt)}</span>
                                      </div>
                                      <div style={{ marginTop: 2, whiteSpace: "pre-wrap" }}>{comment.text}</div>
                                      {String(comment?.user?.id || "") === String(me?.id || "") ? (
                                        <button
                                          type="button"
                                          onClick={() => deleteCommentForEvent(eventId, comment.id)}
                                          disabled={isCommentBusy}
                                          style={{
                                            marginTop: 4,
                                            padding: "1px 5px",
                                            borderRadius: 999,
                                            border: "1px solid rgba(255, 214, 182, 0.22)",
                                            background: "rgba(255, 214, 182, 0.04)",
                                            color: "rgba(255, 214, 182, 0.72)",
                                            fontSize: 10,
                                            lineHeight: 1.3,
                                          }}
                                        >
                                          Loeschen
                                        </button>
                                      ) : null}
                                    </li>
                                  ))}
                                </ul>
                              )}

                              <div style={{ display: "flex", gap: 6 }}>
                                <input
                                  type="text"
                                  value={commentDraft}
                                  onChange={(e) =>
                                    setCommentDraftByEventId((prev) => ({ ...prev, [eventId]: e.target.value }))
                                  }
                                  placeholder="Kommentar schreiben..."
                                  maxLength={500}
                                  style={{
                                    flex: 1,
                                    minWidth: 0,
                                    ...groupUi.field,
                                    padding: "6px 8px",
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={() => submitCommentForEvent(eventId)}
                                  disabled={isCommentBusy || !commentDraft.trim()}
                                  style={{
                                    ...groupUi.buttonSecondary,
                                    padding: "6px 8px",
                                  }}
                                >
                                  Senden
                                </button>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>
      </div>

      {compare && (
        <div ref={rankingSectionRef} style={{ marginTop: 24 }}>
          {(() => {
            const matrixPageSize = 10;
            const matrixTotal = Array.isArray(compare.achievements) ? compare.achievements.length : 0;
            const matrixTotalPages = Math.max(1, Math.ceil(matrixTotal / matrixPageSize));
            const matrixCurrentPage = Math.min(Math.max(matrixPage, 1), matrixTotalPages);
            const matrixStart = (matrixCurrentPage - 1) * matrixPageSize;
            const matrixAchievements = (compare.achievements || []).slice(matrixStart, matrixStart + matrixPageSize);
            const matrixFrom = matrixTotal === 0 ? 0 : matrixStart + 1;
            const matrixTo = matrixStart + matrixAchievements.length;
            return (
              <>
          <h2>Ranking</h2>
          <p style={{ fontSize: 13, opacity: 0.8 }}>
            Modus: <b>{compare.modeLabel || leaderboardModeLabel(compare.mode || "overall_progress")}</b>
            {typeof compare.totalInGame === "number" ? ` (${compare.total}/${compare.totalInGame} Achievements im Fokus)` : null}
          </p>
          <ol style={{ listStyle: "none", padding: 0, marginTop: 12, display: "grid", gap: 8 }}>
            {compare.members
              .slice()
              .sort((a, b) => (b.unlockedCount || 0) - (a.unlockedCount || 0))
              .map((m, index) => {
                const place = index + 1;
                const medal = place === 1 ? "🥇" : place === 2 ? "🥈" : place === 3 ? "🥉" : "•";
                const progressPercent =
                  compare.total > 0 ? Math.min(100, Math.round(((m.unlockedCount || 0) / compare.total) * 100)) : 0;

                return (
                  <li
                    key={m.steamid64}
                    style={{
                      border: place <= 3 ? "1px solid rgba(0, 234, 255, 0.45)" : "1px solid rgba(255, 255, 255, 0.15)",
                      background:
                        place <= 3
                          ? "linear-gradient(135deg, rgba(0, 234, 255, 0.12) 0%, rgba(47, 255, 178, 0.07) 100%)"
                          : "rgba(8, 18, 33, 0.65)",
                      borderRadius: 10,
                      padding: "10px 12px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 18 }}>{medal}</span>
                        <span style={{ opacity: 0.85, minWidth: 22 }}>#{place}</span>
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
                        </b>
                      </div>
                      {m.ok ? (
                        <span style={{ color: "#e8f2ff", fontWeight: 700 }}>
                          {m.unlockedCount}/{compare.total}
                        </span>
                      ) : (
                        <span style={{ color: "#ff9db0" }}>nicht verfuegbar</span>
                      )}
                    </div>

                    {m.ok ? (
                      <div
                        style={{
                          marginTop: 8,
                          height: 8,
                          borderRadius: 999,
                          background: "rgba(255, 255, 255, 0.12)",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            width: `${progressPercent}%`,
                            height: "100%",
                            borderRadius: 999,
                            background: "linear-gradient(90deg, #00d9ff, #2fffb2)",
                          }}
                        />
                      </div>
                    ) : (
                      <div style={{ marginTop: 6, color: "#ff9db0", fontSize: 12 }}>Fehler: {m.error}</div>
                    )}
                  </li>
                );
              })}
          </ol>

          <h2 style={{ marginTop: 24 }}>Achievements (Mini-Matrix Vorschau)</h2>
          <p style={{ fontSize: 12, opacity: 0.8 }}>
            Zeige {matrixFrom}-{matrixTo} von {matrixTotal} Achievements.
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <button
              type="button"
              onClick={() => setMatrixPage((prev) => Math.max(1, prev - 1))}
              disabled={matrixCurrentPage <= 1}
              style={{ ...groupUi.buttonSecondary, padding: "6px 10px" }}
            >
              Zurueck
            </button>
            <span style={{ fontSize: 12, opacity: 0.9 }}>
              Seite {matrixCurrentPage}/{matrixTotalPages}
            </span>
            <button
              type="button"
              onClick={() => setMatrixPage((prev) => Math.min(matrixTotalPages, prev + 1))}
              disabled={matrixCurrentPage >= matrixTotalPages}
              style={{ ...groupUi.buttonSecondary, padding: "6px 10px" }}
            >
              Weiter
            </button>
          </div>

          <div style={{ overflowX: "auto", border: "1px solid #ddd", borderRadius: 12 }}>
            <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 560 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #ddd" }}>
                    Achievement
                  </th>
                  <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #ddd" }}>Erreicht von</th>
                </tr>
              </thead>
              <tbody>
                {matrixAchievements.map((a) => (
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
                    <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        {compare.members
                          .filter((m) => compare.matrix?.[a.apiName]?.[m.steamid64])
                          .map((m) => {
                            const userHref = memberUserIdBySteamid64.get(String(m.steamid64))
                              ? `/user/${memberUserIdBySteamid64.get(String(m.steamid64))}`
                              : null;
                            const icon = m.avatarUrl ? (
                              <img
                                src={m.avatarUrl}
                                alt={m.displayName}
                                title={m.displayName}
                                width={22}
                                height={22}
                                style={{
                                  borderRadius: "50%",
                                  objectFit: "cover",
                                  border: "1px solid rgba(0, 234, 255, 0.45)",
                                }}
                              />
                            ) : (
                              <span
                                title={m.displayName}
                                style={{
                                  width: 22,
                                  height: 22,
                                  borderRadius: "50%",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: 10,
                                  color: "#e8f2ff",
                                  background: "rgba(255, 255, 255, 0.12)",
                                  border: "1px solid rgba(255, 255, 255, 0.2)",
                                }}
                              >
                                {String(m.displayName || "?").slice(0, 1).toUpperCase()}
                              </span>
                            );
                            return userHref ? (
                              <a key={m.steamid64} href={userHref} style={{ display: "inline-flex" }}>
                                {icon}
                              </a>
                            ) : (
                              <span key={m.steamid64} style={{ display: "inline-flex" }}>
                                {icon}
                              </span>
                            );
                          })}
                        {compare.members.some((m) => compare.matrix?.[a.apiName]?.[m.steamid64]) ? null : (
                          <span style={{ opacity: 0.7 }}>-</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
