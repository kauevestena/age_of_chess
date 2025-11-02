from implementation.age_of_chess.pettingzoo_env import age_of_chess_v0
from implementation.age_of_chess.env import Engine
from implementation.age_of_chess.utils import encode_action
from implementation.age_of_chess.agents import GreedyAgent

def legal_to_index(engine: Engine, action):
    fr,fc,slot, tr,tc,atype = action
    from implementation.age_of_chess.utils import encode_action
    return encode_action(fr,fc,slot,atype,tr,tc)

def main():
    env = age_of_chess_v0(ruleset_path="rulesets/default.yaml")
    env.reset()
    agent_impl = {"north": GreedyAgent(), "south": GreedyAgent()}
    episodes = 2
    for ep in range(episodes):
        env.reset()
        steps = 0
        while True:
            agent = env.agent_selection
            obs, reward, term, trunc, info = env.last()
            # Build Engine view (we can access internal engine from wrapper for demo via env.unwrapped.engine)
            engine = env.unwrapped.engine
            legal = engine.legal_actions()
            if not legal:
                print(f"Episode {ep+1}: no legal moves for {agent}")
                break
            act_tuple = agent_impl[agent].select(engine)
            idx = legal_to_index(engine, act_tuple)
            env.step(idx)
            steps += 1
            if env.terminations["north"] and env.terminations["south"]:
                print(f"Episode {ep+1} finished in {steps} steps. Rewards:", env.rewards)
                break

if __name__ == "__main__":
    main()
