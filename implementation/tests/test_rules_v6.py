"""Rules v6: movement toward the enemy King's row (M1-M10) and the Priestess's Warp (W1-W9).

The movement expectations come from an independent reference below, not from the engine.
"""
import copy
import random
from pathlib import Path

import numpy as np
import pytest
import yaml

from implementation.age_of_chess.agents import GreedyAgent, LookaheadAgent, RandomAgent
from implementation.age_of_chess.env import Engine, OBSERVATION_SHAPE
from implementation.age_of_chess.game_state import Board, GameState, Unit
from implementation.age_of_chess.rules_loader import load_ruleset
from implementation.age_of_chess.utils import ACTION_SPACE_SIZE, action_mask_from_legal, decode_action, encode_action

OTHER = {"north": "south", "south": "north"}


def sgn(x):
    return (x > 0) - (x < 0)


def reference_quiet(pos, king, side, occupancy, cavalry=False):
    """Quiet destinations of a P/N/B/R per spec M2-M4. occupancy: {(r,c): (side, count)}."""
    def open_square(sq):
        return sq not in occupancy or (occupancy[sq][0] == side and occupancy[sq][1] == 1)

    def steps(at):
        (r, c), (kr, kc) = at, king
        if r != kr:
            return [(sgn(kr - r), dc) for dc in (-1, 0, 1)]
        return [(0, sgn(kc - c))] if c != kc else []

    out = set()
    for dr, dc in steps(pos):
        mid = (pos[0] + dr, pos[1] + dc)
        if not (0 <= mid[0] < 8 and 0 <= mid[1] < 8) or not open_square(mid):
            continue
        out.add(mid)
        if cavalry:
            for dr2, dc2 in steps(mid):
                dst = (mid[0] + dr2, mid[1] + dc2)
                if 0 <= dst[0] < 8 and 0 <= dst[1] < 8 and open_square(dst):
                    out.add(dst)
    return out


def quiet_of(engine, origin, slot=0):
    return {(a[3], a[4]) for a in engine.legal_actions() if a[:3] == (*origin, slot) and a[5] == 0}


def codes(square):
    return "".join(u.code for u in (square.top, square.bottom) if u)


def raw_engine(rules, pieces, side="north"):
    board = Board(8, 8)
    for r, c, units, owner in pieces:
        for code in units:
            board.grid[r][c].add_unit(Unit(code, owner))
    for owner, back in (("north", 7), ("south", 0)):
        count = sum(u is not None for row in board.grid for sq in row for u in (sq.top, sq.bottom) if u and u.side == owner)
        if count == 1:   # A lone King loses at once; give such a side a distant supporter.
            col = next(c for c in range(7, -1, -1) if board.grid[back][c].is_empty())
            board.grid[back][col].add_unit(Unit("P", owner))
    engine = Engine(rules=rules)
    engine.set_state(GameState(board, to_move=side))
    return engine


# --------------------------------------------------------------------------- movement

