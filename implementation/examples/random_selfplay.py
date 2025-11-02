import sys
from pathlib import Path

if __package__ is None or __package__ == "":
    sys.path.append(str(Path(__file__).resolve().parents[2]))

import random
from implementation.age_of_chess.pettingzoo_env import age_of_chess_v0

def main():
    env = age_of_chess_v0(ruleset_path="rulesets/default.yaml")
    env.reset()
    episodes = 3
    for ep in range(episodes):
        env.reset()
        steps = 0
        while True:
            agent = env.agent_selection
            info = env.infos[agent]
            mask = info.get("action_mask")
            legal_idxs = [i for i, m in enumerate(mask) if m] if mask is not None else None
            if legal_idxs:
                action = random.choice(legal_idxs)
            else:
                action = env.action_space(agent).sample()
            env.step(action)
            steps += 1
            if env.terminations["north"] and env.terminations["south"]:
                print(f"Episode {ep+1} finished in {steps} steps. Rewards:", env.rewards)
                break

if __name__ == "__main__":
    main()
