# Age of Chess – Warfare: rules v6 specification

**Status:** draft for approval, written 2026-11-13. Nothing here is implemented.
`RULES.md` and `default.yaml` still describe rules v5, which stay in force until this
specification is approved and implemented.

**Baseline:** rules v5. Every rule not mentioned in this document is unchanged.
Rule IDs (M1–M10, W1–W9) are meant to be cited by tests.

## 1. What changes

| ID | Change | Status |
|---|---|---|
| A | The Priestess loses conversion and gains **Warp**: she moves an enemy unit to any empty square | Agreed. The targeting limits in W2 and W5 were proposed during design and are adopted here; they need a final yes |
| B | Non-King units move **toward the enemy King's row** instead of "forward" | Agreed |
| C | Veteran status (permanent backward movement) is removed | Follows from B |
| D | Sideways steps in the enemy half are removed | Adopted as the default; needs a final yes |
| E | The frontal sidestep (an enemy directly ahead allows a sideways step) is removed | Adopted as the default; needs a final yes |

Why:

- **A.** A physical chess set cannot show a unit changing sides. Warp only moves a piece.
- **B and C.** One rule that can be read from the board replaces forward-only movement,
  the back-rank exception and a per-unit status that a chess set cannot show. It also
  ends back-and-forth movement.
- **D and E.** Both let a unit step left and right indefinitely, which B is meant to end.

At a physical board, v6 needs no markers on units. The only things left to remember are
the two King streaks per side and repeated positions, both unchanged from v5.

Three earlier proposals are not part of v6; see section 11.

## 2. Terms

- **Coordinates** are (row, column) as in `RULES.md`: North starts on rows 6–7, South on
  rows 0–1, and West is column 0.
- **Forward** for a side means toward the enemy back rank: decreasing rows for North,
  increasing rows for South. v6 still uses it for facing, guarded stance, formation
  entry and every King rule.
- **Reference row** of a unit: the row on which the enemy King stands when the order is
  issued.
- **Open square:** a square that is empty or holds exactly one friendly unit.
- **Solitary unit:** the only unit on its square.
- **Quiet move:** a move or formation entry without combat (action kind 0).

## 3. Movement

This section replaces "Movement and precedence" in `RULES.md`.

At the table: find the enemy King's row. A unit steps onto the next row toward it,
straight or diagonally. Once level with the King, it steps along the row toward him.

**M1 – Scope.** M2–M6 govern the quiet moves of Pikemen, Cavalry, Archers, Heavy
Infantry and Priestesses. The King moves by M7. Attacks follow M8.

**M2 – Advance step.** A unit's advance steps depend on its reference row:

| The unit stands | Advance steps |
|---|---|
| Off its reference row | One square onto the adjacent row on the King's side: straight, or diagonally to either side |
| On its reference row | One square sideways toward the enemy King |

**M3 – Quiet move.** A quiet move is one advance step onto an open square on the board.
A square holding an enemy unit or two friendly units cannot be entered by a quiet move.
A unit standing beside the enemy King on his row therefore has no quiet move: its only
advance step leads onto the King's square, which is an attack.

**M4 – Cavalry.** Cavalry may take one or two advance steps as a single order. The
second step is chosen afresh under M2 from the intermediate square, so a Cavalry whose
first step reaches the reference row takes its second step sideways toward the King.
The intermediate square must be empty or hold exactly one friendly unit, which stays in
place. The destination must be open. Different paths to the same destination are one
order.

**M5 – Priestess in contact.** Unchanged from v5: while an enemy unit stands on any of
the eight squares around her, a Priestess may also step one square in any direction
onto an open square. (This is what the v5 engine does; the v5 rulesheet calls it a
retreat.)

**M6 – No other quiet moves.** Non-King units have no quiet moves beyond M3–M5. The v5
permissions listed in section 5 no longer exist.

**M7 – King.** Unchanged from v5. The King steps forward, straight or diagonally toward
the enemy back rank, onto an open square. In peril (an enemy unit within two squares in
any direction, whatever stands between) he may step one square in any direction. The
King has no reference row. His limits are unchanged: the third consecutive backward
move and the fourth consecutive move of any kind forfeit.

