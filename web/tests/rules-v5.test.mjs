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
  return studyState(board,turn,retreats,null,[],null,kingMoves);
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

test("King never attacks or earns veteran retreat, even on the far rank",()=>{
  for(const target of [-1,-2,-3,-4,-5,-6]) assert.throws(()=>resolveCombat(6,[target],36,28));
  let s=setup([[63,[]],[3,[6]],[1,[]],[7,[-1]]]);
  assert(!has(s,a(3,11)));assert.equal(s.veteran[3][0],false);
  s=setup([[63,[]],[3,[6]],[1,[]],[7,[-1]],[17,[-1]]]);
  assert(has(s,a(3,11))); // One intervening diagonal cell.
  assert(!legalActions(s).some(m=>m[0]===0&&m[1]===3&&m[5]===1));
});

test("all Archer formations fire only one square; King is immune to arrows and conversion",()=>{
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

test("veterans retain individual movement and distinguish identical-class arrangements",()=>{
  let s=setup([[3,[1]],[11,[1]]]);
  s=transition(s,a(3,11)).state;
  assert.deepEqual(s.veteran[11],[false,true]);
  s.turn=1;
  assert(has(s,a(11,11,5)));
  const swapped=transition(s,a(11,11,5)).state;
  assert.notEqual(positionKey(s),positionKey(swapped));
  const next=transition(swapped,a(11,20,0,1)).state;
  assert.deepEqual(next.veteran[20],[true]);assert.deepEqual(next.veteran[11],[false]);
  next.turn=1;assert(has(next,a(20,29)));
  const invalid=structuredClone(next);invalid.veteran[63]=[true];
  assert.throws(()=>validateState(invalid));
});

test("King streaks and veteran abilities survive partial saves, replay and undo",()=>{
  const moves=[a(57,50),a(10,18),a(48,40),a(8,17),a(40,32),a(0,8),a(32,24),a(8,17),
    a(24,16),a(15,23),a(16,8),a(23,31),a(8,0),a(31,39),a(0,8),a(39,47),
    a(60,52),a(14,22),a(52,44,0,1),a(13,21),a(44,36),a(12,20),a(50,50,6)];
  const record=createRecord(moves,{mode:"local",difficulty:"knight",humanSide:1});
  const {state}=readRecord(JSON.stringify(record));
  assert.deepEqual(state.kingMoves,[3,0]);assert.deepEqual(state.retreats,[0,0]);
  assert.deepEqual(state.veteran[8],[true]);assert.deepEqual(state.prepared,[50]);
  const undo=stateAt(moves,moves.length-1);
  assert.deepEqual(undo.kingMoves,state.kingMoves);assert.deepEqual(undo.veteran,state.veteran);
  assert.equal(undo.prepared.length,0);
  const reset=transition(state,a(50,42)).state;
  assert.deepEqual(reset.kingMoves,[0,0]);assert.equal(reset.winner,null);
  const forfeit=transition(state,a(36,29)).state;
  assert.equal(forfeit.reason,"king_move_forfeit");assert.equal(forfeit.winner,-1);
  for(const rules of [3,4]) assert.throws(()=>readRecord(JSON.stringify({...record,rules})),/Rules v5/);
});

test("all AI levels avoid a fourth King move when another order is available",()=>{
  const s=setup([[63,[]],[44,[6]],[51,[1]]],1,[3,0]);
  for(const difficulty of ["squire","knight","marshal"]) {
    const result=chooseAction(s,difficulty,{budgetMs:200,random:()=>.5});
    assert(has(s,result.action));assert.notEqual(transition(s,result.action).state.winner,-1);
  }
  const initial=initialState();assert.deepEqual(initial.kingMoves,[0,0]);
  assert(initial.veteran.every(sq=>sq.every(v=>!v)));
});
