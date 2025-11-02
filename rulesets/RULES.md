# Age of Chess – Warfare (Rulesheet)

This document describes the *human-readable* rules. The simulator reads the mirrored YAML in `rulesets/default.yaml`.

## Board and Sides
- 8×8 board; North (White) vs South (Black). North's **forward** is up (toward row 0), South's forward is down.
- Squares can contain up to **two friendly units** (a *stack*). One unit of a stack may move off on your turn.

## Pieces
- **Pikeman (Pawn)**: 1 tile forward (including forward-diagonals). Beats Cavalry; loses to Heavy Infantry; mutual vs Pikeman; loses (in melee) to Archer.
- **Cavalry (Knight)**: up to 2 forward steps per turn (any forward combination). Beats Archers and lone Heavy Infantry; dies to Pikeman.
- **Archer (Bishop)**: 1 tile forward. Ranged shot (2 forward tiles, line-of-sight) kills Archers, Pikemen, Priestesses; not effective vs Cavalry/Heavy Infantry.
  - **Power Shot**: if two Archers are stacked, their ranged attack can kill Cavalry or Heavy Infantry (top-only if the target is a stack).
- **Heavy Infantry (Rook)**: 1 tile forward. Beats Archers and Pikemen; mutual vs Heavy Infantry. Loses to two stacked Pikemen (discipline wall).
- **Priestess (Queen)**: converts an adjacent solitary enemy (not King or another Priestess). Priestess vs Priestess adjacent → both die. May move sideways/back when an enemy is adjacent.
- **Commander (King)**: if not threatened (no enemy within 2 tiles), can only move forward; if threatened, may move sideways/back. Capture/convert the enemy King to win.

## Turn & Momentum
- You must move **exactly one unit** or use **one ability** on your turn.
- **Minimal-loss rule**: if all legal moves lose material this turn, play one that minimizes losses by: (1) King safety; (2) fewest losses; (3) preserve higher value (HI > Cav > Archer > Pike > Priestess); (4) free choice on ties.
- **No promotions**.

## Combat Resolution (single vs single)
- **HI > Archer, Pikeman**.  
- **Cav > Archer, lone HI**; **Cav dies to Pike**.  
- **Archer shot** kills **Archer/Pikeman/Priestess**; no effect on **Cav/HI**.  
- **Same-type** melee → both die.  
- Any → **King**: capture wins.

## Versus Stacks
- Resolve against **top** defender first.
- Defaults:
  - Cav vs **(Pike+Pike)** → Cav dies.
  - Cav vs **(Archer+Archer)** → Cav wins (tramples both).
  - Cav vs **(Pike+Priestess)** → Cav dies.
  - HI vs **(Pike+Pike)** → HI and top Pike die; bottom Pike remains.
  - HI vs **(Archer+X)** → Archer dies; bottom X remains.
  - Single Archer shot vs stack → top only.
  - **Power Shot (2 Archers)** can kill **Cav/HI**; vs stack, top only.

## Victory
- Capture/convert the enemy King, or
- Opponent has no legal move (stagnation).
