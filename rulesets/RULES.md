# Age of Chess – Warfare: rules v5

This is a capture-the-King game, not checkmate chess. The complete executable
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
is one rearrangement. Swapping identical classes with the same veteran status has no physical effect and is
not an action. Identical-class formations with matching veteran status canonically label A North/B South or
A West/B East, since those members are interchangeable. Rearrangements do not advance the turn, increment repetition or
alter either King movement counter; the normal order is still required.

Moving onto one ally creates an N–S formation: the resident is A, forward toward
the enemy, and the arrival is B, behind (identical classes use the canonical
labels above). Either member can act; only that unit
moves. Leaving or losing a member dissolves the formation; the survivor becomes
a singleton without layout. A newly created formation waits until its owner's
next turn to rearrange. Stationary abilities preserve surviving members' positions.
Opposing units cannot share a square.

## Movement and precedence

A forward step is straight or diagonally toward the enemy back rank. Every class
normally moves one such step; Cavalry may take one or two forward steps, bending
between them. Cavalry's intermediate square must be empty or contain exactly one
ally. That ally stays in place. Enemies and full formations block passage, and
Cavalry cannot continue after combat. Alternative paths are one action.

For **attacks only**, armed units can approach from any direction; Cavalry can
use up to two steps. Kings cannot attack. A Priestess's melee targets remain only
another Priestess or a King; it uses conversion against solitary ordinary units.

A non-King unit reaching the enemy back rank by a move or capture permanently
becomes a **veteran**: it can move backward, including backward diagonals, for the
rest of its life. Cavalry retains its two-step reach, using two forward or two
backward steps for a quiet two-step move. A forward/backward zigzag does not grant
a two-square sideways quiet move. Veteran status follows the individual through
formation entry, exit, rearrangement and conversion. Converted veterans move
relative to their new owner. It does not pass to a companion. Non-Kings loaded on
the enemy back rank in a study position receive the ability immediately.

Other quiet movement permissions still apply:

- In the enemy half, non-Kings can step sideways.
- On the enemy back rank, non-Kings can step once in any direction.
- An enemy directly one cell ahead grants a one-square sidestep to any unit,
  even in its home half. A diagonal enemy alone does not grant this exception.
- A Priestess can retreat if an enemy is adjacent; a veteran Priestess retains
  backward movement without that threat.
- A King can retreat **only in peril**: an enemy is within Chebyshev distance two
  (at most one intervening cell), including adjacent and diagonal enemies,
  regardless of blockers. This also permits a sideways step. There is no King
  back-rank exception, and a King never becomes a veteran.

All quiet destinations must be empty or contain one ally. Full cells block them.
Facing follows ownership, never movement direction or display rotation.

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
| K | — | — | — | — | — | — |
<!-- combat-table:end -->

P=Pikeman, N=Cavalry, B=Archer, R=Heavy Infantry, Q=Priestess, K=King.
Pikemen, Cavalry, Archers and Heavy Infantry can capture a Priestess in melee.
A King is **defenseless**: it never attacks or fights back. Every armed class,
including a Priestess, can capture an encountered King. Kings remain immune to
ranged attacks and conversion.

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
benefits only when ordinary classes match. Priestess cancellation and King
capture retain their special outcomes.

## Melee against formations

Resolve the acting unit against the defenders it encounters. Its source companion
does not fight. There are no combination-specific class-counter overrides and
**no fatigue penalty**. In particular, Cavalry beats Heavy Infantry inside a
formation, and Heavy Infantry beats both Pikemen if it encounters P/P.

For formations without a King, and rear attacks against King formations, use the
original attack sector in the defender's facing frame:

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
encounter immediately when a King is captured.

Examples: matching P against N–S P/P from a side flank kills both defenders;
from the rear it kills the rear Pikeman and dies to the ready reserve. Matching
P against E–W P/P loses to the entire braced front arc, but wins from directly
behind. Cavalry attacking N–S P/B from behind kills an exposed Archer and then
dies to the Pikeman reserve; reversing those subcells lets the Pikeman stop the
attack before the Archer is reached.

If any defender remains, a surviving attacker stays at its original square and
member slot. If all defenders die, a surviving attacker occupies the cleared
square. A dead attacker leaves its source companion intact. In a rear attack,
either A or B can expose the King. Capturing it wins even if its companion survives
or kills the attacker in a simultaneous duel.

### The King's formation support

**Every arrangement** grants support to the King's companion. For front and flank
attacks (1, 2, 3, 4, 6), the escort fights first, regardless of subcell. The King is
reached only if the escort dies and the attacker survives. This replaces the
ordinary simultaneous-contact rule for these approaches only.

