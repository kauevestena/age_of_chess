import _script_setup  # noqa: F401

from implementation.age_of_chess.agents import RandomAgent
from implementation.age_of_chess.pettingzoo_env import age_of_chess_v0
from implementation.age_of_chess.utils import encode_action

def main():
    env = age_of_chess_v0(ruleset_path="rulesets/default.yaml")
    env.reset()
    random_agent = RandomAgent()
    episodes = 3
    for ep in range(episodes):
        env.reset()
        steps = 0
        while True:
            agent = env.agent_selection
            # RandomAgent keeps Warp from dominating: all Warps of one target are one option.
            choice = random_agent.select(env.unwrapped.engine)
            action = encode_action(*choice) if choice else env.action_space(agent).sample()
            env.step(action)
            steps += 1
            if env.unwrapped.engine.state.done:
                state = env.unwrapped.engine.state
                print(f"Episode {ep+1}: {steps} plies, winner={state.winner}, reason={state.reason}")
                break

if __name__ == "__main__":
    main()
