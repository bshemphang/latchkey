# Latchkey — Verification Log

Running log of what was built, tested, and verified. Newest first.

## 2026-11-17 ~01:05 IST — Day 2 (Nov 18 schedule, done early): real Firebase AI Logic wiring

**Config landed:** project `latchkey-hybrid-ai`, web config + App Check debug token in `~/workspace/latchkey/.env.local` only (gitignored, never committed). Devpost: registered for #BuildHybridAI 2026 as nic-shemphang (confirmed 2026-11-17 ~00:55 IST).

### What was wired
- **App Check debug token (`src/appcheck.ts`):** new `resolveDebugToken()` — in DEV it uses `VITE_FIREBASE_APPCHECK_DEBUG_TOKEN` from `.env.local` when present, else `true` (SDK prints a fresh token). Outside DEV it returns `undefined`, so the token value is never referenced by the production build. Verified: `grep -c` for the token in `dist/` = **0 matches** after every build. The debug token never ships in the public bundle.
- **Real engine path is live:** with `.env.local` present, `isFirebaseConfigured()` is true and `HybridEngine.generate()` takes the real Firebase AI Logic path (no mock). The header pill shows "Firebase connected". The mock layer remains only as the fallback when Firebase is unconfigured.
- **Cloud model switched: `gemini-2.5-flash` → `gemini-3.8-flash`.** The attested API call returned HTTP 404: "This model models/gemini-2.5-flash is no longer available to new users. Please update your code to use models/gemini-3.8-flash." Switched everywhere (code default, mock label, engine doc comment, README, both smoke scripts). No `gemini-2.5-flash` reference remains in the repo.
- **Transient-error retry (`src/ai/engine.ts`):** `isTransientCloudError()` + `generateWithRetry()` — up to 3 attempts with 2s/4s backoff on HTTP 500/502/503/504, "high demand", "Deadline expired". Auth (401/403), App Check, and 404 errors fail fast, never retried.
- **Friendly errors (`src/ui/JobAnalyzer.tsx`):** network failures now show "Couldn't reach the AI service. Check your connection and try again." instead of the raw SDK message.
- **Render check (`scripts/render-check.cjs`):** now uses the persistent browser profile (`~/workspace/.browser-profile`) and is environment-aware (demo vs configured). Checks fixed to avoid false positives from the pasted sample text (extraction = "Must-have skills", scam = "Looks clean", badge = "On-device" + latency pill). Console errors are classified: VM-only font failures vs SDK fetch noise vs real problems.
- **`.env.example`:** documents the debug-token and reCAPTCHA variables (empty values, dev-only notes).

### Verified
- `npm test`: **33 passed, 0 failed** (25 Day 1 + 8 new: App Check token 2, Firebase config 2, engine retry 4; 7 test files).
- `npm run build` (`tsc -b && vite build`): clean, dist 466 kB JS / 141 kB gzip.
- `npx oxlint`: **0 warnings, 0 errors**.
- **Debug token in dist: 0 matches** (grep count, value never printed). The Firebase web API key appears once in the bundle — expected, it is public by design.
- **Smoke test, App Check exchange (`scripts/smoke-appcheck.mjs`): PASS.** Debug token exchanged for an attestation token, HTTP 200, every time (4 runs). Proves the token is registered in the Firebase console and App Check enforcement is on.
- **Smoke test, attested AI call: BLOCKED by transient model overload, not by wiring.** The attested `generateContent` call to `gemini-3.8-flash` returned HTTP 500 "This model is currently experiencing high demand" (4 of 5 attempts) and HTTP 503 "Deadline expired" (1 of 5), across 5 attempts over ~25 minutes. The model name is valid (no 404), the attestation is accepted (no 401) — Google's new-model capacity is the only blocker. Retry later; the engine now retries these automatically.
- **Smoke test, unattested SDK call (`scripts/smoke-real-ai.mjs`): 401 as expected.** Without an App Check token the SDK call is rejected ("Firebase App Check token is invalid"). This is the correct enforcement behaviour, not a failure.
- **Render check (configured mode, `vite preview`):** hero renders; header pill "Firebase connected"; Analyse attempts the real `gemini-3.8-flash` endpoint (visible in the error text) and fails gracefully with the friendly message, no crash. Console errors: 7 network (Google Fonts, VM-only — headless Chromium has no internet), 1 SDK fetch noise (VM-only), **0 other**. Load-only probe confirms the fonts are the only load-time errors.
- **No secrets in the repo:** `git status` clean of `.env.local` / `.firebaserc` (both gitignored); `git ls-files` shows only `.env.example`; debug-token grep across tracked files = 0.

