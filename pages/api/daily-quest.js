import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { requireUser } from "../../lib/auth";

const MAX_SAMPLED_GAMES = 12;
const MAX_TOTAL_GAME_CHECKS = 24;
const QUEST_OPTION_COUNT = 3;

function todayUtcDateKey() {
  return new Date().toISOString().slice(0, 10);
}

function addUtcDays(dateKey, deltaDays) {
  const dt = new Date(`${dateKey}T00:00:00.000Z`);
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  return dt.toISOString().slice(0, 10);
}

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function questKey(appid, apiName) {
  return `${appid}:${apiName}`;
}

async function fetchJson(url) {
  const r = await fetch(url);
  const j = await r.json();
  return { ok: r.ok, status: r.status, j };
}

async function getOwnedGames(steamid64, key) {
  const url =
    `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/` +
    `?key=${encodeURIComponent(key)}` +
    `&steamid=${encodeURIComponent(steamid64)}` +
    `&include_appinfo=1&include_played_free_games=1`;

  const data = await fetchJson(url);
  const games = data.j?.response?.games || [];
  return games
    .map((g) => ({
      appid: Number(g?.appid),
      name: g?.name || `App ${g?.appid}`,
    }))
    .filter((g) => Number.isFinite(g.appid));
}

async function getPlayerAchievements(steamid64, appid, key) {
  const url =
    `https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v1/` +
    `?key=${encodeURIComponent(key)}&steamid=${encodeURIComponent(steamid64)}&appid=${encodeURIComponent(appid)}`;
  const data = await fetchJson(url);
  return data.j?.playerstats?.achievements || [];
}

async function getSchemaAchievementMeta(appid, apiName, key) {
  const url =
    `https://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2/` +
    `?key=${encodeURIComponent(key)}&appid=${encodeURIComponent(appid)}&l=german`;
  const data = await fetchJson(url);
  const rows = data.j?.game?.availableGameStats?.achievements || [];
  const match = rows.find((row) => String(row?.name) === String(apiName));
  if (!match) {
    return {
      displayName: apiName,
      description: "",
      icon: "",
    };
  }
  return {
    displayName: match.displayName || apiName,
    description: match.description || "",
    icon: match.icon || match.icongray || "",
  };
}

async function computeQuestDone(steamid64, appid, apiName, key) {
  if (!steamid64 || !Number.isFinite(Number(appid)) || !apiName) return false;
  const rows = await getPlayerAchievements(steamid64, appid, key);
  const row = rows.find((a) => String(a?.apiname) === String(apiName));
  return Number(row?.achieved) === 1;
}

async function chooseRandomQuestCandidate({ steamid64, key, blockedQuestKeys }) {
  const allGames = await getOwnedGames(steamid64, key);
  if (allGames.length === 0) return null;

  const shuffledGames = shuffleInPlace([...allGames]);
  const sampledGames = shuffledGames.slice(0, Math.min(MAX_SAMPLED_GAMES, shuffledGames.length));

  let checkedGames = 0;
  for (const game of sampledGames) {
    if (checkedGames >= MAX_TOTAL_GAME_CHECKS) break;
    checkedGames += 1;

    const achievements = await getPlayerAchievements(steamid64, game.appid, key);
    if (!Array.isArray(achievements) || achievements.length === 0) continue;

    const unresolvedApiNames = achievements
      .filter((a) => Number(a?.achieved) !== 1)
      .map((a) => String(a?.apiname || ""))
      .filter(Boolean);

    if (unresolvedApiNames.length === 0) continue;

    const allowedApiNames = shuffleInPlace([...new Set(unresolvedApiNames)]).filter(
      (apiName) => !blockedQuestKeys.has(questKey(game.appid, apiName))
    );
    if (allowedApiNames.length === 0) continue;

    const pickedApiName = allowedApiNames[0];
    const meta = await getSchemaAchievementMeta(game.appid, pickedApiName, key);
    return {
      appid: game.appid,
      gameTitle: game.name || `App ${game.appid}`,
      achievementApiName: pickedApiName,
      achievementDisplayName: meta.displayName || pickedApiName,
      achievementDescription: meta.description || "",
      achievementIcon: meta.icon || "",
      questKey: questKey(game.appid, pickedApiName),
    };
  }

  return null;
}

async function chooseQuestOptions({ steamid64, key, blockedQuestKeys, count = QUEST_OPTION_COUNT }) {
  const options = [];
  const localBlocked = new Set(blockedQuestKeys);

  while (options.length < count) {
    const candidate = await chooseRandomQuestCandidate({ steamid64, key, blockedQuestKeys: localBlocked });
    if (!candidate) break;
    options.push(candidate);
    localBlocked.add(candidate.questKey);
  }

  return options;
}

