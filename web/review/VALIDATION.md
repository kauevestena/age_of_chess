# Browser game validation

Validated on 2026-09-14, based on merged rules-v2 commit
`70e46f3d4ef85dc1a9365b8e8b48c68900ff514d`.

## Results

| Check | Result |
|---|---|
| Focused browser-engine regressions | 14 tests passed |
| Python/JavaScript differential comparison | 11,338 positions; 479,677 legal actions compared; zero mismatches |
| Browser gameplay and integration | 42 assertions passed |
| Browser exceptions / missing assets / external asset requests | 0 / 0 / 0 |
| Mobile input and layout | Touch play passed at 360 px and 390 px; no horizontal overflow |
| Original score | All three pieces rendered non-silent audio, with peaks below clipping |
| Pages path | Exercised `/age_of_chess/`, including module-worker resolution |
| Static package | Contains only HTML, CSS, native modules, SVG art, embedded fonts and licenses |

The differential comparison streams 100 seeded games (up to 120 plies each),
1,200 sparse randomized study positions and 180 ordered melee/stack studies.
It compares every legal action and a sampled full transition, including board,
ownership, turn, move count, terminal reason and ordered casualties. Repetition
history is carried across each game's consecutive positions. Regression tests
also cover third-occurrence draws, forbidden moves, retreat precedence and all
three stack exceptions.

The browser suite exercises both local players, solo AI from either side,
whole-turn undo, hints, keyboard navigation after board rotation, portable
save round-tripping, autosave after reload, battle-history review, resignation,
all seven tutorial lessons, top/bottom selection, melee-versus-ranged choices,
cinematic skipping with both button and Escape, a naturally completed conversion
sequence, menu cancellation of pending AI, and storage/worker failure fallbacks.

Visual review covered the desktop camp and battlefield, the mobile battlefield,
melee and conversion encounters. The figures are deliberately illustrated SVG
units, with original equipment and heraldry. Animations are presentations of
deterministic outcomes; they do not add damage rolls, health pools or combat rules.

## Reproduce

Follow `web/README.md`. The workflow runs the engine and parity checks before
browser tests and before building a Pages artifact. Screenshots and portable
save fixtures are generated under `web/test-results/` and uploaded to each CI
run as `browser-review`; generated screenshots are not production assets.

Local browser testing used Playwright 1.62.1 with headless Chromium 153.0.8010.0.
The standard Playwright browser CDN timed out in this environment, so the local
check used a Chromium binary obtained from the npm distribution
`@sparticuz/chromium` 153.0.0, selected with `AOC_CHROMIUM_PATH`.
This is a local test dependency only and is not shipped in the game or added to
the project dependency graph. CI installs Playwright's matching Chromium.

## AI spectator mode follow-up

Validated on 2026-09-14 against merged browser-game commit
`c585fe5fa47cc679f0aa639ad201328361748133`.

| Check | Result |
|---|---|
| Engine and save regressions | 16 tests passed, including two new spectator-save tests |
| Browser gameplay and integration | 72 assertions passed, including 30 new spectator assertions |
| Browser exceptions / missing assets / external asset requests | 0 / 0 / 0 |
| Spectator presentation | Desktop setup, battlefield and cinematic reviewed; 360 px touch controls passed without horizontal overflow |
| Original score | All three pieces still rendered non-silent audio below clipping |

The spectator suite drives actual AI workers for both armies with independently
selected levels. It verifies continuous alternating play, cancellation of pending
searches, pause/resume, one-order stepping (including rapid repeated clicks),
pace changes, menus, hidden-tab pausing, and leaving the battle. Human orders,
hints, undo and resignation are unavailable in this mode. Local mode restores
its normal controls after leaving a spectator battle.

Autosave reload and portable save import retain both AI levels and restore the
same board with playback paused. Chronicle review also returns paused. A seeded
legal game supplies real encounter and terminal-game fixtures: pausing during a
cinematic and skipping it commits exactly one order, while a completed game
announces its result and disables further playback. Existing solo and local saves
remain accepted; malformed spectator levels and spectator resignations are rejected.

The engine, combat rules, AI evaluation and assets are unchanged. This follow-up
does not add new balance claims or a turn cap; the baseline parity results above
remain the rules validation. The browser suite runs through the existing Pages
project path and CI entry point. Its generated spectator screenshots and save
fixture join the ignored `web/test-results/` review artifacts.

## Rules v3: guarded stance and movement follow-up

Validated on 2026-09-14, based on merged spectator-mode commit
`3451f9c5032a324f13c0edbdeebc5140aaf408fe`.

| Check | Result |
|---|---|
| Python rules, APIs, invariants and training | 405 tests passed, including a short MaskablePPO train/save/load cycle |
| JavaScript engine and records | 24 tests passed, including exhaustive stance combinations |
| Python/JavaScript differential comparison | 10,940 positions; 490,514 legal actions; zero mismatches |
| Browser gameplay and integration | 88 assertions passed |
| Browser exceptions / missing assets / external asset requests | 0 / 0 / 0 |
| Mobile layout and input | 360 px / 390 px touch play passed without horizontal overflow |
| Original score | Three compositions rendered non-silent audio below clipping |
| Canonical generated rules | Export check passed |
| Static Pages package | Build passed |

The differential suite now compares Commander retreat counters and melee approach
sectors as well as boards, legal actions, results and ordered casualties. It adds
256 forced stance transitions covering all eight sectors, both owners, four
ordinary classes, both source slots and solo/formation defenders to the existing
seeded games and sparse studies. Independent regression expectations separately
check the outcomes; parity alone could miss a shared implementation mistake.

New movement regressions cover sideways evasion in the home half, diagonal-only
contact, full destinations, both source slots, and Cavalry passage through a single
ally to empty, friendly or enemy destinations. Full formations and enemies block
intermediate passage. Two-step attacks use the origin to determine stance.

Additional regressions cover ranged return fire in all directions and shooter
slots, lone-Commander endings caused by captures/conversion/cancellation, and
retreat streak preservation, resets, actual displacement and adjudication priority.
Retreat counters are included in observations, clones, repetition, save/load and
replay. V2 saves and checkpoints are incompatible; v2 league records are excluded
from v3 ratings. Historical balance artifacts above remain descriptions of v2.

The browser tutorial now has twelve lessons. New real-board sequences exercise a
fully animated guarded frontal loss, a flank attack, sideways formation entry,
bottom-slot Cavalry passage, and a completed two-way Archer volley. The guide
explains defender-relative sectors, the board shows facing arrows, and retreat
counts remain visible. AI-versus-AI play uses the same updated engine. Browser
checks also restore and undo a real Commander-retreat history, verify board-flip
arrows against fixed logical facing, render all four stance table cells, and
confirm the v2 autosave rejection message. Desktop and mobile screenshots were
visually reviewed, including guarded-front and return-fire encounters.

## Limits

- This validation does not establish expert-level AI strength or new balance
  conclusions. Earlier balance findings describe their original rules. The new movement
  permissions have not been established as balanced by these correctness checks.
  Marshal is a bounded
  heuristic alpha-beta search.
- Chromium desktop and mobile emulation were exercised. Real iOS Safari,
  Firefox, screen-reader usage and physical touch-device/audio playback have
  not been manually tested. Audio synthesis was checked with actual Web Audio
  rendering; these amplitude checks do not judge musical taste.
- Games are saved in the local browser profile. Private mode or disabled storage
  can require manual download. This release supports solo and same-device play,
  not online multiplayer or offline cold-start installation.
- A new repository's Pages source must be set to **GitHub Actions**. The PR does
  not merge itself or publish the live game before review.