**M8 – Attacks.** Unchanged from v5. An armed unit may attack an adjacent enemy-held
square from any direction. Kings cannot attack, and a Priestess attacks only a
Priestess or a King; against solitary ordinary units she uses Warp. Cavalry may attack
over two steps in any directions, through an intermediate square that is empty or holds
exactly one friendly unit. An attacker that survives and clears the square occupies it,
wherever that square lies.

**M9 – The reference row follows the King.** The reference row is read from the board
when the order is issued. When the enemy King moves, the advance steps of every unit
change with him. A unit that the enemy King has passed therefore advances back toward
him.

**M10 – Facing and formation entry.** Unchanged from v5. Facing is fixed by ownership:
North faces row 0 and South faces row 7, whichever way a unit moves. Entering a square
held by one ally forms an N–S formation with the resident in the forward subcell (A)
and the arrival behind it (B), whatever direction the arrival came from.

Consequences (informative, not rules):

- In the starting position the legal orders are exactly those of v5: 52 for the side to
  move. This was checked against the v5 engine.
- While the enemy King stays on his back rank, a unit short of that rank moves as in v5
  without D and E. On his rank, v5 allowed a step in any direction; v6 allows only the
  step along the rank toward him.
- A quiet move never retreats. A non-King unit gets farther from its reference row only
  by capturing, by the Priestess's contact step, or by being warped.
- Every advance step brings a unit strictly closer to the enemy King's row, or along
  that row to the King. Unless a King moves, a capture happens or a unit is warped,
  quiet play therefore cannot repeat a position (a Priestess in contact excepted), and
  each side's supply of quiet moves is finite.
- A player with no safe quiet move left must advance into contact or attack on bad
  terms. The minimal-loss rule never restricted a turn in the recorded v5 games; under
  v6 it may start to matter.
- Stagnation in the strict sense stays unlikely: an ordinary unit always has an order
  when one of its advance squares is empty or holds an enemy.
- Units cannot walk around a King, because quiet moves never cross his row. The squares
  behind him are reached only by units he has passed, by capture, by Warp, or by a
  Priestess's contact step.

## 4. Warp

This section replaces the conversion paragraph of "Ranged attacks and conversion" in
`RULES.md`.

**W1 – Order.** Warp replaces conversion as the Priestess's ability. It is a normal
order: it is the turn's single order, it may follow up to three formation
rearrangements like any other order, and the Priestess does not move.

**W2 – Target.** One enemy Pikeman, Cavalry, Archer or Heavy Infantry that is solitary
and stands on one of the eight squares around the Priestess.

**W3 – Destination.** Any empty square on the board, chosen by the warping player.
There is no range, line or region limit. A square that already holds a unit is not
empty, even when it is open, so it is not a destination.

**W4 – Effect.** The target is lifted from its square and placed on the destination as
a solitary unit. It keeps its owner and class. No combat takes place and nothing dies.
The Priestess, her companion and their arrangement are unchanged.

**W5 – Immune.** Kings, Priestesses, both members of any formation, and friendly units
cannot be warped.

**W6 – Either subcell.** A Priestess may warp from either subcell of a formation,
including when she is the King's escort.

**W7 – After the order.** A Warp is followed by the usual end-of-order steps. The
warping side's two King streaks reset, because the order belongs to another unit. The
turn passes, the position is counted for repetition, and the game is adjudicated in the
v5 order. A Warp cannot capture. It can end the game only by leaving the opponent
without a normal order (stagnation) or by completing a third repetition.

**W8 – Minimal-loss rule.** A Warp loses no friendly unit. While any Warp is available,
the minimal-loss restriction therefore cannot bind.

**W9 – No limit.** Warp has no cooldown and no cap. The same unit may be warped again
whenever W2 holds.

Rulings:

- The warped unit's owner moves next, so the unit may act at once from its new square.
- From its new square the warped unit moves by section 3. Its reference row is still
  the row of the warping side's King.
