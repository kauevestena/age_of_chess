import { RULES } from "./rules.mjs";
import { attackSector, resolveCombat, meleeAllowed, contactSlots, canonicalLayout,
  defaultLayout, physicalPosition, layoutLabel, isPreparation, isShot, shotSlot } from "./formations.mjs";
export { attackSector, resolveCombat, layoutLabel, isPreparation, isShot, shotSlot } from "./formations.mjs";

// North is +1, South is -1. Each square holds logical [A, B], signed class IDs.
export const CODES = "PNBRQK";
export const code = (unit) => CODES[Math.abs(unit) - 1];
export const side = (unit) => Math.sign(unit);
export const label = (unit) => RULES.pieces[code(unit)].label;
export const squareName = (index) =>
  "abcdefgh"[index % 8] + (8 - Math.floor(index / 8));
export const actionKey = (action) => action.join(",");
export const positionKey = (state) =>
  `${state.turn}|${state.retreats.join(",")}|${state.kingMoves.join(",")}|${state.board.map((sq, i) => physicalPosition(sq, state.layout[i], state.veteran[i])).join(";")}`;
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
    retreats: [...state.retreats],
    kingMoves: [...state.kingMoves],
    veteran: state.veteran.map(s => [...s]),
    layout: [...state.layout],
    prepared: [...state.prepared],
  };
}

export function studyState(board, turn = 1, retreats = [0, 0], layout = null, prepared = [], veteran = null, kingMoves = [0, 0]) {
  const state = {
    board: board.map((s) => [...s]),
    layout: board.map((sq, i) => layout?.[i] ?? defaultLayout(sq, veteran?.[i])),
    veteran: board.map((sq, i) => veteran?.[i] ? [...veteran[i]] : sq.map(() => false)),
    kingMoves: [...kingMoves],
    prepared: [...prepared],
    turn,
    ply: 0,
    winner: null,
    reason: null,
    counts: {},
    retreats: [...retreats],
  };
  validateState(state);
  priestessDeaths(state, []);
  markVeterans(state);
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
  if (
    !Array.isArray(s.retreats) ||
    s.retreats.length !== 2 ||
    s.retreats.some((n) => !Number.isInteger(n) || n < 0 || n > 3) ||
    s.retreats.every((n) => n === 3)
  )
    throw Error("Invalid King retreat counts");
  if (!Array.isArray(s.kingMoves) || s.kingMoves.length !== 2 ||
    s.kingMoves.some(n => !Number.isInteger(n) || n < 0 || n > 4) || s.kingMoves.every(n => n === 4))
    throw Error("Invalid King movement counts");
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
        throw Error("Duplicate King or Priestess");
  }
  if (!Array.isArray(s.veteran) || s.veteran.length !== 64 || s.veteran.some((sq, i) =>
    !Array.isArray(sq) || sq.length !== s.board[i].length || sq.some((v, slot) =>
      typeof v !== "boolean" || (v && code(s.board[i][slot]) === "K"))))
    throw Error("Invalid veteran state");
  if (!Array.isArray(s.layout) || s.layout.length !== 64 || s.layout.some((l, i) =>
    !Number.isInteger(l) || (s.board[i].length < 2 ? l !== -1 : l < 0 || l > 3 || canonicalLayout(s.board[i], l, s.veteran[i]) !== l)))
    throw Error("Invalid formation layout");
  if (!Array.isArray(s.prepared) || s.prepared.length > RULES.formation_rearrangements || new Set(s.prepared).size !== s.prepared.length || s.prepared.some(i =>
    !Number.isInteger(i) || i < 0 || i >= 64 || s.board[i].length !== 2 || side(s.board[i][0]) !== s.turn))
    throw Error("Invalid preparation state");
  return true;
}

export const approachLabel = (sector) =>
  sector === 2
    ? "Guarded front"
    : [1, 3].includes(sector)
      ? "Front diagonal"
      : [4, 6].includes(sector)
        ? "Flank"
        : "Rear";
export const cavalryPassable = (square, owner) =>
  !square.length || (square.length === 1 && side(square[0]) === owner);

export function melee(actor, top, bottom, from, to, layout) {
  const result = resolveCombat(actor, bottom ? [top, bottom] : [top], from, to, layout);
  return [result.alive, result.survive[0], result.survive[1] || false];
}

