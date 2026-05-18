let currentDataSource = 'tax_trend_map.json';
let currentArchiveSource = 'tax_archive.json';
let currentFocusLabel = 'Corporate Tax / Tariffs';
let currentFilter = { category: null, stage: null };
let cachedData = null;
let cachedArchive = null;
let cachedSteering = null;

async function init() {
    setupTabs();
    setupDetailDrawer();
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
            showDataState('No Active Intelligence', `${currentFocusLabel} loaded successfully, but the latest agent run did not publish any active trends.`);
            renderDashboard(cachedData, cachedSteering, [], cachedArchive || { archived_trends: [] });
        } else {
            hideDataState();
            renderDashboard(cachedData, cachedSteering, trends, cachedArchive || { archived_trends: [] });
        }
    } catch (error) {
        console.error("Data loading error:", error);
        clearTrendSections();
        showDataState('Data Unavailable', `Could not load ${currentDataSource}. The dashboard is not showing projected or mock intelligence.`);
        updateRunHealth({
            run_health: {
                status: 'failed',
                focus: currentFocusLabel,
                validation_failures: [error.message],
                search_result_count: 0,
                validation_error_count: 1
            }
        });
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
    updateRunHealth(data);
    renderAIShowcase(data, steering, activeTrends);

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
    clearTrendSections();

    // Staggered Reveal Logic
    filteredTrends.forEach((trend, index) => {
        const card = createTrendCard(trend, archivedTrends);
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

function clearTrendSections() {
    const stages = ['incubation', 'breakthrough', 'peak-hype', 'fatigue'];
    stages.forEach(stage => {
        const el = document.getElementById(`${stage}-trends`);
        if (el) el.innerHTML = '';
    });
}

function showDataState(title, message) {
    let state = document.getElementById('data-state');
    if (!state) {
        state = document.createElement('section');
        state.id = 'data-state';
        state.className = 'data-state-card';
        const lifecycleMap = document.getElementById('lifecycle-map');
        lifecycleMap.parentNode.insertBefore(state, lifecycleMap);
    }
    state.textContent = '';
    const heading = document.createElement('div');
    heading.className = 'data-state-title';
    heading.textContent = title;
    const copy = document.createElement('p');
    copy.textContent = message;
    state.append(heading, copy);
    state.style.display = 'block';
}

function hideDataState() {
    const state = document.getElementById('data-state');
    if (state) state.style.display = 'none';
}

function updateRunHealth(data) {
    const health = data.run_health || (data.intelligence_metadata && data.intelligence_metadata.run_health) || data.intelligence_metadata || {};
    let card = document.getElementById('run-health-card');
    if (!card) {
        card = document.createElement('div');
        card.id = 'run-health-card';
        card.className = 'stat-card run-health-card';
        const statsGrid = document.querySelector('.stats-grid');
        if (statsGrid) statsGrid.appendChild(card);
    }

    const status = health.status || 'unknown';
    const statusClass = status === 'success' ? 'health-success' : status === 'warning' ? 'health-warning' : 'health-failed';
    card.textContent = '';
    const label = document.createElement('div');
    label.className = 'stat-label';
    label.textContent = 'Run Health';
    const value = document.createElement('div');
    value.className = `stat-value run-health-value ${statusClass}`;
    value.textContent = status.toUpperCase();
    const meta = document.createElement('div');
    meta.className = 'run-health-meta';
    const model = health.model || health.agent || data.intelligence_metadata?.agent || 'unknown model';
    const searchCount = health.search_result_count ?? 'n/a';
    const validationCount = health.validation_error_count ?? 0;
    meta.textContent = `${model} | ${searchCount} search results | ${validationCount} validation flags`;
    card.append(label, value, meta);
}

function renderAIShowcase(data, steering, trends) {
    const statusEl = document.getElementById('ai-showcase-status');
    const focusList = document.getElementById('ai-focus-list');
    const outputMetrics = document.getElementById('ai-output-metrics');
    const changeLog = document.getElementById('ai-change-log');
    if (!statusEl || !focusList || !outputMetrics || !changeLog) return;

    const health = data.run_health || (data.intelligence_metadata && data.intelligence_metadata.run_health) || data.intelligence_metadata || {};
    const status = health.status || 'unknown';
    statusEl.textContent = `${status.toUpperCase()} | ${health.model || health.agent || data.intelligence_metadata?.agent || 'model pending'}`;
    statusEl.className = `ai-status-pill ai-status-${status}`;

    focusList.textContent = '';
    const focusAreas = Array.isArray(steering?.focus_areas) && steering.focus_areas.length ? steering.focus_areas : [currentFocusLabel];
    focusAreas.slice(0, 8).forEach(area => {
        const item = document.createElement('div');
        item.className = 'focus-chip';
        item.textContent = area;
        focusList.appendChild(item);
    });
    if (steering?.custom_directives) {
        const directive = document.createElement('p');
        directive.className = 'directive-copy';
        directive.textContent = steering.custom_directives;
        focusList.appendChild(directive);
    }

    const sourceDetails = trends.flatMap(trend => getSourceDetails(trend));
    const sourceTypes = sourceDetails.reduce((acc, source) => {
        const type = source.type || 'legacy';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
    }, {});
    const newTrendCount = trends.filter(trend => trend.changed_since_previous_run?.is_new).length;
    const changedTrendCount = trends.filter(trend => {
        const change = trend.changed_since_previous_run || {};
        return change.is_new || Number(change.stage_delta || 0) !== 0 || Number(change.velocity_delta || 0) !== 0 || (change.new_sources || []).length || (change.dropped_sources || []).length;
    }).length;
    const weakSourceCount = trends.filter(trend => (trend.validation_flags || []).length || trend.source_quality?.source_risk === 'high').length;

    outputMetrics.textContent = '';
    [
        ['Search results read', health.search_result_count ?? 'n/a'],
        ['Narratives synthesized', trends.length],
        ['Changed narratives', changedTrendCount],
        ['New narratives', newTrendCount],
        ['Primary sources', sourceTypes.primary || 0],
        ['Weak-source flags', weakSourceCount],
    ].forEach(([label, value]) => outputMetrics.appendChild(createMetricRow(label, value)));

    changeLog.textContent = '';
    const changes = trends
        .map(trend => ({ trend, change: trend.changed_since_previous_run || {} }))
        .filter(({ change }) => change.is_new || Number(change.stage_delta || 0) !== 0 || Number(change.velocity_delta || 0) !== 0 || (change.new_sources || []).length || (change.dropped_sources || []).length)
        .slice(0, 6);

    if (!changes.length) {
        const empty = document.createElement('p');
        empty.className = 'muted-copy';
        empty.textContent = 'No major movement was detected in the latest published data. That itself is useful signal: the agent preserved stable narratives instead of inventing movement.';
        changeLog.appendChild(empty);
        return;
    }

    changes.forEach(({ trend, change }) => {
        const item = document.createElement('div');
        item.className = 'change-log-item';
        const title = document.createElement('strong');
        title.textContent = trend.name || 'Unknown trend';
        const detail = document.createElement('span');
        detail.textContent = change.is_new
            ? `New narrative with ${(change.new_sources || []).length} supporting source(s).`
            : `Stage ${formatDelta(change.stage_delta)}, velocity ${formatDelta(change.velocity_delta)}, ${(change.new_sources || []).length} new source(s), ${(change.dropped_sources || []).length} dropped.`;
        item.append(title, detail);
        changeLog.appendChild(item);
    });
}

function createMetricRow(label, value) {
    const row = document.createElement('div');
    row.className = 'metric-row';
    const labelEl = document.createElement('span');
    labelEl.textContent = label;
    const valueEl = document.createElement('strong');
    valueEl.textContent = value;
    row.append(labelEl, valueEl);
    return row;
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
    if (currentFilter.category && currentFilter.stage) filterText += `${currentFilter.category} in ${currentFilter.stage}`;
    else if (currentFilter.category) filterText += `Category: ${currentFilter.category}`;
    else if (currentFilter.stage) filterText += `Stage: ${currentFilter.stage}`;

    indicator.textContent = '';
    const label = document.createElement('span');
    label.textContent = filterText;
    const clearBtn = document.createElement('button');
    clearBtn.className = 'clear-filter-btn';
    clearBtn.type = 'button';
    clearBtn.textContent = 'Clear Filter';
    clearBtn.addEventListener('click', clearFilters);
    indicator.append(label, clearBtn);
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

function createTrendCard(trend, archivedTrends = []) {
    const card = document.createElement('div');
    card.className = 'trend-card';
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `Open full details and sources for ${trend.name || trend.title || 'trend'}`);
    
    const name = trend.name || trend.title || "Unknown Trend";
    const summary = trend.summary || trend.description || "No summary available.";
    const velocity = trend.velocity || "Stable";
    const confidence = trend.confidence || 0.8;
    const change = trend.changed_since_previous_run || {};
    const sourceQuality = trend.source_quality || {};
    
    const velLower = velocity.toString().toLowerCase();
    const isHighVelocity = velLower.includes('+') || 
                           velLower.includes('high') || 
                           velLower.includes('accelerating') || 
                           velLower.includes('surging');
    
    if (isHighVelocity) card.classList.add('high-velocity');

    const velocityClass = (isHighVelocity) ? 'velocity-up' : 
                          (velLower.includes('-') || velLower.includes('low') || velLower.includes('dropping')) ? 'velocity-down' : '';
    
    const evidence = trend.evidence || trend.keywords || [];
    const evidenceList = Array.isArray(evidence) ? evidence : [evidence];
    const sourceDetails = getSourceDetails(trend);

    const header = document.createElement('div');
    header.className = 'trend-header';
    const titleWrap = document.createElement('div');
    const title = document.createElement('div');
    title.className = 'trend-name';
    title.textContent = name;
    titleWrap.appendChild(title);
    if (trend.category) {
        const category = document.createElement('div');
        category.className = 'category-badge';
        category.textContent = trend.category;
        titleWrap.appendChild(category);
    }
    const velocityEl = document.createElement('div');
    velocityEl.className = `trend-velocity ${velocityClass}`;
    velocityEl.textContent = velocity;
    header.append(titleWrap, velocityEl);

    const summaryEl = document.createElement('p');
    summaryEl.className = 'trend-summary';
    summaryEl.textContent = summarizeForCard(summary, 110);

    const changeRow = document.createElement('div');
    changeRow.className = 'change-row';
    changeRow.append(
        createPill(change.is_new ? 'NEW' : `STAGE ${formatDelta(change.stage_delta)}`),
        createPill(`VEL ${formatDelta(change.velocity_delta)}`),
        createPill(`${sourceQuality.source_risk || 'unknown'} source risk`)
    );

    const signalStrip = document.createElement('div');
    signalStrip.className = 'signal-strip';
    signalStrip.append(
        createSignalItem('Evidence', evidenceList.length),
        createSignalItem('Sources', sourceDetails.length),
        createSignalItem('Primary', sourceDetails.filter(source => source.type === 'primary').length),
        createSignalItem('Flags', (trend.validation_flags || []).length)
    );

    const detailsHint = document.createElement('div');
    detailsHint.className = 'details-hint';
    detailsHint.textContent = `View full intelligence and ${sourceDetails.length} source${sourceDetails.length === 1 ? '' : 's'}`;

    const footer = document.createElement('div');
    footer.className = 'trend-footer';
    const confidenceEl = document.createElement('div');
    confidenceEl.textContent = `CONFIDENCE: ${Math.round(confidence * 100)}%`;
    const bar = document.createElement('div');
    bar.className = 'confidence-bar';
    const fill = document.createElement('div');
    fill.className = 'confidence-fill';
    fill.style.width = `${Math.max(0, Math.min(confidence, 1)) * 100}%`;
    bar.appendChild(fill);
    const id = document.createElement('div');
    id.className = 'trend-id';
    id.textContent = `ID: ${trend.id || stableTrendId(name)}`;
    footer.append(confidenceEl, bar, id);

    card.append(header, summaryEl, changeRow, signalStrip, detailsHint, footer);
    card.addEventListener('click', event => {
        if (event.target.closest('a')) return;
        openTrendDrawer(trend, findArchiveHistory(trend, archivedTrends));
    });
    card.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openTrendDrawer(trend, findArchiveHistory(trend, archivedTrends));
        }
    });
    return card;
}

