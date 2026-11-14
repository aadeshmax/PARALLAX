"""
Run flood-event SAR inundation analysis from the CLI.
Example:
  python scripts/run_analysis.py \
    --pre-sar data/cases/real_event_rio_grande_do_sul/OPERA_L2_RTC-S1_T22JBM_20240426T220719Z_VV.tif \
    --post-sar data/cases/real_event_rio_grande_do_sul/OPERA_L2_RTC-S1_T22JBM_20240508T220719Z_VV.tif \
    --dswx data/cases/real_event_rio_grande_do_sul/OPERA_L3_DSWx-S1_T22JBM_20240508T220719Z_v1.0_B01_WTR.tif \
    --pre-vh data/cases/real_event_rio_grande_do_sul/OPERA_L2_RTC-S1_T22JBM_20240426T220719Z_VH.tif \
    --post-vh data/cases/real_event_rio_grande_do_sul/OPERA_L2_RTC-S1_T22JBM_20240508T220719Z_VH.tif \
    --out-dir data/processed/rio_grande_do_sul_event
"""
import argparse
import json
import os
import sys

# Ensure repository root is in python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.service import AnalysisRequest, run_pipeline


def main():
    parser = argparse.ArgumentParser(description="TERRA//PULSE SAR Inundation Analysis Runner")
    parser.add_argument("--pre-sar", required=True, help="Path to pre-event RTC-S1 GeoTIFF")
    parser.add_argument("--post-sar", required=True, help="Path to post-event RTC-S1 GeoTIFF")
    parser.add_argument("--dswx", required=True, help="Path to OPERA DSWx GeoTIFF baseline")
    parser.add_argument("--pre-vh", default=None, help="Optional pre-event VH GeoTIFF")
    parser.add_argument("--post-vh", default=None, help="Optional post-event VH GeoTIFF")
    parser.add_argument("--out-dir", default=None, help="Directory to save exported GeoTIFFs and metrics.json")
    parser.add_argument("--specular-thresh", type=float, default=-3.0, help="Specular change threshold (dB)")
    parser.add_argument("--double-bounce-thresh", type=float, default=2.5, help="Double bounce change threshold (dB)")

    args = parser.parse_args()

    req = AnalysisRequest(
        pre_sar_path=args.pre_sar,
        post_sar_path=args.post_sar,
        opera_dswx_path=args.dswx,
        pre_vh_sar_path=args.pre_vh,
        post_vh_sar_path=args.post_vh,
        output_dir=args.out_dir,
        specular_decrease_thresh_db=args.specular_thresh,
        double_bounce_increase_thresh_db=args.double_bounce_thresh
    )

    print("Running SAR inundation analysis...")
    res = run_pipeline(req)
    print("\n--- ANALYSIS COMPLETED ---")
    print(f"Analysis ID: {res.analysis_id}")
    print(f"Total Valid Area: {res.area_statistics.total_valid_area_sqkm} sq km")
    print(f"Baseline Water Area: {res.area_statistics.baseline_water_area_sqkm} sq km")
    print(f"Candidate Inundation: {res.area_statistics.candidate_inundation_area_sqkm} sq km")
    print(f"  - Specular: {res.area_statistics.specular_candidate_area_sqkm} sq km")
    print(f"  - Double-Bounce: {res.area_statistics.double_bounce_candidate_area_sqkm} sq km")
    print(f"Sensor Agreement (IoU): {res.area_statistics.iou_agreement}")
    print(f"Exported layers saved to: {res.raster_layer_references['metrics_json']}")


if __name__ == "__main__":
    main()
