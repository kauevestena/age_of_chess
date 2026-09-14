# Age of Chess — Warfare: browser game

A complete static client for the canonical rules v4. The browser runs all rules,
AI search, animation, audio synthesis and save management. There are no accounts,
API keys, analytics, server requests for moves, or external runtime dependencies.
All fonts, art and music ship with the game. No service worker is installed:
once loaded a session needs no network, but a cold reload still needs the site.

## Play and develop locally

From the repository root, with Node 20 or newer:

```sh
node web/scripts/serve.mjs
```

Open `http://127.0.0.1:4173/age_of_chess/`. The server also supports `/`.
Do not open `index.html` via `file://`: native modules and workers need HTTP.
`npm run build --prefix web` writes a deployable `web/dist` with only runtime
files; neither npm dependencies nor the research implementation are deployed.

## Features

- Solo play as either side against Squire, Knight or Marshal, and two players on
  one device. Both banners use identical rules. This release has no online multiplayer.
- **Watch a battle:** AI-versus-AI spectator mode, with an independent AI level
  for each army, Pause/Resume, Next order and three playback paces. The existing
  soundtrack and cinematic battles accompany the match.
- Fourteen interactive lessons, all six unit descriptions and a full combat table.
- Original illustrated unit figures, landscape, heraldry, stone board, medieval
  typography, and a responsive layout with touch and keyboard controls.
- Deterministic attack previews, explicit ranged/melee selection, accessible
  A/B member and physical-arrangement buttons and legal-destination markers.
- Cinematic melee exchanges, cavalry charges, arrow volleys, conversions,
  formation survivors, impact particles and unit deaths. Escape skips safely;
  Quick and reduced-motion modes shorten or remove motion.
- Three original compositions: **Banners in the Mist**, **The Ashen March** and
  **A Crown at Dusk**, using synthesized plucked strings, recorder, drones,
  percussion and bells, plus battle effects. Music/effects have separate volumes.
  Audio starts with a user gesture, mutes from the header and pauses in hidden tabs.
- Automatic local saves, portable JSON export/import, full-turn solo undo,
  full-turn local undo, resignation, terminal results and step-through battle review.
- Worker-based, time-bounded AI search with cancellation and a local fallback.
  Marshal is a deeper heuristic search, not a trained or expert-strength model.

## Watch an AI battle

In the war camp, choose **Watch a battle**, select each commander's level, then
**Watch battle**. North moves first and the armies alternate automatically until
the normal victory or draw conditions. All decisions still run locally.

- **Pause / Resume** stops or restarts automatic orders. A pending search is
  canceled immediately. An order already animating finishes once before pausing;
  the cinematic dialog also provides **Pause after this order**.
- **Next order** plays exactly one AI turn while paused. Both AIs retain their
  selected levels, and their move still receives its usual animation.
- **Pace** adds a 0.25 s (Brisk), 1.2 s (Steady), or 2.5 s (Leisurely) interval
  before the next search. Animation and search time are additional. Settings
  offers quick encounters or reduced motion for faster viewing.
- Pause to inspect either army or enter battle review. Spectators cannot issue
  manual moves, request hints, undo turns or resign for an AI.
- Save/Load and autosave preserve the entire game and both AI levels. Restored
  spectator games and returning from review stay paused until **Resume**.
  Switching to a hidden tab also pauses the battle.

A spectator step completes up to three preparations and exactly one normal order.
There is no turn cap, material adjudication, online service or automatic rematch.
Rules v4 saves support all three modes; older rules versions require a new battle.

## GitHub Pages

The `Browser game and GitHub Pages` workflow validates pull requests without
deploying them. After merging into `main`, it builds and deploys `web/dist`.
The expected project URL is `https://kauevestena.github.io/age_of_chess/`.
For the initial deployment, a repository administrator must select
**Settings → Pages → Build and deployment → Source → GitHub Actions**.
If the first deployment ran before that setting was selected, rerun the workflow
on `main` using **Run workflow**. No custom domain or secrets are needed.

