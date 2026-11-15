import os
import time
from playwright.sync_api import sync_playwright

artifact_dir = r"C:\Users\TRB\.gemini\antigravity\brain\f21f5cee-bd5b-45de-98cd-93eb88ef3c81"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1600, "height": 900})
    print("Navigating to http://localhost:5173...")
    page.goto("http://localhost:5173")
    page.wait_for_timeout(4000)

    # 1. Switch to Mumbai NISAR 2026
    print("Opening Event Date dropdown...")
    page.evaluate('''() => {
        const buttons = Array.from(document.querySelectorAll("button"));
        const dateBtn = buttons.find(b => b.textContent.includes("Event Date"));
        if (dateBtn) dateBtn.click();
    }''')
    page.wait_for_timeout(800)

    print("Selecting Mumbai NISAR 2026...")
    switched = page.evaluate('''() => {
        const buttons = Array.from(document.querySelectorAll("button"));
        const mumbaiBtn = buttons.find(b => b.textContent.includes("Mumbai & Thane Creek") || b.textContent.includes("NISAR"));
        if (mumbaiBtn) {
            mumbaiBtn.click();
            return "Switched to Mumbai: " + mumbaiBtn.textContent.trim();
        }
        return "Mumbai button not found";
    }''')
    print("Switch result:", switched)
    page.wait_for_timeout(5000)

    # Capture Mumbai NISAR Radar Mode
    mumbai_radar_path = os.path.join(artifact_dir, "screenshot_mumbai_nisar_radar.png")
    page.screenshot(path="screenshot_mumbai_nisar_radar.png")
    page.screenshot(path=mumbai_radar_path)
    print("Captured Mumbai NISAR Radar screenshot.")

    # 2. Toggle to Scientific GIS Mode
    print("Toggling to Scientific GIS Mode...")
    toggled = page.evaluate('''() => {
        const buttons = Array.from(document.querySelectorAll("button"));
        const sciBtn = buttons.find(b => b.textContent.trim() === "Scientific");
        if (sciBtn) {
            sciBtn.click();
            return "clicked Scientific button";
        }
        return "Scientific button not found";
    }''')
    print("Toggle result:", toggled)
    page.wait_for_timeout(2500)

    # Capture Mumbai NISAR Scientific GIS Mode
    mumbai_gis_path = os.path.join(artifact_dir, "screenshot_mumbai_nisar_gis.png")
    page.screenshot(path="screenshot_mumbai_nisar_gis.png")
    page.screenshot(path=mumbai_gis_path)
    print("Captured Mumbai NISAR Scientific GIS screenshot.")

    # 3. Switch back to Chennai Cyclone Fengal
    print("Opening Event Date dropdown to switch back to Chennai...")
    page.evaluate('''() => {
        const buttons = Array.from(document.querySelectorAll("button"));
        const dateBtn = buttons.find(b => b.textContent.includes("Event Date"));
        if (dateBtn) dateBtn.click();
    }''')
    page.wait_for_timeout(800)

    switched_chennai = page.evaluate('''() => {
        const buttons = Array.from(document.querySelectorAll("button"));
        const chennaiBtn = buttons.find(b => b.textContent.includes("Chennai"));
        if (chennaiBtn) {
            chennaiBtn.click();
            return "Switched to Chennai: " + chennaiBtn.textContent.trim();
        }
        return "Chennai button not found";
    }''')
    print("Switch to Chennai result:", switched_chennai)
    page.wait_for_timeout(5000)

    # Switch back to Radar Mode for Chennai
    page.evaluate('''() => {
        const buttons = Array.from(document.querySelectorAll("button"));
        const radarBtn = buttons.find(b => b.textContent.trim() === "Radar");
        if (radarBtn) radarBtn.click();
    }''')
    page.wait_for_timeout(2000)

    # Capture Chennai OPERA Final
    chennai_path = os.path.join(artifact_dir, "screenshot_chennai_opera_final.png")
    page.screenshot(path="screenshot_chennai_opera_final.png")
    page.screenshot(path=chennai_path)
    print("Captured Chennai OPERA Final screenshot.")

    # 4. Capture Swipe Comparison View on Chennai
    print("Testing comparison slider...")
    page.evaluate('''() => {
        // Toggle swipe / compare mode if not already active
        const buttons = Array.from(document.querySelectorAll("button"));
        const swipeBtn = buttons.find(b => b.textContent.trim().toLowerCase() === "swipe");
        if (swipeBtn) swipeBtn.click();
    }''')
    page.wait_for_timeout(1000)
    swipe_path = os.path.join(artifact_dir, "screenshot_swipe_comparison.png")
    page.screenshot(path="screenshot_swipe_comparison.png")
    page.screenshot(path=swipe_path)
    print("Captured Swipe Comparison screenshot.")

    browser.close()
    print("All Phase 4 QA validation screenshots captured successfully.")
