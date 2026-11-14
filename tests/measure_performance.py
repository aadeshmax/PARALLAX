import sys
import os
sys.path.insert(0, os.path.abspath("backend"))

import time
import statistics
import concurrent.futures
from starlette.testclient import TestClient
from app.main import app
from app.database import load_analysis_record, save_analysis_record
from app.services.search_service import search_service

client = TestClient(app)

def benchmark_endpoint(method, url, payload=None, n=10):
    latencies = []
    for _ in range(n):
        t0 = time.perf_counter()
        if method == "GET":
            r = client.get(url)
        else:
            r = client.post(url, json=payload)
        t1 = time.perf_counter()
        assert r.status_code in [200, 422], f"Status {r.status_code}"
        latencies.append((t1 - t0) * 1000) # ms
    return {
        "mean_ms": round(statistics.mean(latencies), 2),
        "median_ms": round(statistics.median(latencies), 2),
        "min_ms": round(min(latencies), 2),
        "max_ms": round(max(latencies), 2)
    }

def benchmark_concurrency(url, concurrency_levels=[1, 5, 10]):
    results = {}
    for c in concurrency_levels:
        latencies = []
        with concurrent.futures.ThreadPoolExecutor(max_workers=c) as executor:
            def req():
                t0 = time.perf_counter()
                r = client.get(url)
                t1 = time.perf_counter()
                return (t1 - t0) * 1000

            futures = [executor.submit(req) for _ in range(c)]
            for f in concurrent.futures.as_completed(futures):
                latencies.append(f.result())
        results[f"c_{c}"] = {
            "mean_ms": round(statistics.mean(latencies), 2),
            "max_ms": round(max(latencies), 2)
        }
    return results

if __name__ == "__main__":
    print("Measuring Health endpoint latency...")
    health_perf = benchmark_endpoint("GET", "/health", n=15)
    print("Health:", health_perf)

    print("Measuring Readiness endpoint latency...")
    readiness_perf = benchmark_endpoint("GET", "/readiness", n=10)
    print("Readiness:", readiness_perf)

    print("Measuring Datasets endpoint latency...")
    datasets_perf = benchmark_endpoint("GET", "/api/nasa/datasets", n=10)
    print("Datasets:", datasets_perf)

    print("Measuring Analysis Compare latency...")
    compare_perf = benchmark_endpoint("POST", "/api/analysis/compare", {"case_id": "demo_flood_case"}, n=3)
    print("Compare:", compare_perf)

    print("Measuring Concurrency on /health...")
    health_conc = benchmark_concurrency("/health", [1, 5, 10])
    print("Concurrency Health:", health_conc)

    print("Measuring Concurrency on /readiness...")
    readiness_conc = benchmark_concurrency("/readiness", [1, 5, 10])
    print("Concurrency Readiness:", readiness_conc)
