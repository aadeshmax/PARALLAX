import earthaccess
from dotenv import load_dotenv

load_dotenv()

auth = earthaccess.login(strategy="environment")

if not auth.authenticated:
    raise RuntimeError("Earthdata authentication failed")

results = earthaccess.search_data(
    short_name="OPERA_L3_DSWX-S1_V1",
    bounding_box=(80.0, 12.7, 80.4, 13.3),
    temporal=("2024-11-25", "2024-12-10"),
    count=2
)

print("Granules found:", len(results))

if results:
    files = earthaccess.download(
        results[:1],
        "./data/raw/dswx"
    )
    print("Downloaded files:", files)
else:
    print("No matching granules found.")




