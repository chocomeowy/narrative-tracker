import requests
import json as json_lib
import os
import re
import sys
from datetime import datetime

# Configuration (GitHub Secrets)
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN")
GITHUB_REPO = os.environ.get("GITHUB_REPO")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
SEARCH_API_KEY = os.environ.get("SEARCH_API_KEY")

def repair_json(s):
    # Find markdown blocks if present
    md_match = re.search(r'```json\s*(.*?)\s*```', s, re.DOTALL)
    if md_match:
        s = md_match.group(1)
    else:
        # Otherwise find first '{' and last '}'
        start = s.find('{')
        end = s.rfind('}')
        if start != -1 and end != -1:
            s = s[start:end+1]
            
    # Fix single quotes around keys/values
    s = re.sub(r"'(.*?)'", r'"\1"', s)
    # Fix unquoted keys
    s = re.sub(r'([{,])\s*([a-zA-Z0-9_]+)\s*:', r'\1"\2":', s)
    # Fix Python-style True/False/None
    s = s.replace(': True', ': true').replace(': False', ': false').replace(': None', ': null')
    # Fix trailing commas in arrays/objects
    s = re.sub(r',\s*([\]}])', r'\1', s)
    return s

def fetch_current_state():
    url = f"https://api.github.com/repos/{GITHUB_REPO}/contents/tax_trend_map.json"
    headers = {"Authorization": f"token {GITHUB_TOKEN}"}
    r = requests.get(url, headers=headers)
    if r.status_code == 200:
        import base64
        content = r.json()
        return json_lib.loads(base64.b64decode(content['content']).decode('utf-8'))
    return {"trends": []}

def fetch_steering():
    url = f"https://api.github.com/repos/{GITHUB_REPO}/contents/tax_steering.json"
    headers = {"Authorization": f"token {GITHUB_TOKEN}"}
    r = requests.get(url, headers=headers)
    if r.status_code == 200:
        import base64
        content = r.json()
        return json_lib.loads(base64.b64decode(content['content']).decode('utf-8'))
    return {}

def get_search_results(query):
    try:
        from ddgs import DDGS
        with DDGS() as ddgs:
            results = [r['body'] for r in ddgs.text(query, max_results=5)]
            return results
    except Exception as e:
        print(f"Search error: {e}")
        return []

