import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { requireUser } from "../../../../lib/auth";

export default async function handler(req, res) {
  const user = await requireUser(req, res);
  if (!user) return;

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const groupId = req.query.id;
  const { appid } = req.body || {};
  const n = Number(appid);
  if (!Number.isFinite(n)) return res.status(400).json({ error: "Invalid appid" });

  const { data: group } = await supabaseAdmin
    .from("groups")
    .select("owner_user_id")
    .eq("id", groupId)
    .single();

  if (!group) return res.status(404).json({ error: "Group not found" });
  if (group.owner_user_id !== user.id) return res.status(403).json({ error: "Only owner can set game" });

  await supabaseAdmin.from("groups").update({ active_appid: n }).eq("id", groupId);
  res.status(200).json({ ok: true });
}
