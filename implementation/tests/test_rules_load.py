from implementation.age_of_chess.rules_loader import load_ruleset

def test_rules_load():
    rules = load_ruleset("rulesets/default.yaml")
    assert rules.game.board["rows"] == 8
    assert "P" in rules.game.pieces
