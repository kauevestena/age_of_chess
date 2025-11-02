from __future__ import annotations
import numpy as np
from typing import Dict, Any, List
from pettingzoo import AECEnv
from pettingzoo.utils import wrappers
from gymnasium import spaces

from .env import Engine
from .rules_loader import load_ruleset
from .utils import decode_action

AGENTS = ("north","south")
ACTION_SPACE_SIZE = 8*8*2*4*8*8

class RawAgeOfChess(AECEnv):
    metadata = {"name": "age_of_chess_v0"}

    def __init__(self, ruleset_path: str):
        super().__init__()
        self.ruleset_path = ruleset_path
        self.engine = Engine(ruleset_path)
        import yaml
        with open(ruleset_path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
        self.rewards_cfg = data.get("rewards", {"win":1.0,"loss":-1.0,"draw":0.0,"illegal":-0.01,"step":0.0})
        self.agents = list(AGENTS)
        self.possible_agents = list(AGENTS)
        self.rewards = {a: 0.0 for a in AGENTS}
        self.terminations = {a: False for a in AGENTS}
        self.truncations = {a: False for a in AGENTS}
        self.infos = {a: {} for a in AGENTS}
        self.agent_selection = "north"
        self._action_spaces = {a: spaces.Discrete(ACTION_SPACE_SIZE) for a in AGENTS}
        self._observation_spaces = {a: spaces.Box(0, 1, shape=(12,8,8), dtype=np.int8) for a in AGENTS}
        self.history: List[Dict[str,Any]] = []  # record moves/events

    def observation_space(self, agent):
        return self._observation_spaces[agent]

    def action_space(self, agent):
        return self._action_spaces[agent]

    def reset(self, seed: int | None = None, options: Dict[str,Any] | None = None):
        if options and "ruleset_path" in options:
            self.ruleset_path = options["ruleset_path"]
        self.engine = Engine(self.ruleset_path)
        import yaml
        with open(self.ruleset_path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
        self.rewards_cfg = data.get("rewards", {"win":1.0,"loss":-1.0,"draw":0.0,"illegal":-0.01,"step":0.0,"events":{}})
        self.agents = list(AGENTS)
        for a in AGENTS:
            self.rewards[a] = 0.0
            self.terminations[a] = False
            self.truncations[a] = False
            self.infos[a] = {"action_mask": self.engine.action_mask()}
        self.agent_selection = "north"
        self.history = []

    def observe(self, agent):
        obs = self.engine.observe(agent)
        self.infos[agent]["action_mask"] = self.engine.action_mask()
        return obs

    def last(self):
        agent = self.agent_selection
        obs = self.observe(agent)
        return obs, self.rewards[agent], self.terminations[agent], self.truncations[agent], self.infos[agent]

    def close(self): pass

    def _end_with_winner(self, winner: str | None):
        if winner == "draw":
            self.terminations["north"] = True
            self.terminations["south"] = True
            for a in AGENTS:
                self.rewards[a] += float(self.rewards_cfg.get("draw", 0.0))
            self._accumulate_rewards()
            return
        if winner in ("north","south"):
            loser = "south" if winner == "north" else "north"
            self.terminations["north"] = True
            self.terminations["south"] = True
            self.rewards[winner] += float(self.rewards_cfg.get("win", 1.0))
            self.rewards[loser] += float(self.rewards_cfg.get("loss", -1.0))
            self._accumulate_rewards()

        def _apply_event_rewards(self, actor: str, event: dict):
        events_cfg = self.rewards_cfg.get("events", {})
        penalties = events_cfg.get("penalties", {})
        opp = "south" if self.agent_selection == "north" else "north"

        # Bonuses for positive actions
        if "capture" in event:
            by_attacker = events_cfg.get("capture", {}).get("by_attacker", {})
            default_cap = float(events_cfg.get("capture", {}).get("default", 0.0))
            bonus = float(by_attacker.get(actor, default_cap))
            self.rewards[self.agent_selection] += bonus
        if "convert" in event:
            conv = float(events_cfg.get("conversion", 0.0))
            self.rewards[self.agent_selection] += conv
        if "ranged" in event:
            rng = event["ranged"]
            if rng.get("power_shot"):
                ps = float(events_cfg.get("power_shot_kill", 0.0))
                self.rewards[self.agent_selection] += ps
            else:
                rk = float(events_cfg.get("ranged_kill", 0.0))
                self.rewards[self.agent_selection] += rk

        # Penalties for losses
        unit_loss = float(penalties.get("unit_loss_default", 0.0))
        king_loss = float(penalties.get("king_loss", 0.0))
        death_on_charge = float(penalties.get("death_on_charge", 0.0))

        # Attacker death (usually from melee)
        if "capture" in event:
            cap = event["capture"]
            if cap.get("att_alive") is False:
                # penalize actor
                self.rewards[self.agent_selection] += unit_loss
                # specific: cavalry charging pikes
                if actor == "N" and cap.get("def_top") == "P":
                    self.rewards[self.agent_selection] += death_on_charge

            # Defender losses (top / bottom)
            if cap.get("top_alive") is False:
                # penalize opponent for losing top unit
                if cap.get("def_top") == "K":
                    self.rewards[opp] += king_loss
                else:
                    self.rewards[opp] += unit_loss
            if cap.get("bottom_alive") is False and cap.get("def_bottom") is not None:
                # penalize opponent for losing bottom unit
                if cap.get("def_bottom") == "K":
                    self.rewards[opp] += king_loss
                else:
                    self.rewards[opp] += unit_loss

        # Ranged defender loss
        if "ranged" in event:
            killed = event["ranged"].get("killed")
            if killed == "K":
                self.rewards[opp] += king_loss
            else:
                self.rewards[opp] += unit_loss


    def step(self, action):
        if self.terminations[self.agent_selection] or self.truncations[self.agent_selection]:
            self._was_dead_step(action)
            return

        legal = self.engine.legal_actions()
        decoded = decode_action(int(action))
        if decoded not in legal:
            self.rewards[self.agent_selection] += float(self.rewards_cfg.get("illegal", -0.01))
            self.infos[self.agent_selection]["illegal_action"] = True
            if not legal:
                loser = self.agent_selection
                winner = "south" if loser == "north" else "north"
                self._end_with_winner(winner)
                return
            decoded = sorted(legal)[0]

        # per-step shaping
        step_bonus = float(self.rewards_cfg.get("step", 0.0))
        if step_bonus != 0.0:
            self.rewards[self.agent_selection] += step_bonus

        # Apply and get event info
        event = self.engine.apply(decoded)
        event["player"] = self.agent_selection
        self.history.append(event)

        # Event rewards
        self._apply_event_rewards(event.get("actor",""), event)

        # King presence / terminal
        winner = self.engine.winner_if_any()
        if winner is not None:
            self._end_with_winner(winner)
            return

        # Alternate
        self.agent_selection = "south" if self.agent_selection == "north" else "north"
        for a in AGENTS:
            self.infos[a]["action_mask"] = self.engine.action_mask()
        self._accumulate_rewards()

def age_of_chess_v0(ruleset_path: str):
    return wrappers.OrderEnforcingWrapper(RawAgeOfChess(ruleset_path))
