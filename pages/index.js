import { useMemo, useState } from "react";

export default function Home() {
  const [steamid, setSteamid] = useState("");

  const [games, setGames] = useState([]);
  const [gamesLoading, setGamesLoading] = useState(false);
  const [gamesErr, setGamesErr] = useState("");

  const [appid, setAppid] = useState("");
  const [gameSearch, setGameSearch] = useState("");

  const [achData, setAchData] = useState(null);
  const [achErr, setAchErr] = useState("");
  const [achLoading, setAchLoading] = useState(false);

  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");

  async function loadGames() {
    setGamesErr("");
    setGames([]);
    setAppid("");
    setAchData(null);
    setAchErr("");

    if (!steamid) return;

    setGamesLoading(true);
    try {
      const r = await fetch(`/api/steam/games?steamid=${encodeURIComponent(steamid)}`);
      const j = await r.json();
      if (!r.ok) setGamesErr(j?.error || "Fehler beim Laden der Spiele");
      else setGames(j.games || []);
    } catch (e) {
      setGamesErr(String(e));
    } finally {
      setGamesLoading(false);
    }
  }

  async function loadAchievements() {
    setAchErr("");
    setAchData(null);
    if (!steamid || !appid) return;

    setAchLoading(true);
    try {
      const r = await fetch(
        `/api/steam/achievements?steamid=${encodeURIComponent(steamid)}&appid=${encodeURIComponent(appid)}`
      );
      const j = await r.json();
      if (!r.ok) setAchErr(j?.error || "Fehler beim Laden der Achievements");
      else setAchData(j);
    } catch (e) {
      setAchErr(String(e));
    } finally {
      setAchLoading(false);
    }
  }

  const filteredGames = useMemo(() => {
    const s = gameSearch.trim().toLowerCase();
    if (!s) return games.slice(0, 200);
    return games
      .filter(g => (g.name || "").toLowerCase().includes(s))
      .slice(0, 200);
  }, [games, gameSearch]);

  const selectedGame = useMemo(() => {
    const a = Number(appid);
    return games.find(g => g.appid === a) || null;
  }, [games, appid]);

  const shownAchievements = useMemo(() => {
    const list = achData?.achievements || [];
    return list
      .filter(a => (filter === "all" ? true : filter === "unlocked" ? a.achieved : !a.achieved))
      .filter(a => {
        const hay = `${a.displayName} ${a.description}`.toLowerCase();
        return hay.includes(q.toLowerCase());
      })
      .sort((a, b) => {
        if (a.achieved !== b.achieved) return a.achieved ? -1 : 1;
        return a.displayName.localeCompare(b.displayName);
      });
  }, [achData, filter, q]);

  const unlocked = achData?.unlocked || 0;
  const total = achData?.total || 0;
  const pct = total ? Math.round((unlocked / total) * 1000) / 10 : 0;

  // Steam Header-Bild (funktioniert für die meisten Spiele)
  const headerUrl = appid ? `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/header.jpg` : "";

  return (
    <div style={{ maxWidth: 1100, margin: "40px auto", padding: 16, fontFamily: "system-ui" }}>
      <h1>Steam Achievements Viewer</h1>

      {/* Step 1: SteamID */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input
          placeholder="SteamID64 (7656...)"
          value={steamid}
          onChange={(e) => setSteamid(e.target.value)}
          style={{ padding: 10, minWidth: 280 }}
        />
        <button onClick={loadGames} disabled={!steamid || gamesLoading} style={{ padding: "10px 14px" }}>
          {gamesLoading ? "Spiele laden..." : "Spiele laden"}
        </button>
      </div>
      {gamesErr && <p style={{ color: "crimson" }}>{gamesErr}</p>}

      {/* Step 2: Game selection */}
      {games.length > 0 && (
        <div style={{ marginTop: 18, border: "1px solid #ddd", borderRadius: 12, padding: 12 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <input
              placeholder={`Suche in ${games.length} Spielen…`}
              value={gameSearch}
              onChange={(e) => setGameSearch(e.target.value)}
              style={{ padding: 10, minWidth: 280 }}
            />

            <select value={appid} onChange={(e) => setAppid(e.target.value)} style={{ padding: 10, minWidth: 320 }}>
              <option value="">— Spiel auswählen —</option>
              {filteredGames.map((g) => (
                <option key={g.appid} value={g.appid}>
                  {g.name} ({g.playtime_forever} min)
                </option>
              ))}
            </select>

            <button onClick={loadAchievements} disabled={!appid || achLoading} style={{ padding: "10px 14px" }}>
              {achLoading ? "Achievements..." : "Achievements laden"}
            </button>
          </div>

          {selectedGame && (
            <div style={{ marginTop: 12, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              {selectedGame.iconUrl ? (
                <img src={selectedGame.iconUrl} alt="" width={32} height={32} style={{ borderRadius: 6 }} />
              ) : null}
              <strong>{selectedGame.name}</strong>
              <span style={{ opacity: 0.7 }}>AppID: {selectedGame.appid}</span>
            </div>
          )}

          {appid ? (
            <div style={{ marginTop: 12 }}>
              <img
                src={headerUrl}
                alt=""
                style={{ width: "100%", maxWidth: 600, borderRadius: 12 }}
                onError={(e) => (e.currentTarget.style.display = "none")}
              />
            </div>
          ) : null}

          <p style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
            Hinweis: Steam muss „Game details / Spieldetails“ auf **Public** haben, sonst liefert Steam keine Owned Games / Achievements.
          </p>
        </div>
      )}

      {/* Step 3: Achievements */}
      {achErr && <p style={{ color: "crimson" }}>{achErr}</p>}

      {achData && (
        <div style={{ marginTop: 18 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <strong>{unlocked}/{total} ({pct}%)</strong>

            <select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ padding: 10 }}>
              <option value="all">Alle</option>
              <option value="unlocked">Unlocked</option>
              <option value="locked">Locked</option>
            </select>

            <input
              placeholder="Achievement-Suche…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={{ padding: 10, minWidth: 260 }}
            />
          </div>

          <div
            style={{
              marginTop: 16,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: 12
            }}
          >
            {shownAchievements.map((a) => (
              <div
                key={a.apiName}
                style={{
                  display: "flex",
                  gap: 12,
                  padding: 12,
                  border: "1px solid #ddd",
                  borderRadius: 12,
                  opacity: a.achieved ? 1 : 0.75
                }}
              >
                <img
                  src={a.achieved ? a.icon : a.icongray}
                  alt=""
                  width={64}
                  height={64}
                  style={{ borderRadius: 8, objectFit: "cover" }}
                />
                <div>
                  <div style={{ fontWeight: 700 }}>{a.displayName}</div>
                  <div style={{ fontSize: 13, marginTop: 4 }}>{a.description}</div>
                  <div style={{ fontSize: 12, marginTop: 6 }}>
                    Status: {a.achieved ? "Unlocked" : "Locked"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
