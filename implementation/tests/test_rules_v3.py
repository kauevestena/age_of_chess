"""Rules-v3 regressions with independent sector and casualty expectations."""
import copy
from pathlib import Path
import pytest
import numpy as np
import yaml
from implementation.age_of_chess.combat import attack_sector, resolve_melee
from implementation.age_of_chess.env import Engine, OBSERVATION_SHAPE
from implementation.age_of_chess.game_state import Board, GameState, Unit
from implementation.age_of_chess.rules_loader import load_ruleset

SECTORS = [(1,-1,-1), (2,-1,0), (3,-1,1), (4,0,-1),
           (6,0,1), (7,1,-1), (8,1,0), (9,1,1)]
OTHER = {"north":"south", "south":"north"}

def codes(square):
    return ''.join(u.code for u in (square.top, square.bottom) if u)

@pytest.mark.parametrize('defender', ['north','south'])
@pytest.mark.parametrize('sector,dr,dc', SECTORS)
@pytest.mark.parametrize('code', list('PNBR'))
@pytest.mark.parametrize('source_slot', [0,1])
# Formation outcomes are covered by the v4 geometry tests.
@pytest.mark.parametrize('formation', [False])
def test_guarded_stance_every_sector_slot_and_owner(position, defender, sector, dr, dc, code, source_slot, formation):
    sign = 1 if defender == 'north' else -1
    fr,fc=3+dr*sign,3+dc*sign
    source='P'+code if source_slot else code
    target=code+'P' if formation else code
    e=position([(fr,fc,source,OTHER[defender]),(3,3,target,defender)],side=OTHER[defender])
    event=e.apply((fr,fc,source_slot,3,3,1))
    assert event['stance'] and event['approach']==sector
    attacker_alive=sector in (4,6,7,8,9)
    target_alive=sector==2
    assert codes(e.state.board.grid[3][3]) == (code if target_alive else '') + ('P' if formation else code if attacker_alive else '')
    expected_source = source if attacker_alive and formation else 'P' if source_slot else ''
    assert codes(e.state.board.grid[fr][fc])==expected_source
    assert event['moved']==(attacker_alive and not formation)

@pytest.mark.parametrize('sector,dr,dc', SECTORS)
def test_cross_class_counters_and_exceptions_ignore_facing(rules, sector, dr, dc):
    origin=(3+dr,3+dc)
    for a,d,expected in [('P','B',(True,False,False)),('B','P',(False,True,False)),('Q','Q',(False,False,False))]:
        assert resolve_melee(Unit(a,'south'),Unit(d,'north'),None,rules,from_pos=origin,to_pos=(3,3))==expected
    # Every cross-class duel retains its counter inside a formation.
    assert resolve_melee(Unit('P','south'),Unit('B','north'),Unit('B','north'),rules,from_pos=origin,to_pos=(3,3))==(True,False,False)

def test_cavalry_stance_uses_origin_not_intermediate(position):
    e=position([(5,3,'N','north'),(3,3,'N','south'),(4,3,'PP','north')])
    # The direct intermediate is blocked; diagonal paths still reach the defended front.
    out=e.apply((5,3,0,3,3,1))
    assert out['approach']==2 and not out['capture']['att_alive']
    assert codes(e.state.board.grid[3][3])=='N'

@pytest.mark.parametrize('owner', ['north','south'])
@pytest.mark.parametrize('code', list('PNBR'))
@pytest.mark.parametrize('slot', [0,1])
def test_frontal_evasion_in_home_half(position, owner, code, slot):
    row,front=(5,4) if owner=='north' else (2,3)
    actor='P'+code if slot else code
    for enemy_col,allowed in [(3,True),(2,False)]:
        e=position([(row,3,actor,owner),(front,enemy_col,'P',OTHER[owner]),
                    (row,2,'P',owner),(row,4,'PP',owner)],side=owner)
        legal=e.legal_actions()
        assert ((row,3,slot,row,2,0) in legal)==allowed
        assert (row,3,slot,row,4,0) not in legal
        if allowed:
            e.apply((row,3,slot,row,2,0))
            assert codes(e.state.board.grid[row][2])=='P'+code
    empty=position([(row,3,actor,owner),(front,3,'P',OTHER[owner])],side=owner)
    assert (row,3,slot,row,4,0) in empty.legal_actions()
    assert (row,3,slot,row,5,0) not in empty.legal_actions()

