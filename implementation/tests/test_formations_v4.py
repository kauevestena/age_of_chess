"""Independent v4 contract: counters, geometry, prefixes, exposure and learning turns."""
import copy
import pytest
import numpy as np
from implementation.age_of_chess.combat import resolve_melee, resolve_combat, canonical_layout
from implementation.age_of_chess.game_state import Unit
from implementation.age_of_chess.utils import encode_action, decode_action, is_preparation
from implementation.age_of_chess.sb3_env import AOCSingleAgentSelfPlayEnv

DIRECTIONS = [(1,-1,-1),(2,-1,0),(3,-1,1),(4,0,-1),(6,0,1),(7,1,-1),(8,1,0),(9,1,1)]
WINS = {('P','N'),('P','B'),('N','B'),('N','R'),('R','P'),('R','B')}

@pytest.mark.parametrize('owner', ['north','south'])
@pytest.mark.parametrize('sector,dr,dc', DIRECTIONS)
@pytest.mark.parametrize('layout', [0,2])
@pytest.mark.parametrize('actor', 'PNBR')
@pytest.mark.parametrize('defender', 'PNBR')
def test_homogeneous_formation_counters_and_stance(rules,owner,sector,dr,dc,layout,actor,defender):
    sign=1 if owner=='north' else -1
    origin=(3+dr*sign,3+dc*sign)
    a=Unit(actor,'south' if owner=='north' else 'north');d=Unit(defender,owner)
    alive,first,second=resolve_melee(a,d,d,rules,from_pos=origin,to_pos=(3,3),layout=layout)
    if actor!=defender:
        win=(actor,defender) in WINS
        assert (alive,first,second)==(win,not win,not win)
    elif layout==0:
        # N–S: flank exposes both; rear meets a reserve; front diagonals trade first.
        assert alive==(sector in (4,6))
        assert first+second==(2 if sector==2 else 0 if sector in (4,6) else 1)
    else:
        # E–W: whole front arc braced, direct rear exposed, other sides have a reserve.
        assert alive==(sector==8)
        assert first+second==(2 if sector in (1,2,3) else 0 if sector==8 else 1)


def test_all_mixed_ordinary_pairs_keep_each_counter(rules):
    count=0
    for owner in ('north','south'):
        sign=1 if owner=='north' else -1
        for _,dr,dc in DIRECTIONS:
            for layout in range(4):
                for actor in 'PNBR':
                    for first in 'PNBR':
                        for second in 'PNBR':
                            if first==second:continue
                            r=resolve_combat(Unit(actor,'south' if owner=='north' else 'north'),
                                Unit(first,owner),Unit(second,owner),rules,
                                from_pos=(3+dr*sign,3+dc*sign),to_pos=(3,3),layout=layout)
                            for slot,code in enumerate((first,second)):
                                if (code,actor) in WINS:
                                    assert not r['alive'] and r['survive'][slot]
                            if (actor,first) in WINS and (actor,second) in WINS:
                                assert r['alive'] and not any(r['survive'])
                            count+=1
    assert count==3072


def test_swap_changes_contact_not_counter_and_commander_capture_stops_reserve(position):
    for layout,expected in [(0,['P']), (1,['P','B'])]:
        e=position([(4,3,'N','south'),(3,3,'PB','north')],side='south')
        e.state.board.grid[3][3].layout=layout
        event=e.apply((4,3,0,3,3,1))
        assert e.state.board.grid[4][3].is_empty()
        assert [u.code for u in (e.state.board.grid[3][3].top,e.state.board.grid[3][3].bottom) if u]==expected
        assert event['formation']['mode']==('serial' if layout==0 else 'screen')
    e=position([(4,3,'N','south'),(3,3,'PK','north')],side='south')
    e.state.board.grid[3][3].layout=0
    e.apply((4,3,0,3,3,1))
    assert e.state.winner=='south' and e.state.board.grid[3][3].top.code=='P'


def test_three_distinct_preparations_do_not_complete_turn_or_reset_retreat(position):
    e=position([(5,c,units,'north') for c,units in enumerate(('PN','PB','PR','NB'))])
    e.state.retreat_counts['north']=2
    history=copy.deepcopy(e.state.position_counts)
    for col in range(3):
        action=(5,col,0,5,col,6)
        assert decode_action(encode_action(*action))==action
        e.apply(action)
        assert e.state.to_move=='north' and e.state.move_count==0
        assert e.state.retreat_counts['north']==2 and e.state.position_counts==history
        assert np.allclose(e.observe('north')[34],(2-col)/3)
    assert not any(is_preparation(a[-1]) for a in e.legal_actions())
    before=e.state.copy()
    for illegal in [(5,0,0,5,0,7),(5,3,0,5,3,6),(5,0,1,5,0,6)]:
        with pytest.raises(ValueError):e.apply(illegal)
        assert e.state==before
    e.apply((5,0,0,4,0,0))
    assert e.state.move_count==1 and e.state.to_move=='south' and e.state.prepared==[]
    assert e.state.retreat_counts['north']==0
    assert e.state.board.grid[5][0].layout==-1


