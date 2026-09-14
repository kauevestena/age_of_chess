import copy
import random
import pytest
import numpy as np
from implementation.age_of_chess.combat import resolve_melee
from implementation.age_of_chess.game_state import Unit
from implementation.age_of_chess.agents import score_action
from implementation.age_of_chess.env import Engine

# Independent rule expectations, including the user's Pikeman/Archer correction.
@pytest.mark.parametrize("att,defender,outcome", [
    ("P","B",(True,False,False)), ("B","P",(False,True,False)),
    ("P","R",(False,True,False)), ("R","P",(True,False,False)),
    ("N","R",(True,False,False)), ("R","N",(False,True,False)),
    ("P","N",(True,False,False)), ("N","P",(False,True,False)),
    ("B","N",(False,True,False)), ("N","B",(True,False,False)),
    ("B","R",(False,True,False)), ("R","B",(True,False,False)),
    ("K","K",(True,False,False)),
])
def test_melee_dominance(rules, att, defender, outcome):
    assert resolve_melee(Unit(att,"north"),Unit(defender,"south"),None,rules) == outcome

@pytest.mark.parametrize("code", list("PNBRQ"))
def test_same_type_mutual(rules, code):
    assert resolve_melee(Unit(code,"north"),Unit(code,"south"),None,rules) == (False,False,False)

@pytest.mark.parametrize("att,stack,source,target", [
    ("N","BB",None,"N"), ("N","PP",None,"PP"), ("N","RP",None,"RP"),
    ("R","PP",None,"P"), ("R","BQ","R","Q"), ("P","NP","P","P"),
])
def test_stack_resolution(position, att, stack, source, target):
    row = 5 if att == "N" else 4
    e = position([(row,3,att,"north"),(3,3,stack,"south")])
    e.apply((row,3,0,3,3,1))
    def codes(sq): return "".join(u.code for u in (sq.top,sq.bottom) if u) or None
    assert codes(e.state.board.grid[row][3]) == source
    assert codes(e.state.board.grid[3][3]) == target
    e.state.board.validate()

def test_surviving_attacker_preserves_source_slot(position):
    e=position([(4,3,"PR","north"),(3,3,"BQ","south")])
    e.apply((4,3,1,3,3,1))
    s=e.state.board.grid[4][3]
    assert (s.top.code,s.bottom.code)==("P","R")
    assert e.state.board.grid[3][3].top.side=="south"

def test_cavalry_cannot_jump_but_can_attack_first_step(position):
    e=position([(4,3,"N","north"),(3,4,"P","south")])
    a=e.legal_actions()
    assert (4,3,0,3,4,1) in a
    assert (4,3,0,2,5,0) not in a  # unique path is blocked
    e=position([(4,3,"N","north"),(3,4,"P","north")])
    a=e.legal_actions()
    assert (4,3,0,3,4,0) in a and (4,3,0,2,5,0) not in a

@pytest.mark.parametrize("code", ["K","Q"])
def test_conditional_retreat(position,code):
    e=position([(4,3,code,"north"),(3,3,"P","south")])
    assert (4,3,0,5,3,0) in e.legal_actions()

def test_commander_precedence_and_distance(position):
    e=position([(3,3,"K","north")])
    assert (3,3,0,3,4,0) not in e.legal_actions()
    e=position([(3,3,"K","north"),(1,1,"P","south")])
    assert (3,3,0,4,3,0) in e.legal_actions()  # Chebyshev distance 2
    e=position([(0,3,"K","north")])
    assert (0,3,0,1,3,0) in e.legal_actions()  # last rank overrides forward-only

@pytest.mark.parametrize("stack,slot",[("BQ",0),("PB",1)])
def test_shooting_preserves_source_order(position,stack,slot):
    e=position([(4,3,stack,"north"),(2,3,"P","south")])
    e.apply((4,3,slot,2,3,2))
    sq=e.state.board.grid[4][3]
    assert sq.top.code+sq.bottom.code == stack
    assert e.state.board.grid[2][3].is_empty()

@pytest.mark.parametrize("target",list("NR"))
@pytest.mark.parametrize("slot",[0,1])
def test_power_shot_top_only(position,target,slot):
    e=position([(4,3,"BB","north"),(2,3,target+"P","south")])
    e.apply((4,3,slot,2,3,2))
    sq=e.state.board.grid[2][3]
    assert sq.top.code=="P" and sq.bottom is None
    assert e.state.board.grid[4][3].bottom.code=="B"

def test_shooting_blockers_and_configuration(position):
    e=position([(4,3,"B","north"),(3,3,"N","south"),(2,3,"P","south")])
    assert not any(a[-1]==2 for a in e.legal_actions())
    e=position([(4,3,"B","north"),(2,3,"P","south")])
    assert (4,3,0,2,3,2) in e.legal_actions()
    e.rules=e.rules.model_copy(deep=True)
    e.rules.game.pieces["B"].abilities=[]
    assert not any(a[-1]==2 for a in e.legal_actions())

