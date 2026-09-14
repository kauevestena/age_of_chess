import test from "node:test";
import assert from "node:assert/strict";
import {
  initialState,
  studyState,
  transition,
  legalActions,
  melee,
  cloneState,
  positionKey,
  validateState,
} from "../src/engine.mjs";
import { createRecord, readRecord, stateAt } from "../src/records.mjs";
import { chooseAction } from "../src/ai.mjs";
import { LESSONS } from "../src/tutorial.mjs";
const setup = (units, turn = 1) => {
  const b = Array.from({ length: 64 }, () => []);
  b[63] = [6];
  b[0] = [-6];
  for (const [i, s] of units) b[i] = s;
  for (const owner of [1, -1])
    if (b.flat().filter((u) => Math.sign(u) === owner).length === 1) {
      const back = owner === 1 ? 56 : 0;
      const i = Array.from({ length: 8 }, (_, c) => back + 7 - c).find(
        (i) => !b[i].length,
      );
      b[i] = [owner];
    }
  return studyState(b, turn);
};
const a = (i, j, kind = 0, slot = 0) => [
  Math.floor(i / 8),
  i % 8,
  slot,
  Math.floor(j / 8),
  j % 8,
  kind,
];
const has = (s, m) => legalActions(s).some((x) => x.join() === m.join());

test("spectator saves preserve independent AI levels and full move history", () => {
  const actions = [],
    config = {
      mode: "watch",
      difficulty: "knight",
      humanSide: 1,
      northDifficulty: "squire",
      southDifficulty: "marshal",
    };
  let state = initialState();
  for (let i = 0; i < 8; i++) {
    const action = legalActions(state)[0];
    actions.push(action);
    state = transition(state, action).state;
  }
  const loaded = readRecord(JSON.stringify(createRecord(actions, config)));
  assert.deepEqual(loaded.record.config, config);
  assert.deepEqual(loaded.state, state);
  assert.equal(loaded.events.length, actions.length);
});

test("spectator imports reject invalid commanders and human resignation", () => {
  const config = {
    mode: "watch",
    difficulty: "knight",
    humanSide: 1,
    northDifficulty: "squire",
    southDifficulty: "marshal",
  };
  for (const change of [
    { northDifficulty: undefined },
    { southDifficulty: "expert" },
  ])
    assert.throws(() =>
      readRecord(JSON.stringify(createRecord([], { ...config, ...change }))),
    );
  assert.throws(() => readRecord(JSON.stringify(createRecord([], config, 1))));
  // Existing solo and local records remain valid without either new field.
  for (const mode of ["solo", "local"])
    assert.equal(
      readRecord(
        JSON.stringify(
          createRecord([], { mode, difficulty: "knight", humanSide: 1 }),
        ),
      ).record.config.mode,
      mode,
    );
});

