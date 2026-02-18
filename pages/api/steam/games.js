export default async function handler(req, res) {
  try {
    const steamid = req.query.steamid;
    if (!steamid) return res.status(400).json({ error: "Missing steamid" });

    const key = process.env.STEAM_API_KEY;
    if (!key) return res.status(500).json({ error: "Missing STEAM_API_KEY" });

    // include_appinfo=1 liefert Namen + Icon/Logo Hashes
    const url =
      `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/` +
      `?key=${encodeURIComponent(key)}` +
      `&steamid=${encodeURIComponent(steamid)}` +
      `&include_appinfo=1&include_played_free_games=1`;

    const r = await fetch(url);
    const j = await r.json();

    const games = (j?.response?.games || [])
      .map(g => ({
        appid: g.appid,
        name: g.name || `App ${g.appid}`,
        playtime_forever: g.playtime_forever || 0,
        libraryCapsuleUrl: `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${g.appid}/library_600x900.jpg`,
        // Steam liefert Icon-Hash; daraus bauen wir eine URL
        iconUrl: g.img_icon_url
          ? `https://media.steampowered.com/steamcommunity/public/images/apps/${g.appid}/${g.img_icon_url}.jpg`
          : "",
      }))
      // optional: nur Spiele mit Namen, und nach Spielzeit sortiert
      .filter(g => g.name)
      .sort((a, b) => b.playtime_forever - a.playtime_forever);

    res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=3600");
    res.status(200).json({ count: games.length, games });
  } catch (e) {
    res.status(500).json({ error: "Server error", details: String(e) });
  }
}
