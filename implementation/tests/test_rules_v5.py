"""Independent contracts for the unarmed King, escort and veteran rules."""
import copy
from pathlib import Path
import numpy as np
import pytest
import yaml
from implementation.age_of_chess.combat import resolve_combat, canonical_layout
from implementation.age_of_chess.game_state import Unit
from implementation.age_of_chess.rules_loader import load_ruleset
from implementation.age_of_chess.agents import GreedyAgent

SECTORS = [(1,-1,-1),(2,-1,0),(3,-1,1),(4,0,-1),(6,0,1),(7,1,-1),(8,1,0),(9,1,1)]
OTHER = {"north":"south", "south":"north"}

@pytest.mark.parametrize("owner", ["north","south"])
@pytest.mark.parametrize("layout", range(4))
@pytest.mark.parametrize("king_slot", [0,1])
@pytest.mark.parametrize("code", list("PNBR"))
@pytest.mark.parametrize("sector,dr,dc", SECTORS[:5])
def test_matching_royal_escort_all_arrangements(rules, owner, layout, king_slot, code, sector, dr, dc):
    sign = 1 if owner == "north" else -1
    defenders = [Unit(code,owner), Unit(code,owner)]
    defenders[king_slot] = Unit("K",owner)
    result = resolve_combat(Unit(code,OTHER[owner]), *defenders, rules,
        from_pos=(3+dr*sign,3+dc*sign), to_pos=(3,3), layout=layout)
    assert result["mode"] == "king_guard" and not result["alive"]
    assert result["survive"][king_slot]
    assert result["survive"][1-king_slot] == (sector in (1,2,3))
    assert len(result["waves"]) == 1 and result["waves"][0]["slots"] == [1-king_slot]

def test_king_buff_never_reverses_class_counters(rules):
    wins = {("P","N"),("P","B"),("N","R"),("N","B"),("R","P"),("R","B")}
    for actor in "PNBR":
        for escort in "PNBR":
            if actor == escort: continue
            for layout in range(4):
                for _,dr,dc in SECTORS[:5]:
                    result = resolve_combat(Unit(actor,"south"),Unit(escort,"north"),Unit("K","north"),rules,
                        from_pos=(3+dr,3+dc),to_pos=(3,3),layout=layout)
                    won = (actor,escort) in wins
                    assert result["alive"] == won
                    assert result["survive"] == [not won,not won]
                    assert len(result["waves"]) == (2 if won else 1)

@pytest.mark.parametrize("layout,origin,survive", [
    (0,(4,3),[True,False]),  # Rear King captured before Pikeman can turn.
    (1,(4,3),[True,True]),   # Rear Pikeman stops Cavalry; King lives.
    (2,(4,3),[True,False]),  # Both exposed at the direct rear; counter does not save King.
    (3,(4,3),[True,False]),
    (2,(4,2),[True,True]),   # Rear diagonal meets west Pikeman first.
    (3,(4,2),[True,False]),  # Rear diagonal meets west King first.
])
def test_rear_contact_is_unchanged(rules,layout,origin,survive):
    out=resolve_combat(Unit("N","south"),Unit("P","north"),Unit("K","north"),rules,
        from_pos=origin,to_pos=(3,3),layout=layout)
    assert out["survive"]==survive and out["mode"]!="king_guard"

def test_flank_escort_sacrifice_preserves_king_and_other_support(position):
    e=position([(3,3,"PK","south"),(3,4,"P","north"),(1,1,"B","south"),(6,0,"P","north")])
    out=e.apply((3,4,0,3,3,1))
    assert [x["code"] for x in out["losses"]]==["P","P"]
    assert e.state.board.grid[3][3].top.code=="K" and not e.state.done

@pytest.mark.parametrize("owner", ["north","south"])
@pytest.mark.parametrize("code", list("PNBRQ"))
def test_last_rank_ability_is_permanent_and_copied(position,owner,code):
    row,end,back = (1,0,1) if owner=="north" else (6,7,6)
    e=position([(row,3,code,owner)],side=owner)
    event=e.apply((row,3,0,end,3,0))
    assert event["veteran_unlocked"] and e.state.board.grid[end][3].top.veteran
    e.state.to_move=owner
    e.apply((end,3,0,back,4,0))
    e.state.to_move=owner
    deeper=back+(1 if owner=="north" else -1)
    assert (back,4,0,deeper,5,0) in e.legal_actions()
    assert e.clone().state.board.grid[back][4].top.veteran
    if code=="N": assert (back,4,0,deeper+(1 if owner=="north" else -1),6,0) in e.legal_actions()

def test_capture_unlocks_but_failed_attack_does_not(position):
    e=position([(1,3,"P","north"),(0,3,"B","south")])
    assert e.apply((1,3,0,0,3,1))["veteran_unlocked"]
    e=position([(1,3,"N","north"),(0,3,"PK","south")])
    assert not e.apply((1,3,0,0,3,1))["veteran_unlocked"]

def test_veteran_identity_survives_formation_and_conversion(position):
    e=position([(1,3,"P","north"),(0,3,"P","north"),(2,3,"Q","south")])
    e.state.board.grid[1][3].top.veteran=False
    e.state.to_move="north"
    e.apply((0,3,0,1,3,0))
    sq=e.state.board.grid[1][3]
    assert not sq.top.veteran and sq.bottom.veteran
    e.state.to_move="north"
    assert (1,3,0,1,3,5) in e.legal_actions()  # Same class, different abilities: swap matters.
    before=e.state.position_key(); e.apply((1,3,0,1,3,5)); assert e.state.position_key()!=before
    e.apply((1,3,1,2,4,0))
    assert not e.state.board.grid[1][3].top.veteran
    e.apply((2,3,0,2,4,3))
    assert e.state.board.grid[2][4].top.veteran and e.state.board.grid[2][4].top.side=="south"