def run_agent():
    print("Starting Tax Intelligence Agent...")
    sys.stdout.flush()
    
    # 1. Load Current State & Steering
    current_map = fetch_current_state()
    steering = fetch_steering()
    
    # 2. Gather Intelligence
    queries = steering.get("focus_areas", [
        "Corporate tax rate changes global 2026",
        "International trade tariffs updates",
        "Global minimum corporate tax Pillar Two",
        "Singapore corporate tax policy shifts"
    ])
    
    raw_intel = []
    for q in queries:
        print(f"Searching for: {q}")
        sys.stdout.flush()
        raw_intel.extend(get_search_results(q))

    # 3. Reasoning with Gemini
    prompt = f"""
    Role: Senior Tax Policy Analyst
    
    Context:
    Current Trends: {json_lib.dumps(current_map)}
    New Intel: {json_lib.dumps(raw_intel)}
    Steering Directives: {json_lib.dumps(steering)}
    
    Task: Perform a deep analysis and update the intelligence map.
    
    Guidelines for Recursive Improvement:
    1. Evolution: Use 'New Intel' to update existing trends. If a trend's stage has shifted, update it.
    2. Pruning: You are part of a long-term loop. If a trend in 'Current Trends' is no longer supported by 'New Intel', DO NOT include it in your output. You MUST KEEP the total number of trends under 25.
    3. Arrangement: Keep the map focused. Merge similar narratives to prevent duplication.
    4. Categorization: Assign a short, descriptive `category` (e.g., "Corporate Tax", "Tariffs", "International") to every trend.
    
    1. Executive Briefing: Analyze the latest tax policy shifts, focusing on Corporate Tax and International Tariffs.
    
    2. Data Update: At the end of your response, provide the updated trends in a strict JSON block.
       YOU MUST include the 'executive_briefing' as a string field inside the top-level JSON object.
       The `stage` MUST BE exactly one of: "Incubation", "Breakthrough", "Peak Hype", or "Fatigue".
       ```json
       {{
         "executive_briefing": "...",
         "trends": [
           {{ "name": "...", "stage": "...", "velocity": "...", "category": "...", "summary": "...", "evidence": "...", "confidence": 0.9 }}
         ]
       }}
       ```
    """

    # Upgraded to Gemma 4 (released April 2, 2026)
    models_to_try = [
        "gemma-4-31b-it",
        "gemma-3-27b-it",
        "gemini-1.5-flash",
        "gemini-1.5-pro"
    ]
    
    res_json = {}
    successful_model = None
    
    for model_id in models_to_try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_id}:generateContent?key={GEMINI_API_KEY}"
        headers = {'Content-Type': 'application/json'}
        payload = {
            "contents": [{"parts": [{"text": prompt}]}]
        }
        # Only enable JSON mode for Gemini models
        if "gemini" in model_id:
            payload["generationConfig"] = {
                "response_mime_type": "application/json"
            }
        
        try:
            response = requests.post(url, headers=headers, json=payload, timeout=60)
            res_json = response.json()
            if "candidates" in res_json:
                text = res_json['candidates'][0]['content']['parts'][0]['text']
                if '{' in text:
                    successful_model = model_id
                    print(f"Success using {model_id} (Found JSON)")
                    break
                else:
                    print(f"Model {model_id} returned NO JSON structure. Text: {text[:100]}...")
                    continue
            else:
                print(f"Model {model_id} API Error: {res_json.get('error', {}).get('message', 'No candidates')}")
                continue
        except requests.exceptions.Timeout:
            print(f"Model {model_id} timed out after 60s.")
            continue
        except Exception as e:
            print(f"Error calling {model_id}: {e}")
            continue

    if not successful_model:
        print("All models failed.")
        return

    raw_response = res_json['candidates'][0]['content']['parts'][0]['text'].strip()
    
    # 4. Save Markdown Briefing
    with open("tax_briefing.md", "w") as f:
        f.write(f"# Tax Intelligence Briefing - {datetime.utcnow().strftime('%Y-%m-%d %H:%M')}\n\n")
        f.write(raw_response)
    print("Saved tax_briefing.md")

    # 5. Extract JSON for Map & Briefing
    start_index = raw_response.find('{')
    if start_index != -1:
        try:
            decoder = json_lib.JSONDecoder()
            ai_output, _ = decoder.raw_decode(raw_response[start_index:])
            ai_trends = ai_output.get("trends", ai_output.get("active_trends", []))
            briefing_text = ai_output.get("executive_briefing", raw_response[:start_index].strip())
        except Exception as e:
            print(f"JSON raw_decode failed: {e}. Attempting repair...")
            try:
                repaired = repair_json(raw_response)
                ai_output = json_lib.loads(repaired)
                ai_trends = ai_output.get("trends", ai_output.get("active_trends", []))
                briefing_text = ai_output.get("executive_briefing", "Repair successful but briefing missing.")
            except Exception as repair_e:
                print(f"Repair failed: {repair_e}")
                ai_output = json_lib.loads(raw_response[start_index:]) 
                ai_trends = ai_output.get("trends", ai_output.get("active_trends", []))
                briefing_text = "Briefing extraction failed."
    else:
        print("No JSON object found in AI response")
        return
        
    historical_map = {t.get("name", ""): t for t in current_map.get("trends", [])}
    final_trends_map = {}
    
    for ait in ai_trends:
        name = ait.get("name", "")
        if not name: continue
        
        if name in historical_map:
            merged = historical_map[name].copy()
            merged.update(ait)
            final_trends_map[name] = merged
        else:
            final_trends_map[name] = ait
    
    updated_map = {
        "last_updated": datetime.utcnow().isoformat() + "Z",
        "executive_briefing": briefing_text,
        "trends": list(final_trends_map.values()),
        "intelligence_metadata": {
            "agent": successful_model,
            "focus": "Corporate Tax / Tariffs",
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }
    }
    
    # 6. Save back to local file
    with open("tax_trend_map.json", "w") as f:
        json_lib.dump(updated_map, f, indent=2)
    print("Successfully updated tax_trend_map.json")

if __name__ == "__main__":
    run_agent()
