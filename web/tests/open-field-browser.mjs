import { createRecord, readRecord, SAVE_KEY, SETTINGS_KEY } from "../src/records.mjs";

// A legal 36-order Open Field game (seeded random play) after which North's Archer on c3
// can shoot the unit on c5, two squares away.
const LONG_SHOT_GAME = [[6,6,0,5,5,0],[0,2,0,2,4,0],[6,1,0,4,1,0],[0,3,0,2,2,0],[6,3,0,4,2,0],[2,4,0,3,4,0],[4,1,0,2,0,0],
  [2,2,0,4,4,0],[5,5,0,3,4,1],[0,6,0,3,5,0],[6,2,0,4,3,0],[3,5,0,6,4,1],[6,5,0,4,6,0],[1,4,0,3,2,0],[7,6,0,5,4,0],[1,3,0,2,3,0],
  [4,2,0,3,2,1],[1,5,0,2,4,0],[7,3,0,5,5,0],[1,0,0,3,1,0],[4,6,0,2,5,0],[2,3,0,3,4,1],[2,5,0,0,5,1],[3,2,0,5,1,0],[6,7,0,4,5,0],
  [3,1,0,4,1,0],[6,4,0,4,6,0],[0,0,0,2,0,1],[7,1,0,6,2,0],[5,1,0,6,0,1],[6,2,0,4,1,1],[1,2,0,3,2,0],[7,0,0,6,1,0],[4,1,0,5,1,0],
  [7,2,0,5,2,0],[5,1,0,7,2,0]];

