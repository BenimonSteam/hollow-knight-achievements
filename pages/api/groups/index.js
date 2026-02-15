import crypto from "crypto";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { requireUser } from "../../../lib/auth";

function inviteCode() {
  return crypto.randomBytes(8).toString("hex"); // 16 chars
}

export default async function handler(req, res) {
  const user = await requireUser(req, res);
  if (!user) return;

  if (req.method === "POST") {
    const { name } = req.body || {};
    if (!name) return res.status(400).json({ error: "Missing name" });

    const code = inviteCode();
    const { data: group, error } = await supabaseAdmin
      .from("groups")
      .insert({ name, owner_user_id: user.id, invite_code: code })
      .select("*")
      .single();
    if (error) return res.status(500).json({ error: String(error.message || error) });

    await supabaseAdmin.from("group_members").insert({
      group_id: group.id,
      user_id: user.id,
      role: "owner",
    });

    res.status(200).json({ group });
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}
