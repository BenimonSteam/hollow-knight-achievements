import { useRouter } from "next/router";
import { useEffect, useState } from "react";

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("de-DE");
}

function dailyQuestTimeLeftLabel(nowMs) {
  const now = new Date(nowMs);
  const nextUtcMidnight = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0,
    0,
    0,
    0
  );

  let diff = Math.max(0, nextUtcMidnight - nowMs);
  const hours = Math.floor(diff / 3600000);
  diff -= hours * 3600000;
  const minutes = Math.floor(diff / 60000);
  diff -= minutes * 60000;
  const seconds = Math.floor(diff / 1000);

  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export default function UserProfilePage({ appUser }) {
  const router = useRouter();
  const { id } = router.query;
  const me = appUser || null;

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [dailyQuest, setDailyQuest] = useState(null);
  const [dailyBusy, setDailyBusy] = useState(false);
  const [dailyErr, setDailyErr] = useState("");
  const [selectedDailyOptionKey, setSelectedDailyOptionKey] = useState("");
  const [dailyNowMs, setDailyNowMs] = useState(Date.now());

  useEffect(() => {
    if (!id) return;

    (async () => {
      setLoading(true);
      setErr("");
      try {
        const r = await fetch(`/api/users/${id}`);
        const j = await r.json();
        if (!r.ok) {
          setErr(j.error || "Profil konnte nicht geladen werden");
          setProfile(null);
          return;
        }
        setProfile(j);
      } catch (e) {
        setErr(String(e));
        setProfile(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const memberships = profile?.memberships || [];

  const isOwnProfile = !!me && !!profile?.user && String(me.id) === String(profile.user.id);

  async function loadDailyQuest() {
    setDailyBusy(true);
    setDailyErr("");
    try {
      const r = await fetch("/api/daily-quest");
      const j = await r.json();
      if (!r.ok) {
        setDailyQuest(null);
        setDailyErr(j.error || "Daily Quest konnte nicht geladen werden.");
        return;
      }
      setDailyQuest(j.quest || null);
    } catch (e) {
      setDailyQuest(null);
      setDailyErr(String(e));
    } finally {
      setDailyBusy(false);
    }
  }

  async function triggerDailyQuest(action) {
    setDailyBusy(true);
    setDailyErr("");
    try {
      const r = await fetch("/api/daily-quest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const j = await r.json();
      if (!r.ok) {
        setDailyErr(j.error || "Daily Quest konnte nicht erstellt werden.");
        return;
      }
      setDailyQuest(j.quest || null);
      setSelectedDailyOptionKey("");
    } catch (e) {
      setDailyErr(String(e));
    } finally {
      setDailyBusy(false);
    }
  }

  async function confirmDailyQuestSelection() {
    if (!selectedDailyOptionKey) return;
    setDailyBusy(true);
    setDailyErr("");
    try {
      const r = await fetch("/api/daily-quest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "select", selectedQuestKey: selectedDailyOptionKey }),
      });
      const j = await r.json();
      if (!r.ok) {
        setDailyErr(j.error || "Auswahl konnte nicht bestaetigt werden.");
        return;
      }
      setDailyQuest(j.quest || null);
      setSelectedDailyOptionKey("");
    } catch (e) {
      setDailyErr(String(e));
    } finally {
      setDailyBusy(false);
    }
  }

  useEffect(() => {
    if (!isOwnProfile) {
      setDailyQuest(null);
      setDailyErr("");
      return;
    }
    (async () => {
      await loadDailyQuest();
    })();
  }, [isOwnProfile]);

  useEffect(() => {
    if (!isOwnProfile) return;
    const t = setInterval(() => setDailyNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, [isOwnProfile]);

  if (!id || loading) {
    return <div style={{ padding: 40, fontFamily: "system-ui" }}>Loading...</div>;
  }

  return (
    <div style={{ padding: 40, fontFamily: "system-ui", maxWidth: 1000, margin: "0 auto" }}>
      <a href="/" style={{ display: "inline-block", marginBottom: 12 }}>
        {"<-"} Home
      </a>

      {err ? <p style={{ color: "crimson" }}>{err}</p> : null}

      {profile?.user ? (
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 6 }}>
          {profile.user.avatar_url ? (
            <img
              src={profile.user.avatar_url}
              alt={profile.user.display_name || profile.user.steamid64}
              width={64}
              height={64}
              style={{ borderRadius: "50%" }}
            />
          ) : null}
          <div>
            <h1 style={{ margin: 0 }}>{profile.user.display_name || "Unbekannter User"}</h1>
            <div style={{ marginTop: 4, opacity: 0.8 }}>SteamID: {profile.user.steamid64}</div>
          </div>
        </div>
      ) : null}

      {isOwnProfile ? (
        <section style={{ marginTop: 20, border: "1px solid #ddd", borderRadius: 12, padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <h2 style={{ margin: 0 }}>Daily Quest</h2>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => triggerDailyQuest("ensure")}
                disabled={dailyBusy}
                style={{ padding: "8px 12px" }}
              >
                {dailyBusy ? "Lade..." : dailyQuest ? "Quest neu laden" : "Daily Quest holen"}
              </button>
              <button
                type="button"
                onClick={() => triggerDailyQuest("reroll")}
                disabled={dailyBusy || !dailyQuest || !!dailyQuest.selected}
                style={{ padding: "8px 12px" }}
              >
                Neu wuerfeln
              </button>
            </div>
          </div>
          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>
            Reset in: <b>{dailyQuestTimeLeftLabel(dailyNowMs)}</b> (00:00 UTC)
          </div>

          {dailyErr ? <p style={{ color: "crimson", marginTop: 8 }}>{dailyErr}</p> : null}

          {!dailyQuest ? (
            <p style={{ marginTop: 8, opacity: 0.85 }}>Noch keine Quest fuer heute.</p>
          ) : !dailyQuest.selected ? (
            <div style={{ marginTop: 10 }}>
              <div style={{ marginBottom: 8, fontSize: 13, opacity: 0.9 }}>
                Waehle 1 Achievement aus 3 Vorschlaegen und bestaetige die Daily Quest.
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                {(dailyQuest.options || []).map((option) => {
                  const selected = String(selectedDailyOptionKey) === String(option.questKey);
                  return (
                    <button
                      key={option.questKey}
                      type="button"
                      onClick={() => setSelectedDailyOptionKey(option.questKey)}
                      disabled={dailyBusy}
                      style={{
                        border: selected ? "1px solid rgba(0, 234, 255, 0.65)" : "1px solid rgba(255, 255, 255, 0.2)",
                        borderRadius: 10,
                        background: selected
                          ? "linear-gradient(135deg, rgba(0, 234, 255, 0.14) 0%, rgba(47, 255, 178, 0.08) 100%)"
                          : "rgba(255, 255, 255, 0.02)",
                        color: "inherit",
                        textAlign: "left",
                        padding: 10,
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      {option.achievementIcon ? (
                        <img src={option.achievementIcon} alt={option.achievementDisplayName} width={34} height={34} style={{ borderRadius: 6 }} />
                      ) : null}
                      <div>
                        <div style={{ fontWeight: 700 }}>{option.achievementDisplayName}</div>
                        <div style={{ fontSize: 12, opacity: 0.82 }}>
                          {option.gameTitle} (AppID: {option.appid})
                        </div>
                        <div style={{ fontSize: 12, opacity: 0.75 }}>
                          {option.achievementDescription || "Keine Beschreibung"}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div style={{ marginTop: 10 }}>
                <button
                  type="button"
                  onClick={confirmDailyQuestSelection}
                  disabled={dailyBusy || !selectedDailyOptionKey}
                  style={{ padding: "8px 12px" }}
                >
                  Auswahl bestaetigen
                </button>
              </div>
            </div>
          ) : (
            <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10 }}>
              {dailyQuest.achievementIcon ? (
                <img src={dailyQuest.achievementIcon} alt={dailyQuest.achievementDisplayName} width={36} height={36} style={{ borderRadius: 6 }} />
              ) : null}
              <div>
                <div style={{ fontWeight: 700 }}>{dailyQuest.achievementDisplayName}</div>
                <div style={{ fontSize: 13, opacity: 0.85 }}>{dailyQuest.gameTitle} (AppID: {dailyQuest.appid})</div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>
                  {dailyQuest.achievementDescription || "Keine Beschreibung"} | Rerolls heute: {dailyQuest.rerollCount || 0}
                </div>
                <div style={{ fontSize: 12, marginTop: 2, color: dailyQuest.done ? "#6ef7a2" : "#ffd38a" }}>
                  Status: {dailyQuest.done ? "Bereits abgeschlossen" : "Offen"}
                </div>
              </div>
            </div>
          )}
        </section>
      ) : null}

      <h2 style={{ marginTop: 28 }}>Beigetretene Gruppen</h2>
      {memberships.length === 0 ? (
        <p style={{ opacity: 0.8 }}>Dieser Nutzer ist aktuell in keiner Gruppe.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10 }}>
          {memberships.map((membership) => {
            const group = membership?.groups;
            if (!group?.id) return null;
            return (
              <li key={`${group.id}-${membership.joined_at || "membership"}`} style={{ border: "1px solid #ddd", borderRadius: 10, padding: 12 }}>
                <div style={{ fontWeight: 700 }}>
                  <a href={`/group/${group.id}`} style={{ color: "#9defff", textDecoration: "underline" }}>
                    {group.name || `Gruppe ${group.id}`}
                  </a>
                </div>
                <div style={{ marginTop: 4, fontSize: 13, opacity: 0.85 }}>
                  Rolle: {membership.role || "member"} | Beigetreten: {formatDate(membership.joined_at)}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}


