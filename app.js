async function init() {
    try {
        const trendResponse = await fetch('trend_map.json');
        const trendData = await trendResponse.json();
        
        const steeringResponse = await fetch('steering.json');
        const steeringData = await steeringResponse.json();

        // Support both 'trends' and 'active_trends'
        const trends = trendData.trends || trendData.active_trends || [];

        if (trends.length === 0) {
            console.log("No trends found, showing mock data.");
            showPlaceholder(steeringData);
        } else {
            renderDashboard(trendData, steeringData, trends);
        }
    } catch (error) {
        console.error("Error loading data, showing mock data:", error);
        showPlaceholder();
    }
}

function renderDashboard(data, steering, trends) {
    // Update Header
    const lastUpdatedEl = document.getElementById('last-updated');
    const countTotalEl = document.getElementById('count-total');
    const currentFocusEl = document.getElementById('current-focus');

    if (lastUpdatedEl) lastUpdatedEl.innerText = `Last Updated: ${new Date(data.last_updated).toLocaleString()}`;
    if (countTotalEl) countTotalEl.innerText = trends.length;
    if (currentFocusEl) currentFocusEl.innerText = steering && steering.focus_areas ? steering.focus_areas[0] : "Global Tech";

    // Clear sections
    const stages = ['incubation', 'breakthrough', 'peak-hype', 'fatigue', 'emerging', 'developing'];
    stages.forEach(stage => {
        const el = document.getElementById(`${stage}-trends`);
        if (el) el.innerHTML = '';
    });

    trends.forEach(trend => {
        const card = createTrendCard(trend);
        let stageKey = (trend.stage || 'incubation').toLowerCase().replace(' ', '-');
        
        // Map AI stages to CSS stages if needed
        if (stageKey === 'emerging') stageKey = 'incubation';
        if (stageKey === 'developing') stageKey = 'breakthrough';

        const section = document.getElementById(`${stageKey}-trends`);
        if (section) {
            section.appendChild(card);
        } else {
            // Fallback to incubation if stage is unknown
            const incubationSection = document.getElementById('incubation-trends');
            if (incubationSection) incubationSection.appendChild(card);
        }
    });
}

function createTrendCard(trend) {
    const card = document.createElement('div');
    card.className = 'trend-card';
    
    // Support name/title and summary/description
    const name = trend.name || trend.title || "Unknown Trend";
    const summary = trend.summary || trend.description || "No summary available.";
    const velocity = trend.velocity || "Stable";
    const confidence = trend.confidence || 0.8; // Default if missing
    
    const isHighVelocity = velocity.includes('+') || velocity.toLowerCase().includes('accelerating');
    if (isHighVelocity) card.classList.add('high-velocity');

    const velocityClass = (velocity.startsWith('+') || velocity.toLowerCase().includes('accelerating')) ? 'velocity-up' : (velocity.startsWith('-') ? 'velocity-down' : '');

    card.innerHTML = `
        <div class="trend-header">
            <div class="trend-name">${name}</div>
            <div class="trend-velocity ${velocityClass}">${velocity}</div>
        </div>
        <p class="trend-summary">${summary}</p>
        <div class="evidence-list">
            ${(trend.evidence || trend.keywords || []).map(e => `<div class="evidence-item">${e}</div>`).join('')}
        </div>
        <div class="trend-footer">
            <div>Confidence: ${Math.round(confidence * 100)}%</div>
            <div class="confidence-bar">
                <div class="confidence-fill" style="width: ${confidence * 100}%"></div>
            </div>
            <div>Observed: ${trend.first_seen || trend.last_observed || 'Recent'}</div>
        </div>
    `;
    return card;
}

function showPlaceholder(steeringData) {
    const mockTrends = [
        {
            name: "Personal AI Agents",
            stage: "Breakthrough",
            velocity: "+25%",
            confidence: 0.85,
            first_seen: "2026-04-01",
            summary: "Shift from chat-based bots to autonomous agents performing tasks.",
            evidence: ["Source A: YC Demo Day", "Source B: GitHub surge in 'langgraph'"],
        },
        {
            name: "Small Modular Reactors",
            stage: "Incubation",
            velocity: "+12%",
            confidence: 0.70,
            first_seen: "2026-04-10",
            summary: "Advanced nuclear tech gaining interest for data center power.",
            evidence: ["Niche physics forums", "DOE whitepapers"],
        }
    ];
    
    renderDashboard({
        last_updated: new Date().toISOString(),
        trends: mockTrends
    }, steeringData || { focus_areas: ["AI Agents", "Nuclear Tech"] });
}

init();
