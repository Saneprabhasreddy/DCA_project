# SmartDCA — AI-Powered Debt Collection Agency Management Platform

> MERN Stack + Python Flask ML Microservice

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌───────────────────┐
│   React UI  │────▶│  Node/Express    │────▶│  Flask ML Service │
│   (Vite)    │     │  (Backend API)   │     │  (Python)         │
│   :5173     │     │  :5000           │     │  :5001            │
└─────────────┘     └───────┬──────────┘     └────────┬──────────┘
                            │                         │
                            ▼                         ▼
                    ┌──────────────────────────────────────┐
                    │           MongoDB :27017             │
                    │  (cases, interactions, users, DCAs,  │
                    │   allocations, audit_logs, alerts,   │
                    │   ml_metrics)                        │
                    └──────────────────────────────────────┘
```

## Stack

| Layer      | Technology                                              |
| ---------- | ------------------------------------------------------- |
| Frontend   | React 18 + Vite + Tailwind CSS (JavaScript)             |
| Backend    | Node.js + Express + Mongoose (JavaScript)               |
| ML Service | Python Flask + scikit-learn + pandas + joblib            |
| Database   | MongoDB 7                                               |
| Auth       | JWT + bcrypt + RBAC (admin / manager / dca_user)        |
| DevOps     | Docker Compose                                          |

## ML Models

| Model                         | Type           | Target                       |
| ----------------------------- | -------------- | ---------------------------- |
| `model_recovery_prob.joblib`  | Classification | `recovered_within_60d`       |
| `model_recovery_amount.joblib`| Regression     | `recovered_amount_usd`       |
| `model_recovery_days.joblib`  | Regression     | `recovery_days_from_allocation` |

All models use **HistGradientBoosting** from scikit-learn with a custom preprocessing pipeline.

## Configuration

The project uses `dotenv` for configuration. **No secrets are hardcoded.**

### 1. Setup Environment Variables
Copy the example environment files to create your headers:

```bash
# Root (for Docker Compose)
cp .env.example .env

# Backend
cp backend/.env.example backend/.env

# Frontend
cp frontend/.env.example frontend/.env

# ML Service
cp ml-service/.env.example ml-service/.env
```

### 2. Default Credentials (in .env)

By default, the `SEED_USERS` variable in `.env` creates these users:

| Role     | Username   | Password     |
|----------|------------|--------------|
| Admin    | `admin`    | `admin123`   |
| Manager  | `manager`  | `manager123` |
| DCA User | `dca_user` | `dca123`     |

> **Security Note:** Change `JWT_SECRET` and passwords in your `.env` file before deploying to production.

## Quick Start

### 1. Start All Services

```bash
docker compose up --build
```


### 3. Ingest Dataset

1. Login as **admin**
2. Click **Data Ingestion** in the sidebar
3. Click **Ingest Dataset**
4. This loads:
   - 5,000 cases from `cases.csv`
   - ~20,000 interactions from `interactions.csv`
   - 10 DCA organizations (DCA-01 to DCA-10)
   - 3 default users (admin, manager, dca_user)

**Or via API:**
```bash
# Login
TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | jq -r '.token')

# Ingest
curl -X POST http://localhost:5000/api/admin/ingest \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

### 4. Train ML Models

1. Go to **Dashboard**
2. Click the **"Train Again"** button
3. Wait for training to complete (~30-60 seconds)
4. Dashboard updates with:
   - Accuracy, Precision, Recall, ROC AUC, PR AUC
   - Confusion Matrix (TN, FP, FN, TP)
   - Regression MAE for amount and days

**Or via API:**
```bash
curl -X POST http://localhost:5000/api/ml/train \
  -H "Authorization: Bearer $TOKEN"
```

### 5. Demo Walkthrough (End-to-End Recovery Flow)

#### Step 1: Create a New Case
- Click **Cases** in the sidebar.
- Click the **+ New Case** button in the top right.
- Fill out the required customer information (Email, Phone, Name). *Note: If these are missing, assignment will be blocked!*
- Set a mock invoice amount and other risk signals, then click **Create Case**.

#### Step 2: AI Predictions
- You are redirected to the new Case Detail Page.
- Under Action Buttons, click **Predict**.
- The ML microservice calculates the expected 60-day recovery probability, expected amount, and time-to-recover.

#### Step 3: Recommend & Assign DCA
- Click **Recommend DCA**. The system will use ML targeting to find the best-suited DCA organization.
- Review the Top 3 suggestions. Click **Assign** on the highest-ranking DCA.
- *If you artificially left Customer Contact empty, the system will prevent you from doing this.*

#### Step 4: DCA Agent Workbench
- Logout of the Admin account.
- Login as the assigned DCA user (e.g., `dca_1_user`, check DB or Admin Panel for exact credentials).
- The portal automatically places you into your **My Cases** workbench.
- Locate the newly assigned case (you can use the `Overdue SLA` or `PTPs` filters).

