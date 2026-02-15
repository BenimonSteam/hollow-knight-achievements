export default async function handler(req, res) {
  try {
    const steamid = req.query.steamid;
    if (!steamid) return res.status(400).json({ error: "Missing steamid" });

    const appid = 367520; // Hollow Knight
    const key = process.env.STEAM_API_KEY;
    if (!key) return res.status(500).json({ error: "Missing STEAM_API_KEY" });

    const playerUrl =
      `https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v1/` +
      `?key=${encodeURIComponent(key)}&steamid=${encodeURIComponent(steamid)}&appid=${appid}`;

    const schemaUrl =
      `https://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2/` +
      `?key=${encodeURIComponent(key)}&appid=${appid}&l=german`;

    const [playerResp, schemaResp] = await Promise.all([
      fetch(playerUrl),
      fetch(schemaUrl),
    ]);

    const playerJson = await playerResp.json();
    const schemaJson = await schemaResp.json();

    const playerStats = playerJson?.playerstats;
    if (!playerStats || playerStats?.error) {
      return res.status(400).json({ error: playerStats?.error || "Steam API error" });
    }

    const playerAchievements = playerStats.achievements || [];
    const schemaAchievements =
      schemaJson?.game?.availableGameStats?.achievements || [];

    const schemaMap = new Map(schemaAchievements.map(a => [a.name, a]));

    const merged = playerAchievements.map(a => {
      const meta = schemaMap.get(a.apiname) || {};
      return {
        apiName: a.apiname,
        achieved: a.achieved === 1,
        unlockTime: a.unlocktime || 0,
        displayName: meta.displayName || a.apiname,
        description: meta.description || "",
        icon: meta.icon || "",
        icongray: meta.icongray || "",
      };
    });

    // Falls schema Achievements enthält, die in playerAchievements fehlen:
    for (const meta of schemaAchievements) {
      if (!merged.find(x => x.apiName === meta.name)) {
        merged.push({
          apiName: meta.name,
          achieved: false,
          unlockTime: 0,
          displayName: meta.displayName || meta.name,
          description: meta.description || "",
          icon: meta.icon || "",
          icongray: meta.icongray || "",
        });
      }
    }

    res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=3600");
    res.status(200).json({
      appid,
      total: merged.length,
      unlocked: merged.filter(x => x.achieved).length,
      achievements: merged,
    });
  } catch (e) {
    res.status(500).json({ error: "Server error", details: String(e) });
  }
}
