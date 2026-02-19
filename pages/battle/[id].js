import { useRouter } from "next/router";
import { useEffect, useMemo, useRef, useState } from "react";

const wrap = {
  maxWidth: 1120,
  margin: "0 auto",
  padding: "28px 20px 40px",
  color: "#e8f2ff",
  fontFamily: "system-ui",
};

const card = {
  border: "1px solid rgba(255, 255, 255, 0.14)",
  borderRadius: 14,
  background: "rgba(8, 18, 33, 0.72)",
  padding: 14,
};

const secondaryButton = {
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid rgba(0, 234, 255, 0.38)",
  background: "rgba(0, 234, 255, 0.08)",
  color: "#9defff",
  fontWeight: 700,
};

const moveButton = {
  ...secondaryButton,
  width: "100%",
  textAlign: "center",
  padding: "10px 12px",
  opacity: 0.7,
};

const progressTrack = {
  height: 10,
  borderRadius: 999,
  background: "rgba(255, 255, 255, 0.14)",
  overflow: "hidden",
};

function hpPercent(current, max) {
  if (!max) return 0;
  return Math.max(0, Math.min(100, Math.round((current / max) * 100)));
}

function frameByLevel(level) {
  const l = Number(level || 1);
  if (l >= 30) return "/avatar-assets/frames/frame-mythic.svg";
  if (l >= 20) return "/avatar-assets/frames/frame-plasma.svg";
  if (l >= 12) return "/avatar-assets/frames/frame-gold.svg";
  if (l >= 6) return "/avatar-assets/frames/frame-silver.svg";
  return "/avatar-assets/frames/frame-bronze.svg";
}

function localBattleAvatarForUser(user) {
  const key = String(user?.steamid64 || user?.id || user?.display_name || "0");
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  const pick = (hash % 4) + 1;
  return `/avatar-assets/fighters/fighter-${pick}.svg`;
}

function AvatarToken({ user, avatar }) {
  const level = avatar?.level || 1;
  const frameSrc = frameByLevel(level);
  return (
    <div style={{ width: 132, height: 132, position: "relative", margin: "0 auto 8px" }}>
      <img
        src={user?.avatar_url || "/trophytracker-logo.png"}
        alt={user?.display_name || "Avatar"}
        style={{
          position: "absolute",
          inset: 16,
          width: 100,
          height: 100,
          borderRadius: "50%",
          objectFit: "cover",
          border: "1px solid rgba(255, 255, 255, 0.2)",
          background: "rgba(0, 0, 0, 0.22)",
        }}
      />
      <img src={frameSrc} alt="" aria-hidden="true" style={{ width: 132, height: 132, display: "block" }} />
    </div>
  );
}