def test_preparations_cannot_bypass_mandatory_minimal_loss(position,monkeypatch):
    e=position([(4,1,'P','north'),(3,1,'P','south'),(4,4,'Q','north'),(3,4,'Q','south'),(6,1,'PN','north')],settle=False)
    pawn,queen=(4,1,0,3,1,1),(4,4,0,3,4,1)
    monkeypatch.setattr(e,'legal_actions_unfiltered',lambda:[pawn,queen])
    assert e.legal_orders()==[queen]
    assert pawn not in e.legal_actions() and any(is_preparation(a[-1]) for a in e.legal_actions())


def test_exposed_ranged_member_and_screening(position):
    e=position([(5,3,'B','south'),(3,3,'RB','north')],side='south')
    # North R screens only the north approach; Archer B is exposed to this rear shot.
    action=(5,3,0,3,3,8)
    assert action in e.legal_actions()
    assert (5,3,0,3,3,2) not in e.legal_actions()
    e.apply(action)
    assert e.state.board.grid[5][3].is_empty()
    assert e.state.board.grid[3][3].top.code=='R' and e.state.board.grid[3][3].layout==-1
    e=position([(1,3,'B','south'),(3,3,'RB','north')],side='south')
    assert not any(a[:2]==(1,3) and a[3:5]==(3,3) and a[-1] in (2,8) for a in e.legal_actions())
    e=position([(3,1,'B','south'),(3,3,'PB','north')],side='south')
    assert (3,1,0,3,3,2) in e.legal_actions() and (3,1,0,3,3,8) in e.legal_actions()


def test_physical_repetition_and_layout_observations(position):
    e=position([(4,3,'PN','north')]);before=e.state.position_key()
    sq=e.state.board.grid[4][3];sq.top,sq.bottom=sq.bottom,sq.top;sq.layout=1
    assert e.state.position_key()==before
    sq.layout=2
    assert e.state.position_key()!=before and e.observe('north')[31,4,3]==1
    state=e.state.copy();state.prepared=[35,35]
    with pytest.raises(ValueError):e.set_state(state)
    same=position([(4,3,'PP','north')])
    assert not any(a[-1] in (5,7) for a in same.legal_actions())


def test_learning_preparation_keeps_control_and_zero_reward(position):
    env=AOCSingleAgentSelfPlayEnv(learner_side='north');env.reset(seed=4)
    env._pz.unwrapped.engine=position([(5,3,'PN','north')])
    obs,reward,done,truncated,_=env.step(encode_action(5,3,0,5,3,6))
    assert not done and not truncated and reward==0
    assert env._pz.agent_selection=='north' and env._pz.unwrapped.engine.state.move_count==0
    assert obs[33,5,3]==1 and np.allclose(obs[34],2/3)
    env.step(encode_action(5,3,0,4,3,0))
    assert env._pz.agent_selection=='north' or env._pz.unwrapped.engine.state.done
    env.close()


def test_learning_wrapper_finishes_three_opponent_preparations_and_its_order(position):
    seen=[]
    def opponent(engine):
        preparations=[a for a in engine.legal_actions() if is_preparation(a[-1])]
        action=preparations[0] if preparations else engine.legal_orders()[0]
        seen.append(action)
        return action
    env=AOCSingleAgentSelfPlayEnv(learner_side='north',opponent_policy=opponent)
    env.reset(seed=4)
    env._pz.unwrapped.engine=position([(5,3,'P','north')]+[(2,c,units,'south')
        for c,units in enumerate(('PN','PB','PR','NB'))])
    _,reward,done,truncated,_=env.step(encode_action(5,3,0,4,3,0))
    assert len(seen)==4 and all(is_preparation(a[-1]) for a in seen[:3])
    assert not is_preparation(seen[-1][-1]) and not done and not truncated and reward==0
    assert env._pz.agent_selection=='north' and env._pz.unwrapped.engine.state.move_count==2
    assert env._pz.unwrapped.engine.state.prepared==[]
    env.close()
