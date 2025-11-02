from __future__ import annotations
from typing import List, Tuple, Optional, Dict, Any
import numpy as np
import copy
from .rules_loader import load_ruleset, Ruleset
from .game_state import GameState, standard_setup
from .movegen import gen_single_moves, Action
from .combat import resolve_melee
from .utils import action_mask_from_legal

VAL = {"P":1,"N":3,"B":3,"R":5,"Q":4,"K":1000}

class Engine:
    def __init__(self, ruleset_path: str):
        self.rules: Ruleset = load_ruleset(ruleset_path)
        rows = self.rules.game.board["rows"]
        cols = self.rules.game.board["cols"]
        board = standard_setup(rows, cols)
        self.state = GameState(board=board, to_move="north")

    # ---------- Helpers ----------
    def _material(self) -> Dict[str,int]:
        tot = {"north":0,"south":0}
        for r in range(self.state.board.rows):
            for c in range(self.state.board.cols):
                sq = self.state.board.grid[r][c]
                for u in [sq.top, sq.bottom]:
                    if u:
                        tot[u.side] += VAL.get(u.code,0)
        return tot

    def _apply_on_copy(self, a: Action) -> "Engine":
        e2 = copy.deepcopy(self)
        e2.apply(a)
        return e2

    # ---------- Rules ----------
    def legal_actions_unfiltered(self) -> List[Action]:
        return gen_single_moves(self.state, self.rules)

    def legal_actions(self) -> List[Action]:
        acts = self.legal_actions_unfiltered()
        if not acts:
            return acts
        # Minimal-loss enforcement if enabled
        ml = self.rules.game.turn.get("minimal_loss_rule", {}).get("enabled", False)
        if not ml:
            return acts
        before = self._material()
        side_now = self.state.to_move
        scored = []
        for a in acts:
            try:
                e2 = self._apply_on_copy(a)
                after = e2._material()
                own_loss = before[side_now] - after[side_now]
                opp_loss = before["south" if side_now=="north" else "north"] - after["south" if side_now=="north" else "north"]
                scored.append((own_loss, -opp_loss, a))
            except Exception:
                continue
        if not scored:
            return acts
        min_own_loss = min(s[0] for s in scored)
        if min_own_loss <= 0:
            return [s[2] for s in scored]
        best = [s for s in scored if s[0] == min_own_loss]
        best.sort()
        return [s[2] for s in best]

    def action_mask(self) -> List[int]:
        return action_mask_from_legal(self.legal_actions())

    def kings_present(self) -> dict:
        seen = {"north": False, "south": False}
        for r in range(self.state.board.rows):
            for c in range(self.state.board.cols):
                sq = self.state.board.grid[r][c]
                for u in [sq.top, sq.bottom]:
                    if u and u.code == "K":
                        seen[u.side] = True
        return seen

    def observe(self, agent: str) -> np.ndarray:
        """Return a channel-first binary tensor encoding board occupancy from the agent's perspective."""
        rows = self.state.board.rows
        cols = self.state.board.cols
        obs = np.zeros((12, rows, cols), dtype=np.int8)
        own = agent
        opp = "south" if agent == "north" else "north"
        code_to_idx = {"P": 0, "N": 1, "B": 2, "R": 3, "Q": 4, "K": 5}

        for r in range(rows):
            for c in range(cols):
                sq = self.state.board.grid[r][c]
                for unit in filter(None, (sq.top, sq.bottom)):
                    channel_offset = 0 if unit.side == own else 6
                    idx = channel_offset + code_to_idx.get(unit.code, 0)
                    rr, cc = (rows - 1 - r, cols - 1 - c) if agent == "south" else (r, c)
                    obs[idx, rr, cc] = 1

        return obs

    def winner_if_any(self) -> Optional[str]:
        seen = self.kings_present()
        if seen["north"] and not seen["south"]:
            return "north"
        if seen["south"] and not seen["north"]:
            return "south"
        if (not seen["north"]) and (not seen["south"]):
            return "draw"
        return None

    def apply(self, action: Action) -> Dict[str, Any]:
        """Apply action and return event info for reward shaping/logging."""
        fr, fc, slot, tr, tc, atype = action
        src = self.state.board.grid[fr][fc]
        u = src.top if slot == 0 else src.bottom
        if u is None or u.side != self.state.to_move:
            raise ValueError("Illegal source unit")
        moved_code = u.code
        moved_side = u.side
        # detect power-shot eligibility before removal
        is_power_archer = False
        if moved_code == "B":
            if slot == 0 and src.bottom is not None and src.bottom.code == "B":
                is_power_archer = True
            if slot == 1 and src.top is not None and src.top.code == "B":
                is_power_archer = True

        # remove from source
        moved = src.remove_unit("top" if slot == 0 else "bottom")
        dst = self.state.board.grid[tr][tc]

        event: Dict[str, Any] = {"atype": atype, "actor": moved_code, "from": (fr,fc), "to": (tr,tc), "slot": slot}

        if atype == 0:  # move/stack
            if dst.top and dst.top.side == moved.side and dst.bottom is None:
                dst.bottom = moved
            else:
                if dst.top is None:
                    dst.top = moved
                else:
                    raise ValueError("Illegal move stacking")

        elif atype == 1:  # melee
            if dst.top is None or dst.top.side == moved.side:
                raise ValueError("Illegal capture")
            def_top_code = dst.top.code
            def_bottom_code = dst.bottom.code if dst.bottom else None
            att_alive, top_alive, bottom_alive = resolve_melee(moved, dst.top, dst.bottom)
            dst_top, dst_bottom = dst.top, dst.bottom
            dst.top = dst_top if top_alive else None
            dst.bottom = dst_bottom if bottom_alive else None
            event["capture"] = {"def_top": def_top_code, "def_bottom": def_bottom_code, "att_alive": att_alive, "top_alive": top_alive, "bottom_alive": bottom_alive}
            if att_alive:
                if dst.top is None:
                    dst.top = moved
                elif dst.bottom is None:
                    dst.bottom = moved

        elif atype == 2:  # ranged
            if dst.top is None or dst.top.side == moved.side:
                raise ValueError("Illegal ranged")
            killed_code = dst.top.code
            dst.top = None
            if dst.bottom is not None:
                dst.top, dst.bottom = dst.bottom, None
            # put archer back
            if src.top is None:
                src.top = moved
            elif src.bottom is None:
                src.bottom = moved
            else:
                raise RuntimeError("Source overfull after ranged")
            event["ranged"] = {"killed": killed_code, "power_shot": bool(is_power_archer and killed_code in ("N","R"))}

        elif atype == 3:  # convert
            if dst.top is None or dst.bottom is not None or dst.top.side == moved.side:
                raise ValueError("Illegal convert target")
            converted_code = dst.top.code
            dst.top.side = moved.side
            if src.top is None:
                src.top = moved
            elif src.bottom is None:
                src.bottom = moved
            event["convert"] = {"converted": converted_code}
        else:
            raise ValueError("Unknown action type")

        # swap side
        self.state.to_move = "south" if self.state.to_move == "north" else "north"
        self.state.move_count += 1
        return event
