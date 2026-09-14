"""Stream reproducible Python-engine positions to the browser parity test."""
import json
import random
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from implementation.age_of_chess.env import Engine
from implementation.age_of_chess.game_state import Board, Unit, GameState

rng = random.Random(20260914)
def snapshot(engine):
    s = engine.state
    return {'board': [[(1 if u.side == 'north' else -1) * ('PNBRQK'.index(u.code)+1)
                      for u in (sq.top, sq.bottom) if u]
                     for row in s.board.grid for sq in row],
            'turn': 1 if s.to_move == 'north' else -1, 'ply': s.move_count,
            'winner': {'north':1,'south':-1,'draw':0,None:None}[s.winner], 'reason':s.reason}

def emit(engine, actions=None):
    actions = engine.legal_actions() if actions is None else actions
    before = snapshot(engine)
    # Compare all legal actions, and one chosen full transition per position.
    action = rng.choice(actions) if actions else None
    event = engine.apply(action) if action else None
    print(json.dumps({'before':before,'legal':actions,'action':action,'after':snapshot(engine),
                      'losses': event['losses'] if event else []},separators=(',',':')))

for _ in range(100):
    e = Engine('rulesets/default.yaml')
    for ply in range(120):
        if e.state.done: break
        emit(e)

# Settled study positions exercise sparse endings, stacks, and every class pair.
for _ in range(1200):
    b=Board(8,8)
    squares=rng.sample(range(64),rng.randint(4,25))
    for idx, k in enumerate(squares):
        owner='north' if idx==0 else 'south' if idx==1 else rng.choice(['north','south'])
        c='K' if idx<2 else rng.choice('PNBR')
        b.grid[k//8][k%8].add_unit(Unit(c,owner))
        if rng.random()<.35: b.grid[k//8][k%8].add_unit(Unit(rng.choice('PNBR'),owner))
    free=[i for i in range(64) if i not in squares]
    for owner in ['north','south']:
        if rng.random()<.7:
            i=free.pop(rng.randrange(len(free))); b.grid[i//8][i%8].add_unit(Unit('Q',owner))
    e=Engine('rulesets/default.yaml');e.set_state(GameState(b,to_move=rng.choice(['north','south'])))
    emit(e)

# Exhaustive melee source/target slots (including all three stack exceptions).
for actor in 'PNBRQK':
    for defender in 'PNBRQK':
        for bottom in [None,*'PNBR']:
            b=Board(8,8)
            if actor!='K': b.grid[7][7].add_unit(Unit('K','north'))
            if defender!='K': b.grid[0][0].add_unit(Unit('K','south'))
            b.grid[4][4].add_unit(Unit(actor,'north'));b.grid[3][4].add_unit(Unit(defender,'south'))
            if bottom: b.grid[3][4].add_unit(Unit(bottom,'south'))
            e=Engine('rulesets/default.yaml');e.set_state(GameState(b));emit(e)
