# PARALLAX — Scientific Provenance & Physical Limitations

## NASA International Space Apps Challenge 2026: *Dancing with the SARs*

---

## 1. Complete Data Provenance

All synthetic aperture radar datasets ingested and analyzed by PARALLAX originate from official NASA and partner space agency archives.

### A. Mumbai & Thane Creek — NISAR L-Band Provisional Observations
- **Collection Name:** NISAR Level-2 Geocoded Polarimetric Covariance (GCOV) Provisional Product
- **Collection Concept ID:** `C1265893241-ASF`
- **Short Name:** `NISAR_L2_PR_GCOV`
- **Provider DAAC:** NASA Alaska Satellite Facility (ASF) DAAC / JPL / ISRO
- **Product Type:** L-band (1.2575 GHz, wavelength $\lambda = 24.0\text{ cm}$)
- **Coordinate Reference System:** WGS 84 / UTM Zone 43N (`EPSG:32643`)
- **Native Resolution:** 10 m $\times$ 10 m pixel spacing

#### Granule & Temporal Pairing:
| Observation | Granule Concept ID / Name | Acquisition Timestamp | Polarization | Orbit / Pass |
| :--- | :--- | :--- | :--- | :--- |
| **Pre-Event Baseline (Obs A)** | `NISAR_L2_PR_GCOV_001_172_056_A_20260721T010422_20260721T010447_P01101_F_N_J_001` | 2026-07-21 01:04:22 UTC | HH (Linear DN) | Pass 172, Track 056, Ascending |
| **Post-Event Target (Obs B)** | `NISAR_L2_PR_GCOV_001_172_056_A_20260802T010422_20260802T010447_P01101_F_N_J_001` | 2026-08-02 01:04:22 UTC | HH (Linear DN) | Pass 172, Track 056, Ascending |

#### NASA Harmony Job Provenance:
- **Harmony Job ID (Obs A):** `05f77862-ebec-4a9f-85ff-b31c9a099951`
- **Harmony Job ID (Obs B):** `78652cae-a619-42b7-a3ca-50c53d4eb896`
- **Processing Service:** `asf/harmony-gdal` subsetting and linear radiometric calibration
- **Output Rasters:** `data/cases/mumbai_nisar_2026/nisar_obs_a_hh.tif`, `nisar_obs_b_hh.tif`

---

## 2. Provenance Reconciliation (Phase 2 vs Phase 3)

During the Phase 2 Feasibility Investigation, initial CMR catalog searches identified early simulated test granules:
- Planned candidate 1: `G3241761892-ASF` (`NISAR_L2_PR_GCOV_001_034_012_A_20260805T123000...`)
- Planned candidate 2: `G3241761893-ASF` (`NISAR_L2_PR_GCOV_001_034_012_A_20260817T123000...`)

During Phase 3 implementation, NASA ASF CMR query reconciliation revealed that Track 034 covered inland Maharashtra outside the maritime tidal boundary of Thane Creek. To ensure authentic hydrologic and mangrove analysis across the Thane Creek Flamingo Sanctuary and Mumbai coastal floodplains, the query was re-targeted to **Pass 172, Track 056**, which provides direct nadir-swath coverage of Mumbai island and Thane Creek. The actual flight granules (`NISAR_L2_PR_GCOV_001_172_056_A_...`) were successfully acquired and processed through NASA Harmony jobs `05f77862-ebec-4a9f-85ff-b31c9a099951` and `78652cae-a619-42b7-a3ca-50c53d4eb896`.

---

## 3. Strict Scientific Disclaimers & Physical Terminology

### A. Categorical Definitions
In accordance with remote sensing scientific rigor, PARALLAX strictly avoids declaring unverified satellite anomalies as "confirmed floods". The detected zones are categorized into two explicit physical regimes:

1. **Backscatter Enhancement Zones ($\Delta HH \ge +2.5\text{ dB}$):**
   - **Reported Metric:** `571.13 km²`
   - **Label:** *Potential Inundation Candidates (Sub-Canopy Double-Bounce)*
   - **Primary Hypothesis:** Inundated vegetation where standing water underneath tree trunks creates a dihedral corner reflector, redirecting incident microwave energy directly back toward the satellite sensor.
   - **Alternative Physical Causes:**
     - Volumetric soil moisture surge in top 5–10 cm following torrential monsoon rain.
     - Mangrove leaf water content / dielectric permittivity surge.
     - Urban dihedral scattering (geometry shifts between wet roads and building facades).
     - Agricultural crop growth or vegetative biomass increase over the 12-day repeat cycle.

2. **Backscatter Attenuation Zones ($\Delta HH \le -3.0\text{ dB}$, $\sigma^0_{\text{post}} \le -15.0\text{ dB}$):**
   - **Reported Metric:** `2.85 km²`
   - **Label:** *Potential Surface Water Change (Specular Attenuation)*
   - **Primary Hypothesis:** Open-water expansion over previously dry terrain, creating a specular mirror that scatters radar energy away from the sensor.
   - **Alternative Physical Causes:**
     - Tidal mudflat wetting and drying cycles in Thane Creek.
     - Wind-driven surface roughness variations across bays and reservoirs.
     - Smooth sediment deposits following monsoonal drainage.

---

## 4. Methodological Limitations

### A. Single-Polarization Mode (HH Co-Pol Only)
- The provisional NISAR flight granules acquired over Pass 172 provided calibrated **HH co-polarization** channels.
- Full quad-pol (HH, HV, VH, VV) or dual-pol cross-ratio false-positive suppression ($\sigma^0_{HH} / \sigma^0_{HV}$) could not be executed because cross-polarized (HV) data was not distributed in this initial public provisional downlink mode.
- Consequently, some high-dielectric saturated soils or urban specular double-bounces cannot be spectrally distinguished from vegetative double-bounce using radar data alone.

### B. Prohibition of False Cross-City Comparison
PARALLAX explicitly rejects and forbids comparing the quantitative area figures of Mumbai against Chennai as if they represented comparable flood magnitudes:
1. **Different Radar Wavelengths:** Mumbai uses NISAR L-band ($\lambda = 24\text{ cm}$), whereas Chennai uses Sentinel-1 C-band ($\lambda = 5.6\text{ cm}$). L-band penetrates canopies; C-band scatters mostly off the upper canopy volume.
2. **Different Scene Footprints:** The analyzed Mumbai AOI encompasses $2,753.30\text{ km²}$, whereas the Chennai study footprint covers $412.80\text{ km²}$.
3. **Different Hydrologic Regimes:** Mumbai represents a coastal estuarine mangrove and tidal mudflat ecosystem under active monsoonal storm surge, while Chennai represents an urban river basin and marshland during a cyclonic inundation event.

Any direct quantitative comparison of detected square kilometers between these two cases is scientifically invalid and must be interpreted as independent sensor-specific demonstrations.

---

## 5. Peer Review & Verification Checklist

- [x] All candidate polygons are categorized with exact decibel differential criteria.
- [x] All raster units are strictly converted from linear DN to physical radar cross-section: $\sigma^0\text{ [dB]} = 10 \cdot \log_{10}(\text{DN})$.
- [x] Every vector feature includes metadata fields for physical category, detection rationale, and sensor origin.
- [x] No synthetic or simulated ground-truth confidence percentages are presented to the user.
- [x] All source scene identifiers and NASA Harmony provenance tokens are embedded in the case manifests.
