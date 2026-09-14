import { RULES } from "./rules.mjs";

// North is +1, South is -1. Each square is [top, bottom], signed class IDs.
export const CODES = "PNBRQK";
export const code = (unit) => CODES[Math.abs(unit) - 1];
export const side = (unit) => Math.sign(unit);
export const label = (unit) => RULES.pieces[code(unit)].label;
export const squareName = (index) =>
  "abcdefgh"[index % 8] + (8 - Math.floor(index / 8));
export const actionKey = (action) => action.join(",");
export const positionKey = (state) =>
  `${state.turn}|${state.board.map((sq) => sq.join(",")).join(";")}`;
const inside = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
const directions = [-1, 0, 1].flatMap((r) =>
  [-1, 0, 1].filter((c) => r || c).map((c) => [r, c]),
);
const lex = (a, b) => {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
};

export function initialState() {
  const board = Array.from({ length: 64 }, () => []);
  for (const sign of [1, -1]) {
    const back = sign === 1 ? 7 : 0,
      pawns = sign === 1 ? 6 : 1;
    [..."RNBQKBNR"].forEach((c, col) => {
      board[back * 8 + col] = [sign * (CODES.indexOf(c) + 1)];
      board[pawns * 8 + col] = [sign];
    });
  }
  return studyState(board);
}

export function cloneState(state) {
  return {
    ...state,
    board: state.board.map((s) => [...s]),
    counts: { ...state.counts },
  };
}

export function studyState(board, turn = 1) {
  const state = {
    board: board.map((s) => [...s]),
    turn,
    ply: 0,
    winner: null,
    reason: null,
    counts: {},
  };
  validateState(state);
  priestessDeaths(state, []);
  state.counts[positionKey(state)] = 1;
  adjudicate(state);
  return state;
}

export function validateState(s) {
  if (
    !s ||
    ![1, -1].includes(s.turn) ||
    !Array.isArray(s.board) ||
    s.board.length !== 64
  )
    throw Error("Invalid board");
  const special = {};
  for (const sq of s.board) {
    if (
      !Array.isArray(sq) ||
      sq.length > 2 ||
      sq.some((u) => !Number.isInteger(u) || !u || Math.abs(u) > 6)
    )
      throw Error("Invalid unit");
    if (sq.length === 2 && side(sq[0]) !== side(sq[1]))
      throw Error("Mixed stack");
    for (const u of sq)
      if (Math.abs(u) >= 5 && (special[u] = (special[u] || 0) + 1) > 1)
        throw Error("Duplicate Commander or Priestess");
  }
  return true;
}

export function melee(actor, top, bottom) {
  const a = code(actor),
    d = code(top),
    b = bottom ? code(bottom) : null;
  if (side(actor) === side(top)) throw Error("Friendly melee");
  if (d === "K") return [true, false, !!bottom];
  if (bottom)
    for (const match of [b, "*"]) {
      const rule = RULES.combat.stacks.find(
        (r) => r.attacker === a && r.top === d && r.bottom === match,
      );
      if (rule) return [...rule.outcome];
    }
  const result = RULES.combat.single[a][d];
  if (result === "illegal") throw Error("Forbidden melee");
  return [result === "win", result === "lose", !!bottom];
}

function enemyNear(state, r, c, owner, radius) {
  for (let rr = Math.max(0, r - radius); rr <= Math.min(7, r + radius); rr++)
    for (
      let cc = Math.max(0, c - radius);
      cc <= Math.min(7, c + radius);
      cc++
    ) {
      const top = state.board[rr * 8 + cc][0];
      if (top && side(top) !== owner) return true;
    }
  return false;
}

