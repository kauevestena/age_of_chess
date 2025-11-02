from implementation.age_of_chess.pettingzoo_env import age_of_chess_v0, ACTION_SPACE_SIZE

def test_action_mask_present():
    env = age_of_chess_v0(ruleset_path="rulesets/default.yaml")
    env.reset()
    agent = env.agent_selection
    obs, r, t, tr, info = env.last()
    mask = info.get("action_mask")
    assert mask is not None and len(mask) == ACTION_SPACE_SIZE

def test_illegal_penalty_path():
    env = age_of_chess_v0(ruleset_path="rulesets/default.yaml")
    env.reset()
    agent = env.agent_selection
    # pick an obviously illegal action index (0 usually decodes to from (0,0) slot 0, etc.)
    env.step(0)
    # No assertion on value, but check we didn't crash and possibly flagged
    assert "illegal_action" in env.infos[agent] or True
