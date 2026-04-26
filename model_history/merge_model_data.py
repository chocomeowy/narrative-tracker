import json
import re

# Precise Mapping for common models
MANUAL_MAP = {
    "Gemini 3 Flash": "gemini-3-flash-preview",
    "Gemini 3.1 Pro": "gemini-3.1-pro-preview",
    "Gemini 3.1 Flash Lite": "gemini-3.1-flash-lite-preview",
    "Gemma 4 31B": "gemma-4-31b-it",
    "Gemma 3 27B": "gemma-3-27b-it",
    "Deep Research Pro Preview": "deep-research-pro-preview-12-2025",
    "Nano Banana Pro (Gemini 3 Pro Image)": "nano-banana-pro-preview",
    "Veo 3 Generate": "veo-3.0-generate-001",
    "Imagen 4 Generate": "imagen-4.0-generate-001",
    "Gemini 2.5 Pro": "gemini-2.5-pro",
    "Gemini 2.5 Flash": "gemini-2.5-flash",
}

def normalize(name):
    return re.sub(r'[^a-z0-9]', '', name.lower())

with open('/Users/fj/code/projects/narrative-tracker/scratch/full_models_list.json', 'r') as f:
    list_models_raw = json.load(f)
    tech_models = {normalize(m['name'].replace('models/', '')): m for m in list_models_raw['models']}

with open('/Users/fj/code/projects/narrative-tracker/scratch/model_limits_2026_04_26.json', 'r') as f:
    quota_data = json.load(f)

print("# Model ID Correlation Table\n")
print("| Display Name | Technical ID (API Name) | Input Token Limit |")
print("| :--- | :--- | :--- |")

for q in quota_data['models']:
    display_name = q['name']
    tech_id = MANUAL_MAP.get(display_name)
    
    if not tech_id:
        norm_q = normalize(display_name)
        for tid in tech_models:
            if tid in norm_q or norm_q in tid:
                tech_id = tech_models[tid]['name'].replace('models/', '')
                break
    
    match_info = tech_models.get(normalize(tech_id or ""))
    limit = match_info.get('inputTokenLimit', 'N/A') if match_info else 'N/A'
    
    print(f"| {display_name} | `{tech_id or 'NOT_FOUND'}` | {limit} |")
