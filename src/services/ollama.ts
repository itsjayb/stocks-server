/**
 * Call Ollama on Raspberry Pi to generate tweet text from a prompt.
 */

import { execFile } from 'child_process';

const BASE_URL = (process.env.OLLAMA_BASE_URL || 'http://localhost:11434').replace(/\/$/, '');

const PREFERRED_MODELS = (process.env.OLLAMA_MODEL ? [process.env.OLLAMA_MODEL] : []).concat([
  'llama3.2:latest',
  'llama3.2',
]);

let cachedModel: string | null = null;

async function detectModel(): Promise<string> {
  if (cachedModel) return cachedModel;
  if (process.env.OLLAMA_MODEL) cachedModel = process.env.OLLAMA_MODEL;

  try {
    // Try legacy `/api/models` then newer `/v1/models` which may return { data: [...] }
    let res = await fetch(`${BASE_URL}/api/models`);
    if (!res.ok) {
      res = await fetch(`${BASE_URL}/v1/models`);
    }
    if (res.ok) {
      const list = await res.json();
      let available: string[] = [];

      if (Array.isArray(list)) {
        available = list.map((m: any) => m.name || m.id || m.model).filter(Boolean);
      } else if (list && Array.isArray(list.data)) {
        available = list.data.map((m: any) => m.id || m.name || m.model).filter(Boolean);
      }

      for (const pref of PREFERRED_MODELS) {
        if (available.includes(pref)) {
          cachedModel = pref;
          return cachedModel;
        }
      }

      for (const pref of PREFERRED_MODELS) {
        const key = pref.split(':')[0].toLowerCase();
        const match = available.find(a => String(a).toLowerCase().includes(key));
        if (match) {
          cachedModel = match;
          return cachedModel;
        }
      }
    }
  } catch (err) {
    console.warn('Ollama detectModel failed — falling back to preferred models', (err as Error).message);
  }

  cachedModel = PREFERRED_MODELS[0] || 'llama3.2:latest';
  return cachedModel;
}
const TIMEOUT_MS = 120000; // legacy overall timeout (kept for logs)
const REQUEST_TIMEOUT_MS = Number(process.env.OLLAMA_REQUEST_TIMEOUT_MS) || 60000;
const MAX_RETRIES = Number(process.env.OLLAMA_MAX_RETRIES) || 3;

function runCliGenerate(model: string, prompt: string, timeoutMs = REQUEST_TIMEOUT_MS): Promise<string> {
  return new Promise((resolve, reject) => {
    const cmd = 'ollama';
    const args = ['run', model || 'llama3.2:latest', prompt, '--format', 'json', '--nowordwrap'];
    const child = execFile(cmd, args, { timeout: timeoutMs }, (err, stdout, stderr) => {
      if (err) {
        return reject(err);
      }
      try {
        const out = stdout && stdout.trim();
        if (!out) return resolve('');
        // Try to parse JSON output first
        try {
          const parsed = JSON.parse(out);
          // Common field `response` or just a string
          if (parsed && typeof parsed === 'object') {
            if (typeof parsed.response === 'string') return resolve(parsed.response.trim());
            // Some versions print { output: '...' } or similar
            if (typeof parsed.output === 'string') return resolve(parsed.output.trim());
            // If the JSON is simply an array or object with text, fallback to stringifying
            return resolve(JSON.stringify(parsed));
          }
          return resolve(String(parsed));
        } catch (e) {
          // Not JSON — return raw text
          return resolve(out);
        }
      } catch (e) {
        return reject(e);
      }
    });
    // propagate stderr for debugging
    child.stderr?.on('data', (d) => {
      // eslint-disable-next-line no-console
      console.warn('ollama CLI stderr:', String(d).trim());
    });
  });
}

async function fetchWithTimeout(input: any, init: any = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(input, { ...init, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

export async function generateTweet(prompt: string): Promise<string> {
  // Validate BASE_URL to avoid invalid placeholder values like http://<raspberry-pi-ip>
  try {
    // eslint-disable-next-line no-new
    new URL(BASE_URL);
  } catch {
    console.warn('Ollama base URL is invalid:', BASE_URL, '— skipping LLM and using fallback.');
    return '';
  }

  const url = `${BASE_URL}/api/generate`;
  const model = await detectModel();
  const body = {
    model,
    prompt,
    stream: false,
  };

  try {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const attemptDesc = `attempt ${attempt + 1}/${MAX_RETRIES + 1}`;
      try {
        const res = await fetchWithTimeout(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }, REQUEST_TIMEOUT_MS);

        if (!res.ok) {
          const text = await res.text();
          if (res.status === 404 || /model.*not found/i.test(text)) {
            console.warn('Ollama model not available:', text.slice(0, 200));
            // Try again without specifying a model so Ollama can use its default
            try {
              const retryRes = await fetchWithTimeout(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, stream: false }),
              }, REQUEST_TIMEOUT_MS);

              if (retryRes.ok) {
                const retryData = (await retryRes.json()) as { response?: string };
                const retryText = retryData.response;
                if (typeof retryText === 'string') return retryText.trim();
              } else {
                const retryText = await retryRes.text();
                console.warn('Ollama retry (no model) failed:', retryText.slice(0, 200));
              }
            } catch (e) {
              console.warn('Ollama retry (no model) error:', e);
            }

            return '';
          }
          console.error('Ollama generate returned non-OK response', { url, status: res.status, bodyText: text.slice(0, 200) });
          throw new Error(`Ollama HTTP ${res.status}: ${text.slice(0, 200)}`);
        }

        const data = (await res.json()) as { response?: string };
        const text = data.response;
        if (typeof text !== 'string') throw new Error('Ollama response missing .response');
        return text.trim();
      } catch (err) {
        const isAbort = (err as any)?.name === 'AbortError';
        console.warn(`Ollama ${attemptDesc} failed`, { url, model, error: err, isAbort });
        if (attempt < MAX_RETRIES) {
          const backoff = 500 * Math.pow(2, attempt);
          // eslint-disable-next-line no-await-in-loop
          await new Promise((r) => setTimeout(r, backoff));
          continue;
        }
        if (isAbort) {
          console.error('Ollama request timed out', { url, model, requestBody: body, timeoutMs: REQUEST_TIMEOUT_MS });
          throw new Error('Ollama request timed out');
        }
        console.error('Ollama request failed', { url, model, requestBody: body, error: err });
        throw err;
      }
    }

    throw new Error('Ollama generate exhausted retries');
  } catch (err) {
    // If HTTP generation failed, try CLI fallback
    try {
      // eslint-disable-next-line no-console
      console.warn('Falling back to ollama CLI run due to HTTP errors', err);
      const model = await detectModel();
      const cliText = await runCliGenerate(model, prompt);
      return cliText ? cliText.trim() : '';
    } catch (e) {
      throw err;
    }
  }
}
