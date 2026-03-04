"""
SmartDCA ML Microservice — Flask
Endpoints:
  POST /ml/train        — retrain from MongoDB
  POST /ml/predict      — score a single case
  POST /ml/recommend-dca — evaluate all DCAs for a case
"""

import os
import json
import traceback
from datetime import datetime

import numpy as np
import pandas as pd
from flask import Flask, request, jsonify
from joblib import dump, load
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

from sklearn.compose import ColumnTransformer
from sklearn.ensemble import HistGradientBoostingClassifier, HistGradientBoostingRegressor
from sklearn.impute import SimpleImputer
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    confusion_matrix,
    mean_absolute_error,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

app = Flask(__name__)

# ═══════════════════════════════════════════
# Config
# ═══════════════════════════════════════════
MONGO_URI = os.environ.get("MONGO_URI")
if not MONGO_URI:
    raise RuntimeError("MONGO_URI environment variable is not set")
ARTIFACTS_DIR = os.environ.get("ARTIFACTS_DIR", "/app/artifacts")
FLASK_PORT = int(os.environ.get("FLASK_PORT", "5001"))
FLASK_DEBUG = os.environ.get("FLASK_DEBUG", "false").lower() == "true"

os.makedirs(ARTIFACTS_DIR, exist_ok=True)

# ═══════════════════════════════════════════
# Feature definitions (must match train.py)
# ═══════════════════════════════════════════
TARGET_CLASS = "recovered_within_60d"
TARGET_AMT = "recovered_amount_usd"
TARGET_DAYS = "recovery_days_from_allocation"

FEATURES = [
    "region", "industry", "invoice_amount_usd", "num_open_invoices",
    "overdue_days_at_allocation", "previous_default_count",
    "previous_recovery_rate", "payment_history_score", "credit_score_band",
    "contact_attempts_last_30d", "last_contact_channel", "dispute_flag",
    "promised_to_pay_flag", "assigned_dca_id", "sla_days",
]

CATEGORICAL = ["region", "industry", "credit_score_band", "last_contact_channel", "assigned_dca_id"]
NUMERIC = [c for c in FEATURES if c not in CATEGORICAL]

DEFAULT_DCAS = [f"DCA-{i:02d}" for i in range(1, 11)]

# ═══════════════════════════════════════════
# Loaded models (in-memory cache)
# ═══════════════════════════════════════════
_models = {"clf": None, "amt": None, "days": None, "loaded": False}


def _load_models():
    """Load model artifacts from disk if not already cached."""
    clf_path = os.path.join(ARTIFACTS_DIR, "model_recovery_prob.joblib")
    amt_path = os.path.join(ARTIFACTS_DIR, "model_recovery_amount.joblib")
    days_path = os.path.join(ARTIFACTS_DIR, "model_recovery_days.joblib")

    if os.path.exists(clf_path) and os.path.exists(amt_path) and os.path.exists(days_path):
        _models["clf"] = load(clf_path)
        _models["amt"] = load(amt_path)
        _models["days"] = load(days_path)
        _models["loaded"] = True
        print("✅ Models loaded from disk")
    else:
        print("⚠️  No model artifacts found — train first")
        _models["loaded"] = False


def _get_mongo_client():
    return MongoClient(MONGO_URI)


def build_preprocess():
    cat_pipe = Pipeline([
        ("imputer", SimpleImputer(strategy="most_frequent")),
        ("onehot", OneHotEncoder(handle_unknown="ignore")),
    ])
    num_pipe = Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
    ])
    return ColumnTransformer([
        ("cat", cat_pipe, CATEGORICAL),
        ("num", num_pipe, NUMERIC),
    ])


