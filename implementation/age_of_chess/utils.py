"""One canonical action tuple, used by the engine, codec, GUI and policies."""
import operator
import numpy as np

# (from_row, from_col, slot, to_row, to_col, kind)
# 0 move, 1 melee, 2 shoot A, 3 convert, 4..7 arrange, 8 shoot B.
DIMS = (8, 8, 2, 8, 8, 9)
ACTION_SPACE_SIZE = 73728

def is_preparation(kind):
    return 4 <= kind <= 7

def is_shot(kind):
    return kind in (2, 8)

def shot_slot(kind):
    return 1 if kind == 8 else 0

def in_bounds(r, c, rows=8, cols=8):
    return 0 <= r < rows and 0 <= c < cols

def opponent(side):
    return "south" if side == "north" else "north"

def encode_action(fr, fc, slot, tr, tc, kind):
    index = 0
    for value, dim in zip((fr, fc, slot, tr, tc, kind), DIMS):
        value = operator.index(value)
        if not 0 <= value < dim:
            raise ValueError("Action coordinate out of range")
        index = index * dim + value
    return index

def decode_action(index):
    index = operator.index(index)
    if not 0 <= index < ACTION_SPACE_SIZE:
        raise ValueError("Action ID out of range")
    values = []
    for dim in reversed(DIMS):
        values.append(index % dim)
        index //= dim
    return tuple(reversed(values))

def action_mask_from_legal(legal):
    mask = np.zeros(ACTION_SPACE_SIZE, dtype=np.int8)
    for action in legal:
        mask[encode_action(*action)] = 1
    return mask
