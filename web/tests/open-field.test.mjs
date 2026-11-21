import test from "node:test";
import assert from "node:assert/strict";
import { initialState, studyState, legalActions, unfilteredActions, preparationActions, transition, validateState } from "../src/engine.mjs";
import { RULES, RULESETS } from "../src/rules.mjs";
import { createRecord, readRecord, stateAt } from "../src/records.mjs";
import { chooseAction } from "../src/ai.mjs";

const ALL = [-1, 0, 1].flatMap((r) => [-1, 0, 1].filter((c) => r || c).map((c) => [r, c]));
const REACH = { 1: 2, 2: 3, 3: 2, 4: 2, 5: 2, 6: 1 };
const sq = (r, c) => r * 8 + c;
const key = (a) => a.join();

// A raw Open Field position (no adjudication), so move generation can be compared directly.
function raw(units, turn, cooldown = {}) {
  const board = Array.from({ length: 64 }, () => []);
  for (const [i, u] of units) board[i] = [u];
  return { ...initialState("open_field"), board, layout: board.map(() => -1), cooldown: board.map((_, i) => cooldown[i] ?? 0),
    turn, winner: null, counts: {} };
}

// Independent reference: recursive path enumeration over the combat table (spec + user decisions).
function reference(state) {
  const owner = state.turn, board = state.board, table = RULESETS.open_field.combat.single;
  const codeOf = (u) => "PNBRQK"[Math.abs(u) - 1];
  const king = board.findIndex((s) => s.includes(-owner * 6));
  const empties = board.map((s, i) => (s.length ? -1 : i)).filter((i) => i >= 0);
  const passable = (i) => !board[i].length || Math.sign(board[i][0]) === owner;
  const walk = (origin, steps, budget) => {
    const out = new Set();
    const go = (at, left) => {
      for (const [dr, dc] of steps(at)) {
        const r = (at >> 3) + dr, c = (at % 8) + dc;
        if (r < 0 || r > 7 || c < 0 || c > 7) continue;
        out.add(r * 8 + c);
        if (left > 1 && passable(r * 8 + c)) go(r * 8 + c, left - 1);
      }
    };
    go(origin, budget);
    out.delete(origin);
    return out;
  };
  const forward = () => [-1, 0, 1].map((dc) => [-owner, dc]);
  const towardKing = (at) => {
    if (king < 0) return forward();
    const [r, c, kr, kc] = [at >> 3, at % 8, king >> 3, king % 8];
    return r !== kr ? [-1, 0, 1].map((dc) => [Math.sign(kr - r), dc]) : c !== kc ? [[0, Math.sign(kc - c)]] : [];
  };
  const enemyWithin = (at, radius) => board.some((s, i) => s.length && Math.sign(s[0]) !== owner &&
    Math.max(Math.abs((i >> 3) - (at >> 3)), Math.abs((i % 8) - (at % 8))) <= radius);
  const out = new Set();
  board.forEach((s, at) => {
    if (!s.length || Math.sign(s[0]) !== owner) return;
    const code = codeOf(s[0]), [r, c] = [at >> 3, at % 8];
    const steps = code === "K" ? (enemyWithin(at, 2) ? () => ALL : forward)
      : code === "Q" && enemyWithin(at, 1) ? () => ALL : towardKing;
    for (const to of walk(at, steps, REACH[Math.abs(s[0])])) if (!board[to].length) out.add(key([r, c, 0, to >> 3, to % 8, 0]));
    for (const to of walk(at, () => ALL, REACH[Math.abs(s[0])]))
      if (board[to].length && Math.sign(board[to][0]) !== owner && table[code][codeOf(board[to][0])] !== "illegal")
        out.add(key([r, c, 0, to >> 3, to % 8, 1]));
    if (code === "B") {
      const supported = ALL.some(([dr, dc]) => r + dr >= 0 && r + dr < 8 && c + dc >= 0 && c + dc < 8 && board[sq(r + dr, c + dc)][0] === owner * 3);
      for (const [dr, dc] of ALL)
        for (const distance of [1, 2]) {                     // the first occupied square stops the arrow
          const [tr, tc] = [r + distance * dr, c + distance * dc];
          if (tr < 0 || tr > 7 || tc < 0 || tc > 7) break;
          const t = board[sq(tr, tc)];
          if (!t.length) continue;
          const ready = distance === 1 || !state.cooldown[at];
          if (Math.sign(t[0]) !== owner && ready && ("BPQ".includes(codeOf(t[0])) || ("NR".includes(codeOf(t[0])) && supported)))
            out.add(key([r, c, 0, tr, tc, 2]));
          break;
        }
    }
    if (code === "Q")
      board.forEach((t, i) => {
        if (t.length && Math.sign(t[0]) !== owner && "PNBR".includes(codeOf(t[0])) && Math.max(Math.abs((i >> 3) - r), Math.abs((i % 8) - c)) <= 2)
          for (const e of empties) out.add(key([i >> 3, i % 8, 0, e >> 3, e % 8, 3]));
      });
  });
  return [...out].sort();
}
const actual = (state) => unfilteredActions(state).map(key).sort();

