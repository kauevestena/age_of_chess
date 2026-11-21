# Open Field: implementation, validation and simulation

Open Field is a second ruleset selectable in the war camp (**Rules → Open Field**) and in
Python (`rulesets/open_field.yaml`). The [rulesheet](../../rulesets/OPEN_FIELD.md) describes
it. Warfare, the standard ruleset, is unchanged and stays the default.

## The ruleset

- **No formations:** one unit per square, no arrangements, no royal escort.
- **Reach:** Pikemen, Archers, Heavy Infantry and the Priestess move up to two squares,
  Cavalry up to three, passing empty squares or friendly units. The King keeps one step.
  Each step follows the usual movement rule toward the enemy King's row. A move ends on
  an empty square.
- **Attacks** reach as far as movement, along paths that may turn in any direction. Class
  counters and guarded stance (from the starting square) are unchanged.
- **Priestess:** with an enemy beside her, both steps may go in any direction. Warp is
  unchanged (two squares, solitary targets).
- **Power shot:** an Archer with a friendly Archer on a neighbouring square may also shoot
  Cavalry or Heavy Infantry.

The King's reach, attack reach and the power-shot replacement were chosen by the designer
before implementation. Everything else follows from the existing rules.

## Implementation

- `rulesets/open_field.yaml` declares `mode: open_field`, `formations: false`, no
  rearrangements, the reach per class and the adjacent power-shot support. The loader
  rejects any mix of Warfare and Open Field settings.
- Both engines now compute reach with one breadth-first walk over squares, replacing the
  hard-coded two-step Cavalry loops. Warfare produces exactly the same legal actions as
  before: the full regression suites and the Python/browser differential test pass unchanged.
- The browser exports both rulesets. Each game state carries its `mode`, and every engine
  entry point activates the matching rules, so the AI worker, saves, undo, review and
  spectator battles follow the game's own mode. Saves without a ruleset load as Warfare.
- The war camp has a Rules picker. The battle header names Open Field, formation controls
  and the formation budget stay hidden, the unit panel states each unit's reach, and the
  field guide has an Open Field tab. The tutorial still teaches Warfare.
- An engine bug found by the new tests is fixed: the training observation divided by the
  rearrangement budget, which is zero in Open Field.

## Validation

| Check | Result |
|---|---|
| Python regression suite | 1,295 passed (68 Open Field tests); one optional MaskablePPO test skipped locally because `sb3_contrib` is unavailable |
| JavaScript unit suite | 73 passed (11 Open Field tests) |
| Python/browser differential test | 25,777 positions and 1,428,168 legal actions across both rulesets, 6,418 of them Open Field positions; zero discrepancies |
| Browser integration | 150 assertions passed (16 for Open Field); no browser errors, failed requests or external requests |
| Static build, generated rules and whitespace checks | Passed |
| Paired simulation | 2,000 Open Field games, 81,073 orders; zero invariant or action-codec failures |

**Independent reference.** Both test suites contain a complete Open Field move generator
written separately from the engines. It enumerates every path recursively rather than
walking squares breadth-first, and reads the combat table directly. It covers quiet moves,
attacks, shots with power-shot support, and Warps. The engines' unfiltered legal actions
must equal it exactly:

- **Single units:** every class against every enemy King square, both owners (46,872
  positions per engine).
- **Crowded random boards:** friendly and enemy blockers, paired Archers and Priestesses
  (1,500 in Python, 1,000 in JavaScript).
- **Opening:** the starting position for both sides (95 orders each).

**Named cases** check:

- **Movement:** passing a friend; Cavalry riding three squares through a lane of friends;
  an enemy screen blocking every path; never stopping on a friend.
- **Combat:** attacks from two and three squares; guarded stance sectors at range (front,
  front diagonal, flank, rear); class counters at full reach.
- **King and Priestess:** the King's single step, peril step and inability to attack; the
  Priestess's free steps in contact and attacks limited to Priestess or King.
- **Archers and Warp:** the power shot with an orthogonal or diagonal neighbour and not
  without one; return fire; Warp range.
- **No formations:** stacks are rejected; no arrangements; the observation planes.
- **Interfaces:** the environments (PettingZoo API test) accept the Open Field ruleset.

**Whole games:** seeded Random, Greedy and Lookahead games assert after every order that no
square holds two units, only action kinds 0–3 appear, units are conserved and every action
round-trips through its ID.

