
# MaskablePPO training with checkpoint snapshots and auto mini-league vs previous checkpoint.
import _script_setup  # noqa: F401

import os, time, glob
from sb3_contrib import MaskablePPO
from sb3_contrib.common.wrappers import ActionMasker
from gymnasium.wrappers import FlattenObservation
from stable_baselines3.common.callbacks import BaseCallback
from implementation.age_of_chess.sb3_env import AOCSingleAgentSelfPlayEnv
from implementation.league.round_robin import run_league

def mask_fn(env):
    return env.get_action_mask()

class LeagueCallback(BaseCallback):
    def __init__(self, check_freq: int = 10000, save_dir: str = "models/checkpoints", verbose: int = 0):
        super().__init__(verbose)
        self.check_freq = check_freq
        self.save_dir = save_dir
        os.makedirs(save_dir, exist_ok=True)
        self.last_ckpt = None

    def _on_step(self) -> bool:
        if self.n_calls % self.check_freq == 0:
            path = os.path.join(self.save_dir, f"mppo_{self.n_calls}.zip")
            self.model.save(path)
            # Run a tiny league among Greedy, Random, previous ckpt (if any) and this one
            # Copy to models/ so league can auto-discover
            os.makedirs("models", exist_ok=True)
            import shutil
            tgt = os.path.join("models", os.path.basename(path))
            shutil.copyfile(path, tgt)
            if self.last_ckpt is not None:
                try:
                    run_league(games_per_pair=2, models_dir="models", out_dir="logs/league")
                except Exception as e:
                    print("League run skipped due to error:", e)
            self.last_ckpt = tgt
        return True

def main():
    env = AOCSingleAgentSelfPlayEnv("rulesets/default.yaml")
    env = FlattenObservation(env)
    env = ActionMasker(env, mask_fn)
    model = MaskablePPO("MlpPolicy", env, verbose=1, tensorboard_log="tb_logs/mppo_league")
    cb = LeagueCallback(check_freq=5000)
    model.learn(total_timesteps=20000, callback=cb)
    model.save("models/mppo_league_final.zip")
    print("Saved final model to models/mppo_league_final.zip")

if __name__ == "__main__":
    main()
