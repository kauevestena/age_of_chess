import { resolve } from "node:path";
import { initialState, transition, legalActions } from "../src/engine.mjs";
import { chooseAction } from "../src/ai.mjs";
import {
  createRecord,
  readRecord,
  SAVE_KEY,
  SETTINGS_KEY,
} from "../src/records.mjs";

const watchConfig = {
  mode: "watch",
  difficulty: "knight",
  humanSide: 1,
  northDifficulty: "squire",
  southDifficulty: "squire",
};

// Legal game histories exercise a real encounter and a terminal capture through
// the normal importer, without exposing a test-only board editor in the game.
function battleFixtures() {
  let seed = 614,
    encounter;
  const random = () => (seed = (1664525 * seed + 1013904223) >>> 0) / 2 ** 32;
  for (let game = 0; game < 6; game++) {
    let state = initialState();
    const moves = [];
    for (let ply = 0; ply < 300 && state.winner === null; ply++) {
      const { action } = chooseAction(state, "squire", {
        random,
        budgetMs: 200,
      });
      const result = transition(state, action);
      if (
        !encounter &&
        result.event.kind > 0 &&
        result.state.winner === null &&
        result.event.losses.length &&
        result.event.losses.every(
          (loss) => Math.sign(loss.unit) !== state.turn,
        ) &&
        !legalActions(state).some(
          (a) => transition(state, a).state.winner === state.turn,
        )
      ) {
        encounter = createRecord(
          moves.map((a) => [...a]),
          watchConfig,
        );
      }
      if (result.state.winner === 1 || result.state.winner === -1)
        return { encounter, ending: createRecord(moves, watchConfig) };
      moves.push(action);
      state = result.state;
    }
  }
  throw Error("Could not produce a decisive AI game fixture");
}

