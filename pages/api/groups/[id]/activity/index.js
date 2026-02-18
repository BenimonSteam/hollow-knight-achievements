import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { requireUser } from "../../../../../lib/auth";
import { buildGroupActivityEventId } from "../../../../../lib/activityEventId";

async function fetchJson(url) {
  const r = await fetch(url);
  const j = await r.json();
  return { ok: r.ok, status: r.status, j };
}

function normalizeLimit(rawLimit) {
  const parsed = Number(rawLimit);
  if (!Number.isFinite(parsed)) return 5;
  return Math.max(1, Math.min(5, Math.trunc(parsed)));
}

export default async function handler(req, res) {
  const user = await requireUser(req, res);
  if (!user) return;

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const groupId = req.query.id;
  const limit = normalizeLimit(req.query.limit);
  const requestedAppid = Number(req.query.appid);

  const { data: membership } = await supabaseAdmin
    .from("group_members")
    .select("role")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .single();
  if (!membership) return res.status(403).json({ error: "Not a member" });

  const { data: leaderboardRows, error: leaderboardError } = await supabaseAdmin
    .from("group_leaderboards")
    .select("appid,title")
    .eq("group_id", groupId);
  if (leaderboardError) {
    return res.status(500).json({ error: String(leaderboardError.message || leaderboardError) });
  }

  const trackedGameRows = (leaderboardRows || [])
    .map((row) => ({
      appid: Number(row?.appid),
      title: row?.title || null,
    }))
    .filter((row) => Number.isFinite(row.appid));

  const trackedGamesByAppid = new Map();
  for (const row of trackedGameRows) {
    if (!trackedGamesByAppid.has(row.appid)) trackedGamesByAppid.set(row.appid, row.title);
  }
  const trackedAppids = Array.from(trackedGamesByAppid.keys());
  const selectedTrackedAppids = Number.isFinite(requestedAppid)
    ? trackedAppids.filter((appid) => appid === requestedAppid)
    : [];

  if (selectedTrackedAppids.length === 0) {
    return res.status(200).json({ items: [], trackedGames: [] });
  }

  const { data: memberRows, error: memberError } = await supabaseAdmin
    .from("group_members")
    .select("users:users(id,steamid64,display_name,avatar_url)")
    .eq("group_id", groupId);
  if (memberError) {
    return res.status(500).json({ error: String(memberError.message || memberError) });
  }

  const members = (memberRows || [])
    .map((row) => row?.users)
    .filter((member) => member?.id && member?.steamid64);

  if (members.length === 0) {
    return res.status(200).json({
      items: [],
      trackedGames: selectedTrackedAppids.map((appid) => ({ appid, title: trackedGamesByAppid.get(appid) || null })),
    });
  }

  const key = process.env.STEAM_API_KEY;
  if (!key) return res.status(500).json({ error: "Missing STEAM_API_KEY" });

  const schemaByAppid = new Map();
  await Promise.all(
    selectedTrackedAppids.map(async (appid) => {
      const schemaUrl =
        `https://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2/` +
        `?key=${encodeURIComponent(key)}&appid=${encodeURIComponent(appid)}&l=german`;
      const schemaResponse = await fetchJson(schemaUrl);
      const schemaAchievements = schemaResponse.j?.game?.availableGameStats?.achievements || [];
      const byApiName = new Map();
      for (const achievement of schemaAchievements) {
        if (!achievement?.name) continue;
        byApiName.set(achievement.name, achievement);
      }
      schemaByAppid.set(appid, byApiName);
    })
  );

  const events = [];
  await Promise.all(
    selectedTrackedAppids.map(async (appid) => {
      const schemaForGame = schemaByAppid.get(appid) || new Map();
      await Promise.all(
        members.map(async (member) => {
          const achievementsUrl =
            `https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v1/` +
            `?key=${encodeURIComponent(key)}&steamid=${encodeURIComponent(member.steamid64)}&appid=${encodeURIComponent(appid)}`;
          const achievementsResponse = await fetchJson(achievementsUrl);
          const playerAchievements = achievementsResponse.j?.playerstats?.achievements || [];

          for (const unlocked of playerAchievements) {
            if (Number(unlocked?.achieved) !== 1) continue;
            const unlocktime = Number(unlocked?.unlocktime);
            if (!Number.isFinite(unlocktime) || unlocktime <= 0) continue;

            const apiName = unlocked?.apiname;
            const meta = apiName ? schemaForGame.get(apiName) : null;
            const eventId = buildGroupActivityEventId({
              groupId,
              appid,
              steamid64: member.steamid64,
              achievementApiName: apiName || "",
              unlocktime,
            });

            events.push({
              eventId,
              appid,
              gameTitle: trackedGamesByAppid.get(appid) || `App ${appid}`,
              achievementApiName: apiName || "",
              achievementName: meta?.displayName || apiName || "Achievement",
              achievementIcon: meta?.icon || "",
              unlocktime,
              unlockedAt: new Date(unlocktime * 1000).toISOString(),
              user: {
                id: String(member.id),
                steamid64: String(member.steamid64),
                displayName: member.display_name || member.steamid64,
                avatarUrl: member.avatar_url || "",
              },
            });
          }
        })
      );
    })
  );

  events.sort((a, b) => b.unlocktime - a.unlocktime);
  const items = events.slice(0, limit);

  const eventIds = items.map((item) => item.eventId).filter(Boolean);
  const commentCountByEventId = new Map();
  if (eventIds.length > 0) {
    const { data: commentRows, error: commentError } = await supabaseAdmin
      .from("group_feed_comments")
      .select("event_id")
      .eq("group_id", groupId)
      .in("event_id", eventIds);

    if (commentError) {
      return res.status(500).json({ error: String(commentError.message || commentError) });
    }

    for (const row of commentRows || []) {
      const key = String(row?.event_id || "");
      if (!key) continue;
      commentCountByEventId.set(key, (commentCountByEventId.get(key) || 0) + 1);
    }
  }

  return res.status(200).json({
    items: items.map((item) => ({
      ...item,
      commentCount: commentCountByEventId.get(item.eventId) || 0,
    })),
    trackedGames: selectedTrackedAppids.map((appid) => ({ appid, title: trackedGamesByAppid.get(appid) || null })),
  });
}
