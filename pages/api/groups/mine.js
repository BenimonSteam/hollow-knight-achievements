import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { requireUser } from "../../../lib/auth";

export default async function handler(req, res) {
  const user = await requireUser(req, res);
  if (!user) return;

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { data: memberships, error } = await supabaseAdmin
    .from("group_members")
    .select("role, joined_at, groups:groups(id,name,invite_code,owner_user_id,active_appid,created_at)")
    .eq("user_id", user.id)
    .order("joined_at", { ascending: false });

  if (error) {
    return res.status(500).json({ error: String(error.message || error) });
  }

  res.status(200).json({ memberships: memberships || [] });
}
