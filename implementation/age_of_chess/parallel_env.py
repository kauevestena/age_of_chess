"""Sequential board updates cannot safely use PettingZoo's cycle conversion."""

def age_of_chess_parallel_v0(ruleset_path="rulesets/default.yaml"):
    raise NotImplementedError(
        "Age of Chess is sequential. Use age_of_chess_v1 for AEC or "
        "AOCSingleAgentSelfPlayEnv for Gym/SB3; aec_to_parallel is not valid here."
    )
