import test from "node:test";
import assert from "node:assert/strict";
import { studyState, initialState, legalActions, legalOrders, transition, positionKey, validateState } from "../src/engine.mjs";
import * as engineModule from "../src/engine.mjs";
import { capWarps } from "../src/ai.mjs";
import { RULES } from "../src/rules.mjs";

const a = (from, to, kind = 0, slot = 0) => [from >> 3, from % 8, slot, to >> 3, to % 8, kind];
const sq = (r, c) => r * 8 + c;
const has = (s, m) => legalActions(s).some((x) => x.join() === m.join());

// Study position helper. Pieces: [index, [units]]. Kings: north 6, south -6.
// A side left with only its King gets a distant supporter (a lone King loses at once).
function setup(units, turn = 1) {
  const board = Array.from({ length: 64 }, () => []);
  for (const [i, s] of units) board[i] = s;
  for (const owner of [1, -1]) {
    if (board.flat().filter((u) => Math.sign(u) === owner).length === 1) {
      const back = owner === 1 ? 56 : 0;
      const i = Array.from({ length: 8 }, (_, c) => back + 7 - c).find((i) => !board[i].length);
      board[i] = [owner];
    }
  }
  return studyState(board, turn);
}
const quiet = (s, origin, slot = 0) =>
  legalActions(s).filter((m) => m[0] * 8 + m[1] === origin && m[2] === slot && m[5] === 0)
    .map((m) => m[3] * 8 + m[4]).sort((x, y) => x - y);
const cells = (...rc) => rc.map(([r, c]) => sq(r, c)).sort((x, y) => x - y);

// Independent reference of M2-M4 (spec section 3).
function reference(origin, king, owner, occupancy, cavalry) {
  const open = (i) => !occupancy.has(i) || (occupancy.get(i)[0] === owner && occupancy.get(i)[1] === 1);
  const steps = (i) => {
    const [r, c] = [i >> 3, i % 8], [kr, kc] = [king >> 3, king % 8];
    return r !== kr ? [-1, 0, 1].map((dc) => [Math.sign(kr - r), dc]) : c !== kc ? [[0, Math.sign(kc - c)]] : [];
  };
  const out = new Set();
  for (const [dr, dc] of steps(origin)) {
    const [r, c] = [(origin >> 3) + dr, (origin % 8) + dc];
    if (r < 0 || r > 7 || c < 0 || c > 7 || !open(sq(r, c))) continue;
    out.add(sq(r, c));
    if (cavalry)
      for (const [dr2, dc2] of steps(sq(r, c))) {
        const [r2, c2] = [r + dr2, c + dc2];
        if (r2 >= 0 && r2 < 8 && c2 >= 0 && c2 < 8 && open(sq(r2, c2))) out.add(sq(r2, c2));
      }
  }
  return [...out].sort((x, y) => x - y);
}

const EXAMPLES = [
  [1, [3, 2], [0, 4], [], [[2, 1], [2, 2], [2, 3]]],
  [1, [1, 0], [0, 4], [], [[0, 0], [0, 1]]],
  [1, [1, 4], [0, 4], [], [[0, 3], [0, 5]]],
  [1, [0, 1], [0, 4], [], [[0, 2]]],
  [1, [0, 6], [0, 4], [], [[0, 5]]],
  [1, [0, 3], [0, 4], [], []],
  [1, [1, 6], [3, 4], [], [[2, 5], [2, 6], [2, 7]]],
  [1, [0, 0], [3, 4], [], [[1, 0], [1, 1]]],
  [-1, [4, 7], [7, 4], [], [[5, 6], [5, 7]]],
  [-1, [7, 0], [7, 4], [], [[7, 1]]],
  [2, [5, 0], [3, 4], [], [[4, 0], [4, 1], [3, 0], [3, 1], [3, 2]]],
  [2, [4, 4], [3, 6], [], [[3, 3], [3, 4], [3, 5]]],
  [2, [3, 0], [3, 4], [], [[3, 1], [3, 2]]],
  [2, [3, 2], [3, 4], [], [[3, 3]]],
  [2, [1, 4], [3, 4], [], [[2, 3], [2, 4], [2, 5], [3, 2], [3, 3], [3, 5], [3, 6]]],
  [2, [5, 0], [3, 4], [[sq(4, 1), [1, 1]], [sq(4, 0), [-3]]], []],
  [2, [5, 0], [3, 4], [[sq(4, 1), [1]]], [[4, 0], [4, 1], [3, 0], [3, 1], [3, 2]]],
];

