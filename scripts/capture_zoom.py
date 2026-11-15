from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={'width': 1600, 'height': 900})
    page.goto('http://localhost:5173')
    page.wait_for_timeout(3000)
    
    # Close panels
    page.evaluate('''() => {
        document.querySelectorAll(".lucide-x").forEach(icon => {
            const btn = icon.closest("button");
            if (btn) btn.click();
        });
    }''')
    page.wait_for_timeout(500)
    
    # Click zoom in 3 times
    for _ in range(3):
        page.evaluate('''() => {
            const plus = document.querySelector(".lucide-plus");
            if (plus) {
                const btn = plus.closest("button");
                if (btn) btn.click();
            }
        }''')
        page.wait_for_timeout(500)
        
    page.wait_for_timeout(2000)
    page.screenshot(path='map_zoomed_in.png')
    browser.close()

print("Zoomed in screenshot captured")
