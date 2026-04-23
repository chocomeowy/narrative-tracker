import requests
import json as json_lib
import os
import base64
import re
from datetime import datetime

# Configuration (Use Pipedream Env Variables)
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN")
GITHUB_REPO = os.environ.get("GITHUB_REPO") # e.g. "username/trend-velocity-tracker"
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
SEARCH_API_KEY = os.environ.get("SEARCH_API_KEY") # SerpApi or Brave

def fetch_github_file(path):
    url = f"https://api.github.com/repos/{GITHUB_REPO}/contents/{path}"
    headers = {"Authorization": f"token {GITHUB_TOKEN}"}
    r = requests.get(url, headers=headers)
    if r.status_code == 200:
        content = r.json()
        return json_lib.loads(base64.b64decode(content['content']).decode('utf-8')), content['sha']
    return None, None

def update_github_file(path, content_obj, sha, message):
    url = f"https://api.github.com/repos/{GITHUB_REPO}/contents/{path}"
    headers = {"Authorization": f"token {GITHUB_TOKEN}"}
    content_str = json_lib.dumps(content_obj, indent=2)
    encoded = base64.b64encode(content_str.encode('utf-8')).decode('utf-8')
    data = {
        "message": message,
        "content": encoded,
        "sha": sha
    }
    requests.put(url, headers=headers, json=data)

def get_search_results(query):
    """
    Uses DuckDuckGo Search (Free, no API key required).
    Install 'duckduckgo-search' in Pipedream if needed.
    """
    try:
        from duckduckgo_search import DDGS
        with DDGS() as ddgs:
            results = [r['body'] for r in ddgs.text(query, max_results=5)]
            return results
    except Exception as e:
        print(f"Search error for {query}: {e}")
        return [f"Error fetching data for {query}"]

def summarize_context(trend_map):
    """Reduces the trend_map to a snapshot to save Gemini tokens."""
    summary = {
        "last_updated": trend_map.get("last_updated"),
        "active_trends": []
    }
    for t in trend_map.get("trends", []):
        summary["active_trends"].append({
            "name": t["name"],
            "stage": t["stage"],
            "velocity": t["velocity"]
        })
    return summary

def handler(pd: "pipedream"):
    # 1. Fetch Current State
    current_map, sha = fetch_github_file("trend_map.json")
    steering, _ = fetch_github_file("steering.json")
    
    # 2. Context Optimization
    past_state_summary = summarize_context(current_map)
    
    # 3. Gather New Intelligence
    focus_areas = steering.get("focus_areas", ["emerging technology"])
    raw_intelligence = []
    for q in focus_areas[:2]:
        raw_intelligence.extend(get_search_results(q))
    
    # 4. Call Gemini (Direct REST API)
    prompt_text = f"""
    Role: Narrative Intelligence Officer
    Directives: {json_lib.dumps(steering)}
    Past State Snapshot: {json_lib.dumps(past_state_summary)}
    New Raw Data: {json_lib.dumps(raw_intelligence)}
    
    Task: Update the trend_map.json based on this new data.
    - IMPORTANT: For any NEW trends you find, you MUST provide a 'summary' (1-2 sentences) and 'evidence' (sources).
    - For existing trends in the snapshot, update their 'stage' and 'velocity' if the data suggests a change.
    - Do not remove trends from the list unless they are truly 'Fatigue' or dead.
    - Return ONLY a valid JSON object matching the schema.
    - DO NOT include any preamble, thinking process, or explanation. 
    - Just the JSON.
    """

    # Upgraded to Gemma 4 26B (MoE)
    models_to_try = [
        "gemma-4-26b-a4b-it",
        "gemini-3-flash-preview", 
        "gemini-2.5-flash", 
        "gemini-2.0-flash", 
        "gemma-3-27b-it",
        "gemini-flash-latest"
    ]
    res_json = {}
    
    for model_id in models_to_try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_id}:generateContent?key={GEMINI_API_KEY}"
        headers = {'Content-Type': 'application/json'}
        payload = {
            "contents": [{
                "parts": [{"text": prompt_text}]
            }]
        }
        
        response = requests.post(url, headers=headers, json=payload, timeout=25)
        res_json = response.json()
        
        # If successful, break
        if "candidates" in res_json:
            print(f"Success using {model_id}")
            break
            
        # If rate limited (429) or model not found (404), log and try next model
        error_code = res_json.get('error', {}).get('code')
        error_msg = res_json.get('error', {}).get('message', 'Unknown error')
        
        if error_code == 429:
            print(f"Rate limit hit for {model_id}. Switching to next model...")
            continue
        elif error_code == 404:
            print(f"Model {model_id} not found. Skipping...")
            continue
        else:
            print(f"Model {model_id} failed with error {error_code}: {error_msg}")
            # For other errors, we still try the next model just in case
            continue

    if "candidates" not in res_json:
        return {"status": "Error", "message": "Gemini API Error (All models exhausted or failed)", "details": res_json}
        
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
            # Fallback to existing logic if raw_decode fails
            ai_output = json_lib.loads(raw_response) 
            ai_trends = ai_output.get("trends", ai_output.get("active_trends", []))
    else:
        raise ValueError("No JSON object found in AI response")
        
    # Start with a copy of our current state
    final_trends_map = {t.get("name", t.get("title", "")): t for t in current_map.get("trends", current_map.get("active_trends", []))}
    
    for ait in ai_trends:
        name = ait.get("name", ait.get("title", ""))
        if not name: continue
        
        if name in final_trends_map:
            # Update existing: Merge AI's new insights with our old detailed data
            merged = final_trends_map[name].copy()
            # Only update if AI provided non-empty values
            for k, v in ait.items():
                if v: merged[k] = v
            final_trends_map[name] = merged
        else:
            # New trend: Add it as is (AI is now mandated to provide descriptions)
            final_trends_map[name] = ait
    
    # Build the final document
    updated_map = {
        "last_updated": datetime.utcnow().isoformat() + "Z",
        "trends": list(final_trends_map.values()),
        "intelligence_metadata": ai_output.get("intelligence_metadata", {})
    }
    
    # 6. Commit Back to GitHub
    update_github_file("trend_map.json", updated_map, sha, "Narrative Intelligence Update")
    return {"status": "Success", "trends": len(updated_map["trends"])}