@pytest.mark.parametrize("middle,allowed", [("",True),("P",True),("PP",False),("enemy",False)])
def test_veteran_cavalry_backwards_passage(position,middle,allowed):
    pieces=[(2,2,"N","north")]
    if middle: pieces.append((3,3,"P" if middle=="enemy" else middle,"south" if middle=="enemy" else "north"))
    e=position(pieces); e.state.board.grid[2][2].top.veteran=True
    assert ((2,2,0,4,4,0) in e.legal_actions())==allowed
    assert (2,2,0,2,4,0) not in e.legal_actions()

def test_unarmed_king_and_peril_are_absolute(position,rules):
    for other in "PNBRQK":
        with pytest.raises(ValueError):
            resolve_combat(Unit("K","north"),Unit(other,"south"),None,rules,from_pos=(4,3),to_pos=(3,3))
    for row,col,allowed in [(1,1,True),(2,2,True),(3,3,False)]:
        e=position([(0,3,"K","north"),(row,3-col,"P","south")])
        assert ((0,3,0,1,3,0) in e.legal_actions())==allowed
        assert not e.state.board.grid[0][3].top.veteran
        assert not any(a[-1]==1 and a[:2]==(0,3) for a in e.legal_actions())

def test_four_king_moves_forfeit_across_opponent_turns(position):
    e=position([(7,3,"K","north"),(7,0,"P","north"),(0,0,"P","south")])
    for i in range(4):
        e.apply((7-i,3,0,6-i,3,0))
        assert e.state.king_moves["north"]==i+1 and e.state.retreat_counts["north"]==0
        if i<3:
            e.apply((i,0,0,i+1,0,0))
            assert e.state.king_moves["north"]==i+1 and not e.state.done
    assert e.state.winner=="south" and e.state.reason=="king_move_forfeit"

def test_counters_reset_independently_and_preparations_preserve_both(position):
    e=position([(4,3,"K","north"),(2,3,"P","south"),(6,1,"PN","north")])
    e.state.king_moves["north"]=2; e.state.retreat_counts["north"]=2
    history=e.state.position_counts.copy()
    e.apply((6,1,0,6,1,6))
    assert e.state.king_moves["north"]==2 and e.state.retreat_counts["north"]==2
    assert e.state.position_counts==history
    forward=e.clone(); forward.apply((4,3,0,3,3,0))
    assert forward.state.king_moves["north"]==3 and forward.state.retreat_counts["north"]==0
    e.apply((6,1,0,5,1,0))
    assert e.state.king_moves["north"]==e.state.retreat_counts["north"]==0

def test_v5_observation_identity_validation_and_greedy_avoid_forfeit(position):
    e=position([(4,3,"K","north"),(6,1,"PN","north")])
    e.state.king_moves["north"]=3; e.state.board.grid[6][1].bottom.veteran=True
    obs=e.observe("north")
    assert obs.shape==(41,8,8) and obs[36,6,1]==1 and np.allclose(obs[39],.75)
    assert e.observe("south")[38,6,1]==1
    clone=e.clone(); clone.state.king_moves["north"]=0
    assert clone.state.position_key()!=e.state.position_key()
    clone=e.clone(); clone.state.board.grid[6][1].bottom.veteran=False
    assert clone.state.position_key()!=e.state.position_key()
    choice=GreedyAgent(1).select(e)
    assert e._apply_on_copy(choice).state.winner!="south"
    for bad in [{},{"north":True,"south":0},{"north":4,"south":4},{"north":5,"south":0}]:
        state=e.state.copy();state.king_moves=bad
        with pytest.raises(ValueError): e.set_state(state)

@pytest.mark.parametrize("stack", ["B","BB","PB","BK"])
def test_all_archers_range_one_and_kings_immune(position,stack):
    e=position([(4,3,stack,"north"),(2,3,"P","south"),(3,4,"K","south")])
    shots=[a for a in e.legal_actions() if a[-1] in (2,8)]
    assert not shots
    e=position([(4,3,stack,"north"),(3,3,"R" if stack=="BB" else "P","south")])
    assert any(a[-1] in (2,8) for a in e.legal_actions())
    q=position([(4,3,"Q","north"),(3,3,"K","south")])
    assert (4,3,0,3,3,3) not in q.legal_actions()

def test_v5_schema_rejects_obsolete_rules(tmp_path):
    original=yaml.safe_load(Path("rulesets/default.yaml").read_text())
    for path,value in [(('version',),4),(('king_move_limit',),3),
        (('king_formation_guard',),'simultaneous'),(('pieces','K','move','last_rank_all_directions'),True),
        (('pieces','B','abilities',0,'range'),2),(('pieces','B','abilities',1,'range'),2),
        (('combat','single','K','P'),'win')]:
        data=copy.deepcopy(original); target=data['game']
        for key in path[:-1]: target=target[key]
        target[path[-1]]=value
        file=tmp_path/'rules.yaml';file.write_text(yaml.safe_dump(data))
        with pytest.raises(ValueError): load_ruleset(str(file))
