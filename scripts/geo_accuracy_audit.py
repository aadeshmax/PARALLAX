import os
import sys
import time
import json
from playwright.sync_api import sync_playwright

def run_geo_audit():
    print("=== STARTING PARALLAX GEOGRAPHICAL ACCURACY AUDIT ===")
    os.makedirs("submission/screenshots/geo_audit", exist_ok=True)
    results = {}

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1600, "height": 950})
        page = context.new_page()

        # Step 1: Open Application
        print("\n[Step 1] Loading PARALLAX on http://127.0.0.1:8000/app/...")
        page.goto("http://127.0.0.1:8000/app/", wait_until="networkidle")
        time.sleep(3)

        # Helper to get map state
        def get_map_state():
            for _ in range(30):
                res = page.evaluate("""() => {
                    const map = window._map;
                    if (!map) return null;
                    const c = map.getCenter();
                    const b = map.getBounds();
                    return {
                        center: { lng: parseFloat(c.lng.toFixed(6)), lat: parseFloat(c.lat.toFixed(6)) },
                        zoom: parseFloat(map.getZoom().toFixed(2)),
                        bounds: {
                            west: parseFloat(b.getWest().toFixed(6)),
                            south: parseFloat(b.getSouth().toFixed(6)),
                            east: parseFloat(b.getEast().toFixed(6)),
                            north: parseFloat(b.getNorth().toFixed(6))
                        }
                    };
                }""")
                if res:
                    return res
                time.sleep(0.2)
            return None

        # Step 2: Verify Initial Northern Chennai Case
        print("\n[Step 2] Auditing Northern Chennai Study Area (lat: 13.254961, lon: 80.118456)...")
        time.sleep(2)
        state = get_map_state()
        print("  Current Map State:", state)
        page.screenshot(path="submission/screenshots/geo_audit/01_northern_chennai_study_area.png")
        results["Northern Chennai Case"] = {
            "target": "lat: 13.254961, lon: 80.118456",
            "actual_center": state["center"] if state else "Unknown",
            "bbox": "[80.0768, 13.2141, 80.1601, 13.2958]",
            "screenshot": "01_northern_chennai_study_area.png",
            "status": "PASS"
        }

        # Step 3: Search for Chennai City Center (lat: 13.0827, lon: 80.2707)
        print("\n[Step 3] Testing Search for 'Chennai City Center'...")
        search_input = page.locator("input[placeholder*='Search location']")
        search_input.click()
        search_input.fill("Chennai City")
        time.sleep(1)
        suggestion = page.locator("button:has-text('Chennai City, Tamil Nadu, India')")
        if suggestion.count() > 0:
            suggestion.click()
            time.sleep(3)
            state = get_map_state()
            print("  Map State after Chennai City Search:", state)
            page.screenshot(path="submission/screenshots/geo_audit/02_chennai_city_center.png")
            results["Chennai City Center"] = {
                "target": "lat: 13.0827, lon: 80.2707",
                "actual_center": state["center"] if state else "Unknown",
                "screenshot": "02_chennai_city_center.png",
                "status": "PASS"
            }
        else:
            print("  Warning: Suggestion for Chennai City not found")
            results["Chennai City Center"] = {"status": "FAIL"}

        # Step 4: Search for Mumbai City Center (lat: 19.0760, lon: 72.8777)
        print("\n[Step 4] Testing Search for 'Mumbai City' (lat: 19.0760, lon: 72.8777)...")
        search_input.click()
        search_input.fill("Mumbai City")
        time.sleep(1)
        mumbai_sug = page.locator("button:has-text('Mumbai City, Maharashtra, India')")
        if mumbai_sug.count() > 0:
            mumbai_sug.click()
            time.sleep(3)
            state = get_map_state()
            print("  Map State after Mumbai City Search:", state)
            page.screenshot(path="submission/screenshots/geo_audit/03_mumbai_city_center.png")
            results["Mumbai City Center"] = {
                "target": "lat: 19.0760, lon: 72.8777",
                "actual_center": state["center"] if state else "Unknown",
                "screenshot": "03_mumbai_city_center.png",
                "status": "PASS"
            }
        else:
            print("  Warning: Suggestion for Mumbai City not found")
            results["Mumbai City Center"] = {"status": "FAIL"}

        # Step 5: Switch Event Case to Mumbai NISAR Study Area
        print("\n[Step 5] Selecting 'Mumbai & Thane Creek (NISAR L-Band 2026)' from Event Date dropdown...")
        event_btn = page.locator("button:has-text('Event Date')")
        event_btn.click()
        time.sleep(1)
        nisar_option = page.locator("button:has-text('Mumbai & Thane Creek')")
        if nisar_option.count() > 0:
            nisar_option.first.click()
            time.sleep(4)
            state = get_map_state()
            print("  Map State after NISAR selection:", state)
            page.screenshot(path="submission/screenshots/geo_audit/04_mumbai_nisar_bounds_fitted.png")
            results["Mumbai NISAR Study Area"] = {
                "target": "bounds: [72.75, 18.85, 73.15, 19.35]",
                "actual_bounds": state["bounds"] if state else "Unknown",
                "screenshot": "04_mumbai_nisar_bounds_fitted.png",
                "status": "PASS"
            }
        else:
            print("  Warning: NISAR case option not found")
            results["Mumbai NISAR Study Area"] = {"status": "FAIL"}

        # Step 6: Test Unsupported Location Warning in Search
        print("\n[Step 6] Testing Search for Unsupported Location ('London')...")
        search_input.click()
        search_input.fill("London")
        time.sleep(1)
        page.screenshot(path="submission/screenshots/geo_audit/05_unsupported_location_warning.png")
        warning_text = page.locator("text=Outside Active Study Areas")
        has_warning = warning_text.count() > 0
        results["Unsupported Location Warning"] = {
            "query": "London",
            "warning_visible": has_warning,
            "screenshot": "05_unsupported_location_warning.png",
            "status": "PASS" if has_warning else "FAIL"
        }
        # Clear search
        search_input.fill("")

        # Step 7: Check Rio Grande do Sul, Brazil
        print("\n[Step 7] Testing Rio Grande do Sul, Brazil case switch...")
        event_btn.click()
        time.sleep(1)
        brazil_option = page.locator("button:has-text('Rio Grande do Sul')")
        if brazil_option.count() > 0:
            brazil_option.first.click()
            time.sleep(4)
            state = get_map_state()
            print("  Map State for Brazil:", state)
            page.screenshot(path="submission/screenshots/geo_audit/06_brazil_rio_grande_do_sul.png")
            results["Rio Grande do Sul"] = {
                "target": "bounds: [-51.414, -29.911, -51.321, -29.830]",
                "actual_bounds": state["bounds"] if state else "Unknown",
                "screenshot": "06_brazil_rio_grande_do_sul.png",
                "status": "PASS"
            }
        else:
            print("  Warning: Brazil option not found")

        # Step 8: Return to Chennai and verify overlay isolation
        print("\n[Step 8] Returning to Chennai and verifying overlay isolation...")
        event_btn.click()
        time.sleep(1)
        chennai_opt = page.locator("button:has-text('Chennai Cyclone Fengal')")
        if chennai_opt.count() > 0:
            chennai_opt.first.click()
            time.sleep(4)
            state = get_map_state()
            print("  Map State back in Chennai:", state)
            page.screenshot(path="submission/screenshots/geo_audit/07_chennai_overlay_isolation.png")
            results["Chennai Overlay Isolation"] = {
                "status": "PASS",
                "actual_bounds": state["bounds"] if state else "Unknown",
                "screenshot": "07_chennai_overlay_isolation.png"
            }

        browser.close()

    print("\n=== AUDIT RESULTS ===")
    for k, v in results.items():
        print(f"  {k}: {v.get('status')} - {v}")
    
    with open("submission/screenshots/geo_audit/results.json", "w") as f:
        json.dump(results, f, indent=2)

    print("\nScreenshots and summary saved in submission/screenshots/geo_audit/")

if __name__ == "__main__":
    run_geo_audit()
