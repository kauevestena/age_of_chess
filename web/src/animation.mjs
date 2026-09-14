import { unitSVG } from "./art.mjs";
import { POSITIONS } from "./formations.mjs";
import {
  code,
  label,
  describeEvent,
  approachLabel,
  cavalryPassable,
  isPreparation, isShot,
} from "./engine.mjs";

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
      if (!isPreparation(event.kind) && event.kind > 0 && settings.battles === "cinematic" && !reduced)
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
    if (isPreparation(event.kind)) {
      this.audio.effect("move");
      if (reduced) { await wait(90, this.abort.signal); return; }
      const flipped = document.querySelector("#board [data-index]").dataset.index === "63";
      const locations = { N: [.17, -.09], S: [.17, .33], W: [-.08, .12], E: [.42, .12] };
      const box = source.getBoundingClientRect();
      for (const art of source.querySelectorAll("[data-slot]")) {
        const next = POSITIONS[event.layout ^ (flipped ? 1 : 0)][Number(art.dataset.slot)];
        const old = locations[art.dataset.position], wanted = locations[next];
        this.animate(art, [{ transform: "translate(0,0)" }, {
          transform: `translate(${(wanted[0]-old[0])*box.width}px,${(wanted[1]-old[1])*box.height}px)`
        }], 360);
      }
      await wait(370, this.abort.signal);
      return;
    }
    const sound = isShot(event.kind) ? "ranged" : ["move", "melee", "ranged", "convert"][event.kind];
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
        Math.max(
          Math.abs(event.action[0] - event.action[3]),
          Math.abs(event.action[1] - event.action[4]),
        ) === 2
      ) {
        const [r, c, , rr, cc] = event.action;
        const midCell = [-1, 0, 1]
          .flatMap((dr) => [-1, 0, 1].map((dc) => [r + dr, c + dc]))
          .find(
            ([mr, mc]) =>
              mr >= 0 &&
              mr < 8 &&
              mc >= 0 &&
              mc < 8 &&
              Math.max(Math.abs(rr - mr), Math.abs(cc - mc)) === 1 &&
              cavalryPassable(before.board[mr * 8 + mc], before.turn) &&
              (event.kind === 1 ||
                (mr === r + Math.sign(rr - r) && rr === mr + Math.sign(rr - r))),
          );
        if (midCell) {
          const [midr, midc] = midCell;
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
      if (event.returnFire) {
        this.animate(
          source,
          [
            { filter: "brightness(1)" },
            { filter: "brightness(1.8)" },
            { filter: "brightness(1)" },
          ],
          500,
        );
        this.particles.burst(
          from.x + from.width / 2 - canvasBox.x,
          from.y + from.height / 2 - canvasBox.y,
          "steel",
          30,
        );
      }
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
      `${label(event.actor)} ${event.kind === 3 ? "conversion" : isShot(event.kind) ? "volley" : "engagement"}${event.stance ? ` · ${approachLabel(event.approach)}` : ""}`;
    document.querySelector("#encounter-outcome").textContent = "";
    phase.textContent =
      event.kind === 3
        ? "A prayer crosses the field"
        : isShot(event.kind)
          ? "The bowstring draws"
          : code(event.actor) === "N"
            ? "The cavalry gathers speed"
            : "The lines meet";
    const primarySlot = event.kind === 1 ? event.formation.waves[0].slots[0] : event.targetSlot || 0;
    const secondarySlot = 1 - primarySlot, primaryUnit = event.defender[primarySlot];
    const fallen = new Set();
    const fall = el => {
      if (!el || fallen.has(el)) return;
      fallen.add(el);
      this.animate(el, [{ opacity: 1, translate: "0 0", rotate: "0deg" },
        { opacity: .55, translate: "0 14px", rotate: "40deg", offset: .5 },
        { opacity: 0, translate: "0 30px", rotate: "80deg" }], 450);
    };
    stage.innerHTML = `<span class="army-name">${event.actor > 0 ? "Azure" : "Ember"} Host</span><span class="army-name enemy">${event.defender[0] > 0 ? "Azure" : "Ember"} Host</span><div class="combatant attacker">${unitSVG(event.actor)}</div><div class="combatant defender" data-defender-slot="${primarySlot}">${unitSVG(primaryUnit)}<span class="combat-member">${event.defender.length > 1 ? `Unit ${primarySlot ? "B" : "A"}` : "Defender"}</span></div>${event.defender.length > 1 ? `<div class="combatant companion" data-defender-slot="${secondarySlot}">${unitSVG(event.defender[secondarySlot])}<span class="combat-member">Unit ${secondarySlot ? "B" : "A"}</span></div>` : ""}<canvas id="encounter-effects" aria-hidden="true"></canvas>`;
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
      let advance = 0;
      for (const [index, wave] of event.formation.waves.entries()) {
        const targets = wave.slots.map(slot => stage.querySelector(`[data-defender-slot="${slot}"]`));
        const target = targets[0];
        const destination = Math.max(18, target.offsetLeft - a.offsetLeft - a.offsetWidth + 45);
        phase.textContent = event.formation.mode === "king_guard" && !wave.reserve ? "The royal escort meets the attack" : wave.reserve && code(event.defender[wave.slots[0]]) === "K" ? "The King is defenseless" : wave.reserve ? "The reserve turns to meet the attacker"
          : targets.length === 2 ? event.formation.mode === "braced_line" ? "Both defenders brace the front" : "Both exposed defenders engage"
          : event.defender.length === 2 ? `Unit ${wave.slots[0] ? "B" : "A"} meets the attack` : "The lines meet";
        if (wave.reserve) {
          this.animate(target.querySelector(".unit-art"), [{ transform: "rotateY(85deg)" }, { transform: "rotateY(0)" }], 320);
          await wait(330, this.abort.signal);
        }
        this.audio.effect(code(event.actor) === "N" && !index ? "cavalry" : "move");
        this.animate(a, [{ transform: `translate(${advance}px,0)` },
          { transform: `translate(${(advance+destination)/2}px,-8px)`, offset: .5 },
          { transform: `translate(${destination}px,0)` }], 500);
        for (const [j, el] of targets.entries()) {
          if (code(event.defender[wave.slots[j]]) !== "K") this.animate(el.querySelector(".weapon"), [{ transform: "rotate(0)" },
            { transform: `rotate(${code(event.defender[wave.slots[j]]) === "P" ? -42 : -16}deg)` }], 400);
          this.particles.burst(el.offsetLeft + 25, this.particles.height - 24, "dust", 15);
        }
        advance = destination;
        await wait(500, this.abort.signal);
        for (let clash = 0; clash < 2; clash++) {
          this.animate(a.querySelector(".weapon"), [{ transform: "rotate(-28deg)" },
            { transform: "rotate(39deg)", offset: .45 }, { transform: "rotate(-8deg)" }], 330);
          for (const el of targets) {
            this.animate(el, [{ transform: "translateX(0)" },
              { transform: "translateX(10px) rotate(4deg)", offset: .4 }, { transform: "translateX(0)" }], 330);
            this.particles.burst(el.offsetLeft + el.offsetWidth*.18, this.particles.height*.55, "steel", 35);
          }
          this.audio.effect("melee");
          await wait(340, this.abort.signal);
        }
        // One simultaneous wave applies all its casualties before any reserve acts.
        targets.forEach((el, i) => { if (!wave.defenders[i]) fall(el); });
        if (!wave.alive) fall(a);
        await wait(460, this.abort.signal);
      }
    } else if (isShot(event.kind)) {
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
      phase.textContent = event.returnFire
        ? "The defending Archer returns fire"
        : "The arrow finds its mark";
      if (event.returnFire) {
        this.animate(
          d.querySelector(".weapon"),
          [{ transform: "rotate(9deg)" }, { transform: "rotate(0)" }],
          430,
        );
        const answer = document.createElement("div");
        answer.className = "battle-arrow return-arrow";
        answer.style.left = "65%";
        stage.append(answer);
        this.animate(
          answer,
          [
            { transform: "translate(0,0) rotate(180deg)", opacity: 1 },
            {
              transform: `translate(${-stageWidth * 0.35}px,0) rotate(180deg)`,
              opacity: 1,
              offset: 0.85,
            },
            {
              transform: `translate(${-stageWidth * 0.37}px,0) rotate(180deg)`,
              opacity: 0,
            },
          ],
          430,
        );
      }
      const arrows =
        code(event.actor) === "B" && !"BPQ".includes(code(primaryUnit))
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
      if (event.returnFire)
        this.particles.burst(
          a.offsetLeft + 70,
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
      if (event.returnFire || (event.kind === 1 && !event.survival[0]))
        dying.push(a);
      if (isShot(event.kind) || (event.kind === 1 && !event.survival[1 + primarySlot]))
        dying.push(d);
      if (b && event.kind === 1 && !event.survival[1 + secondarySlot]) dying.push(b);
      for (const el of dying.filter(el => !fallen.has(el)))
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
            : loss.unit === primaryUnit
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
