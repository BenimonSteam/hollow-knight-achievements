import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { requireUser } from "../../../lib/auth";

export default async function handler(req, res) {
  const user = await requireUser(req, res);
  if (!user) return;

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { inviteCode } = req.body || {};
  if (!inviteCode) return res.status(400).json({ error: "Missing inviteCode" });

  const { data: group, error } = await supabaseAdmin
    .from("groups")
    .select("id,invite_code,name")
    .eq("invite_code", inviteCode)
    .single();

  if (error || !group) return res.status(404).json({ error: "Group not found" });

  const { data: existingMembership, error: membershipErr } = await supabaseAdmin
    .from("group_members")
    .select("role")
    .eq("group_id", group.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membershipErr) {
    return res.status(500).json({ error: String(membershipErr.message || membershipErr) });
  }

  if (!existingMembership) {
    const { error: insertErr } = await supabaseAdmin.from("group_members").insert({
      group_id: group.id,
      user_id: user.id,
      role: "member",
    });

    if (insertErr) return res.status(500).json({ error: String(insertErr.message || insertErr) });
  }

  res.status(200).json({ groupId: group.id });
}
