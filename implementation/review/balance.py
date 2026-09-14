"""Seeded paired-color games on rules v2; unresolved games are never draws.

Run from repo root: python -m implementation.review.balance --workers 4
Process workers are independent simulation jobs, not learning agents.
"""
from __future__ import annotations
import argparse
from collections import Counter, defaultdict
from concurrent.futures import ProcessPoolExecutor
import csv
import hashlib
import importlib.metadata
import json
import math
from pathlib import Path
import subprocess
import time
import numpy as np
from implementation.age_of_chess.rules_loader import load_ruleset
from implementation.age_of_chess.env import Engine
from implementation.age_of_chess.agents import RandomAgent, GreedyAgent, LookaheadAgent
from implementation.age_of_chess.utils import encode_action, decode_action

CLASSES = {"Random":RandomAgent,"Greedy":GreedyAgent,"Lookahead":LookaheadAgent}
_RULES = None

def initialize(path):
    global _RULES
    _RULES = load_ruleset(path)

def play(task):
    group,pair_id,name_a,name_b,swap,seed,cap=task
    a,b=CLASSES[name_a](seed*2),CLASSES[name_b](seed*2+1)
    north,south=(b,a) if swap else (a,b)
    north_name,south_name=(name_b,name_a) if swap else (name_a,name_b)
    engine=Engine(rules=_RULES)
    actions=Counter();losses=Counter();conversions=Counter();stacking=0;minimal=0
    prior_count=32
    trace=[]
    for ply in range(cap):
        if engine.state.done: break
        actor=engine.state.to_move
        action=(north if actor=="north" else south).select(engine)
        if action is None: raise AssertionError("Unadjudicated no-action state")
        assert decode_action(encode_action(*action)) == action
        minimal += len(engine.legal_actions()) < len(engine.legal_actions_unfiltered())
        if action[-1]==0:
            target=engine.state.board.grid[action[3]][action[4]]
            stacking += target.top is not None
        event=engine.apply(action)
        actions[f"{event['actor']}:{event['atype']}"]+=1
        for death in event["losses"]: losses[death["code"]]+=1
        if "convert" in event: conversions[event["convert"]["converted"]]+=1
        engine.state.board.validate()
        remaining=sum(u is not None for row in engine.state.board.grid for sq in row for u in (sq.top,sq.bottom))
        assert remaining == prior_count-len(event["losses"]), (task,action,event)
        prior_count=remaining
        if pair_id==0: trace.append(action)
    if not engine.state.done: engine.truncate()
    state=engine.state
    result={"comparison":group,"pair_id":pair_id,"seed":seed,"swap":int(swap),
            "north":north_name,"south":south_name,"winner":state.winner,
            "reason":state.reason,"plies":state.move_count,"terminated":state.terminated,
            "truncated":state.truncated,"minimal_loss_turns":minimal}
    detail={"actions":dict(actions),"deaths":dict(losses),"conversions":dict(conversions),"stacking":stacking}
    return result,detail,trace

def source_hash(ruleset_path="rulesets/default.yaml"):
    paths=sorted(Path("implementation/age_of_chess").glob("*.py"))+[Path(ruleset_path),Path(__file__)]
    h=hashlib.sha256()
    for p in paths:
        h.update(p.name.encode());h.update(p.read_bytes())
    return h.hexdigest()

