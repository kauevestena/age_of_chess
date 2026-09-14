# Age of Chess – Warfare: rules v4

This is a capture-the-Commander game, not checkmate chess. The complete executable
combat table, movement settings, ability targets and draw threshold are in
`default.yaml`. Unsupported or duplicate configuration keys are rejected.

## Board, setup and turn

Use an 8×8 board and the standard chess arrangement: `R N B Q K B N R` on each
back rank, with eight Pikemen immediately ahead. North occupies rows 6–7 and
moves toward row 0; South occupies rows 0–1 and moves toward row 7. North acts
first. Each turn has two phases: optionally rearrange up to **three distinct
existing friendly formations**, then issue exactly one unit's normal order
(move, melee attack, ranged attack or conversion). There are no passes,
promotions, castling or en passant.

A square holds at most two **friendly** units. A formation has members **A** and
**B** occupying opposite cardinal subcells, in one of four arrangements:

| Arrangement | Member A | Member B |
|---|---|---|
| N–S | North | South |
| S–N | South | North |
| W–E | West | East |
| E–W | East | West |

These positions use fixed board coordinates: North is row 0; West is column 0.
They do not rotate the army's facing. Each chosen formation may select any one
new arrangement **once per turn**. Switching axis and swapping members together
is one rearrangement. Swapping identical classes has no physical effect and is
not an action. Identical-class formations canonically label A North/B South or
A West/B East, since those members are interchangeable. Rearrangements do not advance the turn, increment repetition or
alter Commander retreat counts; the normal order is still required.

Moving onto one ally creates an N–S formation: the resident is A, forward toward
the enemy, and the arrival is B, behind (identical classes use the canonical
labels above). Either member can act; only that unit
moves. Leaving or losing a member dissolves the formation; the survivor becomes
a singleton without layout. A newly created formation waits until its owner's
next turn to rearrange. Stationary abilities preserve surviving members' positions.
Opposing units cannot share a square.

## Movement and precedence

A forward step is one square straight forward or forward-diagonally. Pikemen,
Archers, Heavy Infantry and Priestesses normally make one such step. Cavalry
may make one or two forward steps, in any combination. The intermediate square
may be empty or contain **exactly one friendly unit**. That ally stays in place:
passage acts like entering and immediately leaving a formation, within one order.
A full friendly formation or any enemy blocks passage. Cavalry cannot continue
after combat. Alternative paths to one destination are one action.

**Attacks may approach from any direction.** Ordinary melee reaches an adjacent
enemy; Cavalry can take up to two steps in any combination of the eight directions
to reach an enemy, with the same intermediate-square restrictions. Direction
freedom does not grant backward or lateral two-step moves to an empty or friendly
square. Class restrictions still apply: Priestesses use conversion against ordinary
classes. The attack's starting square determines its approach sector.

**Frontal evasion:** when an enemy occupies the square directly one step ahead,
any unit, in either formation slot, may take one sideways step. A front-diagonal
enemy alone does not grant this permission. An empty destination or one ally is
allowed; a full friendly formation blocks it. This is a single step, not an extra
order or a step that can be combined with a Cavalry's two-step quiet move.

While currently in the enemy half (North rows 0–3; South rows 4–7), units except
the Commander may also make a single sideways step. This is a location-dependent
permission, not an ability permanently acquired on first entry. Sideways steps
cannot be combined with a Cavalry's two-step forward move.

A Priestess with any adjacent enemy may instead make a single step in any direction.
A Commander normally moves only forward, even in the enemy half; if any enemy is
within Chebyshev distance two, it may instead step in any direction. Distance is
`max(abs(row difference), abs(column difference))`; intervening units do not
block this proximity trigger. These are mobility triggers, not chess check rules.

**Last-rank exception takes priority:** every unit on the enemy back rank,
including the Commander, may step once in any direction. This prevents an
unthreatened Commander from becoming trapped at the board edge. A unit may expose
its Commander to capture; there is no check or mandatory response to check.

## Single-versus-single melee

Pikemen are specialized melee units: **Pikeman beats Archer in melee**. Archer
can instead kill Pikeman at range. Class outcomes below apply in both attack
directions where a melee attack is permitted. Heavy Infantry beats Pikeman and
Archer; Cavalry beats Archer and Heavy Infantry; Pikeman beats Cavalry.

