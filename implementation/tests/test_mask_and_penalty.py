import numpy as np
import pytest
from implementation.age_of_chess.pettingzoo_env import age_of_chess_v1, ACTION_SPACE_SIZE
from implementation.age_of_chess.utils import encode_action, decode_action

def test_every_action_id_roundtrips():
    for index in range(ACTION_SPACE_SIZE):
        assert encode_action(*decode_action(index)) == index

@pytest.mark.parametrize("index", [-1, ACTION_SPACE_SIZE, 1.5])
def test_invalid_ids_rejected(index):
    with pytest.raises((ValueError, TypeError)): decode_action(index)

def test_action_mask_present():
    env = age_of_chess_v1()
    env.reset(seed=7)
    mask = env.last()[4]["action_mask"]
    assert isinstance(mask, np.ndarray) and mask.shape == (ACTION_SPACE_SIZE,)
    assert mask.dtype == np.int8
    assert not env.infos["south"]["action_mask"].any()

@pytest.mark.parametrize("side", ["north", "south"])
def test_opening_mask_executes_exact_requested_action(rules, side):
    from implementation.age_of_chess.env import Engine
    e = Engine(rules=rules)
    e.state.to_move = side
    legal = e.legal_actions()
    assert len(legal) == len(set(legal))
    ids = e.action_mask().nonzero()[0]
    assert {decode_action(i) for i in ids} == set(legal)
    for index in ids:
        env = age_of_chess_v1()
        env.reset()
        env.unwrapped.engine = e.clone()
        env.unwrapped.agent_selection = side
        env.step(index)
        event = env.unwrapped.history[-1]
        action = decode_action(index)
        assert (*event["from"], event["slot"], *event["to"], event["atype"]) == action
        assert not env.infos[side].get("illegal_action")

def test_bottom_right_stack_has_valid_mask(position):
    e = position([(7, 7, "PK", "north")])
    assert any(a[:3] == (7, 7, 1) for a in e.legal_actions())
    assert len(e.action_mask()) == ACTION_SPACE_SIZE

def test_illegal_action_forfeits_without_fallback():
    env = age_of_chess_v1()
    env.reset()
    before = env.unwrapped.engine.state.position_key()
    env.step(0)
    assert env.unwrapped.engine.state.position_key() == before
    assert env.infos["north"]["illegal_action"]
    assert env.infos["north"]["winner"] == "south"
    assert env.rewards == {"north": -1.0, "south": 1.0}
    assert env.unwrapped.history == []