def test_conversion_restrictions_and_stack_order(position):
    e=position([(4,3,"QP","north"),(3,3,"R","south")])
    e.apply((4,3,0,3,3,3))
    sq=e.state.board.grid[4][3]
    assert sq.top.code+sq.bottom.code=="QP"
    assert e.state.board.grid[3][3].top.side=="north"
    for target in ("K","PP"):
        e=position([(4,3,"Q","north"),(3,3,target,"south")])
        assert (4,3,0,3,3,3) not in e.legal_actions()

def test_automatic_priestess_deaths_preserve_companions(position):
    e=position([(4,2,"PQ","north"),(3,3,"R","north"),(3,4,"QB","south")])
    e.apply((4,2,1,3,3,0))
    assert e.state.board.grid[4][2].top.code=="P"
    assert e.state.board.grid[3][3].top.code=="R"
    assert e.state.board.grid[3][3].bottom is None
    assert e.state.board.grid[3][4].top.code=="B"
    assert e.state.board.grid[3][4].bottom is None

def test_conversion_cycle_draws_on_third_occurrence(position):
    e=position([(4,2,"Q","north"),(4,4,"Q","south"),(4,3,"R","south")])
    cycle=[(4,2,0,4,3,3),(4,4,0,4,3,3)]
    for a in cycle: e.apply(a)
    assert not e.state.done
    for a in cycle: e.apply(a)
    assert e.state.terminated and e.state.winner=="draw"
    assert e.state.move_count==4 and not e.legal_actions()

def test_commander_capture_has_priority(position):
    for actor in "PNBRQK":
        row=5 if actor=="N" else 4
        e=position([(row,3,actor,"north"),(3,3,"KP","south")])
        e.apply((row,3,0,3,3,1))
        assert e.state.winner=="north"
        assert e.state.board.grid[row][3].top.code==actor
        assert e.state.board.grid[3][3].top.code=="P"

def test_no_action_stagnation(rules):
    r=rules.model_copy(deep=True)
    for p in r.game.pieces.values():
        p.move.steps=[]
        p.move.last_rank_all_directions=p.move.attack_field_sideways=False
        p.move.retreat_trigger="none"
        p.abilities=[]
    e=Engine(rules=r)
    e.set_state(e.state)
    assert e.state.winner=="south" and e.state.reason=="stagnation"

def test_observation_distinguishes_count_order_and_side(position):
    one=position([(4,3,"B","north")]);two=position([(4,3,"BB","north")])
    pq=position([(4,3,"PQ","north")]);qp=position([(4,3,"QP","north")])
    assert not np.array_equal(one.observe("north"),two.observe("north"))
    assert not np.array_equal(pq.observe("north"),qp.observe("north"))
    assert not np.array_equal(one.observe("north"),one.observe("south"))
    assert pq.state.position_key()!=qp.state.position_key()

def test_illegal_engine_action_is_atomic(rules):
    e=Engine(rules=rules);before=copy.deepcopy(e.state)
    for action in ((6,0,0,0,0,0), (6,0,0,-1,0,0), (6,0,0,5,0,3)):
        with pytest.raises(ValueError): e.apply(action)
        assert e.state==before

def test_minimal_loss_uses_declared_order_not_ai_values(position,monkeypatch):
    e=position([(4,1,"P","north"),(3,1,"P","south"),
                (4,4,"Q","north"),(3,4,"Q","south")],settle=False)
    pawn=(4,1,0,3,1,1);queen=(4,4,0,3,4,1)
    monkeypatch.setattr(e,"legal_actions_unfiltered",lambda:[pawn,queen])
    assert e.rules.game.pieces["Q"].value > e.rules.game.pieces["P"].value
    assert e.legal_actions()==[queen]

def test_minimal_loss_allows_sacrifices_when_any_action_is_safe(position):
    e=position([(4,3,"B","north"),(3,3,"P","south")])
    assert (4,3,0,3,3,1) in e.legal_actions()

def test_seeded_invariants_and_fast_material_score(rules):
    rng=random.Random(917)
    for game in range(12):
        e=Engine(rules=rules)
        for ply in range(256):
            if e.state.done: break
            legal=e.legal_actions()
            assert len(legal)==len(set(legal)) and legal
            action=rng.choice(legal)
            before=e._material();side=e.state.to_move
            expected=score_action(e,action)
            predicted_deaths=e.immediate_own_deaths(action)
            event=e.apply(action)
            after=e._material();other="south" if side=="north" else "north"
            assert expected==pytest.approx((after[side]-before[side])-(after[other]-before[other]))
            assert predicted_deaths==[loss["code"] for loss in event["losses"] if loss["side"]==side]
            e.state.board.validate()


def test_all_permitted_local_stack_combats_preserve_invariants(position):
    checked=0
    for actor in "PNBRQK":
        for top in "PNBRQK":
            for bottom in "PNBRQK":
                if top==bottom and top in "QK": continue
                row=5 if actor=="N" else 4
                e=position([(row,3,actor,"north"),(3,3,top+bottom,"south")],settle=False)
                action=(row,3,0,3,3,1)
                if action not in e.legal_actions(): continue
                before=sum(u is not None for r in e.state.board.grid for s in r for u in (s.top,s.bottom))
                event=e.apply(action)
                e.state.board.validate()
                after=sum(u is not None for r in e.state.board.grid for s in r for u in (s.top,s.bottom))
                assert before-after==len(event["losses"])
                checked+=1
    assert checked>=170
