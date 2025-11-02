
import os, glob, json, time, csv, math
from dataclasses import dataclass
from typing import Optional, Dict, List, Tuple, Any

from implementation.age_of_chess.pettingzoo_env import age_of_chess_v0
from implementation.age_of_chess.utils import encode_action
from implementation.age_of_chess.agents import GreedyAgent
from .elo import compute_elo, rating_ci

# Optional imports (skip if unavailable)
try:
    from stable_baselines3 import A2C
except Exception:  # pragma: no cover
    A2C = None
try:
    from sb3_contrib import MaskablePPO
except Exception:  # pragma: no cover
    MaskablePPO = None

@dataclass
class Result:
    white: str
    black: str
    winner: Optional[str]  # "north", "south", or None for draw
    rewards: Dict[str,float]
    steps: int

class Policy:
    name: str
    def select(self, env) -> Optional[int]:
        raise NotImplementedError

class RandomPolicy(Policy):
    def __init__(self):
        self.name = "Random"
    def select(self, env):
        mask = env.infos[env.agent_selection].get("action_mask")
        legal = [i for i,m in enumerate(mask) if m==1] if mask else list(range(env.action_space(env.agent_selection).n))
        if not legal:
            return None
        import random
        return random.choice(legal)

class GreedyPolicyWrapper(Policy):
    def __init__(self):
        self.name = "Greedy"
        self._g = GreedyAgent()
    def select(self, env):
        engine = env.unwrapped.engine
        act = self._g.select(engine)
        if act is None:
            return None
        return encode_action(*act)


def _build_matrix(names, results):
    idx = {n:i for i,n in enumerate(names)}
    n = len(names)
    import numpy as np
    W = np.zeros((n,n), dtype=float)
    C = np.zeros((n,n), dtype=int)
    for r in results:
        i = idx[r["white"]]; j = idx[r["black"]]
        C[i,j] += 1
        if r["winner"] is None:
            W[i,j] += 0.5
        elif r["winner"] == "north":
            W[i,j] += 1.0
        else:
            W[i,j] += 0.0
    # winrate matrix
    M = W / (C + (C==0))  # avoid div0; zeros stay zero
    return M, C

def _save_heatmap(names, results, out_path_png):
    import matplotlib.pyplot as plt
    M, C = _build_matrix(names, results)
    fig = plt.figure(figsize=(6,6))
    ax = fig.add_subplot(111)
    im = ax.imshow(M)  # default colormap; single plot
    ax.set_xticks(range(len(names))); ax.set_yticks(range(len(names)))
    ax.set_xticklabels(names, rotation=45, ha="right")
    ax.set_yticklabels(names)
    # annotate with counts
    for i in range(len(names)):
        for j in range(len(names)):
            if C[i,j] > 0:
                ax.text(j, i, f"{M[i,j]:.2f}\\n({C[i,j]})", ha="center", va="center")
    ax.set_title("Head-to-Head Winrate (white vs black)")
    fig.tight_layout()
    fig.savefig(out_path_png)
    plt.close(fig)

class SB3Policy(Policy):
    def __init__(self, path: str):
        self.path = path
        base = os.path.basename(path)
        self.name = f"SB3:{base}"
        self.model = None
        self.is_maskable = False
        self._load()

    def _load(self):
        # Try MaskablePPO first, then A2C
        global MaskablePPO, A2C
        if MaskablePPO is not None:
            try:
                self.model = MaskablePPO.load(self.path)
                self.is_maskable = True
                return
            except Exception:
                pass
        if A2C is not None:
            try:
                self.model = A2C.load(self.path)
                self.is_maskable = False
                return
            except Exception:
                pass
        raise RuntimeError(f"Could not load SB3 model from {self.path} (need sb3-contrib or stable-baselines3).")

    def select(self, env):
        # Build observation and (optional) mask for the acting agent
        obs, _, _, _, info = env.last()
        mask = info.get("action_mask")
        # SB3 expects batched obs
        import numpy as np
        bobs = np.expand_dims(obs, axis=0)
        if self.is_maskable:
            action, _ = self.model.predict(bobs, deterministic=True, action_masks=mask)
        else:
            action, _ = self.model.predict(bobs, deterministic=True)
        # unwrap scalar
        try:
            return int(action.item())
        except Exception:
            return int(action)

