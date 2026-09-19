"""Seedable legal-action baselines; material values come from the loaded rules."""
import random
from .combat import resolve_melee
from .utils import opponent, is_preparation, is_shot, shot_slot
from .movegen import gen_preparations
from .combat import canonical_layout

def material(engine):
    return engine._material()

def score_action(engine, action):
    """Immediate material swing on a settled position, without copying the board."""
    fr, fc, slot, tr, tc, kind = action
    if kind == 0 or is_preparation(kind):
        # Automatic adjacent Priestess deaths remove one Q per side, equal values.
        return 0.0
    values = engine.rules.game.pieces
    src, dst = engine.state.board.grid[fr][fc], engine.state.board.grid[tr][tc]
    actor = (src.top, src.bottom)[slot]
    if kind == 3: return 2*values[dst.top.code].value
    if is_shot(kind):
        target = (dst.top, dst.bottom)[shot_slot(kind)]
        return values[target.code].value - (values[actor.code].value if target.code == "B" else 0)
    alive, top, bottom = resolve_melee(actor, dst.top, dst.bottom, engine.rules,
                                      from_pos=(fr, fc), to_pos=(tr, tc), layout=dst.layout)
    return ((0 if top else values[dst.top.code].value)
            + (values[dst.bottom.code].value if dst.bottom and not bottom else 0)
            - (0 if alive else values[actor.code].value))

class RandomAgent:
    def __init__(self, seed=None): self.rng = random.Random(seed)
    def select(self, engine):
        legal = engine.legal_actions()
        return self.rng.choice(legal) if legal else None

class GreedyAgent(RandomAgent):
    def select(self, engine):
        legal = engine.legal_orders()
        if not legal: return None
        def score(a):
            r, c, slot, rr, _, kind = a
            actor = (engine.state.board.grid[r][c].top, engine.state.board.grid[r][c].bottom)[slot]
            owner = engine.state.to_move
            if actor.code == "K" and kind == 0 and (engine.state.king_moves[owner] >= 3 or
                    (engine.state.retreat_counts[owner] >= 2 and (rr-r)*(1 if owner == "north" else -1) > 0)):
                return -1e9
            return score_action(engine, a)
        scored = [(score(a), a) for a in legal]
        best = max(v for v, _ in scored)
        order = self.rng.choice([a for v, a in scored if v == best])
        return suggest_preparation(engine, order) or order

class LookaheadAgent(RandomAgent):
    """Two plies: beam over root actions, all opponent replies. Not expert play."""
    def __init__(self, seed=None, beam_width=8):
        super().__init__(seed)
        self.beam_width = beam_width

    def select(self, engine):
        legal = engine.legal_orders()
        if not legal: return None
        side = engine.state.to_move
        # Shuffle equal scores reproducibly to avoid coordinate ordering bias.
        self.rng.shuffle(legal)
        ranked = sorted(legal, key=lambda a: score_action(engine, a), reverse=True)
        candidates = ranked[:self.beam_width]
        scored = []
        for action in candidates:
            clone = engine.clone()
            clone._apply_unchecked(action)
            if clone.state.winner == side:
                value = 1e9
            elif clone.state.winner == opponent(side):
                value = -1e9
            elif clone.state.winner == "draw":
                value = 0.0
            else:
                before = clone._material()
                reply_gain = max((score_action(clone, a) for a in clone.legal_orders()), default=0.0)
                value = before[side] - before[opponent(side)] - reply_gain
            scored.append((value, action))
        best = max(v for v, _ in scored)
        order = self.rng.choice([a for v, a in scored if v == best])
        return suggest_preparation(engine, order) or order


def suggest_preparation(engine, order):
    """One useful prefix change; subsequent policy calls must still finish the order."""
    options = gen_preparations(engine.state, engine.rules)
    if not options:
        return None
    after = engine.clone()
    after._apply_unchecked(order)
    if after.state.done:
        return None
    def units(sq):
        return [(u.code, u.side, u.veteran) for u in (sq.top, sq.bottom) if u]
    eligible = {a[0]*8+a[1] for a in options
                if units(engine.state.board.grid[a[0]][a[1]]) == units(after.state.board.grid[a[0]][a[1]])}
    scores = {i: [0.0]*4 for i in eligible}
    values = engine.rules.game.pieces
    for layout in range(4):
        view = after.clone()
        for i in eligible:
            sq = view.state.board.grid[i//8][i%8]
            sq.layout = canonical_layout(sq.top, sq.bottom, layout)
        risks = {}
        for a in view.legal_actions_unfiltered():
            fr, fc, slot, tr, tc, kind = a
            index = tr*8+tc
            if index not in eligible or not (kind == 1 or is_shot(kind)):
                continue
            dst, src = view.state.board.grid[tr][tc], view.state.board.grid[fr][fc]
            actor = (src.top, src.bottom)[slot]
            if is_shot(kind):
                lost = values[(dst.top, dst.bottom)[shot_slot(kind)].code].value
            else:
                _, top, bottom = resolve_melee(actor, dst.top, dst.bottom, view.rules,
                    from_pos=(fr, fc), to_pos=(tr, tc), layout=dst.layout)
                lost = sum(values[u.code].value for u, alive in ((dst.top, top), (dst.bottom, bottom)) if u and not alive)
            risk = max(0, score_action(view, a)) + .15*lost
            worst, total = risks.get(index, (0, 0))
            risks[index] = max(worst, risk), total+risk
        for i in eligible:
            worst, total = risks.get(i, (0, 0))
            scores[i][layout] = worst + .01*total
    best, best_gain = None, 1e-9
    for action in options:
        fr, fc, _, _, _, kind = action
        if fr*8+fc not in eligible:
            continue
        values_at = scores[fr*8+fc]
        gain = values_at[engine.state.board.grid[fr][fc].layout] - values_at[kind-4]
        if gain > best_gain:
            best, best_gain = action, gain
    return best
