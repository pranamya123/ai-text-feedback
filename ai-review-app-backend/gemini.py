import os
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

model = genai.GenerativeModel("gemini-pro")

def get_justification(selected_text: str, grounding_docs: str):
    prompt = f"""A user selected the following text from an AI-generated summary:
---
{selected_text}
---

Verify the accuracy and provide justification using these source documents:
---
{grounding_docs}
---

Respond concisely in 3-4 sentences. Highlight factual accuracy or errors explicitly."""

    response = model.generate_content(prompt)
    return response.text
