# Agents

This project includes simple baselines, a self‑play Gym wrapper, SB3 training scripts, evaluation tools (league + Elo), and utilities for logging/replay.

## Built‑in baselines
- **Random** — picks a random *legal* action using the action mask.
  - Source: `implementation/age_of_chess/agents.py` (class `RandomAgent`; examples also use random sampling with the mask)
- **Greedy Heuristic** — ranks legal actions by short‑term material swing (using piece values in the engine).
  - Source: `implementation/age_of_chess/agents.py` (`GreedyAgent`)
  - Demo: `implementation/examples/greedy_selfplay.py`

> Both baselines rely on the env’s **action mask** to avoid illegal actions. Illegal training actions forfeit the game. The engine rejects illegal actions atomically.

## PettingZoo AEC env
- Entry point: `implementation/age_of_chess/pettingzoo_env.py` → `age_of_chess_v1(...)`
- Observation: `(29, 8, 8)` planes (channel‑first)
- Discrete action space encodes `(from_row, from_col, slot, to_row, to_col, move_type)`
- `infos[agent]["action_mask"]` is provided on every turn.

## Self‑play wrapper for SB3
- `implementation/age_of_chess/sb3_env.py` → `AOCSingleAgentSelfPlayEnv`
  - Keeps a **single learning side per episode** against an explicit opponent; each step includes its reply.
  - Compatible with **ActionMasker** (`sb3_contrib` MaskablePPO). Use `env.get_action_mask()`.

### Training scripts
- **Masked PPO** (sb3‑contrib): `implementation/examples/sb3_train_maskable_ppo.py`
- **A2C baseline** (SB3): `implementation/examples/sb3_train_a2c.py`
- **Masked PPO + checkpoints + mini‑league**: `implementation/examples/sb3_train_maskable_ppo_league.py`
  - Saves snapshots to `models/checkpoints/`, copies to `models/`, and runs a small round‑robin vs Greedy/Random and the previous checkpoint.

> Install: `pip install stable-baselines3 sb3-contrib`

### Running the scripts
```bash
# Masked PPO
python implementation/examples/sb3_train_maskable_ppo.py

# A2C
python implementation/examples/sb3_train_a2c.py

# Masked PPO with periodic league checkpoints
python implementation/examples/sb3_train_maskable_ppo_league.py
```

## Evaluation: leagues, Elo, and heatmaps
- **Round‑robin league**: `implementation/league/round_robin.py`
  - Auto‑discovers agents: Greedy, Random, and any SB3 models under `models/*.zip`.
  - Saves results to `logs/league/league_*.jsonl`, standings (`*.csv`/`*.md`), and a head‑to‑head **heatmap** (`heatmap_*.png`).
- **Elo timeline**: `implementation/league/elo_timeline.py`
  - Aggregates Elo across multiple league runs → `elo_timeline.csv` + `elo_timeline.png`.
- **HTML report**: `implementation/league/report.py`
  - Produces a single **self‑contained** `report_latest.html` with standings, heatmap, and timeline embedded.

### Quick eval
```bash
# Play a league among Greedy, Random, and all models in ./models
python -m implementation.league.round_robin --games 6

# Build Elo timeline
python -m implementation.league.elo_timeline

# Generate HTML report
python -m implementation.league.report
```

## Logging & Replay
- **Self‑play logger**: `implementation/examples/selfplay_logger.py` (Greedy vs Greedy)
  - Writes per‑move JSONL and PGN‑like text to `logs/`.
- **Replay viewer** (pygame): `implementation/examples/replay_viewer.py`
  - Step through a `.jsonl` log with ←/→.

## GUI (pygame)
- `implementation/examples/gui_viewer.py`
  - Click‑to‑move, slot toggle (**TAB**), legal‑move overlays (**L**), greedy step (**G**), random step (**SPACE**).
  - Overlays are tinted by **acting piece type**.

## Rewards and versioning

Rewards are terminal-only and zero-sum: win +1, loss −1, draw 0. Conversions and
captures do not pay bonuses. A ply cap is truncation, not a draw or a reward win.
Old 12/27-plane checkpoints and old action IDs are incompatible and must be retrained.
Use `engine.state.winner` and `reason`, never reward totals, for adjudication.
The 29-plane observation encodes both slots and own/opponent retreat counters; full repetition history is in infos.

Core `RandomAgent`/`GreedyAgent` receive an Engine and return action tuples. The
league's policy interface receives the AEC environment and returns an encoded ID.
The explicit opponent callable for Gym receives an Engine and returns a tuple.

## Adding New Agents

If you want to implement your own agent (deep‑learning, search, or heuristic):

### 1) Minimal interface
```python
class MyAgent:
    def __init__(self):
        self.name = "MyAgent"

    def select(self, env):
        """
        Decide action for the current PettingZoo player.
        Return an integer action ID, or None if no legal move.
        """
        mask = env.infos[env.agent_selection].get("action_mask")
        legal = [i for i, m in enumerate(mask) if m == 1] if mask is not None else []
        if not legal:
            return None
        # Your policy here
        return legal[0]
```

### 2) Environment & layout rules (important)
- **Always use a local virtual environment** for any dev or training:
  ```bash
  python3 -m venv .venv
  source .venv/bin/activate
  pip install -r requirements.txt
  ```
  Do **not** rely on a global `python3` install.
- **Do not create loose files in the repo root.** Put everything under a proper subfolder:
  - Recommended: `implementation/agents/<your_agent>/`
  - Keep code, configs, logs, and checkpoints inside that folder.

**Example structure**
```
implementation/
  agents/
    my_agent/
      __init__.py
      agent.py
      train.py
      README.md
      checkpoints/
        model.pt
```

### 3) League integration
To participate in the round‑robin league, either:
- Export SB3 models to `models/*.zip` (auto‑discovered), or
- Add a thin wrapper in `implementation/age_of_chess/agents.py` that exposes a `.select(env) -> action_id` method.

Then run:
```bash
python -m implementation.league.round_robin --games 4
```

### 4) Tips
- Use the **action mask** (`infos[agent]["action_mask"]`) to avoid illegal moves.
- Consider reading `rulesets/default.yaml` to understand combat, movement and evaluation values.
- Log your games with `implementation/examples/selfplay_logger.py` and replay them with `implementation/examples/replay_viewer.py`.


## Cookiecutter-style scaffold

Generate a new agent module (kept inside a proper subfolder, not the repo root):
```bash
python implementation/scripts/new_agent.py MyAgent
```

This creates:
```
implementation/agents/myagent/
  __init__.py
  agent.py
  train.py
  README.md
  checkpoints/.gitkeep
```

> Always activate a **.venv** and keep artifacts inside your agent’s folder.