- The destination may be next to any unit of either side, including either King. A unit
  placed within two squares of a King puts that King in peril in the usual way.
- A warped unit never joins a formation, because the destination must be empty.
- The target's own square is never a destination: it is occupied when the order is
  issued.

Consequences (informative, not rules):

- Nothing dies and nothing changes sides. With conversion gone, ownership is fixed for
  the whole game, unit counts only fall, and a lone King can only result from deaths.
- Formation members are immune, so pairing units is the defence against Warp.
- A unit warped to its own back rank needs up to seven orders (four for Cavalry) to
  draw level with an enemy King who is on his own back rank.
- A Warp also hands the warped unit more quiet moves, because it starts farther from
  its reference row.

## 5. Rules removed

| v5 rule | In v6 |
|---|---|
| Conversion: the Priestess turns an adjacent solitary unit to her side | Removed; replaced by Warp (section 4) |
| Quiet moves go forward, toward the enemy back rank | Replaced by M2 |
| Veteran status: permanent backward movement after reaching the enemy back rank | Removed (C) |
| On the enemy back rank, a non-King may step once in any direction | Removed; a unit on its reference row uses M2 |
| In the enemy half, a non-King may step sideways | Removed (D) |
| An enemy directly ahead grants a sideways step | Removed (E) |
| A veteran Priestess keeps backward movement without an adjacent enemy | Removed |
| Cavalry uses two forward or two backward steps; the zigzag clause | Replaced by M4 |

E changes only Pikemen, Cavalry, Archers and Heavy Infantry. For a King or a Priestess
an enemy directly ahead already triggers the peril rule (M7) or the contact step (M5).

## 6. Other rulesheet edits

Edits to `RULES.md` outside the two replaced sections:

- **Board, setup and turn.** The list of normal orders becomes "move, melee attack,
  ranged attack or Warp". The formation paragraph drops its two references to veteran
  status: identical classes are always interchangeable.
- **Single-versus-single melee.** "Kings remain immune to ranged attacks and
  conversion" becomes "… and Warp".
- **Guarded stance.** "Conversion changes facing; moving sideways or backward does not"
  becomes "Movement never changes facing".
- **The King's formation support.** "King support never changes ranged exposure, return
  fire or conversion" drops "or conversion".
- **Ranged attacks and conversion.** Retitled "Ranged attacks and Warp". The paragraph
  on adjacent opposing Priestesses is unchanged.
- **Minimal-loss rule.** Add W8.
- **End of the game.** Item 1 drops "King conversion is not a win condition". Item 5
  drops "veteran abilities" from the repeated position and drops the sentence about
  same-class units with different veteran abilities. "Captures and conversions do not
  provide farmable bonuses" becomes "captures and warps".
- **Version compatibility.** Rewritten from section 8.

Explicitly unchanged: the combat table, guarded stance, all formation and
royal-escort rules, Archer rules, the automatic death of adjacent opposing Priestesses,
the minimal-loss rule, both King limits, the lone-King and stagnation rules, the
repetition threshold, and the turn structure with up to three rearrangements.

## 7. Worked examples

These are test vectors. Each is a study position that also contains both Kings and
whatever other units a live position needs, placed where they do not affect the unit
shown. Only quiet destinations are listed.

