import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { requireUser } from "../../../../lib/auth";

async function fetchOwnedAppIds(steamid64, key) {
  const url =
    `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/` +
    `?key=${encodeURIComponent(key)}` +
    `&steamid=${encodeURIComponent(steamid64)}` +
    `&include_appinfo=0&include_played_free_games=1`;

  const r = await fetch(url);
  const j = await r.json();
  const games = j?.response?.games || [];
  return new Set(games.map((g) => Number(g.appid)).filter((v) => Number.isFinite(v)));
}

export default async function handler(req, res) {
  const user = await requireUser(req, res);
  if (!user) return;

  if (req.method !== "POST" && req.method !== "DELETE") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const groupId = req.query.id;
  const { appid } = req.body || {};
  const n = Number(appid);
  if (!Number.isFinite(n)) return res.status(400).json({ error: "Invalid appid" });
  const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";

  const { data: group } = await supabaseAdmin
    .from("groups")
    .select("owner_user_id")
    .eq("id", groupId)
    .single();

  if (!group) return res.status(404).json({ error: "Group not found" });
  if (group.owner_user_id !== user.id) return res.status(403).json({ error: "Only owner can set game" });

  if (req.method === "DELETE") {
    const { error: deleteError } = await supabaseAdmin
      .from("group_leaderboards")
      .delete()
      .eq("group_id", groupId)
      .eq("appid", n);

    if (deleteError) {
      return res.status(500).json({ error: String(deleteError.message || deleteError) });
    }

    const { data: currentGroup } = await supabaseAdmin
      .from("groups")
      .select("active_appid")
      .eq("id", groupId)
      .single();

    if (currentGroup?.active_appid === n) {
      await supabaseAdmin.from("groups").update({ active_appid: null }).eq("id", groupId);
    }

    return res.status(200).json({ ok: true, deletedAppid: n });
  }

  const { data: ownerUser, error: ownerUserError } = await supabaseAdmin
    .from("users")
    .select("steamid64")
    .eq("id", group.owner_user_id)
    .single();

  if (ownerUserError || !ownerUser?.steamid64) {
    return res.status(500).json({ error: "Could not load owner Steam account" });
  }

  const key = process.env.STEAM_API_KEY;
  if (!key) return res.status(500).json({ error: "Missing STEAM_API_KEY" });

  const ownedAppIds = await fetchOwnedAppIds(ownerUser.steamid64, key);
  if (!ownedAppIds.has(n)) {
    return res.status(400).json({ error: "Selected game is not owned by the group owner" });
  }

  const { data: leaderboard, error: leaderboardError } = await supabaseAdmin
    .from("group_leaderboards")
    .upsert(
      {
        group_id: groupId,
        appid: n,
        title: title || null,
        created_by_user_id: user.id,
      },
      { onConflict: "group_id,appid" }
    )
    .select("id, group_id, appid, title, created_by_user_id, created_at")
    .single();

  if (leaderboardError) {
    return res.status(500).json({ error: String(leaderboardError.message || leaderboardError) });
  }

  await supabaseAdmin.from("groups").update({ active_appid: n }).eq("id", groupId);
  res.status(200).json({ ok: true, leaderboard });
}
