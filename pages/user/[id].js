import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

const MODE_LABELS = {
  overall_progress: "Overall achievement progress",
  rarest_10: "Die 10 seltensten Achievements",
  custom: "Custom Auswahl",
};

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("de-DE");
}

export default function UserProfilePage() {
  const router = useRouter();
  const { id } = router.query;

  const [profile, setProfile] = useState(null);
  const [userGames, setUserGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

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

  useEffect(() => {
    const steamid = profile?.user?.steamid64;
    if (!steamid) {
      setUserGames([]);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/steam/games?steamid=${encodeURIComponent(steamid)}`);
        const j = await r.json();
        if (!r.ok || cancelled) return;
        setUserGames(j.games || []);
      } catch {
        if (!cancelled) setUserGames([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [profile?.user?.steamid64]);

  const memberships = profile?.memberships || [];
  const leaderboards = profile?.leaderboards || [];

  const groupNameById = useMemo(() => {
    const map = new Map();
    for (const membership of memberships) {
      const groupId = membership?.groups?.id;
      const groupName = membership?.groups?.name;
      if (!groupId) continue;
      map.set(String(groupId), groupName || `Gruppe ${groupId}`);
    }
    return map;
  }, [memberships]);

  const userGamesByAppid = useMemo(() => {
    const map = new Map();
    for (const g of userGames) map.set(String(g.appid), g);
    return map;
  }, [userGames]);

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

      <h2 style={{ marginTop: 28 }}>Ranglisten in diesen Gruppen</h2>
      {leaderboards.length === 0 ? (
        <p style={{ opacity: 0.8 }}>Keine Ranglisten in den beigetretenen Gruppen gefunden.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10 }}>
          {leaderboards.map((lb) => {
            const groupId = lb.group_id;
            const groupName = lb?.groups?.name || groupNameById.get(String(groupId)) || `Gruppe ${groupId}`;
            const game = userGamesByAppid.get(String(lb.appid));
            return (
              <li key={lb.id || `${groupId}-${lb.appid}`} style={{ border: "1px solid #ddd", borderRadius: 10, padding: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {game?.libraryCapsuleUrl || game?.iconUrl ? (
                    <img
                      src={game.libraryCapsuleUrl || game.iconUrl}
                      alt={lb.title || `App ${lb.appid}`}
                      width={64}
                      height={96}
                      style={{ borderRadius: 8, objectFit: "cover", background: "#f2f2f2" }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 64,
                        height: 96,
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
                    <div style={{ marginTop: 4, fontSize: 13, opacity: 0.85 }}>
                      Gruppe:{" "}
                      <a href={`/group/${groupId}`} style={{ color: "#9defff", textDecoration: "underline" }}>
                        {groupName}
                      </a>
                    </div>
                    <div style={{ marginTop: 2, fontSize: 13, opacity: 0.85 }}>
                      AppID: {lb.appid} | Typ: {MODE_LABELS[lb.mode] || MODE_LABELS.overall_progress}
                    </div>
                    <div style={{ marginTop: 2, fontSize: 12, opacity: 0.75 }}>
                      Erstellt: {formatDate(lb.created_at)}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

