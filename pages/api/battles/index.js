import { requireUser } from "../../../lib/auth";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { battleStatsForLevel, levelFromXp } from "../../../lib/avatarProgress";

async function ensureAvatar(userId) {
  const { data: avatar } = await supabaseAdmin
    .from("user_avatars")
    .select("user_id,total_xp,level")
    .eq("user_id", userId)
    .single();
  if (avatar) {
    const computedLevel = levelFromXp(avatar.total_xp || 0);
    if (computedLevel !== avatar.level) {
      const { data: synced } = await supabaseAdmin
        .from("user_avatars")
        .update({ level: computedLevel, updated_at: new Date().toISOString() })
        .eq("user_id", userId)
        .select("user_id,total_xp,level")
        .single();
      return synced || { ...avatar, level: computedLevel };
    }
    return avatar;
  }

  const { data: created, error } = await supabaseAdmin
    .from("user_avatars")
    .insert({ user_id: userId, total_xp: 0, level: 1 })
    .select("user_id,total_xp,level")
    .single();
  if (error) throw error;
  return created;
}

function pickAutoMove({ selfHp, selfMaxHp, selfBlock }) {
  const hpRatio = selfMaxHp > 0 ? selfHp / selfMaxHp : 0;
  const roll = Math.random();
  if (hpRatio < 0.3 && roll < 0.22) return { key: "heal", label: "Recover", type: "heal", accuracy: 1, power: 0 };
  if (selfBlock < 4 && roll > 0.82) return { key: "guard", label: "Guard", type: "guard", accuracy: 1, power: 0 };
  if (roll > 0.48) return { key: "power", label: "Power Shot", type: "damage", accuracy: 0.75, power: 1.4 };
  return { key: "strike", label: "Strike", type: "damage", accuracy: 0.95, power: 1 };
}

function statusText({ actorName, move, hit, damage, blocked, healAmount, guardAmount }) {
  if (move.type === "heal") return `${actorName} nutzt Recover (+${healAmount} HP).`;
  if (move.type === "guard") return `${actorName} nutzt Guard (+${guardAmount} Schild).`;
  if (!hit) return `${actorName} verfehlt mit ${move.label}.`;
  let text = `${actorName} trifft mit ${move.label} fuer ${damage} Schaden`;
  if (blocked > 0) text += ` (${blocked} geblockt)`;
  return `${text}.`;
}

