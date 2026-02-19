import { requireUser } from "../../../lib/auth";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { levelFromXp, xpForLevel } from "../../../lib/avatarProgress";

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

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const avatar = await ensureAvatar(user.id);
    const level = levelFromXp(avatar.total_xp || 0);
    const currentLevelStartXp = xpForLevel(level);
    const nextLevelStartXp = xpForLevel(level + 1);

    const { data: gameProgressRows } = await supabaseAdmin
      .from("user_avatar_game_progress")
      .select("appid,game_title,unlocked_count,total_count,game_xp,synced_at")
      .eq("user_id", user.id)
      .order("synced_at", { ascending: false });

    return res.status(200).json({
      avatar: {
        ...avatar,
        level,
        currentLevelStartXp,
        nextLevelStartXp,
      },
      gameProgress: gameProgressRows || [],
    });
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
