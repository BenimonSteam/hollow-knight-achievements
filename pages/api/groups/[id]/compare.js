import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { requireUser } from "../../../../lib/auth";

const MODE_LABELS = {
  overall_progress: "Overall achievement progress",
  rarest_10: "Die 10 seltensten Achievements",
  custom: "Custom Auswahl",
};

async function fetchJson(url) {
  const r = await fetch(url);
  const j = await r.json();
  return { ok: r.ok, status: r.status, j };
}

export default async function handler(req, res) {
  const user = await requireUser(req, res);
  if (!user) return;

  const groupId = req.query.id;
  const appid = Number(req.query.appid);
  if (!Number.isFinite(appid)) return res.status(400).json({ error: "Missing/invalid appid" });

  // check membership
  const { data: mem } = await supabaseAdmin
    .from("group_members")
    .select("role")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .single();
  if (!mem) return res.status(403).json({ error: "Not a member" });

  // get members (steamid64)
  const { data: rows } = await supabaseAdmin
    .from("group_members")
    .select("users:users(id,steamid64,display_name,avatar_url)")
    .eq("group_id", groupId);

  const members = (rows || []).map(r => r.users).filter(Boolean);

  const key = process.env.STEAM_API_KEY;
  if (!key) return res.status(500).json({ error: "Missing STEAM_API_KEY" });

  const { data: leaderboardRow } = await supabaseAdmin
    .from("group_leaderboards")
    .select("mode, tracked_achievement_api_names")
    .eq("group_id", groupId)
    .eq("appid", appid)
    .maybeSingle();

  const mode = leaderboardRow?.mode || "overall_progress";

  // schema once
  const schemaUrl =
    `https://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2/?key=${encodeURIComponent(key)}&appid=${appid}&l=german`;
  const schema = await fetchJson(schemaUrl);
  const schemaAchievements = schema.j?.game?.availableGameStats?.achievements || [];
  const schemaByApiName = new Map(schemaAchievements.map((a) => [a.name, a]));

  let selectedAchievements = schemaAchievements;

  if (mode === "rarest_10") {
    const globalPercentagesUrl =
      `https://api.steampowered.com/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v2/` +
      `?gameid=${encodeURIComponent(appid)}&format=json`;
    const globalPercentages = await fetchJson(globalPercentagesUrl);
    const percentageRows = globalPercentages.j?.achievementpercentages?.achievements || [];
    const percentageByApiName = new Map(
      percentageRows
        .map((row) => [row?.name, Number(row?.percent)])
        .filter(([name, percent]) => !!name && Number.isFinite(percent))
    );

    selectedAchievements = [...schemaAchievements]
      .sort((a, b) => {
        const pa = percentageByApiName.has(a.name) ? percentageByApiName.get(a.name) : Number.POSITIVE_INFINITY;
        const pb = percentageByApiName.has(b.name) ? percentageByApiName.get(b.name) : Number.POSITIVE_INFINITY;
        if (pa !== pb) return pa - pb;
        return String(a.displayName || a.name).localeCompare(String(b.displayName || b.name));
      })
      .slice(0, 10);
  }

  if (mode === "custom") {
    const trackedAchievementApiNames = Array.isArray(leaderboardRow?.tracked_achievement_api_names)
      ? leaderboardRow.tracked_achievement_api_names
      : [];

    if (trackedAchievementApiNames.length === 0) {
      return res.status(400).json({ error: "Custom leaderboard has no tracked achievements" });
    }

    selectedAchievements = trackedAchievementApiNames
      .map((apiName) => schemaByApiName.get(apiName))
      .filter(Boolean);
  }

  const selectedApiNames = selectedAchievements.map((a) => a.name);
  const selectedApiNameSet = new Set(selectedApiNames);

  // for each member, fetch their achievements
  const perUser = await Promise.all(
    members.map(async (m) => {
      const url =
        `https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v1/` +
        `?key=${encodeURIComponent(key)}&steamid=${encodeURIComponent(m.steamid64)}&appid=${appid}`;

      const r = await fetchJson(url);
      const ps = r.j?.playerstats;
      const list = ps?.achievements || [];
      const unlockedSet = new Set(list.filter(a => a.achieved === 1).map(a => a.apiname));
      return {
        steamid64: m.steamid64,
        displayName: m.display_name || m.steamid64,
        avatarUrl: m.avatar_url || "",
        ok: !!ps && !ps?.error,
        error: ps?.error || null,
        unlockedCount: selectedApiNames.filter((apiName) => unlockedSet.has(apiName)).length,
        unlockedSet: Array.from(unlockedSet),
      };
    })
  );

  // matrix: achievement -> steamid -> bool
  const matrix = {};
  for (const ach of selectedAchievements) {
    const apiName = ach.name;
    matrix[apiName] = {};
    for (const u of perUser) {
      const set = new Set(u.unlockedSet);
      matrix[apiName][u.steamid64] = selectedApiNameSet.has(apiName) && set.has(apiName);
    }
  }

  res.status(200).json({
    appid,
    mode,
    modeLabel: MODE_LABELS[mode] || MODE_LABELS.overall_progress,
    total: selectedAchievements.length,
    totalInGame: schemaAchievements.length,
    achievements: selectedAchievements.map(a => ({
      apiName: a.name,
      displayName: a.displayName,
      description: a.description || "",
      icon: a.icon,
      icongray: a.icongray,
    })),
    members: perUser.map(u => ({
      steamid64: u.steamid64,
      displayName: u.displayName,
      avatarUrl: u.avatarUrl,
      ok: u.ok,
      error: u.error,
      unlockedCount: u.unlockedCount,
    })),
    matrix,
  });
}