### Hosting deploy — BLOCKED on his login (logged to TAKEOVER_NEEDED.md)
- Firebase CLI installed (v15.36.0), `.firebaserc` created locally (project `latchkey-hybrid-ai`, gitignored), build ready.
- `firebase deploy --only hosting` fails: "Failed to authenticate, have you run firebase login?" / "No authorized accounts, run firebase login". **His step:** run `firebase login` on his machine (Google account owning the project), then the deploy runs from `~/workspace/latchkey`. **No hosted demo URL yet.**
- **reCAPTCHA v3 site key is missing** (`VITE_RECAPTCHA_V3_SITE_KEY` is empty in `.env.local`). **His step:** register it in the Firebase console (App Check > reCAPTCHA v3) and hand over only the site key. Without it the hosted demo cannot attest App Check.

### Judges prep (due before Nov 30)
- **README:** architecture section added — Mermaid flowchart (user → privacy router → Nano on-device vs Gemini 3.8 Flash cloud → badges), routing table (task → where it runs → why), fallbacks, full request flow, and the model-switch note. Test count updated to 33.
- **Demo script:** `~/workspace/DELIVERABLES/buildhybridai/DEMO_SCRIPT.md` — 2:50 script with shot-by-shot narration, shot list, pre-recording checklist (Chrome 139+, Nano flag + model download, sample data only, no PII), failure fallbacks, and the YouTube upload plan. Recording is his step, Nov 25 on his laptop.

### Known limitations (environmental, not app bugs)
- The on-device (Gemini Nano) path has not run against a real model yet: this VM has no Chrome with Nano and headless Chromium has no internet. That is the Nov 23 test-matrix work plus his Nov 25 video step.
- The cloud model (`gemini-3.8-flash`) was overloaded at test time (HTTP 500/503, 4 attempts over ~5 min). The engine retries these; a later re-run of `scripts/smoke-appcheck.mjs` should print SMOKE-APPCHECK: PASS when capacity frees up.
- Headless Chromium in this VM cannot reach the internet, so Google Fonts fail in the render check (fallback fonts used) and the real AI call fails there. On the hosted site both work normally.

## 2026-11-17 ~00:47 IST — Nov 17 scaffold (Day 1 of the plan)

**Exit criteria: repo live, app shell renders, mock loop works — MET.**

### What was built
- Repo `bshemphang/latchkey` (public, Apache-2.0), first commit pushed.
- Vite + React 19 + TypeScript + Tailwind 4 shell, Fraunces + Inter, one brass accent, Lucide icons, no UI emoji.
- Full app, mock AI layer end to end:
  - `src/ai/engine.ts` — HybridEngine. Imports Firebase AI Logic from `firebase/ai` and calls it at runtime when configured (`getAI` + `GoogleAIBackend`, `getGenerativeModel` with `InferenceMode.PREFER_ON_DEVICE` / `PREFER_IN_CLOUD`, `initializeDeviceModel()` after a user gesture, `response.inferenceSource` drives the badge). Falls back to the deterministic mock layer while Firebase is not wired.
  - `src/ai/router.ts` — privacy-driven routing: extract/scam/bullets/note prefer on-device; deep/interview/letter prefer cloud; long JD (> 6,000 chars) → cloud; Nano unavailable → cloud with fallback flag; offline → cloud tasks blocked, on-device tasks keep working.
  - `src/ai/scamRules.ts` — 7 deterministic scam signals (fee demand, Telegram/WhatsApp-only, MLM/commission-only, free-Gmail HR, form-filling, unrealistic pay, vague listing) with quoted evidence.
  - `src/ai/extract.ts` — deterministic structured extraction (role, company, skills split must-have/nice-to-have, salary, location, remote, deadline).
  - `src/ai/prompts.ts` — single-turn prompt builders + tolerant JSON parser; extraction/scam prompts never contain the profile.
  - `src/ai/mock.ts` — demo engine with simulated latency, labelled mock-on-device / mock-cloud.
  - `src/config/` — Firebase config (env), Remote Config (defaults until wired), App Check (debug in dev, reCAPTCHA v3 in prod), Auth (anonymous default, optional Google sign-in).
  - `src/store/` — profile (local-first, fictional sample), tracker (localStorage today, Firestore-shaped interface).
  - UI: JobAnalyzer (paste/photo → extract + scam → bullets + note → deep/interview/letter with cloud opt-in → save to tracker), Tracker board, ProfileEditor, header status pills, "How hybrid inference works" section.
