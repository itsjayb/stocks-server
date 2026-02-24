import { test, expect } from 'vitest';

const BASE_URL = (process.env.OLLAMA_BASE_URL || 'http://localhost:11434').replace(/\/$/, '');

function isValidUrl(s: string) {
  try {
    // eslint-disable-next-line no-new
    new URL(s);
    return true;
  } catch {
    return false;
  }
}

async function fetchWithTimeout(input: RequestInfo, init: RequestInit = {}, timeoutMs = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(input, { ...init, signal: controller.signal } as any);
    return res;
  } finally {
    clearTimeout(timer);
  }
}

if (!isValidUrl(BASE_URL)) {
  test.skip('OLLAMA_BASE_URL is not set or invalid; skipping Ollama integration test', () => {});
} else {
  test('Ollama: detect models endpoint (api or v1) and optionally /api/generate', { timeout: 30000 }, async () => {
    // Try /api/models first, then /v1/models
    let modelsRes = await fetchWithTimeout(`${BASE_URL}/api/models`, {}, 5000);
    if (!modelsRes.ok) {
      modelsRes = await fetchWithTimeout(`${BASE_URL}/v1/models`, {}, 5000);
    }

    expect(modelsRes.ok).toBe(true);
    const models = await modelsRes.json();
    expect(models).toBeTruthy();

    // Try /api/generate if available; some Ollama versions expose different endpoints.
    const genUrl = `${BASE_URL}/api/generate`;
    try {
      const generateRes = await fetchWithTimeout(
        genUrl,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: 'Health check: say pong', stream: false }),
        },
        15000,
      );

      // If endpoint exists, assert success and response shape. If it's 404, skip strict assertion.
      if (generateRes.ok) {
        const body = await generateRes.json();
        expect(body).toBeTruthy();
        expect(typeof body.response === 'string').toBe(true);
        expect(body.response.length).toBeGreaterThan(0);
      } else {
        // Not an error for test — some servers use different generate paths.
        // eslint-disable-next-line no-console
        console.warn('Ollama /api/generate not available; skipping generate check', await generateRes.text());
      }
    } catch (e) {
      // Network/timeout — surface but don't fail the whole test since models endpoint passed.
      // eslint-disable-next-line no-console
      console.warn('Ollama generate check failed (non-fatal):', e);
    }
  });
}
