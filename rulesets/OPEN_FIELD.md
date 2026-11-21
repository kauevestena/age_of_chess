# Age of Chess – Open Field

Open Field is a second ruleset beside the standard Warfare rules (`RULES.md`). Choose it
under **Rules** in the browser's war camp, or load `rulesets/open_field.yaml` in Python
(`Engine("rulesets/open_field.yaml")`). Every rule in `RULES.md` applies except the
changes below. The executable settings are in `open_field.yaml`, which the loader checks
for consistency with this mode.

## No formations

A square holds at most one unit. Units never share a square, so there are no
formations, no A/B members, no rearrangements before the order, no formation contact
rules and no royal escort. Every turn is one normal order: move, melee attack, ranged
attack or Warp.

## Reach

| Unit | Reach (squares) |
|---|---:|
| Pikeman, Archer, Heavy Infantry, Priestess | 2 |
| Cavalry | 3 |
| King | 1 |

**Moving.** A unit takes one step per square of reach, up to its reach. Each step
follows the movement rule of `RULES.md` from the square it starts on: onto the next row
toward the enemy King's row, straight or diagonally, or along that row toward him once
level with him. Squares passed on the way must be empty or hold a friendly unit, so a
unit can pass its own army. An enemy blocks the path. The move ends on an **empty**
square, never on a friendly unit.

**Attacking.** A unit attacks at the same reach. The path may turn in any direction and,
as for movement, passes only empty squares or friendly units. The attack ends on the
enemy square. A surviving attacker that clears the square occupies it.

**Combat** is unchanged: class counters first, then guarded stance for matching ordinary
classes, judged from the square the attack started on. A matching unit attacked from
straight ahead therefore holds its front even when the attacker started two squares away.

## The King

The King keeps a reach of one. It moves forward, straight or diagonally, and may step in
any direction only when an enemy is within two squares. It never attacks. The forfeit
limits are unchanged: the third consecutive backward King move or the fourth consecutive
King move loses.

## Priestess

A Priestess with an enemy on a neighbouring square may take **both** of her steps in any
direction. She attacks only a Priestess or a King, at her full reach. Warp is unchanged:
an enemy Pikeman, Cavalry, Archer or Heavy Infantry within two squares, moved to any
empty square. Every target stands alone, since there are no formations.

## Archers

An Archer shoots **up to two squares** along any straight or diagonal ray. The first
occupied square stops the arrow, whoever stands there.

**Long-shot cooldown.** After an Archer shoots a target two squares away, that Archer may
not shoot two squares again during its army's next two turns. It may shoot again two
squares away on the third. Shots at an adjacent square are never limited, and other
Archers are unaffected. The cooldown stays with the Archer when it moves or is warped. At
the table, remember which Archer made a long shot in your last two orders; the browser
shows an hourglass with the turns left. An Archer killed by return fire has nothing to
wait for.

The **power shot** against Cavalry or Heavy Infantry needs a **friendly Archer on any of
the eight squares around the shooter**, instead of two Archers in one formation. It reaches
two squares like other arrows and follows the same cooldown. The supporting
Archer does not need to see the target. Kings can never be shot, and return fire between
Archers is unchanged.

## Interfaces

The action tuple and the 73,728 action IDs are unchanged: `slot` is always 0, and action
kinds 4–8 (arrangements and shooting a B member) never occur. Observations have the shape
`(38, 8, 8)` in both rulesets: plane 37 holds each Archer's remaining long-shot cooldown
divided by two (always zero in Warfare). The second-member and arrangement planes stay
zero and the remaining-budget plane is 0. Repetition counts an Archer's cooldown as part of
the position. Browser saves record the ruleset (`config.ruleset`); saves without it are
Warfare games.
