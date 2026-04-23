import requests
import json
import os

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
        decoded = requests.utils.quote(content['content'], safe='') # Placeholder logic for base64
        import base64
        return json.loads(base64.b64decode(content['content']).decode('utf-8')), content['sha']
    return None, None

def update_github_file(path, content_obj, sha, message):
    url = f"https://api.github.com/repos/{GITHUB_REPO}/contents/{path}"
    headers = {"Authorization": f"token {GITHUB_TOKEN}"}
    import base64
    content_str = json.dumps(content_obj, indent=2)
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
    for q in focus_areas[:3]:
        raw_intelligence.extend(get_search_results(q))
    
    # 4. Call Gemini 1.5 Flash
    import google.generativeai as genai
    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel('gemini-1.5-flash')
    
    prompt = f"""
    Role: Narrative Intelligence Officer
    Directives: {json.dumps(steering)}
    Past State Snapshot: {json.dumps(past_state_summary)}
    New Raw Data: {json.dumps(raw_intelligence)}
    
    Task: Update the trend_map.json based on this new data.
    - If a trend exists, update its stage/velocity.
    - If a new trend is found, add it.
    - Maintain historical accuracy.
    - Return ONLY a valid JSON object matching the schema.
    """
    
    response = model.generate_content(prompt)
    
    # Clean response (Gemini sometimes adds markdown blocks)
    raw_response = response.text.strip()
    if raw_response.startswith("```json"):
        raw_response = raw_response.split("```json")[1].split("```")[0].strip()
    
    try:
        updated_map = json.loads(raw_response)
        # Ensure timestamp is current
        from datetime import datetime
        updated_map["last_updated"] = datetime.utcnow().isoformat() + "Z"
        
        # 5. Commit Back to GitHub
        update_github_file("trend_map.json", updated_map, sha, "Narrative Intelligence Update")
        return {"status": "Success", "trends": len(updated_map.get("trends", []))}
    except Exception as e:
        return {"status": "Error", "message": str(e), "raw": raw_response}
