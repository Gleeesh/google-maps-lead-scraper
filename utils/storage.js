export async function saveLead(lead) {
    const { leads = [] } = await chrome.storage.session.get("leads");
    leads.push(lead);
    await chrome.storage.session.set({ leads });
}

export async function getLeads() {
    const { leads = [] } = await chrome.storage.session.get("leads");
    return leads;
}

export async function clearLeads() {
    await chrome.storage.session.set({ leads: [] });
}
