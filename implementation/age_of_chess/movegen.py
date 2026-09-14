from __future__ import annotations
from .utils import in_bounds

Action = tuple[int, int, int, int, int, int]
ALL_DIRS = [(dr, dc) for dr in (-1, 0, 1) for dc in (-1, 0, 1) if dr or dc]
SIDEWAYS_DIRS = [(0, -1), (0, 1)]

def forward_dirs(side):
    return [(-1 if side == "north" else 1, dc) for dc in (-1, 0, 1)]

def is_last_rank(side, row, rows):
    return row == (0 if side == "north" else rows-1)

def in_attack_field(side, row, rows, depth=4):
    return row < depth if side == "north" else row >= rows-depth

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

def gen_single_moves(state, rules):
    if state.done:
        return []
    rows, cols, side = state.board.rows, state.board.cols, state.to_move
    actions = set()
    for r, row in enumerate(state.board.grid):
        for c, sq in enumerate(row):
            for slot, unit in enumerate((sq.top, sq.bottom)):
                if unit is None or unit.side != side:
                    continue
                spec = rules.game.pieces[unit.code]
                movement = spec.move
                dirs = [(dr if side == "north" else -dr, dc) for dr, dc in movement.steps]

                def destination(rr, cc, attack_only=False):
                    if not in_bounds(rr, cc, rows, cols): return
                    target = state.board.grid[rr][cc]
                    if target.is_empty() or (target.top.side == side and target.bottom is None):
                        if not attack_only: actions.add((r, c, slot, rr, cc, 0))
                    elif target.top.side != side:
                        if rules.game.combat.single[unit.code][target.top.code] != "illegal":
                            actions.add((r, c, slot, rr, cc, 1))

                for dr, dc in dirs:
                    rr, cc = r+dr, c+dc
                    if not in_bounds(rr, cc, rows, cols): continue
                    destination(rr, cc)
                    if movement.max_steps == 2 and cavalry_passable(state.board.grid[rr][cc], side):
                        for dr2, dc2 in dirs:
                            destination(rr+dr2, cc+dc2)
                extra = []
                if movement.last_rank_all_directions and is_last_rank(side, r, rows):
                    extra = ALL_DIRS
                elif movement.retreat_trigger != "none" and enemy_near(
                        state, r, c, side,
                        1 if movement.retreat_trigger == "adjacent_enemy" else movement.threat_radius):
                    extra = ALL_DIRS
                elif movement.attack_field_sideways and in_attack_field(
                        side, r, rows, rules.game.board.attack_field_depth):
                    extra = SIDEWAYS_DIRS
                for dr, dc in extra:
                    destination(r+dr, c+dc)
                ahead = r + (-1 if side == "north" else 1)
                if in_bounds(ahead, c, rows, cols):
                    enemy = state.board.grid[ahead][c].top
                    if enemy and enemy.side != side:
                        for dr, dc in SIDEWAYS_DIRS:
                            destination(r+dr, c+dc)

                # Direction freedom is only for an enemy destination. A Cavalry
                # may pass one ally, but not a full formation or an enemy.
                for dr, dc in ALL_DIRS:
                    rr, cc = r+dr, c+dc
                    if not in_bounds(rr, cc, rows, cols): continue
                    destination(rr, cc, attack_only=True)
                    if movement.max_steps == 2 and cavalry_passable(state.board.grid[rr][cc], side):
                        for dr2, dc2 in ALL_DIRS:
                            destination(rr+dr2, cc+dc2, attack_only=True)

                for ability in spec.abilities:
                    if ability.name == "convert":
                        for dr, dc in ALL_DIRS:
                            rr, cc = r+dr, c+dc
                            if not in_bounds(rr, cc, rows, cols): continue
                            target = state.board.grid[rr][cc]
                            if (target.top and target.top.side != side and target.bottom is None
                                    and target.top.code in ability.targets):
                                actions.add((r, c, slot, rr, cc, 3))
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
                                    if target.top.side != side and target.top.code in ability.targets:
                                        actions.add((r, c, slot, rr, cc, 2))
                                    break  # Any occupied square blocks further fire.
    return sorted(actions)
