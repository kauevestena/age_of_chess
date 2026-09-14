import { unitSVG } from "./art.mjs";
import { code, label, describeEvent } from "./engine.mjs";

const STOP = Symbol("skip");
function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(STOP);
    const abort = () => {
      clearTimeout(timer);
      reject(STOP);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, ms);
    signal.addEventListener("abort", abort, { once: true });
  });
}

class Particles {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.items = [];
    this.resize();
    this.last = performance.now();
  }
  resize() {
    const box = this.canvas.getBoundingClientRect(),
      dpr = Math.min(devicePixelRatio || 1, 2);
    this.width = box.width;
    this.height = box.height;
    this.canvas.width = box.width * dpr;
    this.canvas.height = box.height * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  burst(x, y, type = "steel", count = 45) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2,
        speed = 25 + Math.random() * 190;
      this.items.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (type === "faith" ? 90 : 30),
        life: 0.5 + Math.random() * 0.9,
        max: 1.4,
        size: type === "dust" ? 3 + Math.random() * 5 : 1 + Math.random() * 2,
        color:
          type === "faith"
            ? ["#e4dfac", "#c3d9da", "#b8c8a3"][i % 3]
            : type === "dust"
              ? "#b1a07b"
              : ["#f5edc8", "#d9b361", "#e8a567"][i % 3],
        type,
      });
    }
    if (!this.frame) this.run();
  }
  run() {
    const now = performance.now(),
      dt = Math.min((now - this.last) / 1000, 0.04);
    this.last = now;
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.items = this.items.filter((p) => p.life > 0);
    for (const p of this.items) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += (p.type === "faith" ? -15 : 150) * dt;
      this.ctx.globalAlpha = Math.max(0, Math.min(p.life, 1));
      this.ctx.fillStyle = p.color;
      if (p.type === "steel") {
        this.ctx.save();
        this.ctx.translate(p.x, p.y);
        this.ctx.rotate(Math.atan2(p.vy, p.vx));
        this.ctx.fillRect(0, 0, p.size * 4, 1.4);
        this.ctx.restore();
      } else {
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }
    this.ctx.globalAlpha = 1;
    this.frame = this.items.length
      ? requestAnimationFrame(() => this.run())
      : null;
  }
  stop() {
    cancelAnimationFrame(this.frame);
    this.frame = null;
    this.items = [];
    this.ctx.clearRect(0, 0, this.width, this.height);
  }
}