# ═══════════════════════════════════════════
# POST /ml/train
# ═══════════════════════════════════════════
@app.route("/ml/train", methods=["POST"])
def train():
    try:
        client = _get_mongo_client()
        db = client.get_default_database()
        cases_cursor = db["cases"].find({}, {"_id": 0})
        cases_list = list(cases_cursor)
        client.close()

        if len(cases_list) == 0:
            return jsonify({"error": "No cases found in MongoDB. Ingest data first."}), 400

        cases = pd.DataFrame(cases_list)
        print(f"📊 Training on {len(cases)} cases from MongoDB")

        # Clean
        for col in CATEGORICAL:
            if col in cases.columns:
                cases[col] = cases[col].fillna("UNKNOWN").astype(str)
        for col in ["dispute_flag", "promised_to_pay_flag"]:
            if col in cases.columns:
                cases[col] = cases[col].fillna(0).astype(int)

        # Validate required columns
        required = [TARGET_CLASS, TARGET_AMT, TARGET_DAYS] + FEATURES
        missing = [c for c in required if c not in cases.columns]
        if missing:
            return jsonify({"error": f"Missing columns: {missing}"}), 400

        random_state = 42
        threshold = 0.5

        # ── Classification ──
        X = cases[FEATURES].copy()
        y = cases[TARGET_CLASS].astype(int)

        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=random_state, stratify=y
        )

        clf_pipe = Pipeline([
            ("preprocess", build_preprocess()),
            ("model", HistGradientBoostingClassifier(
                random_state=random_state, max_depth=6, learning_rate=0.08, max_iter=250
            )),
        ])
        clf_pipe.fit(X_train, y_train)

        proba = clf_pipe.predict_proba(X_test)[:, 1]
        y_pred = (proba >= threshold).astype(int)

        cm = confusion_matrix(y_test, y_pred)
        tn, fp, fn, tp = cm.ravel()

        clf_metrics = {
            "accuracy": float(accuracy_score(y_test, y_pred)),
            "precision": float(precision_score(y_test, y_pred, zero_division=0)),
            "recall": float(recall_score(y_test, y_pred, zero_division=0)),
            "roc_auc": float(roc_auc_score(y_test, proba)),
            "pr_auc": float(average_precision_score(y_test, proba)),
            "confusion_matrix": {"tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)},
            "threshold": threshold,
        }

        # ── Regression ──
        if "recovered_flag" in cases.columns:
            recovered_mask = cases["recovered_flag"].astype(int) == 1
        else:
            recovered_mask = cases[TARGET_DAYS].notna()

        reg_data = cases.loc[recovered_mask].copy()
        if len(reg_data) < 200:
            reg_data = cases.copy()

        Xr = reg_data[FEATURES].copy()
        y_amt = reg_data[TARGET_AMT].astype(float)
        y_days = reg_data[TARGET_DAYS].astype(float)

        Xr_train, Xr_test, ya_train, ya_test = train_test_split(Xr, y_amt, test_size=0.2, random_state=random_state)
        Xd_train, Xd_test, yd_train, yd_test = train_test_split(Xr, y_days, test_size=0.2, random_state=random_state)

        amt_pipe = Pipeline([
            ("preprocess", build_preprocess()),
            ("model", HistGradientBoostingRegressor(random_state=random_state, max_depth=6, learning_rate=0.08, max_iter=300)),
        ])
        days_pipe = Pipeline([
            ("preprocess", build_preprocess()),
            ("model", HistGradientBoostingRegressor(random_state=random_state, max_depth=6, learning_rate=0.08, max_iter=300)),
        ])

        amt_pipe.fit(Xr_train, ya_train)
        days_pipe.fit(Xd_train, yd_train)

        reg_metrics = {
            "amount_mae": float(mean_absolute_error(ya_test, amt_pipe.predict(Xr_test))),
            "days_mae": float(mean_absolute_error(yd_test, days_pipe.predict(Xd_test))),
        }

        # Save artifacts
        dump(clf_pipe, os.path.join(ARTIFACTS_DIR, "model_recovery_prob.joblib"))
        dump(amt_pipe, os.path.join(ARTIFACTS_DIR, "model_recovery_amount.joblib"))
        dump(days_pipe, os.path.join(ARTIFACTS_DIR, "model_recovery_days.joblib"))

        metadata = {
            "features": FEATURES,
            "categorical": CATEGORICAL,
            "numeric": NUMERIC,
            "trained_at": datetime.utcnow().isoformat(),
            "n_rows": len(cases),
            "n_train": len(X_train),
            "n_test": len(X_test),
        }
        with open(os.path.join(ARTIFACTS_DIR, "metadata.json"), "w") as f:
            json.dump(metadata, f, indent=2)

        # Reload into memory
        _models["clf"] = clf_pipe
        _models["amt"] = amt_pipe
        _models["days"] = days_pipe
        _models["loaded"] = True

        result = {
            **clf_metrics,
            **reg_metrics,
            "n_rows": len(cases),
            "n_train": len(X_train),
            "n_test": len(X_test),
            "trained_at": metadata["trained_at"],
        }

        print(f"✅ Training complete: accuracy={clf_metrics['accuracy']:.4f}, roc_auc={clf_metrics['roc_auc']:.4f}")
        return jsonify(result)

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# ═══════════════════════════════════════════
# POST /ml/predict
# ═══════════════════════════════════════════
@app.route("/ml/predict", methods=["POST"])
def predict():
    try:
        if not _models["loaded"]:
            _load_models()
        if not _models["loaded"]:
            return jsonify({"error": "Models not trained yet. Call /ml/train first."}), 400

        data = request.get_json()
        if not data:
            return jsonify({"error": "No JSON body provided"}), 400

        # Fill defaults
        for c in CATEGORICAL:
            data.setdefault(c, "UNKNOWN")
        for c in NUMERIC:
            data.setdefault(c, 0)

        X = pd.DataFrame([data])[FEATURES]

        prob = float(_models["clf"].predict_proba(X)[:, 1][0])
        exp_amt = float(max(0.0, _models["amt"].predict(X)[0]))
        exp_days = float(max(0.0, _models["days"].predict(X)[0]))

        return jsonify({
            "prob_60d": round(prob, 4),
            "exp_amt": round(exp_amt, 2),
            "exp_days": round(exp_days, 1),
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# ═══════════════════════════════════════════
# POST /ml/recommend-dca
# ═══════════════════════════════════════════
def invoice_bucket(amount):
    if amount < 5000:
        return "S"
    if amount < 20000:
        return "M"
    if amount < 80000:
        return "L"
    return "XL"


@app.route("/ml/recommend-dca", methods=["POST"])
def recommend_dca():
    try:
        if not _models["loaded"]:
            _load_models()
        if not _models["loaded"]:
            return jsonify({"error": "Models not trained yet."}), 400

        case = request.get_json()
        if not case:
            return jsonify({"error": "No JSON body provided"}), 400

        for c in CATEGORICAL:
            case.setdefault(c, "UNKNOWN")
        for c in NUMERIC:
            case.setdefault(c, 0)
        case.setdefault("sla_days", 14)

        clf = _models["clf"]
        reg_amt = _models["amt"]
        reg_days = _models["days"]

        # Build segment multiplier from MongoDB history
        client = _get_mongo_client()
        db = client.get_default_database()
        cases_cursor = db["cases"].find(
            {"assigned_dca_id": {"$regex": "^DCA-"}},
            {"_id": 0, "assigned_dca_id": 1, "region": 1, "industry": 1,
             "invoice_amount_usd": 1, "recovered_flag": 1}
        )
        hist_list = list(cases_cursor)
        client.close()

        # Build segment table
        seg_table = {}
        global_recovered = 0
        global_total = 0

        for h in hist_list:
            key = (
                str(h.get("assigned_dca_id", "UNKNOWN")),
                str(h.get("region", "UNKNOWN")),
                str(h.get("industry", "UNKNOWN")),
                invoice_bucket(float(h.get("invoice_amount_usd", 0)))
            )
            if key not in seg_table:
                seg_table[key] = {"recovered": 0, "total": 0}
            seg_table[key]["total"] += 1
            rec = int(h.get("recovered_flag", 0))
            seg_table[key]["recovered"] += rec
            global_total += 1
            global_recovered += rec

        global_rate = global_recovered / max(global_total, 1)

        # Score each DCA
        per_dca = {}
        probs, amts, days_list = [], [], []

        for dca_id in DEFAULT_DCAS:
            row = dict(case)
            row["assigned_dca_id"] = dca_id
            X = pd.DataFrame([row])[FEATURES]

            prob = float(clf.predict_proba(X)[:, 1][0])
            exp_amt = float(max(0.0, reg_amt.predict(X)[0]))
            exp_days = float(max(0.0, reg_days.predict(X)[0]))

            per_dca[dca_id] = {"prob": prob, "exp_amt": exp_amt, "exp_days": exp_days}
            probs.append(prob)
            amts.append(exp_amt)
            days_list.append(exp_days)

        # Normalize
        prob_min, prob_max = min(probs), max(probs)
        amt_min, amt_max = min(amts), max(amts)
        day_min, day_max = min(days_list), max(days_list)

        def norm(x, a, b):
            return 0.0 if b - a < 1e-9 else (x - a) / (b - a)

        results = []
        region = str(case.get("region", "UNKNOWN"))
        industry = str(case.get("industry", "UNKNOWN"))
        bucket = invoice_bucket(float(case.get("invoice_amount_usd", 0)))

        for dca_id, s in per_dca.items():
            p_n = norm(s["prob"], prob_min, prob_max)
            a_n = norm(s["exp_amt"], amt_min, amt_max)
            d_n = norm(s["exp_days"], day_min, day_max)

            base = 0.6 * p_n + 0.2 * a_n - 0.2 * d_n

            seg_key = (dca_id, region, industry, bucket)
            seg_data = seg_table.get(seg_key)

            if seg_data and seg_data["total"] > 0:
                seg_rate = seg_data["recovered"] / seg_data["total"]
                # Confidence weighting: blend toward 1.0 for small samples
                n = seg_data["total"]
                confidence = min(n / 30.0, 1.0)
                raw_mult = seg_rate / max(global_rate, 1e-6)
                multiplier = max(0.6, min(1.6, 1.0 + confidence * (raw_mult - 1.0)))
                reason = f"Segment ({region}/{industry}/{bucket}): rate={seg_rate:.2f}, n={n}, conf={confidence:.2f} → mult={multiplier:.2f}"
            else:
                multiplier = 1.0
                reason = f"No segment history for {region}/{industry}/{bucket} → mult=1.0"

            final_score = base * multiplier

            results.append({
                "dca_id": dca_id,
                "final_score": round(float(final_score), 4),
                "prob_60d": round(s["prob"], 4),
                "exp_amt": round(s["exp_amt"], 2),
                "exp_days": round(s["exp_days"], 1),
                "reason": reason,
            })

        results.sort(key=lambda x: x["final_score"], reverse=True)
        top3 = results[:3]
        best_dca = top3[0]["dca_id"] if top3 else None

        return jsonify({
            "recommendations": top3,
            "best_dca": best_dca,
            "all_scores": results,
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# ═══════════════════════════════════════════
# Health
# ═══════════════════════════════════════════
@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "models_loaded": _models["loaded"]})


# ═══════════════════════════════════════════
# Startup
# ═══════════════════════════════════════════
if __name__ == "__main__":
    _load_models()
    app.run(host="0.0.0.0", port=FLASK_PORT, debug=FLASK_DEBUG)
