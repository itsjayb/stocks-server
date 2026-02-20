/**
 * Call Ollama on Raspberry Pi to generate tweet text from a prompt.
 */

const BASE_URL = (process.env.OLLAMA_BASE_URL || 'http://localhost:11434').replace(/\/$/, '');
const MODEL = process.env.OLLAMA_MODEL || 'gemma2:2b';
const TIMEOUT_MS = 120000;

export async function generateTweet(prompt: string): Promise<string> {
  const url = `${BASE_URL}/api/generate`;
  const body = {
    model: MODEL,
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
