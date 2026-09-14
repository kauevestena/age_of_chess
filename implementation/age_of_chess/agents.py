"""Seedable legal-action baselines; material values come from the loaded rules."""
import random
from .combat import resolve_melee
from .utils import opponent

def material(engine):
    return engine._material()

def score_action(engine, action):
    """Immediate material swing on a settled position, without copying the board."""
    fr, fc, slot, tr, tc, kind = action
    if kind == 0:
        # Automatic adjacent Priestess deaths remove one Q per side, equal values.
        return 0.0
    values = engine.rules.game.pieces
    src, dst = engine.state.board.grid[fr][fc], engine.state.board.grid[tr][tc]
    actor = (src.top, src.bottom)[slot]
    if kind == 3: return 2*values[dst.top.code].value
    if kind == 2: return values[dst.top.code].value
    alive, top, bottom = resolve_melee(actor, dst.top, dst.bottom, engine.rules)
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
        legal = engine.legal_actions()
        if not legal: return None
        scored = [(score_action(engine, a), a) for a in legal]
        best = max(v for v, _ in scored)
        return self.rng.choice([a for v, a in scored if v == best])

class LookaheadAgent(RandomAgent):
    """Two plies: beam over root actions, all opponent replies. Not expert play."""
    def __init__(self, seed=None, beam_width=8):
        super().__init__(seed)
        self.beam_width = beam_width

    def select(self, engine):
        legal = engine.legal_actions()
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
                reply_gain = max((score_action(clone, a) for a in clone.legal_actions()), default=0.0)
                value = before[side] - before[opponent(side)] - reply_gain
            scored.append((value, action))
        best = max(v for v, _ in scored)
        return self.rng.choice([a for v, a in scored if v == best])