# (unit, owner, origin, enemy King, extra pieces, expected quiet destinations)
EXAMPLES = [
    ("P", "north", (3, 2), (0, 4), [], {(2, 1), (2, 2), (2, 3)}),
    ("P", "north", (1, 0), (0, 4), [], {(0, 0), (0, 1)}),
    ("P", "north", (1, 4), (0, 4), [], {(0, 3), (0, 5)}),
    ("P", "north", (0, 1), (0, 4), [], {(0, 2)}),
    ("P", "north", (0, 6), (0, 4), [], {(0, 5)}),
    ("P", "north", (0, 3), (0, 4), [], set()),
    ("P", "north", (1, 6), (3, 4), [], {(2, 5), (2, 6), (2, 7)}),
    ("P", "north", (0, 0), (3, 4), [], {(1, 0), (1, 1)}),
    ("P", "south", (4, 7), (7, 4), [], {(5, 6), (5, 7)}),
    ("P", "south", (7, 0), (7, 4), [], {(7, 1)}),
    ("N", "north", (5, 0), (3, 4), [], {(4, 0), (4, 1), (3, 0), (3, 1), (3, 2)}),
    ("N", "north", (4, 4), (3, 6), [], {(3, 3), (3, 4), (3, 5)}),
    ("N", "north", (3, 0), (3, 4), [], {(3, 1), (3, 2)}),
    ("N", "north", (3, 2), (3, 4), [], {(3, 3)}),
    ("N", "north", (1, 4), (3, 4), [], {(2, 3), (2, 4), (2, 5), (3, 2), (3, 3), (3, 5), (3, 6)}),
    ("N", "north", (5, 0), (3, 4), [(4, 1, "PP", "north"), (4, 0, "B", "south")], set()),
    ("N", "north", (5, 0), (3, 4), [(4, 1, "P", "north")], {(4, 0), (4, 1), (3, 0), (3, 1), (3, 2)}),
]


@pytest.mark.parametrize("code,owner,origin,king,extra,expected", EXAMPLES)
def test_worked_examples(rules, code, owner, origin, king, extra, expected):
    pieces = [(*origin, code, owner), (*king, "K", OTHER[owner]), *extra]
    own_king = (7, 7) if owner == "north" else (0, 7)
    pieces.append((*own_king, "K", owner))
    e = raw_engine(rules, pieces, side=owner)
    assert quiet_of(e, origin) == expected


def test_enemy_king_square_is_attackable_not_quiet(rules):
    e = raw_engine(rules, [(1, 4, "P", "north"), (0, 4, "K", "south"), (7, 7, "K", "north"), (0, 7, "P", "south")])
    assert (1, 4, 0, 0, 4, 1) in e.legal_actions()
    assert (1, 4, 0, 0, 4, 0) not in e.legal_actions()


def test_opening_position_matches_v5_orders(rules):
    e = Engine(rules=rules)
    for side in ("north", "south"):
        e.state.to_move = side
        legal = e.legal_actions()
        assert len(legal) == 52 and {a[5] for a in legal} == {0}
        king = (0, 4) if side == "north" else (7, 4)
        occupancy = {(r, c): (sq.top.side, 1 + (sq.bottom is not None))
                     for r, row in enumerate(e.state.board.grid) for c, sq in enumerate(row) if sq.top}
        expected = set()
        for (r, c), (owner, _) in occupancy.items():
            unit = e.state.board.grid[r][c].top
            if owner == side and unit.code != "K":
                expected |= {(r, c, *d) for d in reference_quiet((r, c), king, side, occupancy, unit.code == "N")}
        assert {(a[0], a[1], a[3], a[4]) for a in legal if e.state.board.grid[a[0]][a[1]].top.code != "K"} == expected


@pytest.mark.parametrize("seed", range(6))
def test_quiet_moves_match_independent_reference(rules, seed):
    rng = random.Random(seed)
    for _ in range(120):
        side = rng.choice(["north", "south"])
        squares = rng.sample([(r, c) for r in range(8) for c in range(8)], 10)
        king, origin, *rest = squares
        code = rng.choice("PNBR")
        pieces = [(*origin, code, side), (*king, "K", OTHER[side])]
        occupancy = {origin: (side, 1), king: (OTHER[side], 1)}
        for sq in rest[:5]:
            owner, units = rng.choice([(side, "P"), (side, "PP"), (OTHER[side], "P"), (OTHER[side], "PB")])
            pieces.append((*sq, units, owner))
            occupancy[sq] = (owner, len(units))
        used = set(occupancy)
        own_king = next(sq for sq in rest[5:] if sq not in used)
        pieces.append((*own_king, "K", side))
        support = next(sq for sq in rest[5:] if sq not in used and sq != own_king)
        pieces.append((*support, "P", side))
        try:
            e = raw_engine(rules, pieces, side=side)
        except ValueError:
            continue
        if e.state.done:
            continue
        # Skip positions where Priestess adjacency or captures changed the scenario.
        if codes(e.state.board.grid[origin[0]][origin[1]]) != code:
            continue
        occ = {(r, c): (sq.top.side, 1 + (sq.bottom is not None))
               for r, row in enumerate(e.state.board.grid) for c, sq in enumerate(row) if sq.top}
        assert quiet_of(e, origin) == reference_quiet(origin, king, side, occ, code == "N"), (seed, pieces)