test("the Open Field ruleset is exported with its own reach and no formations", () => {
  const of = RULESETS.open_field;
  assert.equal(of.mode, "open_field");
  assert.equal(of.formations, false);
  assert.equal(of.formation_rearrangements, 0);
  assert.deepEqual(Object.fromEntries(Object.entries(of.pieces).map(([c, p]) => [c, p.move.max_steps])), { P: 2, N: 3, B: 2, R: 2, Q: 2, K: 1 });
  assert.equal(of.pieces.B.abilities.find((a) => a.name === "power_shot").support, "adjacent");
  assert.equal(RULESETS.warfare.formations, true);
});

test("opening: 95 orders per side, all equal to the reference", () => {
  const s = initialState("open_field");
  for (const turn of [1, -1]) {
    const state = { ...s, turn };
    assert.equal(legalActions(state).length, 95);
    assert.deepEqual(actual(state), reference(state));
  }
});

test("every class, every unit square against every enemy King square, both owners", () => {
  let checked = 0;
  for (const owner of [1, -1]) for (const unit of [1, 2, 3, 4, 5, 6]) {
    const ownCorner = owner === 1 ? 63 : 7;
    for (let origin = 0; origin < 64; origin++) for (let king = 0; king < 64; king++) {
      if (new Set([origin, king, ownCorner]).size < 3) continue;
      const units = [[origin, owner * unit], [king, -owner * 6], [ownCorner, owner * (unit === 6 ? 1 : 6)]];
      const state = raw(units, owner);
      assert.deepEqual(actual(state), reference(state), `${owner} ${unit} ${origin} ${king}`);
      checked++;
    }
  }
  assert.equal(checked, 12 * 63 * 62);
});

test("crowded random boards match the reference", () => {
  let seed = 11;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let n = 0; n < 1000; n++) {
    const cells = [];
    const count = 6 + Math.floor(rnd() * 21);
    while (cells.length < count) { const i = Math.floor(rnd() * 64); if (!cells.includes(i)) cells.push(i); }
    const units = [[cells[0], 6], [cells[1], -6]], queens = new Set();
    for (const i of cells.slice(2)) {
      const owner = rnd() < 0.5 ? 1 : -1;
      let unit = [1, 1, 2, 3, 3, 4, 5][Math.floor(rnd() * 7)];
      if (unit === 5 && queens.has(owner)) unit = 3;
      if (unit === 5) queens.add(owner);
      units.push([i, owner * unit]);
    }
    const cooldown = Object.fromEntries(units.filter(([, u]) => Math.abs(u) === 3 && rnd() < 0.4).map(([i]) => [i, rnd() < 0.5 ? 1 : 2]));
    const state = raw(units, rnd() < 0.5 ? 1 : -1, cooldown);
    assert.deepEqual(actual(state), reference(state), JSON.stringify(units));
  }
});

