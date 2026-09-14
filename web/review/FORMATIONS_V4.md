# Formation rules v4: implementation and validation

This change implements ordered N–S / E–W formations with up to three optional
rearrangements before one mandatory normal order. Class counters are the first
combat rule: a Pikeman defeats Cavalry even when attacked from behind. The
[complete rulesheet](../../rulesets/RULES.md) is the normative description.

## What is implemented

- Four A/B arrangements: A North/B South, A South/B North, A West/B East,
  A East/B West. Each existing friendly formation may rearrange once per turn;
  at most three distinct formations may do so. Identical-class swaps are no-ops.
- N–S side flanks expose both defenders. E–W braces its whole front arc and
  exposes both defenders directly behind. Other approaches meet the nearest
  subcell, then a ready reserve if the attacker survives the first contact.
- The reserve turns to guarded stance. That benefits matching ordinary classes;
  it never reverses a class counter. There is no fatigue penalty and no legacy
  combination override. Only the acting unit attacks; its companion stays home.
- Simultaneous contacts apply independent duels' casualties together. A serial
  encounter stops on Commander capture. Commander exposure follows physical
  position, including B, rather than a permanent protected slot.
- Ranged attacks select an eligible exposed A or B. A nearer ineligible unit
  screens the farther one. A double-Archer formation has power shots on either
  axis; return fire kills the actual shooting and targeted Archers only.
- Preparations keep player, normal-order count, repetition history and Commander
  retreat streak unchanged. The mandatory minimal-loss rule examines normal orders.
  Repetition distinguishes physical layouts, but ignores equivalent A/B relabelings.

The browser shows subcells, A/B selection, four arrangement buttons and a visible
preparation budget. Both single-player and AI spectator turns finish their
preparations and one normal order. Animations follow the actual first defender,
simultaneous wave and turning reserve. Fourteen tutorials and the field guide
explain the rules. Original artwork, fonts and synthesized soundtrack remain in
the self-contained static build.

Saves record preparations as well as normal orders, so a partial turn restores
its layout and remaining budget. Undo cancels pending preparations first, otherwise
an entire turn (including the opponent's reply in solo play). Review distinguishes
preparation steps from completed orders. Older rules-version saves are rejected
explicitly because replaying the same actions would change their meaning.

Python and browser engines use the same six-field action tuple with nine kinds:
0 move/join, 1 melee, 2 shoot A, 3 convert, 4–7 arrange, 8 shoot B. Preparation
source and target are the same square, with slot 0. Training now uses 73,728
action IDs and 35 observation planes. Old models require retraining. The Gym
wrapper retains learner control on a preparation and finishes all opponent
preparations before returning control after a normal order. League records are
versioned separately; example viewers and logs understand physical layouts.

## Validation performed

| Check | Result |
|---|---|
| Python regression suite | 797 passed; one optional MaskablePPO test skipped because `sb3_contrib` is unavailable locally |
| JavaScript unit suite | 32 passed |
| Python ↔ JavaScript differential test | 15,092 positions; 561,227 legal actions; zero discrepancies |
| Exhaustive ordinary combat assertions | Each engine independently checks 512 homogeneous and 3,072 mixed formation cases |
| Browser integration | Desktop, 360/390px mobile, input, all tutorials, save/load, review, undo, audio, worker fallback and AI spectator flows passed |
| Dedicated formation browser checks | Three-preparation limit, partial saves, complete-turn undo, board flipping, mobile controls, restored AI turn, reserve/simultaneous/target-B cinematics passed |
| Static build and rules export | Passed; all runtime assets remain local |

The differential test compares legal moves, board members, arrangements, pending
preparations, contact waves, casualties, player, retreat counters and terminal
outcomes. Browser checks monitor JavaScript/console errors and failed/external
asset requests. Screenshots are produced in `web/test-results/` and uploaded by
the existing GitHub Pages validation workflow. The optional training regression
is included in the repository's CPU dependency CI job.

## 1,000 paired simulation games

The final implementation played **83,123 normal orders** and **3,187 preparation
actions**, creating **16,566 formations**. Board conservation, layout validity,
preparation budget/turn invariants and action encoding had **zero failures**.
Each seed pair swaps colors while keeping policy seeds associated with the same
policy. Every game begins from the standard setup; the cap is 512 normal orders,
with preparations excluded from that cap.

| Policy matchup | Games | North wins | South wins | Draws | Capped, unresolved |
|---|---:|---:|---:|---:|---:|
| Random vs Random | 320 | 153 | 143 | 0 | 24 |
| Greedy vs Greedy | 320 | 154 | 160 | 4 | 2 |
| Greedy vs Random, colors swapped | 320 | 158 | 162 | 0 | 0 |
| Lookahead vs Greedy, colors swapped | 20 | 8 | 12 | 0 | 0 |
| Lookahead vs Lookahead | 20 | 6 | 4 | 0 | 10 |
| **Total** | **1,000** | **479** | **481** | **4** | **36** |

These are implementation and policy-behavior checks, **not proof of expert-play
balance or a causal comparison with v3**. The 20-game search cohorts are small,
and half of Lookahead-vs-Lookahead games remain unresolved. Browser AI searches
normal orders and then plans defensive rearrangements; Python Greedy/Lookahead
also use a bounded defensive planner. Neither searches every compound turn with
three preparations. Expert formation play may therefore differ substantially.

Raw [game results](../../implementation/review/results_v4/games.csv),
[summary and source hashes](../../implementation/review/results_v4/summary.json)
and [sample replays](../../implementation/review/results_v4/sample_replays.json)
are committed with this review. Historical reports retain their original rules
and must not be interpreted as v4 results.

## Reproduce

From the repository root with the local virtual environment and web dependencies:

```sh
.venv/bin/python -m pytest -q
.venv/bin/python web/scripts/export_rules.py --check
node --test web/tests/*.test.mjs
node web/tests/parity.mjs
node web/tests/browser.mjs
node web/scripts/build.mjs
.venv/bin/python -m implementation.review.balance --pairs 160 --search-pairs 10 --workers 4 --max-plies 512 --out implementation/review/results_v4
```

For a system Chromium executable, set `AOC_CHROMIUM_PATH` when running the browser
suite. Otherwise install the pinned Playwright Chromium with the commands in
[the browser README](../README.md). Simulations record source and rules hashes;
wall-clock timings and browser search behavior can vary between machines.
