from __future__ import annotations
from pettingzoo.utils.conversions import aec_to_parallel
from .pettingzoo_env import age_of_chess_v0

def age_of_chess_parallel_v0(ruleset_path: str):
    """
    Returns a Gymnasium-parallel-style env by converting the AEC env.
    Useful for Stable-Baselines3 and other single-agent tooling expecting ParallelEnv.
    """
    return aec_to_parallel(age_of_chess_v0(ruleset_path))
