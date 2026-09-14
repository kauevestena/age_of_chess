import pytest
from pathlib import Path
from implementation.age_of_chess.rules_loader import load_ruleset

def test_rules_load(rules):
    assert rules.game.board.rows == 8
    assert rules.game.combat.single["P"]["B"] == "win"
    assert rules.game.combat.single["B"]["P"] == "lose"

def test_rulesheet_table_matches_executable_rules(rules):
    codes = "PNBRQK"
    symbols = {"win":"W", "lose":"L", "mutual":"M", "illegal":"—"}
    expected = ["| Attacker / Defender | P | N | B | R | Q | K |",
                "|---|:---:|:---:|:---:|:---:|:---:|:---:|"]
    expected += ["| " + c + " | " + " | ".join(symbols[rules.game.combat.single[c][d]] for d in codes) + " |" for c in codes]
    text = Path("rulesets/RULES.md").read_text()
    actual = text.split("<!-- combat-table:start -->")[1].split("<!-- combat-table:end -->")[0].strip()
    assert actual == "\n".join(expected)

@pytest.mark.parametrize("addition", ["\nrewards: {}\n", "\nunknown_setting: 1\n"])
def test_ambiguous_or_unsupported_yaml_rejected(tmp_path, addition):
    path = tmp_path / "rules.yaml"
    path.write_text(Path("rulesets/default.yaml").read_text()+addition)
    with pytest.raises(ValueError): load_ruleset(str(path))

def test_yaml_movement_abilities_values_are_executable(rules):
    from implementation.age_of_chess.env import Engine
    r = rules.model_copy(deep=True)
    e = Engine(rules=r)
    before = e._material()["north"]
    r.game.pieces["P"].value += 10
    assert e._material()["north"] == before + 80
    r.game.pieces["P"].move.steps = []
    assert not any(a[:2] == (6, 0) for a in e.legal_actions())
