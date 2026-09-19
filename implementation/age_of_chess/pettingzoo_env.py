from __future__ import annotations
import numpy as np
from gymnasium import spaces
from gymnasium.utils import seeding
from pettingzoo import AECEnv
from pettingzoo.utils import wrappers
from .env import Engine, OBSERVATION_SHAPE
from .utils import ACTION_SPACE_SIZE, decode_action, opponent

AGENTS = ("north", "south")

class RawAgeOfChess(AECEnv):
    metadata = {"name": "age_of_chess_v1", "render_modes": [], "is_parallelizable": False}

    def __init__(self, ruleset_path="rulesets/default.yaml", max_plies=512):
        super().__init__()
        if max_plies is not None and max_plies < 1:
            raise ValueError("max_plies must be positive or None")
        self.ruleset_path, self.max_plies = ruleset_path, max_plies
        self.engine = Engine(ruleset_path)
        self.possible_agents = list(AGENTS)
        self.agents = []
        self._action_spaces = {a: spaces.Discrete(ACTION_SPACE_SIZE) for a in AGENTS}
        self._observation_spaces = {a: spaces.Box(0, 1, OBSERVATION_SHAPE, dtype=np.float32) for a in AGENTS}

    def action_space(self, agent): return self._action_spaces[agent]
    def observation_space(self, agent): return self._observation_spaces[agent]

    def reset(self, seed=None, options=None):
        self.np_random, _ = seeding.np_random(seed)
        if options and "ruleset_path" in options:
            self.ruleset_path = options["ruleset_path"]
        self.engine = Engine(self.ruleset_path)
        self.agents = list(AGENTS)
        self.rewards = {a: 0.0 for a in AGENTS}
        self._cumulative_rewards = {a: 0.0 for a in AGENTS}
        self.terminations = {a: False for a in AGENTS}
        self.truncations = {a: False for a in AGENTS}
        self.infos = {a: {} for a in AGENTS}
        self.agent_selection, self._skip_agent_selection = "north", None
        self.history = []
        for i, a in enumerate(AGENTS):
            if seed is not None: self._action_spaces[a].seed(seed+i)
        self._refresh_infos()

    def _refresh_infos(self):
        mask = self.engine.action_mask()
        for a in self.agents:
            self.infos[a] = {
                "action_mask": mask.copy() if a == self.engine.state.to_move else np.zeros_like(mask),
                "winner": self.engine.state.winner,
                "reason": self.engine.state.reason,
                "move_count": self.engine.state.move_count,
                "rules_version": self.engine.rules.game.version,
                "commander_retreat_counts": self.engine.state.retreat_counts.copy(),
                "king_move_counts": self.engine.state.king_moves.copy(),
                "repetition_count": self.engine.state.position_counts.get(self.engine.state.position_key(), 0),
                # Full repetition history is available to search/recurrent policies.
                "position_counts": self.engine.state.position_counts.copy(),
            }

    def observe(self, agent): return self.engine.observe(agent)
    def state(self): return self.engine.observe("north")
    def close(self): pass

    def step(self, action):
        acted = self.agent_selection
        if self.terminations[acted] or self.truncations[acted]:
            self._was_dead_step(action)
            return
        self._cumulative_rewards[acted] = 0.0
        self._clear_rewards()
        illegal = False
        try:
            decoded = decode_action(action)
            if decoded not in self.engine.legal_actions():
                illegal = True
        except (TypeError, ValueError, OverflowError):
            illegal = True
        if illegal:
            self.engine.forfeit(acted)
        else:
            self.history.append(self.engine.apply(decoded))
            if self.max_plies is not None and self.engine.state.move_count >= self.max_plies:
                self.engine.truncate()
        state = self.engine.state
        for a in self.agents:
            self.terminations[a], self.truncations[a] = state.terminated, state.truncated
        if state.winner in AGENTS:
            self.rewards[state.winner] = self.engine.rules.rewards.win
            self.rewards[opponent(state.winner)] = self.engine.rules.rewards.loss
        self.agent_selection = state.to_move
        self._refresh_infos()
        if illegal: self.infos[acted]["illegal_action"] = True
        self._accumulate_rewards()
        self._deads_step_first()

def age_of_chess_v1(ruleset_path="rulesets/default.yaml", max_plies=512):
    return wrappers.OrderEnforcingWrapper(RawAgeOfChess(ruleset_path, max_plies))

# Import compatibility only: rules v5 and 41-plane observations require retraining.
def age_of_chess_v0(ruleset_path="rulesets/default.yaml", max_plies=512):
    return age_of_chess_v1(ruleset_path, max_plies)
