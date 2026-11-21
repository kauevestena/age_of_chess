# Rules v6: Warp and movement toward the enemy King's row

The rules in the [v6 specification](../../rulesets/RULES_V6_SPEC.md) are implemented in
both engines and the static browser game. The [rulesheet](../../rulesets/RULES.md)
defines the behavior; the [canonical YAML](../../rulesets/default.yaml) is exported to
the browser.

## What changed

- **Warp replaces conversion.** The Priestess lifts one enemy Pikeman, Cavalry, Archer
  or Heavy Infantry **within two squares** (no line needed) and sets it on any empty
  square. A formation member can be warped, which breaks the formation, unless a King is
  in it. Nothing dies and no unit changes side. Kings, Priestesses and King formations
  are immune. Warp is a normal order, loses no unit, and resets the warper's King
  counters. Range and formation breaking are settings of the `warp` ability (see the
  specification's section 12); range one without breaking is the first v6 rule.
- **Movement follows the enemy King's row.** Non-King units step onto the adjacent row
  toward the row the enemy King occupies, straight or diagonally, and sideways toward
  him once level. Cavalry's second step is chosen afresh. While the King sits on his
  back rank this equals v5 forward movement: the opening position still offers exactly
  52 orders per side.
- **Removed:** veteran status and the ↶ mark, the back-rank exception, sideways steps in
  the enemy half, and the frontal sidestep. Kings, the Priestess's contact step,
  formations, the royal escort and the combat table are unchanged.

Warp is action kind 3: `from` is the warped enemy unit's square, `slot` names the warped
member (0 for a solitary unit) and `to` is the empty destination. The six-field tuple and the 73,728 action IDs are unchanged.
Observations were `(37, 8, 8)` in this release; the Open Field ruleset later added plane 37
(Archer cooldowns), making them `(38, 8, 8)`. Browser saves carry rules version 6.

## Interface and AI

- **Browser:** select the Priestess, select a marked enemy (and, for a formation, the member
  in a dialog), then an empty square. Marked squares are lilac, the chosen enemy glows, and
  Escape cancels. The Warp plays as a ring
  of light on the board, not a cinematic. Three lessons were replaced (Warp, level with
  the King, follow the King); the tutorial still has 18 exercises.
- **Agents:** one warpable unit adds an order for every empty square, so agents treat all
  Warps of one unit (square and member) as one option. Random picks the destination
  uniformly; Greedy and Lookahead exile the unit to the square with the largest row gap
  from their own King's row, then the largest distance from the King, and credit a Warp with
  a small positional value (0.1 × the unit's value per row gained ÷ 7, always below a
  Pikeman capture). The browser AI searches only the best three destinations per warpable
  unit. These are fixed heuristics, not expert Warp play.

## Validation

| Check | Result |
|---|---|
| Python regression suite | 1,227 passed; one optional MaskablePPO test skipped locally because `sb3_contrib` is unavailable |
| JavaScript unit suite | 62 passed |
| Python/browser differential test | 19,359 positions and 891,666 legal actions, including 2,532 Warp transitions and 911 positions with formation-member Warps; zero discrepancies |
| Browser integration | 134 assertions passed; no browser errors, failed requests or external requests |
| Static build, generated rules and whitespace checks | Passed |
| Paired simulation | 2,000 games, 141,821 normal orders; zero invariant or action-codec failures |

Movement is checked against an independent reference in both engines: the spec's 17
worked examples, the opening position, every unit square against every enemy King square
(15,624 positions per engine, both owners, Pikeman and Cavalry), and randomized positions
with blockers and formations (720 compared in Python, 406 in JavaScript). Warp tests cover
range one and two and formation breaking switched on and off (all four combinations), no
line of sight, King-formation immunity, Priestess companions, either member, the singleton
left behind, either Priestess subcell and King escorts, counter resets, the minimal-loss
rule, peril, repetition cycles, the action mask and the loader. Old veteran, conversion and
frontal-sidestep tests were replaced by tests of the new behavior.

The differential test sweeps every target class, solitary or stacked, for each Priestess
arrangement, owner, enemy King row and target square (one square away, two squares away,
and out of range). A dedicated browser test loads a real 31-order game, then warps one
member of a formation through the member dialog, checks Escape and dialog cancellation, and
verifies the saved action, the singleton left behind and that no unit died.

## Simulation results

Standard setup, fixed seeds, colors swapped within each pair, maximum 256 normal orders per
game, the same settings as the v5 review. Rules: Warp range two, formation breaking on.

| Policies | Games | North wins | South wins | Draws | Capped | Mean orders |
|---|---:|---:|---:|---:|---:|---:|
| Random / Random | 640 | 329 | 311 | 0 | 0 | 95.8 |
| Greedy / Greedy | 640 | 313 | 319 | 8 | 0 | 73.7 |
| Greedy / Random, colors swapped | 640 | 317 | 323 | 0 | 0 | 39.7 |
| Lookahead / Greedy, colors swapped | 40 | 20 | 20 | 0 | 0 | 79.5 |
| Lookahead / Lookahead | 40 | 17 | 22 | 0 | 1 | 119.1 |

### Warp range and formation breaking compared

The same 2,000-game probe under each combination (`--warp-range`, `--warp-breaks`), with the
agents' Warp valuation in all four. "Warp edge" is the score of a Greedy agent that warps
against an otherwise identical Greedy agent that never warps, 640 games with colors swapped
(`python -m implementation.review.warp_variants`).

| Range | Breaking | Warps per game | Greedy mean orders | Greedy repetition draws | Capped | North's share | Warp edge |
|---|---|---:|---:|---:|---:|---:|---:|
| 1 | off | 0.34 | 61.7 | 0 of 640 | 0 | 49.3% | 52.2% |
| 2 | off | 2.53 | 71.8 | 8 of 640 | 0 | 49.1% | 63.9% |
| 1 | on | 0.35 | 61.8 | 0 of 640 | 0 | 49.3% | 52.2% |
| **2** | **on** | **2.96** | **73.7** | **8 of 640** | **1** | **50.0%** | **65.2%** |

With 640 games the edge has a standard error of about 2 points, so range one's 52.2% is
indistinguishable from an even contest, while 63.9% and 65.2% are clearly not. What this
shows:

- **Range does almost all of the work.** Range two multiplies Warp use about eightfold and
  gives the side that warps a clear edge. Breaking formations adds a further 17% more Warps
  and no measurable edge on top of range two. At range one it changes nothing visible.
- **No runaway play.** Games are about a fifth longer than under range one, eight Greedy
  mirror games (1.3%) end in repetition, one game in 2,000 reached the cap, and nobody was
  stalemated. Side balance stays near even (50.0% for North of 1,991 decisive games).
- **Relative strength is unchanged.** Greedy still beats Random in 633 of 640 games (631 at
  range one) and Lookahead still beats Greedy in 38 of 40.
- **Heavy Infantry is still rarely lost** in every variant: 15% of starting pieces against
  30–64% for the others (v5: 14% against 33–62%). Warp did not change this, so the deferred
  single-Archer proposal remains the open lever.
- **Warp is mostly used on Pikemen** (4,210 of 5,928), the most numerous unit.

The first v6 run, with range one, no formation breaking and agents that gave Warp no value
(263 Warps in 2,000 games, Greedy mean 59.7 orders, no repetition draws, North 48.5%), is
kept in the commit history. These are weak-policy measurements: Warp's edge is for these
agents, the agents do not search compound turns or plan formations well, and human play may
use Warp very differently. Formation breaking in particular has barely been exercised, so
only human playtests can say whether it is worth its extra complexity.

Raw data: [summary](../../implementation/review/results_v6/summary.json),
[all games](../../implementation/review/results_v6/games.csv),
[sample replays](../../implementation/review/results_v6/sample_replays.json) for the shipped
rules; [variant summaries and the Warp-edge output](../../implementation/review/results_v6_variants/)
for the other combinations. Older reports remain historical records of their own rules.

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
python -m implementation.review.balance --pairs 320 --search-pairs 20 --workers 4 --max-plies 256 \
  --warp-range 1 --warp-breaks off --out implementation/review/results_v6_variants/range1_solitary
python -m implementation.review.warp_variants --pairs 320
```

Browser tests require Playwright and Chromium; `AOC_CHROMIUM_PATH` can select an
installed executable. The simulation summary records the exact source hash
(`a0e6214353025436b4dcd5ac73d8dfa21667690c6e2b7acf4d9ea2c980bf2f66`), the rules hash,
the Warp settings used, library versions, seeds and pairing. Base commit:
`2838347fafc3f59094083cb28df5a831156a68a7` plus this change.
