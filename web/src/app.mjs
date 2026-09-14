import {
  initialState,
  legalActions,
  transition,
  label,
  code,
  side,
  actionKey,
  squareName,
  describeEvent,
} from "./engine.mjs";
import { RULES } from "./rules.mjs";
import { unitSVG, icon, crest } from "./art.mjs";
import { Soundscape } from "./audio.mjs";
import { CombatDirector } from "./animation.mjs";
import {
  SAVE_KEY,
  SETTINGS_KEY,
  createRecord,
  readRecord,
  stateAt,
} from "./records.mjs";
import { LESSONS } from "./tutorial.mjs";

const $ = (selector) => document.querySelector(selector);
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const HOST = (owner) => (owner === 1 ? "Azure Host" : "Ember Host");
const DIRECTION = (owner) => (owner === 1 ? "North" : "South");
const names = { squire: "Squire", knight: "Knight", marshal: "Marshal" };
const descriptions = {
  P: "A disciplined line of spears. Defeats Cavalry and Archers in melee; falls to Heavy Infantry.",
  N: "A swift shock unit. Takes one or two clear forward steps. Defeats lone Heavy Infantry; beware Pikemen and Infantry-led stacks.",
  B: "A bow is strongest at a distance. Fires along three forward rays, up to two squares. Pikemen defeat Archers in melee.",
  R: "The armored heart of an army. Defeats Pikemen and Archers. A lone Infantry unit is vulnerable to Cavalry.",
  Q: "Turns a solitary adjacent enemy to your banner. Cannot convert a Commander, Priestess, or formation.",
  K: "The fate of the realm. Captures any top defender when attacking. Losing your Commander ends the battle.",
};
let state = initialState(),
  moves = [],
  events = [],
  config = { mode: "solo", difficulty: "knight", humanSide: 1 };
let selected = null,
  flipped = false,
  busy = false,
  legal = [],
  hint = null,
  inGame = false,
  tutorial = -1,
  lessonDone = false;
let replayPly = null,
  resignation = null,
  activeCell = 52,
  worker,
  requestId = 0,
  aiTimer,
  aiTimeout,
  toastTimer;
let settings = {
  battles: "cinematic",
  motion: "full",
  music: 0.38,
  effects: 0.6,
  sound: true,
};
let savedText = null,
  storageAvailable = true;
try {
  const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
  settings.battles = ["cinematic", "quick"].includes(saved.battles)
    ? saved.battles
    : "cinematic";
  settings.motion = saved.motion === "reduced" ? "reduced" : "full";
  for (const key of ["music", "effects"])
    if (typeof saved[key] === "number" && saved[key] >= 0 && saved[key] <= 1)
      settings[key] = saved[key];
  settings.sound = saved.sound !== false;
  savedText = localStorage.getItem(SAVE_KEY);
} catch {
  storageAvailable = false;
}

document
  .querySelectorAll("[data-icon]")
  .forEach((el) => (el.innerHTML = icon(el.dataset.icon)));
document
  .querySelectorAll("[data-crest]")
  .forEach((el) => (el.innerHTML = crest(Number(el.dataset.crest))));
$("#hero-army").innerHTML = unitSVG(1) + unitSVG(3) + unitSVG(6);
$("#continue").hidden = !savedText;
const audio = new Soundscape((name) => ($("#track-name").textContent = name));
audio.enabled = settings.sound;
audio.setVolumes(settings.music, settings.effects);
const director = new CombatDirector(audio);

function toast(message) {
  $("#toast").textContent = message;
  $("#toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($("#toast").hidden = true), 4200);
}
function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* Gameplay remains available. */
  }
}
function saveGame() {
  if (tutorial >= 0) return;
  savedText = JSON.stringify(createRecord(moves, config, resignation));
  try {
    localStorage.setItem(SAVE_KEY, savedText);
    storageAvailable = true;
  } catch {
    storageAvailable = false;
  }
  $("#continue").hidden = false;
  $("#save-status").textContent = storageAvailable
    ? "Game saved on this device"
    : "Autosave unavailable · use Save";
}
function soundLabel() {
  const playing = audio.enabled && audio.started;
  $("#sound-button").innerHTML =
    icon(playing ? "music" : "mute") +
    `<span id="sound-label">${playing ? "Sound on" : audio.started ? "Sound off" : "Enable sound"}</span>`;
  $("#sound-button").setAttribute(
    "aria-label",
    playing ? "Mute soundtrack and effects" : "Enable soundtrack and effects",
  );
  if (!playing)
    $("#track-name").textContent = audio.started
      ? "The realm is silent"
      : "The realm awaits";
}
async function startSound() {
  if (settings.sound) {
    await audio.start();
    soundLabel();
  }
}
$("#sound-button").onclick = async () => {
  if (!audio.started) {
    audio.enabled = true;
    await audio.start();
  } else await audio.toggle();
  settings.sound = audio.enabled;
  saveSettings();
  soundLabel();
};
soundLabel();

