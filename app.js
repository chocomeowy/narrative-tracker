let currentDataSource = 'tax_trend_map.json';
let currentArchiveSource = 'tax_archive.json';
let currentFocusLabel = 'Corporate Tax / Tariffs';
let currentFilter = { category: null, stage: null };
let cachedData = null;
let cachedArchive = null;
let cachedSteering = null;

async function init() {
    setupTabs();
    await loadData();
}

function formatDate(dateString) {
    if (!dateString) return 'Unknown Date';
    const date = new Date(dateString);
    
    // Format: DD/MMM/YYYY, h:mm:ss AM/PM
    const day = date.getDate().toString().padStart(2, '0');
    const month = date.toLocaleString('en-US', { month: 'short' });
    const year = date.getFullYear();
    
    const time = date.toLocaleString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit', 
        second: '2-digit', 
        hour12: true 
    });
    
    return `${day}/${month}/${year}, ${time}`;
}

function setupTabs() {
    const tabBtns = document.querySelectorAll('.tabs-container .tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', async () => {
            if (btn.classList.contains('active')) return;
            
            const dataSource = btn.getAttribute('data-source');
            if (!dataSource) return;

            // UI Update
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // State Update
            currentDataSource = dataSource;
            currentArchiveSource = currentDataSource.replace('_trend_map.json', '_archive.json');
            if (currentDataSource === 'trend_map.json') currentArchiveSource = 'archive.json'; // Fallback
            currentFocusLabel = btn.getAttribute('data-focus');
            
            // Clear cache and filters on tab switch
            cachedData = null;
            cachedArchive = null;
            cachedSteering = null;
            currentFilter = { category: null, stage: null };
            
            // Reload Data
            await loadData();
        });
    });
}

async function loadData(forceRefresh = false) {
    try {
        if (!cachedData || forceRefresh) {
            console.log(`Fetching data from: ${currentDataSource}`);
            const trendResponse = await fetch(currentDataSource);
            if (!trendResponse.ok) throw new Error(`Failed to load ${currentDataSource}`);
            cachedData = await trendResponse.json();

            let steeringFile = 'steering.json';
            if (currentDataSource === 'crypto_trend_map.json') steeringFile = 'crypto_steering.json';
            if (currentDataSource === 'tax_trend_map.json') steeringFile = 'tax_steering.json';
            const steeringResponse = await fetch(steeringFile);
            if (steeringResponse.ok) cachedSteering = await steeringResponse.json();

            try {
                const archiveResponse = await fetch(currentArchiveSource);
                if (archiveResponse.ok) {
                    cachedArchive = await archiveResponse.json();
                } else {
                    cachedArchive = { archived_trends: [] };
                }
            } catch (e) {
                console.warn("Archive not found:", e);
                cachedArchive = { archived_trends: [] };
            }
        }

        const trends = cachedData.trends || cachedData.active_trends || [];

        if (trends.length === 0) {
            showPlaceholder(cachedSteering);
        } else {
            renderDashboard(cachedData, cachedSteering, trends, cachedArchive || { archived_trends: [] });
        }
    } catch (error) {
        console.error("Data loading error:", error);
        showPlaceholder();
    }
}

function renderDashboard(data, steering, trends = [], archiveData = { archived_trends: [] }) {
    // Ensure trends is an array
    const activeTrends = Array.isArray(trends) ? trends : [];
    const archivedTrends = Array.isArray(archiveData.archived_trends) ? archiveData.archived_trends : [];
    
    const lastUpdatedEl = document.getElementById('last-updated');
    const countTotalEl = document.getElementById('count-total');
    const currentFocusEl = document.getElementById('current-focus');

    if (lastUpdatedEl && data.last_updated) {
        lastUpdatedEl.innerText = `Last Updated: ${formatDate(data.last_updated)}`;
    }
    if (countTotalEl) countTotalEl.innerText = activeTrends.length;
    if (currentFocusEl) currentFocusEl.innerText = currentFocusLabel;

    // Handle Briefing
    const briefingContainer = document.getElementById('briefing-container');
    const briefingText = document.getElementById('briefing-text');
    if (briefingContainer && briefingText) {
        if (data.executive_briefing) {
            briefingContainer.style.display = 'block';
            briefingText.innerText = data.executive_briefing;
        } else {
            briefingContainer.style.display = 'none';
        }
    }

    // Render Heatmap
    renderHeatmap(activeTrends);

    // Clear and Render Archive
    renderArchive(archivedTrends);

    // Filter logic
    let filteredTrends = activeTrends;
    if (currentFilter.category || currentFilter.stage) {
        filteredTrends = activeTrends.filter(t => {
            const catMatch = !currentFilter.category || (t.category || "General") === currentFilter.category;
            const stageMatch = !currentFilter.stage || (t.stage || "Incubation").toLowerCase() === currentFilter.stage.toLowerCase();
            return catMatch && stageMatch;
        });
        showFilterIndicator();
    } else {
        hideFilterIndicator();
    }

    // Clear sections
    const stages = ['incubation', 'breakthrough', 'peak-hype', 'fatigue'];
    stages.forEach(stage => {
        const el = document.getElementById(`${stage}-trends`);
        if (el) el.innerHTML = '';
    });

    // Staggered Reveal Logic
    filteredTrends.forEach((trend, index) => {
        const card = createTrendCard(trend);
        let stageKey = (trend.stage || 'incubation').toLowerCase().replace(/\s+/g, '-');
        
        if (stageKey.includes('emerging') || stageKey.includes('growth') || stageKey.includes('developing')) stageKey = 'breakthrough';
        if (stageKey.includes('decline')) stageKey = 'fatigue';

        const section = document.getElementById(`${stageKey}-trends`);
        if (section) {
            section.appendChild(card);
            // Staggered reveal
            setTimeout(() => {
                card.classList.add('revealed');
            }, index * 100);
        } else {
            const incubationSection = document.getElementById('incubation-trends');
            if (incubationSection) {
                incubationSection.appendChild(card);
                setTimeout(() => {
                    card.classList.add('revealed');
                }, index * 100);
            }
        }
    });
}

