// content/scraper.js

// Sleep utility
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Extract data from one card
function extractCardData(card, index) {
    const name = card.querySelector('[aria-label][role="heading"]')?.innerText || null;
    const address = card.querySelector('[data-tooltip*="Address"]')?.innerText || null;
    const phone = card.querySelector('[data-tooltip*="Phone"]')?.innerText || null;
    const website = card.querySelector('a[href^="http"]')?.href || null;
    const rating = card.querySelector('span[aria-label*="stars"]')?.getAttribute('aria-label') || null;
    const reviews = card.querySelector('span[aria-label*="review"]')?.getAttribute('aria-label') || null;

    return { id: `gmaps_${index}`, name, address, phone, website, rating, reviews, scraped_at: new Date().toISOString() };
}

// Scroll container in small batches, yield results periodically
async function scrapeAllLargeBatch() {
    const container = document.querySelector('[role="feed"]');
    if (!container) return [];

    let allResults = [];
    let seenKeys = new Set();
    let lastHeight = 0;
    let sameHeightCount = 0;
    const maxAttempts = 100;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        container.scrollBy(0, 2000);
        await sleep(800);

        const cards = Array.from(document.querySelectorAll('[role="article"]'));
        const newResults = [];

        cards.forEach((card, index) => {
            const data = extractCardData(card, index);
            const key = `${data.name}_${data.address}`;
            if (!seenKeys.has(key)) {
                seenKeys.add(key);
                newResults.push(data);
            }
        });

        if (newResults.length) {
            allResults.push(...newResults);

            // Send partial batch to popup to keep UI responsive
            chrome.runtime.sendMessage({
                type: "SCRAPE_PARTIAL",
                payload: newResults
            });
        }

        // Check if scrolling reached end
        const newHeight = container.scrollHeight;
        if (newHeight === lastHeight) sameHeightCount++;
        else sameHeightCount = 0;

        if (sameHeightCount >= 3) break; // End of results
        lastHeight = newHeight;

        // Tiny map shift to load additional cards
        const map = document.querySelector('#scene');
        if (map) map.scrollBy(1, 1);
    }

    return allResults;
}

// Listen for popup start request
chrome.runtime.onMessage.addListener(async (message) => {
    if (message.action === "START_SCRAPE") {
        const results = await scrapeAllLargeBatch();

        // Final message after full scraping
        chrome.runtime.sendMessage({
            type: "SCRAPE_COMPLETE",
            payload: results
        });
    }
});