def discover_agents(models_dir: str = "models") -> List[Policy]:
    agents: List[Policy] = [GreedyPolicyWrapper(), RandomPolicy()]
    for p in glob.glob(os.path.join(models_dir, "*.zip")):
        # Try to instantiate SB3Policy; if libs missing, skip gracefully
        try:
            agents.append(SB3Policy(p))
        except Exception:
            # Unavailable libs or bad file — skip
            continue
    return agents

def play_game(white: Policy, black: Policy, ruleset: str, max_steps: int = 200) -> Result:
    env = age_of_chess_v0(ruleset_path=ruleset)
    env.reset()
    steps = 0
    while steps < max_steps:
        agent = env.agent_selection
        pol = white if agent == "north" else black
        action = pol.select(env)
        if action is None:
            # no legal move: env will handle terminal on step with illegal fallback; choose a random illegal to trigger
            action = 0
        env.step(action)
        steps += 1
        if env.terminations["north"] and env.terminations["south"]:
            break
    # Determine winner by rewards sign or king capture was already encoded
    rw = env.rewards
    winner = None
    if rw["north"] > rw["south"]:
        winner = "north"
    elif rw["south"] > rw["north"]:
        winner = "south"
    return Result(white=white.name, black=black.name, winner=winner, rewards=dict(rw), steps=steps)

def run_league(ruleset: str = "rulesets/default.yaml", games_per_pair: int = 4, models_dir: str = "models", out_dir: str = "logs/league"):
    os.makedirs(out_dir, exist_ok=True)
    agents = discover_agents(models_dir=models_dir)
    names = [a.name for a in agents]
    # standings: points (win=1, draw=0.5)
    points: Dict[str, float] = {n: 0.0 for n in names}
    results: List[Dict[str,Any]] = []
    for i in range(len(agents)):
        for j in range(i+1, len(agents)):
            a, b = agents[i], agents[j]
            for k in range(games_per_pair):
                # alternate colors
                if k % 2 == 0:
                    white, black = a, b
                else:
                    white, black = b, a
                res = play_game(white, black, ruleset=ruleset)
                rec = {
                    "white": res.white,
                    "black": res.black,
                    "winner": res.winner,
                    "rewards": res.rewards,
                    "steps": res.steps,
                }
                results.append(rec)
                # assign points
                if res.winner is None:
                    points[res.white] += 0.5
                    points[res.black] += 0.5
                elif res.winner == "north":
                    points[res.white] += 1.0
                else:
                    points[res.black] += 1.0

    # write JSONL
    ts = time.strftime("%Y%m%d_%H%M%S")
    jsonl_path = os.path.join(out_dir, f"league_{ts}.jsonl")
    with open(jsonl_path, "w") as jf:
        for r in results:
            jf.write(json.dumps(r) + "\n")

    # write standings CSV
    csv_path = os.path.join(out_dir, f"standings_{ts}.csv")
    with open(csv_path, "w", newline="") as cf:
        w = csv.writer(cf)
        w.writerow(["agent", "points"])
        for name, pts in sorted(points.items(), key=lambda x: x[1], reverse=True):
            w.writerow([name, f"{pts:.2f}"])

    # compute Elo + CI
    elo = compute_elo(results)
    ci = rating_ci(results, elo)

    # write Markdown with Elo
    md_path = os.path.join(out_dir, f"standings_{ts}.md")
    with open(md_path, "w") as mf:
        mf.write("| Agent | Points | Elo | 95% CI |\n|---|---:|---:|---:|\n")
        for name, pts in sorted(points.items(), key=lambda x: x[1], reverse=True):
            er = elo.get(name, 1500.0); lo, hi = ci.get(name, (er, er))
            mf.write(f"| {name} | {pts:.2f} | {er:.1f} | [{lo:.0f}, {hi:.0f}] |\n")

    # save heatmap png
    png_path = os.path.join(out_dir, f"heatmap_{ts}.png")
    _save_heatmap(names, results, png_path)

    print("Wrote:", jsonl_path, csv_path, md_path, png_path)
    return jsonl_path, csv_path, md_path

if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument("--ruleset", default="rulesets/default.yaml")
    p.add_argument("--games", type=int, default=4, help="Games per pairing (alternates colors)")
    p.add_argument("--models", default="models", help="Directory with SB3 model .zip files")
    p.add_argument("--out", default="logs/league")
    args = p.parse_args()
    run_league(ruleset=args.ruleset, games_per_pair=args.games, models_dir=args.models, out_dir=args.out)
