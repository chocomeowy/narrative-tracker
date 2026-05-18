# The Narrative Velocity Tracker

An autonomous intelligence agent that monitors the internet to identify emerging technical/cultural trends, tracks their lifecycle (Incubation to Fatigue), and visualizes the results on a live dashboard.

This project is also a portfolio piece for practical AI usage: it shows how a person can steer AI toward the exact information they want, let it gather public signals, force it through validation, and inspect the reasoning and sources behind the final intelligence view.

## 🚀 Overview
This project uses a **Cron + AI** pipeline to maintain an "Evolving Memory" of global trends. Every **8 hours**, the agent wakes up, searches for new signals, compares them against its past knowledge, and updates a trend map.

### Key Features
- **Autonomous Lifecycle Tracking**: Trends move from *Incubation* to *Breakthrough* to *Peak Hype* or *Fatigue*.
- **Human Steering**: Control the agent's focus by editing `steering.json`.
- **AI Information Gathering Console**: Shows the full path from user intent to search gathering, synthesis, validation, and change detection.
- **Auditable Source Trail**: Every trend can expose source links, source-risk classification, reasoning, and archive history.
- **Premium Dashboard**: A high-fidelity, dark-mode visualization of the narrative landscape.
- **Context Optimization**: Automatically summarizes the trend map to keep AI costs low and performance high.

---

## 🛠️ Setup Instructions

### 1. GitHub Token
1. Go to **GitHub Settings > Developer Settings > Personal Access Tokens > Tokens (classic)**.
2. Generate a new token with `repo` scope.
3. Save this token for Pipedream.

### 2. Search API (Free Alternative: DuckDuckGo)
- **DuckDuckGo (Recommended)**: The script is now set up to use `duckduckgo-search`. It's completely free and doesn't require an API key, which is perfect for hourly runs.
- **SerpApi/Brave**: You can still use these, but you'll need to update the `get_search_results` function.

### 3. Gemini API
1. Get an API key from [Google AI Studio](https://aistudio.google.com/).
2. This project is optimized for **Gemini 1.5 Flash**.

### 4. Pipedream Workflow
1. Create a new workflow in [Pipedream](https://pipedream.com/).
2. **Trigger**: Select `Cron` (Every 8 hours).
3. **Step 1 (Fetch Code)**: Add a Python step.
4. **Environment Variables**: Add the following in Pipedream:
   - `GITHUB_TOKEN`: Your Personal Access Token.
   - `GITHUB_REPO`: `chocomeowy/narrative-tracker`.
   - `GEMINI_API_KEY`: Your Gemini key.
   - `SEARCH_API_KEY`: Your Search API key.
5. **Include Shared Validator**: Deploy `intelligence_utils.py` alongside `pipedream_agent.py`, or paste both files into the Pipedream environment so `pipedream_agent.py` can import the shared validation helpers.

---

## 🎨 Steering the Agent
You can "tune" the agent's intelligence by editing `steering.json` directly in GitHub:
- `custom_directives`: Natural language orders (e.g., "Look for GitHub repository growth").

## ✅ Intelligence Quality Controls
All agents now route generated trend output through `intelligence_utils.py` before publishing:

- **Strict trend validation**: required trend fields are normalized, stages are limited to `Incubation`, `Breakthrough`, `Peak Hype`, or `Fatigue`, confidence is clamped to `0..1`, and malformed entries are rejected or flagged.
- **Source hygiene**: source URLs are deduplicated, invalid protocols are dropped, source domains are classified as primary, secondary, Wikipedia, or blog-like, and source dates are retained when search results provide them.
- **Change tracking**: each trend includes `changed_since_previous_run` with stage delta, velocity delta, new sources, dropped sources, and whether it is new.
- **Run health**: each trend map includes `run_health` with status, model, focus, timestamp, search result count, validation failures, and validation error count.
- **Honest dashboard states**: the frontend no longer renders mock trends when data fails to load. It shows an explicit unavailable or empty state instead.

---

## ⚡ New: Crypto Intelligence Agent (BTC, ETH, Clarity)

This is a specialized agent focused on **Bitcoin**, **Ethereum**, and the **Clarity/Stacks** ecosystem. Unlike the global agent, this one runs on **GitHub Actions** and is triggered by **cron-job.org**.

### 1. Model: Gemma 2 (via Gemini API)
This agent is optimized for **Gemma-2-27b-it**. It provides deep technical analysis of the Bitcoin and Ethereum ecosystems.

### 2. GitHub Secrets Setup
1. Go to your repo **Settings > Secrets and variables > Actions** (NOT Codespaces or Dependabot).
2. Click **New repository secret**.
3. Add:
   - `GEMINI_API_KEY`: Your Google AI Studio API key.

### 3. Automation with cron-job.org
To trigger the agent automatically:
1. **Create a GitHub PAT**:
   - Go to **Settings > Developer settings > Personal access tokens (classic)**.
   - Generate a token with `repo` scope.
2. **Setup cron-job.org**:
   - **URL**: `https://api.github.com/repos/YOUR_USERNAME/narrative-tracker/dispatches`
   - **Method**: `POST`
   - **Headers**:
     - `Accept`: `application/vnd.github+json`
     - `Authorization`: `Bearer YOUR_PAT_TOKEN`
     - `X-GitHub-Api-Version`: `2022-11-28`
   - **Body (JSON)**:
     ```json
     { "event_type": "crypto_update" }
     ```

### 4. Steering the Crypto Agent
Edit `crypto_steering.json` to change the agent's focus within the BTC/ETH/Clarity ecosystem.

## 📊 Dashboard
Enable **GitHub Pages** in your repo settings (Settings > Pages > Branch: main / root) to host your live dashboard.

---

## 🏛️ Tax Intelligence Agent

A specialized agent for monitoring global tax policy and international trade tariffs. 

- **Specialization**: Corporate Tax, Pillar Two, International Tariffs, Singapore Policy shifts, and E-invoicing.
- **Model Fallback**: Uses a high-performance fallback chain starting with **Gemma 4 31B (MoE)** and **Gemma 3 27B** before falling back to **Gemini 2.5/2.0 Flash**.
- **Increased Timeout**: Optimized with a **180s timeout** to handle deep policy analysis and complex JSON generation.
- **Files**:
  - `tax_agent.py`: The logic core.
  - `tax_steering.json`: Focus areas (e.g., E-invoicing).
  - `tax_briefing.md`: Long-form narrative analysis.
  - `tax_trend_map.json`: Structured trend data.

### Triggering Tax Updates
The tax workflow listens for a separate dispatch event:

```json
{ "event_type": "tax_update" }
```
