from __future__ import annotations
from typing import Tuple
from .game_state import Unit

def resolve_melee(att: Unit, def_top: Unit, def_bottom: Unit|None) -> Tuple[bool,bool,bool]:
    """
    Return (attacker_alive, top_defender_alive, bottom_defender_alive).
    Covers specific stacked defaults from RULES.md.
    """
    A = att.code; D = def_top.code
    B = def_bottom.code if def_bottom else None

    # Same-type (non-king): mutual destruction
    if A == D and A != "K":
        return (False, False, def_bottom is not None)

    # Cavalry vs Pike (including stacks)
    if A == "N":
        if D == "P":  # runs into pike wall
            return (False, True, def_bottom is not None)
        if D == "B":
            # archer+archer -> cav tramples both
            if B == "B":
                return (True, False, False)
            # archer + X (non-archer) -> cav kills top only
            return (True, False, def_bottom is not None)
        if D == "R":
            # lone heavy on top -> cav wins top only
            return (True, False, def_bottom is not None)

    # Heavy Infantry attacking
    if A == "R":
        if D == "P":
            # HI vs (Pike+Pike) -> mutual with top; bottom remains
            if B == "P":
                return (False, False, True)
            # HI vs single Pike -> HI wins
            return (True, False, def_bottom is not None)
        if D == "B":
            # HI vs Archer+X -> kill archer only
            return (True, False, def_bottom is not None)
        if D == "R":
            # Heavy vs Heavy -> mutual; bottom stays if exists
            return (False, False, def_bottom is not None)

    # Archer melee vs Cav/HI -> archer dies, defender lives
    if A == "B" and D in ("N","R"):
        return (False, True, def_bottom is not None)

    # Pikeman attacking Cavalry wins
    if A == "P" and D == "N":
        return (True, False, def_bottom is not None)

    # Default neutral: attacker kills top only
    return (True, False, def_bottom is not None)