| # | Unit to move | Enemy King | Also on the board | Quiet destinations |
|---|---|---|---|---|
| 1 | North Pikeman (3,2) | (0,4) | – | (2,1) (2,2) (2,3) |
| 2 | North Pikeman (1,0) | (0,4) | – | (0,0) (0,1) |
| 3 | North Pikeman (1,4) | (0,4) | – | (0,3) (0,5); the straight step is an attack on the King |
| 4 | North Pikeman (0,1) | (0,4) | – | (0,2) |
| 5 | North Pikeman (0,6) | (0,4) | – | (0,5) |
| 6 | North Pikeman (0,3) | (0,4) | – | none; it may attack (0,4) |
| 7 | North Pikeman (1,6) | (3,4) | – | (2,5) (2,6) (2,7); the King has passed it |
| 8 | North Pikeman (0,0) | (3,4) | – | (1,0) (1,1) |
| 9 | South Pikeman (4,7) | (7,4) | – | (5,6) (5,7) |
| 10 | South Pikeman (7,0) | (7,4) | – | (7,1) |
| 11 | North Cavalry (5,0) | (3,4) | – | (4,0) (4,1) (3,0) (3,1) (3,2) |
| 12 | North Cavalry (4,4) | (3,6) | – | (3,3) (3,4) (3,5); second steps run along the row |
| 13 | North Cavalry (3,0) | (3,4) | – | (3,1) (3,2) |
| 14 | North Cavalry (3,2) | (3,4) | – | (3,3); the second step reaches the King and is an attack |
| 15 | North Cavalry (1,4) | (3,4) | – | (2,3) (2,4) (2,5) (3,2) (3,3) (3,5) (3,6) |
| 16 | North Cavalry (5,0) | (3,4) | North formation on (4,1); South unit on (4,0) | none; (4,0) may be attacked |
| 17 | North Cavalry (5,0) | (3,4) | One North unit on (4,1) | (4,0) (4,1) (3,0) (3,1) (3,2) |

Warp example. North to move. North: Priestess (4,3), King (7,4), Pikeman (7,0).
South: Pikeman (3,3), Heavy Infantry (3,4), two Pikemen in formation on (4,2),
King (0,4), Archer (0,0).

- Eight squares are occupied, so 56 are empty.
- The Pikeman on (3,3) and the Heavy Infantry on (3,4) are warpable. The formation on
  (4,2) is immune (W5).
- There are 2 × 56 = 112 legal Warps.
- Warping the Heavy Infantry to (0,7) is the action `(3, 4, 0, 0, 7, 3)`.
- Afterwards (3,4) is empty, the Heavy Infantry stands alone on (0,7), and South is to
  move. Its reference row is row 7, so its advance steps are (1,6) and (1,7).

## 8. Configuration, state and interfaces

### 8.1 `default.yaml`

| Key | v5 | v6 |
|---|---|---|
| `game.version` | 5 | 6 |
| `game.advance_reference` | – | `enemy_king_row` (new) |
| `game.permanent_backward_movement` | `true` | removed |
| `game.frontal_enemy_sidesteps` | `true` | removed |
| `game.board.attack_field_depth` | 4 | removed |
| `pieces.*.move.attack_field_sideways` | per class | removed |
| `pieces.*.move.last_rank_all_directions` | per class | removed |
| `pieces.Q.abilities` | `convert`, range 1, targets P N B R | `warp`, range 1, targets P N B R |

Everything else is unchanged, including the combat table, piece values, `minimal_loss`,
`repetition_draw` and both King limits.

Loader rules:

- Unknown keys are already rejected, so the removed keys fail to load. The `convert`
  ability must be rejected as well.
- `warp` is valid only on the Priestess, with range 1, a single unit, and targets
  drawn from P, N, B and R.
- Each `steps` entry stays `(-1, dc)`. For non-Kings, −1 now means one row toward the
  reference row. For the King it still means one row forward.
- The sideways step on the reference row comes from `advance_reference` and is not
  listed in `steps`. A class with an empty `steps` list has no advance step at all.

### 8.2 Actions

The action tuple `(from_row, from_col, slot, to_row, to_col, kind)`, the nine kinds and
the 73,728 action IDs are unchanged. Kind 3 becomes Warp:

| Field | Meaning for kind 3 |
|---|---|
| `from_row`, `from_col` | Square of the enemy unit being warped |
| `slot` | Always 0, because the target is solitary |
| `to_row`, `to_col` | Empty destination square |

- The action is legal when the side to move has a Priestess adjacent to the `from`
  square and W2, W3 and W5 hold.
- The acting Priestess is implied. Both engines already reject positions with more than
  one Priestess per side, so she is unique.
- A Warp names three squares. This encoding keeps the six-field tuple and needs no
  pending state in the middle of a turn. An interface can still ask for three
  selections (Priestess, target, destination) and send the single action at the end.
- Kind 3 is the only kind whose `from` square holds an enemy unit. Code that reads "the
  acting unit" from `from` must handle it separately.

