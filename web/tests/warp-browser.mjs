import { createRecord, readRecord, SAVE_KEY, SETTINGS_KEY } from "../src/records.mjs";

// A legal 31-order game (found by seeded random play, replayed by readRecord below) that ends with
// South to move: its Priestess on b4 stands beside a Pikeman-over-Archer formation on c3.
const GAME = [[7,4,0,6,4,0],[0,6,0,2,6,0],[7,1,0,5,0,0],[0,3,0,1,3,0],[6,6,0,5,6,0],[1,4,0,2,4,0],[7,7,0,6,7,0],[0,0,0,1,0,0],
  [5,0,0,4,1,0],[1,6,0,2,6,0],[5,6,0,4,5,0],[1,3,1,2,2,0],[4,1,0,3,0,0],[2,4,0,3,3,0],[6,2,0,5,2,0],[2,2,0,3,1,0],
  [7,2,0,6,2,0],[0,1,0,2,1,0],[6,7,0,5,7,0],[2,6,0,4,7,0],[6,3,0,5,4,0],[3,1,0,4,1,0],[7,6,0,5,7,0],[0,4,0,1,5,0],
  [5,7,1,4,7,1],[3,3,0,4,3,0],[4,5,0,3,5,0],[1,0,1,2,0,0],[5,7,0,4,7,1],[2,1,0,3,2,0],[6,2,0,5,2,0]];
const PRIESTESS = 33, FORMATION = 42;

export async function warpChecks(browser, url, monitor, check, out) {
  const record = createRecord(GAME, { mode: "local", difficulty: "knight", humanSide: 1 });
  const before = readRecord(JSON.stringify(record)).state;
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, reducedMotion: "reduce" });
  await context.addInitScript(({ record, saveKey, settingsKey }) => {
    localStorage.setItem(saveKey, JSON.stringify(record));
    localStorage.setItem(settingsKey, JSON.stringify({ sound: false, motion: "reduced", battles: "quick" }));
  }, { record, saveKey: SAVE_KEY, settingsKey: SETTINGS_KEY });
  const page = await context.newPage();
  monitor(page);
  const idle = () => page.waitForFunction(() => document.querySelector("#board").getAttribute("aria-busy") === "false");
  const cell = (i) => page.locator(`[data-index="${i}"]`);
  try {
    check(before.turn === -1 && before.board[FORMATION].join() === "1,3" && before.board[PRIESTESS].join() === "-5", "fixture position is as described");
    await page.goto(url);
    await page.locator("#continue").click();
    await cell(PRIESTESS).click();
    check((await cell(FORMATION).getAttribute("class")).includes("warp-target"), "a formation without a King is marked as warpable");
    await cell(FORMATION).click();
    check((await page.locator("[data-warp-slot]").count()) === 2, "choosing a formation asks which member to warp");
    await page.screenshot({ path: `${out}/warp-member-choice.png` });
    await page.locator("#modal-close").click();
    check((await cell(FORMATION).getAttribute("class")).includes("warp-target") && !(await cell(FORMATION).getAttribute("class")).includes("warp-chosen"),
      "closing the choice leaves nothing chosen");
    await cell(FORMATION).click();
    await page.locator('[data-warp-slot="1"]').click();
    check((await cell(FORMATION).getAttribute("class")).includes("warp-chosen"), "the chosen formation square is highlighted");
    check((await page.locator(".board-cell.warp-destination").count()) === 64 - before.board.filter((s) => s.length).length, "every empty square is a destination");
    await page.keyboard.press("Escape");
    check((await page.locator(".board-cell.warp-destination").count()) === 0, "Escape cancels a pending Warp");
    await cell(FORMATION).click();
    await page.locator('[data-warp-slot="1"]').click();
    const destination = page.locator(".board-cell.warp-destination").first();
    const index = Number(await destination.getAttribute("data-index"));
    await destination.click();
    await idle();
    const saved = readRecord(await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY));
    const after = saved.state;
    check(saved.record.moves.at(-1).join() === [5, 2, 1, index >> 3, index % 8, 3].join(), "the Warp is saved as one order with the member slot");
    check(after.board[FORMATION].join() === "1" && after.board[index].join() === "3", "the Archer left; the Pikeman stays behind alone");
    check(after.board.flat().length === before.board.flat().length, "no unit died");
    check((await cell(index).getAttribute("aria-label")).includes("Archer"), "the warped unit is shown on its new square");
    await page.screenshot({ path: `${out}/warp-formation-broken.png` });
  } finally {
    await context.close();
  }
}
