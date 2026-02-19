export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const rawUrl = String(req.query?.url || "").trim();
  if (!rawUrl) {
    return res.status(400).json({ error: "Missing url" });
  }

  let target;
  try {
    target = new URL(rawUrl);
  } catch {
    return res.status(400).json({ error: "Invalid url" });
  }

  if (!(target.protocol === "http:" || target.protocol === "https:")) {
    return res.status(400).json({ error: "Unsupported protocol" });
  }

  try {
    const upstream = await fetch(target.toString(), {
      headers: {
        "User-Agent": "TrophyTracker-AvatarProxy/1.0",
      },
    });

    if (!upstream.ok) {
      return res.status(502).json({ error: "Upstream image fetch failed" });
    }

    const contentType = upstream.headers.get("content-type") || "";
    if (!contentType.startsWith("image/")) {
      return res.status(415).json({ error: "Upstream is not an image" });
    }

    const arrayBuffer = await upstream.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");
    return res.status(200).send(buffer);
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