@pytest.mark.parametrize("code", ["P", "N"])
@pytest.mark.parametrize("owner", ["north", "south"])
def test_quiet_moves_exhaustive_over_unit_and_king_squares(rules, code, owner):
    """Spec 10.1 #3: every unit square against every enemy King square (own King beside as an ally)."""
    from implementation.age_of_chess.movegen import gen_single_moves
    own_king = (7, 7) if owner == "north" else (0, 7)
    squares = [(r, c) for r in range(8) for c in range(8)]
    checked = 0
    for origin in squares:
        for king in squares:
            if origin == king or own_king in (origin, king):
                continue
            board = Board(8, 8)
            board.grid[origin[0]][origin[1]].add_unit(Unit(code, owner))
            board.grid[king[0]][king[1]].add_unit(Unit("K", OTHER[owner]))
            board.grid[own_king[0]][own_king[1]].add_unit(Unit("K", owner))
            occupancy = {origin: (owner, 1), king: (OTHER[owner], 1), own_king: (owner, 1)}
            actions = gen_single_moves(GameState(board, to_move=owner), rules)
            got = {(a[3], a[4]) for a in actions if a[:3] == (*origin, 0) and a[5] == 0}
            assert got == reference_quiet(origin, king, owner, occupancy, code == "N"), (origin, king)
            checked += 1
    assert checked == 63 * 62


def test_removed_movement_permissions(rules):
    # Enemy half sideways, back-rank freedom, frontal sidestep and backward movement are all gone.
    e = raw_engine(rules, [(2, 3, "P", "north"), (0, 4, "K", "south"), (7, 7, "K", "north"), (0, 7, "P", "south")])
    assert quiet_of(e, (2, 3)) == {(1, 2), (1, 3), (1, 4)}              # no (2,2)/(2,4)
    e = raw_engine(rules, [(0, 1, "P", "north"), (0, 4, "K", "south"), (7, 7, "K", "north"), (0, 7, "P", "south")])
    assert quiet_of(e, (0, 1)) == {(0, 2)}                              # no backward, no (0,0)
    e = raw_engine(rules, [(5, 3, "R", "north"), (4, 3, "P", "south"), (0, 4, "K", "south"), (7, 7, "K", "north")])
    assert quiet_of(e, (5, 3)) == {(4, 2), (4, 4)}                      # no frontal sidestep


def test_reference_row_follows_the_king(rules):
    south_king_home = raw_engine(rules, [(2, 2, "P", "north"), (0, 4, "K", "south"), (7, 7, "K", "north"), (0, 7, "P", "south")])
    assert quiet_of(south_king_home, (2, 2)) == {(1, 1), (1, 2), (1, 3)}
    level = raw_engine(rules, [(2, 2, "P", "north"), (2, 4, "K", "south"), (7, 7, "K", "north"), (0, 7, "P", "south")])
    assert quiet_of(level, (2, 2)) == {(2, 3)}
    passed = raw_engine(rules, [(2, 2, "P", "north"), (3, 4, "K", "south"), (7, 7, "K", "north"), (0, 7, "P", "south")])
    assert quiet_of(passed, (2, 2)) == {(3, 1), (3, 2), (3, 3)}


