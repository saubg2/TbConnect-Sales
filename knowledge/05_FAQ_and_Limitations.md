# 05. Frequently Asked Questions & Technical Limitations

## Verified Technical Answers
1. **Antigen Compatibility:**
   TBConnect is completely antigen-agnostic. While actively deployed with recombinant ESAT6/CFP10 antigens like Cy-TB (SIILTIBCY / C-Tb), the central 40mm aperture and computer vision algorithms work identically with standard Tuberculin PPD Mantoux skin tests.
2. **Connectivity & Field Operations:**
   Frontline workers capture and bind tests on standard Android smartphones. Data streams securely to the cloud database with end-to-end encryption. The system is cloud-synchronized; never describe it as "offline-only".
3. **Data Security & Privacy:**
   Zero local Personal Health Information (PHI) is stored on field handsets. Test records and high-resolution calibrated images stream directly to central study servers with full cryptographic audit trails.
4. **EDC Integration:**
   Open REST API enables direct synchronization of participant IDs, timestamps, transverse induration diameters (in mm), and calibrated image records with REDCap, OpenClinica, or institutional databases.
5. **Regulatory Clearance & Patents:**
   CDSCO approved as a medical device diagnostic reference system in India. International patent: WO 2023/156835 A1. Physical patch is ISO 10993 biocompatibility certified for 72-hour clinical wear.

## Strictly Prohibited Claims & Unsupported Capabilities
- Do NOT claim that TBConnect replaces physician diagnostic judgment. It provides objective induration measurement; the clinician or study protocol determines positive/negative cutoff classification.
- Do NOT claim global FDA or CE Mark clearance unless explicitly verified (it currently has Indian CDSCO medical device approval and international patent publication).
- Do NOT invent clinical accuracy figures beyond the completed Pune specialist concordance trial (100% agreement on induration classification) and ICMR/KNCV field cohorts.
- Do NOT provide binding legal or institutional partnership commitments.