// Open Field through the real lobby: rules picker, two- and three-square moves, no formations,
// save and reload, the field guide, and an AI-versus-AI battle.
export async function openFieldChecks(browser, url, monitor, check, out) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, reducedMotion: "reduce" });
  await context.addInitScript(({ settingsKey }) => {
    if (!localStorage.getItem(settingsKey))
      localStorage.setItem(settingsKey, JSON.stringify({ sound: false, motion: "reduced", battles: "quick", watchDelay: 250 }));
  }, { settingsKey: SETTINGS_KEY });
  const page = await context.newPage();
  monitor(page);
  const idle = () => page.waitForFunction(() => document.querySelector("#board").getAttribute("aria-busy") === "false");
  const cell = (i) => page.locator(`[data-index="${i}"]`);
  const saved = async () => readRecord(await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY));
  try {
    await page.goto(url);
    await page.evaluate((key) => localStorage.removeItem(key), SAVE_KEY);
    await page.reload();
    check((await page.locator('input[name=ruleset][value="warfare"]').isChecked()), "Warfare is the default ruleset");
    await page.locator('input[name=ruleset][value="open_field"]').check();
    await page.locator('input[name=mode][value="local"]').check();
    await page.locator("#begin").click();
    await page.locator("#game").waitFor({ state: "visible" });
    check((await page.locator("#battle-mode").textContent()).includes("Open Field"), "the battle header names Open Field");
    check((await page.locator("#formation-budget").textContent()) === "", "no formation budget in Open Field");

    // A Pikeman advances two squares; it cannot stop on its own Cavalry's path squares.
    await cell(52).click();
    check((await cell(36).getAttribute("class")).includes("legal-target"), "Pikeman e2 may reach e4 in one order");
    check((await page.locator("#unit-facts").textContent()).includes("up to 2 squares"), "unit panel states the two-square reach");
    await page.screenshot({ path: `${out}/open-field-reach.png` });
    await cell(36).click();
    await idle();
    check((await cell(36).getAttribute("aria-label")).includes("Azure Host Pikeman") && (await cell(52).getAttribute("aria-label")).includes("empty"),
      "the Pikeman moved two squares");
    await cell(11).click();
    await cell(27).click();
    await idle();

    // Cavalry g1 rides three squares, over its own Pikeman on g2.
    await cell(62).click();
    check((await page.locator("#unit-facts").textContent()).includes("up to 3 squares"), "unit panel states the three-square Cavalry reach");
    check((await cell(38).getAttribute("class")).includes("legal-target"), "Cavalry g1 may reach g4 past its Pikeman");
    check(!(await cell(54).getAttribute("class")).includes("legal-target"), "it cannot stop on the friendly Pikeman");
    await cell(38).click();
    await idle();
    check((await cell(38).getAttribute("aria-label")).includes("Azure Host Cavalry"), "the Cavalry rode three squares");
    check((await page.locator(".stack-badge").count()) === 0, "no formations exist");
    check(await page.locator("#formation-controls").isHidden(), "formation controls stay hidden");

    const record = await saved();
    check(record.record.config.ruleset === "open_field" && record.state.mode === "open_field" && record.record.moves.length === 3,
      "the autosave records the ruleset and replays the three orders");
    await page.reload();
    await page.locator("#continue").click();
    await page.locator("#game").waitFor({ state: "visible" });
    check((await page.locator("#battle-mode").textContent()).includes("Open Field") &&
      (await cell(38).getAttribute("aria-label")).includes("Cavalry"), "reloading restores the Open Field battle");

    await page.locator("#guide-button").click();
    await page.locator('[data-guide="open_field"]').click();
    check((await page.locator("#modal-content").textContent()).includes("Open Field: no formations"), "the field guide explains Open Field");
    await page.screenshot({ path: `${out}/open-field-guide.png` });
    await page.locator("#modal-close").click();

    // AI versus AI in Open Field.
    await page.locator("#menu-button").click();
    await page.locator("#return-camp").click();
    await page.locator('input[name=ruleset][value="open_field"]').check();
    await page.locator('input[name=mode][value="watch"]').check();
    await page.locator("#north-difficulty").selectOption("squire");
    await page.locator("#south-difficulty").selectOption("squire");
    await page.locator("#begin").click();
    await page.waitForFunction((key) => {
      const record = JSON.parse(localStorage.getItem(key) || "{}");
      return record.config?.mode === "watch" && (record.moves?.length ?? 0) >= 6;
    }, SAVE_KEY, { timeout: 60000 });
    const watched = await saved();
    check(watched.record.config.ruleset === "open_field" && watched.state.board.every((sq) => sq.length <= 1),
      "an AI-versus-AI Open Field battle plays legal orders without formations");
    await page.screenshot({ path: `${out}/open-field-spectator.png` });
  } finally {
    await context.close();
  }

  // Long shot and cooldown, from a real game position.
  const record = createRecord(LONG_SHOT_GAME, { mode: "local", difficulty: "knight", humanSide: 1, ruleset: "open_field" });
  check(readRecord(JSON.stringify(record)).state.turn === 1, "long-shot fixture replays legally");
  const shotContext = await browser.newContext({ viewport: { width: 1440, height: 1100 }, reducedMotion: "reduce" });
  await shotContext.addInitScript(({ record, saveKey, settingsKey }) => {
    localStorage.setItem(saveKey, JSON.stringify(record));
    localStorage.setItem(settingsKey, JSON.stringify({ sound: false, motion: "reduced", battles: "quick" }));
  }, { record, saveKey: SAVE_KEY, settingsKey: SETTINGS_KEY });
  const sp = await shotContext.newPage();
  monitor(sp);
  try {
    const at = (i) => sp.locator(`[data-index="${i}"]`);
    await sp.goto(url);
    await sp.locator("#continue").click();
    await sp.locator("#game").waitFor({ state: "visible" });
    await at(42).click();
    check((await sp.locator("#unit-facts").textContent()).includes("long shot ready"), "the Archer's long shot is ready");
    await at(26).click();
    await sp.getByRole("button", { name: /Ranged attack/ }).click();
    await sp.waitForFunction(() => document.querySelector("#board").getAttribute("aria-busy") === "false");
    check((await at(42).locator(".cooldown-badge").textContent()) === "⏳2", "the board shows a two-turn cooldown on the Archer");
    check((await at(42).getAttribute("aria-label")).includes("long shot in 2 turns"), "the cooldown is announced to screen readers");
    const after = readRecord(await sp.evaluate((key) => localStorage.getItem(key), SAVE_KEY)).state;
    check(after.cooldown[42] === 2 && after.board[26].length === 0, "the long shot hit two squares away and started the cooldown");
    await sp.screenshot({ path: `${out}/open-field-long-shot.png` });
  } finally {
    await shotContext.close();
  }
}
