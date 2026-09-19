# Rules v5: the King, royal escorts and returning veterans

The confirmed rules are implemented in both engines and the static browser game.
The [complete rulesheet](../../rulesets/RULES.md) defines the behavior; the
[canonical YAML](../../rulesets/default.yaml) is exported to the browser.

## Confirmed combat and movement

The Commander is now an unarmed King. It cannot attack and is immune to arrows
and conversion. A King with no remaining allied units loses as before.

Every King formation arrangement grants support to its companion. Against front
and flank attacks, the escort fights first, with these same-class outcomes:

| Attacker's sector in the defender's frame | Attacker | Escort | King |
|---|---|---|---|
| Front 1, 2, 3 | Dies | Survives | Survives |
| Flank 4, 6 | Dies | Dies | Survives |
| Rear 7, 8, 9 | Original physical contact and reserve rules | No new buff | Physical exposure applies |

The flank row implements the selected interpretation: Pikeman versus flanked
Pikeman–King kills both Pikemen and spares the King. A class counter still wins
before stance is considered. Cavalry loses when it encounters a Pikeman; Heavy
Infantry defeats a Pikeman escort and then captures the King if reached. A King
exposed directly to a rear attack can still fall before a companion intervenes.
Choosing King at S is optional; all four arrangements remain available.

Every non-King reaching the enemy back rank by a quiet move or capture permanently
retains backward movement, including diagonals. This individual veteran ability
survives formation changes and conversion. Cavalry keeps its two-step reach and
single-ally passage, using two forward or two backward steps for a quiet move.
Kings never gain that ability: retreat always requires an enemy within Chebyshev
distance two, including adjacent and diagonal enemies, regardless of blockers.

All Archer shots reach exactly one square, including double-Archer power shots.
Existing target eligibility, physical screening and reciprocal Archer fire remain.

The third consecutive backward King move or fourth consecutive King move in any
direction forfeits. Opponent turns preserve both streaks. Another unit's normal
order resets both; a forward/sideways King move resets only the backward streak.
Preparations affect neither counter and still require a subsequent normal order.

## Game and compatibility

- The board marks veterans with ↶, and inspection describes their retained movement.
  The King panel explains peril and escort status; both movement counters remain
  visible during play and replay.
- Escort combat uses sequential animation waves. The King carries a sceptre and
  does not swing a weapon. Four new lessons bring the tutorial to 18 exercises.
- Save/load, partial preparation saves, review, undo, AI hints and AI-versus-AI
  spectator battles use the new state. Saves require rules version 5.
- Repetition includes each unit's veteran ability and both pairs of King counters.
  Same-class members with different veteran status remain distinct when swapping.
- Python observations are `(41, 8, 8)`; action encoding remains 73,728 IDs. Older
  observations require retraining, and league/log versions remain separate.
- The game still builds as a self-contained static site, with its existing original
  artwork, fonts and locally synthesized soundtrack. No backend was introduced.

## Validation

| Check | Result |
|---|---|
| Python regression suite | 1,151 passed; one optional MaskablePPO test skipped locally because `sb3_contrib` is unavailable |
| JavaScript unit suite | 39 passed |
| Python/browser differential test | 17,367 positions and 591,202 legal actions; zero discrepancies |
| Browser integration | 119 assertions passed; no browser errors, failed requests or external requests |
| Static build, generated rules and whitespace checks | Passed |
| Paired simulation | 2,000 games, 142,098 normal orders; zero invariant or action-codec failures |

The differential test compares legal actions, casualties, complete contact waves,
formation arrangements, veteran flags, preparation state, both King counters and
terminal outcomes. It includes all 2,048 combinations of ordinary attacking class,
ordinary royal escort, owner, approach, arrangement and King member slot.
Independent tests assert matching front/flank outcomes and preserve rear behavior.
Other regressions cover range one, permanent movement through formations and
conversion, Cavalry passage, King forfeit/reset rules, save/replay/undo and AI
avoidance of an unnecessary fourth King move.

Browser checks cover desktop and mobile, all 18 tutorials, keyboard/touch input,
actual combat cinematics, three audible soundtrack tracks, local/solo/spectator
battles, partial saves, restored retreat counters, undo, board flipping and worker
fallback. Screenshots and integration output are generated in `web/test-results/`
and uploaded by the Pages validation workflow as `browser-review`.

## Simulation results

Standard setup, fixed seeds, colors swapped within each pair, maximum 256 normal
orders per game. Preparations do not consume that cap. A capped game is unresolved,
never counted as a draw or decided by material.

| Policies | Games | North wins | South wins | Draws | Capped | Mean orders |
|---|---:|---:|---:|---:|---:|---:|
| Random / Random | 640 | 288 | 323 | 0 | 29 | 111.1 |
| Greedy / Greedy | 640 | 304 | 318 | 18 | 0 | 62.6 |
| Greedy / Random, colors swapped | 640 | 317 | 323 | 0 | 0 | 36.9 |
| Lookahead / Greedy, colors swapped | 40 | 19 | 21 | 0 | 0 | 65.7 |
| Lookahead / Lookahead | 40 | 16 | 21 | 0 | 3 | 117.1 |

Greedy self-play gives North a 48.9% score, counting draws as half a point. The
95% bootstrap interval over paired seeds is 44.9–52.8%. Random self-play gives
47.6% on complete pairs, with an interval of 43.8–51.4%. Neither probe establishes
a strong first-player advantage. The small Lookahead sample is much less precise.
Across all cohorts, 32 games (1.6%) reached the cap.

There were 1,459 move/capture arrivals unlocking permanent backward movement and
148 royal-escort combats. Random self-play incurred 80 fourth-King-move forfeits;
Greedy self-play incurred none. Greedy now explicitly avoids that forfeit whenever
it has a better order. Random still samples legal forfeiting orders, as intended.

These are implementation and weak-policy balance probes, **not proof of expert
balance or of the causal effect of any single new rule**. All rules changed
together. Policies do not fully search compound preparation turns; the King guard
appeared relatively rarely, so exhaustive local combat tests provide the stronger
evidence for its correctness. No unit-counter changes were made from win rates.

Raw data: [summary](../../implementation/review/results_v5/summary.json),
[all games](../../implementation/review/results_v5/games.csv),
[sample replays](../../implementation/review/results_v5/sample_replays.json).
Older reports remain historical records of their own rules.

## Reproduce

Run from the repository root using the local virtual environment:

```bash
.venv/bin/python -m pytest -q
.venv/bin/python web/scripts/export_rules.py --check
node --test web/tests/*.test.mjs
node web/tests/parity.mjs
node web/tests/browser.mjs
node web/scripts/build.mjs
.venv/bin/python -m implementation.review.balance --pairs 320 --search-pairs 20 --workers 4 --max-plies 256
```

Browser tests require Playwright and Chromium; `AOC_CHROMIUM_PATH` can select an
installed executable. CI also installs the optional training dependencies.

Simulation base: `9e7f73cfeb0beeb6b06da42121a0d5871ac11ab8` plus this PR's changes.
The summary records the exact source hash, rules hash, library versions, seeds and
pairing. Simulation source SHA-256:
`d7ca3cd457d23b6f2055a2da908786dba08ae6da72ae33481dc1a60c96536da4`.
