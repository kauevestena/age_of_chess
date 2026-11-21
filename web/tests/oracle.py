"""Stream reproducible Python-engine positions to the browser parity test."""
import json
import random
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from implementation.age_of_chess.env import Engine
from implementation.age_of_chess.combat import canonical_layout
from implementation.age_of_chess.game_state import Board, Unit, GameState

rng = random.Random(20260914)
def snapshot(engine):
    s = engine.state
    return {'mode': engine.rules.game.mode,
            'board': [[(1 if u.side == 'north' else -1) * ('PNBRQK'.index(u.code)+1)
                      for u in (sq.top, sq.bottom) if u]
                     for row in s.board.grid for sq in row],
            'layout': [sq.layout for row in s.board.grid for sq in row], 'prepared': s.prepared[:],
            'turn': 1 if s.to_move == 'north' else -1, 'ply': s.move_count,
            'retreats': [s.retreat_counts['north'], s.retreat_counts['south']],
            'kingMoves': [s.king_moves['north'], s.king_moves['south']],
            'winner': {'north':1,'south':-1,'draw':0,None:None}[s.winner], 'reason':s.reason}

def emit(engine, actions=None, chosen=None):
    actions = engine.legal_actions() if actions is None else actions
    before = snapshot(engine)
    # Compare all legal actions, and one chosen full transition per position.
    action = chosen if chosen is not None else rng.choice(actions) if actions else None
    event = engine.apply(action) if action else None
    print(json.dumps({'before':before,'legal':actions,'action':action,'after':snapshot(engine),
                      'losses': event['losses'] if event else [],
                      'approach': event.get('approach') if event else None,
                      'stance': event.get('stance') if event else None,
                      'warp': ([event['warp']['from'][0]*8+event['warp']['from'][1], event['warp']['to'][0]*8+event['warp']['to'][1],
                               (1 if event['warp']['owner']=='north' else -1)*('PNBRQK'.index(event['warp']['unit'])+1)]
                              if event and 'warp' in event else None),
                      'formation': event.get('formation') if event else None},separators=(',',':')))

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
        if rng.random()<.35:
            sq=b.grid[k//8][k%8];sq.add_unit(Unit(rng.choice('PNBR'),owner))
            sq.layout=canonical_layout(sq.top,sq.bottom,rng.randrange(4))
    free=[i for i in range(64) if i not in squares]
    for owner in ['north','south']:
        if rng.random()<.7:
            i=free.pop(rng.randrange(len(free))); b.grid[i//8][i%8].add_unit(Unit('Q',owner))
    e=Engine('rulesets/default.yaml');e.set_state(GameState(b,to_move=rng.choice(['north','south'])))
    emit(e)

# Royal escort: every counter, axis, member order, owner and approach.
for owner in ('north','south'):
    actor_side='south' if owner=='north' else 'north'
    sign=1 if owner=='north' else -1
    for dr,dc in [(-1,-1),(-1,0),(-1,1),(0,-1),(0,1),(1,-1),(1,0),(1,1)]:
        for layout in range(4):
            for actor in 'PNBR':
                for escort in 'PNBR':
                    for king_slot in (0,1):
                        b=Board(8,8)
                        b.grid[7 if actor_side=='north' else 0][7].add_unit(Unit('K',actor_side))
                        fr,fc=3+dr*sign,3+dc*sign
                        b.grid[fr][fc].add_unit(Unit(actor,actor_side))
                        sq=b.grid[3][3]
                        for c in ('K'+escort if king_slot==0 else escort+'K'):sq.add_unit(Unit(c,owner))
                        sq.layout=layout
                        e=Engine('rulesets/default.yaml');e.set_state(GameState(b,to_move=actor_side))
                        emit(e,chosen=(fr,fc,0,3,3,1))

# Special-class and mixed formation legality, including Commander exposure.
for actor in 'PNBRQK':
    for defender in 'PNBRQK':
        for bottom in [None,*'PNBR']:
            b=Board(8,8)
            if actor!='K': b.grid[7][7].add_unit(Unit('K','north'))
            if defender!='K': b.grid[0][0].add_unit(Unit('K','south'))
            b.grid[4][4].add_unit(Unit(actor,'north'));b.grid[3][4].add_unit(Unit(defender,'south'))
            if bottom: b.grid[3][4].add_unit(Unit(bottom,'south'))
            e=Engine('rulesets/default.yaml');e.set_state(GameState(b));emit(e)

# Deterministic v3 stance transitions: every sector, slot, owner and formation.
for defender in ['north','south']:
    actor_side='south' if defender=='north' else 'north'
    sign=1 if defender=='north' else -1
    for dr,dc in [(-1,-1),(-1,0),(-1,1),(0,-1),(0,1),(1,-1),(1,0),(1,1)]:
        for code in 'PNBR':
            for slot in [0,1]:
                for formation in [False,True]:
                    b=Board(8,8)
                    b.grid[7][7].add_unit(Unit('K','north'));b.grid[0][0].add_unit(Unit('K','south'))
                    fr,fc=3+dr*sign,3+dc*sign
                    if slot:b.grid[fr][fc].add_unit(Unit('P',actor_side))
                    b.grid[fr][fc].add_unit(Unit(code,actor_side));b.grid[3][3].add_unit(Unit(code,defender))
                    if formation:b.grid[3][3].add_unit(Unit('P',defender))
                    e=Engine('rulesets/default.yaml');e.set_state(GameState(b,to_move=actor_side))
                    emit(e,chosen=(fr,fc,slot,3,3,1))

# Every ordinary attacking class, ordered defending pair, physical arrangement,
# owner and approach. Explicitly exercise both simultaneous and reserve waves.
for owner in ('north','south'):
    actor_side='south' if owner=='north' else 'north'
    sign=1 if owner=='north' else -1
    for dr,dc in [(-1,-1),(-1,0),(-1,1),(0,-1),(0,1),(1,-1),(1,0),(1,1)]:
        for layout in range(4):
            for actor in 'PNBR':
                for first in 'PNBR':
                    for second in 'PNBR':
                        b=Board(8,8)
                        b.grid[7][7].add_unit(Unit('K','north'));b.grid[0][0].add_unit(Unit('K','south'))
                        fr,fc=3+dr*sign,3+dc*sign
                        b.grid[fr][fc].add_unit(Unit(actor,actor_side))
                        sq=b.grid[3][3];sq.add_unit(Unit(first,owner));sq.add_unit(Unit(second,owner))
                        sq.layout=canonical_layout(sq.top,sq.bottom,layout)
                        e=Engine('rulesets/default.yaml');e.set_state(GameState(b,to_move=actor_side))
                        emit(e,chosen=(fr,fc,0,3,3,1))

# Warp: every target class, solitary or in a formation (with either member order), Priestess
# alone, in a formation or escorting the King, targets one and two squares away (including
# out of range), both owners, and several enemy King rows.
for owner in ('north','south'):
    enemy='south' if owner=='north' else 'north'
    for target in 'PNBRQK':
        for stacked in (False,True):
            for pair in ('Q','QP','PQ','QK','KQ'):
                for king_row in (0,3,7):
                    for at in ((3,3),(2,3),(2,5),(1,3)):
                        b=Board(8,8)
                        if 'K' not in pair: b.grid[7 if owner=='north' else 0][7].add_unit(Unit('K',owner))
                        for c in pair: b.grid[4][3].add_unit(Unit(c,owner))
                        if target=='K':
                            b.grid[at[0]][at[1]].add_unit(Unit('K',enemy))
                            b.grid[king_row][0].add_unit(Unit('P',enemy))   # supporter: a lone King ends the game
                        else:
                            b.grid[king_row][0].add_unit(Unit('K',enemy))
                            b.grid[at[0]][at[1]].add_unit(Unit(target,enemy))
                        if stacked: b.grid[at[0]][at[1]].add_unit(Unit(rng.choice('PNBR'),enemy))
                        e=Engine('rulesets/default.yaml')
                        try: e.set_state(GameState(b,to_move=owner))
                        except ValueError: continue
                        warps=[a for a in e.legal_actions() if a[5]==3]
                        emit(e,chosen=rng.choice(warps) if warps else None)

# ---------------------------------------------------------------- Open Field
OPEN = 'rulesets/open_field.yaml'

# Seeded Open Field games from the standard opening.
for _ in range(60):
    e = Engine(OPEN)
    for ply in range(120):
        if e.state.done: break
        emit(e)

def open_position(pieces, to_move):
    """Settle an Open Field study position; None when it is not a legal setup."""
    b = Board(8, 8)
    for (r, c), code, owner in pieces:
        b.grid[r][c].add_unit(Unit(code, owner))
    e = Engine(OPEN)
    try: e.set_state(GameState(b, to_move=to_move))
    except ValueError: return None
    return e

# Sparse and crowded random study positions: one unit per square, every class.
for _ in range(900):
    squares = rng.sample(range(64), rng.randint(4, 28))
    pieces = [((squares[0]//8, squares[0]%8), 'K', 'north'), ((squares[1]//8, squares[1]%8), 'K', 'south')]
    queens = set()
    for k in squares[2:]:
        owner = rng.choice(['north', 'south'])
        code = rng.choice('PPNBBRQ')
        if code == 'Q' and owner in queens: code = 'B'
        if code == 'Q': queens.add(owner)
        pieces.append(((k//8, k%8), code, owner))
    e = open_position(pieces, rng.choice(['north', 'south']))
    if e: emit(e)

# Reach around blockers: each class at several squares, with friendly and enemy walls.
for owner in ('north', 'south'):
    enemy = 'south' if owner == 'north' else 'north'
    for code in 'PNBRQK':
        for origin in ((4, 3), (6, 1), (1, 6), (3, 0), (5, 5)):
            for _ in range(6):
                pieces = [(origin, code, owner)]
                taken = {origin}
                for k in rng.sample(range(64), 12):
                    sq = (k//8, k%8)
                    if sq in taken: continue
                    taken.add(sq)
                    pieces.append((sq, rng.choice('PNBR'), rng.choice([owner, enemy])))
                free = [(r, c) for r in range(8) for c in range(8) if (r, c) not in taken]
                rng.shuffle(free)
                if code != 'K': pieces.append((free.pop(), 'K', owner))
                pieces.append((free.pop(), 'K', enemy))
                e = open_position(pieces, owner)
                if e:
                    mine = [a for a in e.legal_actions() if (a[0], a[1]) == origin]
                    emit(e, chosen=rng.choice(mine) if mine else None)

# Power shots: a target in every direction, a supporting Archer on every neighbour or none.
dirs = [(dr, dc) for dr in (-1, 0, 1) for dc in (-1, 0, 1) if dr or dc]
for owner in ('north', 'south'):
    enemy = 'south' if owner == 'north' else 'north'
    for target_dir in dirs:
        for target in 'NRBPQ':
            for friend_dir in [None, *dirs]:
                if friend_dir == target_dir: continue
                pieces = [((4, 3), 'B', owner), ((4+target_dir[0], 3+target_dir[1]), target, enemy),
                          ((7, 7), 'K', 'north'), ((0, 7), 'K', 'south'), ((7, 0), 'P', 'north'), ((0, 0), 'P', 'south')]
                if friend_dir: pieces.append(((4+friend_dir[0], 3+friend_dir[1]), 'B', owner))
                e = open_position(pieces, owner)
                if e:
                    shots = [a for a in e.legal_actions() if a[5] == 2]
                    emit(e, chosen=rng.choice(shots) if shots else None)
