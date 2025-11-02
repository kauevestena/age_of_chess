from __future__ import annotations
from typing import List, Tuple, Dict
import math
from .env import Engine
from .utils import encode_action

# Very simple greedy agent that scores actions by immediate material delta.
# Values are taken from YAML semantics: R(5) > N(3)=B(3) > Q(4 as utility) > P(1). King is priceless.

VAL = {"P":1,"N":3,"B":3,"R":5,"Q":4,"K":1000}

def score_action(engine: Engine, action: Tuple[int,int,int,int,int,int]) -> float:
    # Apply action on a copy: very rough one-ply evaluation
    import copy
    e2 = copy.deepcopy(engine)
    before = material(e2)
    try:
        e2.apply(action)
    except Exception:
        return -math.inf
    after = material(e2)
    # greedy prefers increasing our material vs opponent's
    side_played = "south" if engine.state.to_move == "north" else "north"  # after apply, side swapped
    # score as (our - their) delta for the acting side
    return (after[engine.state.to_move] - after[side_played]) - (before[engine.state.to_move] - before[side_played])

def material(engine: Engine) -> Dict[str,int]:
    tot = {"north":0,"south":0}
    for r in range(engine.state.board.rows):
        for c in range(engine.state.board.cols):
            sq = engine.state.board.grid[r][c]
            for u in [sq.top, sq.bottom]:
                if u:
                    tot[u.side] += VAL.get(u.code,0)
    return tot

class GreedyAgent:
    def select(self, engine: Engine):
        legal = engine.legal_actions()
        if not legal:
            return None
        scored = [(score_action(engine, a), a) for a in legal]
        scored.sort(key=lambda x: x[0], reverse=True)
        return scored[0][1]
