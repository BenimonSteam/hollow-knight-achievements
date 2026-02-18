import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { requireUser } from "../../../lib/auth";

export default async function handler(req, res) {
  const currentUser = await requireUser(req, res);
  if (!currentUser) return;

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const userId = Number(req.query.id);
  if (!Number.isFinite(userId)) {
    return res.status(400).json({ error: "Invalid user id" });
  }

  const { data: user, error: userError } = await supabaseAdmin
    .from("users")
    .select("id,steamid64,display_name,avatar_url")
    .eq("id", userId)
    .single();

  if (userError || !user) {
    return res.status(404).json({ error: "User not found" });
  }

  const { data: memberships, error: membershipsError } = await supabaseAdmin
    .from("group_members")
    .select("role, joined_at, groups:groups(id,name,active_appid,created_at)")
    .eq("user_id", userId)
    .order("joined_at", { ascending: false });

  if (membershipsError) {
    return res.status(500).json({ error: String(membershipsError.message || membershipsError) });
  }

  const groupIds = (memberships || [])
    .map((membership) => membership?.groups?.id)
    .filter(Boolean);

  let leaderboards = [];
  if (groupIds.length > 0) {
    const { data: leaderboardRows, error: leaderboardError } = await supabaseAdmin
      .from("group_leaderboards")
      .select("id,group_id,appid,title,mode,created_at,groups:groups(id,name)")
      .in("group_id", groupIds)
      .order("created_at", { ascending: false });

    if (leaderboardError) {
      return res.status(500).json({ error: String(leaderboardError.message || leaderboardError) });
    }

    leaderboards = leaderboardRows || [];
  }

  res.status(200).json({
    user,
    memberships: memberships || [],
    leaderboards,
  });
}
