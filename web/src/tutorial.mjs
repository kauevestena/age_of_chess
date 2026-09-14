import { studyState } from "./engine.mjs";

function position(units, enemyKing = 0) {
  const board = Array.from({ length: 64 }, () => []);
  board[63] = [6];
  board[enemyKing] = [-6];
  for (const [i, stack] of units) board[i] = stack;
  return studyState(board);
}
export const LESSONS = [
  {
    title: "The first advance",
    text: "Select the Pikeman on e2, then choose e3. Units move one square straight or diagonally forward. Cavalry may take two forward steps along a clear path.",
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
      "Shooting leaves the Archer in place. A clear forward ray reaches one or two squares and strikes only the top unit.",
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
    title: "Claim the crown",
    text: "The enemy Commander is exposed on e5. Send your Pikeman from e4 to capture it. There is no check or checkmate: the capture itself wins.",
    state: () => position([[36, [1]]], 28),
    action: [4, 4, 0, 3, 4, 1],
    success:
      "You are ready to command. Protect your Commander, exploit the counters, and let the field guide answer the finer points.",
  },
];
