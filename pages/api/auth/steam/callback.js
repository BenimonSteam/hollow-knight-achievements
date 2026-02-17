import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { createSessionForUser } from "../../../../lib/auth";

function extractSteamId(claimedId) {
  // claimed_id looks like: https://steamcommunity.com/openid/id/7656119...
  const m = String(claimedId || "").match(/\/openid\/id\/(\d+)$/);
  return m ? m[1] : null;
}

async function verifyOpenId(query) {
  // Send back to Steam for validation
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) params.set(k, String(v));
  params.set("openid.mode", "check_authentication");

  const r = await fetch("https://steamcommunity.com/openid/login", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  const text = await r.text();
  return text.includes("is_valid:true");
}

export default async function handler(req, res) {
  try {
    const ok = await verifyOpenId(req.query);
    if (!ok) return res.status(400).send("Steam OpenID verification failed");

    const steamid64 = extractSteamId(req.query["openid.claimed_id"]);
    if (!steamid64) return res.status(400).send("Missing steamid");

    // Upsert user
   // 1. Steam Profil laden
const profileRes = await fetch(
  `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${process.env.STEAM_API_KEY}&steamids=${steamid64}`
);
const profileJson = await profileRes.json();
const profile = profileJson?.response?.players?.[0];

const displayName = profile?.personaname || null;
const avatarUrl = profile?.avatarfull || null;

// 2. User upsert in Supabase
const { data: user, error } = await supabaseAdmin
  .from("users")
  .upsert(
    {
      steamid64,
      display_name: displayName,
      avatar_url: avatarUrl,
    },
    { onConflict: "steamid64" }
  )
  .select("id")
  .single();

if (error) throw error;

const userId = user.id;


    await createSessionForUser(res, userId);

    // Redirect to home (or group page)
    res.redirect("/");
  } catch (e) {
    res.status(500).send(String(e));
  }
}