export function unfilteredActions(state) {
  if (state.winner !== null) return [];
  const actions = new Map(),
    owner = state.turn;
  state.board.forEach((sq, index) =>
    sq.forEach((unit, slot) => {
      if (side(unit) !== owner) return;
      const r = Math.floor(index / 8),
        c = index % 8;
      const spec = RULES.pieces[code(unit)],
        movement = spec.move;
      const dirs = movement.steps.map(([dr, dc]) => [dr * owner, dc]);
      const add = (rr, cc, kind) => {
        const a = [r, c, slot, rr, cc, kind];
        actions.set(actionKey(a), a);
      };
      const destination = (rr, cc) => {
        if (!inside(rr, cc)) return;
        const dst = state.board[rr * 8 + cc];
        if (!dst.length || (side(dst[0]) === owner && dst.length === 1))
          add(rr, cc, 0);
        else if (
          side(dst[0]) !== owner &&
          RULES.combat.single[code(unit)][code(dst[0])] !== "illegal"
        )
          add(rr, cc, 1);
      };
      for (const [dr, dc] of dirs) {
        const rr = r + dr,
          cc = c + dc;
        if (!inside(rr, cc)) continue;
        destination(rr, cc);
        if (movement.max_steps === 2 && !state.board[rr * 8 + cc].length)
          for (const [dr2, dc2] of dirs) destination(rr + dr2, cc + dc2);
      }
      let extra = [];
      if (movement.last_rank_all_directions && r === (owner === 1 ? 0 : 7))
        extra = directions;
      else if (
        movement.retreat_trigger !== "none" &&
        enemyNear(
          state,
          r,
          c,
          owner,
          movement.retreat_trigger === "adjacent_enemy"
            ? 1
            : movement.threat_radius,
        )
      )
        extra = directions;
      else if (
        movement.attack_field_sideways &&
        (owner === 1
          ? r < RULES.board.attack_field_depth
          : r >= 8 - RULES.board.attack_field_depth)
      )
        extra = [
          [0, -1],
          [0, 1],
        ];
      for (const [dr, dc] of extra) destination(r + dr, c + dc);
      for (const ability of spec.abilities) {
        if (ability.name === "convert") {
          for (const [dr, dc] of directions) {
            const rr = r + dr,
              cc = c + dc;
            if (!inside(rr, cc)) continue;
            const dst = state.board[rr * 8 + cc];
            if (
              dst.length === 1 &&
              side(dst[0]) !== owner &&
              ability.targets.includes(code(dst[0]))
            )
              add(rr, cc, 3);
          }
        } else {
          if (
            ability.requires_stack_size === 2 &&
            !(sq.length === 2 && sq.every((u) => code(u) === "B"))
          )
            continue;
          for (const dc of [-1, 0, 1])
            for (let dist = 1; dist <= ability.range; dist++) {
              const rr = r - owner * dist,
                cc = c + dc * dist;
              if (!inside(rr, cc)) break;
              const dst = state.board[rr * 8 + cc];
              if (dst.length) {
                if (
                  side(dst[0]) !== owner &&
                  ability.targets.includes(code(dst[0]))
                )
                  add(rr, cc, 2);
                break;
              }
            }
        }
      }
    }),
  );
  return [...actions.values()].sort(lex);
}

function ownDeaths(state, action) {
  const [r, c, slot, rr, cc, kind] = action,
    actor = state.board[r * 8 + c][slot];
  let arrives = kind === 0;
  if (kind === 1) {
    const [alive, top, bottom] = melee(actor, ...state.board[rr * 8 + cc]);
    if (!alive) return [code(actor)];
    arrives = !top && !bottom;
  }
  if (
    code(actor) === "Q" &&
    arrives &&
    directions.some(
      ([dr, dc]) =>
        inside(rr + dr, cc + dc) &&
        state.board[(rr + dr) * 8 + cc + dc].includes(-side(actor) * 5),
    )
  )
    return ["Q"];
  return [];
}

export function legalActions(state) {
  const actions = unfilteredActions(state);
  if (!RULES.minimal_loss.enabled || !actions.length) return actions;
  const scored = [];
  for (const a of actions) {
    const dead = ownDeaths(state, a);
    if (!dead.length) return actions;
    scored.push([
      ["K", ...RULES.minimal_loss.preserve_order].map(
        (c) => dead.filter((d) => c === d).length,
      ),
      a,
    ]);
    scored.at(-1)[0].splice(1, 0, dead.length);
  }
  scored.sort((a, b) => lex(a[0], b[0]));
  return scored
    .filter((s) => lex(s[0], scored[0][0]) === 0)
    .map((s) => s[1])
    .sort(lex);
}

