# Age of Chess – Warfare

A simulator-first tactical chess variant with stacking, ranged attacks, conversion,
class counters and capture-the-Commander victory. See [the complete rules](rulesets/RULES.md).

**Rules v2:** Pikeman beats Archer in melee; Archer can kill Pikeman at range.
Partial stack attacks leave a surviving attacker at its origin. Commander conversion
is forbidden. The third occurrence of a position is a draw. The rules schema and
combat table are validated; unsupported settings fail instead of being ignored.

## Browser game

The [medieval browser client](web/README.md) provides solo play against three AI
levels, local two-player battles, a guided tutorial, original illustrated units,
animated combat, an original soundtrack, save/load and battle review. Gameplay
runs entirely in the browser and is packaged for GitHub Pages.

```bash
node web/scripts/serve.mjs
```

Open `http://127.0.0.1:4173/age_of_chess/`. See the web README for Pages setup and
browser validation. The Python research environment remains available below.

## Install and play

Always use a local virtual environment:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python implementation/examples/random_selfplay.py
python implementation/examples/greedy_selfplay.py
python implementation/examples/gui_viewer.py
```

GUI: click a source and destination; **TAB** selects the other stack slot,
**L** toggles legal overlays, **G** plays Greedy, **SPACE** plays a random legal move.
**A** selects automatic action choice, **M** move/melee, **R** ranged, **C** conversion.

## Direct engine and PettingZoo

```python
from implementation.age_of_chess.env import Engine

engine = Engine("rulesets/default.yaml")
action = engine.legal_actions()[0]
event = engine.apply(action)
```

```python
from implementation.age_of_chess.pettingzoo_env import age_of_chess_v1

env = age_of_chess_v1("rulesets/default.yaml", max_plies=512)
env.reset(seed=7)
for agent in env.agent_iter():
    obs, reward, terminated, truncated, info = env.last()
    action = None if terminated or truncated else env.action_space(agent).sample(info["action_mask"])
    env.step(action)
```

The canonical tuple is `(from_row, from_col, slot, to_row, to_col, kind)` everywhere.
`kind` is move/stack=0, melee=1, ranged=2, conversion=3. Use `encode_action(*action)`
for the discrete interface. Illegal direct-engine actions raise before mutation;
illegal training-interface actions forfeit, without silently executing another move.

The observation has shape `(27, 8, 8)` and dtype `float32`: own top/bottom class
planes (12), opponent top/bottom planes (12), own North-direction flag, side-to-move
flag, and normalized current-position occurrence count. Coordinates are **absolute**,
matching action IDs. Full repetition history is available in `info['position_counts']`;
the observation alone does not encode every past position. Inactive/finished agent
masks contain only zeros. Rewards are per-step, terminal-only, and zero-sum.

Use `engine.state.winner`, `reason`, `terminated` and `truncated` to adjudicate.
A ply cap is unresolved truncation, not a draw or a reward-based winner. Terminal
rewards do not pay capture/conversion bonuses that can be farmed in a loop.

The old `age_of_chess_v0` name remains an import alias only. Old YAML files and
checkpoints need migration/retraining: the action layout and observation changed.
Do not compare old reward-adjudicated league records with v2 results.

## Training and evaluation

`AOCSingleAgentSelfPlayEnv` keeps one learning side per episode, against a random
or Greedy opponent, or a supplied frozen-opponent callable. A step includes the
opponent's reply. Training one policy on alternating actors within a single-agent
step is no longer used. Default learning colors are seeded-random per episode.

```bash
python implementation/examples/sb3_train_maskable_ppo.py
python implementation/examples/sb3_train_a2c.py
python implementation/examples/sb3_train_maskable_ppo_league.py
python -m implementation.league.round_robin --games 6 --seed 7
python -m implementation.league.elo_timeline
python -m implementation.league.report
```

MaskablePPO is preferred; the unmasked A2C baseline may repeatedly forfeit by
sampling illegal actions. The league loads both flat and tensor v2 checkpoints.
It records draws and truncations distinctly and excludes unresolved/legacy records
from ratings. Greedy uses seeded random tie breaks, not coordinate-order ties.

Age of Chess updates the board after **each** player's action. It cannot safely be
converted to a simultaneous ParallelEnv with `aec_to_parallel`; use the AEC or Gym
interface. The former parallel helper now raises an explanatory error.

## Validation and reproducible balance probes

```bash
pip install pytest
python -m pytest -q
python -m implementation.review.balance --pairs 1500 --search-pairs 250 --workers 4
```

The tests include the corrected melee counters, stack conservation, movement and
ability edge cases, all 32,768 action IDs, draw detection, atomic illegal actions,
PettingZoo/Gym API checks, league adjudication, and a short MaskablePPO train/save/load
cycle when SB3 is installed. The rulesheet combat table is checked against YAML.

Balance results, methodology and limitations live in `implementation/review/`.
Weak-agent win rates are measurements for those policies, not proof of expert-play
balance. The minimal-loss restriction uses immediate own deaths and its explicit
preservation order; AI evaluation values are independently configurable.

## Logs and agent development

```bash
python implementation/examples/selfplay_logger.py
python implementation/examples/replay_viewer.py logs/game_YYYYMMDD_HHMMSS.jsonl
python implementation/scripts/new_agent.py MyAgent
```

Put agent code, configs and checkpoints under `implementation/agents/<name>/`.
See [agents.md](agents.md) for development conventions.
