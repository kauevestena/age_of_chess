"""Explicit ordered combat matrix, with exact stack overrides before wildcards."""
def resolve_melee(att, def_top, def_bottom, rules):
    if att.side == def_top.side:
        raise ValueError("Cannot attack friendly units")
    if def_top.code == "K":
        return True, False, def_bottom is not None
    if def_bottom is not None:
        for bottom in (def_bottom.code, "*"):
            for rule in rules.game.combat.stacks:
                if (rule.attacker, rule.top, rule.bottom) == (att.code, def_top.code, bottom):
                    return rule.outcome
    result = rules.game.combat.single[att.code][def_top.code]
    if result == "illegal":
        raise ValueError("Melee is not permitted for this ordered pair")
    return result != "mutual" and result != "lose", result == "lose", def_bottom is not None