def test_real_king_step_changes_enemy_options(rules):
    e = raw_engine(rules, [(2, 2, "P", "north"), (1, 4, "K", "south"), (7, 7, "K", "north"), (0, 7, "P", "south")], side="south")
    e.apply((1, 4, 0, 2, 4, 0))
    assert quiet_of(e, (2, 2)) == {(2, 3)}


def test_capture_can_leave_the_reference_row_distance(rules):
    e = raw_engine(rules, [(2, 3, "P", "north"), (3, 3, "B", "south"), (0, 5, "K", "south"), (0, 0, "P", "south"),
                           (7, 7, "K", "north")])
    e.apply((2, 3, 0, 3, 3, 1))
    assert codes(e.state.board.grid[3][3]) == "P"
    e.state.to_move = "north"
    assert quiet_of(e, (3, 3)) == {(2, 2), (2, 3), (2, 4)}


def test_priestess_contact_step_and_king_peril_unchanged(rules):
    alone = raw_engine(rules, [(4, 3, "Q", "north"), (0, 4, "K", "south"), (7, 7, "K", "north"), (0, 7, "P", "south")])
    assert quiet_of(alone, (4, 3)) == {(3, 2), (3, 3), (3, 4)}
    touched = raw_engine(rules, [(4, 3, "Q", "north"), (5, 4, "P", "south"), (0, 4, "K", "south"), (7, 7, "K", "north")])
    assert quiet_of(touched, (4, 3)) == {(r, c) for r in (3, 4, 5) for c in (2, 3, 4)} - {(4, 3), (5, 4)}
    # The King ignores the reference row and keeps forward movement, plus peril steps.
    king = raw_engine(rules, [(4, 3, "K", "north"), (4, 6, "K", "south"), (0, 0, "P", "south"), (7, 0, "P", "north")])
    assert quiet_of(king, (4, 3)) == {(3, 2), (3, 3), (3, 4)}
    peril = raw_engine(rules, [(4, 3, "K", "north"), (2, 3, "P", "south"), (0, 6, "K", "south"), (7, 0, "P", "north")])
    assert (4, 3, 0, 5, 3, 0) in peril.legal_actions()


# --------------------------------------------------------------------------- Warp

WARP_POSITION = [(4, 3, "Q", "north"), (7, 4, "K", "north"), (7, 0, "P", "north"),
                 (3, 3, "P", "south"), (3, 4, "R", "south"), (4, 2, "PP", "south"),
                 (0, 4, "K", "south"), (0, 0, "B", "south")]


def warps(engine):
    return [a for a in engine.legal_actions() if a[5] == 3]


def test_spec_warp_example(rules):
    e = raw_engine(rules, WARP_POSITION)
    legal = warps(e)
    empties = [(r, c) for r in range(8) for c in range(8) if e.state.board.grid[r][c].is_empty()]
    assert len(empties) == 56 and len(legal) == 112
    assert {(a[0], a[1]) for a in legal} == {(3, 3), (3, 4)} and all(a[2] == 0 for a in legal)
    assert {(a[3], a[4]) for a in legal} == set(empties)
    e.apply((3, 4, 0, 0, 7, 3))
    assert e.state.board.grid[3][4].is_empty() and codes(e.state.board.grid[0][7]) == "R"
    assert e.state.board.grid[0][7].top.side == "south" and e.state.to_move == "south"
    assert quiet_of(e, (0, 7)) == {(1, 6), (1, 7)}