function openModal(html) {
  if (busy === "ai" || busy === "hint") {
    cancelAI();
    render();
  }
  $("#modal-content").innerHTML = html;
  if (!$("#modal").open) $("#modal").showModal();
}
function closeModal() {
  $("#modal").close();
}
$("#modal-close").onclick = closeModal;
$("#modal").addEventListener("close", () => {
  if (inGame) queueAI();
});
$("#modal").addEventListener("click", (e) => {
  if (e.target !== $("#modal")) return;
  const r = $("#modal").getBoundingClientRect();
  if (
    e.clientX < r.left ||
    e.clientX > r.right ||
    e.clientY < r.top ||
    e.clientY > r.bottom
  )
    closeModal();
});
function cancelAI() {
  requestId++;
  clearTimeout(aiTimer);
  clearTimeout(aiTimeout);
  worker?.terminate();
  worker = null;
  if (busy === "ai" || busy === "hint") busy = false;
}
function enterGame() {
  inGame = true;
  $("#lobby").hidden = true;
  $("#game").hidden = false;
  $("#main").focus({ preventScroll: true });
  audio.tension = true;
  selected = null;
  hint = null;
  replayPly = null;
  render();
}
function startGame() {
  cancelAI();
  tutorial = -1;
  lessonDone = false;
  resignation = null;
  state = initialState();
  moves = [];
  events = [];
  config = {
    mode: $("input[name=mode]:checked").value,
    difficulty: $("input[name=difficulty]:checked").value,
    humanSide: Number($("input[name=side]:checked").value),
  };
  if (config.mode === "local") config.humanSide = 1;
  flipped = config.humanSide === -1;
  activeCell = flipped ? 12 : 52;
  startSound();
  enterGame();
  saveGame();
  queueAI();
}
$("#begin").onclick = startGame;
$("#continue").onclick = () => {
  try {
    const saved = readRecord(savedText);
    loadGame(saved);
    startSound();
  } catch {
    toast(
      "This saved battle could not be read. Start a new battle or load another save.",
    );
  }
};
function loadGame({ record, state: loaded, events: history }) {
  cancelAI();
  tutorial = -1;
  lessonDone = false;
  config = { ...record.config };
  moves = record.moves.map((a) => [...a]);
  events = history;
  state = loaded;
  resignation = record.resignation ?? null;
  flipped = config.humanSide === -1;
  enterGame();
  saveGame();
  if (state.winner !== null) showResult();
  else queueAI();
}
function toLobby() {
  cancelAI();
  if (busy === "animation") return;
  inGame = false;
  audio.tension = false;
  tutorial = -1;
  replayPly = null;
  $("#game").hidden = true;
  $("#lobby").hidden = false;
  closeModal();
  $("#begin").focus();
}
function menu() {
  if (!inGame) return;
  if (busy === "animation") return;
  const canResign =
    state.winner === null &&
    tutorial < 0 &&
    replayPly === null &&
    (config.mode === "local" || state.turn === config.humanSide);
  openModal(
    `<p class="eyebrow">The war council</p><h2 id="modal-title">A moment to consider</h2><p>${tutorial >= 0 ? "Leave the training ground whenever you are ready." : storageAvailable ? "Your battle is saved on this device. Return to camp or continue your command." : "Download your battle using Save before closing this page."}</p><div class="dialog-actions"><button class="primary" id="resume-battle">Return to battle</button><button class="secondary" id="return-camp">Return to camp</button>${canResign ? '<button class="secondary" id="resign">Resign battle</button>' : ""}</div>`,
  );
  $("#resume-battle").onclick = closeModal;
  $("#return-camp").onclick = toLobby;
  if (canResign)
    $("#resign").onclick = () => {
      openModal(
        `<p class="eyebrow">Lower your banner</p><h2 id="modal-title">Concede the battle?</h2><p>The ${HOST(-state.turn)} will be declared the victor.</p><div class="dialog-actions"><button class="primary" id="confirm-resign">Concede</button><button class="secondary" id="cancel-resign">Keep fighting</button></div>`,
      );
      $("#cancel-resign").onclick = closeModal;
      $("#confirm-resign").onclick = () => {
        cancelAI();
        resignation = state.turn;
        state = { ...state, winner: -state.turn, reason: "resignation" };
        saveGame();
        render();
        showResult();
      };
    };
}
$("#home").onclick = () => {
  if (inGame) menu();
};
$("#menu-button").onclick = menu;
$("input[name=mode]").closest("fieldset").onchange = () => {
  const solo = $("input[name=mode]:checked").value === "solo";
  $("#difficulty-field").hidden = !solo;
  $("#allegiance-field").hidden = !solo;
};
$("#difficulty-field").onchange = () =>
  ($("#difficulty-description").textContent = {
    squire: "A forgiving opponent, learning the art of war.",
    knight: "A measured tactician who considers your reply.",
    marshal: "A deeper search and a more demanding battle.",
  }[$("input[name=difficulty]:checked").value]);

