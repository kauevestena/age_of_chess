"""One learning side per episode, against an explicit opponent policy."""
import numpy as np
import gymnasium as gym
from .pettingzoo_env import age_of_chess_v1
from .agents import RandomAgent, GreedyAgent
from .utils import encode_action

class AOCSingleAgentSelfPlayEnv(gym.Env):
    """Fixed-opponent training, or self-play with a frozen opponent supplied by caller.

    `opponent_policy` is 'random', 'greedy', or a callable Engine -> action tuple.
    Each Gym step includes the opponent's reply and returns to the learning side.
    Colors are seeded-random per episode by default; set learner_side to fix one.
    """
    metadata = {"render_modes": []}

    def __init__(self, ruleset_path="rulesets/default.yaml", opponent_policy="random",
                 learner_side="alternate", max_plies=512):
        super().__init__()
        if learner_side not in ("north", "south", "alternate"):
            raise ValueError("Unknown learner side")
        if not callable(opponent_policy) and opponent_policy not in ("random", "greedy"):
            raise ValueError("Unknown opponent policy")
        self._pz = age_of_chess_v1(ruleset_path, max_plies=max_plies)
        self.action_space = self._pz.action_space("north")
        self.observation_space = self._pz.observation_space("north")
        self.opponent_policy, self.side_config = opponent_policy, learner_side
        self.learner_side = "north"

    def _opponent_move(self):
        engine = self._pz.unwrapped.engine
        action = self._opponent(engine)
        self._pz.step(encode_action(*action) if action is not None else None)
        return float(self._pz.rewards[self.learner_side])

    def reset(self, seed=None, options=None):
        super().reset(seed=seed)
        self._pz.reset(seed=seed, options=options)
        self.learner_side = (self.np_random.choice(["north", "south"]).item()
                             if self.side_config == "alternate" else self.side_config)
        opponent_seed = int(self.np_random.integers(0, 2**31))
        if callable(self.opponent_policy):
            self._opponent = self.opponent_policy
        else:
            cls = RandomAgent if self.opponent_policy == "random" else GreedyAgent
            self._opponent = cls(opponent_seed).select
        if self.learner_side == "south": self._opponent_move()
        return self._pz.observe(self.learner_side), self._pz.infos[self.learner_side]

    def get_action_mask(self):
        return self._pz.unwrapped.engine.action_mask().astype(bool)

    def step(self, action):
        engine = self._pz.unwrapped.engine
        if engine.state.done:
            raise RuntimeError("Episode finished; call reset")
        if self._pz.agent_selection != self.learner_side:
            raise RuntimeError("Expected learning side's turn")
        self._pz.step(action)
        reward = float(self._pz.rewards[self.learner_side])
        if not engine.state.done:
            reward += self._opponent_move()
        return (self._pz.observe(self.learner_side), reward, engine.state.terminated,
                engine.state.truncated, self._pz.infos[self.learner_side])

    def close(self): self._pz.close()
