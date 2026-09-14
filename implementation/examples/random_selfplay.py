import _script_setup  # noqa: F401

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
            if env.unwrapped.engine.state.done:
                state = env.unwrapped.engine.state
                print(f"Episode {ep+1}: {steps} plies, winner={state.winner}, reason={state.reason}")
                break

if __name__ == "__main__":
    main()