function displayedState() {
  return replayPly === null ? state : stateAt(moves, replayPly);
}
function roster(owner, s) {
  return [..."PNBRQK"]
    .map((c) => {
      const u = owner * ("PNBRQK".indexOf(c) + 1),
        count = s.board.flat().filter((x) => x === u).length;
      return `<span class="${count ? "" : "fallen"}" title="${RULES.pieces[c].label}: ${count}" aria-label="${RULES.pieces[c].label}: ${count}">${unitSVG(u)}${count}</span>`;
    })
    .join("");
}
function render() {
  if (!inGame) return;
  const display = displayedState();
  legal = replayPly === null ? legalActions(state) : [];
  $("#battle-mode").textContent =
    tutorial >= 0
      ? "The training ground"
      : config.mode === "solo"
        ? `Solo skirmish · ${names[config.difficulty]}`
        : "Local rivalry · two players";
  $("#turn-crest").innerHTML = crest(display.turn);
  $("#turn-name").textContent = `The ${HOST(display.turn)}`;
  $("#turn-number").textContent = String(display.ply + 1).padStart(2, "0");
  $("#turn-status").textContent =
    replayPly !== null
      ? "Reviewing history"
      : state.winner !== null
        ? "Battle concluded"
        : busy === "ai"
          ? "Considering its next order…"
          : busy === "hint"
            ? "The council is deliberating…"
            : busy === "animation"
              ? "The order is unfolding…"
              : tutorial >= 0
                ? "Training exercise"
                : config.mode === "local"
                  ? "Your orders, Commander"
                  : state.turn === config.humanSide
                    ? "Your turn"
                    : "Opponent’s turn";
  const own = config.humanSide;
  for (const [prefix, owner] of [
    ["player", own],
    ["enemy", -own],
  ]) {
    $(`#${prefix}-crest`).innerHTML = crest(owner);
    $(`#${prefix}-name`).textContent = HOST(owner);
    $(`#${prefix}-roster`).innerHTML = roster(owner, display);
  }
  $("#opponent-level").textContent =
    config.mode === "solo" ? names[config.difficulty] : "Local commander";
  $("#player-role").textContent =
    `${config.mode === "solo" ? "You" : "Local commander"} · ${DIRECTION(own)}`;
  const disabled = !!busy || replayPly !== null;
  $("#undo-button").disabled = disabled || !moves.length || tutorial >= 0;
  $("#hint-button").disabled =
    disabled ||
    state.winner !== null ||
    tutorial >= 0 ||
    (config.mode === "solo" && state.turn !== config.humanSide);
  $("#export-button").disabled = tutorial >= 0;
  $("#review-button").disabled = !!busy || !moves.length || tutorial >= 0;
  $("#menu-button").disabled = busy === "animation";
  $("#flip-button").disabled = busy === "animation";
  for (const id of [
    "home",
    "guide-button",
    "settings-button",
    "credits-button",
  ])
    $(`#${id}`).disabled = busy === "animation";
  $("#save-status").textContent =
    tutorial >= 0
      ? "Training · your saved battle is preserved"
      : storageAvailable
        ? "Game saved on this device"
        : "Autosave unavailable · use Save";
  $("#replay-panel").hidden = replayPly === null;
  if (replayPly !== null) {
    $("#replay-position").textContent = `${replayPly} / ${moves.length}`;
    $("#replay-prev").disabled = replayPly === 0;
    $("#replay-next").disabled = replayPly === moves.length;
  }
  renderBoard(display);
  renderSelection(display);
  renderLog();
  renderLesson();
}