function normalizeCandidateOptions(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => ({
      appid: Number(entry?.appid),
      gameTitle: String(entry?.gameTitle || ""),
      achievementApiName: String(entry?.achievementApiName || ""),
      achievementDisplayName: String(entry?.achievementDisplayName || ""),
      achievementDescription: String(entry?.achievementDescription || ""),
      achievementIcon: String(entry?.achievementIcon || ""),
      questKey: String(entry?.questKey || ""),
    }))
    .filter(
      (entry) =>
        Number.isFinite(entry.appid) &&
        entry.achievementApiName &&
        entry.achievementDisplayName &&
        entry.questKey
    );
}

function toQuestDto(row, done) {
  if (!row) return null;
  const options = normalizeCandidateOptions(row.candidate_options);
  const selected = !!row.is_selected;
  return {
    id: row.id,
    questDate: row.quest_date,
    selected,
    options,
    appid: row.appid,
    gameTitle: row.game_title,
    achievementApiName: row.achievement_api_name,
    achievementDisplayName: row.achievement_display_name,
    achievementDescription: row.achievement_description || "",
    achievementIcon: row.achievement_icon || "",
    questKey: row.quest_key,
    rerollCount: row.reroll_count || 0,
    selectedAt: row.selected_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    done: selected ? !!done : false,
  };
}