export function enemyNear(state, r, c, owner, radius) {
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
      const destination = (rr, cc, attackOnly = false) => {
        if (!inside(rr, cc)) return;
        const dst = state.board[rr * 8 + cc];
        if (!dst.length || (side(dst[0]) === owner && dst.length === 1)) {
          if (!attackOnly) add(rr, cc, 0);
        } else if (
          side(dst[0]) !== owner &&
          meleeAllowed(unit, dst, index, rr * 8 + cc, state.layout[rr * 8 + cc])
        )
          add(rr, cc, 1);
      };
      const groups = [dirs, ...(state.veteran[index][slot] ? [dirs.map(([dr, dc]) => [-dr, dc])] : [])];
      for (const group of groups) for (const [dr, dc] of group) {
        const rr = r + dr,
          cc = c + dc;
        if (!inside(rr, cc)) continue;
        destination(rr, cc);
        if (
          movement.max_steps === 2 &&
          cavalryPassable(state.board[rr * 8 + cc], owner)
        )
          for (const [dr2, dc2] of group) destination(rr + dr2, cc + dc2);
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
      const ahead = r - owner;
      if (
        inside(ahead, c) &&
        state.board[ahead * 8 + c].length &&
        side(state.board[ahead * 8 + c][0]) !== owner
      ) {
        destination(r, c - 1);
        destination(r, c + 1);
      }
      for (const [dr, dc] of directions) {
        const rr = r + dr,
          cc = c + dc;
        if (!inside(rr, cc)) continue;
        destination(rr, cc, true);
        if (
          movement.max_steps === 2 &&
          cavalryPassable(state.board[rr * 8 + cc], owner)
        )
          for (const [dr2, dc2] of directions)
            destination(rr + dr2, cc + dc2, true);
      }
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
          for (const [dr, dc] of directions)
            for (let dist = 1; dist <= ability.range; dist++) {
              const rr = r + dr * dist,
                cc = c + dc * dist;
              if (!inside(rr, cc)) break;
              const dst = state.board[rr * 8 + cc];
              if (dst.length) {
                if (side(dst[0]) !== owner)
                  for (const target of contactSlots(index, rr * 8 + cc, dst, state.layout[rr * 8 + cc]))
                    if (ability.targets.includes(code(dst[target]))) add(rr, cc, target ? 8 : 2);
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
  if (isShot(kind) && code(state.board[rr * 8 + cc][shotSlot(kind)]) === "B") return ["B"];
  if (kind === 1) {
    const dst = state.board[rr * 8 + cc];
    const [alive, top, bottom] = melee(
      actor,
      dst[0],
      dst[1],
      r * 8 + c,
      rr * 8 + cc,
      state.layout[rr * 8 + cc],
    );
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

export function preparationActions(state) {
  if (state.winner !== null || state.prepared.length >= RULES.formation_rearrangements) return [];
  return state.board.flatMap((sq, i) => sq.length === 2 && side(sq[0]) === state.turn && !state.prepared.includes(i)
    ? [0, 1, 2, 3].filter(l => l !== state.layout[i] && canonicalLayout(sq, l, state.veteran[i]) === l)
      .map(l => [i >> 3, i % 8, 0, i >> 3, i % 8, 4 + l]) : []);
}

export function legalActions(state) {
  const orders = legalOrders(state);
  return orders.length ? [...orders, ...preparationActions(state)].sort(lex) : [];
}

export function legalOrders(state) {
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
      state.veteran[q.i].splice(q.slot, 1);
      state.layout[q.i] = -1;
      losses.push({
        unit: q.u,
        at: q.i,
        slot: q.slot,
        cause: "priestess_adjacency",
      });
    });
}

function markVeterans(state) {
  state.board.forEach((sq, i) => {
    sq.forEach((u, slot) => {
      if (code(u) !== "K" && (i >> 3) === (u > 0 ? 0 : 7)) state.veteran[i][slot] = true;
    });
    state.layout[i] = canonicalLayout(sq, state.layout[i], state.veteran[i]);
  });
}

function adjudicate(state) {
  const north = state.board.some((s) => s.includes(6)),
    south = state.board.some((s) => s.includes(-6));
  const retreatLoser = state.retreats.findIndex(
    (n) => n >= RULES.commander_retreat_limit,
  );
  const units = state.board.flat();
  const moveLoser = state.kingMoves.findIndex(n => n >= RULES.king_move_limit);
  const loneNorth = units.filter((u) => u > 0).length === 1,
    loneSouth = units.filter((u) => u < 0).length === 1;
  if (!north || !south) {
    state.winner = north ? 1 : south ? -1 : 0;
    state.reason =
      north || south ? "commander_capture" : "both_commanders_absent";
  } else if (retreatLoser >= 0) {
    state.winner = retreatLoser === 0 ? -1 : 1;
    state.reason = "commander_retreat_forfeit";
  } else if (moveLoser >= 0) {
    state.winner = moveLoser === 0 ? -1 : 1;
    state.reason = "king_move_forfeit";
  } else if (loneNorth || loneSouth) {
    state.winner = loneNorth && loneSouth ? 0 : loneNorth ? -1 : 1;
    state.reason =
      loneNorth && loneSouth ? "both_commanders_alone" : "lone_commander";
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
        (x, i) => !Number.isInteger(x) || x < 0 || x >= [8, 8, 2, 8, 8, 9][i],
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
    defenderLayout: state.layout[to],
    order: state.ply + 1,
  };
  const remove = (sq, at, index, cause) => {
    const [unit] = sq.splice(index, 1);
    next.veteran[at].splice(index, 1);
    event.losses.push({ unit, at, slot: index, cause });
  };
  const advance = () => {
    dst.push(...src.splice(slot, 1));
    next.veteran[to].push(...next.veteran[from].splice(slot, 1));
    event.moved = true;
  };
  if (isPreparation(kind)) {
    event.previousLayout = next.layout[from];
    next.layout[from] = kind - 4;
    next.prepared.push(from);
    event.layout = next.layout[from];
    event.winner = null;
    event.reason = null;
    return { state: next, event };
  }
  if (kind === 0) {
    advance();
  } else if (kind === 1) {
    event.approach = attackSector(from, to, dst[0]);
    const resolution = resolveCombat(actor, dst, from, to, state.layout[to]);
    event.formation = resolution;
    event.stance = resolution.waves.some(wave => wave.stance);
    const [alive, top, bottom] = [resolution.alive, resolution.survive[0], resolution.survive[1] || false];
    event.survival = [alive, top, bottom];
    if (dst.length === 2 && !bottom) remove(dst, to, 1, "melee");
    if (!top) remove(dst, to, 0, "melee");
    if (!alive) remove(src, from, slot, "melee");
    else if (!dst.length) {
      advance();
    }
  } else if (isShot(kind)) {
    event.targetSlot = shotSlot(kind);
    const returnsFire = code(dst[event.targetSlot]) === "B";
    remove(dst, to, event.targetSlot, "ranged");
    if (returnsFire) {
      remove(src, from, slot, "return_fire");
      event.returnFire = true;
    }
  } else if (kind === 3) {
    event.converted = dst[0];
    dst[0] *= -1;
  }
  next.layout[from] = canonicalLayout(src, next.layout[from], next.veteran[from]);
  next.layout[to] = state.board[to].length < 2 ? defaultLayout(dst, next.veteran[to]) : canonicalLayout(dst, next.layout[to], next.veteran[to]);
  next.prepared = [];
  priestessDeaths(next, event.losses);
  markVeterans(next);
  event.veteranUnlocked = event.moved && code(actor) !== "K" && !state.veteran[from][slot] && rr === (state.turn === 1 ? 0 : 7) && dst.includes(actor);
  const retreatIndex = state.turn === 1 ? 0 : 1;
  next.retreats[retreatIndex] =
    code(actor) === "K" && event.moved && (rr - r) * state.turn > 0
      ? next.retreats[retreatIndex] + 1
      : 0;
  next.kingMoves[retreatIndex] = code(actor) === "K" && event.moved ? next.kingMoves[retreatIndex] + 1 : 0;
  next.turn *= -1;
  next.ply++;
  const key = positionKey(next);
  next.counts[key] = (next.counts[key] || 0) + 1;
  adjudicate(next);
  event.winner = next.winner;
  event.reason = next.reason;
  return { state: next, event };
}

export function describeEvent(event) {
  const destination = squareName(event.to),
    who = label(event.actor);
  if (isPreparation(event.kind)) return `Formation at ${destination} rearranges: ${layoutLabel(event.layout)}. A normal order is still required.`;
  if (event.kind === 3)
    return `${who} converts ${label(event.converted)} at ${destination}.`;
  if (isShot(event.kind))
    return event.returnFire
      ? `Archer fires at ${destination}. The defending Archer returns fire; both Archers fall.`
      : `${who} fires at ${destination}. ${event.losses.map((l) => label(l.unit)).join(" and ")} ${event.losses.length === 1 ? "falls" : "fall"}.`;
  if (event.kind === 1) {
    const losses = event.losses.map((l) => label(l.unit)).join(" and ");
    return `${who} attacks ${destination}.${event.formation.mode === "king_guard" ? " The King's escort engages first." : event.formation.mode === "serial" ? " The reserve turns and engages." : event.formation.mode === "braced_line" ? " Both defenders brace the front." : event.formation.mode === "simultaneous" ? " Both defenders engage together." : event.stance ? ` ${approachLabel(event.approach)}.` : ""} ${losses} ${event.losses.length === 1 ? "falls" : "fall"}.${!event.moved && event.survival[0] ? " Attacker holds position." : ""}${event.veteranUnlocked ? " Backward movement is now permanent." : ""}`;
  }
  return `${who} ${event.defender.length ? "joins the formation at" : "advances to"} ${destination}.${event.losses.length ? " Opposing Priestesses fall together." : ""}${event.veteranUnlocked ? " Backward movement is now permanent." : ""}`;
}