The row is the attacker. W = attacker survives and defender dies; L = attacker
dies and defender survives; M = both die; S = guarded stance below; — = ordinary melee is not permitted.

<!-- combat-table:start -->
| Attacker / Defender | P | N | B | R | Q | K |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| P | S | W | W | L | W | W |
| N | L | S | W | W | W | W |
| B | L | L | S | L | W | W |
| R | W | L | W | S | W | W |
| Q | — | — | — | — | M | W |
| K | W | W | W | W | W | W |
<!-- combat-table:end -->

P=Pikeman, N=Cavalry, B=Archer, R=Heavy Infantry, Q=Priestess, K=Commander.
Every non-Priestess class can capture a Priestess in melee. The Priestess uses
conversion against other ordinary classes, not an unspecified melee attack.
Commander melee is explicitly attacker-wins. **Capturing a Commander has priority
over same-type mutual death**, including Commander attacking Commander.

## Guarded stance: matching ordinary classes

For Pikeman/Pikeman, Cavalry/Cavalry, Archer/Archer **melee**, and
Infantry/Infantry, use the defender's perspective, with the defender at cell 5:

| 1 · front left | 2 · directly ahead | 3 · front right |
|:---:|:---:|:---:|
| 4 · left flank | **5 · defender** | 6 · right flank |
| 7 · rear left | 8 · directly behind | 9 · rear right |

| Attacker starts in | Outcome |
|---|---|
| 2 | Attacker dies; defender survives |
| 1 or 3 | Attacker and defender both die |
| 4, 6, 7, 8 or 9 | Attacker survives; defender dies |

Facing is fixed by ownership: North faces row 0/rank 8; South faces row 7/rank 1.
South's numbered frame is rotated 180 degrees. Conversion changes facing; moving
sideways or backward does not. Flipping the display does not change facing.
For a two-step Cavalry attack use the starting square, not its intermediate step;
classify row and column differences by sign, including non-diagonal approaches.

**Class counters always come first**, including inside formations and from the
rear. A Cavalry unit loses to a Pikeman in every duel. Layout supplies stance
benefits only when ordinary classes match. Priestess cancellation and Commander
capture retain their special outcomes.

## Melee against formations

Resolve the acting unit against the defenders it encounters. Its source companion
does not fight. There are no combination-specific class-counter overrides and
**no fatigue penalty**. In particular, Cavalry beats Heavy Infantry inside a
formation, and Heavy Infantry beats both Pikemen if it encounters P/P.

Use the original attack sector in the defender's facing frame:

| Defender layout | Attacker starts in | Contact |
|---|---|---|
| N–S | Side flank 4 or 6 | Both defenders simultaneously |
| N–S | Any other sector | Nearest subcell, then a ready reserve if reached |
| E–W | Front arc 1, 2 or 3 | Both simultaneously, braced at guarded stance 2 |
| E–W | Direct rear 8 | Both simultaneously, using rear stance 8 |
| E–W | Side or rear diagonal 4, 6, 7 or 9 | Nearest subcell, then a ready reserve if reached |

Nearest is determined by projection along the formation's axis: a northern source
first contacts the northern member of N–S; a western source first contacts the
western member of E–W. Reverse those for south/east. Member order matters.

For **simultaneous** contact, resolve each defender's duel independently against
the attacker, then apply all deaths together. A defender may die even if its
companion kills the attacker. For **sequential** contact, continue only if the
attacker survives and the first defender dies. The reserve turns to face it and
uses guarded stance 2, but remains bound by class counters. A matching reserve
therefore wins; a Pikeman reserve still loses to Heavy Infantry. Stop the serial
encounter immediately when a Commander is captured.

Examples: matching P against N–S P/P from a side flank kills both defenders;
from the rear it kills the rear Pikeman and dies to the ready reserve. Matching
P against E–W P/P loses to the entire braced front arc, but wins from directly
behind. Cavalry attacking N–S P/B from behind kills an exposed Archer and then
dies to the Pikeman reserve; reversing those subcells lets the Pikeman stop the
attack before the Archer is reached.

If any defender remains, a surviving attacker stays at its original square and
member slot. If all defenders die, a surviving attacker occupies the cleared
square. A dead attacker leaves its source companion intact. Commander exposure
is physical: either A or B can be encountered. Capturing an encountered Commander
wins even if its companion survives or kills the attacker in a simultaneous duel.
There is no permanent shield for a Commander assigned to B.

