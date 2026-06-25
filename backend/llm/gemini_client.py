import os
from pathlib import Path
from dotenv import load_dotenv

# Lazy-import google.generativeai to avoid import-time errors when missing
try:
    import google.generativeai as genai
except Exception:
    genai = None

# Load .env from project root
BASE_DIR = Path(__file__).resolve().parent.parent.parent
load_dotenv(BASE_DIR / ".env")


class GeminiClient:

    def __init__(self):
        self.available = False
        self.model = None
        self.api_keys = []
        self.current_key_idx = 0

        if genai is None:
            return

        # 1. Collect all potential keys from environment variables
        keys_dict = {}
        # Standard env vars first
        for key_name in ["GOOGLE_API_KEY", "GEMINI_API_KEY"]:
            val = os.getenv(key_name)
            if val and val.strip():
                keys_dict[key_name] = val.strip()

        # Numbered/indexed keys: scan os.environ
        for k, v in os.environ.items():
            if (k.startswith("GEMINI_API_KEY_") or k.startswith("GOOGLE_API_KEY_")) and v and v.strip():
                keys_dict[k] = v.strip()

        # Sort by key names to ensure deterministic order (e.g., _1, _2, _3)
        sorted_keys = sorted(keys_dict.keys())
        for k in sorted_keys:
            self.api_keys.append(keys_dict[k])

        # De-duplicate while preserving order
        seen = set()
        self.api_keys = [x for x in self.api_keys if not (x in seen or seen.add(x))]

        if not self.api_keys:
            return

        try:
            # Set the initial active key
            self._use_key(0)
            self.available = True
        except Exception:
            self.available = False

    def _use_key(self, idx):
        if not self.api_keys:
            return
        key = self.api_keys[idx]
        genai.configure(api_key=key)
        self.model = genai.GenerativeModel("gemini-2.5-flash")
        self.current_key_idx = idx

    def generate(self, prompt: str) -> str:

        if not self.available or not self.api_keys:
            return (
                "ERROR: Gemini client not configured or package 'google.generativeai' not installed. "
                "Set GOOGLE_API_KEY in .env and install google-generativeai to enable LLM features."
            )

        last_error = "Unknown error"
        start_idx = self.current_key_idx
        # Try each available API key starting from the last working key
        for attempt in range(len(self.api_keys)):
            idx = (start_idx + attempt) % len(self.api_keys)
            try:
                self._use_key(idx)
                response = self.model.generate_content(prompt)
                # Success! Persist this index as the active key
                self.current_key_idx = idx
                return response.text
            except Exception as e:
                last_error = str(e)
                print(f"Gemini Error with key index {idx}: {last_error}")
                continue

        return f"ERROR: All configured API keys failed. Last error: {last_error}"


gemini_client = GeminiClient()