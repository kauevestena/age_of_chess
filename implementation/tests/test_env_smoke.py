import random
from pettingzoo.test import api_test
from gymnasium.utils.env_checker import check_env
from implementation.age_of_chess.pettingzoo_env import age_of_chess_v1
from implementation.age_of_chess.sb3_env import AOCSingleAgentSelfPlayEnv

def test_env_api():
    api_test(age_of_chess_v1(max_plies=40), num_cycles=50)

def test_gym_api():
    check_env(AOCSingleAgentSelfPlayEnv(max_plies=40), skip_render_check=True)

def test_dead_steps_and_reset():
    env = age_of_chess_v1(max_plies=2)
    env.reset()
    for _ in range(2):
        ids = env.infos[env.agent_selection]["action_mask"].nonzero()[0]
        env.step(ids[0])
    assert all(env.truncations.values())
    assert env.unwrapped.engine.state.winner is None
    for agent in env.agent_iter():
        assert env.last()[3]
        env.step(None)
    assert env.agents == []
    env.reset(seed=9)
    assert len(env.agents) == 2 and env.unwrapped.engine.state.move_count == 0

def test_masked_seeded_aec_play_has_no_illegal_actions():
    rng = random.Random(335)
    env = age_of_chess_v1(max_plies=120)
    for seed in range(4):
        env.reset(seed=seed)
        while not env.unwrapped.engine.state.done:
            ids = env.infos[env.agent_selection]["action_mask"].nonzero()[0]
            env.step(rng.choice(ids))
            env.unwrapped.engine.state.board.validate()
            assert all(not x.get("illegal_action") for x in env.infos.values())