def test_warp_targets_and_destinations_are_restricted(rules):
    # Kings, formation members, friendly units and distant units cannot be warped.
    for target, owner, at in [("K", "south", (3, 3)), ("PP", "south", (3, 3)), ("PB", "south", (3, 3)),
                              ("P", "north", (3, 3)), ("R", "south", (2, 3))]:
        extra = [] if target == "K" and owner == "south" else [(0, 7, "K", "south")]
        e = raw_engine(rules, [(4, 3, "Q", "north"), (*at, target, owner), *extra, (7, 7, "K", "north"),
                               (0, 0, "P", "south"), (7, 0, "P", "north")])
        assert (at[0], at[1]) not in {(a[0], a[1]) for a in warps(e)}, (target, owner, at)
    # An occupied square is never a destination, even when it holds one ally of the target.
    e = raw_engine(rules, [(4, 3, "Q", "north"), (3, 3, "R", "south"), (3, 5, "P", "south"), (6, 6, "P", "north"),
                           (0, 7, "K", "south"), (7, 7, "K", "north")])
    destinations = {(a[3], a[4]) for a in warps(e)}
    assert (3, 5) not in destinations and (6, 6) not in destinations and (3, 3) not in destinations


def test_priestess_is_never_warpable(rules):
    e = raw_engine(rules, [(4, 3, "Q", "north"), (3, 3, "Q", "south"), (0, 7, "K", "south"), (7, 7, "K", "north"),
                           (0, 0, "P", "south"), (7, 0, "P", "north")], side="north")
    assert e.state.board.grid[4][3].is_empty() and e.state.board.grid[3][3].is_empty()   # Both die first.
    board = Board(8, 8)
    for r, c, code, owner in [(4, 3, "Q", "north"), (3, 3, "Q", "south"), (0, 7, "K", "south"), (7, 7, "K", "north")]:
        board.grid[r][c].add_unit(Unit(code, owner))
    e = Engine(rules=rules)
    e.state = GameState(board)
    assert not any(a[5] == 3 for a in e.legal_actions_unfiltered())


def test_warp_changes_only_the_two_squares(rules):
    e = raw_engine(rules, [(4, 3, "QP", "north"), (3, 3, "N", "south"), (2, 2, "B", "south"),
                           (0, 7, "K", "south"), (7, 7, "K", "north")])
    snapshot = copy.deepcopy(e.state.board)
    event = e.apply((3, 3, 0, 6, 0, 3))
    for r in range(8):
        for c in range(8):
            if (r, c) not in {(3, 3), (6, 0)}:
                assert codes(e.state.board.grid[r][c]) == codes(snapshot.grid[r][c])
                assert e.state.board.grid[r][c].layout == snapshot.grid[r][c].layout
    assert codes(e.state.board.grid[6][0]) == "N" and e.state.board.grid[6][0].top.side == "south"
    assert event["losses"] == [] and event["warp"]["unit"] == "N" and not event["moved"]
    assert event["actor"] == "Q" and event["warp"]["priestess"] == (4, 3) and event["atype"] == 3


@pytest.mark.parametrize("units,slot", [("QP", 0), ("PQ", 1), ("QK", 0), ("KQ", 1)])
def test_warp_from_either_subcell_including_the_king_escort(rules, units, slot):
    e = raw_engine(rules, [(4, 3, units, "north"), (3, 3, "B", "south"), (0, 7, "K", "south"), (0, 0, "P", "south")]
                   + ([] if "K" in units else [(7, 7, "K", "north")]))
    assert any(a[:2] == (3, 3) for a in warps(e))
    e.apply(next(a for a in warps(e) if a[:2] == (3, 3)))
    assert codes(e.state.board.grid[4][3]) == units and codes(e.state.board.grid[3][3]) == ""


def test_warp_resets_only_the_warpers_king_streaks(rules):
    e = raw_engine(rules, WARP_POSITION)
    e.state.king_moves = {"north": 2, "south": 3}
    e.state.retreat_counts = {"north": 1, "south": 2}
    e.apply((3, 4, 0, 0, 7, 3))
    assert e.state.king_moves == {"north": 0, "south": 3}
    assert e.state.retreat_counts == {"north": 0, "south": 2}


