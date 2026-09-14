import { studyState } from "./engine.mjs";

function position(units, enemyKing = 0) {
  const board = Array.from({ length: 64 }, () => []);
  board[63] = [6];
  board[enemyKing] = [-6];
  for (const [i, stack] of units) board[i] = stack;
  // Each lesson retains supporting units, so it cannot end before its intended order.
  board[62] = [1];
  board[1] = [-1];
  return studyState(board);
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
      "Shots reach one or two squares along any clear straight or diagonal ray. Shooting an Archer causes return fire: both Archers die.",
  },
  {
    title: "Form a company",
    text: "Move the Archer on d3 onto the friendly Archer on e4. Choose “Join formation”. Two friendly units can share a square; the arriving unit goes underneath.",
    state: () =>
      position([
        [43, [3]],
        [36, [3]],
      ]),
    action: [5, 3, 0, 4, 4, 0],
    success:
      "Either stack slot can act. Select Top or Bottom in the unit panel. The top unit receives enemy attacks first.",
  },
  {
    title: "A powerful volley",
    text: "Two Archers occupy e4. Select Bottom in the unit panel, then shoot the Heavy Infantry on e6. A double Archer formation can pierce heavy armor.",
    state: () =>
      position([
        [36, [3, 3]],
        [20, [-4]],
      ]),
    action: [4, 4, 1, 2, 4, 2],
    success:
      "Power shots can kill Cavalry and Heavy Infantry, but never a Commander. A shot removes only the top defender.",
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
      "Priestesses cannot convert stacks, Commanders, or other Priestesses. Adjacent opposing Priestesses both die automatically.",
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
      "The defender held its stance. For matching ordinary classes, front diagonals eliminate both top combatants; a side or rear attack wins. Companions survive.",
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
      "The top Pikeman fell. Its Archer companion holds d4, so your surviving attacker stays on e4. A formation's matching top uses the same stance as a solo defender.",
  },
  {
    title: "Ride through the ranks",
    text: "Select the bottom Cavalry on g2, then ride to e4 through the single ally on f3. One knight can pass through one ally on its first step and continue in the same order.",
    state: () =>
      position([
        [54, [1, 2]],
        [45, [1]],
      ]),
    action: [6, 6, 1, 4, 4, 0],
    success:
      "The intermediate ally and your source companion stayed in place. A full formation or enemy would block passage. Two-step quiet moves still use two forward steps.",
  },
  {
    title: "An answering arrow",
    text: "Select your bottom Archer on e4 and shoot the Archer on e6. The defending Archer returns fire from any direction: both Archers will fall.",
    state: () =>
      position([
        [36, [1, 3]],
        [20, [-3, -1]],
      ]),
    action: [4, 4, 1, 2, 4, 2],
    success:
      "Both actual Archers died; both Pikeman companions survived. Ranged return fire ignores melee stance. Keep supporting units alive: a lone Commander loses, and its third consecutive retreat forfeits.",
  },
  {
    title: "Claim the crown",
    text: "The enemy Commander is exposed on e5. Send your Pikeman from e4 to capture it. There is no check or checkmate: the capture itself wins.",
    state: () => position([[36, [1]]], 28),
    action: [4, 4, 0, 3, 4, 1],
    success:
      "You are ready to command. Protect your Commander, exploit the counters, and let the field guide answer the finer points.",
  },
];
