import crypto from "crypto";
import { supabaseAdmin } from "./supabaseAdmin";

const COOKIE_NAME = "sid";

export function getCookie(req, name) {
  const raw = req.headers.cookie || "";
  const parts = raw.split(";").map(s => s.trim());
  for (const p of parts) {
    const [k, ...v] = p.split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

export function setCookie(res, name, value, opts = {}) {
  const { maxAgeSeconds = 60 * 60 * 24 * 7 } = opts;
  const pieces = [
    `${name}=${encodeURIComponent(value)}`,
    `Path=/`,
    `HttpOnly`,
    `SameSite=Lax`,
    `Max-Age=${maxAgeSeconds}`,
  ];
  // Secure nur auf https (Vercel)
  if (process.env.APP_BASE_URL?.startsWith("https://")) pieces.push("Secure");
  res.setHeader("Set-Cookie", pieces.join("; "));
}

export function clearCookie(res, name) {
  res.setHeader("Set-Cookie", `${name}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`);
}

export function randomToken() {
  return crypto.randomBytes(32).toString("hex");
}

export async function requireUser(req, res) {
  const token = getCookie(req, COOKIE_NAME);
  if (!token) {
    res.status(401).json({ error: "Not logged in" });
    return null;
  }

  const now = new Date().toISOString();
  const { data: session, error } = await supabaseAdmin
    .from("sessions")
    .select("token,user_id,expires_at, users:users(id,steamid64,display_name,avatar_url)")
    .eq("token", token)
    .single();

  if (error || !session || session.expires_at <= now) {
    clearCookie(res, COOKIE_NAME);
    res.status(401).json({ error: "Session expired" });
    return null;
  }

  return session.users;
}

export async function createSessionForUser(res, userId) {
  const token = randomToken();
  const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 Tage
  await supabaseAdmin.from("sessions").insert({
    token,
    user_id: userId,
    expires_at: expires.toISOString(),
  });

  setCookie(res, COOKIE_NAME, token, { maxAgeSeconds: 60 * 60 * 24 * 7 });
}
