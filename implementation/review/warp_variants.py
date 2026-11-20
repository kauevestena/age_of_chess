"""Does using Warp help? Greedy (which values Warp) against an identical Greedy that never warps.

Colors are swapped within each seed pair. Run from the repository root:

    python -m implementation.review.warp_variants --pairs 320

The result is a measurement for these heuristic agents, not for expert play.
"""
import argparse
from multiprocessing import Pool

from implementation.age_of_chess.agents import GreedyAgent, score_action, suggest_preparation
from implementation.age_of_chess.env import Engine
from implementation.age_of_chess.rules_loader import load_ruleset


class NoWarpGreedy(GreedyAgent):
    """Same scoring and tie-breaks as Greedy, but never issues a Warp."""
    def select(self, engine):
        legal = [a for a in engine.legal_orders() if a[5] != 3]
        if not legal:
            return None
        scored = [(score_action(engine, a), a) for a in legal]
        best = max(v for v, _ in scored)
        order = self.rng.choice([a for v, a in scored if v == best])
        return suggest_preparation(engine, order) or order


def play(task):
    ruleset, warp_range, breaks, pair, warper_is_north, cap = task
    rules = load_ruleset(ruleset)
    ability = next(a for a in rules.game.pieces["Q"].abilities if a.name == "warp")
    ability.range, ability.breaks_formations = warp_range, breaks
    engine = Engine(rules=rules)
    warper, plain = GreedyAgent(pair * 2), NoWarpGreedy(pair * 2 + 1)
    sides = {"north": warper, "south": plain} if warper_is_north else {"north": plain, "south": warper}
    mine = "north" if warper_is_north else "south"
    while not engine.state.done and engine.state.move_count < cap:
        engine.apply(sides[engine.state.to_move].select(engine))
    if engine.state.winner == mine:
        return 1.0
    return 0.5 if engine.state.winner in (None, "draw") else 0.0


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--ruleset", default="rulesets/default.yaml")
    parser.add_argument("--pairs", type=int, default=320)
    parser.add_argument("--max-plies", type=int, default=256)
    parser.add_argument("--workers", type=int, default=4)
    args = parser.parse_args()
    with Pool(args.workers) as pool:
        for warp_range, breaks in [(1, False), (2, False), (1, True), (2, True)]:
            tasks = [(args.ruleset, warp_range, breaks, p, north, args.max_plies)
                     for p in range(args.pairs) for north in (True, False)]
            results = pool.map(play, tasks, chunksize=8)
            print(f"range {warp_range}, formation breaking {'on' if breaks else 'off'}: Warp-using Greedy scores "
                  f"{sum(results) / len(results):.3f} over {len(results)} games "
                  f"(wins {sum(r == 1.0 for r in results)}, losses {sum(r == 0.0 for r in results)}, "
                  f"other {sum(r == 0.5 for r in results)})")


if __name__ == "__main__":
    main()
