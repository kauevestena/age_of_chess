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

## Limits

- This validation does not establish expert-level AI strength or new balance
  conclusions. The original balance findings still apply. Marshal is a bounded
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
