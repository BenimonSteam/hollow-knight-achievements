import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { requireUser } from "../../../../lib/auth";

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

  // schema once
  const schemaUrl =
    `https://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2/?key=${encodeURIComponent(key)}&appid=${appid}&l=german`;
  const schema = await fetchJson(schemaUrl);
  const schemaAchievements = schema.j?.game?.availableGameStats?.achievements || [];

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
        unlockedCount: unlockedSet.size,
        unlockedSet: Array.from(unlockedSet),
      };
    })
  );

  // matrix: achievement -> steamid -> bool
  const matrix = {};
  for (const ach of schemaAchievements) {
    const apiName = ach.name;
    matrix[apiName] = {};
    for (const u of perUser) {
      const set = new Set(u.unlockedSet);
      matrix[apiName][u.steamid64] = set.has(apiName);
    }
  }

  res.status(200).json({
    appid,
    total: schemaAchievements.length,
    achievements: schemaAchievements.map(a => ({
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