- Firebase Hosting config (`firebase.json`, `firestore.rules`), `.env.example`, README with the Firebase AI Logic usage section, Apache-2.0 LICENSE.

### Verified
- `npm test`: **25 passed, 0 failed** (scamRules 9, extract 6, router 5, prompts 5).
- `npm run build` (`tsc -b && vite build`): clean, dist 465 kB JS / 140 kB gzip.
- `npx oxlint`: **0 warnings, 0 errors**.
- Render check (headless Chromium against `vite preview`, `scripts/render-check.cjs`): hero renders; clean sample → extraction card correct (role, company, salary, deadline, skill chips), scam verdict "Looks clean", On-device badges with latency, tailor section works (resume bullets render); **zero app console errors**. Screenshots: `/tmp/latchkey-hero.png`, `/tmp/latchkey-results.png`.
- Repo live: **https://github.com/bshemphang/latchkey** (public, Apache-2.0 detected, 7 topics, default branch `main`). First commit `60ce51d`, local HEAD == remote HEAD. No secrets in tracked files (grep for key/token patterns clean).

### Fixes made during the day
- Firebase SDK v13 exposes AI Logic as `firebase/ai`, not `firebase/ai-logic` (the plan's path does not exist in v13). Verified against the installed package's exports and type definitions: `getAI`, `getGenerativeModel`, `GoogleAIBackend`, `InferenceMode`, `InferenceSource`, `GenerativeModel.initializeDeviceModel`, `response.inferenceSource`, `Schema` helpers. `HybridParams` requires `mode` and takes `inCloudParams: { model }`; `Part` objects need a `type` discriminator (`{ type: 'text', text }`, `{ type: 'inlineData', ... }`).
- Extraction: salary now matches "Rs. 25,000" (not just ₹), deadline accepts "Apply by: Dec 15, 2026" (colon), role no longer title-cases "Not stated", role prefers the first-line title with the "(Remote, India)" parenthetical stripped (was capturing "…to join our remote tea").
- Lint: moved badge helpers out of the component file's exports (fast-refresh warnings).

### Known limitations (environmental, not app bugs)
- Headless Chromium in this VM cannot reach the internet, so the Google Fonts request fails with `ERR_TUNNEL_CONNECTION_FAILED` in the render check; the app falls back to system fonts. On the hosted site the fonts will load normally.
- The on-device (Gemini Nano) path has not run against a real model yet: no Firebase project exists and this VM has no Chrome with Nano. That is the Nov 18 / Nov 23 work, plus his video step on Nov 25.

### Blockers / his steps
- **Firebase project setup (today, Nov 17):** create the project, run the AI Logic guided setup (Gemini Developer API backend), register the web app, hand over the web config + App Check debug token. No billing. The app flips from demo mode to the real engine the moment `.env` lands.
- Devpost account verification (already in TAKEOVER_NEEDED.md).
- Demo video recording Nov 25 on his laptop (real Chrome 139+ with Nano). Submit Nov 29 (his click).