export default async function handler(req, res) {
  const me = await requireUser(req, res);
  if (!me) return;

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const groupId = String(req.body?.groupId || "").trim();
  const opponentUserId = Number(req.body?.opponentUserId);
  if (!groupId || !Number.isFinite(opponentUserId)) {
    return res.status(400).json({ error: "Invalid groupId/opponentUserId" });
  }
  if (String(opponentUserId) === String(me.id)) {
    return res.status(400).json({ error: "You cannot battle yourself" });
  }

  const { data: group } = await supabaseAdmin
    .from("groups")
    .select("id,active_appid")
    .eq("id", groupId)
    .single();
  if (!group) return res.status(404).json({ error: "Group not found" });

  const { data: meMember } = await supabaseAdmin
    .from("group_members")
    .select("group_id,user_id")
    .eq("group_id", groupId)
    .eq("user_id", me.id)
    .single();
  if (!meMember) return res.status(403).json({ error: "Not a member of this group" });

  const { data: opponentMember } = await supabaseAdmin
    .from("group_members")
    .select("group_id,user_id")
    .eq("group_id", groupId)
    .eq("user_id", opponentUserId)
    .single();
  if (!opponentMember) return res.status(400).json({ error: "Opponent is not in this group" });

  try {
    const [myAvatar, opponentAvatar] = await Promise.all([
      ensureAvatar(me.id),
      ensureAvatar(opponentUserId),
    ]);
    const { data: users } = await supabaseAdmin
      .from("users")
      .select("id,display_name,steamid64")
      .in("id", [me.id, opponentUserId]);
    const userById = new Map((users || []).map((u) => [String(u.id), u]));

    const myLevel = levelFromXp(myAvatar?.total_xp || 0);
    const opponentLevel = levelFromXp(opponentAvatar?.total_xp || 0);
    const myStats = battleStatsForLevel(myLevel);
    const opponentStats = battleStatsForLevel(opponentLevel);

    const mySpeed = myLevel + Math.random();
    const opponentSpeed = opponentLevel + Math.random();
    let turnUserId = mySpeed >= opponentSpeed ? me.id : opponentUserId;
    let challengerHp = myStats.maxHp;
    let opponentHp = opponentStats.maxHp;
    let challengerBlock = 0;
    let opponentBlock = 0;
    let winnerUserId = null;
    const battleLog = [
      {
        turn: 0,
        actorUserId: null,
        move: "start",
        statusText: "Auto-Battle gestartet.",
        createdAt: new Date().toISOString(),
      },
    ];
    const maxTurns = 80;

    for (let turn = 1; turn <= maxTurns; turn += 1) {
      const actorIsChallenger = String(turnUserId) === String(me.id);
      const actorUserId = actorIsChallenger ? me.id : opponentUserId;
      const actorName =
        userById.get(String(actorUserId))?.display_name ||
        userById.get(String(actorUserId))?.steamid64 ||
        "Spieler";

      const selfStats = actorIsChallenger ? myStats : opponentStats;
      const enemyStats = actorIsChallenger ? opponentStats : myStats;
      let selfHp = actorIsChallenger ? challengerHp : opponentHp;
      let enemyHp = actorIsChallenger ? opponentHp : challengerHp;
      let selfBlock = actorIsChallenger ? challengerBlock : opponentBlock;
      let enemyBlock = actorIsChallenger ? opponentBlock : challengerBlock;

      const move = pickAutoMove({ selfHp, selfMaxHp: selfStats.maxHp, selfBlock });
      let hit = true;
      let damage = 0;
      let blocked = 0;
      let healAmount = 0;
      let guardAmount = 0;

      if (move.type === "damage") {
        const dodgeChance = 0.05 + Math.random() * 0.07;
        hit = Math.random() <= move.accuracy - dodgeChance;
        if (hit) {
          const variance = 0.65 + Math.random() * 0.7;
          const crit = Math.random() < 0.14;
          const critMult = crit ? 1.45 : 1;
          const rawDamage = Math.round(
            (selfStats.attack * move.power * 1.28 - enemyStats.defense * 0.42) * variance * critMult
          );
          const dealtBeforeBlock = Math.max(1, rawDamage);
          blocked = Math.min(enemyBlock, dealtBeforeBlock);
          damage = Math.max(0, dealtBeforeBlock - blocked);
          enemyBlock = Math.max(0, enemyBlock - blocked);
          enemyHp = Math.max(0, enemyHp - damage);
        }
      } else if (move.type === "heal") {
        healAmount = Math.min(selfStats.maxHp - selfHp, Math.max(1, Math.round(selfStats.healBase * 0.55)));
        selfHp += healAmount;
      } else if (move.type === "guard") {
        guardAmount = selfStats.guardBase;
        selfBlock += guardAmount;
      }

      selfBlock = Math.max(0, selfBlock - 1);
      enemyBlock = Math.max(0, enemyBlock - 1);

      if (actorIsChallenger) {
        challengerHp = selfHp;
        opponentHp = enemyHp;
        challengerBlock = selfBlock;
        opponentBlock = enemyBlock;
      } else {
        opponentHp = selfHp;
        challengerHp = enemyHp;
        opponentBlock = selfBlock;
        challengerBlock = enemyBlock;
      }

      battleLog.push({
        turn,
        actorUserId,
        move: move.key,
        hit,
        damage,
        blocked,
        healAmount,
        guardAmount,
        statusText: statusText({ actorName, move, hit, damage, blocked, healAmount, guardAmount }),
        createdAt: new Date().toISOString(),
      });

      if (challengerHp <= 0 || opponentHp <= 0) {
        winnerUserId = challengerHp <= 0 ? opponentUserId : me.id;
        break;
      }

      turnUserId = actorIsChallenger ? opponentUserId : me.id;
    }

    if (!winnerUserId) {
      if (challengerHp === opponentHp) winnerUserId = Math.random() < 0.5 ? me.id : opponentUserId;
      else winnerUserId = challengerHp > opponentHp ? me.id : opponentUserId;
      const winnerName =
        userById.get(String(winnerUserId))?.display_name ||
        userById.get(String(winnerUserId))?.steamid64 ||
        "Spieler";
      battleLog.push({
        turn: battleLog.length,
        actorUserId: null,
        move: "decision",
        statusText: `Zeitlimit erreicht. ${winnerName} gewinnt nach Rest-HP.`,
        createdAt: new Date().toISOString(),
      });
    }

    const { data: battle, error } = await supabaseAdmin
      .from("avatar_battles")
      .insert({
        group_id: groupId,
        appid: group.active_appid || null,
        challenger_user_id: me.id,
        opponent_user_id: opponentUserId,
        challenger_level: myLevel,
        opponent_level: opponentLevel,
        challenger_hp: challengerHp,
        opponent_hp: opponentHp,
        challenger_block: challengerBlock,
        opponent_block: opponentBlock,
        turn_user_id: turnUserId,
        status: "finished",
        winner_user_id: winnerUserId,
        battle_log: battleLog,
        updated_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) return res.status(500).json({ error: String(error.message || error) });
    const loserUserId = String(winnerUserId) === String(me.id) ? opponentUserId : me.id;
    const { data: winnerAvatar } = await supabaseAdmin
      .from("user_avatars")
      .select("user_id,battles_won")
      .eq("user_id", winnerUserId)
      .single();
    if (winnerAvatar) {
      await supabaseAdmin
        .from("user_avatars")
        .update({
          battles_won: Number(winnerAvatar.battles_won || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", winnerUserId);
    }
    const { data: loserAvatar } = await supabaseAdmin
      .from("user_avatars")
      .select("user_id,battles_lost")
      .eq("user_id", loserUserId)
      .single();
    if (loserAvatar) {
      await supabaseAdmin
        .from("user_avatars")
        .update({
          battles_lost: Number(loserAvatar.battles_lost || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", loserUserId);
    }

    return res.status(200).json({ battleId: battle.id, autoSimulated: true });
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
