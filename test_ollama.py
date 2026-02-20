#!/usr/bin/env python3
import os
import sys
import json
import requests


def main():
    host = os.environ.get("OLLAMA_HOST", "http://localhost:11434")
    model = os.environ.get("OLLAMA_MODEL")
    prompt = os.environ.get(
        "OLLAMA_PROMPT",
        "Write a short Twitter post about today's stock market in 280 characters or less.",
    )

    if not model:
        print("Error: OLLAMA_MODEL not set. Set the environment variable to your model name.")
        print("Example: export OLLAMA_MODEL=mymodel")
        sys.exit(2)

    url = host.rstrip("/") + "/api/generate"
    payload = {"model": model, "prompt": prompt, "max_tokens": 128}

    print(f"Sending request to {url} with model={model}...")
    try:
        resp = requests.post(url, json=payload, stream=True, timeout=30)
    except Exception as e:
        print("Request failed:", e)
        sys.exit(1)

    ct = resp.headers.get("content-type", "")

    # Handle Server-Sent Events (streaming) typical for Ollama
    if "text/event-stream" in ct:
        print("Streaming response:")
        for raw in resp.iter_lines(decode_unicode=True):
            if not raw:
                continue
            line = raw
            if line.startswith("data: "):
                data = line[len("data: "):]
                if data == "[DONE]":
                    break
                print(data, end="", flush=True)
        print()
    else:
        # Try to parse JSON and extract text-like fields, fallback to raw text
        try:
            j = resp.json()

            def extract_text(obj):
                if isinstance(obj, dict):
                    for k in ("text", "content", "response", "completion"):
                        if k in obj and isinstance(obj[k], str):
                            return obj[k]
                    for v in obj.values():
                        res = extract_text(v)
                        if res:
                            return res
                elif isinstance(obj, list):
                    for item in obj:
                        res = extract_text(item)
                        if res:
                            return res
                elif isinstance(obj, str):
                    return obj
                return None

            text = extract_text(j)
            if text:
                print(text)
            else:
                print(json.dumps(j, indent=2))
        except ValueError:
            print(resp.text)

    print("Done.")


if __name__ == "__main__":
    main()