## Ranged attacks and conversion

An Archer in either slot can fire along any of the eight straight/diagonal rays at distance
one or two. All intervening squares must be empty. The first occupied square
blocks the ray even if it is friendly or an ineligible target. Shooting does not
move the Archer, change its arrangement, or consume its companion's future turn.
A normal shot kills one exposed Archer, Pikeman or Priestess. Physical subcell
projection, as above, determines exposure; the melee braced-front exception does
not apply to arrows. If both members are equally exposed, the shooter chooses
one eligible target. An ineligible nearer member screens the farther one and
blocks that shot. A double-Archer formation in either axis may also shoot Cavalry
or Heavy Infantry. Commanders cannot be shot.

If the chosen target is an Archer, it **returns fire**: the actual target and
shooting Archer both die, whatever the approach or their A/B assignments. Their
companions survive; there is no recursive volley. Other shots remove only the
chosen exposed defender. Ranged return fire is distinct from same-class melee.

A Priestess in either slot may convert an adjacent **solitary** Pikeman, Cavalry,
Archer or Heavy Infantry. Conversion changes ownership in place; it does not move
or rearrange the Priestess. Stacked enemies, Commanders and Priestesses cannot be
converted. Converted units use their new owner's forward direction immediately.

After each normal order, opposing Priestesses in adjacent squares both die
**simultaneously**, whether A or B. Their companions survive and are
left as singletons if necessary. Determine all affected Priestesses before removing any.
A move into adjacency therefore sacrifices both Priestesses. This is automatic,
not a free extra action. A direct Priestess-versus-Priestess melee also kills both.

## Minimal-loss rule

If every available normal order kills at least one of your units **during that action**,
you must choose a normal order minimizing this lexicographic tuple:

1. Own Commander deaths.
2. Number of own units killed.
3. Deaths by class, in preservation order **R > N > B > P > Q**.

Actions tied on the whole tuple are freely selectable. Do not use net material
gain to erase a death. Do not add an opponent-loss tiebreak. This restriction does
not examine an opponent's next move. If any normal order loses no own unit immediately,
all otherwise legal actions remain available, including deliberate sacrifices.
Preparations are excluded from that calculation: a free rearrangement cannot
bypass the mandatory minimal-loss restriction. The AI's numerical evaluation
values are separate from this mandatory order.

## End of the game

After the normal order and simultaneous Priestess removals:

1. A captured Commander loses the game. Commander conversion is not a win condition.
2. A Commander's **third consecutive backward movement** forfeits. Count on that
   army's successive turns; an opponent's turn preserves the count. A backward
   diagonal counts. Moving another unit, or moving the Commander forward or
   sideways, resets its count. A surviving Commander held at its source by a
   remaining defender has not moved backward and resets the count. Counters belong
   to armies and range from zero to three; the third retreat ends the game.
3. An army whose **only remaining unit is its Commander** loses. Being alone on a
   square is fine while any allied unit remains elsewhere. If both armies become
   lone Commanders simultaneously, draw.
4. If the next player has no available normal order, that player loses by stagnation.
5. Otherwise, the **third occurrence** of the same physical unit positions, ownership,
   side to move, and both Commander retreat counters is an automatic draw. Count
   the initial position and completed normal orders only. Equivalent A/B relabelings
   with the same physical arrangement are the same position. Preparations and
   absolute move number are not additional position occurrences.

There is no additional no-progress rule. A simulator's ply budget is a separate
**truncation with no winner**, not a draw and not a material adjudication.
Illegal API actions are rejected by the engine without changing the board; the
training interface records them as a protocol forfeit, never substitutes a move.
Learning rewards are terminal-only and zero-sum: win +1, loss −1, draw 0. Captures
and conversions do not provide farmable bonuses.

## Version compatibility

Rules v4 changes formation combat, exposure and turn structure. Browser saves
carry the rules version; earlier saves are rejected with an explanation instead
of reinterpreting their orders. Training observations have 35 planes, including
four arrangement planes, prepared cells and remaining preparation budget. The
six-field action has nine kinds and 73,728 encoded IDs. Retrain all older models;
keep v4 league results separate. Historical reports describe their original rules.