### 8.3 State

- Units carry no veteran flag. It leaves the board copy, validation, canonical
  arrangements, the repetition key, saves and the study-position interfaces.
- A repeated position is identified by units, ownership, arrangements, side to move and
  both pairs of King counters.
- Loading a study position no longer marks units on the far rank.

### 8.4 Events and logs

- A Warp event records the acting Priestess's square and subcell, the warped unit, its
  origin and destination, no losses and no movement of the actor.
- The conversion fields and the veteran-unlock field disappear from events, logs, the
  parity oracle and the probe.
- End reasons are unchanged. v6 adds none.

### 8.5 Observations

Observations become `(37, 8, 8)`. Planes 0–34 keep their v5 meaning. The four veteran
planes are removed. Planes 35–36 hold the own and enemy King movement streaks divided
by four (planes 39–40 in v5).

### 8.6 Versions

- Browser saves carry rules version 6. Older saves are rejected with an explanation,
  as v4 saves are today.
- Models trained on earlier rules must be retrained. League records for v6 stay
  separate from earlier versions.

## 9. Implementation checklist

| Area | Files | Work |
|---|---|---|
| Rules schema | `rulesets/default.yaml`, `implementation/age_of_chess/rules_loader.py`, `web/src/rules.mjs` (generated by `web/scripts/export_rules.py`) | Section 8.1 |
| Move generation | `implementation/age_of_chess/movegen.py`, `web/src/engine.mjs` | M1–M9 and Warp generation; remove the three sideways branches and the veteran step groups |
| Transitions and state | `implementation/age_of_chess/env.py`, `game_state.py`, `combat.py`, `web/src/engine.mjs`, `web/src/formations.mjs` | Warp transition; remove veteran marking; repetition key; observation planes |
| Saves | `web/src/records.mjs` | Rules version 6; reject older saves |
| Agents and AI | `implementation/age_of_chess/agents.py`, `web/src/ai.mjs` | Section 10.3; remove conversion scoring and the veteran bonus |
| Probe and tools | `implementation/review/balance.py`, `implementation/examples/`, `web/tests/oracle.py`, `web/tests/parity.mjs` | Warp statistics; drop veteran and conversion fields |
| Browser interface | `web/src/app.mjs`, `web/src/tutorial.mjs`, `web/src/animation.mjs`, `web/index.html` | Three-step Warp selection; remove the veteran mark; replace three lessons (conversion, frontal sidestep, return from the far rank) and one veteran sentence; rename the conversion effect and legend |
| Documents | `rulesets/RULES.md`, `README.md`, `web/README.md`, `agents.md` | Sections 3–6 and 8 |
| Tests | `implementation/tests/`, `web/tests/` | Section 10; veteran, conversion and sidestep tests are replaced |

Study positions need care: the enemy King's square now decides quiet moves, so test
fixtures that drop Kings into a default corner must place them deliberately.

## 10. Validation

### 10.1 Rule tests

Each test runs in both engines.

Movement:

1. In the starting position the legal orders equal the v5 list (52 per side).
2. Every row of the table in section 7.
3. For each non-King class, each unit square and each enemy King square on a minimal
   board, quiet destinations equal an independent reference of M2–M4.
4. Blocking by a full formation, an enemy unit and the board edge; the Cavalry
   intermediate-square rule.
5. The Priestess's contact step exists only while an enemy is adjacent. The King's
   peril rule is unchanged, and the King ignores the reference row.
6. The removed permissions are gone: no sideways step in the enemy half, no free step
   on the enemy back rank, no frontal sidestep for the four ordinary classes, and no
   backward step after reaching the back rank.
7. After the enemy King steps past a unit, that unit's quiet moves point back toward
   him.
8. A capture may carry a unit away from its reference row; its next quiet moves follow
   M2 from the new square.

Warp:

9. The legal Warps are exactly (adjacent solitary enemy P, N, B or R) × (empty
   squares), with the action shape of section 8.2.
10. Rejected: Kings, Priestesses, formation members, friendly units, non-adjacent
    targets, and any occupied destination.
