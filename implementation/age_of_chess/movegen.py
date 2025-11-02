from __future__ import annotations
from typing import List, Tuple
from .game_state import GameState
from .rules_loader import Ruleset
from .utils import in_bounds

Action = Tuple[int,int,int,int,int,int]  # (from_r,from_c,slot_idx,to_r,to_c,action_type)
# action_type: 0=move/stack, 1=melee, 2=ranged, 3=convert

def forward_dirs(side: str) -> List[Tuple[int,int]]:
    if side == "north":
        return [(-1,-1),(-1,0),(-1,1)]
    else:
        return [(1,-1),(1,0),(1,1)]

def clear_los(state: GameState, r0:int, c0:int, r1:int, c1:int) -> bool:
    """Forward-only LOS up to distance 2.
    Distance 1: always clear.
    Distance 2: intermediate square must have no TOP unit (i.e., no unit on top; bottom doesn't matter as
    we always promote bottom to top in engine, so presence implies top).
    """
    dr = r1 - r0; dc = c1 - c0
    if abs(dr) <= 1 and abs(dc) <= 1:
        return True
    mid_r = r0 + (dr // 2)
    mid_c = c0 + (dc // 2)
    return state.board.grid[mid_r][mid_c].top is None

def gen_single_moves(state: GameState, rules: Ruleset) -> List[Action]:
    rows, cols = state.board.rows, state.board.cols
    side = state.to_move
    actions: List[Action] = []

    for r in range(rows):
        for c in range(cols):
            sq = state.board.grid[r][c]
            slots = [sq.top, sq.bottom]
            for slot_idx, u in enumerate(slots):
                if u is None or u.side != side:
                    continue
                code = u.code
                fdirs = forward_dirs(side)

                if code == "N":
                    for d1 in fdirs:
                        r1, c1 = r + d1[0], c + d1[1]
                        if not in_bounds(r1,c1,rows,cols): continue
                        dst1 = state.board.grid[r1][c1]
                        if dst1.top is None or (dst1.top.side == side and dst1.bottom is None):
                            actions.append((r,c,slot_idx,r1,c1,0))
                        for d2 in fdirs:
                            r2, c2 = r1 + d2[0], c1 + d2[1]
                            if not in_bounds(r2,c2,rows,cols): continue
                            dst2 = state.board.grid[r2][c2]
                            if dst2.top is None or (dst2.top.side == side and dst2.bottom is None):
                                actions.append((r,c,slot_idx,r2,c2,0))
                            elif dst2.top and dst2.top.side != side:
                                actions.append((r,c,slot_idx,r2,c2,1))
                else:
                    for d in fdirs:
                        r1, c1 = r + d[0], c + d[1]
                        if not in_bounds(r1,c1,rows,cols): continue
                        dst = state.board.grid[r1][c1]
                        if dst.top is None or (dst.top.side == side and dst.bottom is None):
                            actions.append((r,c,slot_idx,r1,c1,0))
                        elif dst.top and dst.top.side != side:
                            actions.append((r,c,slot_idx,r1,c1,1))

                if code == "B":
                    is_power = (slot_idx == 0 and sq.bottom is not None and sq.bottom.code == "B") or                                (slot_idx == 1 and sq.top is not None and sq.top.code == "B")
                    for d in fdirs:
                        for k in (1,2):
                            rr, cc = r + k*d[0], c + k*d[1]
                            if not in_bounds(rr,cc,rows,cols): continue
                            if not clear_los(state, r, c, rr, cc): continue
                            tgt_top = state.board.grid[rr][cc].top
                            if tgt_top and tgt_top.side != side:
                                if tgt_top.code in ("B","P","Q"):
                                    actions.append((r,c,slot_idx,rr,cc,2))
                                elif is_power and tgt_top.code in ("N","R"):
                                    actions.append((r,c,slot_idx,rr,cc,2))

                if code == "Q":
                    for dr in (-1,0,1):
                        for dc in (-1,0,1):
                            if dr==0 and dc==0: continue
                            rr,cc = r+dr, c+dc
                            if not in_bounds(rr,cc,rows,cols): continue
                            top = state.board.grid[rr][cc].top
                            bottom = state.board.grid[rr][cc].bottom
                            if top and top.side != side and bottom is None and top.code not in ("K","Q"):
                                actions.append((r,c,slot_idx,rr,cc,3))

    return actions
