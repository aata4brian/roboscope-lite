# QA and delivery status

This document separates observed behavior from checks that remain outstanding.
Source is published in the public `aata4brian/roboscope-lite` GitHub repository.
There is no verified public Vercel deployment yet.

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
