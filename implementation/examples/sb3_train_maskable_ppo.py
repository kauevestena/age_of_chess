# Train MaskablePPO (sb3-contrib) in self-play with action masks
import _script_setup  # noqa: F401

from sb3_contrib import MaskablePPO
from sb3_contrib.common.wrappers import ActionMasker
from gymnasium.wrappers import FlattenObservation
from implementation.age_of_chess.sb3_env import AOCSingleAgentSelfPlayEnv

def mask_fn(env):
    return env.get_action_mask()

def main():
    env = AOCSingleAgentSelfPlayEnv("rulesets/default.yaml")
    # Keep channel-first obs (12,8,8); MaskablePPO MlpPolicy can handle non-flat obs,
    # but for stability we flatten.
    env = FlattenObservation(env)
    env = ActionMasker(env, mask_fn)
    model = MaskablePPO("MlpPolicy", env, verbose=1, tensorboard_log="tb_logs/mppo")
    model.learn(total_timesteps=10_000)
    model.save("models/mppo_aoc.zip")
    print("Saved to models/mppo_aoc.zip")

if __name__ == "__main__":
    main()