export default async function handler(req, res) {
  const user = await requireUser(req, res);
  if (!user) return;

  const key = process.env.STEAM_API_KEY;
  if (!key) return res.status(500).json({ error: "Missing STEAM_API_KEY" });
  if (!user?.steamid64) return res.status(400).json({ error: "User has no steamid64" });

  const dateKey = todayUtcDateKey();
  const yesterdayKey = addUtcDays(dateKey, -1);

  const { data: todayRow, error: todayError } = await supabaseAdmin
    .from("daily_quests")
    .select("*")
    .eq("user_id", user.id)
    .eq("quest_date", dateKey)
    .maybeSingle();
  if (todayError) return res.status(500).json({ error: String(todayError.message || todayError) });

  if (req.method === "GET") {
    if (!todayRow) return res.status(200).json({ quest: null });
    const done = todayRow?.is_selected
      ? await computeQuestDone(user.steamid64, todayRow.appid, todayRow.achievement_api_name, key)
      : false;
    return res.status(200).json({ quest: toQuestDto(todayRow, done) });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const action = String(req.body?.action || "ensure");
  const wantsReroll = action === "reroll";
  const wantsSelect = action === "select";
  const selectedQuestKey = typeof req.body?.selectedQuestKey === "string" ? req.body.selectedQuestKey.trim() : "";

  const { data: yesterdayRow } = await supabaseAdmin
    .from("daily_quests")
    .select("quest_key")
    .eq("user_id", user.id)
    .eq("quest_date", yesterdayKey)
    .maybeSingle();

  const blockedQuestKeys = new Set();
  if (yesterdayRow?.quest_key) blockedQuestKeys.add(String(yesterdayRow.quest_key));

  if (todayRow && !wantsReroll) {
    if (!wantsSelect && !todayRow.is_selected) {
      const existingOptions = normalizeCandidateOptions(todayRow.candidate_options);
      if (existingOptions.length < QUEST_OPTION_COUNT) {
        const history = Array.isArray(todayRow.picks_history) ? todayRow.picks_history.map(String).filter(Boolean) : [];
        for (const keyInHistory of history) blockedQuestKeys.add(keyInHistory);

        const generatedOptions = await chooseQuestOptions({
          steamid64: user.steamid64,
          key,
          blockedQuestKeys,
        });
        if (generatedOptions.length < QUEST_OPTION_COUNT) {
          return res.status(400).json({ error: "Keine Daily-Quest-Auswahl gefunden. Versuche es spaeter erneut." });
        }

        const primary = generatedOptions[0];
        const nextHistory = Array.from(new Set([...history, ...generatedOptions.map((opt) => opt.questKey)]));
        const { data: hydratedRow, error: hydrateError } = await supabaseAdmin
          .from("daily_quests")
          .update({
            appid: primary.appid,
            game_title: primary.gameTitle,
            achievement_api_name: primary.achievementApiName,
            achievement_display_name: primary.achievementDisplayName,
            achievement_description: primary.achievementDescription,
            achievement_icon: primary.achievementIcon,
            quest_key: primary.questKey,
            candidate_options: generatedOptions,
            picks_history: nextHistory,
            is_selected: false,
            selected_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", todayRow.id)
          .select("*")
          .single();
        if (hydrateError) return res.status(500).json({ error: String(hydrateError.message || hydrateError) });
        return res.status(200).json({ quest: toQuestDto(hydratedRow, false) });
      }
    }

    if (wantsSelect) {
      if (todayRow.is_selected) {
        const done = await computeQuestDone(user.steamid64, todayRow.appid, todayRow.achievement_api_name, key);
        return res.status(200).json({ quest: toQuestDto(todayRow, done) });
      }

      const options = normalizeCandidateOptions(todayRow.candidate_options);
      const picked = options.find((opt) => String(opt.questKey) === String(selectedQuestKey));
      if (!picked) {
        return res.status(400).json({ error: "Ungueltige Auswahl." });
      }

      const history = Array.isArray(todayRow.picks_history) ? todayRow.picks_history.map(String).filter(Boolean) : [];
      const nextHistory = Array.from(new Set([...history, picked.questKey]));

      const { data: selectedRow, error: selectError } = await supabaseAdmin
        .from("daily_quests")
        .update({
          appid: picked.appid,
          game_title: picked.gameTitle,
          achievement_api_name: picked.achievementApiName,
          achievement_display_name: picked.achievementDisplayName,
          achievement_description: picked.achievementDescription,
          achievement_icon: picked.achievementIcon,
          quest_key: picked.questKey,
          picks_history: nextHistory,
          is_selected: true,
          selected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", todayRow.id)
        .select("*")
        .single();
      if (selectError) return res.status(500).json({ error: String(selectError.message || selectError) });

      const done = await computeQuestDone(user.steamid64, selectedRow.appid, selectedRow.achievement_api_name, key);
      return res.status(200).json({ quest: toQuestDto(selectedRow, done) });
    }

    const done = todayRow?.is_selected
      ? await computeQuestDone(user.steamid64, todayRow.appid, todayRow.achievement_api_name, key)
      : false;
    return res.status(200).json({ quest: toQuestDto(todayRow, done) });
  }

  if (todayRow && wantsReroll) {
    if (todayRow.is_selected) {
      return res.status(400).json({ error: "Reroll ist nach der Auswahl nicht mehr moeglich." });
    }

    const history = Array.isArray(todayRow.picks_history) ? todayRow.picks_history.map(String).filter(Boolean) : [];
    for (const keyInHistory of history) blockedQuestKeys.add(keyInHistory);

    const options = await chooseQuestOptions({
      steamid64: user.steamid64,
      key,
      blockedQuestKeys,
    });
    if (options.length < QUEST_OPTION_COUNT) {
      return res.status(400).json({ error: "Kein neues Daily-Quest-Ziel gefunden (Reroll)." });
    }

    const nextHistory = Array.from(
      new Set([...history, ...options.map((opt) => opt.questKey), String(todayRow.quest_key || "")].filter(Boolean))
    );
    const primary = options[0];
    const { data: updated, error: updateError } = await supabaseAdmin
      .from("daily_quests")
      .update({
        appid: primary.appid,
        game_title: primary.gameTitle,
        achievement_api_name: primary.achievementApiName,
        achievement_display_name: primary.achievementDisplayName,
        achievement_description: primary.achievementDescription,
        achievement_icon: primary.achievementIcon,
        quest_key: primary.questKey,
        candidate_options: options,
        picks_history: nextHistory,
        reroll_count: Number(todayRow.reroll_count || 0) + 1,
        is_selected: false,
        selected_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", todayRow.id)
      .select("*")
      .single();
    if (updateError) return res.status(500).json({ error: String(updateError.message || updateError) });

    return res.status(200).json({ quest: toQuestDto(updated, false) });
  }

  const options = await chooseQuestOptions({
    steamid64: user.steamid64,
    key,
    blockedQuestKeys,
  });
  if (options.length < QUEST_OPTION_COUNT) {
    return res.status(400).json({ error: "Keine Daily Quest gefunden. Versuche es spaeter erneut." });
  }
  const primary = options[0];

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("daily_quests")
    .insert({
      user_id: user.id,
      quest_date: dateKey,
      appid: primary.appid,
      game_title: primary.gameTitle,
      achievement_api_name: primary.achievementApiName,
      achievement_display_name: primary.achievementDisplayName,
      achievement_description: primary.achievementDescription,
      achievement_icon: primary.achievementIcon,
      quest_key: primary.questKey,
      candidate_options: options,
      picks_history: options.map((opt) => opt.questKey),
      reroll_count: 0,
      is_selected: false,
      selected_at: null,
    })
    .select("*")
    .single();

  if (insertError) {
    return res.status(500).json({ error: String(insertError.message || insertError) });
  }

  return res.status(200).json({ quest: toQuestDto(inserted, false) });
}
