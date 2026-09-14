from __future__ import annotations
from dataclasses import dataclass, field
from collections import Counter

@dataclass
class Unit:
    code: str
    side: str

@dataclass
class Square:
    top: Unit | None = None
    bottom: Unit | None = None

    def is_empty(self):
        return self.top is None and self.bottom is None

    def add_unit(self, unit):
        if self.top is None:
            if self.bottom is not None:
                raise ValueError("Bottom unit without top")
            self.top = unit
        elif self.top.side != unit.side or self.bottom is not None:
            raise ValueError("Only two friendly units may share a square")
        else:
            self.bottom = unit

    def remove_unit(self, which="top"):
        if which == "top" and self.top is not None:
            unit = self.top
            self.top, self.bottom = self.bottom, None
            return unit
        if which == "bottom" and self.bottom is not None:
            unit, self.bottom = self.bottom, None
            return unit
        raise ValueError(f"No {which} unit")

@dataclass
class Board:
    rows: int
    cols: int
    grid: list[list[Square]] = field(default_factory=list)

    def __post_init__(self):
        if not self.grid:
            self.grid = [[Square() for _ in range(self.cols)] for _ in range(self.rows)]

    def copy(self):
        def clone(u):
            return Unit(u.code, u.side) if u else None
        return Board(self.rows, self.cols, [[Square(clone(s.top), clone(s.bottom)) for s in row]
                                           for row in self.grid])

    def validate(self):
        if len(self.grid) != self.rows or any(len(row) != self.cols for row in self.grid):
            raise ValueError("Board dimensions do not match grid")
        kings = Counter()
        queens = Counter()
        for row in self.grid:
            for s in row:
                if s.bottom and not s.top:
                    raise ValueError("Bottom unit without top")
                if s.top and s.bottom and s.top.side != s.bottom.side:
                    raise ValueError("Opposing units share a square")
                for u in (s.top, s.bottom):
                    if u:
                        if u.code not in "PNBRQK" or u.side not in ("north", "south"):
                            raise ValueError("Unknown unit")
                        if u.code == "K": kings[u.side] += 1
                        if u.code == "Q": queens[u.side] += 1
        if any(n > 1 for n in kings.values()) or any(n > 1 for n in queens.values()):
            raise ValueError("At most one Commander and Priestess per side")

@dataclass
class GameState:
    board: Board
    to_move: str = "north"
    terminated: bool = False
    truncated: bool = False
    winner: str | None = None
    reason: str | None = None
    move_count: int = 0
    position_counts: dict[tuple, int] = field(default_factory=dict)

    @property
    def done(self):
        return self.terminated or self.truncated

    def position_key(self):
        def key(u):
            if u is None: return 0
            return (1 if u.side == "north" else -1) * ("PNBRQK".index(u.code) + 1)
        return (self.to_move, tuple(key(u) for row in self.board.grid for sq in row
                                  for u in (sq.top, sq.bottom)))

    def copy(self):
        return GameState(self.board.copy(), self.to_move, self.terminated, self.truncated,
                         self.winner, self.reason, self.move_count, self.position_counts.copy())

def standard_setup(rows=8, cols=8):
    if (rows, cols) != (8, 8):
        raise ValueError("Standard setup requires an 8x8 board")
    b = Board(rows, cols)
    for side, back, pawns in (("north", 7, 6), ("south", 0, 1)):
        for c, code in enumerate("RNBQKBNR"):
            b.grid[back][c].add_unit(Unit(code, side))
            b.grid[pawns][c].add_unit(Unit("P", side))
    return b
