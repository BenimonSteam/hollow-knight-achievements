export default async function handler(req, res) {
  try {
    const steamid = req.query.steamid;
    const appidRaw = req.query.appid;

    if (!steamid) return res.status(400).json({ error: "Missing steamid" });
    if (!appidRaw) return res.status(400).json({ error: "Missing appid" });

    const appid = Number(appidRaw);
    if (!Number.isFinite(appid)) return res.status(400).json({ error: "Invalid appid" });

    const key = process.env.STEAM_API_KEY;
    if (!key) return res.status(500).json({ error: "Missing STEAM_API_KEY" });

    const playerUrl =
      `https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v1/` +
      `?key=${encodeURIComponent(key)}&steamid=${encodeURIComponent(steamid)}&appid=${appid}`;

    const schemaUrl =
      `https://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2/` +
      `?key=${encodeURIComponent(key)}&appid=${appid}&l=german`;

    const globalPercentagesUrl =
      `https://api.steampowered.com/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v2/` +
      `?gameid=${encodeURIComponent(appid)}&format=json`;

    const [playerResp, schemaResp, globalResp] = await Promise.all([
      fetch(playerUrl),
      fetch(schemaUrl),
      fetch(globalPercentagesUrl),
    ]);

    const playerJson = await playerResp.json();
    const schemaJson = await schemaResp.json();
    const globalJson = await globalResp.json();

    const playerStats = playerJson?.playerstats;
    if (!playerStats || playerStats?.error) {
      return res.status(400).json({ error: playerStats?.error || "Steam API error" });
    }

    const playerAchievements = playerStats.achievements || [];
    const schemaAchievements = schemaJson?.game?.availableGameStats?.achievements || [];
    const globalAchievements = globalJson?.achievementpercentages?.achievements || [];

    const schemaMap = new Map(schemaAchievements.map(a => [a.name, a]));
    const globalPercentMap = new Map(
      globalAchievements
        .map((a) => [a?.name, Number(a?.percent)])
        .filter(([name, percent]) => !!name && Number.isFinite(percent))
    );

    function rarityLabel(percent) {
      if (!Number.isFinite(percent)) return "Unbekannt";
      if (percent < 1) return "Extrem selten";
      if (percent < 5) return "Sehr selten";
      if (percent < 15) return "Selten";
      if (percent < 35) return "Ungewoehnlich";
      return "Haeufig";
    }

    const merged = playerAchievements.map(a => {
      const meta = schemaMap.get(a.apiname) || {};
      const globalPercent = globalPercentMap.has(a.apiname) ? globalPercentMap.get(a.apiname) : null;
      return {
        apiName: a.apiname,
        achieved: a.achieved === 1,
        unlockTime: a.unlocktime || 0,
        displayName: meta.displayName || a.apiname,
        description: meta.description || "",
        icon: meta.icon || "",
        icongray: meta.icongray || "",
        globalPercent,
        rarityLabel: rarityLabel(globalPercent),
      };
    });

    for (const meta of schemaAchievements) {
      if (!merged.find(x => x.apiName === meta.name)) {
        const globalPercent = globalPercentMap.has(meta.name) ? globalPercentMap.get(meta.name) : null;
        merged.push({
          apiName: meta.name,
          achieved: false,
          unlockTime: 0,
          displayName: meta.displayName || meta.name,
          description: meta.description || "",
          icon: meta.icon || "",
          icongray: meta.icongray || "",
          globalPercent,
          rarityLabel: rarityLabel(globalPercent),
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