function renderBoard(display) {
  const focused = document.activeElement?.dataset?.index;
  const available =
    selected && replayPly === null && !busy
      ? legal.filter(
          (a) => a[0] * 8 + a[1] === selected.index && a[2] === selected.slot,
        )
      : [];
  const last =
    replayPly === null
      ? events.at(-1)
      : replayPly > 0
        ? events[replayPly - 1]
        : null;
  const indices = Array.from({ length: 64 }, (_, i) => (flipped ? 63 - i : i));
  $("#board").innerHTML = indices
    .map((i) => {
      const sq = display.board[i],
        targets = available.filter((a) => a[3] * 8 + a[4] === i),
        r = Math.floor(i / 8),
        c = i % 8;
      const isSelected = selected?.index === i;
      const unitText = sq.length
        ? sq
            .map(
              (u, slot) =>
                `${slot ? "bottom" : "top"} ${HOST(side(u))} ${label(u)}`,
            )
            .join(", ")
        : "empty";
      const classes = [
        "board-cell",
        (r + c) % 2 ? "dark" : "",
        sq[0] < 0 ? "south" : "north",
        sq.length > 1 ? "stacked" : "",
        isSelected ? "selected" : "",
        targets.length ? "legal-target" : "",
        last && (last.from === i || last.to === i) ? "last-move" : "",
        hint && (hint[0] * 8 + hint[1] === i || hint[3] * 8 + hint[4] === i)
          ? "hint"
          : "",
      ].join(" ");
      const arts = sq
        .map((u, slot) =>
          unitSVG(u, slot ? "bottom" : "top").replace(
            "viewBox=",
            `data-slot="${slot}" viewBox=`,
          ),
        )
        .join("");
      return `<button class="${classes}" data-index="${i}" tabindex="${i === activeCell ? 0 : -1}" aria-label="${squareName(i)}, ${unitText}${targets.length ? ", legal destination" : ""}" aria-pressed="${isSelected}">${sq.length ? `<span class="piece-base"></span><span class="piece-code">${sq.map(code).join("·")}</span>` : ""}${arts}${sq.length > 1 ? '<span class="stack-badge">2</span>' : ""}${targets.length ? `<span class="target-marks">${[...new Set(targets.map((a) => a[5]))].map((k) => `<i class="${["move", "attack", "range", "faith"][k]}-dot"></i>`).join("")}</span>` : ""}</button>`;
    })
    .join("");
  $("#rank-labels").innerHTML = Array.from(
    { length: 8 },
    (_, i) => `<span>${flipped ? i + 1 : 8 - i}</span>`,
  ).join("");
  $("#file-labels").innerHTML = [...(flipped ? "hgfedcba" : "abcdefgh")]
    .map((c) => `<span>${c}</span>`)
    .join("");
  $("#board").setAttribute("aria-busy", String(!!busy));
  if (focused !== undefined)
    $(`[data-index="${focused}"]`)?.focus({ preventScroll: true });
}
function renderSelection(display) {
  const sq = selected ? display.board[selected.index] : [],
    unit = sq[selected?.slot];
  $("#slot-controls").hidden = sq.length < 2;
  if (!unit) {
    $("#selected-art").innerHTML = crest(display.turn);
    $("#selected-name").textContent = "Awaiting your orders";
    $("#selected-description").textContent =
      "Select a unit to see its movement and abilities.";
    $("#unit-facts").innerHTML = "";
    return;
  }
  $("#selected-art").innerHTML = unitSVG(unit);
  $("#selected-name").textContent = label(unit);
  $("#selected-description").textContent = descriptions[code(unit)];
  $("#unit-facts").innerHTML =
    `<span>${HOST(side(unit))} · ${squareName(selected.index)}${sq.length > 1 ? ` · ${selected.slot ? "Bottom" : "Top"} unit` : ""}</span><br><span>${side(unit) === display.turn ? "Highlighted squares show available orders." : "Inspecting an opposing unit."}</span>`;
  if (sq.length > 1) {
    $("#slot-controls").innerHTML =
      `<div class="slot-buttons" aria-label="Choose stack slot">${sq.map((u, slot) => `<button data-select-slot="${slot}" class="${selected.slot === slot ? "active" : ""}" aria-pressed="${selected.slot === slot}">${slot ? "Bottom" : "Top"} · ${label(u)}</button>`).join("")}</div>`;
  }
}
function renderLog() {
  $("#empty-log").hidden = events.length > 0;
  $("#move-log").innerHTML = events
    .slice(-40)
    .map(
      (e, j) =>
        `<li><span class="log-number">${events.length - Math.min(events.length, 40) + j + 1}</span><span><strong>${HOST(side(e.actor))}</strong><br>${escape(describeEvent(e))}</span></li>`,
    )
    .join("");
  $("#move-log").scrollTop = $("#move-log").scrollHeight;
}
function canAct() {
  return (
    inGame &&
    !busy &&
    replayPly === null &&
    state.winner === null &&
    (tutorial >= 0 ||
      config.mode === "local" ||
      state.turn === config.humanSide)
  );
}
function selectCell(index) {
  if (busy || replayPly !== null) return;
  activeCell = index;
  hint = null;
  if (canAct() && selected) {
    const choices = legal.filter(
      (a) =>
        a[0] * 8 + a[1] === selected.index &&
        a[2] === selected.slot &&
        a[3] * 8 + a[4] === index,
    );
    if (choices.length) {
      if (
        choices.length === 1 &&
        choices[0][5] === 0 &&
        !state.board[index].length
      )
        commit(choices[0]);
      else showOrders(choices, index);
      return;
    }
  }
  if (state.board[index].length) {
    selected = selected?.index === index ? null : { index, slot: 0 };
  } else selected = null;
  render();
}
$("#board").onclick = (e) => {
  const cell = e.target.closest("[data-index]");
  if (cell) selectCell(Number(cell.dataset.index));
};
$("#slot-controls").onclick = (e) => {
  const button = e.target.closest("[data-select-slot]");
  if (button && selected && !busy) {
    selected.slot = Number(button.dataset.selectSlot);
    render();
  }
};
$("#board").onkeydown = (e) => {
  const cell = e.target.closest("[data-index]");
  if (!cell) return;
  const i = Number(cell.dataset.index),
    dir = flipped ? -1 : 1;
  const delta = { ArrowUp: -8, ArrowDown: 8, ArrowLeft: -1, ArrowRight: 1 }[
    e.key
  ];
  if (delta !== undefined) {
    e.preventDefault();
    const next = i + delta * dir;
    if (
      next >= 0 &&
      next < 64 &&
      (Math.abs(delta) === 8 || Math.floor(next / 8) === Math.floor(i / 8))
    ) {
      activeCell = next;
      cell.tabIndex = -1;
      const target = $(`[data-index="${next}"]`);
      target.tabIndex = 0;
      target.focus();
    }
  }
  if (
    e.key.toLowerCase() === "b" &&
    selected &&
    state.board[selected.index].length === 2
  ) {
    e.preventDefault();
    selected.slot = 1 - selected.slot;
    render();
  }
};

