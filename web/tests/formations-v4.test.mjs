import test from "node:test";
import assert from "node:assert/strict";
import { studyState, initialState, transition, legalActions, legalOrders,
  validateState, positionKey, isPreparation, resolveCombat } from "../src/engine.mjs";
import { planPreparations } from "../src/ai.mjs";
import { createRecord, readRecord } from "../src/records.mjs";

const action = (from, to, kind = 0, slot = 0) => [from >> 3, from % 8, slot, to >> 3, to % 8, kind];
const has = (s, a) => legalActions(s).some(m => m.join() === a.join());
const setup = (units, turn = 1) => {
  const board = Array.from({ length: 64 }, () => []);
  board[63] = [6]; board[0] = [-6]; board[7] = [-1]; board[56] = [1];
  for (const [i, sq] of units) board[i] = sq;
  return studyState(board, turn);
};
const directions = [[1,-1,-1],[2,-1,0],[3,-1,1],[4,0,-1],[6,0,1],[7,1,-1],[8,1,0],[9,1,1]];
const wins = new Set(["12", "13", "23", "24", "41", "43"]);

test("every ordinary formation duel preserves counters and matching-class geometry", () => {
  let cases = 0;
  for (const owner of [1, -1]) for (const [sector, dr, dc] of directions)
    for (const layout of [0, 2]) for (let actor = 1; actor <= 4; actor++)
      for (let defender = 1; defender <= 4; defender++) {
        const result = resolveCombat(-owner * actor, [owner * defender, owner * defender],
          (3 + dr * owner) * 8 + 3 + dc * owner, 27, layout);
        if (actor !== defender) {
          const win = wins.has(`${actor}${defender}`);
          assert.deepEqual([result.alive, ...result.survive], [win, !win, !win]);
        } else {
          assert.equal(result.alive, layout === 0 ? [4,6].includes(sector) : sector === 8);
          const survivors = layout === 0 ? sector === 2 ? 2 : [4,6].includes(sector) ? 0 : 1
            : [1,2,3].includes(sector) ? 2 : sector === 8 ? 0 : 1;
          assert.equal(result.survive.filter(Boolean).length, survivors);
        }
        cases++;
      }
  assert.equal(cases, 512);
});

test("mixed-class counter defenders survive every arrangement and attack direction", () => {
  let cases = 0;
  for (const owner of [1,-1]) for (const [, dr, dc] of directions)
    for (let layout = 0; layout < 4; layout++) for (let actor = 1; actor <= 4; actor++)
      for (let a = 1; a <= 4; a++) for (let b = 1; b <= 4; b++) {
        if (a === b) continue;
        const result = resolveCombat(-owner * actor, [owner * a, owner * b],
          (3 + dr * owner) * 8 + 3 + dc * owner, 27, layout);
        [a,b].forEach((d, i) => {
          if (wins.has(`${d}${actor}`)) { assert(!result.alive); assert(result.survive[i]); }
        });
        if (wins.has(`${actor}${a}`) && wins.has(`${actor}${b}`)) {
          assert(result.alive); assert(!result.survive.some(Boolean));
        }
        cases++;
      }
  assert.equal(cases, 3072);
});

test("three distinct rearrangements precede one normal order without altering retreat or repetition", () => {
  let s = setup([[40,[1,2]],[41,[1,3]],[42,[1,4]],[43,[2,3]]]);
  s.retreats[0] = 2;
  const counts = structuredClone(s.counts);
  for (let i = 0; i < 3; i++) {
    s = transition(s, action(40+i,40+i,6)).state;
    assert.equal(s.turn, 1); assert.equal(s.ply, 0);
    assert.deepEqual(s.retreats, [2,0]); assert.deepEqual(s.counts, counts);
    assert.equal(s.prepared.length, i+1);
  }
  assert(!legalActions(s).some(a => isPreparation(a[5])));
  const before = structuredClone(s);
  for (const a of [action(40,40,7), action(43,43,6), action(42,42,6,1)])
    assert.throws(() => transition(s,a));
  assert.deepEqual(s,before);
  s = transition(s,action(40,32)).state;
  assert.equal(s.turn,-1); assert.equal(s.ply,1); assert.deepEqual(s.prepared,[]);
  assert.deepEqual(s.retreats,[0,0]); assert.equal(s.layout[40],-1);
  validateState(s);
});

test("ranged fire chooses the exposed A or B, screens block, and return fire removes the actual members", () => {
  let s = setup([[43,[-3]],[27,[4,3]]],-1);
  assert(has(s,action(43,27,8))); assert(!has(s,action(43,27,2)));
  let out = transition(s,action(43,27,8));
  assert.equal(out.event.targetSlot,1);
  assert.deepEqual(out.state.board[27],[4]); assert.deepEqual(out.state.board[43],[]);
  assert.equal(out.state.layout[27],-1);
  s = setup([[11,[-3]],[27,[4,3]]],-1);
  assert(!has(s,action(11,27,2))); assert(!has(s,action(11,27,8)));
  s = setup([[25,[-3]],[27,[1,3]]],-1);
  assert(has(s,action(25,27,2))); assert(has(s,action(25,27,8)));
  out = transition(s,action(25,27,2));
  assert.deepEqual(out.state.board[27],[3]); assert.deepEqual(out.state.board[25],[-3]);
});

test("a physically exposed Commander loses before a reserve can engage", () => {
  const s = setup([[63,[]],[27,[1,6]],[35,[-2]]],-1);
  const out = transition(s,action(35,27,1));
  assert.equal(out.state.winner,-1);
  assert.deepEqual(out.state.board[27],[1]);
  assert.deepEqual(out.state.board[35],[-2]);
  assert.equal(out.event.formation.waves.length,1);
});

test("physical repetition ignores equivalent A/B labels and identical-class swaps", () => {
  const s = setup([[35,[1,2]]]);
  const other = structuredClone(s); other.board[35].reverse(); other.layout[35]=1;
  assert.equal(positionKey(s),positionKey(other));
  other.layout[35]=2; assert.notEqual(positionKey(s),positionKey(other));
  const same = setup([[35,[1,1]]]);
  assert(!legalActions(same).some(a => [5,7].includes(a[5])));
  assert.throws(() => validateState({...s, prepared:[35,35]}));
});

test("AI preparation protects a formation while preserving its chosen normal order", () => {
  let s = setup([[35,[1,2]],[43,[-2]],[54,[1]]]);
  const order = action(54,46), preparations = planPreparations(s,order);
  assert(preparations.length > 0 && preparations.length <= 3);
  for (const prep of preparations) { assert(has(s,prep)); s=transition(s,prep).state; }
  assert(legalOrders(s).some(a=>a.join()===order.join()));
  const after = transition(s,order).state;
  const attack = transition(after,action(43,35,1)).state;
  assert.deepEqual(attack.board[35],[1,2]);
});

test("partial preparation saves restore the same turn, budget, arrangements and history", () => {
  const moves = [action(57,50), action(8,16), action(50,50,6)];
  let s=initialState(); for (const a of moves) s=transition(s,a).state;
  assert.equal(s.ply,2); assert.deepEqual(s.prepared,[50]);
  const record=createRecord(moves,{mode:"local",difficulty:"knight",humanSide:1});
  assert.deepEqual(readRecord(JSON.stringify(record)).state,s);
  assert.throws(()=>readRecord(JSON.stringify({...record,rules:3})),/older ruleset/);
  assert.throws(()=>readRecord(JSON.stringify({...record,moves:[...moves,action(50,50,7)]})));
});