function renderHeatmap(trends) {
    const matrixEl = document.getElementById('intelligence-matrix');
    if (!matrixEl) return;

    matrixEl.innerHTML = '';

    const stages = ["Incubation", "Breakthrough", "Peak Hype", "Fatigue"];
    const categories = [...new Set(trends.map(t => t.category || "General"))].sort();

    // Headers
    matrixEl.appendChild(createMatrixCell("", "matrix-header-cell"));
    stages.forEach(stage => {
        const cell = createMatrixCell(stage, "matrix-header-cell clickable");
        if (currentFilter.stage === stage) cell.classList.add('active');
        cell.addEventListener('click', () => toggleFilter(null, stage));
        matrixEl.appendChild(cell);
    });

    // Rows
    categories.forEach(cat => {
        // Category Label
        const labelCell = createMatrixCell(cat, "matrix-category-label clickable");
        if (currentFilter.category === cat) labelCell.classList.add('active');
        labelCell.addEventListener('click', () => toggleFilter(cat, null));
        matrixEl.appendChild(labelCell);

        // Cells for each stage
        stages.forEach(stage => {
            const count = trends.filter(t => (t.category || "General") === cat && (t.stage || "Incubation").toLowerCase() === stage.toLowerCase()).length;
            
            const cell = createMatrixCell(count > 0 ? count : "", "matrix-cell clickable");
            if (currentFilter.category === cat && currentFilter.stage === stage) cell.classList.add('active');
            
            // Apply intensity
            if (count > 0) {
                const opacity = Math.min(0.2 + (count * 0.2), 0.9);
                cell.style.background = `rgba(0, 242, 255, ${opacity})`;
                if (opacity > 0.6) cell.style.boxShadow = `0 0 15px rgba(0, 242, 255, 0.3)`;
            }
            
            cell.addEventListener('click', () => toggleFilter(cat, stage));
            matrixEl.appendChild(cell);
        });
    });
}

function toggleFilter(category, stage) {
    if (currentFilter.category === category && currentFilter.stage === stage) {
        // Unset if same
        currentFilter = { category: null, stage: null };
    } else {
        currentFilter = { category, stage };
    }
    loadData(); // Re-render with filter
}

function showFilterIndicator() {
    let indicator = document.getElementById('filter-indicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'filter-indicator';
        indicator.className = 'filter-pill';
        const lifecycleMap = document.getElementById('lifecycle-map');
        lifecycleMap.parentNode.insertBefore(indicator, lifecycleMap);
    }
    
    let filterText = "Filtering by ";
    if (currentFilter.category && currentFilter.stage) filterText += `<strong>${currentFilter.category}</strong> in <strong>${currentFilter.stage}</strong>`;
    else if (currentFilter.category) filterText += `Category: <strong>${currentFilter.category}</strong>`;
    else if (currentFilter.stage) filterText += `Stage: <strong>${currentFilter.stage}</strong>`;
    
    indicator.innerHTML = `
        <span>${filterText}</span>
        <button onclick="clearFilters()" class="clear-filter-btn">Clear Filter</button>
    `;
    indicator.style.display = 'flex';
}

function hideFilterIndicator() {
    const indicator = document.getElementById('filter-indicator');
    if (indicator) indicator.style.display = 'none';
}

function clearFilters() {
    currentFilter = { category: null, stage: null };
    loadData();
}

function createMatrixCell(text, className) {
    const div = document.createElement('div');
    div.className = className;
    div.innerText = text;
    return div;
}

