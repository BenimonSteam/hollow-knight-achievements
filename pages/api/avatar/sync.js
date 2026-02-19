import { requireUser } from "../../../lib/auth";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { fetchSteamAchievements } from "../../../lib/steamAchievements";
import { levelFromXp, xpFromAchievements, xpForLevel } from "../../../lib/avatarProgress";

async function ensureAvatar(userId) {
  const { data: existing } = await supabaseAdmin
    .from("user_avatars")
    .select("user_id,name,total_xp,level,battles_won,battles_lost,last_synced_at")
    .eq("user_id", userId)
    .single();
  if (existing) return existing;

  const { data: created, error } = await supabaseAdmin
    .from("user_avatars")
    .insert({ user_id: userId, total_xp: 0, level: 1 })
    .select("user_id,name,total_xp,level,battles_won,battles_lost,last_synced_at")
    .single();
  if (error) throw error;
  return created;
}

export default async function handler(req, res) {
  const user = await requireUser(req, res);
  if (!user) return;

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const appid = Number(req.body?.appid);
  const gameTitle = req.body?.gameTitle ? String(req.body.gameTitle).slice(0, 140) : null;
  if (!Number.isFinite(appid) || appid <= 0) {
    return res.status(400).json({ error: "Invalid appid" });
  }

  if (!process.env.STEAM_API_KEY) {
    return res.status(500).json({ error: "Missing STEAM_API_KEY" });
  }

  try {
    await ensureAvatar(user.id);

    const steamData = await fetchSteamAchievements({
      steamid: user.steamid64,
      appid,
      apiKey: process.env.STEAM_API_KEY,
      language: "german",
    });

    const gameXp = xpFromAchievements(steamData.achievements);

    const { error: upsertGameError } = await supabaseAdmin
      .from("user_avatar_game_progress")
      .upsert(
        {
          user_id: user.id,
          appid,
          game_title: gameTitle,
          unlocked_count: steamData.unlocked,
          total_count: steamData.total,
          game_xp: gameXp,
          synced_at: new Date().toISOString(),
        },
        { onConflict: "user_id,appid" }
      );
    if (upsertGameError) {
      return res.status(500).json({ error: String(upsertGameError.message || upsertGameError) });
    }

    const { data: progressRows, error: progressError } = await supabaseAdmin
      .from("user_avatar_game_progress")
      .select("unlocked_count,total_count,game_xp")
      .eq("user_id", user.id);
    if (progressError) {
      return res.status(500).json({ error: String(progressError.message || progressError) });
    }

    const totalXp = (progressRows || []).reduce((sum, row) => sum + Number(row?.game_xp || 0), 0);
    const totalUnlocked = (progressRows || []).reduce((sum, row) => sum + Number(row?.unlocked_count || 0), 0);
    const totalAchievements = (progressRows || []).reduce((sum, row) => sum + Number(row?.total_count || 0), 0);
    const level = levelFromXp(totalXp);

    const { data: avatar, error: avatarError } = await supabaseAdmin
      .from("user_avatars")
      .upsert(
        {
          user_id: user.id,
          total_xp: totalXp,
          level,
          last_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      )
      .select("user_id,name,total_xp,level,battles_won,battles_lost,last_synced_at")
      .single();

    if (avatarError) {
      return res.status(500).json({ error: String(avatarError.message || avatarError) });
    }

    return res.status(200).json({
      avatar: {
        ...avatar,
        currentLevelStartXp: xpForLevel(level),
        nextLevelStartXp: xpForLevel(level + 1),
      },
      syncedGame: {
        appid,
        unlocked: steamData.unlocked,
        total: steamData.total,
        gameXp,
      },
      totals: {
        totalXp,
        totalUnlocked,
        totalAchievements,
      },
    });
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