export async function spectatorChecks(browser, url, monitor, check, out) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
    acceptDownloads: true,
  });
  await context.addInitScript(
    ({ settingsKey }) => {
      if (!localStorage.getItem(settingsKey))
        localStorage.setItem(
          settingsKey,
          JSON.stringify({
            sound: false,
            motion: "reduced",
            battles: "quick",
            watchDelay: 250,
          }),
        );
      window.aiRequests = [];
      const OriginalWorker = window.Worker;
      window.Worker = class extends OriginalWorker {
        postMessage(message, ...rest) {
          window.aiRequests.push({
            turn: message.state.turn,
            difficulty: message.difficulty,
          });
          return super.postMessage(message, ...rest);
        }
      };
    },
    { settingsKey: SETTINGS_KEY },
  );
  const page = await context.newPage();
  monitor(page);
  await page.goto(url);
  const recordText = () =>
    page.evaluate((key) => localStorage.getItem(key), SAVE_KEY);
  const ply = async () => JSON.parse(await recordText()).moves.length;
  const idle = () =>
    page.waitForFunction(
      () =>
        document.querySelector("#board").getAttribute("aria-busy") === "false",
    );
  const waitMoves = (count) =>
    page.waitForFunction(
      ({ key, count }) =>
        JSON.parse(localStorage.getItem(key)).moves.length >= count,
      { key: SAVE_KEY, count },
    );
  const pause = async () => {
    if (
      (await page.locator("#watch-toggle").getAttribute("aria-pressed")) !==
      "true"
    )
      await page.locator("#watch-toggle").click();
    await idle();
  };
  try {
    await page.locator("input[name=mode][value=watch]").check();
    await page.locator("#north-difficulty").selectOption("squire");
    await page.locator("#south-difficulty").selectOption("marshal");
    check(
      (await page.locator("#difficulty-field").isHidden()) &&
        (await page.locator("#allegiance-field").isHidden()),
      "spectators configure both AIs, not a human banner",
    );
    await page.screenshot({
      path: resolve(out, "spectator-lobby.png"),
      fullPage: true,
    });
    await page.locator("#begin").click();
    await waitMoves(4);
    await pause();
    const requests = await page.evaluate(() => window.aiRequests.slice(0, 4));
    check(
      requests.length === 4 &&
        requests.every(
          (r, i) =>
            r.turn === (i % 2 ? -1 : 1) &&
            r.difficulty === (i % 2 ? "marshal" : "squire"),
        ),
      "both AI levels are dispatched to the correct army",
    );
    check(
      (await page.locator("#watch-matchup").textContent()).includes(
        "Azure: Squire · Ember: Marshal",
      ),
      "spectator matchup is visible",
    );
    let before = await ply();
    await page.waitForTimeout(650);
    check(
      (await ply()) === before,
      "pause stops scheduled and subsequent orders",
    );
    check(
      (await page.locator("#undo-button").isHidden()) &&
        (await page.locator("#hint-button").isHidden()),
      "spectator controls do not offer human orders",
    );
    const state = readRecord(await recordText()).state,
      action = legalActions(state)[0];
    await page.locator(`[data-index="${action[0] * 8 + action[1]}"]`).click();
    check(
      (await page.locator(".legal-target").count()) === 0,
      "inspection does not expose playable destinations",
    );
    await page.locator(`[data-index="${action[3] * 8 + action[4]}"]`).click();
    await page.keyboard.press("u");
    check(
      (await ply()) === before && !(await page.locator("#modal").isVisible()),
      "mouse and keyboard cannot take over either AI",
    );
    await page.evaluate(() => {
      document.querySelector("#watch-step").click();
      document.querySelector("#watch-step").click();
    });
    await waitMoves(before + 1);
    await idle();
    await page.waitForTimeout(500);
    check(
      (await ply()) === before + 1,
      "rapid Next order clicks issue exactly one ply and remain paused",
    );
    await page.locator("#watch-pace").selectOption("2500");
    await page.locator("#watch-toggle").click();
    before = await ply();
    await page.waitForTimeout(500);
    check(
      (await ply()) === before,
      "Leisurely pace adds a delay before the next order",
    );
    await page.locator("#watch-pace").selectOption("250");
    await waitMoves(before + 2);
    await pause();
    check(
      (await ply()) >= before + 2,
      "Resume continues automatic play for both armies",
    );
    await page.screenshot({
      path: resolve(out, "spectator-desktop.png"),
      fullPage: true,
    });
    before = await ply();
    await page.locator("#review-button").click();
    check(
      await page.locator("#watch-toggle").isDisabled(),
      "live controls are disabled during review",
    );
    await page.locator("#replay-next").click();
    await page.locator("#replay-exit").click();
    await page.waitForTimeout(450);
    check(
      (await ply()) === before &&
        (await page.locator("#watch-toggle").textContent()) === "Resume",
      "leaving review retains the paused live battle",
    );
    const downloading = page.waitForEvent("download");
    await page.locator("#export-button").click();
    await (await downloading).saveAs(resolve(out, "spectator-save.json"));
    await page.reload();
    await page.locator("#continue").click();
    await page.waitForTimeout(450);
    check(
      (await ply()) === before &&
        (await page.locator("#watch-toggle").textContent()) === "Resume",
      "autosaved AI battles restore paused",
    );
    await page.locator("#menu-button").click();
    check(
      (await page.locator("#resign").count()) === 0,
      "a spectator cannot resign on behalf of an AI",
    );
    await page.locator("#return-camp").click();
    await page
      .locator("#file-input")
      .setInputFiles(resolve(out, "spectator-save.json"));
    await page.locator("#watch-controls").waitFor({ state: "visible" });
    check(
      (await ply()) === before &&
        JSON.parse(await recordText()).config.southDifficulty === "marshal",
      "portable spectator saves restore both commander levels",
    );
    // Cancel an actual delayed worker result, not only an idle inter-turn timer.
    await page.evaluate(() => {
      const OriginalWorker = window.Worker;
      window.Worker = class extends OriginalWorker {
        postMessage(message, ...rest) {
          window.pendingWatchSearch = true;
          this.delay = setTimeout(
            () => super.postMessage(message, ...rest),
            500,
          );
        }
        terminate() {
          clearTimeout(this.delay);
          return super.terminate();
        }
      };
    });
    await page.locator("#watch-toggle").click();
    await page.waitForFunction(() => window.pendingWatchSearch);
    await pause();
    await page.waitForTimeout(650);
    check(
      (await ply()) === before,
      "pausing an active worker discards its pending order",
    );
    await page.locator("#watch-toggle").click();
    await page.locator("#guide-button").click();
    await page.waitForTimeout(800);
    check((await ply()) === before, "opening a menu suspends spectator play");
    await page.locator("#modal-close").click();
    await waitMoves(before + 1);
    await pause();
    check(
      (await ply()) > before,
      "closing the menu resumes an unpaused spectator battle",
    );
    before = await ply();
    await page.locator("#watch-toggle").click();
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", {
        configurable: true,
        get: () => true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await idle();
    await page.waitForTimeout(400);
    check(
      (await ply()) === before &&
        (await page.locator("#watch-toggle").textContent()) === "Resume",
      "hidden tabs pause spectator playback",
    );
    await page.evaluate(() => {
      delete document.hidden;
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.locator("#menu-button").click();
    await page.locator("#return-camp").click();
    await page.waitForTimeout(500);
    check(
      (await page.locator("#lobby").isVisible()) && (await ply()) === before,
      "leaving the spectator screen cancels all further orders",
    );
    await page.locator("input[name=mode][value=local]").check();
    await page.locator("#begin").click();
    check(
      (await page.locator("#watch-controls").isHidden()) &&
        (await page.locator("#undo-button").isVisible()),
      "new human games restore ordinary controls",
    );
  } finally {
    await context.close();
  }

  const fixtures = battleFixtures();
  check(
    !!fixtures.encounter,
    "legal AI game provides a nonterminal encounter fixture",
  );
  for (const [name, record] of Object.entries(fixtures)) {
    const cinema = await browser.newContext({
      viewport: { width: 1000, height: 950 },
    });
    await cinema.addInitScript(
      ({ record, saveKey, settingsKey }) => {
        localStorage.setItem(saveKey, JSON.stringify(record));
        localStorage.setItem(
          settingsKey,
          JSON.stringify({
            sound: false,
            battles: "cinematic",
            watchDelay: 250,
          }),
        );
      },
      { record, saveKey: SAVE_KEY, settingsKey: SETTINGS_KEY },
    );
    const p = await cinema.newPage();
    monitor(p);
    try {
      await p.goto(url);
      await p.locator("#continue").click();
      await p.locator("#watch-toggle").click();
      await p.locator("#battle-dialog").waitFor({ state: "visible" });
      await p.locator("#pause-battle").click();
      if (name === "encounter")
        await p.screenshot({ path: resolve(out, "spectator-cinematic.png") });
      await p.locator("#skip-battle").click();
      await p.waitForFunction(
        () =>
          document.querySelector("#board").getAttribute("aria-busy") ===
          "false",
      );
      await p.waitForTimeout(500);
      const count = await p.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)).moves.length,
        SAVE_KEY,
      );
      check(
        count === record.moves.length + 1,
        `${name}: pause during a cinematic commits its order exactly once`,
      );
      if (name === "ending") {
        check(
          (await p.locator("#modal-title").textContent()).includes("prevails"),
          "AI battle declares its winner automatically",
        );
        await p.locator("#result-review").click();
        check(
          (await p.locator("#watch-toggle").isDisabled()) &&
            (await p.locator("#watch-step").isDisabled()),
          "terminal games cannot schedule further AI turns",
        );
      } else
        check(
          (await p.locator("#watch-toggle").textContent()) === "Resume",
          "the next army stays paused after a cinematic",
        );
    } finally {
      await cinema.close();
    }
  }
  const mobile = await browser.newContext({
    viewport: { width: 360, height: 844 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: "reduce",
  });
  const p = await mobile.newPage();
  monitor(p);
  try {
    await p.goto(url);
    await p.locator("input[name=mode][value=watch]").check();
    check(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      "spectator setup fits a 360px phone",
    );
    await p.locator("#begin").tap();
    await p.locator("#watch-toggle").tap();
    await p.waitForFunction(
      () =>
        document.querySelector("#board").getAttribute("aria-busy") === "false",
    );
    check(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      "spectator controls fit a 360px phone",
    );
    await p.locator("#watch-step").tap();
    await p.waitForFunction(
      () =>
        document.querySelector("#turn-number").textContent === "02" &&
        document.querySelector("#board").getAttribute("aria-busy") === "false",
    );
    check(
      (await p.locator("#watch-toggle").textContent()) === "Resume",
      "mobile Next order pauses after one AI move",
    );
    await p.screenshot({
      path: resolve(out, "spectator-mobile.png"),
      fullPage: true,
    });
  } finally {
    await mobile.close();
  }
}
