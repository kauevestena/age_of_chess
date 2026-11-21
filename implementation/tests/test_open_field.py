"""Open Field: no formations, two-step reach (Cavalry three, King one), adjacent-Archer power shot.

Expectations come from an independent reference generator written here. It enumerates every
path recursively, unlike the engine's breadth-first walk, and reads the combat table directly.
"""
import copy
import random
from pathlib import Path

import numpy as np
import pytest
import yaml

from implementation.age_of_chess.agents import GreedyAgent, LookaheadAgent, RandomAgent
from implementation.age_of_chess.env import Engine
from implementation.age_of_chess.game_state import Board, GameState, Unit
from implementation.age_of_chess.movegen import gen_preparations, gen_single_moves
from implementation.age_of_chess.rules_loader import load_ruleset
from implementation.age_of_chess.utils import decode_action, encode_action

OF_PATH = "rulesets/open_field.yaml"
OTHER = {"north": "south", "south": "north"}
ALL = [(dr, dc) for dr in (-1, 0, 1) for dc in (-1, 0, 1) if dr or dc]
REACH = {"P": 2, "N": 3, "B": 2, "R": 2, "Q": 2, "K": 1}


@pytest.fixture(scope="module")
def of_rules():
    return load_ruleset(OF_PATH)


def sgn(x):
    return (x > 0) - (x < 0)


def inside(sq):
    return 0 <= sq[0] < 8 and 0 <= sq[1] < 8


# --------------------------------------------------------------------------- independent reference

def reference_actions(units, side, rules):
    """Every unfiltered order for `side`. units: {(r, c): (owner, code)}, one unit per square."""
    table = rules.game.combat.single
    enemy_king = next((sq for sq, (o, c) in units.items() if c == "K" and o != side), None)
    empties = [(r, c) for r in range(8) for c in range(8) if (r, c) not in units]

    def passable(sq):
        return sq not in units or units[sq][0] == side

    def walk(origin, steps, depth_left):
        out = set()

        def go(pos, left):
            for d in steps(pos):
                nxt = (pos[0] + d[0], pos[1] + d[1])
                if not inside(nxt):
                    continue
                out.add(nxt)
                if left > 1 and passable(nxt):
                    go(nxt, left - 1)
        go(origin, depth_left)
        out.discard(origin)
        return out

    def toward_king(pos):
        if enemy_king is None:
            return [(-1 if side == "north" else 1, dc) for dc in (-1, 0, 1)]
        (r, c), (kr, kc) = pos, enemy_king
        if r != kr:
            return [(sgn(kr - r), dc) for dc in (-1, 0, 1)]
        return [(0, sgn(kc - c))] if c != kc else []

    def enemy_within(pos, radius):
        return any(o != side and max(abs(sq[0] - pos[0]), abs(sq[1] - pos[1])) <= radius
                   for sq, (o, _) in units.items() if sq != pos)

    actions = set()
    for pos, (owner, code) in units.items():
        if owner != side:
            continue
        r, c = pos
        if code == "K":
            steps = (lambda p: ALL) if enemy_within(pos, 2) else (lambda p: [(-1 if side == "north" else 1, dc) for dc in (-1, 0, 1)])
        elif code == "Q" and enemy_within(pos, 1):
            steps = lambda p: ALL
        else:
            steps = toward_king
        for dst in walk(pos, steps, REACH[code]):
            if dst not in units:
                actions.add((r, c, 0, dst[0], dst[1], 0))
        for dst in walk(pos, lambda p: ALL, REACH[code]):
            if dst in units and units[dst][0] != side and table[code][units[dst][1]] != "illegal":
                actions.add((r, c, 0, dst[0], dst[1], 1))
        if code == "B":
            supported = any(units.get((r + dr, c + dc)) == (side, "B") for dr, dc in ALL)
            for dr, dc in ALL:
                dst = (r + dr, c + dc)
                if dst in units and units[dst][0] != side:
                    target = units[dst][1]
                    if target in "BPQ" or (target in "NR" and supported):
                        actions.add((r, c, 0, dst[0], dst[1], 2))
        if code == "Q":
            for dst, (o, target) in units.items():
                if o != side and target in "PNBR" and max(abs(dst[0] - r), abs(dst[1] - c)) <= 2:
                    actions.update((dst[0], dst[1], 0, er, ec, 3) for er, ec in empties)
    return actions