function summarizeForCard(text, maxLength = 220) {
    const clean = String(text || '').replace(/\s+/g, ' ').trim();
    if (clean.length <= maxLength) return clean;
    const slice = clean.slice(0, maxLength + 1);
    const wordEnd = slice.lastIndexOf(' ');
    return `${slice.slice(0, wordEnd > 50 ? wordEnd : maxLength).trim()}...`;
}

function createSignalItem(label, value) {
    const item = document.createElement('div');
    item.className = 'signal-item';
    const valueEl = document.createElement('strong');
    valueEl.textContent = value;
    const labelEl = document.createElement('span');
    labelEl.textContent = label;
    item.append(valueEl, labelEl);
    return item;
}

function createPill(text) {
    const pill = document.createElement('span');
    pill.className = 'change-pill';
    pill.textContent = text;
    return pill;
}

function formatDelta(value) {
    if (value === 'new') return 'NEW';
    const number = Number(value || 0);
    if (number > 0) return `+${number}`;
    return `${number}`;
}

function stableTrendId(value) {
    return String(value || 'trend').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'trend';
}

function createSourceLink(url, label, type) {
    let parsed;
    try {
        parsed = new URL(url);
    } catch (e) {
        return null;
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;

    const link = document.createElement('a');
    link.href = parsed.href;
    link.title = parsed.href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.className = `source-link source-${type || 'unknown'}`;
    link.textContent = `${label}${type ? ` (${type})` : ''}`;
    return link;
}

function findArchiveHistory(trend, archivedTrends) {
    const trendName = (trend.name || '').toLowerCase();
    const trendCategory = (trend.category || '').toLowerCase();
    return (archivedTrends || []).filter(item => {
        const itemName = (item.name || '').toLowerCase();
        const itemCategory = (item.category || '').toLowerCase();
        return itemName === trendName || (itemCategory && itemCategory === trendCategory && itemName.includes(trendName.split(' ')[0]));
    }).slice(-5).reverse();
}

function setupDetailDrawer() {
    if (document.getElementById('detail-drawer')) return;

    const overlay = document.createElement('div');
    overlay.id = 'drawer-overlay';
    overlay.className = 'drawer-overlay';
    overlay.hidden = true;

    const drawer = document.createElement('aside');
    drawer.id = 'detail-drawer';
    drawer.className = 'detail-drawer';
    drawer.setAttribute('aria-hidden', 'true');
    drawer.setAttribute('aria-label', 'Trend details');

    const closeBtn = document.createElement('button');
    closeBtn.id = 'drawer-close';
    closeBtn.className = 'drawer-close';
    closeBtn.type = 'button';
    closeBtn.textContent = 'Close';
    closeBtn.addEventListener('click', closeTrendDrawer);

    const content = document.createElement('div');
    content.id = 'drawer-content';
    content.className = 'drawer-content';
    drawer.append(closeBtn, content);
    document.body.append(overlay, drawer);
    overlay.addEventListener('click', closeTrendDrawer);
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') closeTrendDrawer();
    });
}

