# 01. TBConnect Platform Overview

## What is TBConnect?
TBConnect is an integrated medical hardware and computer vision software system designed to standardize tuberculosis infection testing (Mantoux TST and new-generation recombinant ESAT6/CFP10 antigens like Cy-TB / SIILTIBCY / C-Tb) in clinical research studies, active case finding (ACF), and programmatic contact screening.

- **Developer & Engineering Lead:** Mylab Discovery Solutions
- **Official Web Portal:** https://www.tbconnect.in
- **Official Contact Desk:** contact@tbconnect.in
- **Regulatory Status:** CDSCO Approved Medical Device System (India)
- **Intellectual Property:** Published International Patent WO 2023/156835 A1 ("Optical reference system and automated image processing for intradermal induration measurement")

## Core Components
1. **The Patented TB SmartPatch:** A single-use, biocompatible optical reference patch applied around the injection wheal with a central 40mm SmartCut™ aperture, 4-point cardinal scale crosshairs, 4-gamut multi-spectral color calibration targets, and a serialized 1-to-1 matrix QR code.
2. **The TBConnect Mobile App:** An Android application that binds the physical patch to the participant intake record, manages the strict 48–72-hour clinical observation window with automated alerts, and uses on-device sub-millimeter computer vision to unwrap 3D arm-curvature, normalize lighting and skin reflectance, and report transverse induration diameters with specialist-grade objectivity.

## Intended Users & Clinical Audiences
- Principal Investigators (PIs) and academic trialists conducting vaccine, diagnostic, or preventive therapy trials.
- Epidemiologists and National TB Program coordinators managing decentralized contact screening cohorts.
- Clinical Research Organizations (CROs) and trial data managers requiring GCP-compliant digital audit trails and electronic data capture (EDC) synchronization.

## Primary Workflow
1. **Day 0 (Administration):** Health worker applies TB SmartPatch to participant forearm, scans QR code with Android app, and performs intradermal Mantoux or Cy-TB injection through the central 40mm aperture. Administration timestamp is cryptographically locked.
2. **Hours 0–48 (Adherence):** Hypoallergenic patch remains in place during normal activities. App tracks time window and dispatches scheduled return reminders.
3. **Hours 48–72 (Objective Reading):** Health worker captures photo via TBConnect app viewfinder. Computer vision detects fiducials, unwarps 3D arm curvature, normalizes color across skin tones, and calculates the transverse induration diameter in millimeters.
4. **Data Sync:** Result, image record, and metadata stream directly into the study database or electronic data capture (EDC) system via REST API.
