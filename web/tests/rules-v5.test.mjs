import test from "node:test";
import assert from "node:assert/strict";
import { studyState, legalActions, transition, resolveCombat, positionKey, validateState, initialState } from "../src/engine.mjs";
import { createRecord, readRecord, stateAt } from "../src/records.mjs";
import { chooseAction } from "../src/ai.mjs";

const a=(from,to,kind=0,slot=0)=>[from>>3,from%8,slot,to>>3,to%8,kind];
const has=(s,m)=>legalActions(s).some(x=>x.join()===m.join());
const setup=(units,turn=1,kingMoves=[0,0],retreats=[0,0])=>{
  const board=Array.from({length:64},()=>[]);
  board[63]=[6];board[0]=[-6];board[62]=[1];board[1]=[-1];
  for(const [i,sq] of units) board[i]=sq;
  return studyState(board,turn,retreats,null,[],kingMoves);
};

test("every royal arrangement defends front and sacrifices only the matching flank escort",()=>{
  for(const owner of [1,-1]) for(const layout of [0,1,2,3]) for(const kingSlot of [0,1])
    for(const unit of [1,2,3,4]) for(const [dr,dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1]]) {
      const defenders=[unit*owner,unit*owner];defenders[kingSlot]=6*owner;
      const out=resolveCombat(-unit*owner,defenders,(3+dr*owner)*8+3+dc*owner,27,layout);
      assert.equal(out.mode,"king_guard");assert.equal(out.alive,false);
      assert.equal(out.survive[kingSlot],true);assert.equal(out.survive[1-kingSlot],dr<0);
      assert.deepEqual(out.waves[0].slots,[1-kingSlot]);assert.equal(out.waves.length,1);
    }
});

test("counter beats royal escort; rear keeps physical King exposure",()=>{
  for(const layout of [0,1,2,3]) {
    const held=resolveCombat(-2,[1,6],26,27,layout);
    assert.deepEqual(held.survive,[true,true]);assert.equal(held.alive,false);
    const breached=resolveCombat(-4,[1,6],26,27,layout);
    assert.deepEqual(breached.survive,[false,false]);assert.equal(breached.alive,true);
    assert.equal(breached.waves.length,2);
  }
  assert.deepEqual(resolveCombat(-2,[1,6],35,27,0).survive,[true,false]);
  assert.deepEqual(resolveCombat(-2,[1,6],35,27,1).survive,[true,true]);
});

test("King never attacks or retreats without peril, even on the far rank",()=>{
  for(const target of [-1,-2,-3,-4,-5,-6]) assert.throws(()=>resolveCombat(6,[target],36,28));
  let s=setup([[63,[]],[3,[6]],[1,[]],[7,[-1]]]);
  assert(!has(s,a(3,11)));
  s=setup([[63,[]],[3,[6]],[1,[]],[7,[-1]],[17,[-1]]]);
  assert(has(s,a(3,11))); // One intervening diagonal cell.
  assert(!legalActions(s).some(m=>m[0]===0&&m[1]===3&&m[5]===1));
});

test("all Archer formations fire only one square; King is immune to arrows and Warp",()=>{
  for(const source of [[3],[3,3],[1,3],[3,6]]) {
    const units=[[36,source],[20,[-1]],[28,[-6]],[0,[]]];
    if(source.includes(6)) units.push([63,[]]);
    const s=setup(units);
    assert(!legalActions(s).some(m=>[2,8].includes(m[5])));
  }
  const s=setup([[36,[3,3]],[28,[-4]]]);
  assert(has(s,a(36,28,2,1)));
  assert(!has(setup([[36,[5]],[28,[-6]],[0,[]]]),a(36,28,3)));
});

test("reaching the far rank grants nothing permanent; identical classes stay interchangeable",()=>{
  let s=setup([[11,[1]]]);
  s=transition(s,a(11,3)).state;
  assert.equal("veteran" in s,false);
  s.turn=1;
  assert(!legalActions(s).some(m=>m[0]===0&&m[1]===3&&m[3]>0)); // No backward step.
  let t=setup([[19,[1]],[27,[1]]]);
  t=transition(t,a(27,19)).state;t.turn=1;
  assert(!has(t,a(19,19,5))); // Swapping identical Pikemen is not an action.
  assert(has(t,a(19,19,6)));
});

test("King streaks survive partial saves, replay and undo",()=>{
  // Cavalry joins a Pikeman (a formation to prepare later), then three King orders in a row.
  const moves=[a(57,49),a(9,17),a(60,52),a(10,18),a(52,44,0,1),a(11,19),a(44,36),a(12,20),a(49,49,6)];
  const record=createRecord(moves,{mode:"local",difficulty:"knight",humanSide:1});
  const {state}=readRecord(JSON.stringify(record));
  assert.deepEqual(state.kingMoves,[3,0]);assert.deepEqual(state.retreats,[0,0]);
  assert.deepEqual(state.prepared,[49]);
  const undo=stateAt(moves,moves.length-1);
  assert.deepEqual(undo.kingMoves,state.kingMoves);
  assert.equal(undo.prepared.length,0);
  const reset=transition(state,a(49,41)).state;
  assert.deepEqual(reset.kingMoves,[0,0]);assert.equal(reset.winner,null);
  const forfeit=transition(state,a(36,29)).state;
  assert.equal(forfeit.reason,"king_move_forfeit");assert.equal(forfeit.winner,-1);
  for(const rules of [3,4,5]) assert.throws(()=>readRecord(JSON.stringify({...record,rules})),/Rules v6/);
});

test("all AI levels avoid a fourth King move when another order is available",()=>{
  const s=setup([[63,[]],[44,[6]],[51,[1]]],1,[3,0]);
  for(const difficulty of ["squire","knight","marshal"]) {
    const result=chooseAction(s,difficulty,{budgetMs:200,random:()=>.5});
    assert(has(s,result.action));assert.notEqual(transition(s,result.action).state.winner,-1);
  }
  const initial=initialState();assert.deepEqual(initial.kingMoves,[0,0]);
  assert.equal("veteran" in initial,false);
});