function renderArchive(archivedTrends) {
    const archiveGrid = document.getElementById('archive-grid');
    const toggleBtn = document.getElementById('toggle-archive');
    if (!archiveGrid || !toggleBtn) return;

    archiveGrid.innerHTML = '';
    
    if (archivedTrends.length === 0) {
        archiveGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-dim); padding: 2rem;">No archived intelligence found for this focus.</div>';
    } else {
        archivedTrends.forEach((trend, index) => {
            const card = createTrendCard(trend);
            card.classList.add('archive-trend-card');
            
            // Add archived date
            const dateStr = formatDate(trend.archived_at);
            const badge = document.createElement('div');
            badge.className = 'archived-badge';
            badge.innerText = `ARCHIVED: ${dateStr}`;
            card.prepend(badge);
            
            archiveGrid.appendChild(card);
            
            // Immediately reveal or stagger if visible
            card.classList.add('revealed');
        });
    }

    // Reset toggle state on load
    archiveGrid.style.display = 'none';
    toggleBtn.innerText = 'View Archived Narrative Intelligence';

    // Toggle logic
    toggleBtn.onclick = () => {
        const isHidden = archiveGrid.style.display === 'none';
        archiveGrid.style.display = isHidden ? 'grid' : 'none';
        toggleBtn.textContent = isHidden ? 'Hide Intelligence Archive' : 'View Archived Narrative Intelligence';
        if (isHidden) archiveGrid.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
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

    // Source links extraction
    const sourceLinks = trend.source_links || [];
    const sourceLinksHtml = sourceLinks.length > 0 
        ? `<div class="source-links-container">
             ${sourceLinks.map((link, idx) => {
                 let domainText = "Link";
                 try {
                     domainText = new URL(link).hostname.replace(/^www\./, '');
                 } catch (e) {
                     domainText = `SRC_${idx + 1}`;
                 }
                 return `<a href="${link}" title="${link}" target="_blank" class="source-link" rel="noopener noreferrer">
                     <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px; vertical-align: baseline;"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>${domainText}
                 </a>`;
             }).join('')}
           </div>`
        : '';

    const categoryHtml = trend.category ? `<div class="category-badge">${trend.category}</div>` : '';

    card.innerHTML = `
        <div class="trend-header">
            <div>
                <div class="trend-name">${name}</div>
                ${categoryHtml}
            </div>
            <div class="trend-velocity ${velocityClass}">${velocity}</div>
        </div>
        <p class="trend-summary">${summary}</p>
        <div class="evidence-list">
            ${evidenceList.slice(0, 3).map(e => `<div class="evidence-item">${e}</div>`).join('')}
        </div>
        ${sourceLinksHtml}
        <div class="trend-footer">
            <div>CONFIDENCE: ${Math.round(confidence * 100)}%</div>
            <div class="confidence-bar">
                <div class="confidence-fill" style="width: ${confidence * 100}%"></div>
            </div>
            <div style="font-size: 0.6rem;">ID: ${Math.random().toString(36).substr(2, 6).toUpperCase()}</div>
        </div>
    `;
    return card;
}

function showPlaceholder(steeringData) {
    let mockTrends = [];
    
    if (currentDataSource === 'tax_trend_map.json') {
        mockTrends = [
            {
                name: "Global Minimum Tax (Pillar Two)",
                stage: "Breakthrough",
                velocity: "+20%",
                confidence: 0.95,
                category: "International",
                summary: "Rapid adoption of the 15% global minimum tax framework across OECD nations.",
                evidence: ["OECD Pillar Two reports", "National legislative updates"],
            },
            {
                name: "Reciprocal Tariff Frameworks",
                stage: "Incubation",
                velocity: "+15%",
                confidence: 0.85,
                category: "Tariffs",
                summary: "New discussions around automated reciprocal tariff triggers in bilateral trade.",
                evidence: ["Trade policy whitepapers", "Senate committee hearings"],
            }
        ];
    } else if (currentDataSource === 'crypto_trend_map.json') {
        mockTrends = [
            {
                name: "Bitcoin L2s (Stacks/Clarity)",
                stage: "Breakthrough",
                velocity: "+45%",
                confidence: 0.92,
                category: "Layer 2",
                summary: "Exponential growth in Bitcoin smart contract activity as Clarity developers build on Stacks.",
                evidence: ["Clarity GitHub activity", "Stacks Nakamoto release"],
            },
            {
                name: "ETH Data Availability",
                stage: "Peak Hype",
                velocity: "+10%",
                confidence: 0.88,
                category: "Infrastructure",
                summary: "Focus on EIP-4844 and Blobs to reduce L2 costs.",
                evidence: ["Base/Optimism volume", "EIP-4844 adoption rates"],
            }
        ];
    } else {
        mockTrends = [
            {
                name: "Agentic Mesh Protocols",
                stage: "Incubation",
                velocity: "High",
                confidence: 0.9,
                category: "AI",
                summary: "Emergence of p2p protocols for autonomous agent collaboration.",
                evidence: ["GitHub star growth", "New research papers"],
            }
        ];
    }
    
    renderDashboard({
        last_updated: new Date().toISOString(),
        executive_briefing: "Agent is initializing data for " + currentFocusLabel + ". Showing projected trends based on current steering focus.",
        trends: mockTrends
    }, steeringData || { focus_areas: [currentFocusLabel] }, mockTrends);
}

init();
