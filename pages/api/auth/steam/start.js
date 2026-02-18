export default function handler(req, res) {
  const forwardedProto = req.headers["x-forwarded-proto"];
  const proto =
    (Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto) ||
    (req.socket?.encrypted ? "https" : "http");
  const host = req.headers["x-forwarded-host"] || req.headers.host;

  const runtimeBaseUrl = host ? `${proto}://${host}` : null;
  const configuredBaseUrl = process.env.APP_BASE_URL;
  const baseUrl = configuredBaseUrl || runtimeBaseUrl;

  if (!baseUrl) {
    return res.status(500).json({ error: "Missing APP_BASE_URL and request host" });
  }

  const returnTo = `${baseUrl}/api/auth/steam/callback`;
  const realm = baseUrl;

  const params = new URLSearchParams({
    "openid.ns": "http://specs.openid.net/auth/2.0",
    "openid.mode": "checkid_setup",
    "openid.return_to": returnTo,
    "openid.realm": realm,
    "openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
    "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select",
  });

  res.redirect(`https://steamcommunity.com/openid/login?${params.toString()}`);
}
