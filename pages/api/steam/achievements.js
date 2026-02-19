import { fetchSteamAchievements } from "../../../lib/steamAchievements";

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
    const mergedResult = await fetchSteamAchievements({
      steamid,
      appid,
      apiKey: key,
      language: "german",
    });

    res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=3600");
    res.status(200).json(mergedResult);
  } catch (e) {
    res.status(500).json({ error: "Server error", details: String(e?.message || e) });
  }
}
