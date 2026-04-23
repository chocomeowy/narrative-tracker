import requests
import json as json_lib
import os
import re
from datetime import datetime

# Configuration (GitHub Secrets)
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN")
GITHUB_REPO = os.environ.get("GITHUB_REPO")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")

def fetch_current_state():
    url = f"https://api.github.com/repos/{GITHUB_REPO}/contents/crypto_trend_map.json"
    headers = {"Authorization": f"token {GITHUB_TOKEN}"}
    r = requests.get(url, headers=headers)
    if r.status_code == 200:
        import base64
        content = r.json()
        return json_lib.loads(base64.b64decode(content['content']).decode('utf-8'))
    return {"trends": []}

def get_search_results(query):
    try:
        from ddgs import DDGS
        with DDGS() as ddgs:
            results = [r['body'] for r in ddgs.text(query, max_results=10)]
            return results
    except Exception as e:
        print(f"Search error: {e}")
        return []

def run_agent():
    print("Starting Crypto Narrative Intelligence Agent...")
    
    # 1. Load Current State
    current_map = fetch_current_state()
    
    # 2. Gather Intelligence
    queries = [
        "Bitcoin (BTC) institutional adoption and ETFs",
        "Ethereum (ETH) L2 scaling and restaking narratives",
        "Clarity Act Senate crypto regulation 2026",
        "Cross-chain liquidity between BTC and ETH"
    ]
    
    raw_intel = []
    for q in queries:
        print(f"Searching for: {q}")
        raw_intel.extend(get_search_results(q))

    # 3. Reasoning with Gemini
    prompt = f"""
    Role: Senior Crypto Intelligence Analyst
    
    Context:
    Current Trends: {json_lib.dumps(current_map)}
    New Intel: {json_lib.dumps(raw_intel)}
    
    Task: Update the Crypto Intelligence Map.
    - Focus heavily on the BTC/ETH relationship and the impact of the Clarity Act.
    - Discover new sub-narratives (e.g. Stacks/Clarity development, ETH restaking).
    - DO NOT return an empty 'trends' list unless there is absolutely zero new data.
    - Return ONLY a valid JSON object matching this structure:
      {{
        "trends": [
          {{ "name": "Trend Name", "stage": "...", "velocity": "...", "summary": "...", "evidence": "..." }}
        ]
      }}
    - DO NOT include any preamble, thinking process, or explanation.
    - YOUR FIRST CHARACTER MUST BE '{{' AND YOUR LAST CHARACTER MUST BE '}}'.
    """

    # Upgraded to Gemma 4 (released April 2, 2026)
    models_to_try = [
        "gemma-4-31b-it",
        "gemma-3-27b-it",
        "gemini-2.0-flash-exp",
        "gemini-1.5-flash-latest"
    ]
    
    res_json = {}
    successful_model = None
    
    for model_id in models_to_try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_id}:generateContent?key={GEMINI_API_KEY}"
        headers = {'Content-Type': 'application/json'}
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "response_mime_type": "application/json"
            }
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
                    print(f"Model {model_id} returned no JSON. Trying next...")
                    continue
        except requests.exceptions.Timeout:
            print(f"Model {model_id} timed out. Trying next model...")
            continue
        except Exception as e:
            print(f"Error calling {model_id}: {e}")
            continue
        
        # If rate limited (429), log and try next model
        error_code = res_json.get('error', {}).get('code')
        if error_code == 429:
            print(f"Rate limit hit for {model_id}. Switching...")
            continue

    if not successful_model:
        print("All models failed.")
        return

    raw_response = res_json['candidates'][0]['content']['parts'][0]['text'].strip()
    
    # Find the first '{' to start decoding
    start_index = raw_response.find('{')
    if start_index != -1:
        try:
            decoder = json_lib.JSONDecoder()
            ai_output, _ = decoder.raw_decode(raw_response[start_index:])
            ai_trends = ai_output.get("trends", ai_output.get("active_trends", []))
        except Exception as e:
            print(f"JSON raw_decode failed: {e}")
            # Fallback to existing logic if raw_decode fails (ensure we only pass the JSON part)
            ai_output = json_lib.loads(raw_response[start_index:]) 
            ai_trends = ai_output.get("trends", ai_output.get("active_trends", []))
    else:
        print("No JSON object found in AI response")
        print(f"DEBUG: Raw response received: {raw_response[:500]}...") # Print first 500 chars
        return
        
    final_trends_map = {t.get("name", ""): t for t in current_map.get("trends", [])}
    
    for ait in ai_trends:
        name = ait.get("name", "")
        if not name: continue
        
        if name in final_trends_map:
            merged = final_trends_map[name].copy()
            for k, v in ait.items():
                if v: merged[k] = v
            final_trends_map[name] = merged
        else:
            final_trends_map[name] = ait
    
    updated_map = {
        "last_updated": datetime.utcnow().isoformat() + "Z",
        "trends": list(final_trends_map.values()),
        "intelligence_metadata": {
            "agent": successful_model,
            "focus": "BTC / ETH / Clarity",
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }
    }
    
    # 6. Save back to local file
    with open("crypto_trend_map.json", "w") as f:
        json_lib.dump(updated_map, f, indent=2)
    print("Successfully updated crypto_trend_map.json")

if __name__ == "__main__":
    run_agent()
