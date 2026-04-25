import requests
import json as json_lib
import os
import base64
import re
import sys
from datetime import datetime

# Configuration (Use Pipedream Env Variables)
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN")
GITHUB_REPO = os.environ.get("GITHUB_REPO") # e.g. "username/trend-velocity-tracker"
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
SEARCH_API_KEY = os.environ.get("SEARCH_API_KEY") # SerpApi or Brave

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
        from ddgs import DDGS
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
    
    Task: Perform a deep analysis and update the narrative intelligence.
    
    Iterative Directives:
    1. Refinement: This is a recursive process. Improve upon the 'Past State' using 'New Raw Data'.
    2. Pruning: If a trend in the 'Past State' is no longer showing activity or was a 'false positive', DO NOT include it in your output. You MUST KEEP the total number of trends under 25.
    3. Merging: If new data suggests two trends are actually the same narrative, merge them into a single, stronger entry.
    4. Categorization: Assign a short, descriptive `category` (e.g., "AI Hardware", "Regulatory", "Open Source") to every trend.
    
    1. Executive Briefing: Analyze the latest trend shifts based on the New Raw Data.
    
    2. Data Update: At the end of your response, provide the updated trend_map JSON in a strict block. 
       YOU MUST include the 'executive_briefing' (2-3 paragraphs) as a string field inside the top-level JSON object.
       The `stage` MUST BE exactly one of: "Incubation", "Breakthrough", "Peak Hype", or "Fatigue".
       ```json
       {{ 
         "executive_briefing": "...",
         "trends": [
           {{ "name": "...", "stage": "...", "velocity": "...", "category": "...", "confidence": 0.9, "summary": "...", "evidence": "..." }}
         ] 
       }}
       ```
    """

    # Upgraded to Gemma 4 26B (MoE)
    models_to_try = [
        "gemini-3-flash-preview", 
        "gemini-2.5-flash", 
        "gemini-2.0-flash", 
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
        # Only enable JSON mode for Gemini models
        if "gemini" in model_id:
            payload["generationConfig"] = {
                "response_mime_type": "application/json"
            }
        
        try:
            response = requests.post(url, headers=headers, json=payload, timeout=60)
            res_json = response.json()
            
            # If successful, check if it actually contains JSON
            if "candidates" in res_json:
                text = res_json['candidates'][0]['content']['parts'][0]['text']
                if '{' in text:
                    print(f"Success using {model_id} (Found JSON)")
                    sys.stdout.flush()
                    break
                else:
                    print(f"Model {model_id} returned NO JSON structure. Text: {text[:100]}...")
                    sys.stdout.flush()
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
    
    # 5. Save Narrative Briefing to GitHub
    briefing_path = "trend_briefing.md"
    briefing_sha = None
    # Try to get existing SHA if it exists
    try:
        url = f"https://api.github.com/repos/{GITHUB_REPO}/contents/{briefing_path}"
        headers = {"Authorization": f"token {GITHUB_TOKEN}"}
        r = requests.get(url, headers=headers)
        if r.status_code == 200:
            briefing_sha = r.json()['sha']
    except:
        pass
        
    briefing_content = f"# Narrative Intelligence Briefing - {datetime.utcnow().strftime('%Y-%m-%d %H:%M')}\n\n" + raw_response
    update_github_file(briefing_path, briefing_content, briefing_sha, "Update Narrative Briefing")
    print("Updated trend_briefing.md on GitHub")

    # 5. Extract JSON for Map & Briefing
    start_index = raw_response.find('{')
    if start_index != -1:
        try:
            decoder = json_lib.JSONDecoder()
            ai_output, _ = decoder.raw_decode(raw_response[start_index:])
            ai_trends = ai_output.get("trends", ai_output.get("active_trends", []))
            # Extract briefing if it exists in JSON, otherwise use the whole response
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
                # Fallback
                ai_output = json_lib.loads(raw_response[start_index:]) 
                ai_trends = ai_output.get("trends", ai_output.get("active_trends", []))
                briefing_text = "Briefing extraction failed."
    else:
        raise ValueError("No JSON object found in AI response")
        
    # 6. Save Narrative Briefing to GitHub (Clean Markdown)
    briefing_path = "trend_briefing.md"
    briefing_sha = None
    try:
        url = f"https://api.github.com/repos/{GITHUB_REPO}/contents/{briefing_path}"
        headers = {"Authorization": f"token {GITHUB_TOKEN}"}
        r = requests.get(url, headers=headers)
        if r.status_code == 200:
            briefing_sha = r.json()['sha']
    except:
        pass
        
    briefing_content = f"# Narrative Intelligence Briefing - {datetime.utcnow().strftime('%Y-%m-%d %H:%M')}\n\n" + briefing_text
    update_github_file(briefing_path, briefing_content, briefing_sha, "Update Narrative Briefing")
    print("Updated trend_briefing.md on GitHub")

    # 7. Apply Pruning & Merge Trends
    # We only keep trends returned by the AI, dropping unmentioned ones to prevent bloat.
    historical_map = {t.get("name", t.get("title", "")): t for t in current_map.get("trends", [])}
    final_trends_map = {}
    
    for ait in ai_trends:
        name = ait.get("name", ait.get("title", ""))
        if not name: continue
        
        if name in historical_map:
            # Update existing: keep historical data, overwrite with AI's new insights
            merged = historical_map[name].copy()
            merged.update(ait)
            final_trends_map[name] = merged
        else:
            final_trends_map[name] = ait
    
    # Build the final document
    updated_map = {
        "last_updated": datetime.utcnow().isoformat() + "Z",
        "trends": list(final_trends_map.values()),
        "intelligence_metadata": {
            "agent": model_id,
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "active_narratives": len(final_trends_map)
        }
    }
    
    # 8. Commit Back to GitHub
    update_github_file("trend_map.json", updated_map, sha, "Narrative Intelligence Update")
    return {"status": "Success", "trends": len(updated_map["trends"])}