test("worked examples: movement toward the enemy King's row", () => {
  EXAMPLES.forEach(([unit, [r, c], king, extra, expected], n) => {
    const owner = Math.sign(unit) || (n < 9 ? 1 : -1);
    const code = Math.abs(unit);
    const own = owner === 1 ? [7, 7] : [0, 7];
    const s = setup([[sq(r, c), [owner * code]], [sq(...king), [-owner * 6]], [sq(...own), [owner * 6]], ...extra], owner);
    assert.deepEqual(quiet(s, sq(r, c)), cells(...expected), `example ${n + 1}`);
  });
});

test("the enemy King's square is attackable, never a quiet destination", () => {
  const s = setup([[sq(1, 4), [1]], [sq(0, 4), [-6]], [63, [6]]]);
  assert(has(s, [1, 4, 0, 0, 4, 1]));
  assert(!has(s, [1, 4, 0, 0, 4, 0]));
});

test("the opening position offers 52 orders per side and matches the reference", () => {
  const s = initialState();
  for (const turn of [1, -1]) {
    const state = { ...s, turn };
    const legal = legalActions(state);
    assert.equal(legal.length, 52);
    assert(legal.every((m) => m[5] === 0));
    const king = state.board.findIndex((q) => q.includes(-turn * 6));
    const occupancy = new Map(state.board.map((q, i) => [i, q.length ? [Math.sign(q[0]), q.length] : null]).filter(([, v]) => v));
    let expected = [];
    state.board.forEach((q, i) => {
      if (q.length === 1 && Math.sign(q[0]) === turn && Math.abs(q[0]) !== 6)
        expected.push(...reference(i, king, turn, occupancy, Math.abs(q[0]) === 2).map((to) => `${i}>${to}`));
    });
    const actual = legal.filter((m) => Math.abs(state.board[m[0] * 8 + m[1]][m[2]]) !== 6).map((m) => `${m[0] * 8 + m[1]}>${m[3] * 8 + m[4]}`);
    assert.deepEqual(actual.sort(), expected.sort());
  }
});

test("random positions: quiet moves match the independent reference", () => {
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const pick = (list) => list[Math.floor(rnd() * list.length)];
  let checked = 0;
  for (let n = 0; n < 600; n++) {
    const owner = pick([1, -1]);
    const squares = [];
    while (squares.length < 10) { const i = Math.floor(rnd() * 64); if (!squares.includes(i)) squares.push(i); }
    const [king, origin, ...rest] = squares;
    const code = pick([1, 2, 3, 4]);
    const units = [[origin, [owner * code]], [king, [-owner * 6]]];
    const occupancy = new Map([[origin, [owner, 1]], [king, [-owner, 1]]]);
    for (const i of rest.slice(0, 5)) {
      const [who, stack] = pick([[owner, [owner]], [owner, [owner, owner]], [-owner, [-owner]], [-owner, [-owner, -3]]]);
      units.push([i, stack]);
      occupancy.set(i, [who, stack.length]);
    }
    const free = rest.slice(5);
    units.push([free[0], [owner * 6]], [free[1], [owner]]);
    let s;
    try { s = setup(units, owner); } catch { continue; }
    if (s.winner !== null || s.board[origin].join() !== String(owner * code)) continue;
    const occ = new Map(s.board.map((q, i) => [i, q.length ? [Math.sign(q[0]), q.length] : null]).filter(([, v]) => v));
    assert.deepEqual(quiet(s, origin), reference(origin, king, owner, occ, code === 2), JSON.stringify(units));
    checked++;
  }
  assert(checked > 300);
});

test("quiet moves: every unit square against every enemy King square, both owners and classes", () => {
  const { unfilteredActions } = engineModule;
  let checked = 0;
  for (const owner of [1, -1]) for (const unit of [1, 2]) {
    const ownKing = owner === 1 ? 63 : 7;
    for (let origin = 0; origin < 64; origin++) for (let king = 0; king < 64; king++) {
      if (origin === king || origin === ownKing || king === ownKing) continue;
      const board = Array.from({ length: 64 }, () => []);
      board[origin] = [owner * unit]; board[king] = [-owner * 6]; board[ownKing] = [owner * 6];
      const state = { ...initialState(), board, layout: board.map(() => -1), turn: owner, winner: null, counts: {} };
      const occupancy = new Map([[origin, [owner, 1]], [king, [-owner, 1]], [ownKing, [owner, 1]]]);
      const got = unfilteredActions(state)
        .filter((m) => m[0] * 8 + m[1] === origin && m[2] === 0 && m[5] === 0)
        .map((m) => m[3] * 8 + m[4]).sort((x, y) => x - y);
      assert.deepEqual(got, reference(origin, king, owner, occupancy, unit === 2), `${owner} ${unit} ${origin} ${king}`);
      checked++;
    }
  }
  assert.equal(checked, 4 * 63 * 62);
});