export default function BattlePage() {
  const router = useRouter();
  const battleId = router.query.id;
  const arenaRef = useRef(null);
  const pixiRef = useRef(null);

  const [battleState, setBattleState] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [replayStep, setReplayStep] = useState(0);
  const [replayRunning, setReplayRunning] = useState(true);
  const [restartBusy, setRestartBusy] = useState(false);

  async function loadBattle() {
    if (!battleId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/battles/${battleId}`);
      const j = await r.json();
      if (!r.ok) {
        setErr(j.error || "Battle konnte nicht geladen werden");
        return;
      }
      setBattleState(j);
      setErr("");
    } catch (e) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function restartWithNewRandomBattle() {
    if (!battleState?.battle || !mySide?.enemy?.user?.id || restartBusy) return;
    setRestartBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/battles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId: battleState.battle.group_id,
          opponentUserId: mySide.enemy.user.id,
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        setErr(j.error || "Neustart fehlgeschlagen");
        return;
      }
      window.location.href = `/battle/${j.battleId}`;
    } catch (e) {
      setErr(String(e));
    } finally {
      setRestartBusy(false);
    }
  }

  useEffect(() => {
    if (!battleId) return;
    (async () => {
      await loadBattle();
    })();
  }, [battleId]);

  const battle = battleState?.battle;
  const youId = String(battleState?.you || "");

  const mySide = useMemo(() => {
    if (!battleState?.challenger || !battleState?.opponent || !youId) return null;
    if (String(battleState.challenger?.user?.id || "") === youId) {
      return { me: battleState.challenger, enemy: battleState.opponent };
    }
    return { me: battleState.opponent, enemy: battleState.challenger };
  }, [battleState, youId]);

  const logAsc = Array.isArray(battle?.battle_log) ? battle.battle_log : [];
  const totalReplayTurns = Math.max(0, logAsc.length - 1);

  useEffect(() => {
    setReplayStep(0);
    setReplayRunning(true);
  }, [battle?.id]);

  useEffect(() => {
    if (!battle || totalReplayTurns <= 0) return;
    if (!replayRunning) return;
    if (replayStep >= totalReplayTurns) return;
    const t = setTimeout(() => {
      setReplayStep((prev) => Math.min(totalReplayTurns, prev + 1));
    }, 700);
    return () => clearTimeout(t);
  }, [battle, replayRunning, replayStep, totalReplayTurns]);

  function replaySnapshot() {
    const challengerId = String(battleState?.challenger?.user?.id || "");
    const opponentId = String(battleState?.opponent?.user?.id || "");
    let challengerHp = Number(battleState?.challenger?.stats?.maxHp || 0);
    let opponentHp = Number(battleState?.opponent?.stats?.maxHp || 0);
    let challengerBlock = 0;
    let opponentBlock = 0;

    for (let i = 1; i <= replayStep; i += 1) {
      const e = logAsc[i];
      if (!e) break;
      const actorId = String(e.actorUserId || "");
      if (!actorId) continue;
      const actorIsChallenger = actorId === challengerId;

      let selfHp = actorIsChallenger ? challengerHp : opponentHp;
      let enemyHp = actorIsChallenger ? opponentHp : challengerHp;
      let selfBlock = actorIsChallenger ? challengerBlock : opponentBlock;
      let enemyBlock = actorIsChallenger ? opponentBlock : challengerBlock;

      if (e.move === "heal") {
        selfHp += Number(e.healAmount || 0);
      } else if (e.move === "guard") {
        selfBlock += Number(e.guardAmount || 0);
      } else {
        enemyBlock = Math.max(0, enemyBlock - Number(e.blocked || 0));
        enemyHp = Math.max(0, enemyHp - Number(e.damage || 0));
      }

      selfBlock = Math.max(0, selfBlock - 1);
      enemyBlock = Math.max(0, enemyBlock - 1);

      if (actorIsChallenger) {
        challengerHp = selfHp;
        opponentHp = enemyHp;
        challengerBlock = selfBlock;
        opponentBlock = enemyBlock;
      } else {
        opponentHp = selfHp;
        challengerHp = enemyHp;
        opponentBlock = selfBlock;
        challengerBlock = enemyBlock;
      }
    }

    return {
      challengerHp,
      opponentHp,
      challengerBlock,
      opponentBlock,
    };
  }

  const snap = replaySnapshot();
  const logItems = [...logAsc.slice(0, replayStep + 1)].reverse();

  useEffect(() => {
    if (!arenaRef.current || !battleState?.challenger || !battleState?.opponent) return;
    let disposed = false;

    async function initPixiArena() {
      const PIXI = await import("pixi.js");
      if (disposed || !arenaRef.current) return;

      const app = new PIXI.Application();
      await app.init({
        width: 960,
        height: 340,
        antialias: true,
        backgroundAlpha: 0,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
      });
      if (disposed || !arenaRef.current) {
        app.destroy(true, { children: true });
        return;
      }

      arenaRef.current.innerHTML = "";
      arenaRef.current.appendChild(app.canvas);

      const stage = app.stage;
      const bg = PIXI.Sprite.from("/avatar-assets/backgrounds/battle-arena.svg");
      bg.width = 960;
      bg.height = 340;
      stage.addChild(bg);

      const leftX = 240;
      const rightX = 720;
      const centerY = 184;
      async function createFighter({ x, y, avatarUrl, frameUrl }) {
        const container = new PIXI.Container();
        container.x = x;
        container.y = y;

        let avatarTexture;
        try {
          avatarTexture = await PIXI.Assets.load(avatarUrl || "/trophytracker-logo.png");
        } catch {
          avatarTexture = await PIXI.Assets.load("/trophytracker-logo.png");
        }
        const avatar = new PIXI.Sprite(avatarTexture);
        avatar.anchor.set(0.5);
        avatar.x = 0;
        avatar.y = 0;
        avatar.width = 108;
        avatar.height = 108;

        const avatarBg = new PIXI.Graphics().circle(0, 0, 54).fill({ color: 0x12263b, alpha: 1 });
        avatarBg.stroke({ color: 0x8ccfff, width: 2, alpha: 0.45 });

        const frame = PIXI.Sprite.from(frameUrl);
        frame.anchor.set(0.5);
        frame.x = 0;
        frame.y = 0;
        frame.width = 150;
        frame.height = 150;

        container.addChild(avatarBg, avatar, frame);
        return { container, avatar };
      }

      const leftFighter = await createFighter({
        x: leftX,
        y: centerY,
        avatarUrl: localBattleAvatarForUser(battleState.challenger?.user),
        frameUrl: frameByLevel(battleState.challenger?.avatar?.level || battleState.challenger?.stats?.level || 1),
      });
      const rightFighter = await createFighter({
        x: rightX,
        y: centerY,
        avatarUrl: localBattleAvatarForUser(battleState.opponent?.user),
        frameUrl: frameByLevel(battleState.opponent?.avatar?.level || battleState.opponent?.stats?.level || 1),
      });

      const leftHpBg = new PIXI.Graphics().roundRect(leftX - 120, 42, 240, 12, 999).fill({ color: 0x203448, alpha: 0.9 });
      const rightHpBg = new PIXI.Graphics().roundRect(rightX - 120, 42, 240, 12, 999).fill({ color: 0x203448, alpha: 0.9 });
      const leftHpFill = new PIXI.Graphics();
      const rightHpFill = new PIXI.Graphics();
      stage.addChild(leftHpBg, rightHpBg, leftHpFill, rightHpFill, leftFighter.container, rightFighter.container);

      const leftName = new PIXI.Text({
        text: battleState.challenger?.user?.display_name || "Challenger",
        style: { fill: "#e8f2ff", fontSize: 15, fontFamily: "Arial", fontWeight: "700" },
      });
      leftName.anchor.set(0.5);
      leftName.x = leftX;
      leftName.y = 26;

      const rightName = new PIXI.Text({
        text: battleState.opponent?.user?.display_name || "Opponent",
        style: { fill: "#e8f2ff", fontSize: 15, fontFamily: "Arial", fontWeight: "700" },
      });
      rightName.anchor.set(0.5);
      rightName.x = rightX;
      rightName.y = 26;
      stage.addChild(leftName, rightName);

      const fxLeft = new PIXI.Graphics().circle(leftX, centerY, 62).fill({ color: 0x00d9ff, alpha: 0 });
      const fxRight = new PIXI.Graphics().circle(rightX, centerY, 62).fill({ color: 0xff6e66, alpha: 0 });
      const slashFx = new PIXI.Graphics();
      const floatText = new PIXI.Text({
        text: "",
        style: { fill: "#ffffff", fontSize: 20, fontFamily: "Arial", fontWeight: "700", stroke: { color: "#0b1630", width: 3 } },
      });
      floatText.anchor.set(0.5);
      floatText.alpha = 0;
      stage.addChild(fxLeft, fxRight, slashFx, floatText);

      pixiRef.current = {
        app,
        leftFighter,
        rightFighter,
        leftHpFill,
        rightHpFill,
        fxLeft,
        fxRight,
        slashFx,
        floatText,
        leftBaseX: leftX,
        rightBaseX: rightX,
        effectTimers: [],
      };
    }

    initPixiArena();
    return () => {
      disposed = true;
      if (pixiRef.current?.app) {
        if (Array.isArray(pixiRef.current.effectTimers)) {
          for (const t of pixiRef.current.effectTimers) clearTimeout(t);
        }
        pixiRef.current.app.destroy(true, { children: true });
      }
      pixiRef.current = null;
      if (arenaRef.current) arenaRef.current.innerHTML = "";
    };
  }, [battle?.id, battleState?.challenger?.user?.avatar_url, battleState?.opponent?.user?.avatar_url]);

  useEffect(() => {
    const pixi = pixiRef.current;
    if (!pixi || !battleState?.challenger || !battleState?.opponent) return;

    const leftMax = Number(battleState.challenger?.stats?.maxHp || 1);
    const rightMax = Number(battleState.opponent?.stats?.maxHp || 1);
    const leftPct = hpPercent(snap.challengerHp, leftMax) / 100;
    const rightPct = hpPercent(snap.opponentHp, rightMax) / 100;

    pixi.leftHpFill.clear().roundRect(120, 42, 240 * leftPct, 12, 999).fill({ color: 0x00d9ff, alpha: 0.95 });
    pixi.rightHpFill.clear().roundRect(600, 42, 240 * rightPct, 12, 999).fill({ color: 0xff8a7a, alpha: 0.95 });

    const entry = logAsc[replayStep];
    if (!entry) return;
    const challengerId = String(battleState.challenger?.user?.id || "");
    const actorIsChallenger = String(entry.actorUserId || "") === challengerId;
    const actorFighter = actorIsChallenger ? pixi.leftFighter : pixi.rightFighter;
    const targetFighter = actorIsChallenger ? pixi.rightFighter : pixi.leftFighter;
    const targetFx = actorIsChallenger ? pixi.fxRight : pixi.fxLeft;
    const actorFx = actorIsChallenger ? pixi.fxLeft : pixi.fxRight;
    const attackDir = actorIsChallenger ? 1 : -1;

    if (Array.isArray(pixi.effectTimers)) {
      for (const t of pixi.effectTimers) clearTimeout(t);
      pixi.effectTimers = [];
    }
    actorFighter.container.x = actorIsChallenger ? pixi.leftBaseX : pixi.rightBaseX;
    targetFighter.container.x = actorIsChallenger ? pixi.rightBaseX : pixi.leftBaseX;
    pixi.slashFx.clear();
    pixi.floatText.alpha = 0;

    actorFighter.container.scale.set(1.08);
    actorFx.alpha = 0.22;
    if (entry.move === "heal") {
      actorFx.tint = 0x2fffb2;
      targetFx.alpha = 0;
      pixi.floatText.text = `+${Number(entry.healAmount || 0)}`;
      pixi.floatText.style.fill = "#7dffcb";
      pixi.floatText.x = actorIsChallenger ? pixi.leftBaseX : pixi.rightBaseX;
      pixi.floatText.y = 120;
      pixi.floatText.alpha = 1;
    } else if (entry.move === "guard") {
      actorFx.tint = 0x66d1ff;
      targetFx.alpha = 0;
      pixi.floatText.text = "GUARD";
      pixi.floatText.style.fill = "#8fe6ff";
      pixi.floatText.x = actorIsChallenger ? pixi.leftBaseX : pixi.rightBaseX;
      pixi.floatText.y = 120;
      pixi.floatText.alpha = 1;
    } else {
      targetFx.alpha = entry.hit ? 0.28 : 0.12;
      targetFx.tint = entry.hit ? 0xff6e66 : 0xffffff;
      actorFx.tint = 0x00d9ff;
      const actorBase = actorIsChallenger ? pixi.leftBaseX : pixi.rightBaseX;
      const targetBase = actorIsChallenger ? pixi.rightBaseX : pixi.leftBaseX;
      const tackleX = actorBase + (targetBase - actorBase) * 0.68;
      actorFighter.container.x = tackleX;
      if (entry.hit) {
        targetFighter.container.x = (actorIsChallenger ? pixi.rightBaseX : pixi.leftBaseX) + 18 * attackDir;
        pixi.slashFx
          .clear()
          .moveTo((actorIsChallenger ? pixi.rightBaseX : pixi.leftBaseX) - 24, 160)
          .lineTo((actorIsChallenger ? pixi.rightBaseX : pixi.leftBaseX) + 24, 210)
          .stroke({ color: 0xffffff, width: 4, alpha: 0.85 });
        pixi.floatText.text = `-${Number(entry.damage || 0)}`;
        pixi.floatText.style.fill = "#ffb0a3";
        pixi.floatText.x = actorIsChallenger ? pixi.rightBaseX : pixi.leftBaseX;
        pixi.floatText.y = 120;
        pixi.floatText.alpha = 1;
      } else {
        pixi.floatText.text = "MISS";
        pixi.floatText.style.fill = "#d8e9ff";
        pixi.floatText.x = actorIsChallenger ? pixi.rightBaseX : pixi.leftBaseX;
        pixi.floatText.y = 120;
        pixi.floatText.alpha = 1;
      }
    }

    const timeout = setTimeout(() => {
      actorFighter.container.x = actorIsChallenger ? pixi.leftBaseX : pixi.rightBaseX;
      targetFighter.container.x = actorIsChallenger ? pixi.rightBaseX : pixi.leftBaseX;
      actorFighter.container.scale.set(1);
      targetFx.alpha = 0;
      actorFx.alpha = 0;
      pixi.slashFx.clear();
      pixi.floatText.alpha = 0;
    }, 300);
    pixi.effectTimers.push(timeout);
    return () => clearTimeout(timeout);
  }, [replayStep, snap.challengerHp, snap.opponentHp, battleState, logAsc]);

  return (
    <main style={wrap}>
      <a href="/" style={{ color: "#9defff", textDecoration: "underline" }}>
        {"<-"} Home
      </a>
      <h1 style={{ marginTop: 10 }}>Avatar Arena</h1>
      <p style={{ marginTop: 0, opacity: 0.85 }}>
        Auto-Simulierter Rundenkampf. Das Ergebnis basiert auf Stats und Zufall.
      </p>

      {err ? <p style={{ color: "#ff9db0" }}>{err}</p> : null}
      {!battleState || !mySide ? (
        <p>{loading ? "Lade Kampf..." : "Kein Kampf gefunden."}</p>
      ) : (
        <>
          <section style={{ ...card, marginBottom: 12, padding: 10 }}>
            <div
              ref={arenaRef}
              style={{
                width: "100%",
                maxWidth: 960,
                margin: "0 auto",
                borderRadius: 12,
                overflow: "hidden",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                background: "rgba(0,0,0,0.15)",
              }}
            />
          </section>

          <section
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: "1fr auto 1fr",
              alignItems: "center",
              borderRadius: 14,
              padding: 10,
              backgroundImage: "url('/avatar-assets/backgrounds/battle-arena.svg')",
              backgroundSize: "cover",
              backgroundPosition: "center",
              border: "1px solid rgba(255, 255, 255, 0.14)",
            }}
          >
            <article style={card}>
              <AvatarToken user={mySide.me.user} avatar={mySide.me.avatar} />
              <div style={{ fontWeight: 700 }}>{mySide.me.user?.display_name || "Du"}</div>
              <div style={{ opacity: 0.85, fontSize: 13 }}>
                Lv {mySide.me.avatar?.level || 1} | Block:{" "}
                {String(mySide.me.user?.id || "") === String(battleState?.challenger?.user?.id || "")
                  ? snap.challengerBlock
                  : snap.opponentBlock}
              </div>
              <div style={{ marginTop: 10, ...progressTrack }}>
                <div
                  style={{
                    width: `${hpPercent(
                      String(mySide.me.user?.id || "") === String(battleState?.challenger?.user?.id || "")
                        ? snap.challengerHp
                        : snap.opponentHp,
                      mySide.me.stats?.maxHp
                    )}%`,
                    height: "100%",
                    background: "linear-gradient(90deg, #00d9ff, #2fffb2)",
                  }}
                />
              </div>
              <div style={{ marginTop: 6, fontSize: 13 }}>
                HP:{" "}
                {String(mySide.me.user?.id || "") === String(battleState?.challenger?.user?.id || "")
                  ? snap.challengerHp
                  : snap.opponentHp}
                /{mySide.me.stats?.maxHp}
              </div>
            </article>

            <div style={{ fontSize: 28, opacity: 0.85 }}>VS</div>

            <article style={card}>
              <AvatarToken user={mySide.enemy.user} avatar={mySide.enemy.avatar} />
              <div style={{ fontWeight: 700 }}>{mySide.enemy.user?.display_name || "Gegner"}</div>
              <div style={{ opacity: 0.85, fontSize: 13 }}>
                Lv {mySide.enemy.avatar?.level || 1} | Block:{" "}
                {String(mySide.enemy.user?.id || "") === String(battleState?.challenger?.user?.id || "")
                  ? snap.challengerBlock
                  : snap.opponentBlock}
              </div>
              <div style={{ marginTop: 10, ...progressTrack }}>
                <div
                  style={{
                    width: `${hpPercent(
                      String(mySide.enemy.user?.id || "") === String(battleState?.challenger?.user?.id || "")
                        ? snap.challengerHp
                        : snap.opponentHp,
                      mySide.enemy.stats?.maxHp
                    )}%`,
                    height: "100%",
                    background: "linear-gradient(90deg, #ff8a7a, #ffcb7a)",
                  }}
                />
              </div>
              <div style={{ marginTop: 6, fontSize: 13 }}>
                HP:{" "}
                {String(mySide.enemy.user?.id || "") === String(battleState?.challenger?.user?.id || "")
                  ? snap.challengerHp
                  : snap.opponentHp}
                /{mySide.enemy.stats?.maxHp}
              </div>
            </article>
          </section>

          <section style={{ ...card, marginTop: 14 }}>
            <div style={{ marginBottom: 8 }}>
              <b>Status:</b>{" "}
              {battle.status === "finished"
                ? String(battle.winner_user_id) === youId
                  ? "Du hast gewonnen."
                  : "Der Gegner hat gewonnen."
                : "Kampf wird simuliert..."}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, opacity: 0.85 }}>
                Replay Runde: {replayStep}/{totalReplayTurns}
              </span>
              <button
                type="button"
                onClick={() => setReplayRunning((prev) => !prev)}
                style={secondaryButton}
              >
                {replayRunning ? "Pause" : "Play"}
              </button>
              <button
                type="button"
                onClick={restartWithNewRandomBattle}
                disabled={restartBusy}
                style={{ ...secondaryButton, opacity: restartBusy ? 0.75 : 1 }}
              >
                {restartBusy ? "Starte..." : "Neuer Zufallskampf"}
              </button>
            </div>
            <p style={{ marginTop: 0, opacity: 0.8, fontSize: 13 }}>
              Manuelle Zuege sind deaktiviert. Das Kampflog zeigt jede Runde automatisch.
            </p>
            <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
              <button style={moveButton} disabled>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <img src="/avatar-assets/icons/strike.svg" alt="" aria-hidden="true" width="18" height="18" />
                  Strike
                </span>
              </button>
              <button style={moveButton} disabled>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <img src="/avatar-assets/icons/power.svg" alt="" aria-hidden="true" width="18" height="18" />
                  Power Shot
                </span>
              </button>
              <button style={moveButton} disabled>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <img src="/avatar-assets/icons/guard.svg" alt="" aria-hidden="true" width="18" height="18" />
                  Guard
                </span>
              </button>
              <button style={moveButton} disabled>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <img src="/avatar-assets/icons/heal.svg" alt="" aria-hidden="true" width="18" height="18" />
                  Recover
                </span>
              </button>
            </div>
          </section>

          <section style={{ ...card, marginTop: 14 }}>
            <h2 style={{ marginTop: 0, marginBottom: 10 }}>Kampflog</h2>
            {logItems.length === 0 ? (
              <p style={{ margin: 0, opacity: 0.8 }}>Noch keine Aktionen.</p>
            ) : (
              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 8 }}>
                {logItems.map((entry, idx) => (
                  <li
                    key={`${entry.turn || 0}-${idx}`}
                    style={{
                      border: "1px solid rgba(255, 255, 255, 0.12)",
                      borderRadius: 8,
                      padding: "8px 10px",
                      background: "rgba(255, 255, 255, 0.03)",
                    }}
                  >
                    <div style={{ fontSize: 12, opacity: 0.75 }}>
                      Turn {entry.turn} - {entry.createdAt ? new Date(entry.createdAt).toLocaleTimeString("de-DE") : ""}
                    </div>
                    <div>{entry.statusText || "Aktion"}</div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  );
}