| Matching ordinary attacker and escort | Outcome |
|---|---|
| Front 1, 2, 3 | Attacker dies; escort and King survive |
| Flank 4, 6 | Attacker and escort die; King survives |
| Rear 7, 8, 9 | Original physical contact and ready-reserve rules, no buff |

**Counters always precede the buff.** Cavalry still loses to Pikeman–King, even
from behind when it encounters the Pikeman. Heavy Infantry defeats a Pikeman
escort, then captures its King if reached. An exposed rear King may be captured
before a countering companion engages. Priestess mutual cancellation is unchanged.
King support never changes ranged exposure, return fire or conversion.

Example: a Pikeman flanking Pikeman–King kills and dies with the escort; the King
survives. This does not automatically end the game if the King has other allies.
King at South is a suggested arrangement, not a restriction. Subcells are fixed
board coordinates; the rear of South's army is North. Players may choose freely.

## Ranged attacks and conversion

An Archer in either slot can fire along any of the eight straight/diagonal rays at distance
exactly one, including a double-Archer power shot. The first occupied square
blocks the ray even if it is friendly or an ineligible target. Shooting does not
move the Archer, change its arrangement, or consume its companion's future turn.
A normal shot kills one exposed Archer, Pikeman or Priestess. Physical subcell
projection, as above, determines exposure; the melee braced-front exception does
not apply to arrows. If both members are equally exposed, the shooter chooses
one eligible target. An ineligible nearer member screens the farther one and
blocks that shot. A double-Archer formation in either axis may also shoot Cavalry
or Heavy Infantry. Kings cannot be shot.

If the chosen target is an Archer, it **returns fire**: the actual target and
shooting Archer both die, whatever the approach or their A/B assignments. Their
companions survive; there is no recursive volley. Other shots remove only the
chosen exposed defender. Ranged return fire is distinct from same-class melee.

A Priestess in either slot may convert an adjacent **solitary** Pikeman, Cavalry,
Archer or Heavy Infantry. Conversion changes ownership in place; it does not move
or rearrange the Priestess. Stacked enemies, Kings and Priestesses cannot be
converted. Converted units use their new owner's forward direction immediately and retain veteran status.

After each normal order, opposing Priestesses in adjacent squares both die
**simultaneously**, whether A or B. Their companions survive and are
left as singletons if necessary. Determine all affected Priestesses before removing any.
A move into adjacency therefore sacrifices both Priestesses. This is automatic,
not a free extra action. A direct Priestess-versus-Priestess melee also kills both.

## Minimal-loss rule

If every available normal order kills at least one of your units **during that action**,
you must choose a normal order minimizing this lexicographic tuple:

1. Own King deaths.
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

1. A captured King loses the game. King conversion is not a win condition.
2. A King's **third consecutive backward movement** forfeits. Backward diagonals
   count. A King's **fourth consecutive movement in any direction** also forfeits.
   Both streaks count across that army's turns; opponent turns preserve them.
   Another unit's normal order resets **both**. A forward or sideways King order
   resets only the backward streak and increments its total movement streak.
   Preparations neither increment nor reset either counter. If both limits are
   reached together, record the backward forfeit reason first.
3. An army reduced to its lone King loses. A King alone on a square is fine while
   allies remain elsewhere. If both armies become lone Kings simultaneously, draw.
4. If the next player has no available normal order, that player loses by stagnation.
5. The third occurrence of the same physical units, ownership, veteran abilities,
   side to move and **both pairs of King counters** draws. Count the initial state
   and completed normal orders only. Equivalent A/B relabelings with unchanged
   physical unit identities are the same position. Same-class units with different
   veteran abilities are distinct. Preparations are not extra occurrences.

There is no additional no-progress rule. A simulator's ply budget is a separate
**truncation with no winner**, not a draw and not a material adjudication.
Illegal API actions are rejected by the engine without changing the board; the
training interface records them as a protocol forfeit, never substitutes a move.
Learning rewards are terminal-only and zero-sum: win +1, loss −1, draw 0. Captures
and conversions do not provide farmable bonuses.

## Version compatibility

Rules v5 changes Kings, ranged distance and permanent unit movement. Browser
saves carry rules version 5; older saves are rejected rather than reinterpreted.
The first 35 training planes retain their v4 meaning. Planes 35–38 contain own
A/B and enemy A/B veteran flags; planes 39–40 contain own/enemy consecutive King
movement counts divided by four. Observations are `(41, 8, 8)`. Actions retain
nine kinds and 73,728 IDs. Retrain older models and keep v5 league results separate.
Legacy internal fields and end reasons containing `commander` remain API names
for the King; the new all-direction limit is `king_move_forfeit`. Historical
reports describe their original rules.
