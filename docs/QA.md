# QA and delivery status

This document separates observed behavior from checks that remain outstanding.
Source is published in the public `aata4brian/roboscope-lite` GitHub repository.
Public demo: https://roboscope-lite.vercel.app/. Live smoke checks on 13 October
2026 verified anonymous access, all three fault detections, motor-stall replay at
2×, and reload persistence. Hardware validation remains outstanding.

## Replay timing — 13 October 2026

The old replay advanced by 100 ms per timer callback. When the browser delayed
callbacks, the recording permanently fell behind. The new cursor is derived from
an anchor position, speed, and elapsed `performance.now()` time. Pause, seeking,
and speed changes re-anchor the playback; its cursor never exceeds the last
received packet. A delayed callback catches up when it eventually executes.
This does not force background screen updates or guarantee progress during OS
sleep, whose monotonic-clock behavior varies by platform.

Seven new behavioral tests cover irregular callbacks at 0.5×/1×/2×, deferred
callbacks, end clamping, clock guards, and speed changes. The browser suite also
checks all speed options, pausing, mid-play speed changes, delayed callbacks with
`clock.fastForward`, system-clock changes, slider Home/End/ArrowLeft, and mouse
scrubbing while playing. It retains the existing recording/CSV regressions.

References: [performance.now](https://developer.mozilla.org/en-US/docs/Web/API/Performance/now)
and [Playwright Clock](https://playwright.dev/docs/clock). Controlled-clock
checks are deterministic regression tests, not device-performance benchmarks.
Local behavioral count: 36. Browser CI results are recorded in the PR.

## CSV export — 13 October 2026

The incident page now exports the received packet window as CSV. Six new tests
check all telemetry values for all three fault types, complete UTC dates across
midnight, relative detection time, sequence gaps, partial capture status, and
formula-like imported IDs without changing negative numeric measurements.
The browser suite additionally downloads CSV through the actual button for each
fault and compares it with the recorded packet window; it verifies that storage
is unchanged. It also checks the export panel at the existing responsive widths.

Local checks: 29 behavioral tests passed. TypeScript/build and remote CI results
are recorded in the PR. Do not treat a preview build as verification that this
feature is already released on the public demo.

Format references: [RFC 4180](https://www.rfc-editor.org/rfc/rfc4180) and
[OWASP CSV Injection](https://owasp.org/www-community/attacks/CSV_Injection).

## Dependency maintenance — 13 October 2026

Next.js was updated from 16.2.6 to 16.4.0 and the lockfile was refreshed for
patched transitive releases. This reduced the production audit from six known
advisories (1 moderate, 4 high, 1 critical) to none reported by npm at the time
of this check.

| Check | Observed result |
| --- | --- |
| clean `npm ci` | Passed |
| `npm audit --omit=dev` | 0 advisories |
| `npm test` | 23 passed, 0 failed |
| `npm run typecheck` | Passed |
| `npm run build` | Passed with Next.js 16.4.0 |
| `git diff --check` | Passed |

The local browser rerun did not start because no Chromium executable was
present and the Playwright CDN download returned an empty archive in this
environment. This is recorded as an environment limitation, not a passing
browser result. The GitHub Actions workflow installs its own Chromium and must
pass the existing nine-check suite on this branch before merge.

## Recording transfer verification — 13 October 2026

The latest branch adds recording export/import and strict validation. These are
local results; there is still no verified public deployment.

| Check | Observed result |
| --- | --- |
| `npm test` | 23 passed, 0 failed |
| `npm run typecheck` | Passed |
| `npm run build` | Passed |
| `npm run test:browser` | All 9 reported browser checks passed |
| `git diff --check` | Passed |
| `npm audit --omit=dev` | 6 advisories at that checkpoint; resolved by the later dependency update above |

The browser suite runs the production build using headless Chromium 153 and a
controlled browser clock. It drives each fault from the UI, downloads the actual
recording, imports it into a separate browser context, verifies unchanged JSON,
reloads, opens the incident, and checks jump-to-detection and 2× playback.
Simulation time is accelerated for testing; these are not wall-clock benchmarks.

Other checks: five malformed/unsupported/oversized files leave existing storage
unchanged; import cancellation preserves the current run; quota failure leaves an
exportable in-memory recording; a valid import recovers corrupted local storage.
The dashboard, import preview, and all three replay pages have no page overflow at
1440, 1280, 768, and 390 px. No uncaught browser errors occurred. Screenshots of the
import panel and motor-stall replay were captured and visually reviewed at desktop
and mobile sizes. The table's hidden header previously escaped its scroll
container at 390 px; a positioned wrapper fixes that specific cause.

See `browser-results.json` for the recorded checks and `screenshots/` for captures.
The CI workflow now runs type checking and the browser suite as well as tests/build.
Remote CI status must be checked separately after pushing.

At that historical checkpoint, public deployment, playback-rate accuracy, slider
drag/keyboard behavior, and real hardware validation remained outstanding.
The dated sections above record subsequent work; real hardware validation remains open.
The dependency advisories from this checkpoint were patched in the later update
above. A clean audit is only one release check and does not prove an application
has no security defects.

References reviewed for this implementation (13 October 2026):

- [MDN: Blob.text](https://developer.mozilla.org/en-US/docs/Web/API/Blob/text)
- [MDN: URL.createObjectURL](https://developer.mozilla.org/en-US/docs/Web/API/URL/createObjectURL_static)
- [MDN: localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage)

These are API references. No third-party source code or design assets were copied.

## Historical checks — September 2026

## Automated checks

Final local verification on **2026-09-27**:

| Command | Result |
| --- | --- |
| `npm test` | 15 passed, 0 failed |
| `npm run typecheck` | Passed |
| `npm run build` | Passed; dashboard and dynamic incident route compiled |
| `git diff --check` | Passed |

The suite contains 15 behavioral tests for:

- Normal motion, wheel kinematics, encoder integration, battery use, and timestamps.
- Reproducible output for a fixed seed and fault schedule.
- Motor-stall current, speed, RPM, and temperature relationships.
- Wheel-slip encoder motion and ground-path divergence.
- Each of the three incident types, sustained detection, and original-sample evidence.
- Replaying received packets into a detector without fault-injection metadata.
- Network packet gaps with unchanged physical motion.
- Resistance to a transient spike and detector rearming after recovery.
- Full and partial capture windows, archive preservation, and storage validation.
- The ten-minute session limit, twelve-incident retention, and unique IDs after retention rotates.

The malformed-storage checks include empty recordings and empty evidence arrays.
Run `npm test`, `npm run typecheck`, and `npm run build` from the project root.
The GitHub Actions workflow runs these checks on pushes to `main` and pull
requests. Its live results are available in the repository Actions tab.

## Observed browser behavior

The application was opened in a real browser during development. These checks
were performed on the desktop UI:

| Check | Observed result |
| --- | --- |
| Dashboard | Metrics, four charts, trajectory, controls, and incident table rendered |
| Start and pause | Telemetry advanced while running and stopped when paused |
| Browser persistence | Reload restored a paused session at 118.4 s with 592 packets |
| Motor Stall button | Current rose and ground velocity fell; the detector created one critical incident |
| Recovery | Motion recovered after the injected fault expired |
| Incident navigation | Opening the incident displayed its original evidence and timeline |
| Capture window | The inspected incident contained 201 samples spanning 30 s before and 10 s after detection |
| Replay | Play/pause worked; the clock, chart cursor, metrics, and trajectory marker advanced together |
| Playback speed | The 2× option was selected; exact wall-clock playback-rate accuracy was not measured |
| Jump to detection | Cursor and metrics moved to the detection sample |

For the inspected motor-stall incident, the evidence showed left current
**1.32 → 7.14 A**, left wheel speed **100.20 → 4.19 rpm**, and ground velocity
**0.70 → 0.11 m/s**. Detection was at **15:52:51 UTC**, and the comparison sample
was at **15:52:45 UTC**. These were values displayed by the running application,
not hand-authored incident fixtures.

Two genuine browser captures are included in `docs/screenshots/`:

- `dashboard.jpg`: running normal telemetry.
- `motor-stall.jpg`: elevated current, reduced velocity, and a detected incident.

## Outstanding browser checks

The next browser action was denied because automatic approval review hit its
usage limit. The action did not execute, and no alternate browser mechanism was
used to bypass that block. Consequently, the following remain unverified:

- Slider keyboard and drag interactions across the complete replay window.
- Timing accuracy and completion behavior at each of 0.5×, 1×, and 2×.
- Wheel Slip and Network Degradation through their complete UI workflows.
- Visual layouts at every requested width: 1440, 1280, 768, and 390 px.
- A final screenshot of the incident detail/replay page.
- Browser verification of the final small changes to archived-recording text
  and malformed-storage handling.

The three fault models and their detector/incident paths are covered by the
automated tests. That coverage does not substitute for the outstanding UI checks.

## Resolved development issues

- Session IDs now use `crypto.getRandomValues`, which works on the plain HTTP
  development origin where `crypto.randomUUID` was unavailable.
- The development launcher translates preview supervisor flags to Next.js flags.
- Incident IDs remain unique after the retained archive reaches twelve entries.
- Invalid saved incidents with empty evidence are rejected before rendering.
- Archived partial recordings explain that their original session has ended.
- A transient Next.js development-manifest parse error cleared on reload; the
  supervised preview is stopped before the final production build.

## Publication status and next steps

The user created the public `aata4brian/roboscope-lite` repository on 2026-09-27.
The project is published on `main` through the connected GitHub integration,
preserving the initial repository commit. No other repository was modified.

The connected Vercel team was reachable, but its deployment operation returned
`Tool deploy_to_vercel not found`. There is no verified deployment URL.

To complete deployment:

1. Confirm the latest GitHub Actions run passes.
2. Import this repository into Vercel using the README deployment settings.
3. Complete the outstanding browser checks on the production URL, capture the
   replay screenshot, and add the verified URL to the README.

This is a working implementation with documented validation limits. Deployment
and the remaining browser checks are still open.
