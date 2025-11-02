from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Dict, List
import yaml

class PieceSpec(BaseModel):
    label: str
    class_: str = Field(alias="class")
    move: dict
    abilities: List[dict] = []
    capture: str
    interactions: dict = {}
    value: int = 1

class GameSpec(BaseModel):
    name: str
    board: dict
    turn: dict
    pieces: Dict[str, PieceSpec]
    stacking: dict
    victory: dict
    setup: dict

class Ruleset(BaseModel):
    game: GameSpec

def load_ruleset(path: str) -> Ruleset:
    with open(path, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)
    return Ruleset(**data)