test("units pass friends, stop only on empty squares, and never form formations", () => {
  const s = studyState(Object.assign(Array.from({ length: 64 }, () => []), { [sq(5, 3)]: [1], [sq(4, 3)]: [1], [sq(0, 4)]: [-6], [63]: [6], [0]: [-1] }), 1, [0, 0], null, [], [0, 0], "open_field");
  const quiet = legalActions(s).filter((a) => a[0] === 5 && a[1] === 3 && a[5] === 0).map((a) => sq(a[3], a[4]));
  assert(quiet.includes(sq(3, 3)) && !quiet.includes(sq(4, 3)));
  assert.equal(preparationActions(s).length, 0);
  assert(legalActions(s).every((a) => a[5] <= 3 && a[2] === 0));
  const stacked = Array.from({ length: 64 }, () => []);
  stacked[sq(4, 3)] = [1, 3]; stacked[63] = [6]; stacked[0] = [-6]; stacked[1] = [-1];
  assert.throws(() => studyState(stacked, 1, [0, 0], null, [], [0, 0], "open_field"), /no formations/);
});

test("Cavalry rides three steps through a lane of friends", () => {
  const units = [[sq(6, 3), 2], [sq(5, 3), 1], [sq(4, 3), 1], [sq(5, 2), -3], [sq(5, 4), -3], [sq(4, 2), -3], [sq(4, 4), -3], [sq(0, 4), -6], [63, 6]];
  const quiet = unfilteredActions(raw(units, 1)).filter((a) => a[0] === 6 && a[1] === 3 && a[5] === 0).map((a) => sq(a[3], a[4])).sort((x, y) => x - y);
  assert.deepEqual(quiet, [sq(3, 2), sq(3, 3), sq(3, 4)]);
});

test("power shot needs a neighbouring friendly Archer", () => {
  for (const [friend, allowed] of [[sq(5, 2), true], [sq(3, 4), true], [sq(4, 5), false], [null, false]]) {
    const units = [[sq(4, 3), 3], [sq(3, 3), -4], [63, 6], [sq(0, 7), -6], [0, -1]];
    if (friend !== null) units.push([friend, 3]);
    const has = unfilteredActions(raw(units, 1)).some((a) => key(a) === key([4, 3, 0, 3, 3, 2]));
    assert.equal(has, allowed, String(friend));
  }
});

test("attacks from two squares respect guarded stance from the starting square", () => {
  const board = Array.from({ length: 64 }, () => []);
  board[sq(5, 3)] = [1]; board[sq(3, 3)] = [-1]; board[63] = [6]; board[7] = [-6]; board[56] = [4]; board[0] = [-4];
  const s = studyState(board, 1, [0, 0], null, [], [0, 0], "open_field");
  const out = transition(s, [5, 3, 0, 3, 3, 1]);
  assert.equal(out.event.approach, 2);
  assert.deepEqual(out.state.board[sq(3, 3)], [-1]);
  assert.deepEqual(out.state.board[sq(5, 3)], []);
});

test("switching between rulesets in one process keeps each game's rules", () => {
  const warfare = initialState(), open = initialState("open_field");
  for (let i = 0; i < 4; i++) {
    assert.equal(legalActions(warfare).length, 52);
    assert.equal(RULES.mode, "warfare");
    assert.equal(legalActions(open).length, 95);
    assert.equal(RULES.mode, "open_field");
  }
  const w = transition(warfare, [6, 4, 0, 5, 4, 0]).state, o = transition(open, [6, 4, 0, 4, 4, 0]).state;
  assert.equal(w.mode, "warfare");
  assert.equal(o.mode, "open_field");
  assert.throws(() => transition(warfare, [6, 4, 0, 4, 4, 0]));      // two steps are Open Field only
  validateState(w);
  validateState(o);
});

test("saves keep the ruleset; old saves load as Warfare", () => {
  let s = initialState("open_field");
  const moves = [[6, 4, 0, 4, 4, 0]];                                   // a two-step opening, illegal in Warfare
  s = transition(s, moves[0]).state;
  for (let i = 0; i < 12 && s.winner === null; i++) {
    const m = legalActions(s)[(i * 7) % legalActions(s).length];
    moves.push(m);
    s = transition(s, m).state;
  }
  const record = createRecord(moves, { mode: "local", difficulty: "knight", humanSide: 1, ruleset: "open_field" });
  const loaded = readRecord(JSON.stringify(record));
  assert.equal(loaded.state.mode, "open_field");
  assert.deepEqual(loaded.state, s);
  assert.deepEqual(stateAt(moves, moves.length, "open_field"), s);
  const old = createRecord([[6, 4, 0, 5, 4, 0]], { mode: "local", difficulty: "knight", humanSide: 1 });
  assert.equal(readRecord(JSON.stringify(old)).state.mode, "warfare");
  assert.throws(() => readRecord(JSON.stringify({ ...record, config: { ...record.config, ruleset: "chaos" } })), /Unknown ruleset/);
  assert.throws(() => readRecord(JSON.stringify({ ...record, config: { ...record.config, ruleset: "warfare" } })));
});

