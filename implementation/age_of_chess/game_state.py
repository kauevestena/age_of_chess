from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional, List

@dataclass
class Unit:
    code: str      # 'P','N','B','R','Q','K'
    side: str      # 'north' or 'south'

@dataclass
class Square:
    top: Optional[Unit] = None
    bottom: Optional[Unit] = None

    def is_empty(self) -> bool:
        return self.top is None and self.bottom is None

    def add_unit(self, u: Unit) -> None:
        if self.top is None:
            self.top = u
        elif self.bottom is None:
            self.bottom = u
        else:
            raise ValueError("Square already has two units")

    def remove_unit(self, which: str = "top") -> Unit:
        if which == "top":
            if self.top is None: raise ValueError("No top unit")
            u = self.top
            self.top = None
            if self.bottom is not None:
                self.top, self.bottom = self.bottom, None
            return u
        else:
            if self.bottom is None: raise ValueError("No bottom unit")
            u = self.bottom
            self.bottom = None
            return u

@dataclass
class Board:
    rows: int
    cols: int
    grid: List[List[Square]] = field(default_factory=list)

    def __post_init__(self):
        if not self.grid:
            self.grid = [[Square() for _ in range(self.cols)] for _ in range(self.rows)]

    def copy(self) -> "Board":
        import copy
        return copy.deepcopy(self)

@dataclass
class GameState:
    board: Board
    to_move: str = "north"
    terminated: bool = False
    winner: Optional[str] = None
    move_count: int = 0

def standard_setup(rows: int, cols: int) -> Board:
    b = Board(rows, cols)
    # North (bottom) moves up; South (top) moves down.
    north_back = rows-1
    north_pawn = rows-2
    south_back = 0
    south_pawn = 1

    order = ["R","N","B","Q","K","B","N","R"]
    for c, code in enumerate(order):
        b.grid[north_back][c].add_unit(Unit(code, "north"))
    for c in range(cols):
        b.grid[north_pawn][c].add_unit(Unit("P", "north"))

    for c, code in enumerate(order):
        b.grid[south_back][c].add_unit(Unit(code, "south"))
    for c in range(cols):
        b.grid[south_pawn][c].add_unit(Unit("P", "south"))

    return b