All asset and module URLs are relative, including the AI worker, so project
subpaths and custom domains work. The deployment job requires successful tests,
uses the `github-pages` environment and grants Pages write permissions only there.
See [GitHub's custom Pages workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## Rules and testing

The executable browser configuration is generated from the validated YAML:

```sh
python -m venv .venv
.venv/bin/pip install numpy pydantic PyYAML gymnasium pettingzoo
.venv/bin/python web/scripts/export_rules.py
.venv/bin/python web/scripts/export_rules.py --check
npm ci --prefix web
npm test --prefix web
node web/tests/parity.mjs
cd web
npx playwright install --with-deps chromium
npm run test:browser
```

`engine.mjs` is immutable at its public transition boundary. The canonical action
tuple and all ordered combat outcomes match Python. `rules.mjs` is generated;
edit `rulesets/default.yaml`, regenerate, and run parity when changing rules.
The differential test streams reproducible random games, sparse study positions,
and all ordered melee pairs with stack variants from Python; it compares every
legal action, arrangement, pending preparation, contact wave, board transition,
casualty, turn and terminal outcome. The browser
suite tests the actual `/age_of_chess/` path, mobile and desktop input, tutorial
combat, saved records, both AI orientations, hints, undo, review, audio output,
fonts, and missing/external asset requests. Spectator checks cover both AI levels,
continuous play, pending-worker cancellation, single stepping, pace, menus,
save/load, review, cinematic pausing, terminal games and mobile viewing.
Screenshots go to `web/test-results/`
and are attached to GitHub Actions runs as the `browser-review` artifact.

Portable saves store actions and replay them through validated rules, including
repetition history. Imported HTML or executable content is never evaluated.
Imports are limited to 2 MB / 20,000 action records (including preparations). Saves are local to a browser profile;
use the Save button to transfer between devices. If browser storage is unavailable,
the game clearly offers manual download. There is no game-imposed ply cap.

## Art and licensing

No artwork, sound recordings, music, logos or extracted files from Age of Empires
or any other game are included. All SVG artwork and audio compositions are
original to this project. The visual reference is the broad medieval strategy
genre: muted landscapes, heraldry, parchment tones and ornamented metalwork.

Cinzel and IM Fell English are redistributed under SIL OFL 1.1, with the full
copyright/license texts in `licenses/`. Embedded WOFF2 files were converted from
the unmodified font sources; the outlines and names are unchanged:

- [Cinzel source](https://github.com/google/fonts/blob/main/ofl/cinzel/Cinzel%5Bwght%5D.ttf), blob `d218a0b9c8879fd5a708872cc0ef357e507b35ca`.
- [IM Fell English source](https://github.com/google/fonts/blob/main/ofl/imfellenglish/IMFeENrm28P.ttf), blob `275d754ed6be5d26e37c6ccdb4934a0930dcbe3f`.

The score notes and instrumentation are in `src/audio.mjs`; unit art is in
`src/art.mjs`. These are intentionally editable, text-based source assets.
Audio activation follows [Web Audio best practices](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices).

## Rules v4 formations and compatibility

Select an existing formation to see both physical subcells and choose A or B to
act. Four arrangement buttons let you swap members or change axis, once per
formation and up to three formations before your normal order. The budget stays
visible. Flipping the board rotates the drawing, not the underlying layout or
army facing. Undo first cancels pending preparations, otherwise a complete turn.
Partial-turn saves restore the remaining budget; review includes each preparation.

Combat first applies class counters. E–W braces the entire front arc and exposes
both units to a direct rear attack; N–S exposes both at the side flanks. Other
approaches meet the nearest member followed by a ready reserve if the attacker
survives. There is no fatigue or old stack-counter exception. Cinematics follow
the actual contact sequence, including reserve and simultaneous casualties.
Arrows may select either exposed member, and ineligible screens block deeper shots.

AI searches normal orders, then applies a bounded defensive planner to persistent
formations. It does not exhaustively search every combination of three preparations
and future orders; this is a heuristic opponent, not a balance proof.

Old v3 and earlier records are explicitly rejected because the same orders now
have different outcomes. Start a new battle under v4. The static build and all
original artwork, typography and locally synthesized music remain self-contained.
