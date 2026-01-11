/* ================================
   STORAGE HELPERS
================================ */
async function getLeads() {
    const { leads = [] } = await chrome.storage.session.get("leads");
    return leads;
}

async function saveLead(lead) {
    const leads = await getLeads();
    leads.push(lead);
    await chrome.storage.session.set({ leads });
    return leads;
}

async function clearLeads() {
    await chrome.storage.session.set({ leads: [] });
}

/* ================================
   UI RENDERING
================================ */
function renderPreview(leads) {
    const tbody = document.querySelector("#previewBody");
    const leadCount = document.querySelector("#leadCount");
    const sessionCount = document.querySelector("#sessionCount");
    
    // Update counters
    leadCount.textContent = `${leads.length} lead${leads.length !== 1 ? 's' : ''}`;
    sessionCount.textContent = leads.length;
    
    // Clear table body
    tbody.innerHTML = "";
    
    if (!leads.length) {
        tbody.innerHTML = `
            <tr class="empty-row">
                <td colspan="8">
                    <div class="empty-state">
                        <i class="fas fa-database"></i>
                        <p>No data scraped yet</p>
                        <small>Scrape your first lead to see it here</small>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    // Define column order
    const columns = [
        { key: 'name', label: 'Name', width: '150px' },
        { key: 'phone', label: 'Phone', width: '120px' },
        { key: 'address', label: 'Address', width: '180px' },
        { key: 'website', label: 'Website', width: '150px', format: formatWebsite },
        { key: 'reviews', label: 'Reviews', width: '100px', align: 'center' },
        { key: 'business_status', label: 'Status', width: '100px', format: formatStatus },
        { key: 'scraped_at', label: 'Scraped At', width: '140px', format: formatDate }
    ];
    
    // Build rows
    leads.forEach((lead, index) => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td class="sticky-col">${index + 1}</td>
            ${columns.map(col => {
                const value = lead[col.key] || '';
                let displayValue = col.format ? col.format(value, lead) : value;
                const align = col.align ? `style="text-align: ${col.align}"` : '';
                return `<td ${align} title="${value}">${displayValue}</td>`;
            }).join('')}
        `;
        tbody.appendChild(row);
    });
}

// Formatting helpers
function formatWebsite(url) {
    if (!url || url === "No website listed") {
        return '<span class="no-website">No website</span>';
    }
    const displayUrl = url.replace(/^https?:\/\//, '').replace(/\/$/, '');
    return `<a href="${url}" target="_blank" class="website-link" title="${url}">
        <i class="fas fa-external-link-alt"></i> ${displayUrl.substring(0, 30)}${displayUrl.length > 30 ? '...' : ''}
    </a>`;
}

function formatStatus(status) {
    const statusClass = status === "Open" ? "status-open" : "status-closed";
    return `<span class="status-badge ${statusClass}">${status}</span>`;
}

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function updateStatus(message, type = 'info') {
    const statusEl = document.getElementById("status");
    statusEl.textContent = message;
    statusEl.className = `status ${type}`;
    
    // Clear status after 3 seconds for non-error messages
    if (type !== 'error') {
        setTimeout(() => {
            if (statusEl.textContent === message) {
                statusEl.textContent = '';
                statusEl.className = 'status';
            }
        }, 3000);
    }
}

/* ================================
   SCRAPE SINGLE OPEN CARD
================================ */
document.getElementById("scrapeBtn").addEventListener("click", async () => {
    updateStatus("Scraping current place...", "info");
    
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab || !tab.url || !tab.url.includes("google.com/maps")) {
        updateStatus("Please open a Google Maps place page first.", "error");
        return;
    }
    
    try {
        // Ensure scraper.js is injected
        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ["content/scraper.js"]
        });
        
        // Request scrape of CURRENT OPEN CARD
        chrome.tabs.sendMessage(
            tab.id,
            { action: "SCRAPE_CARD" },
            async (response) => {
                if (chrome.runtime.lastError) {
                    console.error("❌", chrome.runtime.lastError.message);
                    updateStatus("Scrape failed. Please refresh the page.", "error");
                    return;
                }
                
                if (!response || !response.success || !response.lead) {
                    updateStatus("No place data found. Make sure a place card is open.", "error");
                    return;
                }
                
                const leads = await saveLead(response.lead);
                renderPreview(leads);
                
                updateStatus(`✅ Successfully scraped: ${response.lead.name}`, "success");
            }
        );
    } catch (err) {
        console.error(err);
        updateStatus("Injection error. Please try again.", "error");
    }
});

/* ================================
   DOWNLOAD CSV
================================ */
document.getElementById("downloadBtn").addEventListener("click", async () => {
    const leads = await getLeads();
    if (!leads.length) {
        updateStatus("No data to download.", "error");
        return;
    }
    
    updateStatus("Preparing download...", "info");
    
    // Define columns for CSV
    const columns = [
        { key: 'name', label: 'Name' },
        { key: 'phone', label: 'Phone' },
        { key: 'address', label: 'Address' },
        { key: 'website', label: 'Website' },
        { key: 'reviews', label: 'Reviews' },
        { key: 'business_status', label: 'Business Status' },
        { key: 'scraped_at', label: 'Scraped At' }
    ];
    
    const headers = columns.map(col => col.label);
    const csvRows = [];
    
    // Add headers
    csvRows.push(headers.join(","));
    
    // Add data rows
    leads.forEach(lead => {
        const row = columns.map(col => {
            const value = lead[col.key] || "";
            // Escape quotes and wrap in quotes
            return `"${String(value).replace(/"/g, '""')}"`;
        });
        csvRows.push(row.join(","));
    });
    
    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement("a");
    a.href = url;
    a.download = `google_maps_leads_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    updateStatus(`✅ Downloaded ${leads.length} leads`, "success");
});

/* ================================
   CLEAR SESSION
================================ */
document.getElementById("clearBtn").addEventListener("click", async () => {
    if (confirm("Are you sure you want to clear all scraped data?")) {
        await clearLeads();
        renderPreview([]);
        updateStatus("Session cleared.", "info");
    }
});

/* ================================
   INIT
================================ */
document.addEventListener("DOMContentLoaded", async () => {
    const leads = await getLeads();
    renderPreview(leads);
    
    // Add some CSS for dynamic elements
    const style = document.createElement('style');
    style.textContent = `
        .website-link {
            color: var(--primary);
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            gap: 4px;
        }
        .website-link:hover {
            text-decoration: underline;
        }
        .no-website {
            color: var(--gray-dark);
            font-style: italic;
        }
        .status-badge {
            padding: 3px 8px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 500;
        }
        .status-open {
            background: rgba(52, 168, 83, 0.1);
            color: var(--secondary);
        }
        .status-closed {
            background: rgba(234, 67, 53, 0.1);
            color: var(--danger);
        }
    `;
    document.head.appendChild(style);
});