test("removed permissions: enemy-half sidestep, back-rank freedom, frontal sidestep, backward steps", () => {
  assert.deepEqual(quiet(setup([[sq(2, 3), [1]], [sq(0, 4), [-6]], [63, [6]]]), sq(2, 3)), cells([1, 2], [1, 3], [1, 4]));
  assert.deepEqual(quiet(setup([[sq(0, 1), [1]], [sq(0, 4), [-6]], [63, [6]]]), sq(0, 1)), cells([0, 2]));
  assert.deepEqual(quiet(setup([[sq(5, 3), [4]], [sq(4, 3), [-1]], [sq(0, 4), [-6]], [63, [6]]]), sq(5, 3)), cells([4, 2], [4, 4]));
});

test("the reference row follows the enemy King", () => {
  const at = (k) => quiet(setup([[sq(2, 2), [1]], [sq(...k), [-6]], [63, [6]]]), sq(2, 2));
  assert.deepEqual(at([0, 4]), cells([1, 1], [1, 2], [1, 3]));
  assert.deepEqual(at([2, 4]), cells([2, 3]));
  assert.deepEqual(at([3, 4]), cells([3, 1], [3, 2], [3, 3]));
});

test("a capture may carry a unit away from the reference row", () => {
  let s = setup([[sq(2, 3), [1]], [sq(3, 3), [-3]], [sq(0, 5), [-6]], [sq(0, 0), [-1]], [63, [6]]]);
  s = transition(s, a(sq(2, 3), sq(3, 3), 1)).state;
  s.turn = 1;
  assert.deepEqual(quiet(s, sq(3, 3)), cells([2, 2], [2, 3], [2, 4]));
});

test("Priestess contact step and King peril are unchanged; the King ignores the reference row", () => {
  assert.deepEqual(quiet(setup([[sq(4, 3), [5]], [sq(0, 4), [-6]], [63, [6]]]), sq(4, 3)), cells([3, 2], [3, 3], [3, 4]));
  const touched = quiet(setup([[sq(4, 3), [5]], [sq(5, 4), [-1]], [sq(0, 4), [-6]], [63, [6]]]), sq(4, 3));
  assert.deepEqual(touched, cells([3, 2], [3, 3], [3, 4], [4, 2], [4, 4], [5, 2], [5, 3]));
  assert.deepEqual(quiet(setup([[sq(4, 3), [6]], [sq(4, 6), [-6]], [sq(0, 0), [-1]], [sq(7, 0), [1]]]), sq(4, 3)), cells([3, 2], [3, 3], [3, 4]));
});

// ----------------------------------------------------------------------- Warp
const WARP = [[sq(4, 3), [5]], [sq(7, 4), [6]], [sq(7, 0), [1]], [sq(3, 3), [-1]], [sq(3, 4), [-4]],
  [sq(4, 2), [-1, -1]], [sq(0, 4), [-6]], [sq(0, 0), [-3]]];

test("spec Warp example: 112 legal Warps, formations immune", () => {
  const s = setup(WARP);
  const warps = legalActions(s).filter((m) => m[5] === 3);
  assert.equal(warps.length, 112);
  assert.deepEqual([...new Set(warps.map((m) => m[0] * 8 + m[1]))].sort((x, y) => x - y), [sq(3, 3), sq(3, 4)]);
  assert(warps.every((m) => m[2] === 0 && !s.board[m[3] * 8 + m[4]].length));
  const out = transition(s, [3, 4, 0, 0, 7, 3]);
  assert.deepEqual(out.state.board[sq(3, 4)], []);
  assert.deepEqual(out.state.board[sq(0, 7)], [-4]);
  assert.equal(out.state.turn, -1);
  assert.deepEqual(quiet(out.state, sq(0, 7)), cells([1, 6], [1, 7]));
  assert.deepEqual(out.event.warped, -4);
  assert.deepEqual(out.event.losses, []);
  assert.equal(out.event.priestess, sq(4, 3));
});

