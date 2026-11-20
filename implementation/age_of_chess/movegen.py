from __future__ import annotations
from .utils import in_bounds
from .combat import melee_allowed, contact_slots, canonical_layout

Action = tuple[int, int, int, int, int, int]
ALL_DIRS = [(dr, dc) for dr in (-1, 0, 1) for dc in (-1, 0, 1) if dr or dc]

def forward_dirs(side):
    return [(-1 if side == "north" else 1, dc) for dc in (-1, 0, 1)]

def sign(value):
    return (value > 0) - (value < 0)

def enemy_king_square(state, side):
    """Square of the enemy King, or None when it is not on the board."""
    for r, row in enumerate(state.board.grid):
        for c, sq in enumerate(row):
            for unit in (sq.top, sq.bottom):
                if unit and unit.code == "K" and unit.side != side:
                    return (r, c)
    return None

def advance_steps(steps, r, c, side, king):
    """M2: quiet advance steps of a non-King unit standing on (r, c).

    Off the enemy King's row the unit steps onto the adjacent row on the King's
    side (the YAML step columns decide straight/diagonal); level with the King
    it steps one square along the row toward him. Without an enemy King (study
    positions only) the unit falls back to ordinary forward movement.
    """
    if not steps:
        return []
    if king is None:
        return [(-1 if side == "north" else 1, dc) for _, dc in steps]
    kr, kc = king
    if r != kr:
        return [(sign(kr - r), dc) for _, dc in steps]
    return [(0, sign(kc - c))] if c != kc else []

def enemy_near(state, r, c, side, radius):
    for rr in range(max(0, r-radius), min(state.board.rows, r+radius+1)):
        for cc in range(max(0, c-radius), min(state.board.cols, c+radius+1)):
            top = state.board.grid[rr][cc].top
            if top and top.side != side:
                return True
    return False

def clear_los(state, r0, c0, r1, c1):
    dr, dc = r1-r0, c1-c0
    distance = max(abs(dr), abs(dc))
    if not distance or (dr and dc and abs(dr) != abs(dc)):
        return False
    sr, sc = (dr > 0)-(dr < 0), (dc > 0)-(dc < 0)
    return all(state.board.grid[r0+k*sr][c0+k*sc].is_empty() for k in range(1, distance))

def cavalry_passable(square, side):
    return square.is_empty() or (square.top.side == side and square.bottom is None)

def empty_squares(state):
    return [(r, c) for r, row in enumerate(state.board.grid) for c, sq in enumerate(row) if sq.is_empty()]

def gen_single_moves(state, rules):
    if state.done:
        return []
    rows, cols, side = state.board.rows, state.board.cols, state.to_move
    king = enemy_king_square(state, side)
    actions = set()
    empties = None
    for r, row in enumerate(state.board.grid):
        for c, sq in enumerate(row):
            for slot, unit in enumerate((sq.top, sq.bottom)):
                if unit is None or unit.side != side:
                    continue
                spec = rules.game.pieces[unit.code]
                movement = spec.move

                def quiet(rr, cc):
                    if not in_bounds(rr, cc, rows, cols): return
                    target = state.board.grid[rr][cc]
                    if target.is_empty() or (target.top.side == side and target.bottom is None):
                        actions.add((r, c, slot, rr, cc, 0))

                def attack(rr, cc):
                    if not in_bounds(rr, cc, rows, cols): return
                    target = state.board.grid[rr][cc]
                    if target.top and target.top.side != side and melee_allowed(
                            unit, target, rules, (r, c), (rr, cc)):
                        actions.add((r, c, slot, rr, cc, 1))

                def steps_from(rr, cc):
                    # The King always moves toward the enemy back rank (M7); every
                    # other class advances toward the enemy King's row (M2).
                    if unit.code == "K":
                        return [(-dr if side == "south" else dr, dc) for dr, dc in movement.steps]
                    return advance_steps(movement.steps, rr, cc, side, king)

                # M2-M4: one advance step; Cavalry may take a second step chosen
                # afresh from a passable intermediate square.
                for dr, dc in steps_from(r, c):
                    rr, cc = r+dr, c+dc
                    if not in_bounds(rr, cc, rows, cols): continue
                    quiet(rr, cc)
                    if movement.max_steps == 2 and cavalry_passable(state.board.grid[rr][cc], side):
                        for dr2, dc2 in steps_from(rr, cc):
                            quiet(rr+dr2, cc+dc2)

                # M5/M7: contact step (Priestess) and peril step (King).
                if movement.retreat_trigger != "none" and enemy_near(
                        state, r, c, side,
                        1 if movement.retreat_trigger == "adjacent_enemy" else movement.threat_radius):
                    for dr, dc in ALL_DIRS:
                        quiet(r+dr, c+dc)

                # M8: attacks are free in every direction; Cavalry may pass one ally.
                for dr, dc in ALL_DIRS:
                    rr, cc = r+dr, c+dc
                    if not in_bounds(rr, cc, rows, cols): continue
                    attack(rr, cc)
                    if movement.max_steps == 2 and cavalry_passable(state.board.grid[rr][cc], side):
                        for dr2, dc2 in ALL_DIRS:
                            attack(rr+dr2, cc+dc2)

                for ability in spec.abilities:
                    if ability.name == "warp":
                        # W2/W3: one adjacent solitary enemy unit to any empty square.
                        for dr, dc in ALL_DIRS:
                            rr, cc = r+dr, c+dc
                            if not in_bounds(rr, cc, rows, cols): continue
                            target = state.board.grid[rr][cc]
                            if (target.top and target.top.side != side and target.bottom is None
                                    and target.top.code in ability.targets):
                                if empties is None:
                                    empties = empty_squares(state)
                                for er, ec in empties:
                                    actions.add((rr, cc, 0, er, ec, 3))
                    else:
                        if ability.requires_stack_size == 2 and not (
                            sq.top and sq.bottom and sq.top.code == sq.bottom.code == "B"):
                            continue
                        for dr, dc in ALL_DIRS:
                            for distance in range(1, ability.range+1):
                                rr, cc = r+distance*dr, c+distance*dc
                                if not in_bounds(rr, cc, rows, cols): break
                                target = state.board.grid[rr][cc]
                                if target.top:
                                    if target.top.side != side:
                                        for target_slot in contact_slots((r, c), (rr, cc), target.bottom, target.layout):
                                            if (target.top, target.bottom)[target_slot].code in ability.targets:
                                                actions.add((r, c, slot, rr, cc, 8 if target_slot else 2))
                                    break  # Any occupied square blocks further fire.
    return sorted(actions)


def gen_preparations(state, rules):
    if state.done or len(state.prepared) >= rules.game.formation_rearrangements:
        return []
    return [(r, c, 0, r, c, 4+layout)
            for r, row in enumerate(state.board.grid) for c, sq in enumerate(row)
            if sq.bottom and sq.top.side == state.to_move and r*8+c not in state.prepared
            for layout in range(4)
            if layout != sq.layout and layout == canonical_layout(sq.top, sq.bottom, layout)]
