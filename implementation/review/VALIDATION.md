# Rules v2: accepted decisions and validation

**Pikeman beats Archer in melee; Archer can kill Pikeman at range.** This implements the designer’s correction to the earlier review and applies the accepted consistency fixes.

The rules and engine now agree on the documented cases. The checks below found no implementation-integrity failures. They do **not** prove expert-play balance.

## Applied decisions

- Full 36-entry ordered melee matrix. Pikeman > Archer; Heavy Infantry > Pikeman; Cavalry > lone Heavy Infantry; Pikeman > Cavalry. Priestess ordinary melee is forbidden except the explicit Priestess duel and Commander capture.
- Surviving attackers stay in their original square/slot while any defender remains. Bottom defenders are promoted; only friendly units may stack.
- Cavalry may attack after one forward step, cannot jump through occupied intermediates, and cannot continue after combat. A Heavy Infantry on top of a stack resists Cavalry, making the lone-defender qualification explicit.
- Both stack slots can use stationary abilities without changing order. Archers fire along three forward rays at range one or two, with blockers and top-only damage. Two Archers enable power shots against Cavalry/Heavy Infantry.
- Commander conversion and ranged King kills are forbidden. Commander capture wins, including Commander-versus-Commander. The explicit full matrix governs Commander and Priestess melee.
- Conditional Commander and Priestess retreats are implemented using Chebyshev proximity. Enemy-half sideways movement is based on current location; the universal last-rank escape overrides Commander forward-only movement.
- Adjacent opposing Priestesses die simultaneously after an action, including when stacked; companions survive.
- Third occurrence of board + stack order + ownership + side to move is a draw. A simulation budget is unresolved truncation, never material adjudication.
- Minimal-loss priority uses immediate own deaths, with R > N > B > P > Q preservation order. AI values are independent. The rule remains enabled; it did not restrict a turn in this sample.

## Implementation and learning-interface corrections

The action tuple is now `(from_row, from_col, slot, to_row, to_col, kind)` throughout the engine, discrete codec, examples and viewer. All 32,768 IDs are checked. Illegal engine actions fail atomically; training actions forfeit instead of silently executing a fallback.

The 27-plane observation distinguishes both slots and includes side/direction and occurrence information. Full repetition history is available separately in infos. Old 12-plane checkpoints and old action IDs are incompatible and require retraining.

Rewards are terminal-only and zero-sum, so neither suicide nor conversion loops earn bonuses. The Gym wrapper keeps one learning side per episode and includes the opponent reply in each step. Terminal actor attribution and per-step AEC reward handling are corrected. Unsafe simultaneous conversion is explicitly unavailable.

League results use engine adjudication. Draws, truncations and protocol forfeits are distinct. Legacy reward-adjudicated records and unresolved games are excluded from scores/Elo. Flat and tensor v2 checkpoints are supported; incompatible old models are reported and skipped.

## Checks performed

- **72 regression tests passed**, including a sweep of permitted local stack combats, action-codec coverage, rule-table parity, movement, abilities, repetition, atomic invalid actions, observations and reward attribution.
- PettingZoo API test and Gymnasium environment checker passed.
- CPU MaskablePPO completed a short train/save/load/predict test against the corrected interface. This is an integration test, not a trained balance agent.
- A four-game league smoke test completed; GUI board/overlay drawing and the Greedy example also ran.
- **10,000 games and 970,710 plies**, each checking action-codec round trips, friendly stack invariants and exact unit conservation. **Zero failures**.

## Simulation outcomes

Each pair reuses two policy seeds with their colors exchanged. All games start from the standard opening. Random samples distinct legal actions uniformly; Greedy uses immediate material swing with seeded random tie breaks. Lookahead considers eight root candidates and the immediate material swing of every opponent reply (two plies). None is an expert or trained policy.

| Pairing | Games | North wins | South wins | Repetition draws | Unresolved at 512 plies | Mean plies |
|---|---:|---:|---:|---:|---:|---:|
| Random vs Random | 3,000 | 1,343 | 1,366 | 7 | 284 | 145.5 |
| Greedy vs Greedy | 3,000 | 1,430 | 1,485 | 68 | 17 | 60.2 |
| Greedy vs Random | 3,000 | 1,510 | 1,490 | 0 | 0 | 44.9 |
| Lookahead vs Greedy | 500 | 251 | 247 | 2 | 0 | 63.5 |
| Lookahead vs Lookahead | 500 | 75 | 77 | 9 | 339 | 374.2 |

Across all pairings: **9,274 Commander-capture wins, 86 repetition draws, and 640 unresolved games**. No game ended by stagnation. No turn activated the minimal-loss restriction.

Color aggregates for mixed-policy pairings do not show policy strength by themselves. Greedy won **2,934/3,000 (97.8%)** against Random. Lookahead won **457/500 (91.4%)** against Greedy, with 41 losses and two draws. These agents are meaningfully different baselines, but they share a material-based objective.

## What this says about balance

In Greedy mirror games, North scored **49.08% of points among completed games** (draws count half). A bootstrap resampling complete color-swapped seed pairs gives approximately **47.2%–50.7%** for North’s score. This does not identify a clear first-player advantage under that policy. It is not evidence that all strategies or pieces are balanced.

The strongest limitation is **339/500 (67.8%)** unfinished Lookahead mirror games. Only 25 of the 250 seed pairs had both games finish. Their completed-game score cannot reliably represent the whole population. The observed possible North score across all 500 games spans **15.9%–83.7%** when unfinished results are left unknown. The likely investigation is progress/endgame planning versus incentives to avoid engagement; the experiment cannot separate agent limitations from rules-induced defensive play.

Random mirror games also had **284/3,000 (9.47%)** unresolved outcomes. Repetition catches exact cycles, not every long maneuvering game. No additional no-progress draw rule was silently introduced. A stronger progress-aware agent and human playtests should precede another rule change.

Piece event counts are preserved in the summary, but kills do not isolate piece strength: exposure, role and agent preferences confound them. No piece price/strength ranking is claimed.

## Reproduction

From this branch, using a local virtual environment:

```bash
python3 -m venv .venv
.venv/bin/pip install torch --index-url https://download.pytorch.org/whl/cpu
.venv/bin/pip install -r requirements.txt pytest
.venv/bin/python -m pytest -q
.venv/bin/python -m implementation.review.balance --pairs 1500 --search-pairs 250 --workers 4
```

The base repository commit before these changes was `bbeb87fb7e621cf5f2c2c7c3510f66c33937b29f`. The engine/rules/review-script content used for these results is identified by SHA-256 `7edd85de8192db1c00efffb216716b0daa9a94bc6af070e2583a7404cc0ef560`. The separate rules hash is `5bea037c395085c6da7b9c13abc0efbdef83e402d80ed63514be72e2ff1a62a2`. `source_hash()` in `balance.py` recomputes the content hash. The results were produced against the changed working tree, not the unmodified base commit.

- `results_v2/games.csv`: all 10,000 seeds, pair identifiers, colors and outcomes.
- `results_v2/summary.json`: aggregate metrics, environment versions, bootstrap details and limitations.
- `results_v2/sample_replays.json`: action traces for the first color-swapped pair in every comparison.
- `environment.txt`: exact local package inventory. This run used Python 3.12.14.

The CI workflow runs the regression suite, including the short CPU training test, on Python 3.11 and 3.12. Its remote result is reported separately from the local results above.