test("Warp targets: not Kings, stacks, friends or distant units; occupied squares are no destination", () => {
  for (const [target, at] of [[[-6], sq(3, 3)], [[-1, -1], sq(3, 3)], [[-2, -3], sq(3, 3)], [[1], sq(3, 3)], [[-4], sq(2, 3)]]) {
    const s = setup([[sq(4, 3), [5]], [at, target], ...(target[0] === -6 ? [] : [[sq(0, 7), [-6]]]), [63, [6]]]);
    assert(!legalActions(s).some((m) => m[5] === 3 && m[0] * 8 + m[1] === at), JSON.stringify(target));
  }
  const s = setup([[sq(4, 3), [5]], [sq(3, 3), [-4]], [sq(3, 5), [-1]], [sq(6, 6), [1]], [sq(0, 7), [-6]], [63, [6]]]);
  const destinations = new Set(legalActions(s).filter((m) => m[5] === 3).map((m) => m[3] * 8 + m[4]));
  for (const blocked of [sq(3, 5), sq(6, 6), sq(3, 3)]) assert(!destinations.has(blocked));
});

test("Warp from either subcell, including the King's escort", () => {
  for (const pair of [[5, 1], [1, 5], [5, 6], [6, 5]]) {
    const units = [[sq(4, 3), pair], [sq(3, 3), [-3]], [sq(0, 7), [-6]], [sq(0, 0), [-1]]];
    if (!pair.includes(6)) units.push([63, [6]]);
    const s = setup(units);
    assert(legalActions(s).some((m) => m[5] === 3 && m[0] === 3 && m[1] === 3), pair.join());
    const next = transition(s, legalActions(s).find((m) => m[5] === 3 && m[0] === 3 && m[1] === 3)).state;
    assert.deepEqual(next.board[sq(4, 3)], pair);
    assert.deepEqual(next.board[sq(3, 3)], []);
  }
});

test("Warp resets only the warper's King streaks and costs no unit", () => {
  const board = setup(WARP);
  const s = studyState(board.board, 1, [1, 2], null, [], [2, 3]);
  const next = transition(s, [3, 4, 0, 0, 7, 3]).state;
  assert.deepEqual(next.kingMoves, [0, 3]);
  assert.deepEqual(next.retreats, [0, 2]);
});

test("Warp does not bind the minimal-loss rule and keeps the side out of stagnation", () => {
  const s = setup(WARP);
  assert(legalOrders(s).some((m) => m[5] === 3));
  const next = transition(s, [3, 3, 0, 6, 0, 3]).state;
  validateState(next);
  assert.notEqual(positionKey(s), positionKey(next));
});

test("a warped unit near a King puts that King in peril", () => {
  let s = setup([[sq(4, 3), [5]], [sq(3, 3), [-4]], [sq(6, 5), [6]], [sq(0, 7), [-6]], [sq(7, 0), [1]], [sq(0, 0), [-1]]]);
  assert(!has(s, [6, 5, 0, 7, 5, 0]));
  s = transition(s, [3, 3, 0, 7, 6, 3]).state;
  s.turn = 1;
  assert(has(s, [6, 5, 0, 7, 5, 0]));
});

test("Warp repeats: a four-order cycle draws on the third occurrence", () => {
  let s = setup([[sq(4, 3), [5]], [sq(3, 3), [-4]], [sq(1, 3), [-5]], [sq(2, 3), [4]], [sq(0, 7), [-6]], [sq(7, 7), [6]], [sq(7, 0), [1]], [sq(0, 0), [-1]]]);
  const cycle = [[3, 3, 0, 3, 2, 3], [2, 3, 0, 2, 2, 3], [3, 2, 0, 3, 3, 3], [2, 2, 0, 2, 3, 3]];
  for (const m of [...cycle, ...cycle.slice(0, 3)]) { s = transition(s, m).state; assert.equal(s.winner, null); }
  s = transition(s, cycle[3]).state;
  assert.equal(s.winner, 0);
  assert.equal(s.reason, "threefold_repetition");
});

test("the browser search keeps only a few Warp destinations per target", () => {
  const s = setup(WARP);
  const capped = capWarps(s, legalOrders(s));
  const warps = capped.filter((m) => m[5] === 3);
  assert.equal(warps.length, 6);
  // North's King is on row 7, so the exile squares are on the far row 0 (rank 8 is row 0).
  assert(warps.every((m) => m[3] === 0));
  assert.equal(new Set(warps.filter((m) => m[0] === 3 && m[1] === 3).map((m) => m[4])).size, 3);
});

test("rules metadata and state have no veteran or conversion left", () => {
  assert.equal(RULES.version, 6);
  assert.equal(RULES.advance_reference, "enemy_king_row");
  assert.deepEqual(RULES.pieces.Q.abilities.map((x) => x.name), ["warp"]);
  assert.equal("veteran" in initialState(), false);
});
