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

API_KEY = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")


class GeminiClient:

    def __init__(self):
        self.available = False
        self.model = None

        if genai is None:
            return

        if not API_KEY:
            return

        try:
            genai.configure(api_key=API_KEY)
            # model name can be adjusted or made configurable
            self.model = genai.GenerativeModel("gemini-2.5-flash")
            self.available = True
        except Exception:
            self.available = False

    def generate(self, prompt: str) -> str:

        if not self.available:
            return (
                "ERROR: Gemini client not configured or package 'google.generativeai' not installed. "
                "Set GOOGLE_API_KEY in .env and install google-generativeai to enable LLM features."
            )

        try:
            response = self.model.generate_content(prompt)
            return response.text
        except Exception as e:
            print(f"Gemini Error: {e}")
            return f"ERROR: {e}"


gemini_client = GeminiClient()