**Browser:**
- **JavaScript tests:** switching rulesets repeatedly in one process; saves round-tripping
  the ruleset, old saves loading as Warfare and a mismatched ruleset being rejected; all
  three AI levels playing legal Open Field orders, including a short AI-versus-AI game.
- **Playwright run:** picks Open Field in the war camp, plays a two-square Pikeman move and
  a three-square Cavalry ride past its own Pikeman, then reloads the autosave. It also opens
  the guide tab and watches an AI-versus-AI Open Field battle.

## Simulation results

Standard setup, fixed seeds, colors swapped within each pair, maximum 256 normal orders,
the same settings as the [Warfare review](WARP_V6.md).

| Policies | Games | North wins | South wins | Draws | Capped | Mean orders (Warfare) |
|---|---:|---:|---:|---:|---:|---:|
| Random / Random | 640 | 325 | 315 | 0 | 0 | 61.8 (95.8) |
| Greedy / Greedy | 640 | 302 | 332 | 6 | 0 | 42.5 (73.7) |
| Greedy / Random, colors swapped | 640 | 319 | 318 | 3 | 0 | 16.1 (39.7) |
| Lookahead / Greedy, colors swapped | 40 | 21 | 19 | 0 | 0 | 42.4 (79.5) |
| Lookahead / Lookahead | 40 | 24 | 16 | 0 | 0 | 56.5 (119.1) |

| Measure | Warfare | Open Field |
|---|---:|---:|
| North's share of decisive games | 50.0% | 49.8% (991 of 1,991) |
| Capped games / repetition draws / stagnation | 1 / 8 / 0 | 0 / 9 / 0 |
| Turns restricted by the minimal-loss rule | 0 | 0 |
| King-move forfeits | 91 | 20 |
| Deaths per starting piece: P / N / B / R / Q | 30 / 64 / 32 / 15 / 33% | 38 / 56 / 45 / 22 / 44% |
| Warps per game | 2.96 | 0.73 |
| Power shots | (formation) | 2 in 2,000 games |
| Moves and attacks of 1 / 2 / 3 squares | — | 27,542 / 46,374 / 5,335 |

What this shows:

- **Games are much faster.** Greedy mirror games are 42% shorter, plausibly because units
  reach each other sooner and the King has no escort; the simulation does not separate the two.
- **No first-move advantage appears** in the large cohorts. North's paired score is
  0.477–0.508 across them, with intervals covering 0.5. The 40-game Lookahead mirror shows
  0.600, but its interval (0.45–0.75) is too wide to read.
- **The mode does not stall.** No game reached the cap, nobody was stalemated, and
  repetition stays rare. Relative agent strength is unchanged: Greedy beats Random in 637 of
  640, Lookahead beats Greedy in 37 of 40.
- **Most orders use the new reach:** 58% of moves and attacks cover two squares and 7%
  three.
- **Losses spread more evenly.** Heavy Infantry is lost more often than in Warfare (22%
  against 15%) and Cavalry less (56% against 64%), though Heavy Infantry is still the
  least-lost class.
- **The adjacent power shot almost never fires** (2 in 2,000 games). The agents seldom
  keep two Archers side by side with a Cavalry or Heavy Infantry in reach. Whether human
  players use it more is open; if not, it is the first rule to revisit.

These are weak-policy measurements, not proof of expert balance. The agents do not plan
Archer pairs or Priestess play, and human play may pace the mode very differently.

Raw data: [summary](../../implementation/review/results_open_field/summary.json),
[all games](../../implementation/review/results_open_field/games.csv),
[sample replays](../../implementation/review/results_open_field/sample_replays.json).

## Reproduce

Run from the repository root:

```bash
python -m pytest -q
python web/scripts/export_rules.py --check
node --test web/tests/*.test.mjs
AOC_PYTHON=python node web/tests/parity.mjs
node web/tests/browser.mjs
node web/scripts/build.mjs
python -m implementation.review.balance --ruleset rulesets/open_field.yaml --pairs 320 \
  --search-pairs 20 --workers 4 --max-plies 256 --out implementation/review/results_open_field
```

The simulation summary records the source hash
(`79e6a750d19c8ea64bed4c733c2714d201682960bfaa82c84d3284286b9e731d`), the rules hash,
seeds and pairing. Base commit: `52c672c067e1d0242cf79ac6737d392fc257da58` plus this change.
