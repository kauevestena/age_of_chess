# Age of Chess – Warfare: rules v2

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
may make one or two forward steps, in any combination. Every intermediate square
must be **empty**: Cavalry cannot jump, pass through a friendly unit, or continue
moving after combat. An adjacent forward enemy can be attacked with the first
step. Alternative paths to the same destination are one action, not extra chances.

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
dies and defender survives; M = both die; — = ordinary melee is not permitted.

<!-- combat-table:start -->
| Attacker / Defender | P | N | B | R | Q | K |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| P | M | W | W | L | W | W |
| N | L | M | W | W | W | W |
| B | L | L | M | L | W | W |
| R | W | L | W | M | W | W |
| Q | — | — | — | — | M | W |
| K | W | W | W | W | W | W |
<!-- combat-table:end -->

P=Pikeman, N=Cavalry, B=Archer, R=Heavy Infantry, Q=Priestess, K=Commander.
Every non-Priestess class can capture a Priestess in melee. The Priestess uses
conversion against other ordinary classes, not an unspecified melee attack.
Commander melee is explicitly attacker-wins. **Capturing a Commander has priority
over same-type mutual death**, including Commander attacking Commander.

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

An Archer in either slot can fire along any of the three forward rays at distance
one or two. All intervening squares must be empty. The first occupied square
blocks the ray even if it is friendly or an ineligible target. Shooting does not
move the Archer, change its stack order, or consume its companion's future turn.
A normal shot kills only a top Archer, Pikeman or Priestess. If the source square
contains two Archers, a power shot may also kill top Cavalry or Heavy Infantry.
Every shot kills at most one unit. Commanders cannot be shot.

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
2. If the next player has no available action, that player loses by stagnation.
3. Otherwise, the **third occurrence** of the same ordered board, ownership and
   side to move is an automatic draw. Count the initial position. Converted
   ownership and stack order are part of the position; absolute move number is not.

There is no additional no-progress rule. A simulator's ply budget is a separate
**truncation with no winner**, not a draw and not a material adjudication.
Illegal API actions are rejected by the engine without changing the board; the
training interface records them as a protocol forfeit, never substitutes a move.
Learning rewards are terminal-only and zero-sum: win +1, loss −1, draw 0. Captures
and conversions do not provide farmable bonuses.
