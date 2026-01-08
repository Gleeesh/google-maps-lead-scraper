let scrapedData = [];

const scrapeBtn = document.getElementById("scrapeBtn");
const downloadBtn = document.getElementById("downloadBtn");
const statusDiv = document.getElementById("status");
const previewDiv = document.getElementById("preview");

// Render the preview table in popup
function renderPreviewTable(data) {
    if (!data.length) {
        previewDiv.innerHTML = "<i>No results yet</i>";
        return;
    }

    let html = `
        <input id="filterInput" placeholder="Search..." style="width:100%; margin-bottom:5px; padding:4px;">
        <table>
            <thead>
                <tr>
                    <th>#</th>
                    <th>Name</th>
                    <th>Address</th>
                    <th>Phone</th>
                    <th>Website</th>
                    <th>Rating</th>
                    <th>Reviews</th>
                </tr>
            </thead>
            <tbody>
                ${data.map((item, idx) => `
                    <tr>
                        <td>${idx + 1}</td>
                        <td>${item.name || ""}</td>
                        <td>${item.address || ""}</td>
                        <td>${item.phone || ""}</td>
                        <td>${item.website || ""}</td>
                        <td>${item.rating || ""}</td>
                        <td>${item.reviews || ""}</td>
                    </tr>`).join('')}
            </tbody>
        </table>
    `;

    previewDiv.innerHTML = html;

    // Search/filter functionality
    const filterInput = document.getElementById("filterInput");
    filterInput.addEventListener("input", () => {
        const filter = filterInput.value.toLowerCase();
        const rows = previewDiv.querySelectorAll("tbody tr");
        rows.forEach(row => {
            const rowText = row.innerText.toLowerCase();
            row.style.display = rowText.includes(filter) ? "" : "none";
        });
    });
}

// Click "Scrape Results"
scrapeBtn.addEventListener("click", () => {
    scrapedData = [];
    statusDiv.textContent = "Scraping started...";
    previewDiv.innerHTML = "<i>Waiting for results...</i>";
    downloadBtn.disabled = true;

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs[0]) {
            statusDiv.textContent = "No active tab found";
            return;
        }

        // Ask content script to start scraping
        chrome.tabs.sendMessage(tabs[0].id, { action: "START_SCRAPE" });
    });
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "SCRAPE_PARTIAL") {
        // Append partial batch and render live preview
        scrapedData.push(...message.payload);
        statusDiv.textContent = `Scraped ${scrapedData.length} results (loading...)`;
        renderPreviewTable(scrapedData);
    }

    if (message.type === "SCRAPE_COMPLETE") {
        statusDiv.textContent = `Scraping complete: ${scrapedData.length} results`;
        downloadBtn.disabled = scrapedData.length === 0;
        renderPreviewTable(scrapedData);
    }
});

// Download Excel
downloadBtn.addEventListener("click", () => {
    if (!scrapedData.length) return;

    const worksheet = XLSX.utils.json_to_sheet(scrapedData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Leads");

    XLSX.writeFile(workbook, "google_maps_leads.xlsx");
});
