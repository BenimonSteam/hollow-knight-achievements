import { requireUser } from "../../../../lib/auth";

export default async function handler(req, res) {
  const me = await requireUser(req, res);
  if (!me) return;

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  return res.status(410).json({
    error: "Battles are auto-simulated now. No manual moves required.",
  });
}
