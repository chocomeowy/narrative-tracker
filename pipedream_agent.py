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
    queries = steering.get("focus_areas", ["emerging technology"])
    raw_intelligence = []
    for q in queries[:3]: # Limit to 3 queries to save time/tokens
        raw_intelligence.extend(get_search_results(q))
    
    # 4. Call Gemini 1.5 Flash (Pipedream built-in or direct API)
    # This is a conceptual call to the Gemini API
    prompt = f"""
    Role: Narrative Intelligence Officer
    Directives: {json.dumps(steering)}
    Past State Snapshot: {json.dumps(past_state_summary)}
    New Raw Data: {json.dumps(raw_intelligence)}
    
    Task: Update the trend_map.json based on this new data.
    Return ONLY the full JSON object.
    """
    
    # response = requests.post(f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={GEMINI_API_KEY}", ...)
    # updated_map = response.json()...
    
    # 5. Commit Back to GitHub
    # update_github_file("trend_map.json", updated_map, sha, "Narrative Intelligence Update")
    
    return {"status": "Complete", "trends_count": len(current_map.get("trends", []))}
