/**
 * Smoke test: real Firebase AI Logic cloud call from Node.
 *
 * Reads the Firebase web config from .env.local (never prints any value),
 * creates the AI Logic client (Gemini Developer API backend) and runs one
 * tiny PREFER_IN_CLOUD generation. This validates the project, the API key,
 * and the model end to end from this machine. It does NOT test the
 * on-device (Gemini Nano) path — that needs a real Chrome with Nano.
 *
 * App Check is not attached here (Node has no browser attestation), so if
 * the Firebase project enforces App Check for AI Logic this call fails
 * with an App Check error — that is an informative result, not a bug:
 * the browser path (debug token in dev, reCAPTCHA v3 in prod) is the
 * attested path. Free tier: a few tokens, $0.
 *
 * Usage: node scripts/smoke-real-ai.mjs
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
const required = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
];
const missing = required.filter((k) => !env[k]);
if (missing.length > 0) {
  console.error('SMOKE: FAIL — .env.local missing:', missing.join(', '));
  process.exit(1);
}

const { initializeApp } = await import('firebase/app');
const { getAI, getGenerativeModel, GoogleAIBackend, InferenceMode } =
  await import('firebase/ai');

const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || undefined,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || undefined,
  appId: env.VITE_FIREBASE_APP_ID || undefined,
});
const ai = getAI(app, { backend: new GoogleAIBackend() });
const model = getGenerativeModel(ai, {
  mode: InferenceMode.PREFER_IN_CLOUD,
  inCloudParams: { model: 'gemini-3.8-flash' },
});

const started = Date.now();
try {
  const result = await model.generateContent(
    'Reply with exactly the word OK and nothing else.',
  );
  const text = result.response.text().trim();
  const source = result.response.inferenceSource;
  console.log(
    JSON.stringify({
      ok: true,
      text,
      inferenceSource: source,
      latencyMs: Date.now() - started,
    }),
  );
  if (text !== 'OK') {
    console.error('SMOKE: FAIL — unexpected response text');
    process.exit(1);
  }
  console.log('SMOKE: PASS — real Firebase AI Logic cloud call works');
} catch (e) {
  console.error(
    JSON.stringify({
      ok: false,
      code: e?.code ?? 'unknown',
      message: String(e?.message ?? e).slice(0, 300),
      latencyMs: Date.now() - started,
    }),
  );
  console.error('SMOKE: FAIL — see error above');
  process.exit(1);
}
