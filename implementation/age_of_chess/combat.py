"""Physical formation contact; class counters precede matching-class stance."""
POSITIONS = (("N", "S"), ("S", "N"), ("W", "E"), ("E", "W"))


def canonical_layout(top, bottom, layout):
    return -1 if bottom is None else layout & 2 if top.code == bottom.code else layout


def attack_sector(from_pos, to_pos, defender_side):
    if from_pos is None or to_pos is None or from_pos == to_pos:
        raise ValueError("Melee requires different source and target coordinates")
    fr, fc = from_pos
    tr, tc = to_pos
    sign = 1 if defender_side == "north" else -1
    forward, right = (tr-fr)*sign, (fc-tc)*sign
    return (2 if forward > 0 else 8 if forward < 0 else 5) + ((right > 0)-(right < 0))


def contact_slots(from_pos, to_pos, bottom, layout):
    if bottom is None:
        return [0]
    dr, dc = from_pos[0]-to_pos[0], from_pos[1]-to_pos[1]
    projection = -dr if layout < 2 else -dc
    if layout % 2:
        projection *= -1
    return [0, 1] if projection == 0 else [0 if projection > 0 else 1]


def resolve_combat(att, def_top, def_bottom, rules, *, from_pos=None, to_pos=None, layout=None):
    if att.side == def_top.side:
        raise ValueError("Cannot attack friendly units")
    defenders = [def_top] + ([def_bottom] if def_bottom else [])
    approach = attack_sector(from_pos, to_pos, def_top.side) if from_pos is not None and to_pos is not None else None
    if def_bottom and approach is None:
        raise ValueError("Formation melee requires its approach")
    if layout is None:
        layout = canonical_layout(def_top, def_bottom, 0 if def_top.side == "north" else 1)

    def duel(defender, sector):
        result = rules.game.combat.single[att.code][defender.code]
        if result == "illegal":
            raise ValueError("Melee is not permitted for this ordered pair")
        if result != "stance":
            return result == "win", result == "lose"
        if sector is None:
            raise ValueError("Matching-class melee requires its approach")
        return sector not in (1, 2, 3), sector == 2

    survive, waves = [True] * len(defenders), []
    line = bool(def_bottom and layout >= 2 and approach in (1, 2, 3))
    exposed = [0, 1] if line else contact_slots(from_pos, to_pos, def_bottom, layout)

    def engage(slots, sector, reserve=False):
        hits = [duel(defenders[i], sector) for i in slots]
        alive = all(hit[0] for hit in hits)
        for slot, hit in zip(slots, hits):
            survive[slot] = hit[1]
        waves.append(dict(slots=slots, alive=alive, defenders=[hit[1] for hit in hits],
                          sector=sector, reserve=reserve,
                          stance=any(att.code == defenders[i].code and att.code in "PNBR" for i in slots)))
        return alive

    alive = engage(exposed, 2 if line else approach)
    first = exposed[0]
    if def_bottom and len(exposed) == 1 and alive and not survive[first] and defenders[first].code != "K":
        alive = engage([1-first], 2, True)
    mode = ("single" if not def_bottom else "braced_line" if line else "simultaneous" if len(exposed) == 2
            else "serial" if len(waves) == 2 else "screen")
    return dict(alive=alive, survive=survive, approach=approach, waves=waves, mode=mode)


def resolve_melee(att, def_top, def_bottom, rules, *, from_pos=None, to_pos=None, layout=None):
    result = resolve_combat(att, def_top, def_bottom, rules, from_pos=from_pos, to_pos=to_pos, layout=layout)
    return result["alive"], result["survive"][0], result["survive"][1] if def_bottom else False


def melee_allowed(att, square, rules, from_pos, to_pos):
    try:
        resolve_combat(att, square.top, square.bottom, rules, from_pos=from_pos, to_pos=to_pos, layout=square.layout)
        return True
    except ValueError:
        return False
