import { legalActions, transition, code, side, melee } from "./engine.mjs";
import { RULES } from "./rules.mjs";

export function evaluate(state) {
  if (state.winner !== null)
    return state.winner === 0
      ? 0
      : state.winner === state.turn
        ? 100000
        : -100000;
  let result = 0;
  state.board.forEach((sq, i) =>
    sq.forEach((u) => {
      const c = code(u),
        sign = side(u),
        row = Math.floor(i / 8),
        column = i % 8;
      const advance = sign === 1 ? 7 - row : row;
      const center = 3.5 - Math.abs(column - 3.5);
      let value = RULES.pieces[c].value * 100;
      if (c !== "K") value += advance * 4 + center * 2;
      else value += sq.length === 2 && sq[1] === u ? 30 : 0;
      if (
        c === "B" &&
        sq.length === 2 &&
        code(sq[0]) === "B" &&
        code(sq[1]) === "B"
      )
        value += 25;
      result += sign * value;
    }),
  );
  return result * state.turn;
}

function priority(state, a) {
  const [r, c, slot, rr, cc, kind] = a,
    actor = state.board[r * 8 + c][slot],
    dst = state.board[rr * 8 + cc];
  const val = (u) => (u ? RULES.pieces[code(u)].value * 100 : 0);
  if (kind === 3) return 2 * val(dst[0]) + 15;
  if (kind === 2) return val(dst[0]) + 10;
  if (kind === 1) {
    const [alive, top, bottom] = melee(actor, ...dst);
    return (
      (top ? 0 : val(dst[0])) +
      (bottom ? 0 : val(dst[1])) -
      (alive ? 0 : val(actor))
    );
  }
  return (r - rr) * state.turn + (3.5 - Math.abs(cc - 3.5)) / 10;
}

/** Time-bounded full-width iterative alpha-beta; no network or training server. */
export function chooseAction(state, difficulty = "knight", options = {}) {
  const random = options.random || Math.random;
  const legal = legalActions(state);
  if (!legal.length) return { action: null, depth: 0, nodes: 0 };
  const settings = { squire: [1, 80], knight: [2, 450], marshal: [5, 1300] }[
    difficulty
  ] || [2, 450];
  const deadline = performance.now() + (options.budgetMs ?? settings[1]);
  let nodes = 0,
    completeDepth = 0;
  let best = legal[Math.floor(random() * legal.length)];
  const tie = new Map(
    legal.map((a) => [
      a.join(),
      random() * (difficulty === "squire" ? 35 : 0.5),
    ]),
  );
  const ordered = legal
    .slice()
    .sort((a, b) => priority(state, b) - priority(state, a));
  function search(s, depth, alpha, beta, distance) {
    nodes++;
    if ((nodes & 31) === 0 && performance.now() > deadline) throw "budget";
    if (s.winner !== null)
      return s.winner === 0
        ? 0
        : s.winner === s.turn
          ? 100000 - distance
          : -100000 + distance;
    if (!depth) return evaluate(s);
    const moves = legalActions(s).sort(
      (a, b) => priority(s, b) - priority(s, a),
    );
    let value = -Infinity;
    for (const a of moves) {
      const score = -search(
        transition(s, a, true).state,
        depth - 1,
        -beta,
        -alpha,
        distance + 1,
      );
      value = Math.max(value, score);
      alpha = Math.max(alpha, score);
      if (alpha >= beta) break;
    }
    return value;
  }
  for (let depth = 1; depth <= settings[0]; depth++) {
    let candidate = best,
      value = -Infinity;
    try {
      ordered.sort(
        (a, b) => (b.join() === best.join()) - (a.join() === best.join()),
      );
      for (const a of ordered) {
        if (depth > 1 && performance.now() > deadline) throw "budget";
        const score =
          -search(
            transition(state, a, true).state,
            depth - 1,
            -Infinity,
            Infinity,
            1,
          ) + tie.get(a.join());
        if (score > value) {
          value = score;
          candidate = a;
        }
      }
      best = candidate;
      completeDepth = depth;
      if (value > 99000) break;
    } catch (e) {
      if (e !== "budget") throw e;
      break;
    }
  }
  return { action: best, depth: completeDepth, nodes };
}
