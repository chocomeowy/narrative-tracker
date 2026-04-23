# The Narrative Velocity Tracker

An autonomous intelligence agent that monitors the internet to identify emerging technical/cultural trends, tracks their lifecycle (Incubation to Fatigue), and visualizes the results on a live dashboard.

## 🚀 Overview
This project uses a **Cron + AI** pipeline to maintain an "Evolving Memory" of global trends. Every hour, the agent wakes up, searches for new signals, compares them against its past knowledge, and updates a trend map.

### Key Features
- **Autonomous Lifecycle Tracking**: Trends move from *Incubation* to *Breakthrough* to *Peak Hype* or *Fatigue*.
- **Human Steering**: Control the agent's focus by editing `steering.json`.
- **Premium Dashboard**: A high-fidelity, dark-mode visualization of the narrative landscape.
- **Context Optimization**: Automatically summarizes the trend map to keep AI costs low and performance high.

---

## 🛠️ Setup Instructions

### 1. GitHub Token
1. Go to **GitHub Settings > Developer Settings > Personal Access Tokens > Tokens (classic)**.
2. Generate a new token with `repo` scope.
3. Save this token for Pipedream.

### 2. Search API (SerpApi or Brave Search)
- **SerpApi**: Sign up at [serpapi.com](https://serpapi.com/) and get your API key.
- **Brave Search**: Alternatively, use Brave Search API.
- Note: The current `pipedream_agent.py` uses placeholders for these.

### 3. Gemini API
1. Get an API key from [Google AI Studio](https://aistudio.google.com/).
2. This project is optimized for **Gemini 1.5 Flash**.

### 4. Pipedream Workflow
1. Create a new workflow in [Pipedream](https://pipedream.com/).
2. **Trigger**: Select `Cron` (Every 1 hour).
3. **Step 1 (Fetch Code)**: Add a Python step.
4. **Environment Variables**: Add the following in Pipedream:
   - `GITHUB_TOKEN`: Your Personal Access Token.
   - `GITHUB_REPO`: `chocomeowy/narrative-tracker`.
   - `GEMINI_API_KEY`: Your Gemini key.
   - `SEARCH_API_KEY`: Your Search API key.
5. **Paste Script**: Copy the contents of `pipedream_agent.py` into the Python step.

---

## 🎨 Steering the Agent
You can "tune" the agent's intelligence by editing `steering.json` directly in GitHub:
- `focus_areas`: Keywords for the agent to search for.
- `ignored_topics`: Topics to filter out.
- `custom_directives`: Natural language orders (e.g., "Look for GitHub repository growth").

## 📊 Dashboard
Enable **GitHub Pages** in your repo settings (Settings > Pages > Branch: main / root) to host your live dashboard.
