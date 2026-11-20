# DC-Cycle — Data Center Component Circularity & Rare Earth Traceability Platform

**DC-Cycle** is an asset-light B2B circularity control plane connecting Data Center & AI compute operators with vetted refurbishers and rare-earth recovery partners—proving end-to-end environmental, financial, and cryptographic accountability from decommissioning pickup to closed-loop certification.

---

## Architecture Summary

### 1. Backend (`/backend`)
- **Stack**: Python 3.10+, FastAPI, Uvicorn, SQLite (`sqlite3`), Pydantic v2, standard-library `hashlib` (SHA-256).
- **Auto-Seeding on Startup** (`backend/app/seed.py`):
  - **4 Data Center Clients**: *Nusantara AI Cloud DC-1*, *JakCore Hyperscale Campus*, *FinGrid Bank Server Ops*, *EduCompute Regional DC*.
  - **4 Downstream Off-Take Partners**: *SirkulTech Refurb* (SME), *NusaEdu Hardware Lab* (Edu), *IndoRareEarth NdFeB Recovery*, *KLHK-Certified Zero-Landfill Co.* (B3 Hazardous).
  - **5 Pre-Seeded Decommissioning Batches** spanning `SCHEDULED`, `WIPED_&_TRIAGED`, `PARTNER_PROCESSING`, and `CLOSED_LOOP_CERTIFIED` with valid SHA-256 chain hashes.
- **Core Engines** (`backend/app/services.py`):
  - **Non-Destructive Value-Stream Triage**: Enforces the **NIST SP 800-88** cryptographic data-wipe gate before splitting hardware into `45% Reuse/Refurbish`, `50% Material & NdFeB Recovery` (`4.0 kg NdFeB/ton`, `~30% energy savings` vs. primary mining), and `5% Certified B3 Residue` (`0% Landfill`), avoiding `2.775 tCO2e/ton` blended (`4.5 t/t` reuse + `1.5 t/t` material recovery).
  - **Mass-Balance Anti-Dumping Ledger**: Enforces `abs(input_kg - (reuse_kg + material_kg + residue_kg)) <= 0.5 kg`. Any deviation immediately returns `HTTP 422 (MASS_BALANCE_ANOMALY)`, commits a `CRITICAL` alert block to `custody_ledger`, and freezes downstream partner payout (`FROZEN`).
  - **SHA-256 Custody Chain**: Every lifecycle transition (`BATCH_SCHEDULED` → `NIST_WIPE_AND_TRIAGE` → `PARTNER_HANDOVER` → `CLOSED_LOOP_CERTIFIED` / `MASS_BALANCE_ANOMALY`) is linked via `prev_hash` and hashed into `entry_hash`. `GET /api/v1/ledger/verify` recomputes every block from genesis.

### 2. Frontend (`/frontend`)
- **Stack**: React 18, TypeScript, Vite, Tailwind CSS, `lucide-react`, `recharts`.
- **Aesthetic**: Executive dark-slate Enterprise Circularity Control Plane (`#090E1A` canvas, `#111827` cards, emerald `#10B981`, cyan `#06B6D4`, amber `#F59E0B`, crimson `#EF4444`), optimized for 1080p competition projection.
- **4 Control-Plane Modules**:
  1. **Executive Circularity Dashboard & Audit Ledger**: Live SQLite KPIs, Value-Stream Donut Chart, Monthly Circularity & NdFeB Trend, and live SHA-256 integrity verifier.
  2. **Decommissioning & Triage Workbench**: Hardware mix estimator with HDD NdFeB gram callouts, 1-click *Sample AI Data Center Batch (2.5 Tons)* loader, NIST 800-88 gate, and valuation summary card.
  3. **Partner Handshakes & ESG Certificate**: 4-stage custody stepper, *Verified Handshake* vs. *Simulate Illegal Dumping (-150 kg)* controls, and printable/JSON-exportable ESG Circularity Certificate modal.
  4. **SBMC Financial & Impact Simulator**: Interactive 50–3,000 t/yr volume slider, Year 1/2/3 pitch-deck presets, Revenue Streams stack chart, and Unit Economics Waterfall.

---

## Quick Start

### Windows (One-Click)
```bat
start.bat
```

### macOS / Linux (One-Click)
```bash
chmod +x start.sh
./start.sh
```

### Manual Launch
**Terminal 1 — Backend API (`http://127.0.0.1:8001`)**
```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate   |   macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload
```

**Terminal 2 — Frontend UI (`http://localhost:5173`)**
```bash
cd frontend
npm install
npm run dev
```

### Run Automated Sanity Tests
```bash
cd backend
.venv\Scripts\python.exe -m pytest -v tests/test_api.py
```

---

## 60-Second Live SBMC Competition Demo Script

1. **0:00 – 0:12 | Executive Control Plane (Tab 1)**
   - Show live KPIs from SQLite (`14.0 t` managed, NdFeB magnets recovered with `~30% Energy Saved`, embodied `CO2e` avoided, `95%` circularity / `0%` landfill).
   - Click **"Verify SHA-256 Ledger Integrity"** → judges see real-time validation (`CHAIN INTACT: 100%`).

2. **0:12 – 0:28 | Non-Destructive Triage & NIST Gate (Tab 2)**
   - Click **"Load Sample AI Data Center Batch (2.5 Tons: 80 Servers, 40 GPUs, 500 HDDs)"**.
   - Point out the highlighted HDD callout (`10,000 g / 10.0 kg` recoverable voice-coil NdFeB magnets).
   - Toggle **NIST 800-88 Cryptographic Data Wipe Verified** ON—explain how cryptographic erase replaces shredding so magnets and GPUs survive intact—and click **Execute Non-Destructive Triage**.
   - Show the generated Valuation Card (`$1,125` service fee + `$1,500` rev-share + `10.0 kg NdFeB` + `6.94 tCO2e`).

3. **0:28 – 0:45 | Anti-Dumping Accountability & ESG Certificate (Tab 3)**
   - On the newly triaged batch, click **"Simulate Illegal Dumping / Mass-Balance Mismatch"** → show the instant **HTTP 422 `MASS_BALANCE_ANOMALY`** alert (`-150 kg` discrepancy) and **`PAYOUT: FROZEN`** lock.
   - Click **"Resolve & Complete Verified Partner Handshake"** to submit reconciled weights → batch advances to `CLOSED_LOOP_CERTIFIED` and unlocks payout.
   - Open **"View & Export ESG Circularity Certificate"** to display the formal audit sheet (Print PDF / Export JSON).

4. **0:45 – 1:00 | 3-Year SBMC Financial & Rare Earth Scale (Tab 4)**
   - Click **Year 1 Pilot** (`150t` → `$197.5K Rev | +$16.5K EBIT`), **Year 2 Growth** (`600t` → `$774K Rev | +$182K EBIT`), and **Year 3 Scale** (`1,800t` → `$2.25M Rev | +$704K EBIT | 7,200 kg NdFeB | 4,995 tCO2e`), highlighting the Revenue Streams and Unit Economics Waterfall charts.
