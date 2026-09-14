# Age of Chess – Warfare: rules v3

This is a capture-the-Commander game, not checkmate chess. The complete executable
combat table, movement settings, ability targets and draw threshold are in
`default.yaml`. Unsupported or duplicate configuration keys are rejected.

## Board, setup and turn

Use an 8×8 board and the standard chess arrangement: `R N B Q K B N R` on each
back rank, with eight Pikemen immediately ahead. North occupies rows 6–7 and
moves toward row 0; South occupies rows 0–1 and moves toward row 7. North acts
first. Each turn consists of exactly one unit's move, melee attack, ranged
attack, or conversion. There are no passes, promotions, castling or en passant.

A square holds at most two **friendly** units, ordered top then bottom. A joining
unit goes underneath the existing unit. Either unit can act; only that unit moves.
Removing the top promotes the bottom. Stack order cannot be changed freely and
stationary abilities preserve it. Stacks of opposing units are never allowed.

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
Archer; Cavalry beats Archer and lone Heavy Infantry; Pikeman beats Cavalry.

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
| 2 | Attacker dies; top defender survives |
| 1 or 3 | Attacker and top defender both die |
| 4, 6, 7, 8 or 9 | Attacker survives; top defender dies |

Facing is fixed by ownership: North faces row 0/rank 8; South faces row 7/rank 1.
South's numbered frame is rotated 180 degrees. Conversion changes facing; moving
sideways or backward does not. Flipping the display does not change facing.
For a two-step Cavalry attack use the starting square, not its intermediate step;
classify row and column differences by sign, including non-diagonal approaches.

Stance applies to both solo units and formations, using the **acting class and
the top defender only**. A matching bottom defender gives no additional defense.
Companions do not change the stance result and survive. Priestess cancellation,
Commander capture, and cross-class counters (especially Pikeman over Archer)
retain their existing outcomes from every approach direction.

## Melee against stacks

Resolve against the top defender once; do not automatically continue against the
bottom. Apply the single-combat table unless one of these exceptions matches:

- Cavalry attacking two Archers tramples both.
- Cavalry attacking a stack with Heavy Infantry on top dies; both defenders live.
  Cavalry's advantage over Heavy Infantry applies only to a solitary defender.
- Heavy Infantry attacking two Pikemen dies together with the top Pikeman;
  the bottom Pikeman survives.

Consequently Cavalry dies against a top Pikeman (including P/P and P/Q), and
Heavy Infantry attacking Archer/X kills the top Archer only. Stack order matters.
The attacker's own bottom unit does not contribute to melee strength.

If any defender remains, promote it to top and **a surviving attacker stays in
its original square and original slot**. If all defenders die, a surviving
attacker moves onto the cleared square. A dead attacker is removed from its
source, promoting any friendly bottom unit. Capture of a top Commander wins
immediately even if another defender survives. A bottom Commander is protected
until it becomes the top defender; attacks cannot select a bottom enemy directly.

## Ranged attacks and conversion

An Archer in either slot can fire along any of the eight straight/diagonal rays at distance
one or two. All intervening squares must be empty. The first occupied square
blocks the ray even if it is friendly or an ineligible target. Shooting does not
move the Archer, change its stack order, or consume its companion's future turn.
A normal shot kills only a top Archer, Pikeman or Priestess. If the source square
contains two Archers, a power shot may also kill top Cavalry or Heavy Infantry.
Commanders cannot be shot. If the target is an Archer, it **returns fire**: the
targeted top Archer and the actual shooting Archer both die, whatever the approach.
Remove the shooter from its selected slot, promoting its companion if needed.
Both companions survive; there is no recursive volley. Other shots kill only the
top defender. Ranged return fire is distinct from same-class melee stance.

A Priestess in either slot may convert an adjacent **solitary** Pikeman, Cavalry,
Archer or Heavy Infantry. Conversion changes ownership in place; it does not move
or reorder the Priestess. Stacked enemies, Commanders and Priestesses cannot be
converted. Converted units use their new owner's forward direction immediately.

After each action, opposing Priestesses in adjacent squares both die
**simultaneously**, whether top or bottom. Their companions survive and are
promoted if necessary. Determine all affected Priestesses before removing any.
A move into adjacency therefore sacrifices both Priestesses. This is automatic,
not a free extra action. A direct Priestess-versus-Priestess melee also kills both.

## Minimal-loss rule

If every available action kills at least one of your units **during that action**,
you must choose an action minimizing this lexicographic tuple:

1. Own Commander deaths.
2. Number of own units killed.
3. Deaths by class, in preservation order **R > N > B > P > Q**.

Actions tied on the whole tuple are freely selectable. Do not use net material
gain to erase a death. Do not add an opponent-loss tiebreak. This restriction does
not examine an opponent's next move. If any action loses no own unit immediately,
all otherwise legal actions remain available, including deliberate sacrifices.
The AI's numerical evaluation values are separate from this mandatory order.

## End of the game

After the action and simultaneous Priestess removals:

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
4. If the next player has no available action, that player loses by stagnation.
5. Otherwise, the **third occurrence** of the same ordered board, ownership,
   side to move, and both Commander retreat counters is an automatic draw. Count
   the initial position; absolute move number is not part of the position.

There is no additional no-progress rule. A simulator's ply budget is a separate
**truncation with no winner**, not a draw and not a material adjudication.
Illegal API actions are rejected by the engine without changing the board; the
training interface records them as a protocol forfeit, never substitutes a move.
Learning rewards are terminal-only and zero-sum: win +1, loss −1, draw 0. Captures
and conversions do not provide farmable bonuses.

## Version compatibility

Rules v3 changes legal actions and combat outcomes. Browser saves carry the rules
version; v2 saves are rejected with an explanation rather than reinterpreted.
Training observations now have 29 planes, including each army's retreat counter
(normalized by three). Retrain older 12/27-plane models; keep v3 league results
separate from earlier rules. Historical v2 reports describe their original engine.