def state_of(units, side):
    board = Board(8, 8)
    for (r, c), (owner, code) in units.items():
        board.grid[r][c].add_unit(Unit(code, owner))
    return GameState(board, to_move=side)


def engine_for(rules, pieces, side="north"):
    """A settled study position. pieces: [(r, c, code, owner)]; a side left with only a King gets a supporter."""
    board = Board(8, 8)
    for r, c, code, owner in pieces:
        board.grid[r][c].add_unit(Unit(code, owner))
    for owner, back in (("north", 7), ("south", 0)):
        if sum(1 for row in board.grid for sq in row if sq.top and sq.top.side == owner) == 1:
            col = next(c for c in range(7, -1, -1) if board.grid[back][c].is_empty())
            board.grid[back][col].add_unit(Unit("P", owner))
    engine = Engine(rules=rules)
    engine.set_state(GameState(board, to_move=side))
    return engine


def orders_from(engine, origin, kind):
    return {(a[3], a[4]) for a in engine.legal_actions() if a[:2] == origin and a[5] == kind}


# --------------------------------------------------------------------------- ruleset

def test_open_field_ruleset_shape(of_rules):
    g = of_rules.game
    assert g.mode == "open_field" and not g.formations and g.formation_rearrangements == 0
    assert {c: p.move.max_steps for c, p in g.pieces.items()} == REACH
    power = next(a for a in g.pieces["B"].abilities if a.name == "power_shot")
    assert power.support == "adjacent" and power.requires_stack_size == 1
    warp = g.pieces["Q"].abilities[0]
    assert warp.range == 2 and not warp.breaks_formations
    # Everything else matches Warfare.
    warfare = load_ruleset("rulesets/default.yaml").game
    assert g.combat == warfare.combat and g.minimal_loss == warfare.minimal_loss
    assert g.king_move_limit == warfare.king_move_limit and g.commander_retreat_limit == warfare.commander_retreat_limit
    assert {c: p.value for c, p in g.pieces.items()} == {c: p.value for c, p in warfare.pieces.items()}


@pytest.mark.parametrize("path,mutate", [
    (OF_PATH, lambda g: g.update(formations=True)),
    (OF_PATH, lambda g: g.update(formation_rearrangements=3)),
    (OF_PATH, lambda g: g["pieces"]["K"]["move"].update(max_steps=2)),
    (OF_PATH, lambda g: g["pieces"]["N"]["move"].update(max_steps=4)),
    (OF_PATH, lambda g: g["pieces"]["N"]["move"].update(max_steps=2)),
    (OF_PATH, lambda g: g["pieces"]["P"]["move"].update(max_steps=1)),
    (OF_PATH, lambda g: g["pieces"]["B"]["abilities"][1].update(support="formation")),
    (OF_PATH, lambda g: g["pieces"]["B"]["abilities"][1].update(requires_stack_size=2)),
    (OF_PATH, lambda g: g["pieces"]["Q"]["abilities"][0].update(breaks_formations=True)),
    (OF_PATH, lambda g: g.update(mode="warfare")),
    (OF_PATH, lambda g: g["pieces"]["B"]["abilities"][0].update(support="adjacent")),
    ("rulesets/default.yaml", lambda g: g.update(mode="open_field")),
    ("rulesets/default.yaml", lambda g: g.update(formations=False)),
    ("rulesets/default.yaml", lambda g: g["pieces"]["P"]["move"].update(max_steps=2)),
    ("rulesets/default.yaml", lambda g: g["pieces"]["B"]["abilities"][1].update(support="adjacent", requires_stack_size=1)),
    ("rulesets/default.yaml", lambda g: g.update(formation_rearrangements=0)),
])
def test_loader_rejects_inconsistent_modes(tmp_path, path, mutate):
    data = yaml.safe_load(Path(path).read_text())
    mutate(data["game"])
    target = tmp_path / "rules.yaml"
    target.write_text(yaml.safe_dump(data))
    with pytest.raises(ValueError):
        load_ruleset(str(target))


# --------------------------------------------------------------------------- full generator against the reference

