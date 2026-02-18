export default function handler(req, res) {
  const baseUrl = process.env.APP_BASE_URL;
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
