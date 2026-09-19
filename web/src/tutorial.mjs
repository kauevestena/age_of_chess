import { studyState } from "./engine.mjs";

function position(units, enemyKing = 0, layouts = {}) {
  const board = Array.from({ length: 64 }, () => []);
  board[63] = [6];
  board[enemyKing] = [-6];
  for (const [i, stack] of units) board[i] = stack;
  // Each lesson retains supporting units, so it cannot end before its intended order.
  board[62] = [1];
  board[1] = [-1];
  const state = studyState(board);
  for (const [cell, layout] of Object.entries(layouts)) state.layout[Number(cell)] = layout;
  return studyState(board, 1, [0, 0], state.layout);
}
export const LESSONS = [
  {
    title: "The first advance",
    text: "Select the Pikeman on e2, then choose e3. Units move one square straight or diagonally forward. Cavalry may take two forward steps through an empty square or one ally.",
    state: () => position([[52, [1]]]),
    action: [6, 4, 0, 5, 4, 0],
    success:
      "An army advances one order at a time. Only the selected unit acts.",
  },
  {
    title: "Steel before strings",
    text: "Your Pikeman on e4 can defeat the Archer on e5 in melee. Select e5 and confirm the attack. Combat follows class counters, with no dice rolls.",
    state: () =>
      position([
        [36, [1]],
        [28, [-3]],
      ]),
    action: [4, 4, 0, 3, 4, 1],
    success:
      "Pikemen are melee specialists. They defeat Archers and Cavalry, but lose to Heavy Infantry.",
  },
  {
    title: "Keep your distance",
    text: "Your Archer on e4 faces a Pikeman on e5. Choose “Ranged attack” when you select the target: melee would kill your Archer.",
    state: () =>
      position([
        [36, [3]],
        [28, [-1]],
      ]),
    action: [4, 4, 0, 3, 4, 2],
    success:
      "Shots reach one square along any clear straight or diagonal ray. Shooting an Archer causes return fire: both Archers die.",
  },
  {
    title: "Form a company",
    text: "Move the Archer on d3 onto the friendly Archer on e4. Choose “Join formation”. Two friendly units can share a square; the arriving unit becomes B, behind resident A in an N–S formation.",
    state: () =>
      position([
        [43, [3]],
        [36, [3]],
      ]),
    action: [5, 3, 0, 4, 4, 0],
    success:
      "Either member can act. Select A or B in the unit panel. Arrange up to three existing formations before your next normal order; approach direction determines who is exposed.",
  },
  {
    title: "A powerful volley",
    text: "Two Archers occupy e4. Select B in the unit panel, then shoot the Heavy Infantry on e5. A double Archer formation can pierce heavy armor.",
    state: () =>
      position([
        [36, [3, 3]],
        [28, [-4]],
      ]),
    action: [4, 4, 1, 3, 4, 2],
    success:
      "Power shots can kill Cavalry and Heavy Infantry, but never a King. A shot removes one exposed defender; you may choose when both are exposed.",
  },
  {
    title: "Win an allegiance",
    text: "Your Priestess on e4 can convert the solitary Cavalry on d4. Select d4 and confirm conversion. The unit will fight for your banner.",
    state: () =>
      position([
        [36, [5]],
        [35, [-2]],
      ]),
    action: [4, 4, 0, 4, 3, 3],
    success:
      "Priestesses cannot convert stacks, Kings, or other Priestesses. Adjacent opposing Priestesses both die automatically.",
  },
  {
    title: "A guarded front",
    text: "Your Pikeman on e4 faces a matching Pikeman formation on e5. Try the melee preview, then confirm this training sacrifice: attacking directly ahead (cell 2) loses to the guarded defender.",
    state: () =>
      position([
        [36, [1]],
        [28, [-1, -1]],
      ]),
    action: [4, 4, 0, 3, 4, 1],
    success:
      "The defender held its stance. For matching ordinary classes, a guarded front holds. An E–W formation also braces its front diagonals. Class counters still take priority.",
  },
  {
    title: "Step out of the spear line",
    text: "An enemy stands directly ahead of your Pikeman on e3. Step sideways to f3 and join the Archer. The full friendly formation on d3 cannot admit another unit.",
    state: () =>
      position([
        [44, [1]],
        [36, [-1]],
        [43, [1, 1]],
        [45, [3]],
      ]),
    action: [5, 4, 0, 5, 5, 0],
    success:
      "Frontal contact grants one sideways step, even in your own half. Empty squares and single allies are valid destinations; full formations block evasion.",
  },
  {
    title: "Turn the flank",
    text: "Your Pikeman on e4 can strike the matching Pikeman on d4 from its flank. Attack d4: matching classes favor the attacker from cells 4, 6, 7, 8 and 9.",
    state: () =>
      position([
        [36, [1]],
        [35, [-1, -3]],
      ]),
    action: [4, 4, 0, 4, 3, 1],
    success:
      "Both exposed defenders fell: the flank defeats a matching Pikeman, and Pikemen always beat Archers in melee. Your Pikeman takes d4.",
  },
  {
    title: "Ride through the ranks",
    text: "Select Cavalry B on g2, then ride to e4 through the single ally on f3. One knight can pass through one ally on its first step and continue in the same order.",
    state: () =>
      position([
        [54, [1, 2]],
        [45, [1]],
      ]),
    action: [6, 6, 1, 4, 4, 0],
    success:
      "The intermediate ally and your source companion stayed in place. A full formation or enemy would block passage. Veteran Cavalry can also take two backward steps after reaching the enemy back rank.",
  },
  {
    title: "An answering arrow",
    text: "Select Archer B on e4 and shoot the Archer on e5. The defending Archer returns fire from any direction: both Archers will fall.",
    state: () =>
      position([
        [36, [1, 3]],
        [28, [-3, -1]],
      ]),
    action: [4, 4, 1, 3, 4, 2],
    success:
      "Both actual Archers died; both Pikeman companions survived. Ranged return fire ignores melee stance. Keep supporting units alive: a lone King loses, and its third consecutive retreat forfeits.",
  },
  {
    title: "Arrange the company",
    text: "Select the mixed formation on e4. In Formation arrangement, choose A W · B E to turn the column into a line. This is a preparation, not a normal order.",
    state: () => position([[36, [1, 4]]]),
    action: [4, 4, 0, 4, 4, 6],
    success: "A now holds the west subcell and B the east. In a battle you must still issue one normal order. You may rearrange up to three distinct formations; no layout reverses a unit counter.",
  },
  {
    title: "Counters outrank surprise",
    text: "Your Cavalry on e5 approaches a Pikeman on e4 from behind. Preview and confirm this training sacrifice: a rear attack never overturns the Pikeman’s counter.",
    state: () => position([[28, [2]], [36, [-1]]]),
    action: [3, 4, 0, 4, 4, 1],
    success: "The Pikeman survives and the Cavalry falls. Class counters always come before facing or formation benefits.",
  },
  {
    title: "Return from the far rank",
    text: "Your Pikeman on e8 has reached the enemy back rank. Move diagonally backward to f7. The backward ability remains for the rest of its life.",
    state: () => position([[4, [1]]]),
    action: [0, 4, 0, 1, 5, 0],
    success: "The ↶ veteran mark follows this unit. It can still move backward after leaving the far rank, joining formations, or changing allegiance. Kings never gain this ability.",
  },
  {
    title: "The royal escort holds",
    text: "The enemy Pikeman on e5 accompanies its King. Attack diagonally from d4: the King's support turns this matching front-diagonal attack into a defender victory.",
    state: () => position([[35, [1]], [28, [-1, -6]]], 28),
    action: [4, 3, 0, 3, 4, 1],
    success: "Your Pikeman fell; both defenders survived. Any arrangement grants the buff, but Heavy Infantry would still defeat the Pikeman and then capture the King.",
  },
  {
    title: "A life for the crown",
    text: "Attack the Pikeman–King formation on d4 from e4. From the flank, matching Pikemen cancel each other; the King is spared by its escort.",
    state: () => position([[36, [1]], [35, [-1, -6]]], 35),
    action: [4, 4, 0, 4, 3, 1],
    success: "Only the two Pikemen fell. The King survives this exchange. Rear attacks keep the original formation geometry; class counters still come first.",
  },
  {
    title: "The fourth royal order",
    text: "Your King on h1 has already moved on three consecutive army turns. Move it to g2 to see the forfeit. In a real battle, order another unit instead to reset both counters.",
    state: () => { const s = position([]); return studyState(s.board, 1, [0, 0], s.layout, [], s.veteran, [3, 0]); },
    action: [7, 7, 0, 6, 6, 0],
    success: "The fourth King movement forfeits, even without retreating. The separate third-backward-movement rule also remains. Preparations never reset either counter.",
  },
  {
    title: "Claim the crown",
    text: "The enemy King is exposed on e5. Send your Pikeman from e4 to capture it. There is no check or checkmate: the capture itself wins.",
    state: () => position([[36, [1]]], 28),
    action: [4, 4, 0, 3, 4, 1],
    success:
      "You are ready to command. Protect your King, exploit the counters, and let the field guide answer the finer points.",
  },
];