def summaries(records):
    groups=defaultdict(list)
    for r in records: groups[r["comparison"]].append(r)
    result=[]
    rng=np.random.default_rng(91236)
    for name,items in groups.items():
        outcomes=Counter(r["winner"] if r["winner"] else "unresolved" for r in items)
        pts=outcomes["north"]+.5*outcomes["draw"]
        n=len(items);completed=n-outcomes["unresolved"]
        by_pair=defaultdict(list)
        for r in items:
            value=None if r["truncated"] else (1.0 if r["winner"]=="north" else .5 if r["winner"]=="draw" else 0.0)
            by_pair[r["pair_id"]].append(value)
        paired=[sum(v)/2 for v in by_pair.values() if len(v)==2 and None not in v]
        ci=None
        if len(paired)>1:
            a=np.array(paired)
            bootstrap=np.mean(a[rng.integers(0,len(a),size=(2000,len(a)))],axis=1)
            ci=[float(x) for x in np.quantile(bootstrap,[.025,.975])]
        result.append({"comparison":name,"games":n,"outcomes":dict(outcomes),
                       "reasons":dict(Counter(r["reason"] for r in items)),
                       "mean_plies":float(np.mean([r["plies"] for r in items])),
                       "median_plies":float(np.median([r["plies"] for r in items])),
                       "north_score_completed_only":pts/completed if completed else None,
                       "north_score_bounds_with_unresolved":[pts/n,(pts+outcomes["unresolved"])/n],
                       "complete_pairs":len(paired),
                       "north_score_complete_pairs":float(np.mean(paired)) if paired else None,
                       "paired_bootstrap_95pct_complete_pairs":ci})
    return result

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--ruleset",default="rulesets/default.yaml")
    p.add_argument("--pairs",type=int,default=1500)
    p.add_argument("--search-pairs",type=int,default=250)
    p.add_argument("--max-plies",type=int,default=512)
    p.add_argument("--workers",type=int,default=4)
    p.add_argument("--out",default="implementation/review/results_v2")
    args=p.parse_args()
    if min(args.pairs,args.search_pairs)<0 or args.max_plies<1: p.error("invalid sample size or cap")
    out=Path(args.out);out.mkdir(parents=True,exist_ok=True)
    comparisons=[("Random","Random",args.pairs),("Greedy","Greedy",args.pairs),
                 ("Greedy","Random",args.pairs),("Lookahead","Greedy",args.search_pairs),
                 ("Lookahead","Lookahead",args.search_pairs)]
    tasks=[]
    for group,(a,b,n) in enumerate(comparisons):
        for pair in range(n):
            seed=20260913+group*1000000+pair
            for swap in (False,True): tasks.append((f"{a} vs {b}",pair,a,b,swap,seed,args.max_plies))
    records=[];traces=[];actions=Counter();deaths=Counter();conversions=Counter();stacking=0
    start=time.monotonic()
    with ProcessPoolExecutor(max_workers=args.workers,initializer=initialize,initargs=(args.ruleset,)) as pool:
        for result,detail,trace in pool.map(play,tasks,chunksize=10):
            records.append(result)
            actions.update(detail["actions"]);deaths.update(detail["deaths"]);conversions.update(detail["conversions"])
            stacking+=detail["stacking"]
            if trace: traces.append({**result,"actions":trace})
            if len(records)%250==0:
                print(f"{len(records)}/{len(tasks)} games; {time.monotonic()-start:.1f}s",flush=True)
    with (out/"games.csv").open("w",newline="") as f:
        w=csv.DictWriter(f,fieldnames=list(records[0]) if records else [])
        w.writeheader();w.writerows(records)
    summary={"rules_version":2,"base_commit":subprocess.check_output(["git","rev-parse","HEAD"],text=True).strip(),
             "source_sha256":source_hash(args.ruleset),"rules_sha256":hashlib.sha256(Path(args.ruleset).read_bytes()).hexdigest(),
             "games":len(records),"plies":sum(r["plies"] for r in records),"max_plies":args.max_plies,
             "invariant_failures":0,"action_codec_failures":0,
             "minimal_loss_turns":sum(r["minimal_loss_turns"] for r in records),
             "elapsed_seconds":time.monotonic()-start,"cohorts":summaries(records),
             "actions_by_piece_and_kind":dict(actions),"deaths_by_piece":dict(deaths),
             "conversions_by_piece":dict(conversions),"stacking_moves":stacking,
             "versions":{name:importlib.metadata.version(name) for name in ("numpy","pydantic","pyyaml","pettingzoo","gymnasium")},
             "limitations":["All games use the standard opening, no human or trained expert agents.",
                            "Lookahead searches two plies: eight root candidates and every opponent reply's immediate material swing.",
                            "Bootstrap resamples complete color-swapped seed pairs; incomplete-pair selection can bias estimates.",
                            "Unresolved bounds assign capped games score 0 or 1; truncation is not a draw.",
                            "Piece event counts measure policy usage, not causal piece value or expert balance."]}
    (out/"summary.json").write_text(json.dumps(summary,indent=2)+"\n")
    (out/"sample_replays.json").write_text(json.dumps(traces,indent=2)+"\n")
    print(json.dumps(summary,indent=2),flush=True)

if __name__=="__main__": main()
