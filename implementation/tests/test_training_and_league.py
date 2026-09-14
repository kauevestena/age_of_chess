import pytest
from implementation.age_of_chess.sb3_env import AOCSingleAgentSelfPlayEnv
from implementation.age_of_chess.utils import encode_action
from implementation.league.elo import score_for_north, compute_elo
from implementation.league.round_robin import play_game, RandomPolicy

@pytest.mark.parametrize("side",["north","south"])
def test_training_commander_capture_reward_is_positive(position,side):
    env=AOCSingleAgentSelfPlayEnv(learner_side=side)
    env.reset(seed=4)
    other="south" if side=="north" else "north"
    fr,tr=(4,3) if side=="north" else (3,4)
    e=position([(fr,3,"P",side),(tr,3,"K",other)],side=side)
    env._pz.unwrapped.engine=e
    env._pz.unwrapped.agent_selection=side
    _,reward,done,truncated,_=env.step(encode_action(fr,3,0,tr,3,1))
    assert reward==1 and done and not truncated

def test_opponent_reply_loss_is_assigned_to_learner(position):
    reply=lambda e:(3,3,0,4,3,1)
    env=AOCSingleAgentSelfPlayEnv(learner_side="north",opponent_policy=reply)
    env.reset(seed=5)
    env._pz.unwrapped.engine=position([(4,3,"K","north"),(3,3,"P","south"),(6,0,"P","north")])
    _,reward,done,_,_=env.step(encode_action(6,0,0,5,0,0))
    assert reward==-1 and done

def test_training_step_returns_to_same_learning_side():
    env=AOCSingleAgentSelfPlayEnv(learner_side="south")
    env.reset(seed=6)
    assert env._pz.unwrapped.engine.state.move_count==1
    action=env.get_action_mask().nonzero()[0][0]
    _,reward,done,trunc,_=env.step(action)
    assert not done and not trunc and reward==0
    assert env._pz.agent_selection=="south"
    assert env._pz.unwrapped.engine.state.move_count==3

def test_no_farmable_conversion_bonus(position):
    from implementation.age_of_chess.pettingzoo_env import age_of_chess_v1
    env=age_of_chess_v1();env.reset()
    env.unwrapped.engine=position([(4,2,"Q","north"),(4,4,"Q","south"),(4,3,"R","south")])
    for a in [(4,2,0,4,3,3),(4,4,0,4,3,3)]*2:
        env.step(encode_action(*a))
        assert env.rewards=={"north":0.0,"south":0.0}
    assert env.unwrapped.engine.state.winner=="draw"

def test_league_cap_is_not_a_draw_or_reward_win():
    r=play_game(RandomPolicy(),RandomPolicy(),"rulesets/default.yaml",max_steps=1)
    assert r.truncated and not r.terminated and r.winner is None and r.reason=="ply_limit"
    d={"white":"A","black":"B","winner":None,"rules_version":2,"truncated":True,"terminated":False}
    assert score_for_north(d) is None and compute_elo([d])=={}
    # Legacy reward-adjudicated records are not silently mixed into v2 statistics.
    assert score_for_north({"winner":"north"}) is None
    d.update(winner="draw",terminated=True,truncated=False)
    assert score_for_north(d)==0.5

def test_maskable_ppo_short_training_and_flat_checkpoint(tmp_path):
    sb3=pytest.importorskip("sb3_contrib")
    import torch
    torch.set_num_threads(1)
    from gymnasium.wrappers import FlattenObservation
    from sb3_contrib.common.wrappers import ActionMasker
    from implementation.league.round_robin import SB3Policy
    from implementation.age_of_chess.pettingzoo_env import age_of_chess_v1
    env=ActionMasker(FlattenObservation(AOCSingleAgentSelfPlayEnv(max_plies=32)),
                     lambda wrapped:wrapped.unwrapped.get_action_mask())
    model=sb3.MaskablePPO("MlpPolicy",env,n_steps=8,batch_size=4,n_epochs=1,
                         policy_kwargs={"net_arch":[16]},device="cpu",seed=7,verbose=0)
    model.learn(total_timesteps=16)
    path=str(tmp_path/"v2_model.zip");model.save(path)
    policy=SB3Policy(path)
    aec=age_of_chess_v1();aec.reset(seed=8)
    action=policy.select(aec)
    assert aec.infos[aec.agent_selection]["action_mask"][action]
    aec.step(action)
    assert not aec.infos["north"].get("illegal_action")
