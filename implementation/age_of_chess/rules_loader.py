"""Validated, executable rules. Unknown settings and duplicate YAML keys fail fast."""
from __future__ import annotations
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator
import yaml

CODES = "PNBRQK"

class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")

class MoveSpec(StrictModel):
    steps: list[tuple[int, int]]
    max_steps: int = Field(default=1, ge=1, le=2)
    attack_field_sideways: bool = True
    last_rank_all_directions: bool = True
    retreat_trigger: Literal["none", "adjacent_enemy", "nearby_enemy"] = "none"
    threat_radius: int = Field(default=1, ge=1, le=8)

    @model_validator(mode="after")
    def forward_steps(self):
        if len(set(self.steps)) != len(self.steps) or any(dr != -1 or dc not in (-1, 0, 1) for dr, dc in self.steps):
            raise ValueError("steps must be distinct one-square north-forward directions")
        return self

class AbilitySpec(StrictModel):
    name: Literal["ranged", "power_shot", "convert"]
    range: int = Field(ge=1, le=2)
    targets: list[str]
    requires_stack_size: int = Field(default=1, ge=1, le=2)

    @model_validator(mode="after")
    def targets_valid(self):
        if any(c not in CODES for c in self.targets):
            raise ValueError("unknown ability target")
        if "K" in self.targets or (self.name == "convert" and "Q" in self.targets):
            raise ValueError("Commanders cannot be shot/converted; Priestesses cannot be converted")
        if self.name == "convert" and (self.range != 1 or self.requires_stack_size != 1):
            raise ValueError("conversion is an adjacent single-unit ability")
        if self.name == "power_shot" and self.requires_stack_size != 2:
            raise ValueError("power shot requires two Archers")
        return self

class PieceSpec(StrictModel):
    label: str
    class_: str = Field(alias="class")
    move: MoveSpec
    abilities: list[AbilitySpec] = Field(default_factory=list)
    value: float = Field(gt=0)

class BoardSpec(StrictModel):
    rows: Literal[8] = 8
    cols: Literal[8] = 8
    attack_field_depth: int = Field(default=4, ge=1, le=4)

class MinimalLossSpec(StrictModel):
    enabled: bool = True
    preserve_order: list[str] = Field(default_factory=lambda: ["R", "N", "B", "P", "Q"])

    @model_validator(mode="after")
    def order_valid(self):
        if len(self.preserve_order) != 5 or set(self.preserve_order) != set("PNBRQ"):
            raise ValueError("preserve_order must list every non-King class exactly once")
        return self

class StackRule(StrictModel):
    attacker: str
    top: str
    bottom: str
    outcome: tuple[bool, bool, bool]

class CombatSpec(StrictModel):
    single: dict[str, dict[str, Literal["win", "lose", "mutual", "illegal"]]]
    stacks: list[StackRule]

class GameSpec(StrictModel):
    name: str
    version: Literal[2]
    board: BoardSpec
    minimal_loss: MinimalLossSpec
    pieces: dict[str, PieceSpec]
    combat: CombatSpec
    repetition_draw: int = Field(default=3, ge=2)

    @model_validator(mode="after")
    def complete_rules(self):
        if set(self.pieces) != set(CODES) or set(self.combat.single) != set(CODES):
            raise ValueError("all six classes must be specified")
        for row in self.combat.single.values():
            if set(row) != set(CODES):
                raise ValueError("single combat matrix must specify all 36 ordered pairs")
        if any(row["K"] != "win" for row in self.combat.single.values()):
            raise ValueError("Commander capture must be a win for every attacker")
        for rule in self.combat.stacks:
            if rule.top == "K":
                raise ValueError("Stack overrides cannot override Commander capture")
            if rule.attacker not in CODES or rule.top not in CODES or rule.bottom not in CODES + "*":
                raise ValueError("unknown stack combat class")
        seen = set()
        for rule in self.combat.stacks:
            key = (rule.attacker, rule.top, rule.bottom)
            if key in seen:
                raise ValueError("duplicate stack combat rule")
            seen.add(key)
        for code, piece in self.pieces.items():
            names = [a.name for a in piece.abilities]
            if len(set(names)) != len(names):
                raise ValueError("duplicate ability")
            if any((a.name == "convert" and code != "Q") or
                   (a.name != "convert" and code != "B") for a in piece.abilities):
                raise ValueError("conversion belongs to Priestess; shooting to Archer")
        return self

class RewardsSpec(StrictModel):
    win: float = Field(default=1.0, gt=0)
    loss: float = Field(default=-1.0, lt=0)
    draw: Literal[0.0] = 0.0

    @model_validator(mode="after")
    def zero_sum(self):
        if self.win != -self.loss:
            raise ValueError("terminal rewards must be zero-sum")
        return self

class Ruleset(StrictModel):
    game: GameSpec
    rewards: RewardsSpec = Field(default_factory=RewardsSpec)

class UniqueKeyLoader(yaml.SafeLoader):
    pass

def _mapping(loader, node, deep=False):
    result = {}
    for key_node, value_node in node.value:
        key = loader.construct_object(key_node, deep=deep)
        if key in result:
            raise ValueError(f"Duplicate YAML key: {key}")
        result[key] = loader.construct_object(value_node, deep=deep)
    return result

UniqueKeyLoader.add_constructor(yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG, _mapping)

def load_ruleset(path: str) -> Ruleset:
    with open(path, encoding="utf-8") as f:
        return Ruleset.model_validate(yaml.load(f, Loader=UniqueKeyLoader))
