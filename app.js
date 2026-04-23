let currentDataSource = 'trend_map.json';
let currentFocusLabel = 'Global Tech';

async function init() {
    setupTabs();
    await loadData();
}

function setupTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', async () => {
            // UI Update
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // State Update
            currentDataSource = btn.getAttribute('data-source');
            currentFocusLabel = btn.getAttribute('data-focus');
            
            // Reload Data
            await loadData();
        });
    });
}

async function loadData() {
    try {
        const trendResponse = await fetch(currentDataSource);
        const trendData = await trendResponse.json();
        
        // Use default steering for global, and crypto_steering for crypto
        const steeringFile = currentDataSource === 'trend_map.json' ? 'steering.json' : 'crypto_steering.json';
        const steeringResponse = await fetch(steeringFile);
        const steeringData = await steeringResponse.json();

        const trends = trendData.trends || trendData.active_trends || [];

        if (trends.length === 0) {
            console.log("No trends found, showing mock data.");
            showPlaceholder(steeringData);
        } else {
            renderDashboard(trendData, steeringData, trends);
        }
    } catch (error) {
        console.error("Error loading data:", error);
        // If crypto file doesn't exist yet, show placeholder
        showPlaceholder();
    }
}

function renderDashboard(data, steering, trends) {
    const lastUpdatedEl = document.getElementById('last-updated');
    const countTotalEl = document.getElementById('count-total');
    const currentFocusEl = document.getElementById('current-focus');

    if (lastUpdatedEl) lastUpdatedEl.innerText = `Last Updated: ${new Date(data.last_updated).toLocaleString()}`;
    if (countTotalEl) countTotalEl.innerText = trends.length;
    if (currentFocusEl) currentFocusEl.innerText = currentFocusLabel;

    // Clear sections
    const stages = ['incubation', 'breakthrough', 'peak-hype', 'fatigue', 'emerging', 'developing'];
    stages.forEach(stage => {
        const el = document.getElementById(`${stage}-trends`);
        if (el) el.innerHTML = '';
    });

    trends.forEach(trend => {
        const card = createTrendCard(trend);
        let stageKey = (trend.stage || 'incubation').toLowerCase().replace(' ', '-');
        
        if (stageKey === 'emerging') stageKey = 'incubation';
        if (stageKey === 'developing') stageKey = 'breakthrough';

        const section = document.getElementById(`${stageKey}-trends`);
        if (section) {
            section.appendChild(card);
        } else {
            const incubationSection = document.getElementById('incubation-trends');
            if (incubationSection) incubationSection.appendChild(card);
        }
    });
}

function createTrendCard(trend) {
    const card = document.createElement('div');
    card.className = 'trend-card';
    
    const name = trend.name || trend.title || "Unknown Trend";
    const summary = trend.summary || trend.description || "No summary available.";
    const velocity = trend.velocity || "Stable";
    const confidence = trend.confidence || 0.8;
    
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
            name: "Bitcoin L2s (Stacks/Clarity)",
            stage: "Breakthrough",
            velocity: "+45%",
            confidence: 0.92,
            first_seen: "2024-04-15",
            summary: "Exponential growth in Bitcoin smart contract activity as Clarity developers build on Stacks.",
            evidence: ["Clarity GitHub activity", "Stacks Nakamoto release"],
        },
        {
            name: "ETH Data Availability",
            stage: "Peak Hype",
            velocity: "+10%",
            confidence: 0.88,
            first_seen: "2024-04-01",
            summary: "Focus on EIP-4844 and Blobs to reduce L2 costs.",
            evidence: ["Base/Optimism volume", "EIP-4844 adoption rates"],
        }
    ];
    
    renderDashboard({
        last_updated: new Date().toISOString(),
        trends: mockTrends
    }, steeringData || { focus_areas: [currentFocusLabel] });
}

init();