#### Step 5: Customer Outreach & Case Closure
- Open the Case. View the **Customer Contact** details box and click the one-click action to copy information.
- Click **Add** under the Interaction Timeline to register your activity (e.g., "Call Attempted").
- Once you reach a resolution, add another Interaction, setting the **Stage** dropdown to `Closed` and picking the Outcome (e.g. `Paid in Full`).
- Provide a closure reason ("Customer wired funds today"). Submit.
- The case is now locked system-wide as **Closed (Read-Only)** and SLA metrics officially calculate!

## API Reference

### Auth
| Method | Endpoint           | Description          |
| ------ | ------------------ | -------------------- |
| POST   | `/api/auth/login`  | JWT login            |
| GET    | `/api/auth/me`     | Current user info    |

### Admin (admin role only)
| Method | Endpoint                        | Description              |
| ------ | ------------------------------- | ------------------------ |
| POST   | `/api/admin/ingest`             | Seed DB from CSV dataset |
| POST   | `/api/admin/dcas`               | Create DCA org           |
| GET    | `/api/admin/dcas`               | List DCA orgs            |
| POST   | `/api/admin/dca-users`          | Create DCA user          |
| GET    | `/api/admin/dca-users`          | List DCA users           |
| POST   | `/api/admin/dca-users/:id/reset`| Reset password           |
| PATCH  | `/api/admin/dca-users/:id`      | Enable/disable user      |

### Cases
| Method | Endpoint                            | Description              |
| ------ | ----------------------------------- | ------------------------ |
| GET    | `/api/cases`                        | List cases (RBAC filtered)|
| GET    | `/api/cases/:case_id`               | Case detail              |
| GET    | `/api/cases/:case_id/interactions`  | Case interactions        |
| POST   | `/api/cases/:case_id/interactions`  | Add interaction          |
| POST   | `/api/cases/:case_id/predict`       | AI predict (admin/mgr)   |
| POST   | `/api/cases/:case_id/recommend`     | DCA recommend (admin/mgr)|
| POST   | `/api/cases/:case_id/assign`        | Assign DCA (admin/mgr)   |

### ML
| Method | Endpoint                | Description              |
| ------ | ----------------------- | ------------------------ |
| POST   | `/api/ml/train`         | Trigger model retraining |
| GET    | `/api/ml/metrics`       | Latest training metrics  |
| GET    | `/api/ml/metrics/history` | All training runs      |

### Flask ML Endpoints (internal)
| Method | Endpoint             | Description                |
| ------ | -------------------- | -------------------------- |
| POST   | `/ml/train`          | Retrain from MongoDB       |
| POST   | `/ml/predict`        | Score a single case        |
| POST   | `/ml/recommend-dca`  | Evaluate all DCAs for case |
| GET    | `/health`            | Health check               |

## MongoDB Collections

- `users` — Admin, Manager, DCA users with bcrypt passwords
- `dcaorgs` — DCA organizations (DCA-01..DCA-10+)
- `cases` — Seeded from cases.csv, includes AI scoring fields
- `interactions` — Seeded from interactions.csv
- `allocations` — DCA recommendations from ML
- `auditlogs` — Append-only activity log
- `alerts` — Case alerts
- `mlmetrics` — Training run results over time

## RBAC Rules

| Action              | Admin | Manager | DCA User |
| ------------------- | ----- | ------- | -------- |
| View all cases      | ✅    | ✅      | ❌       |
| View assigned cases | ✅    | ✅      | ✅       |
| Predict / Recommend | ✅    | ✅      | ❌       |
| Assign DCA          | ✅    | ✅      | ❌       |
| Train models        | ✅    | ✅      | ❌       |
| Add interactions    | ✅    | ✅      | ✅ (own) |
| Manage DCAs/Users   | ✅    | ❌      | ❌       |
| Ingest data         | ✅    | ❌      | ❌       |

## Running Without Docker

### Backend
```bash
cd backend
npm install
MONGO_URI=mongodb://localhost:27017/smartdca \
JWT_SECRET=smartdca_jwt_secret_key_2024 \
ML_SERVICE_URL=http://localhost:5001 \
node server.js
```

### ML Service
```bash
cd ml-service
pip install -r requirements.txt
MONGO_URI=mongodb://localhost:27017/smartdca \
ARTIFACTS_DIR=./artifacts \
python app.py
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Key Critical Flow

```
1. Admin ingests CSV → MongoDB (cases + interactions + DCAs + users)
2. Admin clicks "Train Again" → Backend calls Flask /ml/train → 
   Flask reads MongoDB cases → Trains 3 models → Saves artifacts → Returns metrics
3. Admin opens a case → Clicks "Predict" → Backend calls Flask /ml/predict →
   Returns probability + expected amount + expected days
4. Admin clicks "Recommend DCA" → Backend calls Flask /ml/recommend-dca →
   Flask evaluates all 10 DCAs using ML models + segment history →
   Returns top 3 with scores and reasons
5. Admin clicks "Assign" → Case updated in MongoDB (assigned_dca_id)
6. Admin clicks "Train Again" → Models retrain with latest assignments →
   Updated metrics reflect new data
```
