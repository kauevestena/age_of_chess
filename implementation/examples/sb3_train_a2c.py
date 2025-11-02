# A2C baseline without action masking (will sample illegal actions sometimes and get penalties)
import _script_setup  # noqa: F401

from stable_baselines3 import A2C
from gymnasium.wrappers import FlattenObservation
from implementation.age_of_chess.sb3_env import AOCSingleAgentSelfPlayEnv

def main():
    env = AOCSingleAgentSelfPlayEnv("rulesets/default.yaml")
    env = FlattenObservation(env)
    model = A2C("MlpPolicy", env, verbose=1, tensorboard_log="tb_logs/a2c")
    model.learn(total_timesteps=10_000)
    model.save("models/a2c_aoc.zip")
    print("Saved to models/a2c_aoc.zip")

if __name__ == "__main__":
    main()
