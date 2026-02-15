import { requireUser } from "../../../lib/auth";

export default async function handler(req, res) {
  const user = await requireUser(req, res);
  if (!user) return;
  res.status(200).json({ user });
}
