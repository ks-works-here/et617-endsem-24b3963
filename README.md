# The Optics Lab

P5 is an inquiry-based Class 10 physics laboratory about refraction and image formation by lenses. It is designed for a learner preparing for an Olympiad who wants to test predictions and explain surprising results. The objectives are to distinguish real and virtual images experimentally, connect ray constructions to image measurements, and revise a hypothesis using evidence.

## Run locally

Use Node.js 22.18 or later and npm. In Windows PowerShell, use the `.cmd` forms if execution policy blocks npm scripts.

```powershell
npm.cmd ci
npm.cmd run dev
```

Open http://localhost:3000. For a production check, run `npm.cmd run build` and then `npm.cmd start`.

## Learning experience

- **Laboratory** at `/lab` guides an approximately ten-minute investigation through briefing, apparatus exploration, prediction and trial, interpretation and revision, and transfer and reflection. The bench displays three principal rays where they intersect the drawn aperture, backward extensions for virtual images, and a movable screen. Measurements become available after a trial. The inside-F investigation gates the conceptual explanation behind the learner's interpretation and provides four successive hints.
- **Olympiad Challenge Arena** at `/olympiad` includes 30 original, automatically graded multiple-choice questions across five categories and three levels, with bookmarks, retries, worked solutions, practice, timed, mixed, and performance-based revision modes. Questions include numerical problems, ray diagrams, and assertion–reason choices.
- **Analytics** at `/analytics` reads recorded hypotheses, trials, revisions, hint usage, session completions, and Arena answers. Expand rows to inspect the full clickstream. Download clickstream CSV or JSON and experiment-history JSON. The export log records requests and record counts. The browser controls where files are saved.

## Implementation

The application uses Next.js App Router, React, TypeScript, CSS, and Canvas. The optics model is in `src/app/optics.ts`, ray rendering in `src/app/ray-bench.tsx`, storage and event collection in `src/app/store.ts`, and export serialization in `src/app/exports.ts`. Lab workflow and Arena state use the same browser-local storage and event layer. Each route owns its presentation and learner workflow.

Measurements use the Cartesian sign convention in centimetres. The real object has `u < 0`, a convex lens has `f > 0`, and a concave lens has `f < 0`. The model computes `1/v = 1/f + 1/u`, `m = v/u`, and image height `m × object height`. Positive `v` is real, negative `v` is virtual, and a zero reciprocal image distance indicates parallel rays with no finite focus. The screen is shown as aligned within 0.5 cm of a real focus. The canvas depicts ideal thin-lens rays and does not model diffraction or aberrations.

Progress, drafts, attempt counts, experiments, events and export history are stored in localStorage for the current browser and origin. Session storage groups general application activity per tab. Lab and challenge session IDs persist with progress. The clickstream adds UUIDs and ISO timestamps to each event. Standard fields are `event_id`, `session_id`, `learner_id`, `timestamp`, `event_type`, `investigation_id`, `experiment_id`, `step` and `details`. Event details include trial settings or Arena question metadata where relevant. The app generates an anonymous learner ID without requesting personal information.

Clickstream CSV uses quoted fields and JSON-encoded detail objects. JSON exports include structured records. Empty reports preserve the CSV header or produce an empty JSON array. Export requests are added to the clickstream after the export snapshot is taken.

## Tests

```powershell
node --test tests/physics.test.cjs
npm.cmd run lint
npm.cmd run build
```

The physics tests cover five finite-image cases, ray intersections, signed magnification and image height, screen alignment, and the focal-plane limit. With Playwright available and the app running, execute `node tests/browser.cjs`. Set `OPTICS_PLAYWRIGHT` to a module path if Playwright is available outside the project, and set `OPTICS_CHROME` to a Chrome executable to use an existing installation. The browser test exercises prediction, the failed trial, hints, revision, refresh and resume, repeat trial, Arena modes, answer feedback, bookmarks, clickstream, and downloaded records.

See [DEMO_GUIDE.md](DEMO_GUIDE.md) for the examination walkthrough.