def test_warp_keeps_the_minimal_loss_rule_out_of_the_way(rules):
    e = raw_engine(rules, [(4, 1, "P", "north"), (3, 1, "R", "south"), (4, 4, "Q", "north"), (3, 4, "P", "south"),
                           (0, 7, "K", "south"), (7, 7, "K", "north")])
    losing = (4, 1, 0, 3, 1, 1)
    warp = (3, 4, 0, 0, 0, 3)
    e.legal_actions_unfiltered = lambda: [losing, warp]
    assert e.immediate_own_deaths(losing) == ["P"] and e.immediate_own_deaths(warp) == []
    assert e.legal_orders() == [losing, warp]


def test_a_side_with_only_warps_is_not_stagnated(rules):
    r = rules.model_copy(deep=True)
    for code, piece in r.game.pieces.items():
        piece.move.steps = []
        piece.move.retreat_trigger = "none"
        if code != "Q":
            piece.abilities = []
    board = Board(8, 8)
    for row, col, code, owner in [(4, 3, "Q", "north"), (3, 3, "P", "south"), (0, 7, "K", "south"), (7, 7, "K", "north"),
                                  (0, 0, "P", "south"), (7, 0, "P", "north")]:
        board.grid[row][col].add_unit(Unit(code, owner))
    e = Engine(rules=r)
    e.set_state(GameState(board))
    assert not e.state.done
    assert {a[5] for a in e.legal_actions()} == {3}


def test_warped_unit_near_a_king_puts_that_king_in_peril(rules):
    e = raw_engine(rules, [(4, 3, "Q", "north"), (3, 3, "R", "south"), (6, 5, "K", "north"), (0, 7, "K", "south"),
                           (7, 0, "P", "north"), (0, 0, "P", "south")])
    assert (6, 5, 0, 7, 5, 0) not in e.legal_actions()
    e.apply((3, 3, 0, 7, 6, 3))
    e.state.to_move = "north"
    assert (6, 5, 0, 7, 5, 0) in e.legal_actions()


def test_warp_mask_matches_legal_warps(rules):
    e = raw_engine(rules, WARP_POSITION)
    mask = e.action_mask()
    kind3 = {decode_action(i) for i in np.flatnonzero(mask) if decode_action(i)[5] == 3}
    assert kind3 == set(warps(e))


# --------------------------------------------------------------------------- state and interfaces

def test_no_veteran_state_remains(rules):
    assert not hasattr(Unit("P", "north"), "veteran")
    assert OBSERVATION_SHAPE == (37, 8, 8)
    e = raw_engine(rules, [(1, 3, "P", "north"), (0, 4, "K", "south"), (7, 7, "K", "north"), (0, 7, "P", "south")])
    before = e.state.position_key()
    e.apply((1, 3, 0, 0, 3, 0))
    assert e.state.board.grid[0][3].top.code == "P" and e.state.position_key() != before


def test_identical_classes_are_always_interchangeable(rules):
    e = raw_engine(rules, [(4, 3, "PP", "north"), (0, 7, "K", "south"), (7, 7, "K", "north")])
    arrangement_kinds = {a[5] for a in e.legal_actions() if a[:2] == (4, 3) and a[5] >= 4}
    assert arrangement_kinds == {6}   # Only the other axis; swaps of identical Pikemen are no-ops.


@pytest.mark.parametrize("mutate", [
    lambda g: g.update(version=5),
    lambda g: g.update(permanent_backward_movement=True),
    lambda g: g.update(frontal_enemy_sidesteps=True),
    lambda g: g.update(advance_reference="forward"),
    lambda g: g["board"].update(attack_field_depth=4),
    lambda g: g["pieces"]["P"]["move"].update(attack_field_sideways=True),
    lambda g: g["pieces"]["P"]["move"].update(last_rank_all_directions=True),
    lambda g: g["pieces"]["Q"]["abilities"][0].update(name="convert"),
    lambda g: g["pieces"]["Q"]["abilities"][0].update(targets=["P", "Q"]),
    lambda g: g["pieces"]["Q"]["abilities"][0].update(targets=["P", "K"]),
    lambda g: g["pieces"]["Q"]["abilities"][0].update(range=2),
    lambda g: g["pieces"]["B"]["abilities"].append({"name": "warp", "range": 1, "targets": ["P"]}),
])
def test_schema_rejects_removed_or_misplaced_rules(tmp_path, mutate):
    data = yaml.safe_load(Path("rulesets/default.yaml").read_text())
    mutate(data["game"])
    path = tmp_path / "rules.yaml"
    path.write_text(yaml.safe_dump(data))
    with pytest.raises(ValueError):
        load_ruleset(str(path))