function showOrders(choices, index) {
  const actor = state.board[selected.index][selected.slot],
    friendly =
      state.board[index][0] && side(state.board[index][0]) === state.turn;
  openModal(
    `<p class="eyebrow">Issue an order · ${squareName(index)}</p><h2 id="modal-title">${label(actor)} awaits</h2><p>Choose your action. These are the exact immediate outcomes.</p>${choices
      .map((a, i) => {
        const { event } = transition(state, a),
          title = [
            "Join formation",
            "Melee attack",
            "Ranged attack",
            "Convert unit",
          ][a[5]];
        return `<button class="order-option" data-order="${i}"><strong>${icon(["flag", "sword", "bow", "spark"][a[5]])}${title}</strong><p>${escape(describeEvent(event))}</p>${event.losses.length ? `<div class="casualties">Losses: ${event.losses.map((l) => `${HOST(side(l.unit))} ${label(l.unit)}`).join(" · ")}</div>` : ""}</button>`;
      })
      .join(
        "",
      )}${friendly ? '<button class="secondary wide" style="margin-top:15px" id="inspect-friendly">Select this friendly unit instead</button>' : ""}`,
  );
  document.querySelectorAll("[data-order]").forEach(
    (b) =>
      (b.onclick = () => {
        const a = choices[Number(b.dataset.order)];
        closeModal();
        commit(a);
      }),
  );
  if (friendly)
    $("#inspect-friendly").onclick = () => {
      selected = { index, slot: 0 };
      closeModal();
      render();
    };
}
async function commit(action, computer = false) {
  if (!computer && !canAct()) return;
  if (
    tutorial >= 0 &&
    actionKey(action) !== actionKey(LESSONS[tutorial].action)
  ) {
    toast("Follow the highlighted lesson: " + LESSONS[tutorial].text);
    return;
  }
  let next;
  try {
    next = transition(state, action);
  } catch {
    toast("That order is no longer available.");
    render();
    return;
  }
  busy = "animation";
  hint = null;
  render();
  await director.play(state, next.event, settings);
  state = next.state;
  selected = null;
  busy = false;
  if (tutorial >= 0) {
    lessonDone = true;
    events = [next.event];
    render();
    return;
  }
  moves.push([...action]);
  events.push(next.event);
  saveGame();
  render();
  if (state.winner !== null) showResult();
  else queueAI();
}