def test_opening_matches_reference(of_rules):
    e = Engine(rules=of_rules)
    for side in ("north", "south"):
        e.state.to_move = side
        units = {(r, c): (sq.top.side, sq.top.code) for r, row in enumerate(e.state.board.grid)
                 for c, sq in enumerate(row) if sq.top}
        legal = set(e.legal_actions())
        assert legal == reference_actions(units, side, of_rules)
        assert len(legal) == 95 and {a[5] for a in legal} == {0}


@pytest.mark.parametrize("code", list("PNBRQK"))
@pytest.mark.parametrize("owner", ["north", "south"])
def test_single_unit_exhaustive(of_rules, code, owner):
    """Every unit square against every enemy King square (own King in a corner)."""
    own_king = (7, 7) if owner == "north" else (0, 7)
    checked = 0
    for origin in [(r, c) for r in range(8) for c in range(8)]:
        for king in [(r, c) for r in range(8) for c in range(8)]:
            if len({origin, king, own_king}) < 3:
                continue
            if code == "K":
                units = {origin: (owner, "K"), king: (OTHER[owner], "K"), own_king: (owner, "P")}
            else:
                units = {origin: (owner, code), king: (OTHER[owner], "K"), own_king: (owner, "K")}
            got = set(gen_single_moves(state_of(units, owner), of_rules))
            assert got == reference_actions(units, owner, of_rules), (origin, king)
            checked += 1
    assert checked == 63 * 62


@pytest.mark.parametrize("seed", range(10))
def test_crowded_random_positions_match_reference(of_rules, seed):
    """Dense random boards: blockers of both sides, every class, Archers in pairs, Priestesses."""
    rng = random.Random(seed)
    squares = [(r, c) for r in range(8) for c in range(8)]
    compared = 0
    for _ in range(150):
        cells = rng.sample(squares, rng.randint(6, 26))
        units = {cells[0]: ("north", "K"), cells[1]: ("south", "K")}
        queens = {"north": 0, "south": 0}
        for sq in cells[2:]:
            owner = rng.choice(["north", "south"])
            code = rng.choice("PPNBBRQ")
            if code == "Q":
                if queens[owner]:
                    code = "B"
                queens[owner] += 1
            units[sq] = (owner, code)
        side = rng.choice(["north", "south"])
        got = set(gen_single_moves(state_of(units, side), of_rules))
        assert got == reference_actions(units, side, of_rules), (seed, sorted(units.items()), side)
        compared += 1
    assert compared == 150


# --------------------------------------------------------------------------- named behaviours

def test_units_pass_friends_and_stop_only_on_empty_squares(of_rules):
    e = engine_for(of_rules, [(5, 3, "P", "north"), (4, 3, "P", "north"), (0, 4, "K", "south"), (7, 7, "K", "north")])
    quiet = orders_from(e, (5, 3), 0)
    assert (3, 3) in quiet and (3, 2) in quiet and (3, 4) in quiet      # over the friend on d4
    assert (4, 3) not in quiet                                           # no joining a friend
    assert not any(a[5] in (4, 5, 6, 7, 8) for a in e.legal_actions())


def test_cavalry_rides_three_steps_past_two_friends(of_rules):
    # Enemy Archers wall off everything but a lane of two friendly Pikemen.
    e = engine_for(of_rules, [(6, 3, "N", "north"), (5, 3, "P", "north"), (4, 3, "P", "north"),
                              (5, 2, "B", "south"), (5, 4, "B", "south"), (4, 2, "B", "south"), (4, 4, "B", "south"),
                              (0, 4, "K", "south"), (7, 7, "K", "north")])
    quiet = orders_from(e, (6, 3), 0)
    assert quiet == {(3, 2), (3, 3), (3, 4)}                             # third step, past both friends
    assert {(5, 2), (5, 4), (4, 2), (4, 4)} <= orders_from(e, (6, 3), 1)  # and it may strike the Archers


def test_enemies_block_paths(of_rules):
    e = engine_for(of_rules, [(5, 3, "R", "north"), (4, 2, "P", "south"), (4, 3, "P", "south"), (4, 4, "P", "south"),
                              (0, 4, "K", "south"), (7, 7, "K", "north")])
    assert orders_from(e, (5, 3), 0) == set()
    assert orders_from(e, (5, 3), 1) == {(4, 2), (4, 3), (4, 4)}         # nothing beyond the screen


