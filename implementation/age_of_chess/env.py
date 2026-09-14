"""Rules-v2 engine with atomic validation, ordered friendly stacks and adjudication."""
from __future__ import annotations
import copy
import numpy as np
from .rules_loader import load_ruleset
from .game_state import GameState, standard_setup
from .movegen import gen_single_moves, ALL_DIRS
from .combat import resolve_melee
from .utils import action_mask_from_legal, opponent, in_bounds, encode_action

OBSERVATION_SHAPE = (27, 8, 8)

class Engine:
    def __init__(self, ruleset_path="rulesets/default.yaml", *, rules=None):
        self.rules = rules if rules is not None else load_ruleset(ruleset_path)
        self.state = GameState(standard_setup())
        self.state.position_counts[self.state.position_key()] = 1

    def clone(self):
        result = copy.copy(self)
        result.state = self.state.copy()
        return result

    def set_state(self, state):
        """Load a study position, reset repetition history and settle automatic effects."""
        if (state.board.rows, state.board.cols) != (8, 8) or state.to_move not in ("north", "south"):
            raise ValueError("Invalid study position")
        state.board.validate()
        self.state = state.copy()
        self.state.terminated = self.state.truncated = False
        self.state.winner = self.state.reason = None
        self.state.position_counts = {}
        self._priestess_deaths([])
        self.state.position_counts[self.state.position_key()] = 1
        self._adjudicate()

    def _material(self):
        values = {code: piece.value for code, piece in self.rules.game.pieces.items()}
        totals = {"north": 0.0, "south": 0.0}
        for row in self.state.board.grid:
            for sq in row:
                for u in (sq.top, sq.bottom):
                    if u: totals[u.side] += values[u.code]
        return totals

    def legal_actions_unfiltered(self):
        return gen_single_moves(self.state, self.rules)

    def immediate_own_deaths(self, action):
        fr, fc, slot, tr, tc, kind = action
        src, dst = self.state.board.grid[fr][fc], self.state.board.grid[tr][tc]
        actor = (src.top, src.bottom)[slot]
        if kind == 1:
            alive, top, bottom = resolve_melee(actor, dst.top, dst.bottom, self.rules)
            if not alive:
                return [actor.code]
            # A surviving Q can only advance if the defender square is cleared.
            arrives = not top and not bottom
        else:
            arrives = kind == 0
        if actor.code == "Q" and arrives:
            for dr, dc in ALL_DIRS:
                rr, cc = tr+dr, tc+dc
                if in_bounds(rr, cc):
                    sq = self.state.board.grid[rr][cc]
                    if any(u and u.code == "Q" and u.side != actor.side for u in (sq.top, sq.bottom)):
                        return ["Q"]
        return []

    def legal_actions(self):
        actions = self.legal_actions_unfiltered()
        if not actions or not self.rules.game.minimal_loss.enabled:
            return actions
        scores = []
        order = self.rules.game.minimal_loss.preserve_order
        for a in actions:
            dead = self.immediate_own_deaths(a)
            if not dead:
                return actions
            score = (dead.count("K"), len(dead), *(dead.count(code) for code in order))
            scores.append((score, a))
        best = min(score for score, _ in scores)
        return [a for score, a in scores if score == best]

    def action_mask(self):
        return action_mask_from_legal(self.legal_actions())

    def kings_present(self):
        return {side: any(u and u.code == "K" and u.side == side
                         for row in self.state.board.grid for sq in row
                         for u in (sq.top, sq.bottom)) for side in ("north", "south")}

    def winner_if_any(self):
        return self.state.winner

    def observe(self, agent):
        if agent not in ("north", "south"): raise ValueError("Unknown side")
        obs = np.zeros(OBSERVATION_SHAPE, dtype=np.float32)
        for r, row in enumerate(self.state.board.grid):
            for c, sq in enumerate(row):
                for slot, unit in enumerate((sq.top, sq.bottom)):
                    if unit:
                        channel = (0 if unit.side == agent else 12) + 6*slot + "PNBRQK".index(unit.code)
                        obs[channel, r, c] = 1
        # Absolute coordinates match action IDs. Side/direction and turn are explicit.
        obs[24] = float(agent == "north")
        obs[25] = float(agent == self.state.to_move)
        count = self.state.position_counts.get(self.state.position_key(), 0)
        obs[26] = min(count/self.rules.game.repetition_draw, 1.0)
        return obs

    def _priestess_deaths(self, losses):
        queens = [(r, c, slot, u) for r, row in enumerate(self.state.board.grid)
                  for c, sq in enumerate(row) for slot, u in enumerate((sq.top, sq.bottom))
                  if u and u.code == "Q"]
        doomed = set()
        for r, c, slot, q in queens:
            if any(other.side != q.side and max(abs(r-rr), abs(c-cc)) == 1
                   for rr, cc, _, other in queens):
                doomed.add((r, c, slot))
        for r, c, slot in sorted(doomed, reverse=True):
            q = self.state.board.grid[r][c].remove_unit("bottom" if slot else "top")
            losses.append({"code": q.code, "side": q.side, "cause": "priestess_adjacency"})

    def _adjudicate(self):
        seen = self.kings_present()
        if not all(seen.values()):
            self.state.terminated = True
            self.state.winner = next((side for side, present in seen.items() if present), "draw")
            self.state.reason = "commander_capture" if any(seen.values()) else "both_commanders_absent"
        elif not self.legal_actions_unfiltered():
            self.forfeit(self.state.to_move, "stagnation")
        elif self.state.position_counts.get(self.state.position_key(), 0) >= self.rules.game.repetition_draw:
            self.state.terminated = True
            self.state.winner, self.state.reason = "draw", "threefold_repetition"

    def forfeit(self, side, reason="illegal_action"):
        self.state.terminated = True
        self.state.winner, self.state.reason = opponent(side), reason

    def truncate(self, reason="ply_limit"):
        if not self.state.terminated:
            self.state.truncated, self.state.reason = True, reason
            self.state.winner = None

    def apply(self, action):
        """Reject malformed/illegal actions before changing any state."""
        try:
            action = tuple(action)
            encode_action(*action)
        except (ValueError, TypeError, OverflowError) as exc:
            raise ValueError("Malformed action") from exc
        if action not in self.legal_actions():
            raise ValueError("Illegal action")
        return self._apply_unchecked(action)

    def _apply_on_copy(self, action):
        clone = self.clone()
        clone.apply(action)
        return clone

    def _apply_unchecked(self, action):
        """Internal transition for previously generated actions (search and tests)."""
        fr, fc, slot, tr, tc, kind = action
        src, dst = self.state.board.grid[fr][fc], self.state.board.grid[tr][tc]
        actor = (src.top, src.bottom)[slot]
        side, code = actor.side, actor.code
        event = {"atype": kind, "actor": code, "player": side,
                 "from": (fr, fc), "to": (tr, tc), "slot": slot, "losses": []}
        def remove(square, which, cause):
            u = square.remove_unit(which)
            event["losses"].append({"code": u.code, "side": u.side, "cause": cause})
            return u
        if kind == 0:
            dst.add_unit(src.remove_unit("bottom" if slot else "top"))
        elif kind == 1:
            top_code, bottom_code = dst.top.code, dst.bottom.code if dst.bottom else None
            alive, top_alive, bottom_alive = resolve_melee(actor, dst.top, dst.bottom, self.rules)
            event["capture"] = {"def_top": top_code, "def_bottom": bottom_code,
                                "att_alive": alive, "top_alive": top_alive, "bottom_alive": bottom_alive}
            if dst.bottom and not bottom_alive: remove(dst, "bottom", "melee")
            if not top_alive: remove(dst, "top", "melee")
            if not alive:
                remove(src, "bottom" if slot else "top", "melee")
            elif dst.is_empty():
                dst.add_unit(src.remove_unit("bottom" if slot else "top"))
            # Otherwise attacker remains in the original slot; no mixed stack.
        elif kind == 2:
            killed = remove(dst, "top", "ranged")
            normal_targets = {c for a in self.rules.game.pieces[code].abilities
                              if a.name == "ranged" for c in a.targets}
            event["ranged"] = {"killed": killed.code, "power_shot": killed.code not in normal_targets}
        elif kind == 3:
            event["convert"] = {"converted": dst.top.code, "previous_side": dst.top.side}
            dst.top.side = side
        self._priestess_deaths(event["losses"])
        self.state.to_move = opponent(side)
        self.state.move_count += 1
        key = self.state.position_key()
        self.state.position_counts[key] = self.state.position_counts.get(key, 0)+1
        self._adjudicate()
        event["winner"], event["reason"] = self.state.winner, self.state.reason
        return event