function requestAI(forHint = false) {
  const id = ++requestId;
  const fallback = async () => {
    if (id !== requestId) return;
    clearTimeout(aiTimeout);
    worker?.terminate();
    worker = null;
    const { chooseAction } = await import("./ai.mjs");
    if (id !== requestId) return;
    const result = chooseAction(state, "squire", { budgetMs: 70 });
    finish(result, true);
  };
  const finish = (result, fellBack = false) => {
    if (id !== requestId) return;
    clearTimeout(aiTimeout);
    worker?.terminate();
    worker = null;
    busy = false;
    if (!result.action) {
      render();
      return;
    }
    if (fellBack)
      toast(
        "The search worker is unavailable. Using a lighter local opponent.",
      );
    if (forHint) {
      hint = result.action;
      selected = { index: hint[0] * 8 + hint[1], slot: hint[2] };
      render();
      toast(
        `The council suggests: ${describeEvent(transition(state, hint).event)}`,
      );
    } else commit(result.action, true);
  };
  try {
    worker = new Worker(new URL("./ai-worker.mjs", import.meta.url), {
      type: "module",
    });
    worker.onmessage = ({ data }) => {
      if (data.id === id) {
        if (data.error) fallback();
        else finish(data);
      }
    };
    worker.onerror = (event) => {
      event.preventDefault();
      fallback();
    };
    aiTimeout = setTimeout(fallback, 7000);
    worker.postMessage({
      id,
      state,
      difficulty: forHint ? "marshal" : config.difficulty,
    });
  } catch {
    fallback();
  }
}
function queueAI() {
  if (
    !inGame ||
    busy ||
    tutorial >= 0 ||
    replayPly !== null ||
    state.winner !== null ||
    config.mode !== "solo" ||
    state.turn === config.humanSide ||
    $("#modal").open
  )
    return;
  busy = "ai";
  render();
  aiTimer = setTimeout(() => requestAI(false), 280);
}
$("#hint-button").onclick = () => {
  if (!canAct() || tutorial >= 0) return;
  busy = "hint";
  render();
  requestAI(true);
};
function undo() {
  if (busy || !moves.length || tutorial >= 0 || replayPly !== null) return;
  cancelAI();
  let length = moves.length - 1;
  if (config.mode === "solo")
    while (length > 0 && (length % 2 === 0 ? 1 : -1) !== config.humanSide)
      length--;
  if (config.mode === "solo" && config.humanSide === -1 && length === 0) {
    toast("The opening move belongs to the opponent.");
    return;
  }
  resignation = null;
  moves = moves.slice(0, length);
  events = events.slice(0, length);
  state = stateAt(moves, moves.length);
  selected = null;
  saveGame();
  render();
  queueAI();
}
$("#undo-button").onclick = undo;
function flip() {
  if (busy === "animation") return;
  flipped = !flipped;
  render();
}
$("#flip-button").onclick = flip;
document.addEventListener("keydown", (e) => {
  if (
    !inGame ||
    $("#modal").open ||
    $("#battle-dialog").open ||
    ["INPUT", "SELECT", "TEXTAREA"].includes(e.target.tagName)
  )
    return;
  if (e.key === "Escape") {
    selected = null;
    hint = null;
    render();
  }
  if (e.key.toLowerCase() === "f") flip();
  if (e.key.toLowerCase() === "u") undo();
});
function showResult() {
  const title =
    state.winner === 0
      ? "An honorable draw"
      : `The ${HOST(state.winner)} prevails`;
  const reason =
    {
      commander_capture: "The opposing Commander has fallen.",
      stagnation: "The opposing army has no legal order remaining.",
      threefold_repetition:
        "The same position, formations, and side to move have occurred three times.",
      resignation: "The opposing Commander has conceded the battle.",
      both_commanders_absent: "Both Commanders are absent.",
    }[state.reason] || "The battle is over.";
  if (state.winner !== 0) audio.effect("victory");
  openModal(
    `<div class="result"><div class="victory-crest">${crest(state.winner || 1)}</div><p class="eyebrow">The chronicle is written</p><h2 id="modal-title">${title}</h2><p>${reason}</p><p>${moves.length} orders issued · ${events.reduce((n, e) => n + e.losses.length, 0)} units fallen</p><div class="dialog-actions"><button id="result-review" class="primary">Review the field</button><button id="result-camp" class="secondary">Return to camp</button></div></div>`,
  );
  $("#result-review").onclick = closeModal;
  $("#result-camp").onclick = toLobby;
}

