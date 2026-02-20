Ollama test script

Usage

1. Install dependency:

```bash
python3 -m pip install -r requirements.txt
```

2. Set environment variables and run (example):

```bash
export OLLAMA_HOST=http://192.168.1.10:11434
export OLLAMA_MODEL=mymodel
python3 test_ollama.py
```

The script will POST to the Ollama `/api/generate` endpoint using the provided model and print the response. It supports streaming (SSE) and non-streaming responses.
