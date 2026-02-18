import crypto from "crypto";

export function buildGroupActivityEventId({ groupId, appid, steamid64, achievementApiName, unlocktime }) {
  const base = [
    String(groupId || ""),
    String(appid || ""),
    String(steamid64 || ""),
    String(achievementApiName || ""),
    String(unlocktime || ""),
  ].join(":");

  return crypto.createHash("sha256").update(base).digest("hex").slice(0, 32);
}
