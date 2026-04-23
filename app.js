async function init() {
    try {
        const trendResponse = await fetch('trend_map.json');
        const trendData = await trendResponse.json();
        
        const steeringResponse = await fetch('steering.json');
        const steeringData = await steeringResponse.json();

        if (!trendData.trends || trendData.trends.length === 0) {
            console.log("No trends found, showing mock data.");
            showPlaceholder(steeringData);
        } else {
            renderDashboard(trendData, steeringData);
        }
    } catch (error) {
        console.error("Error loading data, showing mock data:", error);
        showPlaceholder();
    }
}

function renderDashboard(data, steering) {
    // Update Header
    const lastUpdatedEl = document.getElementById('last-updated');
    const countTotalEl = document.getElementById('count-total');
    const currentFocusEl = document.getElementById('current-focus');

    if (lastUpdatedEl) lastUpdatedEl.innerText = `Last Updated: ${new Date(data.last_updated).toLocaleString()}`;
    if (countTotalEl) countTotalEl.innerText = data.trends.length;
    if (currentFocusEl) currentFocusEl.innerText = steering && steering.focus_areas ? steering.focus_areas[0] : "Global Tech";

    // Clear sections
    const stages = ['incubation', 'breakthrough', 'peak-hype', 'fatigue'];
    stages.forEach(stage => {
        const el = document.getElementById(`${stage}-trends`);
        if (el) el.innerHTML = '';
    });

    data.trends.forEach(trend => {
        const card = createTrendCard(trend);
        const stageKey = trend.stage.toLowerCase().replace(' ', '-');
        const section = document.getElementById(`${stageKey}-trends`);
        if (section) {
            section.appendChild(card);
        } else {
            console.warn(`No section found for stage: ${stageKey}`);
        }
    });
}

function createTrendCard(trend) {
    const card = document.createElement('div');
    card.className = 'trend-card';
    
    // Safety checks for missing velocity
    const velocity = trend.velocity || "Stable";
    const isHighVelocity = velocity.includes('+') && parseInt(velocity.replace('+', '')) > 20;
    if (isHighVelocity) card.classList.add('high-velocity');

    const velocityClass = velocity.startsWith('+') ? 'velocity-up' : (velocity.startsWith('-') ? 'velocity-down' : '');

    card.innerHTML = `
        <div class="trend-header">
            <div class="trend-name">${trend.name}</div>
            <div class="trend-velocity ${velocityClass}">${velocity}</div>
        </div>
        <p class="trend-summary">${trend.summary || 'No summary available.'}</p>
        <div class="evidence-list">
            ${(trend.evidence || []).map(e => `<div class="evidence-item">${e}</div>`).join('')}
        </div>
        <div class="trend-footer">
            <div>Confidence: ${Math.round((trend.confidence || 0) * 100)}%</div>
            <div class="confidence-bar">
                <div class="confidence-fill" style="width: ${(trend.confidence || 0) * 100}%"></div>
            </div>
            <div>Seen: ${trend.first_seen || 'N/A'}</div>
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
