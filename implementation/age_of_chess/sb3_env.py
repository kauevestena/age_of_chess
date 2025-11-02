from __future__ import annotations
from typing import Tuple, Dict, Any
import numpy as np
import gymnasium as gym

from .pettingzoo_env import age_of_chess_v0, ACTION_SPACE_SIZE

class AOCSingleAgentSelfPlayEnv(gym.Env):
    """
    Single-agent self-play Gym env on top of the PettingZoo AEC env.
    The single policy controls both sides alternately.
    MaskablePPO-compatible via ActionMasker wrapper.
    """
    metadata = {"render_modes": []}

    def __init__(self, ruleset_path: str):
        super().__init__()
        self._pz = age_of_chess_v0(ruleset_path=ruleset_path)
        self._pz.reset()
        self.action_space = gym.spaces.Discrete(ACTION_SPACE_SIZE)
        # Keep channel-first tensor
        self.observation_space = gym.spaces.Box(0,1,shape=(12,8,8), dtype=np.int8)
        self._last_rewards = {"north": 0.0, "south": 0.0}

    def reset(self, seed: int | None = None, options: Dict[str,Any] | None = None):
        super().reset(seed=seed)
        self._pz.reset(options=options or {})
        obs, _, _, _, info = self._pz.last()
        self._last_rewards = {"north": 0.0, "south": 0.0}
        return obs, info

    # Mask function for sb3-contrib ActionMasker
    def get_action_mask(self):
        agent = self._pz.agent_selection
        info = self._pz.infos[agent]
        mask = info.get("action_mask")
        if mask is None:
            # fallback to all ones
            mask = [1]*self.action_space.n
        return np.array(mask, dtype=np.int8)

    def step(self, action: int):
        # take one env step for the current agent
        before = self._pz.rewards.copy()
        self._pz.step(int(action))
        # compute scalar reward for single-agent: delta of acting agent minus opponent this step
        after = self._pz.rewards.copy()
        # identify who just played (opposite of current selection after step)
        acted = "south" if self._pz.agent_selection == "north" else "north"
        opp = "south" if acted == "north" else "north"
        r = (after[acted] - before[acted]) - (after[opp] - before[opp])
        # SB3 expects single termination/truncation booleans
        done = self._pz.terminations["north"] and self._pz.terminations["south"]
        truncated = self._pz.truncations["north"] or self._pz.truncations["south"]
        if not done and not truncated:
            obs, _, _, _, info = self._pz.last()
        else:
            # terminal obs is arbitrary; return last
            agent = self._pz.agent_selection if self._pz.agent_selection in self._pz.infos else acted
            obs = self._pz.observe(agent)
            info = self._pz.infos.get(agent, {})
        return obs, float(r), done, truncated, info
