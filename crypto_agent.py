import requests
import json
import os
from datetime import datetime

# Configuration (GitHub Secrets)
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")

def get_search_results(query):
    """Uses DuckDuckGo Search (Free)."""
    try:
        from ddgs import DDGS
        with DDGS() as ddgs:
            results = [r.get('body', '') for r in ddgs.text(query, max_results=5)]
            return results
    except Exception as e:
        print(f"Search error for {query}: {e}")
        return [f"Error fetching data for {query}"]

def summarize_context(trend_map):
    """Reduces the trend_map to a snapshot to save tokens."""
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

def run_agent():
    # 1. Load Current State (Local Files)
    try:
        with open("crypto_trend_map.json", "r") as f:
            current_map = json.load(f)
        with open("crypto_steering.json", "r") as f:
            steering = json.load(f)
    except Exception as e:
        print(f"Error loading local files: {e}")
        return

    # 2. Context Optimization
    past_state_summary = summarize_context(current_map)
    
    # 3. Gather New Intelligence
    focus_areas = steering.get("focus_areas", ["BTC", "ETH", "Clarity"])
    raw_intelligence = []
    for q in focus_areas:
        print(f"Searching for: {q}")
        raw_intelligence.extend(get_search_results(q))
    
    # 4. Call Gemma via Gemini API
    prompt_text = f"""
    Role: Specialist Crypto Intelligence Officer
    Directives: {json.dumps(steering)}
    Past State Snapshot: {json.dumps(past_state_summary)}
    New Raw Data: {json.dumps(raw_intelligence)}
    
    Task: Update the crypto_trend_map.json based on this new data.
    - Focus strictly on BTC, ETH, and the Clarity/Stacks ecosystem.
    - Identify shifts in narrative velocity.
    - Provide 'summary' and 'evidence' for all trends.
    - Return ONLY a valid JSON object matching the schema.
    """

    # Upgraded to Gemma 3 (released March 2025)
    models_to_try = [
        "gemma-3-27b-it",
        "gemma-3-12b-it",
        "gemma-3-4b-it",
        "gemma-2-27b-it"
    ]
    
    res_json = {}
    successful_model = None
    
    for model_id in models_to_try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_id}:generateContent?key={GEMINI_API_KEY}"
        headers = {'Content-Type': 'application/json'}
        payload = {
            "contents": [{
                "parts": [{"text": prompt_text}]
            }]
        }
        
        try:
            response = requests.post(url, headers=headers, json=payload)
            res_json = response.json()
            if "candidates" in res_json:
                successful_model = model_id
                print(f"Success using {model_id}")
                break
            else:
                print(f"Model {model_id} failed: {res_json.get('error', {}).get('message', 'Unknown error')}")
        except Exception as e:
            print(f"Error calling {model_id}: {e}")

    if not successful_model:
        print("All models failed.")
        return

    raw_response = res_json['candidates'][0]['content']['parts'][0]['text'].strip()
    if "```json" in raw_response:
        raw_response = raw_response.split("```json")[1].split("```")[0].strip()
    elif "```" in raw_response:
        raw_response = raw_response.split("```")[1].split("```")[0].strip()
    
    try:
        # 5. Intelligent Merge
        ai_output = json.loads(raw_response)
        ai_trends = ai_output.get("trends", ai_output.get("active_trends", []))
        
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
            json.dump(updated_map, f, indent=2)
        print("Successfully updated crypto_trend_map.json")

    except Exception as e:
        print(f"Error parsing AI response: {e}")
        print(f"Raw response: {raw_response}")

if __name__ == "__main__":
    run_agent()
