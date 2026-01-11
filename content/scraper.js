// content/scraper.js
// ==================================================
// Google Maps – Single Open Card Scraper (ENHANCED)
// ==================================================

// 🔒 Prevent duplicate execution if injected multiple times
if (!window.__GOOGLE_MAPS_SCRAPER_LOADED__) {
    window.__GOOGLE_MAPS_SCRAPER_LOADED__ = true;

    console.log("Maps scraper loaded");

    /* ================================
       HELPERS
    ================================= */
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    
    // Clean phone number
    const cleanPhone = (phone) => {
        if (!phone) return null;
        // Remove all non-numeric except +
        const cleaned = phone.replace(/[^\d\+]/g, '').trim();
        // Return null if too short
        return cleaned.length >= 7 ? cleaned : null;
    };

    /* ================================
       SCRAPE CURRENTLY OPEN CARD
    ================================= */
    function scrapeOpenCard() {
        // Allow multiple attempts for dynamic content
        let attempts = 3;
        let result = null;
        
        while (attempts-- > 0 && !result?.name) {
            result = attemptScrape();
            if (!result?.name) sleep(300);
        }
        
        return result;
        
        function attemptScrape() {
            // 1️⃣ BUSINESS NAME (Multiple selectors for reliability)
            const nameSelectors = [
                // Primary selectors
                'h1.DUwDvf',
                'h1.fontHeadlineLarge',
                'h1[aria-level="1"]',
                'h1[data-attrid="title"]',
                // Fallback selectors
                'h1',
                '.fontHeadlineLarge',
                '[role="heading"][aria-level="1"]',
                // New Google Maps structure
                'div[class*="fontHeadline"]:first-child',
                'div[class*="title"] h1',
                'div[data-attrid="title"] h1'
            ];
            
            let name = null;
            for (const selector of nameSelectors) {
                const el = document.querySelector(selector);
                if (el && el.innerText && el.innerText.trim()) {
                    name = el.innerText.trim();
                    // Clean up common suffixes
                    name = name.replace(/\s*·\s*.*$/, '').trim();
                    name = name.replace(/^[0-9.]+\s*/, '').trim();
                    break;
                }
            }
            
            if (!name) return null;

            // 2️⃣ PHONE NUMBER (Comprehensive extraction)
            let phone = null;
            const phoneSelectors = [
                // Primary phone button/display
                'button[data-item-id="phone"]',
                'div[data-item-id="phone"]',
                'a[href^="tel:"]',
                'a[href*="tel"]',
                // CSS class patterns
                '[class*="phone"]',
                '[class*="Phone"]',
                '[class*="contact"]',
                // ARIA and data attributes
                '[aria-label*="phone"]',
                '[aria-label*="Phone"]',
                '[data-tooltip*="phone"]',
                // Text content patterns
                ':contains("+")',
                ':contains("(")',
                // New structure
                'div[class*="fontBodyMedium"][class*="phone"]',
                'div[aria-label*="phone"] button',
                // International format
                'div:has(> span:contains("+"))',
                'button:has(span:contains("+"))'
            ];
            
            // First try structured selectors
            for (const selector of phoneSelectors) {
                try {
                    const els = document.querySelectorAll(selector);
                    for (const el of els) {
                        let phoneText = el.innerText || el.textContent || el.getAttribute('aria-label') || '';
                        phoneText = phoneText.trim();
                        
                        // Look for phone patterns
                        const phoneRegex = /(\+?\d[\d\s\-\(\)\.]{7,}\d)/g;
                        const match = phoneText.match(phoneRegex);
                        if (match) {
                            phone = cleanPhone(match[0]);
                            if (phone) break;
                        }
                        
                        // Try href for tel: links
                        if (el.href && el.href.startsWith('tel:')) {
                            phone = cleanPhone(el.href.replace('tel:', ''));
                            if (phone) break;
                        }
                    }
                    if (phone) break;
                } catch (e) {
                    continue;
                }
            }
            
            // Fallback: Search entire card for phone patterns
            if (!phone) {
                const card = document.querySelector('[role="dialog"], [aria-modal="true"], .m6QErb');
                if (card) {
                    const text = card.innerText;
                    const phoneRegex = /(\+?\d[\d\s\-\(\)\.]{7,}\d)/g;
                    const matches = text.match(phoneRegex);
                    if (matches) {
                        // Take the most phone-like match (usually longest)
                        matches.sort((a, b) => b.length - a.length);
                        phone = cleanPhone(matches[0]);
                    }
                }
            }

            // 3️⃣ REVIEW COUNT - ACCURATE EXTRACTION
            let reviews = null;
            
            // Method 1: Look for the review count button/span with number
            const reviewElements = document.querySelectorAll('[aria-label*="reviews"], button[aria-label*="review"], span[aria-label*="review"]');
            
            for (const el of reviewElements) {
                const ariaLabel = el.getAttribute('aria-label') || '';
                // Extract number from aria-label (e.g., "4.2 (1,234 reviews)")
                const match = ariaLabel.match(/([\d,]+)\s*reviews?/i);
                if (match) {
                    reviews = match[1].replace(/,/g, '');
                    break;
                }
            }
            
            // Method 2: If not found in aria-label, check inner text
            if (!reviews) {
                const reviewTextElements = document.querySelectorAll('button, span, div');
                for (const el of reviewTextElements) {
                    const text = el.innerText || el.textContent || '';
                    if (text.toLowerCase().includes('review')) {
                        // Look for patterns like: "1,234 reviews", "1234 reviews", "(1.2K reviews)"
                        const reviewMatch = text.match(/([\d,\.]+[KkM]?)\s*reviews?/i);
                        if (reviewMatch) {
                            let reviewNum = reviewMatch[1];
                            
                            // Handle K/M abbreviations
                            if (reviewNum.toLowerCase().includes('k')) {
                                reviewNum = parseFloat(reviewNum) * 1000;
                            } else if (reviewNum.toLowerCase().includes('m')) {
                                reviewNum = parseFloat(reviewNum) * 1000000;
                            }
                            
                            // Remove commas and convert to string
                            reviews = String(Math.round(reviewNum)).replace(/,/g, '');
                            break;
                        }
                    }
                }
            }
            
            // Method 3: Look for specific Google Maps review containers
            if (!reviews) {
                const reviewContainers = [
                    'div[class*="fontBodyMedium"]',
                    'div[class*="review"]',
                    'button[class*="review"]'
                ];
                
                for (const container of reviewContainers) {
                    const els = document.querySelectorAll(container);
                    for (const el of els) {
                        const text = el.innerText || '';
                        // Look for number before "reviews"
                        const reviewMatch = text.match(/(\d[\d,\.]*[KkM]?)\s*reviews?/i);
                        if (reviewMatch) {
                            let reviewNum = reviewMatch[1];
                            // Handle abbreviations and convert
                            if (/[Kk]/.test(reviewNum)) {
                                reviewNum = parseFloat(reviewNum) * 1000;
                            } else if (/[Mm]/.test(reviewNum)) {
                                reviewNum = parseFloat(reviewNum) * 1000000;
                            }
                            reviews = String(Math.round(reviewNum)).replace(/,/g, '');
                            break;
                        }
                    }
                    if (reviews) break;
                }
            }

            // 4️⃣ ADDRESS (multiple sources)
            let address = null;
            const addressSelectors = [
                '[data-item-id="address"]',
                'button[data-item-id="address"]',
                '[aria-label*="address"]',
                '[class*="address"]',
                'a[href^="https://www.google.com/maps/place"]',
                'div[class*="fontBodyMedium"]:has(> div > span:contains(","))'
            ];
            
            for (const selector of addressSelectors) {
                const el = document.querySelector(selector);
                if (el) {
                    address = el.innerText || el.textContent || el.getAttribute('aria-label') || '';
                    address = address.trim();
                    // Clean common prefixes
                    address = address.replace(/^Address:\s*/i, '');
                    if (address) break;
                }
            }

            // 5️⃣ WEBSITE (with null placeholder)
            let website = null;
            const websiteSelectors = [
                'a[data-item-id="authority"]',
                'a[href*="://"]:not([href*="google"])',
                'button[data-item-id="authority"]',
                '[aria-label*="website"]',
                '[class*="website"] a'
            ];
            
            for (const selector of websiteSelectors) {
                const el = document.querySelector(selector);
                if (el && el.href && !el.href.includes('google.com')) {
                    website = el.href;
                    break;
                }
            }
            
            // Set placeholder if website is null
            if (!website) {
                website = "No website listed";
            }

            return {
                name,
                address: address || null,
                phone,
                website, // Now includes placeholder for null values
                reviews,
                business_status: "Open",
                // scraped_at moved to last column as requested
                scraped_at: new Date().toISOString()
            };
        }
    }

    /* ================================
       MESSAGE LISTENER (POPUP → CONTENT)
    ================================= */
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (!message || message.action !== "SCRAPE_CARD") return;

        (async () => {
            try {
                console.log("Starting scrape...");
                
                // Wait for card to be fully loaded
                await sleep(800);
                
                // Sometimes need to wait for lazy-loaded content
                let lead = null;
                let retries = 3;
                
                while (retries-- > 0 && !lead?.phone) {
                    lead = scrapeOpenCard();
                    if (!lead?.phone && retries > 0) {
                        console.log(`Retry ${3-retries}: Phone not found, waiting...`);
                        await sleep(400);
                    }
                }
                
                if (!lead) {
                    sendResponse({
                        success: false,
                        error: "No open Google Maps card detected"
                    });
                    return;
                }
                
                // Debug info
                console.log("Scraped data:", lead);
                
                sendResponse({
                    success: true,
                    lead,
                    debug: {
                        url: window.location.href,
                        timestamp: new Date().toISOString()
                    }
                });
            } catch (err) {
                console.error("Scraper error:", err);
                sendResponse({
                    success: false,
                    error: err.message || "Unknown scraping error",
                    stack: err.stack
                });
            }
        })();

        return true; // Keep message channel open for async
    });
}