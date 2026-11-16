/**
 * Smoke test: App Check debug-token exchange + attested AI call.
 *
 * Proves the full attested path works without a browser: exchanges the
 * dev debug token from .env.local for an App Check attestation token,
 * then calls the Firebase AI Logic endpoint with it. This is exactly what
 * the browser SDK does under the hood (debug provider in dev).
 *
 * Never prints any credential: only HTTP statuses, the response text,
 * and latencies. Free tier: a few tokens, $0.
 *
 * Usage: node scripts/smoke-appcheck.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const envPath = path.join(root, '.env.local');

function loadEnv() {
  const out = {};
  if (!fs.existsSync(envPath)) return out;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return out;
}

const env = loadEnv();
const apiKey = env.VITE_FIREBASE_API_KEY;
const projectId = env.VITE_FIREBASE_PROJECT_ID;
const appId = env.VITE_FIREBASE_APP_ID;
const debugToken = env.VITE_FIREBASE_APPCHECK_DEBUG_TOKEN;
if (!apiKey || !projectId || !appId || !debugToken) {
  console.error('SMOKE-APPCHECK: FAIL — .env.local is missing a required value');
  process.exit(1);
}

const started = Date.now();

// Step 1: exchange the debug token for an App Check attestation token.
const exchangeUrl = `https://firebaseappcheck.googleapis.com/v1/projects/${projectId}/apps/${appId}:exchangeDebugToken`;
const exRes = await fetch(exchangeUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
  body: JSON.stringify({ debug_token: debugToken }),
});
const exBody = await exRes.json().catch(() => ({}));
// The API returns the attestation JWT in `token` (not `attestationToken`).
const attestationToken = exBody.token ?? exBody.attestationToken;
if (!exRes.ok || !attestationToken) {
  console.error(
    JSON.stringify({
      step: 'exchangeDebugToken',
      httpStatus: exRes.status,
      error: String(exBody?.error?.message ?? exBody?.error ?? 'no attestation token').slice(0, 200),
    }),
  );
  console.error('SMOKE-APPCHECK: FAIL — debug token exchange failed (is the token registered in the Firebase console?)');
  process.exit(1);
}
console.log(
  JSON.stringify({
    step: 'exchangeDebugToken',
    httpStatus: exRes.status,
    exchanged: true,
    latencyMs: Date.now() - started,
  }),
);

// Step 2: attested AI call, same endpoint the SDK uses.
const genUrl = `https://firebasevertexai.googleapis.com/v1beta/projects/${projectId}/models/gemini-3.8-flash:generateContent`;
const genRes = await fetch(genUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-goog-api-key': apiKey,
    'X-Firebase-AppCheck': attestationToken,
  },
  body: JSON.stringify({
    contents: [
      { parts: [{ text: 'Reply with exactly the word OK and nothing else.' }] },
    ],
  }),
});
const genBody = await genRes.json().catch(() => ({}));
const text = genBody?.candidates?.[0]?.content?.parts
  ?.map((p) => p.text ?? '')
  .join('')
  .trim();
if (!genRes.ok || text !== 'OK') {
  console.error(
    JSON.stringify({
      step: 'generateContent',
      httpStatus: genRes.status,
      error: String(genBody?.error?.message ?? 'unexpected response').slice(0, 200),
    }),
  );
  console.error('SMOKE-APPCHECK: FAIL — attested AI call failed');
  process.exit(1);
}
console.log(
  JSON.stringify({
    step: 'generateContent',
    httpStatus: genRes.status,
    text,
    latencyMs: Date.now() - started,
  }),
);
console.log('SMOKE-APPCHECK: PASS — debug token registered, App Check attested, real AI call works');