function openTrendDrawer(trend, archiveHistory = []) {
    const overlay = document.getElementById('drawer-overlay');
    const drawer = document.getElementById('detail-drawer');
    const content = document.getElementById('drawer-content');
    if (!overlay || !drawer || !content) return;

    content.textContent = '';
    const title = document.createElement('h2');
    title.textContent = trend.name || 'Unknown Trend';
    const meta = document.createElement('div');
    meta.className = 'drawer-meta';
    meta.textContent = `${trend.category || 'General'} | ${trend.stage || 'Incubation'} | ${trend.velocity || 'Stable'}`;
    const summary = document.createElement('p');
    summary.className = 'drawer-summary';
    summary.textContent = trend.summary || trend.description || 'No summary available.';
    content.append(title, meta, summary);

    appendDrawerSection(content, 'Reasoning', [trend.reasoning || 'No reasoning captured for this run.']);
    appendDrawerSection(content, 'Evidence', Array.isArray(trend.evidence) ? trend.evidence : [trend.evidence].filter(Boolean));

    const change = trend.changed_since_previous_run || {};
    appendDrawerSection(content, 'Changed Since Previous Run', [
        change.is_new ? 'New in latest run' : `Stage: ${change.previous_stage || 'unknown'} -> ${trend.stage || 'unknown'} (${formatDelta(change.stage_delta)})`,
        `Velocity: ${change.previous_velocity || 'unknown'} -> ${trend.velocity || 'unknown'} (${formatDelta(change.velocity_delta)})`,
        `New sources: ${(change.new_sources || []).length}`,
        `Dropped sources: ${(change.dropped_sources || []).length}`,
    ]);

    const sourceQuality = trend.source_quality || {};
    appendDrawerSection(content, 'Source Quality', [
        `Risk: ${sourceQuality.source_risk || 'unknown'}`,
        `Primary: ${sourceQuality.primary_source_count || 0}`,
        `Secondary: ${sourceQuality.secondary_source_count || 0}`,
        `Wikipedia: ${sourceQuality.wikipedia_source_count || 0}`,
        `Blog-like: ${sourceQuality.blog_source_count || 0}`,
        ...(trend.validation_flags || []).map(flag => `Flag: ${flag}`),
    ]);

    appendSourceSection(content, getSourceDetails(trend));
    appendArchiveSection(content, archiveHistory);

    overlay.hidden = false;
    drawer.setAttribute('aria-hidden', 'false');
    drawer.classList.add('open');
}