@pytest.mark.parametrize('owner', ['north','south'])
@pytest.mark.parametrize('slot', [0,1])
@pytest.mark.parametrize('target', ['', 'P', 'B'])
def test_cavalry_passage_is_atomic_and_preserves_ally(position, owner, slot, target):
    row,mid,end=(5,4,3) if owner=='north' else (2,3,4)
    units=[(row,2,'PN' if slot else 'N',owner),(mid,3,'R',owner)]
    if target: units.append((end,4,target,OTHER[owner] if target=='B' else owner))
    e=position(units,side=owner)
    e.apply((row,2,slot,end,4,int(target=='B')))
    assert codes(e.state.board.grid[mid][3])=='R'
    assert codes(e.state.board.grid[row][2])==('P' if slot else '')
    assert codes(e.state.board.grid[end][4])==('PN' if target=='P' else 'N')
    assert e.state.move_count==1

@pytest.mark.parametrize('block,owner', [('PP','north'),('P','south')])
def test_cavalry_full_formations_and_enemies_block_unique_path(position, block, owner):
    for target in ['', 'B']:
        units=[(5,2,'N','north'),(4,3,block,owner)]
        if target: units.append((3,4,target,'south'))
        e=position(units)
        assert (5,2,0,3,4,int(bool(target))) not in e.legal_actions()

def test_backward_attack_does_not_grant_backward_quiet_moves(position):
    for code in 'PNBR':
        e=position([(4,3,code,'north'),(5,3,'B','south')])
        assert (4,3,0,5,3,1) in e.legal_actions()
        if code!='K': assert (4,3,0,5,2,0) not in e.legal_actions()
    e=position([(4,3,'N','north'),(5,4,'P','north'),(6,5,'B','south')])
    assert (4,3,0,6,5,1) in e.legal_actions()
    assert (4,3,0,6,1,0) not in e.legal_actions()

@pytest.mark.parametrize('sector,dr,dc', SECTORS)
@pytest.mark.parametrize('owner', ['north','south'])
@pytest.mark.parametrize('slot', [0,1])
def test_return_fire_all_rays_and_shooter_slots(position, sector, dr, dc, owner, slot):
    e=position([(3,3,'PB' if slot else 'BP',owner),(3+dr,3+dc,'BP',OTHER[owner])],side=owner)
    # Place the Archer in the exposed subcell for this ray; screening is tested in v4.
    e.state.board.grid[3+dr][3+dc].layout = 0 if dr >= 0 else 1
    event=e.apply((3,3,slot,3+dr,3+dc,2))
    assert event['ranged']['return_fire']
    assert codes(e.state.board.grid[3][3])=='P'
    assert codes(e.state.board.grid[3+dr][3+dc])=='P'
    assert [(x['code'],x['cause']) for x in event['losses']]==[('B','ranged'),('B','return_fire')]

