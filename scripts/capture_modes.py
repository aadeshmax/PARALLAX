from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={'width': 1600, 'height': 900})
    page.goto('http://localhost:5173')
    page.wait_for_timeout(3500)
    
    # Close panels
    page.evaluate('''() => {
        document.querySelectorAll(".lucide-x").forEach(icon => {
            const btn = icon.closest("button");
            if (btn) btn.click();
        });
    }''')
    page.wait_for_timeout(1000)
    
    # 1. Capture Refined Radar Overview
    page.screenshot(path='screenshot_radar_overview.png')
    
    # Zoom in twice to inspect flood boundary details
    plus = page.locator('.lucide-plus').first
    if plus:
        plus.click()
        page.wait_for_timeout(500)
        plus.click()
        page.wait_for_timeout(1000)
        
    # 2. Capture Refined Radar Mode (Zoomed in on boundary)
    page.screenshot(path='screenshot_radar_zoomed.png')
    
    # 3. Toggle to Scientific GIS Mode
    page.evaluate('''() => {
        // Find Mode button in bottom left or toolbar and click it
        const modeBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('MODE:') || b.innerText.includes('RADAR') || b.innerText.includes('GIS'));
        if (modeBtn) modeBtn.click();
    }''')
    page.wait_for_timeout(1500)
    
    # 4. Capture Scientific GIS Mode (Zoomed in on same boundary)
    page.screenshot(path='screenshot_scientific_gis_zoomed.png')
    
    browser.close()

print("All validation screenshots captured successfully.")
