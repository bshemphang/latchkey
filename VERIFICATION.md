# Latchkey — Verification Log

Running log of what was built, tested, and verified. Newest first.

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
- No secrets in the repo: `.env` is gitignored, `.env.example` holds placeholders only, sample profile and postings are fictional, no real PII.

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
