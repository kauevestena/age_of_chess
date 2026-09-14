"""Ordered melee, including same-type defender-relative guarded stance."""
def attack_sector(from_pos, to_pos, defender_side):
    if from_pos is None or to_pos is None:
        raise ValueError("Same-type melee requires source and target coordinates")
    fr, fc = from_pos
    tr, tc = to_pos
    if from_pos == to_pos:
        raise ValueError("A melee attack requires different squares")
    forward = (tr-fr) if defender_side == "north" else (fr-tr)
    right = (fc-tc) if defender_side == "north" else (tc-fc)
    return (2 if forward > 0 else 8 if forward < 0 else 5) + ((right > 0)-(right < 0))


def resolve_melee(att, def_top, def_bottom, rules, *, from_pos=None, to_pos=None):
    if att.side == def_top.side:
        raise ValueError("Cannot attack friendly units")
    if def_top.code == "K":
        return True, False, def_bottom is not None
    result = rules.game.combat.single[att.code][def_top.code]
    if result == "stance":
        sector = attack_sector(from_pos, to_pos, def_top.side)
        return sector not in (1, 2, 3), sector == 2, def_bottom is not None
    if def_bottom is not None:
        for bottom in (def_bottom.code, "*"):
            for rule in rules.game.combat.stacks:
                if (rule.attacker, rule.top, rule.bottom) == (att.code, def_top.code, bottom):
                    return rule.outcome
    if result == "illegal":
        raise ValueError("Melee is not permitted for this ordered pair")
    return result != "mutual" and result != "lose", result == "lose", def_bottom is not None
