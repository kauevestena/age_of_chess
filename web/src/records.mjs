import { initialState, transition } from "./engine.mjs";

export const SAVE_KEY = "age-of-chess.warfare.save.v1";
export const SETTINGS_KEY = "age-of-chess.warfare.settings.v1";
export function createRecord(moves, config, resignation = null) {
  return {
    format: "age-of-chess",
    version: 1,
    rules: 2,
    savedAt: new Date().toISOString(),
    config,
    moves,
    resignation,
  };
}
export function readRecord(text) {
  if (text.length > 2_000_000) throw Error("This save file is too large.");
  const record = JSON.parse(text);
  if (
    record.format !== "age-of-chess" ||
    record.version !== 1 ||
    record.rules !== 2 ||
    !Array.isArray(record.moves) ||
    record.moves.length > 20000
  )
    throw Error("This is not a supported Warfare save.");
  const c = record.config;
  if (
    !c ||
    !["solo", "local"].includes(c.mode) ||
    !["squire", "knight", "marshal"].includes(c.difficulty) ||
    ![1, -1].includes(c.humanSide)
  )
    throw Error("Invalid game settings.");
  let state = initialState();
  const events = [];
  for (const action of record.moves) {
    const next = transition(state, action);
    state = next.state;
    events.push(next.event);
  }
  if (record.resignation !== null && record.resignation !== undefined) {
    if (
      ![1, -1].includes(record.resignation) ||
      state.winner !== null ||
      state.turn !== record.resignation
    )
      throw Error("Invalid resignation.");
    state.winner = -record.resignation;
    state.reason = "resignation";
  }
  return { record, state, events };
}
export function stateAt(moves, ply) {
  let state = initialState();
  for (const action of moves.slice(0, ply))
    state = transition(state, action).state;
  return state;
}