function priestessDeaths(state, losses) {
  const queens = [];
  state.board.forEach((sq, i) =>
    sq.forEach((u, slot) => {
      if (Math.abs(u) === 5) queens.push({ i, slot, u });
    }),
  );
  const doomed = queens.filter((q) =>
    queens.some(
      (o) =>
        side(o.u) !== side(q.u) &&
        Math.max(
          Math.abs(Math.floor(o.i / 8) - Math.floor(q.i / 8)),
          Math.abs((o.i % 8) - (q.i % 8)),
        ) === 1,
    ),
  );
  doomed
    .sort((a, b) => b.i - a.i || b.slot - a.slot)
    .forEach((q) => {
      state.board[q.i].splice(q.slot, 1);
      losses.push({
        unit: q.u,
        at: q.i,
        slot: q.slot,
        cause: "priestess_adjacency",
      });
    });
}

function adjudicate(state) {
  const north = state.board.some((s) => s.includes(6)),
    south = state.board.some((s) => s.includes(-6));
  if (!north || !south) {
    state.winner = north ? 1 : south ? -1 : 0;
    state.reason =
      north || south ? "commander_capture" : "both_commanders_absent";
  } else if (!unfilteredActions(state).length) {
    state.winner = -state.turn;
    state.reason = "stagnation";
  } else if (state.counts[positionKey(state)] >= RULES.repetition_draw) {
    state.winner = 0;
    state.reason = "threefold_repetition";
  }
}

// The input is immutable. Only the internal AI passes a previously generated action.
export function transition(state, action, trusted = false) {
  if (
    !trusted &&
    (!Array.isArray(action) ||
      action.length !== 6 ||
      action.some(
        (x, i) => !Number.isInteger(x) || x < 0 || x >= [8, 8, 2, 8, 8, 4][i],
      ) ||
      !legalActions(state).some((a) => actionKey(a) === actionKey(action)))
  )
    throw Error("Illegal action");
  const next = cloneState(state),
    [r, c, slot, rr, cc, kind] = action;
  const from = r * 8 + c,
    to = rr * 8 + cc,
    src = next.board[from],
    dst = next.board[to],
    actor = src[slot];
  const event = {
    action: [...action],
    actor,
    from,
    to,
    defender: [...dst],
    losses: [],
    kind,
    moved: false,
  };
  const remove = (sq, at, index, cause) => {
    const [unit] = sq.splice(index, 1);
    event.losses.push({ unit, at, slot: index, cause });
  };
  if (kind === 0) {
    dst.push(...src.splice(slot, 1));
    event.moved = true;
  } else if (kind === 1) {
    const [alive, top, bottom] = melee(actor, ...dst);
    event.survival = [alive, top, bottom];
    if (dst.length === 2 && !bottom) remove(dst, to, 1, "melee");
    if (!top) remove(dst, to, 0, "melee");
    if (!alive) remove(src, from, slot, "melee");
    else if (!dst.length) {
      dst.push(...src.splice(slot, 1));
      event.moved = true;
    }
  } else if (kind === 2) remove(dst, to, 0, "ranged");
  else if (kind === 3) {
    event.converted = dst[0];
    dst[0] *= -1;
  }
  priestessDeaths(next, event.losses);
  next.turn *= -1;
  next.ply++;
  const key = positionKey(next);
  next.counts[key] = (next.counts[key] || 0) + 1;
  adjudicate(next);
  event.winner = next.winner;
  return { state: next, event };
}

export function describeEvent(event) {
  const destination = squareName(event.to),
    who = label(event.actor);
  if (event.kind === 3)
    return `${who} converts ${label(event.converted)} at ${destination}.`;
  if (event.kind === 2)
    return `${who} fires at ${destination}. ${event.losses.map((l) => label(l.unit)).join(" and ")} falls.`;
  if (event.kind === 1) {
    const losses = event.losses.map((l) => label(l.unit)).join(" and ");
    return `${who} attacks ${destination}. ${losses} ${event.losses.length === 1 ? "falls" : "fall"}.${!event.moved && event.survival[0] ? " Attacker holds position." : ""}`;
  }
  return `${who} ${event.defender.length ? "joins the formation at" : "advances to"} ${destination}.${event.losses.length ? " Opposing Priestesses fall together." : ""}`;
}