11. Only the target's square and the destination change. Owner and class are kept, the
    Priestess and her formation are untouched, and nothing dies.
12. Warp works from either subcell, including for a Priestess escorting the King.
13. The warping side's King streaks reset; the opponent's are preserved.
14. With only losing orders and one Warp available, every order stays legal (W8).
15. A side whose only orders are Warps is not stagnated.
16. Positions after Warps count toward repetition; the third occurrence draws.
17. Warping a unit within two squares of a King enables that King's peril step.

State and interfaces:

18. The loader rejects the removed keys and `convert`, and accepts `warp` only as
    section 8.1 allows.
19. No veteran data remains in state, repetition keys, observations or saves. v5 saves
    are rejected.
20. All 73,728 action IDs round-trip, and the kind-3 mask equals the legal Warps.

### 10.2 Parity

The existing Python-to-browser differential test must pass with zero discrepancies
over seeded games and study positions that include Warps, units on and beyond the
reference row, and Kings that have advanced.

### 10.3 Simulation probe

Run the probe with the v5 settings and compare with the v5 results:

```bash
python -m implementation.review.balance --pairs 320 --search-pairs 20 --workers 4 \
  --max-plies 256 --out implementation/review/results_v6
```

Agents must handle Warp sensibly before the probe means anything. One warpable target
adds an order for every empty square, typically thirty to fifty, while a typical
position has a few dozen other orders. An agent that samples or breaks ties uniformly
over actions would warp almost every time a target is adjacent, and to a random square.

- **Random:** all Warps of one target count as a single option in the uniform draw. The
  destination is then drawn uniformly.
- **Greedy and Lookahead:** a Warp has zero material swing. Tie-breaking treats all
  Warps of one target as one option. The destination is the empty square that leaves
  the warped unit the largest row gap to its reference row, with ties broken by
  distance from the warping side's King and then by seeded random choice.
- **Browser AI:** search only a few destinations per target, chosen by the same
  heuristic, so the search stays bounded.

Results will describe these heuristics, not expert Warp play.

New counters to record: Warps per game and by class, the rows of extra distance each
Warp adds, stagnation endings, and turns restricted by the minimal-loss rule.

| Measure | v5 baseline | Review v6 if |
|---|---|---|
| Games capped at 256 orders | 32 of 2,000 (1.6%) | above 5% |
| Threefold-repetition draws, Greedy against Greedy | 18 of 640 (2.8%) | above 6% |
| Mean orders per game, Greedy against Greedy | 62.6 | above 90 |
| Turns where every order loses a unit (the minimal-loss rule restricts the turn) | 0 of 142,098 orders | frequent enough to notice in play |
| Stagnation endings | 0 | more than isolated cases |
| North's share of decisive games | 48.4% of 1,950 | outside 45–55% |
| Deaths per starting piece | P 33%, N 62%, B 34%, R 14%, Q 33% | Heavy Infantry still far below the others |
| Ability uses per game | 0.57 conversions | reported for comparison only |

The review thresholds are proposals, not measured limits.

What to adjust if a threshold is crossed:

- **Games too long, or exile dominates.** Limit Warp destinations: not onto the warped
  unit's own two home rows, or no farther than a set distance from where it stood.
- **Forced sacrifices are common.** Restore E first, then D.
- **Heavy Infantry is still rarely lost.** Take up the deferred Archer proposal in
  section 11.

## 11. Open points

Needs a final yes:

1. The Warp limits in W2 and W5: adjacent targets only, solitary targets only, the four
   ordinary classes only, enemy units only.
2. D: no sideways steps in the enemy half.
3. E: no frontal sidestep.

Proposed earlier and not part of v6:

- **King limits as illegal moves.** Make the over-limit King move illegal instead of a
  forfeit, and keep a single counter.
- **Delete the minimal-loss rule.** Under v6 the rule may start to bind, which is new
  information for this decision.
- **Let a single Archer shoot Heavy Infantry.** Deferred until v6 has been measured,
  because Warp already adds pressure on solitary Heavy Infantry.
