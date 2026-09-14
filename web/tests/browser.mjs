import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import { spectatorChecks } from "./spectator.mjs";
const require = createRequire(import.meta.url),
  { chromium } = require("playwright");
const root = resolve(fileURLToPath(new URL("..", import.meta.url))),
  out = resolve(root, "test-results");
await mkdir(out, { recursive: true });
let server;
const url = process.env.AOC_BASE_URL || "http://127.0.0.1:4174/age_of_chess/";
if (!process.env.AOC_BASE_URL) {
  server = spawn(process.execPath, [resolve(root, "scripts/serve.mjs")], {
    env: { ...process.env, PORT: "4174" },
    stdio: ["ignore", "pipe", "inherit"],
  });
  await new Promise((resolve, reject) => {
    server.stdout.once("data", resolve);
    server.once("error", reject);
    server.once("exit", (code) => reject(Error(`Server exited ${code}`)));
  });
}
const browser = await chromium.launch({
  headless: true,
  ...(process.env.AOC_CHROMIUM_PATH
    ? {
        executablePath: process.env.AOC_CHROMIUM_PATH,
        args: ["--no-sandbox", "--disable-dev-shm-usage"],
      }
    : {}),
});
const errors = [],
  badRequests = [],
  external = [];
let assertions = 0;
function check(value, message) {
  assert(value, message);
  assertions++;
}
function monitor(page) {
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (r.status() >= 400) badRequests.push(`${r.status()} ${r.url()}`);
  });
  page.on("request", (r) => {
    if (
      !r.url().startsWith(new URL(url).origin) &&
      !r.url().startsWith("blob:") &&
      !r.url().startsWith("data:")
    )
      external.push(r.url());
  });
}
const waitIdle = (page) =>
  page.waitForFunction(
    () =>
      document.querySelector("#board").getAttribute("aria-busy") === "false",
  );