function closeTrendDrawer() {
    const overlay = document.getElementById('drawer-overlay');
    const drawer = document.getElementById('detail-drawer');
    if (!overlay || !drawer) return;
    overlay.hidden = true;
    drawer.setAttribute('aria-hidden', 'true');
    drawer.classList.remove('open');
}

function appendDrawerSection(parent, title, items) {
    const section = document.createElement('section');
    section.className = 'drawer-section';
    const heading = document.createElement('h3');
    heading.textContent = title;
    section.appendChild(heading);
    const list = document.createElement('ul');
    (items || []).filter(Boolean).forEach(item => {
        const li = document.createElement('li');
        li.textContent = item;
        list.appendChild(li);
    });
    if (!list.children.length) {
        const li = document.createElement('li');
        li.textContent = 'No data captured.';
        list.appendChild(li);
    }
    section.appendChild(list);
    parent.appendChild(section);
}

function appendSourceSection(parent, sources) {
    const section = document.createElement('section');
    section.className = 'drawer-section';
    const heading = document.createElement('h3');
    heading.textContent = 'Sources';
    section.appendChild(heading);
    const list = document.createElement('div');
    list.className = 'drawer-source-list';
    (sources || []).forEach(source => {
        const row = document.createElement('div');
        row.className = 'drawer-source-row';
        const link = createSourceLink(source.url, source.domain || source.url, source.type);
        if (link) row.appendChild(link);
        const date = document.createElement('span');
        date.textContent = source.published_date ? `Published: ${source.published_date}` : 'Published date unavailable';
        row.appendChild(date);
        list.appendChild(row);
    });
    if (!list.children.length) {
        const empty = document.createElement('p');
        empty.textContent = 'No source links captured.';
        list.appendChild(empty);
    }
    section.appendChild(list);
    parent.appendChild(section);
}

function appendArchiveSection(parent, archiveHistory) {
    const items = (archiveHistory || []).map(item => {
        const archivedAt = item.archived_at ? formatDate(item.archived_at) : 'unknown date';
        return `${archivedAt}: ${item.stage || 'unknown stage'} / ${item.velocity || 'unknown velocity'} - ${item.summary || item.description || 'No summary'}`;
    });
    appendDrawerSection(parent, 'Archive History', items);
}

function getSourceDetails(trend) {
    if (Array.isArray(trend.source_details) && trend.source_details.length) {
        return trend.source_details;
    }
    return (trend.source_links || []).map(url => {
        let domain = url;
        try {
            domain = new URL(url).hostname.replace(/^www\./, '');
        } catch (e) {
            domain = 'source';
        }
        return {
            url,
            domain,
            type: domain.includes('wikipedia.org') ? 'wikipedia' : 'legacy',
            published_date: null,
        };
    });
}

init();