def test_shipped_ruleset_is_v6_with_warp(rules):
    assert rules.game.version == 6 and rules.game.advance_reference == "enemy_king_row"
    assert [a.name for a in rules.game.pieces["Q"].abilities] == ["warp"]
    assert rules.game.pieces["Q"].abilities[0].targets == ["P", "N", "B", "R"]


def test_every_action_id_round_trips():
    assert ACTION_SPACE_SIZE == 73728
    assert all(encode_action(*decode_action(i)) == i for i in range(0, ACTION_SPACE_SIZE, 7))


# --------------------------------------------------------------------------- agents

def test_random_agent_treats_all_warps_of_a_target_as_one_option(rules):
    e = raw_engine(rules, [(4, 3, "Q", "north"), (3, 3, "P", "south"), (0, 7, "K", "south"), (7, 7, "K", "north"),
                           (0, 0, "P", "south"), (7, 0, "P", "north")])
    legal = e.legal_actions()
    options = len([a for a in legal if a[5] != 3]) + 1
    assert len([a for a in legal if a[5] == 3]) > 40
    agent = RandomAgent(5)
    picks = [agent.select(e) for _ in range(2000)]
    share = sum(a[5] == 3 for a in picks) / len(picks)
    assert abs(share - 1 / options) < 0.03 and share < 0.15
    assert len({a for a in picks if a[5] == 3}) > 10   # destinations are still uniform


@pytest.mark.parametrize("agent_class", [GreedyAgent, LookaheadAgent])
def test_search_agents_exile_the_warped_unit_far_from_the_warpers_king(rules, agent_class):
    # Only a Warp is available, so the agent must pick one: farthest row from the North King (row 7), i.e. row 0.
    r = rules.model_copy(deep=True)
    for code, piece in r.game.pieces.items():
        piece.move.steps = []
        piece.move.retreat_trigger = "none"
        if code != "Q":
            piece.abilities = []
    board = Board(8, 8)
    for row, col, code, owner in [(4, 3, "Q", "north"), (3, 3, "P", "south"), (0, 7, "K", "south"), (7, 7, "K", "north"),
                                  (0, 0, "P", "south"), (7, 0, "P", "north")]:
        board.grid[row][col].add_unit(Unit(code, owner))
    e = Engine(rules=r)
    e.set_state(GameState(board))
    for seed in range(5):
        choice = agent_class(seed).select(e)
        assert choice[5] == 3 and choice[3] == 0 and (choice[3], choice[4]) not in {(0, 7), (0, 0)}


@pytest.mark.parametrize("seed", range(3))
def test_seeded_games_preserve_unit_conservation_and_never_lose_units_to_warp(rules, seed):
    e = Engine(rules=rules)
    agents = {"north": GreedyAgent(seed), "south": RandomAgent(seed + 100)}
    for _ in range(300):
        if e.state.done:
            break
        action = agents[e.state.to_move].select(e)
        before = sum(u is not None for row in e.state.board.grid for sq in row for u in (sq.top, sq.bottom))
        event = e.apply(action)
        after = sum(u is not None for row in e.state.board.grid for sq in row for u in (sq.top, sq.bottom))
        e.state.board.validate()
        assert before - after == len(event["losses"])
        if action[5] == 3:
            assert event["losses"] == []
