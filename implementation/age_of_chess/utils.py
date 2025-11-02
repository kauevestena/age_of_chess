from __future__ import annotations
from typing import List, Tuple

# Action encoding:
# (from_r, from_c, slot_idx, action_type, to_r, to_c)
# Dimensions: 8 x 8 x 2 x 4 x 8 x 8 = 32768
DIMS = (8, 8, 2, 4, 8, 8)

def in_bounds(r: int, c: int, rows: int, cols: int) -> bool:
    return 0 <= r < rows and 0 <= c < cols

def opponent(side: str) -> str:
    return "south" if side == "north" else "north"

def encode_action(fr:int, fc:int, slot:int, atype:int, tr:int, tc:int) -> int:
    a = [fr, fc, slot, atype, tr, tc]
    idx = 0
    for i, v in enumerate(a):
        idx = idx * DIMS[i] + v
    return idx

def decode_action(idx:int) -> Tuple[int,int,int,int,int,int]:
    dims = DIMS[::-1]
    vals = []
    x = idx
    for d in dims:
        vals.append(x % d)
        x //= d
    vals = vals[::-1]
    return tuple(vals)  # fr, fc, slot, atype, tr, tc

def action_mask_from_legal(legal: List[Tuple[int,int,int,int,int,int]]) -> List[int]:
    mask = [0]* (DIMS[0]*DIMS[1]*DIMS[2]*DIMS[3]*DIMS[4]*DIMS[5])
    for (fr,fc,slot,atype,tr,tc) in legal:
        i = encode_action(fr,fc,slot,atype,tr,tc)
        mask[i] = 1
    return mask