export class CombatDirector {
  constructor(audio) {
    this.audio = audio;
    this.animations = [];
  }
  animate(el, frames, duration, options = {}) {
    if (!el) return;
    const animation = el.animate(frames, {
      duration,
      easing: "ease-in-out",
      fill: "forwards",
      ...options,
    });
    animation.finished.catch(() => {});
    this.animations.push(animation);
    return animation;
  }
  async play(before, event, settings) {
    const reduced =
      settings.motion === "reduced" ||
      matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.abort = new AbortController();
    this.animations = [];
    try {
      if (event.kind > 0 && settings.battles === "cinematic" && !reduced)
        await this.cinema(event);
      else
        await this.board(before, event, reduced, settings.battles === "quick");
    } catch (error) {
      if (error !== STOP) console.error("Animation failed", error);
    } finally {
      for (const animation of this.animations) animation.cancel();
      this.particles?.stop();
      this.ghost?.remove();
      this.ghost = null;
      document.querySelectorAll(".animation-hidden").forEach((el) => {
        el.style.visibility = "";
        el.classList.remove("animation-hidden");
      });
      const dialog = document.querySelector("#battle-dialog");
      if (dialog.open) dialog.close();
    }
  }
  async board(before, event, reduced, quick) {
    const source = document.querySelector(`[data-index="${event.from}"]`),
      target = document.querySelector(`[data-index="${event.to}"]`);
    if (!source || !target) return;
    const sound = ["move", "melee", "ranged", "convert"][event.kind];
    this.audio.effect(
      code(event.actor) === "N" && event.kind < 2 ? "cavalry" : sound,
    );
    if (reduced) {
      await wait(90, this.abort.signal);
      return;
    }
    const from = source.getBoundingClientRect(),
      to = target.getBoundingClientRect(),
      dx = to.x - from.x,
      dy = to.y - from.y;
    const duration = quick ? 230 : 440;
    this.particles = new Particles(document.querySelector("#board-effects"));
    const canvasBox = this.particles.canvas.getBoundingClientRect();
    if (event.kind === 0 || event.kind === 1) {
      const ghost = document.createElement("div");
      this.ghost = ghost;
      ghost.className = "move-ghost";
      ghost.style.cssText = `left:${from.x}px;top:${from.y - from.height * 0.08}px;width:${from.width}px;height:${from.height * 1.05}px;`;
      ghost.innerHTML = unitSVG(event.actor);
      document.body.append(ghost);
      const sourceArt = source.querySelector(
        `[data-slot="${event.action[2]}"]`,
      );
      if (sourceArt) {
        sourceArt.style.visibility = "hidden";
        sourceArt.classList.add("animation-hidden");
      }
      const frames = [{ transform: "translate(0,0)" }];
      if (
        code(event.actor) === "N" &&
        Math.abs(event.action[0] - event.action[3]) === 2
      ) {
        const [r, c, , , cc] = event.action,
          midr = r - before.turn;
        const midc = [c - 1, c, c + 1].find(
          (m) =>
            m >= 0 &&
            m < 8 &&
            Math.abs(cc - m) <= 1 &&
            !before.board[midr * 8 + m].length,
        );
        if (midc !== undefined) {
          const mid = document
            .querySelector(`[data-index="${midr * 8 + midc}"]`)
            .getBoundingClientRect();
          frames.push({
            transform: `translate(${mid.x - from.x}px,${mid.y - from.y - 8}px)`,
            offset: 0.5,
          });
        }
      }
      frames.push({ transform: `translate(${dx}px,${dy}px)` });
      this.animate(ghost, frames, duration);
      await wait(duration, this.abort.signal);
      if (event.kind === 1) {
        this.particles.burst(
          to.x + to.width / 2 - canvasBox.x,
          to.y + to.height / 2 - canvasBox.y,
        );
        if (!event.moved && event.survival[0])
          this.animate(
            ghost,
            [
              { transform: `translate(${dx}px,${dy}px)` },
              { transform: "translate(0,0)" },
            ],
            duration,
          );
        else if (!event.survival[0])
          this.animate(
            ghost,
            [
              { opacity: 1 },
              {
                opacity: 0,
                transform: `translate(${dx}px,${dy + 14}px) rotate(-65deg)`,
              },
            ],
            duration,
          );
        await wait(duration, this.abort.signal);
      }
    } else {
      this.animate(
        target,
        [
          { filter: "brightness(1)" },
          {
            filter:
              event.kind === 3 ? "brightness(2) sepia(.4)" : "brightness(1.8)",
          },
          { filter: "brightness(1)" },
        ],
        500,
      );
      this.particles.burst(
        to.x + to.width / 2 - canvasBox.x,
        to.y + to.height / 2 - canvasBox.y,
        event.kind === 3 ? "faith" : "steel",
      );
      await wait(500, this.abort.signal);
    }
    if (event.losses.some((l) => l.cause === "priestess_adjacency")) {
      this.audio.effect("convert");
      for (const loss of event.losses.filter(
        (l) => l.cause === "priestess_adjacency",
      )) {
        const cell = document
          .querySelector(`[data-index="${loss.at}"]`)
          .getBoundingClientRect();
        this.particles.burst(
          cell.x + cell.width / 2 - canvasBox.x,
          cell.y + cell.height / 2 - canvasBox.y,
          "faith",
          35,
        );
      }
      await wait(450, this.abort.signal);
    }
  }
  async cinema(event) {
    const dialog = document.querySelector("#battle-dialog"),
      stage = document.querySelector("#encounter-stage"),
      phase = document.querySelector("#encounter-phase");
    document.querySelector("#encounter-title").textContent =
      `${label(event.actor)} ${event.kind === 3 ? "conversion" : event.kind === 2 ? "volley" : "engagement"}`;
    document.querySelector("#encounter-outcome").textContent = "";
    phase.textContent =
      event.kind === 3
        ? "A prayer crosses the field"
        : event.kind === 2
          ? "The bowstring draws"
          : code(event.actor) === "N"
            ? "The cavalry gathers speed"
            : "The lines meet";
    stage.innerHTML = `<span class="army-name">${event.actor > 0 ? "Azure" : "Ember"} Host</span><span class="army-name enemy">${event.defender[0] > 0 ? "Azure" : "Ember"} Host</span><div class="combatant attacker">${unitSVG(event.actor)}</div><div class="combatant defender">${unitSVG(event.defender[0])}</div>${event.defender.length > 1 ? `<div class="combatant companion">${unitSVG(event.defender[1])}</div>` : ""}<canvas id="encounter-effects" aria-hidden="true"></canvas>`;
    const skip = () => this.abort.abort();
    document.querySelector("#skip-battle").onclick = skip;
    dialog.oncancel = (e) => {
      e.preventDefault();
      skip();
    };
    dialog.showModal();
    document.querySelector("#skip-battle").focus();
    this.particles = new Particles(
      document.querySelector("#encounter-effects"),
    );
    const a = stage.querySelector(".attacker"),
      d = stage.querySelector(".defender"),
      b = stage.querySelector(".companion");
    const stageWidth = stage.getBoundingClientRect().width;
    const charge = Math.max(
      18,
      d.offsetLeft - a.offsetLeft - a.offsetWidth + 45,
    );
    const clashX = d.offsetLeft + d.offsetWidth * 0.18;
    this.animate(
      a,
      [
        { opacity: 0, transform: "translateX(-24px)" },
        { opacity: 1, transform: "translateX(0)" },
      ],
      350,
    );
    this.animate(
      d,
      [
        { opacity: 0, transform: "translateX(24px)" },
        { opacity: 1, transform: "translateX(0)" },
      ],
      350,
    );
    await wait(450, this.abort.signal);
    if (event.kind === 1) {
      this.audio.effect(code(event.actor) === "N" ? "cavalry" : "move");
      this.animate(
        a,
        [
          { transform: "translate(0,0)" },
          { transform: `translate(${charge * 0.45}px,-8px)`, offset: 0.5 },
          { transform: `translate(${charge}px,0)` },
        ],
        650,
      );
      this.animate(
        d.querySelector(".weapon"),
        [
          { transform: "rotate(0)" },
          {
            transform:
              code(event.defender[0]) === "P"
                ? "rotate(-42deg)"
                : "rotate(-16deg)",
          },
        ],
        550,
      );
      for (let i = 0; i < 3; i++) {
        this.particles.burst(
          a.offsetLeft + 55 + (charge * i) / 3,
          this.particles.height - 24,
          "dust",
          12,
        );
        await wait(170, this.abort.signal);
      }
      await wait(140, this.abort.signal);
      for (let clash = 0; clash < 2; clash++) {
        phase.textContent = clash ? "Steel answers steel" : "The first clash";
        this.animate(
          a.querySelector(".weapon"),
          [
            { transform: "rotate(-28deg)" },
            { transform: "rotate(39deg)", offset: 0.45 },
            { transform: "rotate(-8deg)" },
          ],
          370,
        );
        this.animate(
          d,
          [
            { transform: "translateX(0)" },
            { transform: "translateX(13px) rotate(4deg)", offset: 0.4 },
            { transform: "translateX(0)" },
          ],
          370,
        );
        await wait(160, this.abort.signal);
        this.audio.effect("melee");
        this.particles.burst(clashX, this.particles.height * 0.55, "steel", 48);
        this.animate(
          stage,
          [
            { filter: "brightness(1)" },
            { filter: "brightness(1.22)" },
            { filter: "brightness(1)" },
          ],
          180,
        );
        await wait(260, this.abort.signal);
      }
    } else if (event.kind === 2) {
      this.animate(
        a.querySelector(".weapon"),
        [
          { transform: "rotate(-9deg) translateX(-5px)" },
          { transform: "rotate(0) translateX(4px)" },
        ],
        700,
      );
      await wait(500, this.abort.signal);
      this.audio.effect("ranged");
      phase.textContent = "The arrow finds its mark";
      const arrows =
        code(event.actor) === "B" && !"BPQ".includes(code(event.defender[0]))
          ? 2
          : 1;
      for (let i = 0; i < arrows; i++) {
        const arrow = document.createElement("div");
        arrow.className = "battle-arrow";
        stage.append(arrow);
        arrow.style.marginTop = `${i * 12}px`;
        this.animate(
          arrow,
          [
            { transform: "translate(0,0)", opacity: 1 },
            {
              transform: `translate(${stageWidth * 0.35}px,${i * 3}px)`,
              opacity: 1,
              offset: 0.85,
            },
            {
              transform: `translate(${stageWidth * 0.37}px,${i * 3}px)`,
              opacity: 0,
            },
          ],
          430,
        );
      }
      await wait(400, this.abort.signal);
      this.particles.burst(
        d.offsetLeft + 70,
        this.particles.height * 0.56,
        "dust",
        30,
      );
    } else {
      this.audio.effect("convert");
      const ring = document.createElement("div");
      ring.className = "spell-ring";
      stage.append(ring);
      this.animate(
        a.querySelector(".weapon"),
        [{ transform: "rotate(0)" }, { transform: "rotate(-20deg)" }],
        550,
      );
      this.animate(
        ring,
        [
          { transform: "scale(.2)", opacity: 0 },
          { transform: "scale(1)", opacity: 1 },
          { transform: "scale(1.3)", opacity: 0 },
        ],
        1600,
      );
      for (let i = 0; i < 5; i++) {
        this.particles.burst(
          d.offsetLeft + 70,
          this.particles.height - 45,
          "faith",
          25,
        );
        await wait(180, this.abort.signal);
      }
      d.innerHTML = unitSVG(-event.defender[0]);
      this.animate(
        d,
        [{ filter: "brightness(2.5)" }, { filter: "brightness(1)" }],
        650,
      );
      phase.textContent = "A new allegiance is sworn";
    }
    if (event.kind !== 3) {
      phase.textContent =
        event.kind === 1 && !event.survival[0]
          ? "The charge is repelled"
          : "The engagement is decided";
      const dying = [];
      if (event.kind === 1 && !event.survival[0]) dying.push(a);
      if (event.kind === 2 || (event.kind === 1 && !event.survival[1]))
        dying.push(d);
      if (b && event.kind === 1 && !event.survival[2]) dying.push(b);
      for (const el of dying)
        this.animate(
          el,
          [
            { opacity: 1, translate: "0 0", rotate: "0deg" },
            {
              opacity: 0.5,
              translate: "0 14px",
              rotate: el === a ? "-50deg" : "50deg",
              offset: 0.55,
            },
            {
              opacity: 0,
              translate: "0 30px",
              rotate: el === a ? "-80deg" : "80deg",
            },
          ],
          720,
        );
      if (event.kind === 1 && event.survival[0] && !event.moved)
        this.animate(
          a,
          [
            { transform: `translateX(${charge}px)` },
            { transform: "translateX(0)" },
          ],
          800,
        );
      await wait(730, this.abort.signal);
    }
    // Simultaneous Priestess casualties, if not already the direct melee casualties.
    if (event.losses.some((l) => l.cause === "priestess_adjacency")) {
      phase.textContent = "Opposing faiths extinguish one another";
      this.audio.effect("convert");
      for (const loss of event.losses.filter(
        (l) => l.cause === "priestess_adjacency",
      )) {
        const el =
          loss.unit === event.actor
            ? a
            : loss.unit === event.defender[0]
              ? d
              : b;
        if (el)
          this.animate(
            el,
            [
              { opacity: 1, filter: "brightness(2)" },
              { opacity: 0, filter: "brightness(3)" },
            ],
            600,
          );
      }
      await wait(620, this.abort.signal);
    }
    document.querySelector("#encounter-outcome").textContent =
      describeEvent(event);
    await wait(1200, this.abort.signal);
  }
}
