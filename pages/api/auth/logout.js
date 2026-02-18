import { clearCookie, getCookie } from "../../../lib/auth";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = getCookie(req, "sid");

  if (token) {
    await supabaseAdmin.from("sessions").delete().eq("token", token);
  }

  clearCookie(res, "sid");
  return res.status(200).json({ ok: true });
}
