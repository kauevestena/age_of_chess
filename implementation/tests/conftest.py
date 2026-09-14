import pytest
from implementation.age_of_chess.rules_loader import load_ruleset
from implementation.age_of_chess.game_state import Board, GameState, Unit
from implementation.age_of_chess.env import Engine

@pytest.fixture(scope="session")
def rules():
    return load_ruleset("rulesets/default.yaml")

@pytest.fixture
def position(rules):
    def make(pieces, side="north", settle=True):
        board = Board(8, 8)
        for r, c, codes, owner in pieces:
            for code in codes: board.grid[r][c].add_unit(Unit(code, owner))
        for owner, square in (("north", (7, 7)), ("south", (0, 7))):
            if not any(u and u.code == "K" and u.side == owner for row in board.grid for sq in row for u in (sq.top, sq.bottom)):
                board.grid[square[0]][square[1]].add_unit(Unit("K", owner))
        engine = Engine(rules=rules)
        state = GameState(board, to_move=side)
        if settle: engine.set_state(state)
        else:
            engine.state = state
            state.position_counts[state.position_key()] = 1
        return engine
    return make