test("Pikemen beat Archers in either melee direction; arrows beat Pikemen", () => {
  assert.deepEqual(melee(1, -3), [true, false, false]);
  assert.deepEqual(melee(3, -1), [false, true, false]);
  const s = setup([
    [36, [3]],
    [28, [-1]],
  ]);
  const shot = transition(s, a(36, 28, 2));
  assert.deepEqual(shot.state.board[36], [3]);
  assert.deepEqual(shot.state.board[28], []);
});
test("class counters apply to both defenders and the acting member leaves its companion", () => {
  assert.deepEqual(melee(2, -3, -3, 36, 28), [true, false, false]);
  assert.deepEqual(melee(2, -4, -5, 36, 28), [true, false, false]);
  assert.deepEqual(melee(4, -1, -1, 36, 28), [true, false, false]);
  const s = setup([
    [36, [1, 4]],
    [28, [-3, -1]],
  ]);
  const out = transition(s, a(36, 28, 1, 1));
  assert.deepEqual(out.state.board[36], [1]);
  assert.deepEqual(out.state.board[28], [4]);
  validateState(out.state);
});
test("Cavalry passes single allies but cannot jump enemies or full formations", () => {
  const s = setup([
    [36, [2]],
    [27, [-1]],
    [28, [1, 1]],
    [29, [1, 1]],
  ]);
  assert(!has(s, a(36, 20)));
  assert(has(s, a(36, 27, 1)));
  const clear = setup([[36, [2]]]);
  assert(has(clear, a(36, 18)));
  assert(!has(clear, a(36, 34)));
});
test("ranged rays stop at a friendly unit; power shot retains stack order", () => {
  const blocked = setup([
    [36, [3]],
    [28, [1]],
    [20, [-1]],
  ]);
  assert(!has(blocked, a(36, 20, 2)));
  const s = setup([
    [36, [3, 3]],
    [20, [-4, -6]],
    [0, []],
  ]);
  const shot = transition(s, a(36, 20, 2, 1));
  assert.deepEqual(shot.state.board[36], [3, 3]);
  assert.deepEqual(shot.state.board[20], [-6]);
  assert.equal(shot.state.winner, 1);
  assert.equal(shot.state.reason, "lone_commander");
  assert(!has(shot.state, a(36, 20, 2)));
});
test("conversion is solitary and changes direction without moving the Priestess", () => {
  const s = setup([
    [36, [1, 5]],
    [35, [-2]],
    [28, [-3, -1]],
  ]);
  assert(!has(s, a(36, 28, 3, 1)));
  const out = transition(s, a(36, 35, 3, 1));
  assert.deepEqual(out.state.board[36], [1, 5]);
  assert.deepEqual(out.state.board[35], [2]);
});
test("opposing Priestesses die simultaneously, including bottom slots", () => {
  const s = setup([
    [44, [5]],
    [28, [-1, -5]],
  ]);
  const out = transition(s, a(44, 36));
  assert.deepEqual(out.state.board[36], []);
  assert.deepEqual(out.state.board[28], [-1]);
  assert.equal(out.event.losses.length, 2);
});
test("Commander capture wins even when a bottom defender remains", () => {
  const s = setup([
    [36, [1]],
    [28, [-6, -3]],
    [0, []],
  ]);
  const out = transition(s, a(36, 28, 1));
  assert.equal(out.state.winner, 1);
  assert.deepEqual(out.state.board[36], [1]);
  assert.deepEqual(out.state.board[28], [-3]);
});
test("retreat triggers, enemy half and last rank have distinct permissions", () => {
  assert(
    !has(
      setup([
        [63, []],
        [19, [6]],
      ]),
      a(19, 18),
    ),
  );
  assert(
    has(
      setup([
        [63, []],
        [3, [6]],
      ]),
      a(3, 11),
    ),
  );
  assert(
    has(
      setup([
        [63, []],
        [19, [6]],
        [33, [-1]],
      ]),
      a(19, 18),
    ),
  );
  assert(has(setup([[19, [1]]]), a(19, 18)));
});
test("third exact position repeats as a draw, including side and stack order", () => {
  const s = setup([[19, [1]]]);
  const m = legalActions(s)[0];
  const n = transition(s, m).state;
  s.counts[positionKey(n)] = 2;
  const out = transition(s, m);
  assert.equal(out.state.winner, 0);
  assert.equal(out.state.reason, "threefold_repetition");
  assert.notEqual(positionKey(s), positionKey({ ...s, turn: -1 }));
});
test("invalid and malformed actions are rejected atomically", () => {
  const s = initialState(),
    before = JSON.stringify(s);
  for (const m of [
    [6, 0, 0, 0, 0, 0],
    ["6", 0, 0, 5, 0, 0],
    null,
    [],
    [6, 0, 0, 5, 0, 4],
    [6, 0, 2, 5, 0, 0],
  ])
    assert.throws(() => transition(s, m));
  assert.equal(JSON.stringify(s), before);
  assert.deepEqual(cloneState(s), s);
});
test("saved records reconstruct the board and repetition counts, rejecting tampering", () => {
  let s = initialState();
  const moves = [];
  for (let i = 0; i < 16; i++) {
    const m = legalActions(s)[i % legalActions(s).length];
    moves.push(m);
    s = transition(s, m).state;
  }
  const record = createRecord(moves, {
    mode: "solo",
    difficulty: "knight",
    humanSide: 1,
  });
  assert.deepEqual(readRecord(JSON.stringify(record)).state, s);
  assert.deepEqual(stateAt(moves, 16), s);
  assert.throws(() => readRecord(JSON.stringify({ ...record, rules: 1 })));
  assert.throws(() =>
    readRecord(JSON.stringify({ ...record, moves: [[0, 0, 0, 7, 7, 1]] })),
  );
});
test("all guided lessons have a legal intended action and correct final victory", () => {
  for (const lesson of LESSONS)
    assert(has(lesson.state(), lesson.action), lesson.title);
  assert.equal(
    transition(LESSONS.at(-1).state(), LESSONS.at(-1).action).state.winner,
    1,
  );
});
test("all AI levels return legal orders and seize an exposed Commander", () => {
  const s = setup([
    [36, [1]],
    [28, [-6]],
    [0, []],
  ]);
  for (const difficulty of ["squire", "knight", "marshal"]) {
    const result = chooseAction(s, difficulty, {
      random: () => 0.5,
      budgetMs: 200,
    });
    assert(has(s, result.action));
    assert.equal(transition(s, result.action).state.winner, 1);
  }
});
test("Knight sees an opponent reply and avoids losing its Commander", () => {
  const s = setup([
    [63, []],
    [44, [6]],
    [28, [-1]],
    [51, [1]],
  ]);
  const result = chooseAction(s, "knight", {
    budgetMs: 2000,
    random: () => 0.5,
  });
  const next = transition(s, result.action).state;
  assert(result.depth >= 2);
  assert(
    !legalActions(next).some((m) => transition(next, m).state.winner === -1),
  );
});