test("all AI levels play legal Open Field orders, including a short AI-versus-AI game", () => {
  let s = initialState("open_field");
  for (const difficulty of ["squire", "knight", "marshal"]) {
    const result = chooseAction(s, difficulty, { budgetMs: 150, random: () => 0.5 });
    assert(legalActions(s).some((a) => key(a) === key(result.action)), difficulty);
    assert.deepEqual(result.preparations, []);
  }
  for (let i = 0; i < 24 && s.winner === null; i++) {
    const { action } = chooseAction(s, i % 2 ? "squire" : "knight", { budgetMs: 60, random: () => 0.3 });
    s = transition(s, action).state;
    validateState(s);
    assert(s.board.every((cell) => cell.length <= 1));
  }
});

test("Open Field arrows reach two squares; a long shot starts a two-turn cooldown for that Archer", () => {
  const board = Array.from({ length: 64 }, () => []);
  board[sq(4, 3)] = [3]; board[sq(2, 3)] = [-1]; board[sq(2, 1)] = [-1]; board[sq(7, 0)] = [1]; board[sq(6, 7)] = [1];
  board[sq(0, 0)] = [-4]; board[sq(0, 7)] = [-6]; board[63] = [6];
  let s = studyState(board, 1, [0, 0], null, [], [0, 0], "open_field");
  const longShot = (state, target) => legalActions(state).some((a) => key(a) === key([4, 3, 0, ...target, 2]));
  assert(longShot(s, [2, 3]) && longShot(s, [2, 1]));
  s = transition(s, [4, 3, 0, 2, 3, 2]).state;
  assert.equal(s.cooldown[sq(4, 3)], 2);
  s = transition(s, [0, 0, 0, 1, 0, 0]).state;                // South's turn does not count
  assert.equal(s.cooldown[sq(4, 3)], 2);
  assert(!longShot(s, [2, 1]));
  s = transition(s, [7, 0, 0, 6, 0, 0]).state;
  assert.equal(s.cooldown[sq(4, 3)], 1);
  s = transition(s, [1, 0, 0, 2, 0, 0]).state;
  assert(!longShot(s, [2, 1]));
  s = transition(s, [6, 7, 0, 5, 7, 0]).state;
  assert.equal(s.cooldown[sq(4, 3)], 0);
  s = transition(s, [2, 0, 0, 3, 0, 0]).state;
  assert(longShot(s, [2, 1]));
  validateState(s);
});

test("adjacent shots ignore the cooldown, and the cooldown moves with its Archer", () => {
  const units = [[sq(4, 3), 3], [sq(3, 3), -1], [sq(2, 1), -1], [63, 6], [sq(0, 7), -6], [0, -1]];
  const s = raw(units, 1, { [sq(4, 3)]: 2 });
  const shots = unfilteredActions(s).filter((a) => a[5] === 2).map((a) => sq(a[3], a[4]));
  assert(shots.includes(sq(3, 3)) && !shots.includes(sq(2, 1)));
  const board = Array.from({ length: 64 }, () => []);
  board[sq(4, 3)] = [3]; board[63] = [6]; board[sq(0, 7)] = [-6]; board[0] = [-1];
  const cooldown = board.map((_, i) => (i === sq(4, 3) ? 2 : 0));
  const moved = transition(studyState(board, 1, [0, 0], null, [], [0, 0], "open_field", cooldown), [4, 3, 0, 2, 3, 0]).state;
  assert.equal(moved.cooldown[sq(2, 3)], 1);
  assert.equal(moved.cooldown[sq(4, 3)], 0);
  const bad = structuredClone(moved);
  bad.cooldown[63] = 1;
  assert.throws(() => validateState(bad), /cooldown/);
});