def test_attack_from_two_squares_moves_the_winner_in(of_rules):
    e = engine_for(of_rules, [(5, 3, "P", "north"), (3, 3, "B", "south"), (0, 4, "K", "south"), (7, 7, "K", "north")])
    event = e.apply((5, 3, 0, 3, 3, 1))
    assert event["capture"]["att_alive"] and e.state.board.grid[3][3].top.code == "P"
    assert e.state.board.grid[5][3].is_empty()


@pytest.mark.parametrize("origin,approach,attacker_lives,defender_lives", [
    ((5, 3), 2, False, True),      # straight ahead of the South defender: guarded front
    ((5, 5), 1, False, False),     # front diagonal, two squares out: both die
    ((3, 5), 4, True, False),      # flank two squares away: attacker wins
    ((1, 3), 8, True, False),      # from behind
])
def test_guarded_stance_uses_the_starting_square_at_range(of_rules, origin, approach, attacker_lives, defender_lives):
    e = engine_for(of_rules, [(*origin, "P", "north"), (3, 3, "P", "south"), (0, 7, "K", "south"), (7, 7, "K", "north"),
                              (0, 0, "R", "south"), (7, 0, "R", "north")])
    event = e.apply((*origin, 0, 3, 3, 1))
    assert event["approach"] == approach
    assert event["capture"]["att_alive"] == attacker_lives
    assert event["capture"]["top_alive"] == defender_lives


def test_class_counters_hold_at_full_reach(of_rules):
    e = engine_for(of_rules, [(6, 3, "N", "north"), (3, 3, "P", "south"), (0, 7, "K", "south"), (7, 7, "K", "north")])
    event = e.apply((6, 3, 0, 3, 3, 1))                                  # three squares, Pikeman counters Cavalry
    assert not event["capture"]["att_alive"] and e.state.board.grid[3][3].top.code == "P"


def test_king_keeps_one_step_and_never_attacks(of_rules):
    e = engine_for(of_rules, [(5, 3, "K", "north"), (0, 0, "K", "south"), (7, 0, "P", "north")])
    assert orders_from(e, (5, 3), 0) == {(4, 2), (4, 3), (4, 4)}
    peril = engine_for(of_rules, [(5, 3, "K", "north"), (3, 3, "P", "south"), (0, 0, "K", "south"), (7, 0, "P", "north")])
    assert orders_from(peril, (5, 3), 0) == {(r, c) for r in (4, 5, 6) for c in (2, 3, 4)} - {(5, 3)}
    assert not orders_from(peril, (5, 3), 1)


def test_priestess_contact_lets_both_steps_go_anywhere(of_rules):
    calm = engine_for(of_rules, [(4, 3, "Q", "north"), (0, 4, "K", "south"), (7, 7, "K", "north"), (0, 0, "P", "south")])
    assert all(r < 4 for r, _ in orders_from(calm, (4, 3), 0))         # advance only
    touched = engine_for(of_rules, [(4, 3, "Q", "north"), (3, 3, "P", "south"), (0, 4, "K", "south"), (7, 7, "K", "north")])
    quiet = orders_from(touched, (4, 3), 0)
    assert (6, 3) in quiet and (6, 1) in quiet and (4, 5) in quiet       # two steps back or sideways
    assert orders_from(touched, (4, 3), 1) == set()                       # no melee against a Pikeman


def test_priestess_attacks_only_priestess_or_king_at_reach(of_rules):
    board = Board(8, 8)
    for r, c, code, owner in [(4, 3, "Q", "north"), (2, 3, "K", "south"), (2, 5, "P", "south"), (7, 7, "K", "north")]:
        board.grid[r][c].add_unit(Unit(code, owner))
    got = {(a[3], a[4]) for a in gen_single_moves(GameState(board), load_ruleset(OF_PATH)) if a[:2] == (4, 3) and a[5] == 1}
    assert got == {(2, 3)}                                                # the King two squares away, never the Pikeman


@pytest.mark.parametrize("friend,allowed", [((5, 2), True), ((4, 4), True), ((3, 4), True), ((4, 5), False), (None, False)])
def test_power_shot_needs_a_neighbouring_archer(of_rules, friend, allowed):
    pieces = [(4, 3, "B", "north"), (3, 3, "R", "south"), (0, 7, "K", "south"), (7, 7, "K", "north"), (0, 0, "P", "south")]
    if friend:
        pieces.append((*friend, "B", "north"))
    e = engine_for(of_rules, pieces)
    assert ((3, 3) in orders_from(e, (4, 3), 2)) == allowed
    if allowed:
        event = e.apply((4, 3, 0, 3, 3, 2))
        assert event["ranged"] == {"killed": "R", "power_shot": True}
        assert e.state.board.grid[4][3].top.code == "B" and e.state.board.grid[3][3].is_empty()


