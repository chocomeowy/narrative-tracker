import google.generativeai as genai
import os

# Try to get API key from environment
api_key = os.environ.get("GOOGLE_API_KEY")

if not api_key:
    print("Error: GOOGLE_API_KEY not found in environment.")
else:
    genai.configure(api_key=api_key)
    try:
        print("Available Models and Supported Methods:")
        for m in genai.list_models():
            print(f"Name: {m.name}")
            print(f"Description: {m.description}")
            print(f"Supported Methods: {m.supported_generation_methods}")
            print("-" * 30)
    except Exception as e:
        print(f"An error occurred: {e}")