function exportGame() {
  if (tutorial >= 0) return;
  const blob = new Blob(
      [JSON.stringify(createRecord(moves, config, resignation), null, 2)],
      { type: "application/json" },
    ),
    url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `age-of-chess-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast("Your battle has been downloaded.");
}
$("#export-button").onclick = exportGame;
$("#import-button").onclick = () => $("#file-input").click();
$("#file-input").onchange = async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    if (file.size > 2_000_000) throw Error("File too large");
    const saved = readRecord(await file.text());
    loadGame(saved);
    startSound();
    toast("Your battle has been restored.");
  } catch {
    toast(
      "Unable to load this file. Choose a valid Age of Chess Warfare save.",
    );
  }
  e.target.value = "";
};
$("#review-button").onclick = () => {
  if (busy || !moves.length || tutorial >= 0) return;
  cancelAI();
  selected = null;
  replayPly = 0;
  render();
};
$("#replay-prev").onclick = () => {
  replayPly = Math.max(0, replayPly - 1);
  render();
};
$("#replay-next").onclick = () => {
  replayPly = Math.min(moves.length, replayPly + 1);
  render();
};
$("#replay-exit").onclick = () => {
  replayPly = null;
  render();
  queueAI();
};

function beginLesson(index) {
  cancelAI();
  tutorial = index;
  lessonDone = false;
  state = LESSONS[index].state();
  moves = [];
  events = [];
  flipped = false;
  selected = null;
  config = { mode: "local", difficulty: "knight", humanSide: 1 };
  resignation = null;
  enterGame();
  const a = LESSONS[index].action;
  selected = { index: a[0] * 8 + a[1], slot: 0 };
  render();
  $("#tutorial-panel").scrollIntoView({
    block: "nearest",
    behavior: "instant",
  });
}
$("#tutorial-button").onclick = () => {
  startSound();
  beginLesson(0);
};
function renderLesson() {
  $("#tutorial-panel").hidden = tutorial < 0;
  if (tutorial < 0) return;
  const lesson = LESSONS[tutorial];
  $("#tutorial-panel").innerHTML =
    `<p class="eyebrow">Lesson ${tutorial + 1} of ${LESSONS.length}</p><h2>${lesson.title}</h2><p>${lessonDone ? lesson.success : lesson.text}</p>${lessonDone ? `<button id="next-lesson" class="primary">${tutorial === LESSONS.length - 1 ? "Return to the war camp" : "Next lesson"} ${icon("arrow")}</button>` : ""}<button id="leave-training" style="margin-top:12px;font-size:13px;color:var(--gold)">Leave training</button>`;
  $("#leave-training").onclick = toLobby;
  if (lessonDone)
    $("#next-lesson").onclick = () =>
      tutorial === LESSONS.length - 1 ? toLobby() : beginLesson(tutorial + 1);
}

function settingsDialog() {
  openModal(
    `<p class="eyebrow">Make the realm your own</p><h2 id="modal-title">Sound & spectacle</h2><div class="settings-row"><label for="battle-setting">Combat animations<small>Cinematic encounters or quick board effects</small></label><select id="battle-setting"><option value="cinematic">Cinematic</option><option value="quick">Quick</option></select></div><div class="settings-row"><label for="motion-setting">Reduce motion<small>Also respects your device’s motion preference</small></label><input type="checkbox" id="motion-setting"></div><div class="settings-row"><label for="music-setting">Soundtrack volume<small>Original compositions for the realm</small></label><input id="music-setting" type="range" min="0" max="100" aria-label="Soundtrack volume"></div><div class="settings-row"><label for="effects-setting">Battle effects<small>Steel, arrows, hooves, and conversion</small></label><input id="effects-setting" type="range" min="0" max="100" aria-label="Battle effects volume"></div><p style="font-size:13px;margin-top:12px">Use the music button in the header to enable or mute all sound.</p>`,
  );
  $("#battle-setting").value = settings.battles;
  $("#motion-setting").checked = settings.motion === "reduced";
  $("#music-setting").value = settings.music * 100;
  $("#effects-setting").value = settings.effects * 100;
  $("#battle-setting").onchange = (e) => {
    settings.battles = e.target.value;
    saveSettings();
  };
  $("#motion-setting").onchange = (e) => {
    settings.motion = e.target.checked ? "reduced" : "full";
    saveSettings();
  };
  for (const name of ["music", "effects"])
    $(`#${name}-setting`).oninput = (e) => {
      settings[name] = Number(e.target.value) / 100;
      audio.setVolumes(settings.music, settings.effects);
      saveSettings();
    };
}
$("#settings-button").onclick = settingsDialog;
function guide(tab = "essentials") {
  const tabs = [
    ["essentials", "Essentials"],
    ["units", "The six orders"],
    ["counters", "Combat table"],
  ];
  let content = "";
  if (tab === "units")
    content = [..."PNBRQK"]
      .map(
        (c, i) =>
          `<article class="guide-unit">${unitSVG(i + 1)}<div><h3>${RULES.pieces[c].label}</h3><p>${descriptions[c]}</p></div></article>`,
      )
      .join("");
  else if (tab === "counters")
    content = `<p class="muted" style="margin-bottom:16px">Rows attack columns. W: attacker wins. L: attacker dies. M: both die. —: melee unavailable. These are solitary defenders.</p><div class="table-scroll"><table><thead><tr><th>Attacker</th>${[..."PNBRQK"].map((c) => `<th title="${RULES.pieces[c].label}">${c}</th>`).join("")}</tr></thead><tbody>${[
      ..."PNBRQK",
    ]
      .map(
        (c) =>
          `<tr><th>${c} · ${RULES.pieces[c].label}</th>${[..."PNBRQK"]
            .map((d) => {
              const outcome = RULES.combat.single[c][d];
              return `<td class="outcome-${outcome}">${{ win: "W", lose: "L", mutual: "M", illegal: "—" }[outcome]}</td>`;
            })
            .join("")}</tr>`,
      )
      .join(
        "",
      )}</tbody></table></div><div class="guide-prose"><h3>Three formation exceptions</h3><ul><li>Cavalry attacking two Archers kills both.</li><li>Cavalry attacking a stack with Heavy Infantry on top dies; both defenders survive.</li><li>Heavy Infantry attacking two Pikemen dies with the top Pikeman; the bottom survives.</li></ul><p>Otherwise attack the top unit once. If a defender remains, a surviving attacker stays at its origin in its original slot. A bottom Commander remains protected until promoted to top.</p></div>`;
  else
    content = `<div class="guide-prose"><h3>One order. One unit. One turn.</h3><p>North (Azure) moves first, toward row 0 / rank 8. South (Ember) advances toward rank 1. Choose a unit, then a highlighted destination. Capture the Commander to win. There is no check, checkmate, promotion, castling, or en passant.</p><h3>Movement and retreat</h3><p>Units step straight or diagonally forward. Cavalry may take two forward steps through an empty intermediate square, without jumping or continuing after combat. In the enemy half, units except the Commander can also step sideways. At the enemy back rank, every class can step once in any direction. A Priestess may retreat when an enemy is adjacent; a Commander may retreat when an enemy is within two squares in any direction, regardless of blockers.</p><h3>Two units. One formation.</h3><p>Move onto a friendly solitary unit to join underneath it. Both slots can act: choose Top or Bottom in the unit panel, or press B while on the board. The top takes enemy attacks; its death promotes the bottom. You cannot freely reorder a stack. Your companion does not add melee strength.</p><h3>Arrows and allegiance</h3><p>An Archer shoots one or two squares along a straight or diagonal forward ray. Any occupied square blocks further fire. A shot kills a top Pikeman, Archer, or Priestess. Two Archers together can also shoot Cavalry and Heavy Infantry. Shooting never moves the Archer and never kills a Commander.</p><p>A Priestess converts an adjacent solitary Pikeman, Cavalry, Archer, or Heavy Infantry in place. Converted units immediately use their new side’s direction. Adjacent opposing Priestesses die simultaneously after any action, even inside formations; their companions survive.</p><h3>The cost of an order</h3><p>Combat is deterministic. Attack previews list immediate casualties, including sacrifices. If every available order kills one of your own units during that order, you must minimize Commander deaths, then total own deaths, then losses in the order Infantry, Cavalry, Archer, Pikeman, Priestess. Otherwise sacrifices are freely allowed.</p><h3>When the battle ends</h3><p>Commander capture wins first. An army with no legal order loses. The third occurrence of an identical board, stack order, ownership, and side to move is a draw. There is no turn limit or material-based adjudication in browser play.</p><h3>Command at your pace</h3><p>Undo reverses your whole turn and the computer’s reply in solo play, or one order in local play. Battle chronicle → Review lets you step through the saved game. Save downloads a portable game file; Load a game restores it. Games also save automatically on this device when storage is available. Cinematics can be skipped with Escape, shortened in Settings, or reduced with your device’s motion preference.</p></div>`;
  openModal(
    `<p class="eyebrow">The commander’s companion</p><h2 id="modal-title">Field guide</h2><div class="guide-tabs">${tabs.map(([id, name]) => `<button data-guide="${id}" class="${id === tab ? "active" : ""}" aria-pressed="${id === tab}">${name}</button>`).join("")}</div>${content}`,
  );
  document
    .querySelectorAll("[data-guide]")
    .forEach((b) => (b.onclick = () => guide(b.dataset.guide)));
}
$("#guide-button").onclick = () => guide();
$("#credits-button").onclick = () =>
  openModal(
    `<p class="eyebrow">Made for this realm</p><h2 id="modal-title">Art & music</h2><div class="guide-prose"><p>All unit illustrations, heraldry, landscapes, interface ornaments, combat effects, and musical compositions were created for Age of Chess — Warfare.</p><h3>The original score</h3><p>“Banners in the Mist”, “The Ashen March”, and “A Crown at Dusk” form a three-part score, performed in your browser with synthesized plucked strings, recorder, bowed drones, frame drums, and bells.</p><h3>Typography</h3><p>Cinzel by the Cinzel Project Authors and IM Fell English by Igino Marini are included under the SIL Open Font License 1.1. <a href="./licenses/Cinzel-OFL.txt" target="_blank" rel="noopener">Cinzel license</a> · <a href="./licenses/IM-Fell-English-OFL.txt" target="_blank" rel="noopener">IM Fell English license</a>.</p><h3>An independent game</h3><p>The art direction celebrates medieval strategy games. No Age of Empires artwork, music, sound recordings, logos, or other game assets are included. Age of Chess is an independent project.</p><p><a href="https://github.com/kauevestena/age_of_chess" target="_blank" rel="noopener">Explore the project on GitHub</a></p></div>`,
  );

// Keep asynchronous search results from changing a different screen/game.
window.addEventListener("pagehide", () => {
  cancelAI();
  director.abort?.abort();
});
