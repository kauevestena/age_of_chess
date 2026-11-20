# Rules v6: Warp and movement toward the enemy King's row

The rules in the [v6 specification](../../rulesets/RULES_V6_SPEC.md) are implemented in
both engines and the static browser game. The [rulesheet](../../rulesets/RULES.md)
defines the behavior; the [canonical YAML](../../rulesets/default.yaml) is exported to
the browser.

## What changed

- **Warp replaces conversion.** The Priestess lifts one adjacent, solitary enemy
  Pikeman, Cavalry, Archer or Heavy Infantry and sets it on any empty square. Nothing
  dies and no unit changes side. Kings, Priestesses and formation members are immune.
  Warp is a normal order, loses no unit, and resets the warper's King counters.
- **Movement follows the enemy King's row.** Non-King units step onto the adjacent row
  toward the row the enemy King occupies, straight or diagonally, and sideways toward
  him once level. Cavalry's second step is chosen afresh. While the King sits on his
  back rank this equals v5 forward movement: the opening position still offers exactly
  52 orders per side.
- **Removed:** veteran status and the ↶ mark, the back-rank exception, sideways steps in
  the enemy half, and the frontal sidestep. Kings, the Priestess's contact step,
  formations, the royal escort and the combat table are unchanged.

Warp is action kind 3: `from` is the warped enemy unit's square, `slot` is 0 and `to`
is the empty destination. The six-field tuple and the 73,728 action IDs are unchanged.
Observations are `(37, 8, 8)`. Browser saves carry rules version 6.

## Interface and AI

- **Browser:** select the Priestess, select a marked enemy, then an empty square. Marked
  squares are lilac, the chosen enemy glows, and Escape cancels. The Warp plays as a ring
  of light on the board, not a cinematic. Three lessons were replaced (Warp, level with
  the King, follow the King); the tutorial still has 18 exercises.
- **Agents:** one warpable target adds an order for every empty square, so agents treat
  all Warps of one target as one option. Random picks the destination uniformly; Greedy
  and Lookahead exile the unit to the square with the largest row gap from their own
  King's row, then the largest distance from the King. The browser AI searches only the
  best three destinations per target. These are fixed heuristics, not expert Warp play.

## Validation

| Check | Result |
|---|---|
| Python regression suite | 1,213 passed; one optional MaskablePPO test skipped locally because `sb3_contrib` is unavailable |
| JavaScript unit suite | 57 passed |
| Python/browser differential test | 17,614 positions and 599,501 legal actions, including 565 Warp transitions; zero discrepancies |
| Browser integration | 123 assertions passed; no browser errors, failed requests or external requests |
| Static build, generated rules and whitespace checks | Passed |
| Paired simulation | 2,000 games, 129,666 normal orders; zero invariant or action-codec failures |

Movement is checked against an independent reference in both engines: the spec's 17
worked examples, the opening position, every unit square against every enemy King square
(15,624 positions per engine, both owners, Pikeman and Cavalry), and randomized positions
with blockers and formations (720 compared in Python, 406 in JavaScript). Warp tests cover targets, destinations, either subcell, King escorts,
counter resets, the minimal-loss rule, peril, repetition cycles, the action mask and
the loader. Old veteran, conversion and frontal-sidestep tests were replaced by tests of
the new behavior.

The differential test now includes a sweep of every target class, solitary or stacked,
for each Priestess arrangement, owner and enemy King row.

## Simulation results

Standard setup, fixed seeds, colors swapped within each pair, maximum 256 normal orders
per game, the same settings as the v5 review.

| Policies | Games | North wins | South wins | Draws | Capped | Mean orders |
|---|---:|---:|---:|---:|---:|---:|
| Random / Random | 640 | 312 | 327 | 1 | 0 | 94.4 |
| Greedy / Greedy | 640 | 305 | 335 | 0 | 0 | 59.7 |
| Greedy / Random, colors swapped | 640 | 314 | 326 | 0 | 0 | 38.5 |
| Lookahead / Greedy, colors swapped | 40 | 21 | 19 | 0 | 0 | 64.3 |
| Lookahead / Lookahead | 40 | 17 | 23 | 0 | 0 | 94.1 |

Against the review thresholds in the specification:

| Measure | v5 | v6 | Threshold |
|---|---:|---:|---|
| Games capped at 256 orders | 32 of 2,000 | 0 | above 5% |
| Greedy / Greedy repetition draws | 18 of 640 | 0 | above 6% |
| Greedy / Greedy mean orders | 62.6 | 59.7 | above 90 |
| Turns restricted by the minimal-loss rule | 0 | 0 | frequent |
| Stagnation endings | 0 | 0 | more than isolated cases |
| North's share of decisive games | 48.4% | 48.5% (969 of 1,999) | outside 45–55% |

One trigger is met: **Heavy Infantry is still lost far less often than other classes**
(deaths per starting piece: Heavy Infantry 15%, Pikeman 33%, Archer 34%, Priestess 36%,
Cavalry 64%; v5 was 14%, 33%, 34%, 33%, 62%). The specification names the deferred
single-Archer-versus-Heavy-Infantry proposal as the response. It was not implemented.

Warp is rare in these games: 263 Warps in 2,000 games (Pikeman 166, Heavy Infantry 42,
Cavalry 36, Archer 19), because the agents see no material swing in it. The mean Warp
adds 1.4 rows of distance from the warping side's King row, which includes Random's
uniformly drawn destinations. These games therefore say little about how strong Warp is
under human play. The v6 numbers also do not isolate the effect of any single rule, since
all changed together. The agents still do not search compound turns, and weak-policy win
rates are not proof of expert balance.

Raw data: [summary](../../implementation/review/results_v6/summary.json),
[all games](../../implementation/review/results_v6/games.csv),
[sample replays](../../implementation/review/results_v6/sample_replays.json).
Older reports remain historical records of their own rules.

## Reproduce

Run from the repository root:

```bash
python -m pytest -q
python web/scripts/export_rules.py --check
node --test web/tests/*.test.mjs
AOC_PYTHON=python node web/tests/parity.mjs
node web/tests/browser.mjs
node web/scripts/build.mjs
python -m implementation.review.balance --pairs 320 --search-pairs 20 --workers 4 --max-plies 256
```

Browser tests require Playwright and Chromium; `AOC_CHROMIUM_PATH` can select an
installed executable. The simulation summary records the exact source hash
(`665abebb60c888b7dc12dbeb19e299def23d803ab741468fcfd510fca116ea5a`), the rules hash,
library versions, seeds and pairing. Base commit: `7faa65f6dffc942f1cc6448eca600a9376490a0e`
plus this change.
