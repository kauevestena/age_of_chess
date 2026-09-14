import test from "node:test";
import assert from "node:assert/strict";
import {
  studyState,
  initialState,
  legalActions,
  transition,
  attackSector,
  positionKey,
  cloneState,
  validateState,
} from "../src/engine.mjs";
import { createRecord, readRecord, stateAt } from "../src/records.mjs";
const a = (from, to, kind = 0, slot = 0) => [
  Math.floor(from / 8),
  from % 8,
  slot,
  Math.floor(to / 8),
  to % 8,
  kind,
];
const has = (s, m) => legalActions(s).some((x) => x.join() === m.join());
function setup(units, turn = 1, retreats = [0, 0]) {
  const b = Array.from({ length: 64 }, () => []);
  b[63] = [6];
  b[0] = [-6];
  b[62] = [1];
  b[1] = [-1];
  for (const [i, s] of units) b[i] = s;
  return studyState(b, turn, retreats);
}
const sectors = [
  [1, -1, -1],
  [2, -1, 0],
  [3, -1, 1],
  [4, 0, -1],
  [6, 0, 1],
  [7, 1, -1],
  [8, 1, 0],
  [9, 1, 1],
];
test("guarded stance: all sectors, ordinary classes, owners and formation slots", () => {
  for (const defender of [1, -1])
    for (const [sector, dr, dc] of sectors)
      for (const code of [1, 2, 3, 4])
        for (const slot of [0, 1])
          for (const formation of [false, true]) {
            const from = (3 + dr * defender) * 8 + 3 + dc * defender,
              to = 27,
              actor = -defender * code;
            const source = slot ? [-defender, actor] : [actor],
              target = formation
                ? [defender * code, defender]
                : [defender * code];
            const s = setup(
              [
                [from, source],
                [to, target],
              ],
              -defender,
            );
            const { state, event } = transition(s, a(from, to, 1, slot));
            const alive = [4, 6, 7, 8, 9].includes(sector);
            assert.equal(attackSector(from, to, defender), sector);
            assert.equal(event.stance, true);
            assert.equal(event.approach, sector);
            assert.deepEqual(
              state.board[to],
              sector === 2
                ? target
                : formation
                  ? [defender]
                  : alive
                    ? [actor]
                    : [],
            );
            assert.deepEqual(
              state.board[from],
              alive && formation ? source : slot ? [-defender] : [],
            );
            assert.equal(event.moved, alive && !formation);
          }
});
test("home-half frontal evasion: empty and single ally allowed, full cell blocked", () => {
  for (const owner of [1, -1])
    for (const code of [1, 2, 3, 4])
      for (const slot of [0, 1]) {
        const from = owner === 1 ? 43 : 19,
          front = from - owner * 8;
        const source = slot ? [owner, owner * code] : [owner * code];
        let s = setup(
          [
            [from, source],
            [front, [-owner]],
            [from - 1, [owner]],
            [from + 1, [owner, owner]],
          ],
          owner,
        );
        assert(has(s, a(from, from - 1, 0, slot)));
        assert(!has(s, a(from, from + 1, 0, slot)));
        s = setup(
          [
            [from, source],
            [front - 1, [-owner]],
          ],
          owner,
        );
        assert(!has(s, a(from, from + 1, 0, slot)));
        s = setup(
          [
            [from, source],
            [front, [-owner]],
          ],
          owner,
        );
        assert(has(s, a(from, from + 1, 0, slot)));
        assert(!has(s, a(from, from + 2, 0, slot)));
      }
});
test("Cavalry passes a single ally atomically, with unique paths blocked by full cells or enemies", () => {
  for (const mid of [[], [1], [1, 1], [-1]])
    for (const target of [[], [1], [-3]]) {
      const s = setup([
          [42, [1, 2]],
          [35, mid],
          [28, target],
        ]),
        action = a(42, 28, target[0] < 0 ? 1 : 0, 1);
      const allowed = mid.length < 2 && mid[0] !== -1;
      assert.equal(has(s, action), allowed);
      if (allowed) {
        const { state } = transition(s, action);
        assert.deepEqual(state.board[35], mid);
        assert.deepEqual(state.board[42], [1]);
        assert.deepEqual(state.board[28], target[0] === 1 ? [1, 2] : [2]);
        assert.equal(state.ply, 1);
      }
    }
  const s = setup([
    [43, [2]],
    [35, [1, 1]],
    [27, [-2]],
  ]);
  assert.equal(transition(s, a(43, 27, 1)).event.approach, 2);
  const rear = setup([
    [27, [2]],
    [36, [1]],
    [45, [-3]],
  ]);
  assert(has(rear, a(27, 45, 1)));
  assert(!has(rear, a(27, 41, 0)));
});
test("ranged return fire removes actual shooter from either slot along all eight rays", () => {
  for (const owner of [1, -1])
    for (const [, dr, dc] of sectors)
      for (const slot of [0, 1]) {
        const to = (3 + dr * 2) * 8 + 3 + dc * 2;
        const s = setup(
          [
            [27, slot ? [owner, owner * 3] : [owner * 3, owner]],
            [to, [-owner * 3, -owner]],
          ],
          owner,
        );
        const { state, event } = transition(s, a(27, to, 2, slot));
        assert(event.returnFire);
        assert.deepEqual(state.board[27], [owner]);
        assert.deepEqual(state.board[to], [-owner]);
        assert.deepEqual(
          event.losses.map((l) => l.cause),
          ["ranged", "return_fire"],
        );
      }
});
test("three Commander retreats forfeit; opponent turns preserve the streak", () => {
  let s = setup([
    [63, []],
    [19, [6]],
    [21, [-1]],
  ]);
  const orders = [a(19, 27), a(21, 29), a(27, 35), a(29, 37), a(35, 43)];
  orders.forEach((m, i) => {
    s = transition(s, m).state;
    assert.equal(s.retreats[0], Math.floor(i / 2) + 1);
    assert.equal(s.winner, i === 4 ? -1 : null);
  });
  assert.equal(s.reason, "commander_retreat_forfeit");
});
test("non-retreat orders reset counts; stationary melee and capture have correct precedence", () => {
  for (const action of [a(27, 26), a(27, 19), a(62, 54)]) {
    const s = setup(
      [
        [63, []],
        [27, [6]],
        [36, [-3]],
      ],
      1,
      [2, 0],
    );
    assert.equal(transition(s, action).state.retreats[0], 0);
  }
  let s = setup(
    [
      [63, []],
      [27, [1, 6]],
      [36, [-3, -1]],
    ],
    1,
    [2, 0],
  );
  let out = transition(s, a(27, 36, 1, 1));
  assert.equal(out.state.retreats[0], 0);
  assert.equal(out.event.moved, false);
  s = setup(
    [
      [63, []],
      [27, [6]],
      [36, [-3]],
    ],
    1,
    [2, 0],
  );
  assert.equal(
    transition(s, a(27, 36, 1)).state.reason,
    "commander_retreat_forfeit",
  );
  s = setup(
    [
      [63, []],
      [0, []],
      [27, [6]],
      [36, [-6, -1]],
    ],
    1,
    [2, 0],
  );
  out = transition(s, a(27, 36, 1));
  assert.equal(out.state.winner, 1);
  assert.equal(out.state.reason, "commander_capture");
});
test("last supporting units trigger lone-Commander losses or simultaneous draw", () => {
  for (const [actor, target, kind, winner] of [
    [1, 3, 1, 1],
    [5, 4, 3, 1],
    [3, 3, 2, 0],
  ]) {
    const s = setup([
      [62, []],
      [1, []],
      [36, [actor]],
      [28, [-target]],
    ]);
    const out = transition(s, a(36, 28, kind)).state;
    assert.equal(out.winner, winner);
    assert.equal(
      out.reason,
      winner ? "lone_commander" : "both_commanders_alone",
    );
  }
  assert.equal(setup([[62, []]]).reason, "lone_commander");
  assert.equal(
    setup([
      [62, []],
      [1, []],
    ]).reason,
    "both_commanders_alone",
  );
  const s = setup([
    [62, []],
    [1, []],
    [44, [5]],
    [28, [-5]],
  ]);
  assert.equal(transition(s, a(44, 36)).state.reason, "both_commanders_alone");
});
test("retreat counts survive save/replay/undo; old rules cannot be silently reinterpreted", () => {
  const moves = [
    a(52, 44),
    a(12, 20),
    a(60, 52),
    a(20, 28),
    a(52, 44),
    a(28, 36),
    a(44, 52, 0, 1),
  ];
  let s = initialState();
  for (const m of moves) s = transition(s, m).state;
  assert.deepEqual(s.retreats, [1, 0]);
  const config = { mode: "local", difficulty: "knight", humanSide: 1 };
  const record = createRecord(moves, config),
    loaded = readRecord(JSON.stringify(record));
  assert.deepEqual(loaded.state, s);
  assert.deepEqual(stateAt(moves, 6).retreats, [0, 0]);
  assert.deepEqual(stateAt(moves, 7), s);
  assert.throws(
    () => readRecord(JSON.stringify({ ...record, rules: 2 })),
    /new battle/,
  );
  const clone = cloneState(s);
  clone.retreats[0] = 0;
  assert.notEqual(positionKey(clone), positionKey(s));
  for (const retreats of [[-1, 0], [0, 4], [3, 3], [false, 0], []])
    assert.throws(() => validateState({ ...s, retreats }));
  const before = JSON.stringify(s);
  assert.throws(() => transition(s, a(52, 60)));
  assert.equal(JSON.stringify(s), before);
});
