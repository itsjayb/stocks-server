/**
 * Call Ollama on Raspberry Pi to generate tweet text from a prompt.
 */

const BASE_URL = (process.env.OLLAMA_BASE_URL || 'http://localhost:11434').replace(/\/$/, '');

const PREFERRED_MODELS = (process.env.OLLAMA_MODEL ? [process.env.OLLAMA_MODEL] : []).concat([
  'llama3.2:latest',
  'llama3.2',
  'llama3:2',
  'gemma2:2b',
  'gemma2',
  'llama2',
  'mistral-7b',
  'mistral',
  'alpaca',
]);

let cachedModel: string | null = null;

async function detectModel(): Promise<string> {
  if (cachedModel) return cachedModel;
  if (process.env.OLLAMA_MODEL) cachedModel = process.env.OLLAMA_MODEL;

  try {
    const res = await fetch(`${BASE_URL}/api/models`);
    if (res.ok) {
      const list = await res.json();
      const available: string[] = Array.isArray(list)
        ? list.map((m: any) => m.name || m.id || m.model).filter(Boolean)
        : [];

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
  } catch {
    // ignore and fall back to preferred list
  }

  cachedModel = PREFERRED_MODELS[0] || 'gemma2:2b';
  return cachedModel;
}
const TIMEOUT_MS = 120000;

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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const text = await res.text();
      if (res.status === 404 || /model.*not found/i.test(text)) {
        console.warn('Ollama model not available:', text.slice(0, 200));
        // Try again without specifying a model so Ollama can use its default
        try {
          const retryBody: any = { prompt, stream: false };
          const retryRes = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(retryBody),
            signal: controller.signal,
          });

          if (retryRes.ok) {
            const retryData = (await retryRes.json()) as { response?: string };
            const retryText = retryData.response;
            if (typeof retryText === 'string') return retryText.trim();
            // fall through to returning empty string
          } else {
            const retryText = await retryRes.text();
            console.warn('Ollama retry (no model) failed:', retryText.slice(0, 200));
          }
        } catch (e) {
          // ignore and fall back to empty
        }

        return '';
      }
      throw new Error(`Ollama HTTP ${res.status}: ${text.slice(0, 200)}`);
    }

    const data = (await res.json()) as { response?: string };
    const text = data.response;
    if (typeof text !== 'string') throw new Error('Ollama response missing .response');
    return text.trim();
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') throw new Error('Ollama request timed out');
    throw err;
  }
}
