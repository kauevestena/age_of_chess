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
- **Archers** shoot up to two squares. After a two-square shot, that Archer waits two of its
  army's turns before shooting two squares again; adjacent shots are never limited.
- **Power shot:** an Archer with a friendly Archer on a neighbouring square may also shoot
  Cavalry or Heavy Infantry.

The King's reach, attack reach, the power-shot replacement and the Archers' two-square
shot with its two-turn cooldown were chosen by the designer. Everything else follows from the existing rules.

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
- **Long shots** are an arrow setting (`range: 2`, `cooldown: 2`) checked by the loader. Each
  Archer carries its remaining cooldown, which moves with it, counts down after each of its
  army's orders, is part of the repeated-position check, and fills a new observation plane
  (shape `(38, 8, 8)` in both rulesets). The board shows an hourglass with the turns left, and
  the unit panel says whether the long shot is ready.

## Validation

| Check | Result |
|---|---|
| Python regression suite | 1,301 passed (74 Open Field tests); one optional MaskablePPO test skipped locally because `sb3_contrib` is unavailable |
| JavaScript unit suite | 75 passed (13 Open Field tests) |
| Python/browser differential test | 25,512 positions and 1,409,025 legal actions across both rulesets, including 784 Open Field positions with an Archer cooling down and 86 long-shot transitions; zero discrepancies |
| Browser integration | 155 assertions passed (21 for Open Field); no browser errors, failed requests or external requests |
| Static build, generated rules and whitespace checks | Passed |
| Paired simulation | 2,000 Open Field games per arrow variant, 83,237 orders for the shipped rules; zero invariant or action-codec failures |

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
- **Long shots:** arrows reach two squares and stop at the first unit; the cooldown lasts
  exactly two of the shooter's army's turns (the opponent's turns don't count); adjacent
  shots and other Archers are unaffected; the cooldown moves with the Archer, enters the
  repeated-position check and the observation; return fire and power shots at two squares;
  invalid cooldowns are rejected. The reference generators include shots, and their random
  boards give some Archers a cooldown.

**Whole games:** seeded Random, Greedy and Lookahead games assert after every order that no
square holds two units, only action kinds 0–3 appear, units are conserved and every action
round-trips through its ID.

**Browser:**
- **JavaScript tests:** switching rulesets repeatedly in one process; saves round-tripping
  the ruleset, old saves loading as Warfare and a mismatched ruleset being rejected; all
  three AI levels playing legal Open Field orders, including a short AI-versus-AI game.
- **Playwright run:** picks Open Field in the war camp, plays a two-square Pikeman move and
  a three-square Cavalry ride past its own Pikeman, then reloads the autosave. It also opens
  the guide tab and watches an AI-versus-AI Open Field battle. From a real 36-order game, it
  makes a two-square shot and checks the hourglass, the unit panel and the saved cooldown.

## Simulation results

Standard setup, fixed seeds, colors swapped within each pair, maximum 256 normal orders,
the same settings as the [Warfare review](WARP_V6.md). Shipped rules: two-square arrows with
the two-turn cooldown.

| Policies | Games | North wins | South wins | Draws | Capped | Mean orders (Warfare) |
|---|---:|---:|---:|---:|---:|---:|
| Random / Random | 640 | 322 | 318 | 0 | 0 | 64.3 (95.8) |
| Greedy / Greedy | 640 | 299 | 335 | 6 | 0 | 43.5 (73.7) |
| Greedy / Random, colors swapped | 640 | 319 | 318 | 3 | 0 | 16.3 (39.7) |
| Lookahead / Greedy, colors swapped | 40 | 19 | 21 | 0 | 0 | 40.1 (79.5) |
| Lookahead / Lookahead | 40 | 20 | 20 | 0 | 0 | 56.2 (119.1) |

| Measure | Warfare | Open Field |
|---|---:|---:|
| North's share of decisive games | 50.0% | 49.2% (979 of 1,991) |
| Capped games / repetition draws / stagnation | 1 / 8 / 0 | 0 / 9 / 0 |
| Turns restricted by the minimal-loss rule | 0 | 0 |
| King-move forfeits | 91 | 15 |
| Deaths per starting piece: P / N / B / R / Q | 30 / 64 / 32 / 15 / 33% | 40 / 57 / 46 / 23 / 45% |
| Warps per game | 2.96 | 0.73 |
| Moves and attacks of 1 / 2 / 3 squares | — | 35% / 58% / 7% |

### Archer variants

The same probe for three Archer rules (`--arrow-range`, `--arrow-cooldown`):

| Arrows | Shots per game | Long shots | Power shots | Archers lost | Greedy mean orders | North's share |
|---|---:|---:|---:|---:|---:|---:|
| One square (first Open Field rule) | 0.18 | 0 | 2 | 45% | 42.5 | 49.8% |
| Two squares, no cooldown | 0.57 | 762 | 11 | 46% | 43.8 | 49.3% |
| **Two squares, two-turn cooldown (shipped)** | **0.53** | **684** | **11** | **46%** | **43.5** | **49.2%** |

What this shows:

- **Long shots are used, but Archers are not lost any less.** Two-square arrows triple how
  often Archers fire, yet Archer losses stay at 45–46% in every variant. These agents do not
  hold Archers back: Greedy and Lookahead march them into contact, where they die in melee
  whatever their range. Human players who keep Archers behind the line should get more from
  the long shot than the simulation shows, but that is untested.
- **The cooldown rarely binds for these agents.** It removed about 80 of 762 long shots;
  the same Archer seldom wanted to shoot two squares on consecutive turns.
- **The mode stays sound.** Games remain about 40% shorter than Warfare, sides balanced
  (paired North scores 0.472–0.503 in the large cohorts, all intervals covering 0.5), no
  capped or stagnated games, and repetition rare. Relative agent strength is unchanged:
  Greedy beats Random in 637 of 640, Lookahead beats Greedy in 37 of 40.
- **Losses spread more evenly than in Warfare,** though Heavy Infantry is still the
  least-lost class (23%), and power shots stay rare (11 in 2,000 games).

These are weak-policy measurements, not proof of expert balance. If Archers still feel too
fragile in play, the next lever is their melee defence (for example a guarded front), not
more range.

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
# Archer variants: add --arrow-range 1 --arrow-cooldown 0, or --arrow-range 2 --arrow-cooldown 0
```

The simulation summary records the source hash
(`303a75d55cd6a81a52584c6ddbccf082a949411843faa72daf589fd9fe3f44b8`), the rules hash,
the arrow settings, seeds and pairing. Base commit: `1474edd599647fa85c5465930718b91b394e9e72`
plus this change. Variant summaries are in
[results_open_field_variants](../../implementation/review/results_open_field_variants/).
