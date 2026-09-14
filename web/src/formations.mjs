import { RULES } from "./rules.mjs";

export const POSITIONS = [["N", "S"], ["S", "N"], ["W", "E"], ["E", "W"]];
export const isPreparation = (kind) => kind >= 4 && kind <= 7;
export const isShot = (kind) => kind === 2 || kind === 8;
export const shotSlot = (kind) => kind === 8 ? 1 : 0;
const code = (unit) => "PNBRQK"[Math.abs(unit) - 1];
export const canonicalLayout = (square, layout) => square.length < 2 ? -1
  : square[0] === square[1] ? layout & 2 : layout;
export const defaultLayout = (square) => canonicalLayout(square, square[0] > 0 ? 0 : 1);
export const layoutLabel = (layout) => `A ${POSITIONS[layout][0]} · B ${POSITIONS[layout][1]}`;

export function attackSector(from, to, defender) {
  if (!Number.isInteger(from) || !Number.isInteger(to) || from === to)
    throw Error("Melee requires source and target squares");
  const forward = (Math.floor(to / 8) - Math.floor(from / 8)) * Math.sign(defender);
  const right = ((from % 8) - (to % 8)) * Math.sign(defender);
  return (forward > 0 ? 2 : forward < 0 ? 8 : 5) + Math.sign(right);
}

export function contactSlots(from, to, square, layout) {
  if (square.length < 2) return [0];
  const dr = Math.floor(from / 8) - Math.floor(to / 8), dc = from % 8 - to % 8;
  let projection = layout < 2 ? -dr : -dc;
  if (layout % 2) projection *= -1;
  return projection === 0 ? [0, 1] : [projection > 0 ? 0 : 1];
}

function duel(actor, defender, sector) {
  const result = RULES.combat.single[code(actor)][code(defender)];
  if (result === "illegal") throw Error("Forbidden melee");
  // Class counters are resolved before any matching-class stance benefit.
  if (result !== "stance") return [result === "win", result === "lose"];
  if (sector === null) throw Error("Matching-class melee requires its approach");
  return [![1, 2, 3].includes(sector), sector === 2];
}

export function resolveCombat(actor, defenders, from, to, layout = defaultLayout(defenders)) {
  if (!defenders.length || Math.sign(actor) === Math.sign(defenders[0])) throw Error("Invalid melee target");
  const approach = Number.isInteger(from) && Number.isInteger(to) ? attackSector(from, to, defenders[0]) : null;
  if (defenders.length === 2 && approach === null) throw Error("Formation melee requires its approach");
  const survive = defenders.map(() => true), waves = [];
  let alive = true;
  const line = defenders.length === 2 && layout >= 2 && [1, 2, 3].includes(approach);
  const exposed = line ? [0, 1] : contactSlots(from, to, defenders, layout);
  function engage(slots, sector, reserve = false) {
    const hits = slots.map(i => duel(actor, defenders[i], sector));
    alive = hits.every(hit => hit[0]);
    slots.forEach((slot, i) => { survive[slot] = hits[i][1]; });
    waves.push({ slots, alive, defenders: hits.map(hit => hit[1]), sector, reserve,
      stance: slots.some(i => code(actor) === code(defenders[i]) && "PNBR".includes(code(actor))) });
  }
  engage(exposed, line ? 2 : approach);
  const first = exposed[0];
  if (defenders.length === 2 && exposed.length === 1 && alive && !survive[first] && code(defenders[first]) !== "K")
    engage([1 - first], 2, true);
  return { alive, survive, approach, waves, mode: defenders.length === 1 ? "single"
    : line ? "braced_line" : exposed.length === 2 ? "simultaneous" : waves.length === 2 ? "serial" : "screen" };
}

export function meleeAllowed(actor, defenders, from, to, layout) {
  try { resolveCombat(actor, defenders, from, to, layout); return true; }
  catch { return false; }
}

// Repetition follows physical unit positions, not interchangeable A/B labels.
export function physicalPosition(square, layout) {
  const cells = [0, 0, 0, 0, 0];
  if (square.length < 2) cells[0] = square[0] || 0;
  else POSITIONS[layout].forEach((position, slot) => { cells[1 + ["N", "S", "W", "E"].indexOf(position)] = square[slot]; });
  return cells.join(",");
}
