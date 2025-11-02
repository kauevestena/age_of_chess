from implementation.age_of_chess.pettingzoo_env import age_of_chess_v0

def test_env_smoke():
    env = age_of_chess_v0(ruleset_path="rulesets/default.yaml")
    env.reset()
    for _ in range(4):
        agent = env.agent_selection
        action = env.action_space(agent).sample()
        env.step(action)
    assert True