def test_power_shot_never_targets_a_king_and_return_fire_is_unchanged(of_rules):
    e = engine_for(of_rules, [(4, 3, "B", "north"), (5, 3, "B", "north"), (3, 3, "K", "south"), (3, 4, "B", "south"),
                              (7, 7, "K", "north"), (0, 0, "P", "south")])
    assert (3, 3) not in orders_from(e, (4, 3), 2)
    event = e.apply((4, 3, 0, 3, 4, 2))
    assert [l["cause"] for l in event["losses"]] == ["ranged", "return_fire"]


def test_warp_targets_single_units_within_two(of_rules):
    e = engine_for(of_rules, [(4, 3, "Q", "north"), (2, 5, "R", "south"), (1, 3, "P", "south"), (0, 7, "K", "south"), (7, 7, "K", "north")])
    sources = {(a[0], a[1], a[2]) for a in e.legal_actions() if a[5] == 3}
    assert sources == {(2, 5, 0)}


def test_formations_are_rejected_and_never_created(of_rules):
    board = Board(8, 8)
    board.grid[4][3].add_unit(Unit("P", "north"))
    board.grid[4][3].add_unit(Unit("B", "north"))
    board.grid[7][7].add_unit(Unit("K", "north"))
    board.grid[0][7].add_unit(Unit("K", "south"))
    board.grid[0][0].add_unit(Unit("P", "south"))
    with pytest.raises(ValueError):
        Engine(rules=of_rules).set_state(GameState(board))
    e = Engine(rules=of_rules)
    assert gen_preparations(e.state, of_rules) == []


def test_observation_has_no_second_member(of_rules):
    e = Engine(rules=of_rules)
    obs = e.observe("north")
    assert obs.shape == (37, 8, 8)
    assert not obs[6:12].any() and not obs[18:24].any() and not obs[29:34].any()


# --------------------------------------------------------------------------- whole games

@pytest.mark.parametrize("north,south,seed", [
    (RandomAgent, RandomAgent, 1), (GreedyAgent, RandomAgent, 2), (RandomAgent, GreedyAgent, 3),
    (GreedyAgent, GreedyAgent, 4), (LookaheadAgent, GreedyAgent, 5), (RandomAgent, RandomAgent, 6),
])
def test_seeded_games_keep_open_field_invariants(of_rules, north, south, seed):
    for game in range(3):
        e = Engine(rules=of_rules)
        agents = {"north": north(seed * 10 + game), "south": south(seed * 10 + game + 5)}
        count = 32
        while not e.state.done and e.state.move_count < 256:
            action = agents[e.state.to_move].select(e)
            assert action[5] in (0, 1, 2, 3) and action[2] == 0
            assert decode_action(encode_action(*action)) == action
            event = e.apply(action)
            e.state.board.validate(formations=False)
            remaining = sum(1 for row in e.state.board.grid for sq in row for u in (sq.top, sq.bottom) if u)
            assert remaining == count - len(event["losses"])
            count = remaining
        assert e.state.reason in {None, "commander_capture", "lone_commander", "king_move_forfeit",
                                  "commander_retreat_forfeit", "threefold_repetition", "stagnation",
                                  "both_commanders_alone", "both_commanders_absent"}


def test_environments_accept_the_open_field_ruleset():
    from pettingzoo.test import api_test
    from implementation.age_of_chess.pettingzoo_env import age_of_chess_v1
    env = age_of_chess_v1(OF_PATH, max_plies=40)
    api_test(env, num_cycles=50)
    env = age_of_chess_v1(OF_PATH, max_plies=80)
    rng = random.Random(4)
    env.reset(seed=1)
    assert env.unwrapped.engine.rules.game.mode == "open_field"
    while not env.unwrapped.engine.state.done:
        ids = env.infos[env.agent_selection]["action_mask"].nonzero()[0]
        env.step(rng.choice(ids))
        env.unwrapped.engine.state.board.validate(formations=False)
