import { requireUser } from "../../../lib/auth";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { battleStatsForLevel } from "../../../lib/avatarProgress";

export default async function handler(req, res) {
  const me = await requireUser(req, res);
  if (!me) return;

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const battleId = Number(req.query.id);
  if (!Number.isFinite(battleId)) {
    return res.status(400).json({ error: "Invalid battle id" });
  }

  const { data: battle, error } = await supabaseAdmin
    .from("avatar_battles")
    .select("*")
    .eq("id", battleId)
    .single();

  if (error || !battle) {
    return res.status(404).json({ error: "Battle not found" });
  }

  const meIsParticipant =
    String(battle.challenger_user_id) === String(me.id) ||
    String(battle.opponent_user_id) === String(me.id);
  if (!meIsParticipant) {
    return res.status(403).json({ error: "Not allowed" });
  }

  const participantIds = [battle.challenger_user_id, battle.opponent_user_id];
  const { data: users } = await supabaseAdmin
    .from("users")
    .select("id,display_name,avatar_url,steamid64")
    .in("id", participantIds);
  const userById = new Map((users || []).map((u) => [String(u.id), u]));

  const { data: avatars } = await supabaseAdmin
    .from("user_avatars")
    .select("user_id,name,total_xp,level,battles_won,battles_lost")
    .in("user_id", participantIds);
  const avatarByUserId = new Map((avatars || []).map((a) => [String(a.user_id), a]));

  const challengerStats = battleStatsForLevel(battle.challenger_level);
  const opponentStats = battleStatsForLevel(battle.opponent_level);

  return res.status(200).json({
    battle,
    you: me.id,
    challenger: {
      user: userById.get(String(battle.challenger_user_id)) || null,
      avatar: avatarByUserId.get(String(battle.challenger_user_id)) || null,
      stats: challengerStats,
      currentHp: battle.challenger_hp,
      currentBlock: battle.challenger_block,
    },
    opponent: {
      user: userById.get(String(battle.opponent_user_id)) || null,
      avatar: avatarByUserId.get(String(battle.opponent_user_id)) || null,
      stats: opponentStats,
      currentHp: battle.opponent_hp,
      currentBlock: battle.opponent_block,
    },
  });
}
