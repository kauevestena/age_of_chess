# age_of_chess

A PettingZoo-compatible research environment for **Age of Chess – Warfare**, a tactical chess-variant with stacking, ranged attacks, conversion, and asymmetric matchups.

- 🔧 **Simulator-first**: rules in YAML, auto-loaded by the engine
- 🤝 **PettingZoo AEC API** for multi-agent self-play
- 🧪 **Examples**: random self-play & RLlib training scaffold
- 📊 **Balance probes**: hooks for winrates, game length, K/D per class

> **Status:** initial research scaffold. Core rules are implemented minimally to enable fast iteration. Expect to refine movegen/combat as playtests evolve.

## Install

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

## Quick start

```bash
python implementation/examples/random_selfplay.py
```

You should see a few games of random self-play with summaries.

## Folder layout

```
age_of_chess/
├─ README.md
├─ agents.md
├─ rulesets/
│  ├─ RULES.md
│  └─ default.yaml
└─ implementation/
   ├─ age_of_chess/
   │  ├─ __init__.py
   │  ├─ pettingzoo_env.py
   │  ├─ env.py
   │  ├─ game_state.py
   │  ├─ rules_loader.py
   │  ├─ movegen.py
   │  ├─ combat.py
   │  └─ utils.py
   ├─ examples/
   │  ├─ random_selfplay.py
   │  └─ rllib_train.py
   └─ tests/
      ├─ test_rules_load.py
      └─ test_env_smoke.py
```

## PettingZoo usage

```python
from implementation.age_of_chess.pettingzoo_env import age_of_chess_v0

env = age_of_chess_v0(ruleset_path="rulesets/default.yaml")
env.reset()
for agent in env.agent_iter():
    obs, reward, termination, truncation, info = env.last()
    action = env.action_space(agent).sample()
    env.step(action)
```

## Roadmap

- Expand movegen to cover all edge cases (power-shot LoS, priestess adjacency checks).
- Full combat matrix coverage vs stacks (now seeded with defaults).
- RLlib config example and AlphaZero-style trainer.
- GUI (boardgame.io) for human playtests.

### More examples

```bash
python implementation/examples/greedy_selfplay.py
```


## Configurable rewards
Adjust `rewards` in `rulesets/default.yaml`:
```yaml
rewards:
  win: 1.0
  loss: -1.0
  draw: 0.0
  illegal: -0.01
  step: 0.0
```

## Minimal-loss rule
Enabled via YAML at `game.turn.minimal_loss_rule.enabled`. When **all** legal moves lose material this turn, the engine filters to moves with the **smallest own-loss**, then prefers those that inflict more opponent loss.

## GUI viewer
Install pygame and run:
```bash
pip install pygame
python implementation/examples/gui_viewer.py
```
Controls: **SPACE** random-step, **G** Greedy-step.


## Event-based rewards (YAML)
You can shape rewards for events under `rewards.events` in the ruleset YAML, e.g. capture, conversion, ranged/power-shot kills.

## Logs export
Run a greedy-vs-greedy match and export JSONL and PGN-like logs:
```bash
python implementation/examples/selfplay_logger.py
```
Outputs go to `logs/`.


## Loss penalties (YAML)
Under `rewards.events.penalties`, you can penalize specific losses:
```yaml
rewards:
  events:
    penalties:
      unit_loss_default: -0.02
      king_loss: -0.5
      death_on_charge: -0.05  # cavalry dies when charging pikes
```

## Parallel API (for SB3 etc.)
Get a parallel-converted env:
```python
from implementation.age_of_chess.parallel_env import age_of_chess_parallel_v0
penv = age_of_chess_parallel_v0("rulesets/default.yaml")
```


## SB3 training (self-play)
MaskablePPO (with action masks):
```bash
pip install stable-baselines3 sb3-contrib
python implementation/examples/sb3_train_maskable_ppo.py
```

A2C baseline:
```bash
python implementation/examples/sb3_train_a2c.py
```

## GUI click-to-move
- Click a piece to select; click a target square to act.
- **TAB** toggles slot (top/bottom) when selecting a stacked square.
- **L** toggles legal overlays; **G** greedy move; **SPACE** random legal.

## Replay viewer
```bash
python implementation/examples/selfplay_logger.py         # first, generate a log
python implementation/examples/replay_viewer.py logs/game_YYYYMMDD_HHMMSS.jsonl
```


## Round-robin league
Run a tournament among all available agents (Greedy, Random, and any SB3 models in `models/`):
```bash
python implementation/league/round_robin.py --games 6
```
Outputs standings to `logs/league/standings_*.{csv,md}` and raw match results to `logs/league/league_*.jsonl`.
SB3 agents are included automatically if `stable-baselines3` and/or `sb3-contrib` are installed and `.zip` models are present.


## League Elo & Heatmap
After running a league:
- Elo with 95% CIs is included in `standings_*.md`.
- A head-to-head winrate **heatmap** is saved as `heatmap_*.png` in `logs/league/`.

## SB3 training with checkpoints + mini-league
Train MaskablePPO and auto-run a tiny league at checkpoints:
```bash
python implementation/examples/sb3_train_maskable_ppo_league.py
```
Checkpoints are saved to `models/checkpoints/` and copied to `models/` for discovery.


## Elo timeline chart
After you have multiple league runs in `logs/league/league_*.jsonl`, build the timeline:
```bash
python implementation/league/elo_timeline.py
```
This writes:
- `logs/league/elo_timeline.csv` (ratings per agent per run)
- `logs/league/elo_timeline.png` (single plot of Elo vs time per agent)


## HTML league report
Create a self-contained HTML summary with standings, heatmap, and timeline:
```bash
python implementation/league/report.py
```
The output is written to `logs/league/report_latest.html` (images inlined, so you can share the single file).


## New agent scaffold
Create a new agent package (uses only local files under `implementation/agents/<name>/`):
```bash
python implementation/scripts/new_agent.py MyAgent
```
Then train/evaluate per the docs in `agents.md`.
