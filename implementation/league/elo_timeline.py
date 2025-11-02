
import os, re, json, glob
from datetime import datetime
from typing import List, Dict
import numpy as np
import matplotlib.pyplot as plt

from .elo import compute_elo

LEAGUE_DIR = "logs/league"

def _parse_ts(path: str) -> datetime:
    m = re.search(r'league_(\d{8}_\d{6})\.jsonl$', path)
    if not m:
        return datetime.fromtimestamp(os.path.getmtime(path))
    return datetime.strptime(m.group(1), "%Y%m%d_%H%M%S")

def _read_results(path: str) -> List[dict]:
    out = []
    with open(path, "r") as f:
        for line in f:
            line = line.strip()
            if not line: 
                continue
            out.append(json.loads(line))
    return out

def build_timeline(league_dir: str = LEAGUE_DIR):
    files = sorted(glob.glob(os.path.join(league_dir, "league_*.jsonl")), key=_parse_ts)
    if not files:
        print("No league_*.jsonl files found in", league_dir)
        return None
    timeline = []  # list of (ts, ratings dict)
    all_agents = set()
    for fp in files:
        ts = _parse_ts(fp)
        results = _read_results(fp)
        ratings = compute_elo(results)
        timeline.append((ts, ratings))
        all_agents.update(ratings.keys())
    return timeline, sorted(all_agents)

def save_csv(timeline, agents, out_csv):
    import csv
    with open(out_csv, "w", newline="") as cf:
        w = csv.writer(cf)
        header = ["timestamp"] + agents
        w.writerow(header)
        for ts, ratings in timeline:
            row = [ts.isoformat()]
            for a in agents:
                row.append(f"{ratings.get(a, '')}")
            w.writerow(row)
    print("Wrote", out_csv)

def save_plot(timeline, agents, out_png):
    # Single plot, default colors, one line per agent that appears at least once
    import matplotlib.pyplot as plt
    xs = [ts for ts,_ in timeline]
    fig = plt.figure(figsize=(8,4.5))
    ax = fig.add_subplot(111)
    for a in agents:
        ys = []
        for _, ratings in timeline:
            ys.append(ratings.get(a, np.nan))
        ax.plot(xs, ys, marker="o", label=a)
    ax.set_xlabel("League run")
    ax.set_ylabel("Elo")
    ax.legend(loc="best", fontsize=8)
    fig.autofmt_xdate()
    fig.tight_layout()
    fig.savefig(out_png)
    plt.close(fig)
    print("Wrote", out_png)

def main():
    os.makedirs(LEAGUE_DIR, exist_ok=True)
    res = build_timeline(LEAGUE_DIR)
    if res is None:
        return
    timeline, agents = res
    out_csv = os.path.join(LEAGUE_DIR, "elo_timeline.csv")
    out_png = os.path.join(LEAGUE_DIR, "elo_timeline.png")
    save_csv(timeline, agents, out_csv)
    save_plot(timeline, agents, out_png)

if __name__ == "__main__":
    main()
