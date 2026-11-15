import os
from playwright.sync_api import sync_playwright

artifact_dir = r"C:\Users\TRB\.gemini\antigravity\brain\f21f5cee-bd5b-45de-98cd-93eb88ef3c81"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1600, "height": 900})
    page.goto("http://localhost:5173")
    page.wait_for_timeout(4000)

    # 1. Switch to Mumbai NISAR
    page.evaluate('''() => {
        const buttons = Array.from(document.querySelectorAll("button"));
        const dateBtn = buttons.find(b => b.textContent.includes("Event Date"));
        if (dateBtn) dateBtn.click();
    }''')
    page.wait_for_timeout(600)
    page.evaluate('''() => {
        const buttons = Array.from(document.querySelectorAll("button"));
        const mumbaiBtn = buttons.find(b => b.textContent.includes("Mumbai & Thane Creek"));
        if (mumbaiBtn) mumbaiBtn.click();
    }''')
    page.wait_for_timeout(4500)

    # Close the Analysis Inspector to reveal the full map
    page.evaluate('''() => {
        const xIcons = document.querySelectorAll(".lucide-x");
        xIcons.forEach(icon => {
            const btn = icon.closest("button");
            if (btn) btn.click();
        });
    }''')
    page.wait_for_timeout(1000)

    page.screenshot(path=os.path.join(artifact_dir, "screenshot_mumbai_nisar_map_open.png"))
    print("Captured open map for Mumbai.")

    # 2. Switch back to Chennai and capture open map
    page.evaluate('''() => {
        const buttons = Array.from(document.querySelectorAll("button"));
        const dateBtn = buttons.find(b => b.textContent.includes("Event Date"));
        if (dateBtn) dateBtn.click();
    }''')
    page.wait_for_timeout(600)
    page.evaluate('''() => {
        const buttons = Array.from(document.querySelectorAll("button"));
        const chennaiBtn = buttons.find(b => b.textContent.includes("Chennai"));
        if (chennaiBtn) chennaiBtn.click();
    }''')
    page.wait_for_timeout(4500)

    # Close panels again
    page.evaluate('''() => {
        const xIcons = document.querySelectorAll(".lucide-x");
        xIcons.forEach(icon => {
            const btn = icon.closest("button");
            if (btn) btn.click();
        });
    }''')
    page.wait_for_timeout(1000)

    page.screenshot(path=os.path.join(artifact_dir, "screenshot_chennai_opera_map_open.png"))
    print("Captured open map for Chennai.")
    browser.close()
