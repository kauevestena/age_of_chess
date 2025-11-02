
from __future__ import annotations
from typing import Dict, List, Tuple, Optional
import math
from collections import defaultdict

def _expected(pA: float, pB: float) -> float:
    return 1.0 / (1.0 + 10 ** ((pB - pA) / 400.0))

def compute_elo(results: List[dict], k: float = 20.0, iters: int = 3) -> Dict[str, float]:
    """
    Compute Elo ratings from league JSONL results.
    Results entries: {white, black, winner, rewards, steps}
    Treat draw as 0.5. Initialize 1500 and iterate a few passes to reduce order effects.
    """
    players = set()
    for r in results:
        players.add(r["white"]); players.add(r["black"])
    R = {p: 1500.0 for p in players}

    # Convert results to (A,B,score_for_A)
    games = []
    for r in results:
        A = r["white"]; B = r["black"]
        if r["winner"] is None:
            sA = 0.5
        elif r["winner"] == "north":
            sA = 1.0  # white won
        else:
            sA = 0.0
        games.append((A,B,sA))

    for _ in range(iters):
        for A,B,sA in games:
            EA = _expected(R[A], R[B])
            R[A] += k * (sA - EA)
            R[B] += k * ((1.0 - sA) - (1.0 - EA))

    # center ratings to mean 1500 for nicer presentation
    meanR = sum(R.values())/len(R)
    shift = 1500.0 - meanR
    for p in R: R[p] += shift
    return R

def _wilson_interval(wins: float, n: float, z: float = 1.96) -> Tuple[float,float]:
    if n <= 0: return (0.0, 1.0)
    p = wins / n
    denom = 1 + z*z/n
    center = (p + z*z/(2*n)) / denom
    margin = (z * math.sqrt((p*(1-p) + z*z/(4*n))/n)) / denom
    lo, hi = max(0.0, center - margin), min(1.0, center + margin)
    return lo, hi

def rating_ci(results: List[dict], ratings: Dict[str,float]) -> Dict[str, Tuple[float,float]]:
    """
    Heuristic CI: for each player, compute score rate vs field, Wilson CI -> translate
    to rating delta vs avg field using logistic mapping: RD = 400 * log10(p/(1-p))
    Then add delta to field-average rating (which is 1500 after centering).
    """
    # gather scores
    total = defaultdict(int)
    points = defaultdict(float)
    for r in results:
        A = r["white"]; B = r["black"]
        total[A] += 1; total[B] += 1
        if r["winner"] is None:
            points[A] += 0.5; points[B] += 0.5
        elif r["winner"] == "north":
            points[A] += 1.0
        else:
            points[B] += 1.0

    ci = {}
    for p in ratings:
        n = total[p]
        w = points[p]
        lo, hi = _wilson_interval(w, n)
        # map p -> rating delta vs field
        def p_to_delta(x):
            eps = 1e-6
            x = min(1-eps, max(eps, x))
            return 400.0 * math.log10(x/(1.0-x))
        loR = 1500.0 + p_to_delta(lo)
        hiR = 1500.0 + p_to_delta(hi)
        ci[p] = (loR, hiR)
    return ci