const cell = (page, i) => page.locator(`[data-index="${i}"]`);
const order = async (page, from, to, name) => {
  await cell(page, from).click();
  await cell(page, to).click();
  if (name) await page.getByRole("button", { name, exact: false }).click();
  await waitIdle(page);
};
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1040 },
    acceptDownloads: true,
  });
  const page = await context.newPage();
  monitor(page);
  await page.goto(url);
  await page.evaluate(() => document.fonts.ready);
  check((await page.title()) === "Age of Chess — Warfare", "page title");
  check(
    await page.evaluate(
      () =>
        document.fonts.check("16px Cinzel") &&
        document.fonts.check('16px "IM Fell English"'),
    ),
    "embedded fonts loaded",
  );
  await page.screenshot({
    path: resolve(out, "lobby-desktop.png"),
    fullPage: true,
  });
  await page.locator('input[value="local"]').check();
  await page.locator("#begin").click();
  check((await page.locator(".board-cell").count()) === 64, "64 board squares");
  check(
    (await page.locator("#sound-button").getAttribute("aria-label")) ===
      "Mute soundtrack and effects",
    "audio starts after gesture",
  );
  await page.screenshot({
    path: resolve(out, "game-desktop.png"),
    fullPage: true,
  });
  await order(page, 52, 44);
  check(
    (await cell(page, 44).getAttribute("aria-label")).includes("Pikeman"),
    "human move",
  );
  await order(page, 12, 20);
  check(
    (await page.locator("#turn-number").textContent()) === "03",
    "both local sides can act",
  );
  await page.locator("#undo-button").click();
  check(
    (await page.locator("#turn-number").textContent()) === "02",
    "undo one local ply",
  );
  await page.reload();
  await page.locator("#continue").click();
  check(
    (await page.locator("#turn-number").textContent()) === "02",
    "autosave survives reload",
  );
  const downloaded = page.waitForEvent("download");
  await page.locator("#export-button").click();
  const download = await downloaded;
  await download.saveAs(resolve(out, "roundtrip.json"));
  await page.locator("#review-button").click();
  check(
    (await page.locator("#replay-position").textContent()) === "0 / 1",
    "review initial position",
  );
  await page.locator("#replay-next").click();
  check(
    (await page.locator("#replay-position").textContent()) === "1 / 1",
    "review next position",
  );
  await page.locator("#replay-exit").click();
  await page.locator("#flip-button").click();
  check(
    (await page.locator(".board-cell").first().getAttribute("data-index")) ===
      "63",
    "board flip",
  );
  await cell(page, 12).focus();
  await page.keyboard.press("ArrowUp");
  check(
    (await page.evaluate(() => document.activeElement.dataset.index)) === "20",
    "flipped keyboard navigation",
  );
  await page.locator("#menu-button").click();
  await page.locator("#return-camp").click();
  await page
    .locator("#file-input")
    .setInputFiles(resolve(out, "roundtrip.json"));
  await page.locator("#game").waitFor({ state: "visible" });
  check(
    (await page.locator("#turn-number").textContent()) === "02",
    "portable save restores",
  );
  // Tutorial exercises real board input, explicit melee/ranged choice, stack slots and every cinematic family.
  await page.locator("#menu-button").click();
  await page.locator("#return-camp").click();
  await page.locator("#tutorial-button").click();
  await cell(page, 44).click();
  await waitIdle(page);
  await page.locator("#next-lesson").click();
  await cell(page, 28).click();
  await page.getByRole("button", { name: /Melee attack/ }).click();
  await page.locator("#battle-dialog").waitFor({ state: "visible" });
  await page.waitForTimeout(1100);
  await page.screenshot({ path: resolve(out, "combat-melee.png") });
  await page.locator("#skip-battle").click();
  await waitIdle(page);
  check(await page.locator("#next-lesson").isVisible(), "skip resolves combat");
  await page.locator("#next-lesson").click();
  await cell(page, 28).click();
  check(
    (await page.getByRole("button", { name: /Melee attack/ }).isVisible()) &&
      (await page.getByRole("button", { name: /Ranged attack/ }).isVisible()),
    "Archer has explicit ranged and melee choices",
  );
  await page.getByRole("button", { name: /Ranged attack/ }).click();
  await page.locator("#battle-dialog").waitFor({ state: "visible" });
  await page.waitForTimeout(850);
  await page.screenshot({ path: resolve(out, "combat-ranged.png") });
  await page.keyboard.press("Escape");
  await waitIdle(page);
  check(
    (await cell(page, 36).getAttribute("aria-label")).includes("Archer"),
    "ranged actor stays in place",
  );
  await page.locator("#next-lesson").click();
  await cell(page, 36).click();
  await page.getByRole("button", { name: /Join formation/ }).click();
  await waitIdle(page);
  check(
    (await cell(page, 36).locator(".stack-badge").count()) === 1,
    "formation is visible",
  );
  await page.locator("#next-lesson").click();
  await page.locator('[data-select-slot="1"]').click();
  await cell(page, 20).click();
  await page.getByRole("button", { name: /Ranged attack/ }).click();
  await page.locator("#battle-dialog").waitFor({ state: "visible" });
  await page.locator("#skip-battle").click();
  await waitIdle(page);
  check(
    (await cell(page, 36).getAttribute("aria-label")).includes(
      "bottom Azure Host Archer",
    ),
    "power shot preserves both slots",
  );
  await page.locator("#next-lesson").click();
  await cell(page, 35).click();
  await page.getByRole("button", { name: /Convert unit/ }).click();
  await page.locator("#battle-dialog").waitFor({ state: "visible" });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: resolve(out, "combat-conversion.png") });
  await waitIdle(page);
  check(
    (await cell(page, 35).getAttribute("aria-label")).includes(
      "Azure Host Cavalry",
    ),
    "completed conversion cinematic updates ownership",
  );
  await page.locator("#next-lesson").click();
  await cell(page, 28).click();
  await page.getByRole("button", { name: /Melee attack/ }).click();
  await page.locator("#battle-dialog").waitFor({ state: "visible" });
  await page.locator("#skip-battle").click();
  await waitIdle(page);
  check(
    (await page.locator("#tutorial-panel").textContent()).includes(
      "ready to command",
    ),
    "tutorial completed",
  );
  await page.locator("#next-lesson").click();
  // AI reply in both player orientations; menus cancel in-flight work.
  await page.locator('input[value="solo"]').check();
  await page.locator('input[name=side][value="1"]').check();
  await page.locator("#begin").click();
  await page.locator("#settings-button").click();
  await page.locator("#motion-setting").check();
  await page.locator("#modal-close").click();
  await order(page, 52, 44);
  await page.waitForFunction(
    () =>
      document.querySelector("#turn-number").textContent === "03" &&
      document.querySelector("#board").getAttribute("aria-busy") === "false",
  );
  check(true, "worker AI replies");
  await page.locator("#hint-button").click();
  await waitIdle(page);
  check(
    (await page.locator(".board-cell.hint").count()) > 0,
    "worker hint highlights an order",
  );
  await page.locator("#undo-button").click();
  check(
    (await page.locator("#turn-number").textContent()) === "01",
    "solo undo includes opponent reply",
  );
  await page.locator("#menu-button").click();
  await page.locator("#return-camp").click();
  await page.locator('input[name=side][value="-1"]').check();
  await page.locator("#begin").click();
  await page.locator("#menu-button").click();
  await page.waitForTimeout(500);
  check(
    (await page.locator("#turn-number").textContent()) === "01",
    "menu cancels pending AI opening",
  );
  await page.locator("#resume-battle").click();
  await page.waitForFunction(
    () =>
      document.querySelector("#turn-number").textContent === "02" &&
      document.querySelector("#board").getAttribute("aria-busy") === "false",
  );
  check(
    (await page.locator(".board-cell").first().getAttribute("data-index")) ===
      "63",
    "South player receives AI opening on flipped board",
  );
  await page.locator("#menu-button").click();
  await page.locator("#resign").click();
  await page.locator("#confirm-resign").click();
  check(
    (await page.locator("#modal-title").textContent()).includes(
      "Azure Host prevails",
    ),
    "resignation declares winner",
  );
  await page.locator("#result-camp").click();
  // Original score produces bounded non-silent output with all three compositions.
  const audioStats = await page.evaluate(async () => {
    const { Soundscape, SCORES } = await import("./src/audio.mjs");
    const result = [];
    for (let track = 0; track < 3; track++) {
      const s = new Soundscape(),
        c = new OfflineAudioContext(2, 44100 * 5, 44100);
      s.ctx = c;
      s.music = c.createGain();
      s.music.gain.value = 0.228;
      s.music.connect(c.destination);
      s.effects = s.music;
      s.track = track;
      s.tension = true;
      for (let beat = 0; beat < 10; beat++)
        s.playBeat(0.01 + (beat * 60) / SCORES[track].tempo / 2);
      const b = await c.startRendering(),
        d = b.getChannelData(0);
      let sum = 0,
        peak = 0;
      for (const x of d) {
        sum += x * x;
        peak = Math.max(peak, Math.abs(x));
      }
      result.push({
        name: SCORES[track].name,
        rms: Math.sqrt(sum / d.length),
        peak,
      });
    }
    return result;
  });
  for (const stat of audioStats)
    check(stat.rms > 0.001 && stat.peak < 1, `score amplitude: ${stat.name}`);
  // Mobile, touch and reduced motion. No sideways scrolling at 360px and 390px.
  for (const width of [360, 390]) {
    const mobile = await browser.newContext({
        viewport: { width, height: 844 },
        deviceScaleFactor: 1,
        isMobile: true,
        hasTouch: true,
        reducedMotion: "reduce",
      }),
      p = await mobile.newPage();
    monitor(p);
    await p.goto(url);
    await p.evaluate(() => document.fonts.ready);
    check(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `lobby no overflow at ${width}`,
    );
    if (width === 390)
      await p.screenshot({
        path: resolve(out, "lobby-mobile.png"),
        fullPage: true,
      });
    await p.locator('input[value="local"]').check();
    await p.locator("#begin").tap();
    check(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `board no overflow at ${width}`,
    );
    await cell(p, 52).tap();
    await cell(p, 44).tap();
    await waitIdle(p);
    check(
      (await p.locator("#turn-number").textContent()) === "02",
      `touch move at ${width}`,
    );
    if (width === 390)
      await p.screenshot({
        path: resolve(out, "game-mobile.png"),
        fullPage: true,
      });
    await p.locator("#guide-button").tap();
    await p.getByRole("button", { name: "Combat table", exact: true }).tap();
    check(
      (await p.locator("tbody tr").count()) === 6,
      "mobile combat reference",
    );
    await mobile.close();
  }
  const limited = await browser.newContext({
    viewport: { width: 1024, height: 768 },
    reducedMotion: "reduce",
  });
  await limited.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw Error("Storage blocked");
      },
    });
    window.Worker = class {
      constructor() {
        throw Error("Worker blocked");
      }
    };
  });
  const lp = await limited.newPage();
  monitor(lp);
  await lp.goto(url);
  await lp.locator("#begin").click();
  await order(lp, 52, 44);
  await lp.waitForFunction(
    () =>
      document.querySelector("#turn-number").textContent === "03" &&
      document.querySelector("#board").getAttribute("aria-busy") === "false",
  );
  check(
    (await lp.locator("#save-status").textContent()).includes(
      "Autosave unavailable",
    ),
    "manual-save notice when storage is blocked",
  );
  check(
    (await lp.locator("#toast").textContent()).includes(
      "lighter local opponent",
    ),
    "worker fallback plays a legal reply",
  );
  await limited.close();
  await spectatorChecks(browser, url, monitor, check, out);
  check(errors.length === 0, `browser errors: ${errors.join("; ")}`);
  check(badRequests.length === 0, `failed assets: ${badRequests.join("; ")}`);
  check(external.length === 0, `external requests: ${external.join("; ")}`);
  console.log(
    JSON.stringify(
      {
        assertions,
        browserErrors: errors,
        failedRequests: badRequests,
        externalRequests: external,
        audio: audioStats,
      },
      null,
      2,
    ),
  );
  await context.close();
} finally {
  await browser.close();
  server?.kill();
}
