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
            if (btn.classList.contains('active')) return;
            
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
        console.log(`Fetching data from: ${currentDataSource}`);
        const trendResponse = await fetch(currentDataSource);
        
        if (!trendResponse.ok) {
            throw new Error(`Failed to load ${currentDataSource}: ${trendResponse.status}`);
        }
        
        const trendData = await trendResponse.json();
        
        const steeringFile = currentDataSource === 'trend_map.json' ? 'steering.json' : 'crypto_steering.json';
        const steeringResponse = await fetch(steeringFile);
        let steeringData = {};
        if (steeringResponse.ok) {
            steeringData = await steeringResponse.json();
        }

        const trends = trendData.trends || trendData.active_trends || [];

        if (trends.length === 0) {
            console.warn(`No trends found in ${currentDataSource}, showing placeholder.`);
            showPlaceholder(steeringData);
        } else {
            console.log(`Successfully loaded ${trends.length} trends from ${currentDataSource}`);
            renderDashboard(trendData, steeringData, trends);
        }
    } catch (error) {
        console.error("Data loading error:", error);
        // Show placeholder with a notification
        const lastUpdatedEl = document.getElementById('last-updated');
        if (lastUpdatedEl) lastUpdatedEl.innerText = "Agent is warming up... showing projected trends.";
        
        // Ensure UI label updates even on error
        const currentFocusEl = document.getElementById('current-focus');
        if (currentFocusEl) currentFocusEl.innerText = currentFocusLabel;
        
        showPlaceholder();
    }
}

function renderDashboard(data, steering, trends = []) {
    // Ensure trends is an array
    const activeTrends = Array.isArray(trends) ? trends : [];
    
    const lastUpdatedEl = document.getElementById('last-updated');
    const countTotalEl = document.getElementById('count-total');
    const currentFocusEl = document.getElementById('current-focus');

    if (lastUpdatedEl && data.last_updated) {
        lastUpdatedEl.innerText = `Last Updated: ${new Date(data.last_updated).toLocaleString()}`;
    }
    if (countTotalEl) countTotalEl.innerText = activeTrends.length;
    if (currentFocusEl) currentFocusEl.innerText = currentFocusLabel;

    // Clear sections
    const stages = ['incubation', 'breakthrough', 'peak-hype', 'fatigue', 'emerging', 'developing'];
    stages.forEach(stage => {
        const el = document.getElementById(`${stage}-trends`);
        if (el) el.innerHTML = '';
    });

    activeTrends.forEach(trend => {
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
    
    const velLower = velocity.toString().toLowerCase();
    const isHighVelocity = velLower.includes('+') || 
                           velLower.includes('high') || 
                           velLower.includes('accelerating') || 
                           velLower.includes('surging');
    
    if (isHighVelocity) card.classList.add('high-velocity');

    const velocityClass = (isHighVelocity) ? 'velocity-up' : 
                          (velLower.includes('-') || velLower.includes('low') || velLower.includes('dropping')) ? 'velocity-down' : '';
    

    // Robust evidence extraction
    const evidence = trend.evidence || trend.keywords || [];
    const evidenceList = Array.isArray(evidence) ? evidence : [evidence];

    card.innerHTML = `
        <div class="trend-header">
            <div class="trend-name">${name}</div>
            <div class="trend-velocity ${velocityClass}">${velocity}</div>
        </div>
        <p class="trend-summary">${summary}</p>
        <div class="evidence-list">
            ${evidenceList.map(e => `<div class="evidence-item">${e}</div>`).join('')}
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
    }, steeringData || { focus_areas: [currentFocusLabel] }, mockTrends);
}

init();
