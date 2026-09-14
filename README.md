# Age of Chess – Warfare

A simulator-first tactical chess variant with stacking, ranged attacks, conversion,
class counters and capture-the-King victory. See [the complete rules](rulesets/RULES.md).

**Rules v5:** the Commander becomes a defenseless King. Its formation escort fights
first against front/flank attacks, with stronger matching-class defense; unit
counters and rear contact remain unchanged. Archers have one-square range, including
double-Archers. Non-Kings permanently gain backward movement after reaching the
far rank. Kings retreat only in peril, forfeit on a third consecutive backward move
or fourth consecutive move in any direction, and still lose when unsupported.
All four A/B arrangements and three optional preparations remain. See the
[v5 implementation and simulation review](web/review/KINGS_V5.md).

## Browser game

The [medieval browser client](web/README.md) provides solo play against three AI
levels, local two-player battles, AI-versus-AI spectator battles, a guided tutorial,
original illustrated units, animated combat, an original soundtrack, save/load and
battle review. Gameplay runs entirely in the browser and is packaged for GitHub Pages.

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
**A** selects automatic action choice, **M** move/melee, **R** ranged, **C** conversion. **1–4** rearranges the selected formation into A N/B S,
A S/B N, A W/B E or A E/B W; **T** selects the other exposed ranged target.

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
`kind` is move/join=0, melee=1, shoot A=2, conversion=3, arrangements=4–7
(in the order above), or shoot B=8. Preparation actions use the same source and
target cell and `slot=0`; the selected acting member still determines the shooter.
There are 73,728 encoded action IDs. Use `encode_action(*action)`
for the discrete interface. Illegal direct-engine actions raise before mutation;
illegal training-interface actions forfeit, without silently executing another move.

The observation has shape `(41, 8, 8)` and dtype `float32`. Planes 0–23 encode
own/opponent A/B classes; 24–28 hold direction, side to move, repetition and both
King retreat counters. Planes 29–32 identify the four physical arrangements,
33 marks formations already prepared this turn, and 34 holds the remaining budget
normalized by three. Planes 35–38 encode own A/B and enemy A/B veteran flags;
39–40 encode own/enemy King movement streaks divided by four. Coordinates are **absolute**, matching action IDs.
Full repetition history is available in `info['position_counts']`; the observation
alone does not encode every past position. Inactive/finished masks contain zeros.
Rewards are per-step, terminal-only and zero-sum. A preparation returns zero reward
and keeps the same actor; only a normal order advances the turn or ply cap.

Use `engine.state.winner`, `reason`, `terminated` and `truncated` to adjudicate.
A ply cap is unresolved truncation, not a draw or a reward-based winner. Terminal
rewards do not pay capture/conversion bonuses that can be farmed in a loop.

The old `age_of_chess_v0` name remains an import alias only. Old YAML files and
checkpoints need migration/retraining: the action layout and observation changed.
Do not compare old reward-adjudicated league records with v5 results.

## Training and evaluation

`AOCSingleAgentSelfPlayEnv` keeps one learning side per episode, against a random
or Greedy opponent, or a supplied frozen-opponent callable. A normal-order step includes all of the opponent's preparations and its reply.
A learner preparation retains control without calling the opponent. Training one policy on alternating actors within a single-agent
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
sampling illegal actions. The league loads both flat and tensor v5 checkpoints.
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
ability edge cases, all 73,728 action IDs, draw detection, atomic illegal actions,
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
