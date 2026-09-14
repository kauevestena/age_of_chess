import { legalOrders, unfilteredActions, preparationActions, transition, code, side, melee, isShot, shotSlot } from "./engine.mjs";
import { RULES } from "./rules.mjs";
import { canonicalLayout } from "./formations.mjs";

export function evaluate(state) {
  if (state.winner !== null)
    return state.winner === 0
      ? 0
      : state.winner === state.turn
        ? 100000
        : -100000;
  let result = 0;
  state.board.forEach((sq, i) =>
    sq.forEach((u, slot) => {
      const c = code(u),
        sign = side(u),
        row = Math.floor(i / 8),
        column = i % 8;
      const advance = sign === 1 ? 7 - row : row;
      const center = 3.5 - Math.abs(column - 3.5);
      let value = RULES.pieces[c].value * 100;
      if (c !== "K") value += advance * 4 + center * 2;
      if (state.veteran[i][slot]) value += 20;
      if (c === "K" && sq.length === 2) value += 35;
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
  if (isShot(kind)) {
    const target = dst[shotSlot(kind)];
    return val(target) - (code(target) === "B" ? val(actor) : 0) + 10;
  }
  if (kind === 1) {
    const [alive, top, bottom] = melee(
      actor,
      dst[0],
      dst[1],
      r * 8 + c,
      rr * 8 + cc,
      state.layout[rr * 8 + cc],
    );
    return (
      (top ? 0 : val(dst[0])) +
      (bottom ? 0 : val(dst[1])) -
      (alive ? 0 : val(actor))
    );
  }
  return (r - rr) * state.turn + (3.5 - Math.abs(cc - 3.5)) / 10;
}

/** Search normal orders, then prepare persistent formations against immediate threats.
 * Layout planning is bounded; the search does not enumerate every compound turn.
 */
export function chooseAction(state, difficulty = "knight", options = {}) {
  const random = options.random || Math.random;
  const legal = legalOrders(state);
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
    const moves = legalOrders(s).sort(
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
  return { action: best, preparations: planPreparations(state, best), depth: completeDepth, nodes };
}


export function planPreparations(state, order) {
  const options = preparationActions(state);
  if (!options.length) return [];
  const after = transition(state, order, true).state;
  if (after.winner !== null) return [];
  const eligible = new Set(options.map(a => a[0] * 8 + a[1]).filter(i =>
    state.board[i].join() === after.board[i].join() && state.veteran[i].join() === after.veteran[i].join()));
  const scores = new Map([...eligible].map(i => [i, [0, 0, 0, 0]]));
  const val = u => RULES.pieces[code(u)].value * 100;
  for (let layout = 0; layout < 4; layout++) {
    const view = { ...after, layout: [...after.layout] };
    for (const i of eligible) view.layout[i] = canonicalLayout(state.board[i], layout, state.veteran[i]);
    const risks = new Map();
    for (const action of unfilteredActions(view)) {
      const [r, c, slot, rr, cc, kind] = action, to = rr * 8 + cc;
      if (!eligible.has(to) || !(kind === 1 || isShot(kind))) continue;
      const dst = view.board[to], actor = view.board[r * 8 + c][slot];
      const lost = isShot(kind) ? val(dst[shotSlot(kind)])
        : melee(actor, dst[0], dst[1], r * 8 + c, to, view.layout[to]).slice(1)
          .reduce((sum, alive, i) => sum + (alive || !dst[i] ? 0 : val(dst[i])), 0);
      const risk = Math.max(0, priority(view, action)) + .15 * lost;
      const previous = risks.get(to) || [0, 0];
      risks.set(to, [Math.max(previous[0], risk), previous[1] + risk]);
    }
    for (const i of eligible) {
      const [worst, sum] = risks.get(i) || [0, 0];
      scores.get(i)[layout] = worst + .01 * sum;
    }
  }
  const improvements = new Map();
  for (const action of options) {
    const i = action[0] * 8 + action[1];
    if (!eligible.has(i)) continue;
    const values = scores.get(i), gain = values[state.layout[i]] - values[action[5] - 4];
    if (gain > (improvements.get(i)?.gain || 0) + 1e-9) improvements.set(i, { action, gain });
  }
  return [...improvements.values()].sort((a, b) => b.gain - a.gain)
    .slice(0, RULES.formation_rearrangements - state.prepared.length).map(x => x.action);
}
