import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { requireUser } from "../../../lib/auth";

export default async function handler(req, res) {
  const user = await requireUser(req, res);
  if (!user) return;

  const groupId = req.query.id;

  // check membership
  const { data: mem } = await supabaseAdmin
    .from("group_members")
    .select("role")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .single();
  if (!mem) return res.status(403).json({ error: "Not a member" });

  const { data: group } = await supabaseAdmin
    .from("groups")
    .select("id,name,owner_user_id,invite_code,active_appid,created_at")
    .eq("id", groupId)
    .single();

  const { data: members } = await supabaseAdmin
    .from("group_members")
    .select("role, joined_at, users:users(id,steamid64,display_name,avatar_url)")
    .eq("group_id", groupId);

  const { data: leaderboards } = await supabaseAdmin
    .from("group_leaderboards")
    .select("id, group_id, appid, title, created_by_user_id, created_at")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false });

  res.status(200).json({ group, members, leaderboards: leaderboards || [] });
}