def test_commander_three_retreats_preserve_across_opponent_turns(position):
    e=position([(2,3,'K','north'),(2,5,'P','south')])
    sequence=[(2,3,0,3,3,0),(2,5,0,3,5,0),(3,3,0,4,3,0),(3,5,0,4,5,0),(4,3,0,5,3,0)]
    for i,a in enumerate(sequence):
        e.apply(a)
        assert e.state.retreat_counts['north']==(i//2+1)
        assert e.state.done==(i==4)
    assert e.state.winner=='south' and e.state.reason=='commander_retreat_forfeit'

@pytest.mark.parametrize('owner', ['north','south'])
def test_retreat_resets_displacement_and_capture_priority(position,owner):
    def cell(r,c):return (r,c) if owner=='north' else (7-r,7-c)
    def make(target='B',stack=False):
        e=position([(*cell(3,3),'PK' if stack else 'K',owner),(*cell(4,4),target,OTHER[owner]),(*cell(6,0),'P',owner)],side=owner)
        e.state.retreat_counts[owner]=2
        return e
    e=make(); e.apply((*cell(3,3),0,*cell(4,3),0))
    assert e.state.reason=='commander_retreat_forfeit'
    e=make('BP',True); e.apply((*cell(3,3),1,*cell(4,3),0))
    assert e.state.retreat_counts[owner]==3 and e.state.reason=='commander_retreat_forfeit'
    for destination in [cell(3,2),cell(2,3)]:
        e=make();e.apply((*cell(3,3),0,*destination,0));assert e.state.retreat_counts[owner]==0
    e=make();e.apply((*cell(6,0),0,*cell(5,0),0));assert e.state.retreat_counts[owner]==0
    e=make('K')
    assert (*cell(3,3),0,*cell(4,4),1) not in e.legal_actions()

def raw_engine(rules, pieces):
    b=Board(8,8)
    for r,c,units,owner in pieces:
        for code in units:b.grid[r][c].add_unit(Unit(code,owner))
    e=Engine(rules=rules);e.set_state(GameState(b));return e

@pytest.mark.parametrize('actor,enemy,kind,reason', [('P','B',1,'lone_commander'),('Q','R',3,'lone_commander'),('B','B',2,'both_commanders_alone')])
def test_last_support_removed_by_melee_conversion_or_return_fire(rules,actor,enemy,kind,reason):
    e=raw_engine(rules,[(7,7,'K','north'),(0,7,'K','south'),(4,3,actor,'north'),(3,3,enemy,'south')])
    e.apply((4,3,0,3,3,kind))
    assert e.state.reason==reason
    assert e.state.winner==('draw' if kind==2 else 'north')

def test_priestess_cancellation_can_leave_both_commanders_alone(rules):
    e=raw_engine(rules,[(7,7,'K','north'),(0,7,'K','south'),(5,3,'Q','north'),(3,3,'Q','south')])
    e.apply((5,3,0,4,3,0))
    assert e.state.reason=='both_commanders_alone' and e.state.winner=='draw'

def test_counters_are_cloned_observed_validated_and_part_of_repetition(position):
    e=position([(4,3,'P','north')]);old=e.state.position_key()
    e.state.retreat_counts={'north':2,'south':1}
    assert old!=e.state.position_key() and e.observe('north').shape==OBSERVATION_SHAPE
    assert np.allclose(e.observe('north')[27],2/3) and np.allclose(e.observe('south')[27],1/3)
    clone=e.clone();clone.state.retreat_counts['north']=0
    assert e.state.retreat_counts['north']==2
    for bad in [{'north':-1,'south':0},{'north':3,'south':3},{'north':True,'south':0},{}]:
        state=e.state.copy();state.retreat_counts=bad
        with pytest.raises(ValueError):e.set_state(state)

def test_rules_v3_schema_rejects_misleading_stance_configuration(tmp_path):
    base=yaml.safe_load(Path('rulesets/default.yaml').read_text())
    for key,value in [('version',2),('same_type_stance','initiative'),('frontal_enemy_sidesteps',False),('cavalry_pass_single_ally',False)]:
        data=copy.deepcopy(base);data['game'][key]=value
        path=tmp_path/'rules.yaml';path.write_text(yaml.safe_dump(data))
        with pytest.raises(ValueError):load_ruleset(str(path))
    for a,d,value in [('P','P','mutual'),('B','P','stance')]:
        data=copy.deepcopy(base);data['game']['combat']['single'][a][d]=value
        path.write_text(yaml.safe_dump(data))
        with pytest.raises(ValueError):load_ruleset(str(path))
